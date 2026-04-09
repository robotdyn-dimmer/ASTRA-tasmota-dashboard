/**
 * Template variable substitution for rule action strings.
 *
 * Supported vars:
 *   {{trigger.value}}                       — the value that fired the trigger
 *   {{trigger.device}}                      — friendly name of trigger device
 *   {{device.<deviceId>.sensor.<key>}}      — sensor reading from any device
 *   {{device.<deviceId>.power.<relay>}}     — relay state (ON/OFF)
 *   {{time}}                                — current HH:MM
 *   {{date}}                                — current YYYY-MM-DD
 */

import type { ActionContext } from '../store/rule-store.types'
import { useDeviceStore } from '@/features/devices/store/device-store'

export function interpolate(template: string, ctx: ActionContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim()
    return resolveVar(trimmed, ctx) ?? `{{${trimmed}}}`
  })
}

function resolveVar(key: string, ctx: ActionContext): string | undefined {
  if (key === 'trigger.value') {
    return ctx.triggerValue !== undefined ? String(ctx.triggerValue) : undefined
  }

  if (key === 'trigger.device') {
    if (!ctx.triggerDevice) return undefined
    const devices = useDeviceStore.getState().devices
    return devices[ctx.triggerDevice]?.friendlyName ?? ctx.triggerDevice
  }

  if (key === 'time') {
    return ctx.currentTime.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  if (key === 'date') {
    return ctx.currentTime.toISOString().slice(0, 10)
  }

  // device.<id>.sensor.<key>
  const sensorMatch = key.match(/^device\.([^.]+)\.sensor\.(.+)$/)
  if (sensorMatch) {
    const [, deviceId, sensorKey] = sensorMatch
    const state = ctx.deviceStates[deviceId]
    const reading = state?.sensors[sensorKey]
    return reading !== undefined ? String(reading.value) : undefined
  }

  // device.<id>.power.<relay>
  const powerMatch = key.match(/^device\.([^.]+)\.power\.(.+)$/)
  if (powerMatch) {
    const [, deviceId, relay] = powerMatch
    const state = ctx.deviceStates[deviceId]
    if (!state) return undefined
    return state.power[relay] ? 'ON' : 'OFF'
  }

  return undefined
}
