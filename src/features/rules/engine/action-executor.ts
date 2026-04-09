/**
 * action-executor.ts — executes a list of RuleAction sequentially.
 * Dispatches to mqttClient, tasmotaHttp, Notification API, fetch().
 * Template variables are substituted at execution time.
 */

import type { RuleAction, ActionContext } from '../store/rule-store.types'
import { mqttClient } from '@/core/mqtt/MqttClient'
import { tasmotaHttp } from '@/core/http/tasmota-http-client'
import { useDeviceStore } from '@/features/devices/store/device-store'
import { buildCommandTopic } from '@/lib/tasmota-topic-utils'
import { interpolate } from './template-vars'

const MAX_DEPTH = 5

export async function executeActions(
  actions: RuleAction[],
  ctx: ActionContext,
): Promise<{ executed: number; error?: string }> {
  if (ctx.depth > MAX_DEPTH) {
    return { executed: 0, error: 'run-rule depth limit exceeded (max 5)' }
  }

  let executed = 0
  for (const action of actions) {
    try {
      await executeOne(action, ctx)
      executed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { executed, error: `Action "${action.type}" failed: ${msg}` }
    }
  }
  return { executed }
}

async function executeOne(action: RuleAction, ctx: ActionContext): Promise<void> {
  switch (action.type) {

    case 'tasmota-command': {
      const command = interpolate(action.command, ctx)
      await dispatchCommand(action.targetDeviceId, command, action.transport)
      break
    }

    case 'relay-set': {
      const command = `${action.relay} ${action.state}`
      await dispatchCommand(action.targetDeviceId, command, action.transport)
      break
    }

    case 'mqtt-publish': {
      const topic   = interpolate(action.topic, ctx)
      const payload = interpolate(action.payload, ctx)
      mqttClient.publish(topic, payload, { qos: action.qos ?? 0, retain: action.retain ?? false })
      break
    }

    case 'delay': {
      const ms = Math.min(action.durationMs, 300_000)
      await new Promise(resolve => setTimeout(resolve, ms))
      break
    }

    case 'notification': {
      const title = interpolate(action.title, ctx)
      const body  = interpolate(action.body,  ctx)
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icons/icon-192.png' })
        } else if (Notification.permission !== 'denied') {
          const perm = await Notification.requestPermission()
          if (perm === 'granted') new Notification(title, { body, icon: '/icons/icon-192.png' })
        }
      }
      break
    }

    case 'http-request': {
      const url     = interpolate(action.url, ctx)
      const body    = action.body ? interpolate(action.body, ctx) : undefined
      await fetch(url, {
        method:  action.method,
        headers: action.headers,
        body:    action.method === 'POST' ? body : undefined,
      })
      break
    }

    case 'run-rule': {
      // Lazy import to avoid circular deps at module load time
      const { ruleEngine } = await import('./rule-engine')
      await ruleEngine.fireRule(action.ruleId, { ...ctx, depth: ctx.depth + 1 })
      break
    }
  }
}

async function dispatchCommand(
  deviceId: string,
  command: string,
  transport: 'mqtt' | 'http' | 'auto',
): Promise<void> {
  const devices = useDeviceStore.getState().devices
  const device  = devices[deviceId]
  if (!device) throw new Error(`Device ${deviceId} not found`)

  const useMqtt = transport === 'mqtt'
    || (transport === 'auto' && mqttClient.connectionState === 'connected')

  if (useMqtt) {
    const [cmd, ...args] = command.split(' ')
    mqttClient.publish(buildCommandTopic(device.mqttTopic, cmd), args.join(' ') || '')
    return
  }

  if (!device.ipAddress) throw new Error(`Device ${deviceId} has no IP address for HTTP transport`)
  const result = await tasmotaHttp.sendCommand(device.ipAddress, command)
  if (!result.ok) throw new Error(`HTTP command failed: ${JSON.stringify(result.data)}`)
}
