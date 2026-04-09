/**
 * rule-engine.ts — coordinator that wires triggers to condition evaluation
 * and action execution.
 *
 * Integration points:
 *   - device-mqtt-handler.ts  calls onDeviceUpdate() after each telemetry update
 *   - App.tsx                 calls ruleEngine.start() / stop()
 *   - rule-store.ts           provides the rule definitions
 */

import type {
  AutomationRule, EvaluationContext, ActionContext, RuleLogEntry,
  SensorThresholdTrigger, PowerChangeTrigger,
} from '../store/rule-store.types'
import type { DeviceState } from '@/features/devices/store/device-store.types'
import { useRuleStore } from '../store/rule-store'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { evaluateCondition } from './condition-evaluator'
import { executeActions } from './action-executor'
import { mqttClient } from '@/core/mqtt/MqttClient'

// ── Cron scheduler ────────────────────────────────────────────────────────────
// Minimal cron evaluation: "minute hour dom month dow"
// Evaluates once per minute via setInterval.

function cronMatches(cron: string, date: Date): boolean {
  const [minPart, hourPart, , , dowPart] = cron.trim().split(/\s+/)
  const min  = date.getMinutes()
  const hour = date.getHours()
  const dow  = date.getDay()   // 0=Sun..6=Sat

  const matchField = (part: string, val: number): boolean => {
    if (part === '*') return true
    return part.split(',').some(seg => {
      if (seg.includes('/')) {
        const [, step] = seg.split('/')
        return val % Number(step) === 0
      }
      if (seg.includes('-')) {
        const [lo, hi] = seg.split('-').map(Number)
        return val >= lo && val <= hi
      }
      return Number(seg) === val
    })
  }

  return matchField(minPart,  min)
      && matchField(hourPart, hour)
      && matchField(dowPart,  dow)
}

// ── Engine class ──────────────────────────────────────────────────────────────

class RuleEngine {
  private cronTimer:     ReturnType<typeof setInterval> | null = null
  private intervalMap:   Map<string, ReturnType<typeof setInterval>> = new Map()
  private mqttSubMap:    Map<string, () => void> = new Map()   // ruleId → unsubscribe fn
  private firing:        Set<string> = new Set()   // rules currently executing

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    this.stop()
    this.setupAllTriggers()
    // Re-setup when rules change (Zustand subscription)
    useRuleStore.subscribe(() => this.setupAllTriggers())
  }

  stop(): void {
    if (this.cronTimer) clearInterval(this.cronTimer)
    this.cronTimer = null
    this.intervalMap.forEach(t => clearInterval(t))
    this.intervalMap.clear()
    this.mqttSubMap.forEach((_, id) => this.unsubMqtt(id))
    this.mqttSubMap.clear()
  }

  // ── Called by device-mqtt-handler after each telemetry update ─────────────

  onDeviceUpdate(deviceId: string, newState: DeviceState, prevState: DeviceState | undefined): void {
    const rules = this.enabledRules()
    for (const rule of rules) {
      const t = rule.trigger
      if (t.type === 'sensor-threshold') {
        this.checkSensorThreshold(rule, t, deviceId, newState)
      } else if (t.type === 'power-change') {
        this.checkPowerChange(rule, t, deviceId, newState, prevState)
      } else if (t.type === 'device-online') {
        if (t.deviceId === deviceId) {
          const was = prevState?.online
          const is  = newState.online
          if (is !== was && ((t.to as string) === 'any' || (t.to === 'online' && is) || (t.to === 'offline' && !is))) {
            this.fire(rule, { triggerDevice: deviceId })
          }
        }
      }
    }
  }

  // Called externally (e.g. from run-rule action)
  async fireRule(ruleId: string, ctx: ActionContext): Promise<void> {
    const rules = useRuleStore.getState().rules
    const rule  = rules[ruleId]
    if (!rule || !rule.enabled) return
    await this.fire(rule, ctx)
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private enabledRules(): AutomationRule[] {
    return Object.values(useRuleStore.getState().rules).filter(r => r.enabled)
  }

  private checkSensorThreshold(
    rule:     AutomationRule,
    trigger:  SensorThresholdTrigger,
    deviceId: string,
    state:    DeviceState,
  ): void {
    if (trigger.deviceId !== deviceId) return
    const reading = state.sensors[trigger.sensorKey]
    if (!reading || typeof reading.value !== 'number') return
    const val = reading.value

    let fires: boolean
    switch (trigger.operator) {
      case '>':  fires = val >  trigger.value; break
      case '<':  fires = val <  trigger.value; break
      case '>=': fires = val >= trigger.value; break
      case '<=': fires = val <= trigger.value; break
      case '==': fires = val === trigger.value; break
      case '!=': fires = val !== trigger.value; break
      default:   fires = false
    }

    if (fires) this.fire(rule, { triggerDevice: deviceId, triggerValue: val })
  }

  private checkPowerChange(
    rule:      AutomationRule,
    trigger:   PowerChangeTrigger,
    deviceId:  string,
    newState:  DeviceState,
    prevState: DeviceState | undefined,
  ): void {
    if (trigger.deviceId !== deviceId) return
    const prev = prevState?.power[trigger.relay]
    const curr = newState.power[trigger.relay]
    if (prev === curr) return   // no change

    const matchTo =
      trigger.to === 'any'
      || (trigger.to === 'ON'  &&  curr)
      || (trigger.to === 'OFF' && !curr)

    if (matchTo) this.fire(rule, { triggerDevice: deviceId, triggerValue: curr ? 'ON' : 'OFF' })
  }

  private setupAllTriggers(): void {
    // Clear existing interval/mqtt triggers, rebuild
    this.intervalMap.forEach(t => clearInterval(t))
    this.intervalMap.clear()
    this.mqttSubMap.forEach((_, id) => this.unsubMqtt(id))
    this.mqttSubMap.clear()
    if (this.cronTimer) clearInterval(this.cronTimer)
    this.cronTimer = null

    const rules = this.enabledRules()
    let hasCron = false

    for (const rule of rules) {
      const t = rule.trigger
      if (t.type === 'time-cron') {
        hasCron = true
      } else if (t.type === 'time-interval') {
        const ms = Math.max(t.intervalMs, 10_000)
        this.intervalMap.set(rule.id, setInterval(() => {
          this.fire(rule, {})
        }, ms))
      } else if (t.type === 'mqtt-message') {
        this.subMqtt(rule, t.topicPattern, t.payloadMatch)
      }
    }

    if (hasCron) {
      this.cronTimer = setInterval(() => this.cronTick(), 60_000)
    }
  }

  private cronTick(): void {
    const now   = new Date()
    const rules = this.enabledRules().filter(r => r.trigger.type === 'time-cron')
    for (const rule of rules) {
      const t = rule.trigger as { type: 'time-cron'; cron: string }
      if (cronMatches(t.cron, now)) {
        this.fire(rule, { triggerValue: now.toISOString() })
      }
    }
  }

  private subMqtt(rule: AutomationRule, pattern: string, payloadMatch?: string): void {
    const handler = (message: import('@/core/mqtt/types').MqttMessage) => {
      if (payloadMatch) {
        try {
          if (!new RegExp(payloadMatch).test(message.payload)) return
        } catch { return }
      }
      this.fire(rule, { triggerValue: message.payload })
    }
    const unsub = mqttClient.subscribe(pattern, handler)
    this.mqttSubMap.set(rule.id, unsub)
  }

  private unsubMqtt(ruleId: string): void {
    const unsub = this.mqttSubMap.get(ruleId)
    if (unsub) unsub()
  }

  private async fire(
    rule: AutomationRule,
    extra: Partial<ActionContext>,
  ): Promise<void> {
    // Cooldown check
    if (rule.cooldownMs && rule.lastFiredAt) {
      if (Date.now() - rule.lastFiredAt < rule.cooldownMs) return
    }

    // Prevent concurrent execution of same rule
    if (this.firing.has(rule.id)) return
    this.firing.add(rule.id)

    const ctx: EvaluationContext = {
      deviceStates: useDeviceStore.getState().deviceStates,
      currentTime:  new Date(),
    }

    // Evaluate conditions
    const allPass = rule.conditions.every(c => evaluateCondition(c, ctx))
    if (!allPass) {
      this.firing.delete(rule.id)
      return
    }

    // Execute actions
    const actionCtx: ActionContext = {
      ...ctx,
      ...extra,
      depth: extra.depth ?? 0,
    }

    const { executed, error } = await executeActions(rule.actions, actionCtx)

    // Update rule metadata
    useRuleStore.getState().updateRule(rule.id, {
      lastFiredAt: Date.now(),
      fireCount:   rule.fireCount + 1,
    })

    // Append to log
    const entry: RuleLogEntry = {
      id:              `log_${Date.now()}_${rule.id}`,
      ruleId:          rule.id,
      ruleName:        rule.name,
      firedAt:         Date.now(),
      triggerSummary:  extra.triggerValue !== undefined ? String(extra.triggerValue) : undefined,
      actionsExecuted: executed,
      error,
    }
    useRuleStore.getState().appendLog(entry)

    this.firing.delete(rule.id)
  }
}

export const ruleEngine = new RuleEngine()
