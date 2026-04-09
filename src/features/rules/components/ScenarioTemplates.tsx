/**
 * ScenarioTemplates — pre-built cross-device automation templates.
 * Each template produces a partially-filled AutomationRule that the user
 * then customises in the full RuleEditor.
 */

import { Thermometer, Power, Wifi, Zap, Clock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AutomationRule } from '../store/rule-store.types'

export interface ScenarioTemplate {
  id:          string
  name:        string
  description: string
  category:    'sensor' | 'power' | 'schedule' | 'energy'
  icon:        React.ReactNode
  complexity:  'simple' | 'moderate' | 'advanced'
  build:       () => Partial<Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'fireCount'>>
}

const TEMPLATES: ScenarioTemplate[] = [
  // ── Sensor-based ─────────────────────────────────────────────────────────────
  {
    id: 'temp-relay',
    name: 'Temperature Guard',
    description: 'Turn on a relay when temperature exceeds a threshold, turn off when it drops.',
    category: 'sensor',
    icon: <Thermometer size={20} className="text-red-500" />,
    complexity: 'simple',
    build: () => ({
      name: 'Temperature Guard',
      description: 'Turn on relay when temperature is too high',
      enabled: true,
      trigger: {
        type:      'sensor-threshold' as const,
        deviceId:  '',
        sensorKey: 'AM2301.Temperature',
        operator:  '>' as const,
        value:     28,
        hysteresis: 2,
      },
      conditions: [],
      actions: [{
        type:           'relay-set' as const,
        targetDeviceId: '',
        relay:          'POWER',
        state:          'ON' as const,
        transport:      'auto' as const,
      }],
      cooldownMs: 60_000,
    }),
  },
  {
    id: 'humidity-alert',
    name: 'High Humidity Alert',
    description: 'Send a browser notification when humidity rises above a level.',
    category: 'sensor',
    icon: <Thermometer size={20} className="text-blue-500" />,
    complexity: 'simple',
    build: () => ({
      name: 'High Humidity Alert',
      enabled: true,
      trigger: {
        type:      'sensor-threshold' as const,
        deviceId:  '',
        sensorKey: 'AM2301.Humidity',
        operator:  '>' as const,
        value:     70,
        hysteresis: 5,
      },
      conditions: [],
      actions: [{
        type:  'notification' as const,
        title: 'High Humidity',
        body:  'Humidity is {{trigger.value}}% — consider ventilating.',
      }],
      cooldownMs: 300_000,
    }),
  },

  // ── Power / relay ─────────────────────────────────────────────────────────────
  {
    id: 'mirror-relay',
    name: 'Mirror Relay',
    description: 'When Device A relay changes, set Device B relay to the same state.',
    category: 'power',
    icon: <Power size={20} className="text-green-500" />,
    complexity: 'moderate',
    build: () => ({
      name: 'Mirror Relay',
      description: 'Sync relay state between two devices',
      enabled: true,
      trigger: {
        type:     'power-change' as const,
        deviceId: '',
        relay:    'POWER',
        to:       'any' as const,
      },
      conditions: [],
      actions: [
        {
          type:           'relay-set' as const,
          targetDeviceId: '',
          relay:          'POWER',
          state:          '{{trigger.value}}' as 'ON' | 'OFF' | 'TOGGLE',
          transport:      'auto' as const,
        },
      ],
      cooldownMs: 1_000,
    }),
  },
  {
    id: 'failover',
    name: 'Device Failover',
    description: 'When a device goes offline, turn on a backup device.',
    category: 'power',
    icon: <Wifi size={20} className="text-orange-500" />,
    complexity: 'moderate',
    build: () => ({
      name: 'Device Failover',
      description: 'Activate backup when primary goes offline',
      enabled: true,
      trigger: {
        type:     'device-online' as const,
        deviceId: '',
        to:       'offline' as const,
      },
      conditions: [],
      actions: [
        {
          type:           'relay-set' as const,
          targetDeviceId: '',
          relay:          'POWER',
          state:          'ON' as const,
          transport:      'auto' as const,
        },
        {
          type:  'notification' as const,
          title: 'Device Failover Activated',
          body:  'Primary device went offline. Backup is now ON.',
        },
      ],
      cooldownMs: 10_000,
    }),
  },

  // ── Schedule-based ────────────────────────────────────────────────────────────
  {
    id: 'morning-routine',
    name: 'Morning Routine',
    description: 'At a set time on weekdays, run a sequence of commands across devices.',
    category: 'schedule',
    icon: <Clock size={20} className="text-yellow-500" />,
    complexity: 'advanced',
    build: () => ({
      name: 'Morning Routine',
      description: 'Weekday morning automation sequence',
      enabled: true,
      trigger: {
        type: 'time-cron' as const,
        cron: '0 7 * * 1-5',
      },
      conditions: [],
      actions: [
        {
          type:           'relay-set' as const,
          targetDeviceId: '',
          relay:          'POWER',
          state:          'ON' as const,
          transport:      'auto' as const,
        },
        { type: 'delay' as const, durationMs: 5_000 },
        {
          type:  'notification' as const,
          title: 'Morning Routine',
          body:  'Good morning! Devices activated at {{time}}.',
        },
      ],
      cooldownMs: 3_600_000,
    }),
  },
  {
    id: 'night-off',
    name: 'Nightly Shutdown',
    description: 'At midnight, turn off all non-essential devices.',
    category: 'schedule',
    icon: <Clock size={20} className="text-indigo-500" />,
    complexity: 'simple',
    build: () => ({
      name: 'Nightly Shutdown',
      enabled: true,
      trigger: {
        type: 'time-cron' as const,
        cron: '0 0 * * *',
      },
      conditions: [],
      actions: [{
        type:           'relay-set' as const,
        targetDeviceId: '',
        relay:          'POWER',
        state:          'OFF' as const,
        transport:      'auto' as const,
      }],
      cooldownMs: 3_600_000,
    }),
  },

  // ── Energy ────────────────────────────────────────────────────────────────────
  {
    id: 'power-alert',
    name: 'High Power Alert',
    description: 'Notify when a device draws more power than expected.',
    category: 'energy',
    icon: <Zap size={20} className="text-yellow-500" />,
    complexity: 'simple',
    build: () => ({
      name: 'High Power Alert',
      enabled: true,
      trigger: {
        type:      'sensor-threshold' as const,
        deviceId:  '',
        sensorKey: 'ENERGY.Power',
        operator:  '>' as const,
        value:     2000,
        hysteresis: 100,
      },
      conditions: [],
      actions: [{
        type:  'notification' as const,
        title: 'High Power Draw',
        body:  'Power is {{trigger.value}}W — above your threshold.',
      }],
      cooldownMs: 300_000,
    }),
  },
]

const CATEGORY_LABELS: Record<string, string> = {
  sensor:   'Sensor',
  power:    'Power & Relay',
  schedule: 'Schedule',
  energy:   'Energy',
}

const COMPLEXITY_COLORS: Record<string, string> = {
  simple:   'bg-green-500/10 text-green-700 dark:text-green-400',
  moderate: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  advanced: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
}

interface Props {
  onSelect: (partial: ReturnType<ScenarioTemplate['build']>) => void
  onClose:  () => void
}

export function ScenarioTemplates({ onSelect, onClose }: Props) {
  const categories = [...new Set(TEMPLATES.map(t => t.category))]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Scenario Templates</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Start with a pre-built template — customise device and values after.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Start from scratch</Button>
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {CATEGORY_LABELS[cat]}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEMPLATES.filter(t => t.category === cat).map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => onSelect(tmpl.build())}
                className="text-left p-3 bg-card border border-border rounded-lg hover:border-primary/40 hover:bg-muted/40 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{tmpl.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{tmpl.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${COMPLEXITY_COLORS[tmpl.complexity]}`}>
                        {tmpl.complexity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tmpl.description}</p>
                  </div>
                  <ArrowRight size={14} className="shrink-0 mt-1 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export type { Props as ScenarioTemplatesProps }
