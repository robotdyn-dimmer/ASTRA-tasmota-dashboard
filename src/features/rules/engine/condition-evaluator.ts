/**
 * condition-evaluator.ts — pure function evaluator for RuleCondition trees.
 * No side effects. Takes a snapshot of device state at trigger time.
 */

import type { RuleCondition, TriggerOperator, EvaluationContext } from '../store/rule-store.types'

export function evaluateCondition(
  condition: RuleCondition,
  ctx: EvaluationContext,
): boolean {
  switch (condition.type) {
    case 'sensor-compare': {
      const state = ctx.deviceStates[condition.deviceId]
      if (!state) return false
      const reading = state.sensors[condition.sensorKey]
      if (!reading || typeof reading.value !== 'number') return false
      const lhs = reading.value

      let rhs: number
      if (condition.compareToSensor) {
        const refState = ctx.deviceStates[condition.compareToSensor.deviceId]
        const refReading = refState?.sensors[condition.compareToSensor.sensorKey]
        if (!refReading || typeof refReading.value !== 'number') return false
        rhs = refReading.value
      } else {
        rhs = condition.compareToLiteral ?? 0
      }
      return compare(lhs, condition.operator, rhs)
    }

    case 'power-state': {
      const state = ctx.deviceStates[condition.deviceId]
      if (!state) return false
      const isOn = state.power[condition.relay] === true
      return condition.state === 'ON' ? isOn : !isOn
    }

    case 'device-online': {
      const state = ctx.deviceStates[condition.deviceId]
      const isOnline = state?.online ?? false
      return condition.state === 'online' ? isOnline : !isOnline
    }

    case 'time-range': {
      const now     = ctx.currentTime
      const current = now.getHours() * 60 + now.getMinutes()
      const from    = parseHHMM(condition.from)
      const to      = parseHHMM(condition.to)
      return from <= to
        ? current >= from && current <= to
        : current >= from || current <= to   // spans midnight
    }

    case 'day-of-week': {
      const day = ctx.currentTime.getDay()   // 0=Sun..6=Sat
      return condition.days.includes(day)
    }

    case 'and':
      return condition.conditions.every(c => evaluateCondition(c, ctx))

    case 'or':
      return condition.conditions.some(c => evaluateCondition(c, ctx))

    case 'not':
      return !evaluateCondition(condition.condition, ctx)

    default:
      return false
  }
}

function compare(lhs: number, op: TriggerOperator, rhs: number): boolean {
  switch (op) {
    case '>':  return lhs > rhs
    case '<':  return lhs < rhs
    case '>=': return lhs >= rhs
    case '<=': return lhs <= rhs
    case '==': return lhs === rhs
    case '!=': return lhs !== rhs
  }
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
