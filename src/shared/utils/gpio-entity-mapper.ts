/**
 * gpio-entity-mapper.ts — maps Tasmota GPIO 255 response to entity definitions.
 *
 * Input:  raw GPIO 255 JSON: { GPIO0: { "None": 0 }, GPIO25: { "Relay1": 224 }, ... }
 * Output: GpioEntityInfo[] — one entry per entity-producing GPIO function.
 *
 * Functions that don't produce user-facing entities (I2C, SPI, Serial, LedLink,
 * DeepSleep, Reset, etc.) are intentionally skipped.
 */

import type { GpioEntityInfo } from '@/features/devices/store/device-store.types'
import type { PanelEntityType } from '@/features/widgets/registry/widget-types'

interface GpioMapping {
  match:        (name: string) => boolean
  entityType:   PanelEntityType
  keyPrefix:    string
  controlRange?: [number, number]
}

const GPIO_MAPPINGS: GpioMapping[] = [
  { match: n => /^Relay/i.test(n),                    entityType: 'relay',        keyPrefix: 'POWER' },
  { match: n => /^PWM/i.test(n),                      entityType: 'pwm',          keyPrefix: 'PWM',     controlRange: [0, 1023] },
  { match: n => /^Button/i.test(n),                    entityType: 'button',       keyPrefix: 'BUTTON' },
  { match: n => /^Switch/i.test(n),                    entityType: 'switch_input', keyPrefix: 'SWITCH' },
  { match: n => /^Counter/i.test(n),                   entityType: 'counter',      keyPrefix: 'COUNTER' },
  { match: n => /^Led[^L]/i.test(n) || n === 'Led',   entityType: 'led',          keyPrefix: 'LedPower' },
  { match: n => /^ADC/i.test(n),                       entityType: 'adc',          keyPrefix: 'ADC',     controlRange: [0, 1023] },
  { match: n => /^(DHT|AM\d|DS18|SI70|SHT|BME|BMP)/i.test(n), entityType: 'sensor', keyPrefix: 'SENSOR' },
  { match: n => /^(HLW|BL09|CSE7|PZEM|ADE7|HLWBL)/i.test(n),  entityType: 'energy', keyPrefix: 'ENERGY' },
]

/** Extract the numeric index from a GPIO function name: "Relay1" → 1, "PWM2" → 2 */
function extractIndex(name: string): number {
  const m = name.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

/**
 * Parse GPIO 255 response and return entity definitions.
 *
 * @param gpioData  Raw GPIO 255 JSON: { GPIO0: { "None": 0 }, GPIO25: { "Relay1": 224 }, ... }
 * @returns Array of GpioEntityInfo for entity-producing pins
 */
export function mapGpioToEntities(gpioData: Record<string, unknown>): GpioEntityInfo[] {
  const entities: GpioEntityInfo[] = []

  for (const [gpioKey, val] of Object.entries(gpioData)) {
    const pinMatch = gpioKey.match(/^GPIO(\d+)$/)
    if (!pinMatch) continue

    const gpioPin = parseInt(pinMatch[1], 10)

    // Parse { "FunctionName": code } format
    if (typeof val !== 'object' || val === null) continue
    const entries = Object.entries(val as Record<string, unknown>)
    if (entries.length === 0) continue

    const [gpioName, rawCode] = entries[0]
    const gpioCode = typeof rawCode === 'number' ? rawCode : parseInt(String(rawCode), 10)

    if (!gpioName || gpioName === 'None' || gpioCode === 0) continue

    // Find matching mapping
    const mapping = GPIO_MAPPINGS.find(m => m.match(gpioName))
    if (!mapping) continue

    const idx = extractIndex(gpioName)
    const entityKey = mapping.keyPrefix + idx

    entities.push({
      gpioPin,
      gpioCode,
      gpioName,
      entityType: mapping.entityType,
      entityKey,
      ...(mapping.controlRange ? { controlRange: mapping.controlRange } : {}),
    })
  }

  // Sort by entity type + index for consistent ordering
  entities.sort((a, b) => {
    if (a.entityType !== b.entityType) return a.entityType.localeCompare(b.entityType)
    return a.entityKey.localeCompare(b.entityKey)
  })

  return entities
}
