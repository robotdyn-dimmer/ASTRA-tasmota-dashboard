/**
 * EntityPanelConfigDialog — custom config dialog for the Entity Panel widget.
 *
 * Features:
 * - Title and compact mode settings
 * - 3-step inline entity picker (device → type → key → label)
 * - "Auto-fill from device" quick action
 * - Reorder (up/down) and remove entities
 * - Uses mqttTopic (not deviceId) for cross-browser stability
 */

import { useState } from 'react'
import { Settings2, Plus, Trash2, ChevronUp, ChevronDown, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useDeviceStore } from '@/features/devices/store/device-store'
import type { CustomConfigProps, PanelEntity, EntityPanelSettings, PanelEntityType } from '@/features/widgets/registry/widget-types'

type PickerStep = 'idle' | 'device' | 'type' | 'key' | 'label'

interface PickerState {
  step:          PickerStep
  mqttTopic?:    string
  entityType?:   PanelEntityType
  entityKey?:    string
  label:         string
}

const ENERGY_KEYS = [
  { key: 'ENERGY.Power',   label: 'Power (W)' },
  { key: 'ENERGY.Voltage', label: 'Voltage (V)' },
  { key: 'ENERGY.Current', label: 'Current (A)' },
  { key: 'ENERGY.Today',   label: 'Energy today (kWh)' },
  { key: 'ENERGY.Total',   label: 'Energy total (kWh)' },
]

export default function EntityPanelConfigDialog({
  open, settings, onSave, onClose,
}: CustomConfigProps) {
  const allDevices = useDeviceStore(s => s.devices)
  const allStates  = useDeviceStore(s => s.deviceStates)
  const deviceList = Object.values(allDevices)

  const s = settings as Partial<EntityPanelSettings>
  const [title,    setTitle]    = useState(s.panelTitle ?? '')
  const [compact,  setCompact]  = useState(s.compact    ?? false)
  const [entities, setEntities] = useState<PanelEntity[]>(s.entities ?? [])
  const [picker,   setPicker]   = useState<PickerState>({ step: 'idle', label: '' })

  // ── Picker helpers ──────────────────────────────────────────────────────────

  const resetPicker = () => setPicker({ step: 'idle', label: '' })

  const commitEntity = () => {
    if (!picker.mqttTopic || !picker.entityType || !picker.entityKey) return
    const entity: PanelEntity = {
      id:         crypto.randomUUID(),
      mqttTopic:  picker.mqttTopic,
      entityType: picker.entityType,
      entityKey:  picker.entityKey,
      label:      picker.label.trim() || undefined,
    }
    setEntities(prev => [...prev, entity])
    resetPicker()
  }

  // Auto-fill all entities from a single device (STATUS 0 + GPIO config)
  const autoFillDevice = (mqttTopic: string) => {
    const device = deviceList.find(d => d.mqttTopic === mqttTopic)
    if (!device) return
    const state  = allStates[device.id]
    const newEntities: PanelEntity[] = []
    const addedKeys = new Set<string>()

    // STATUS 0 entities
    Object.keys(state?.power   ?? {}).forEach(key => {
      addedKeys.add(key)
      newEntities.push({ id: crypto.randomUUID(), mqttTopic, entityType: 'relay', entityKey: key })
    })
    Object.keys(state?.sensors ?? {}).forEach(key => {
      addedKeys.add(key)
      newEntities.push({ id: crypto.randomUUID(), mqttTopic, entityType: 'sensor', entityKey: key })
    })
    if (state?.energy) {
      addedKeys.add('ENERGY.Power')
      newEntities.push({ id: crypto.randomUUID(), mqttTopic, entityType: 'energy', entityKey: 'ENERGY.Power' })
    }

    // GPIO-discovered entities (skip those already added from STATUS 0)
    for (const gpio of state?.gpioConfig ?? []) {
      if (addedKeys.has(gpio.entityKey)) continue
      if (gpio.entityType === 'sensor' || gpio.entityType === 'energy') continue // already from STATUS
      newEntities.push({
        id: crypto.randomUUID(), mqttTopic, entityType: gpio.entityType, entityKey: gpio.entityKey,
      })
    }

    setEntities(prev => [...prev, ...newEntities])
    resetPicker()
  }

  // ── Entity list mutations ───────────────────────────────────────────────────

  const removeEntity = (id: string) => setEntities(prev => prev.filter(e => e.id !== id))
  const moveUp   = (i: number) => setEntities(prev => {
    if (i === 0) return prev
    const next = [...prev]; [next[i-1], next[i]] = [next[i], next[i-1]]; return next
  })
  const moveDown = (i: number) => setEntities(prev => {
    if (i === prev.length - 1) return prev
    const next = [...prev]; [next[i], next[i+1]] = [next[i+1], next[i]]; return next
  })

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const newSettings: EntityPanelSettings = {
      panelTitle: title.trim() || undefined,
      entities,
      compact,
    }
    // deviceIds for entity-panel: derive from unique mqttTopics → find deviceIds
    const usedTopics  = [...new Set(entities.map(e => e.mqttTopic))]
    const deviceIds   = usedTopics.flatMap(topic => {
      const d = deviceList.find(dev => dev.mqttTopic === topic)
      return d ? [d.id] : []
    })
    onSave(newSettings as unknown as Record<string, unknown>, deviceIds)
    onClose()
  }

  // ── Picker state for selected device ───────────────────────────────────────

  const pickerDevice     = picker.mqttTopic ? deviceList.find(d => d.mqttTopic === picker.mqttTopic) : undefined
  const pickerState      = pickerDevice ? allStates[pickerDevice.id] : undefined
  const availableRelays  = Object.keys(pickerState?.power   ?? {})
  const availableSensors = Object.keys(pickerState?.sensors ?? {})
  const hasEnergy        = !!pickerState?.energy
  const gpioConfig       = pickerState?.gpioConfig ?? []

  // GPIO-derived entity keys by type
  const gpioByType = (type: PanelEntityType) =>
    gpioConfig.filter(g => g.entityType === type).map(g => ({ key: g.entityKey, label: g.gpioName }))

  const availableTypes: PanelEntityType[] = [
    ...(availableRelays.length  > 0                          ? ['relay'        as const] : []),
    ...(availableSensors.length > 0                          ? ['sensor'       as const] : []),
    ...(hasEnergy                                            ? ['energy'       as const] : []),
    ...(gpioByType('pwm').length > 0                         ? ['pwm'          as const] : []),
    ...(gpioByType('counter').length > 0                     ? ['counter'      as const] : []),
    ...(gpioByType('button').length > 0                      ? ['button'       as const] : []),
    ...(gpioByType('switch_input').length > 0                ? ['switch_input' as const] : []),
    ...(gpioByType('adc').length > 0                         ? ['adc'          as const] : []),
    ...(gpioByType('led').length > 0                         ? ['led'          as const] : []),
  ]

  const typeKeys: Record<string, { key: string; label: string }[]> = {
    relay:        availableRelays.map(k => ({ key: k, label: k.replace('POWER', 'Relay ') })),
    sensor:       availableSensors.map(k => ({ key: k, label: k.split('.').pop() ?? k })),
    energy:       ENERGY_KEYS,
    pwm:          gpioByType('pwm'),
    counter:      gpioByType('counter'),
    button:       gpioByType('button'),
    switch_input: gpioByType('switch_input'),
    adc:          gpioByType('adc'),
    led:          gpioByType('led'),
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-muted-foreground" />
            <DialogTitle>Entity Panel — Settings</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground pt-1">
            Group relays, sensors, and energy from any devices into one card.
          </p>
        </DialogHeader>

        {/* ── Basic settings ── */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Panel title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Living Room"
              className="h-9"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Compact layout</p>
              <p className="text-xs text-muted-foreground">Smaller row height</p>
            </div>
            <Switch checked={compact} onCheckedChange={setCompact} />
          </div>
        </div>

        <Separator />

        {/* ── Entity list ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Entities</p>
            <Badge variant="secondary">{entities.length}</Badge>
          </div>

          {entities.length === 0 && picker.step === 'idle' && (
            <p className="text-xs text-muted-foreground/70 py-2 text-center">
              No entities yet. Add one below or auto-fill from a device.
            </p>
          )}

          {entities.map((entity, i) => (
            <div key={entity.id} className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1.5">
              <EntityTypeIcon type={entity.entityType} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {entity.label || entityDefaultLabel(entity)}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {entity.mqttTopic} · {entity.entityKey}
                </p>
              </div>
              <button onClick={() => moveUp(i)}   disabled={i === 0}                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp   size={13} /></button>
              <button onClick={() => moveDown(i)} disabled={i === entities.length - 1}  className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown size={13} /></button>
              <button onClick={() => removeEntity(entity.id)}                           className="p-0.5 rounded hover:text-destructive text-muted-foreground"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>

        {/* ── Inline picker ── */}
        {picker.step === 'idle' ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 flex-1"
              onClick={() => setPicker(p => ({ ...p, step: 'device' }))}
            >
              <Plus size={13} /> Add entity
            </Button>
            {deviceList.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 flex-1"
                onClick={() => setPicker(p => ({ ...p, step: 'device', label: '__autofill__' }))}
              >
                <Zap size={13} /> Auto-fill device
              </Button>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">

            {/* Step: select device */}
            {(picker.step === 'device') && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {picker.label === '__autofill__' ? 'Select device to auto-fill' : 'Step 1 — Select device'}
                </p>
                <select
                  defaultValue=""
                  onChange={e => {
                    const topic = e.target.value
                    if (!topic) return
                    if (picker.label === '__autofill__') {
                      autoFillDevice(topic)
                    } else {
                      setPicker(p => ({ ...p, mqttTopic: topic, step: 'type' }))
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">— select device —</option>
                  {deviceList.map(d => (
                    <option key={d.id} value={d.mqttTopic}>
                      {d.friendlyName}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="ghost" onClick={resetPicker}>Cancel</Button>
              </div>
            )}

            {/* Step: select type */}
            {picker.step === 'type' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Step 2 — Entity type</p>
                {availableTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No data available from this device yet. Try again after it sends telemetry.
                  </p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {availableTypes.map(type => (
                      <Button
                        key={type}
                        size="sm"
                        variant="outline"
                        className="capitalize"
                        onClick={() => setPicker(p => ({
                          ...p,
                          entityType: type,
                          step: 'key',
                        }))}
                      >
                        <EntityTypeIcon type={type} />
                        {type}
                      </Button>
                    ))}
                  </div>
                )}
                <Button size="sm" variant="ghost" onClick={() => setPicker(p => ({ ...p, step: 'device' }))}>← Back</Button>
              </div>
            )}

            {/* Step: select key */}
            {picker.step === 'key' && picker.entityType && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Step 3 — Select key</p>
                <select
                  defaultValue=""
                  onChange={e => {
                    const key = e.target.value
                    if (key) setPicker(p => ({ ...p, entityKey: key, step: 'label' }))
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">— select —</option>
                  {(typeKeys[picker.entityType] ?? []).map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <Button size="sm" variant="ghost" onClick={() => setPicker(p => ({ ...p, step: 'type' }))}>← Back</Button>
              </div>
            )}

            {/* Step: optional label */}
            {picker.step === 'label' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Step 4 — Custom label (optional)</p>
                <Input
                  value={picker.label}
                  onChange={e => setPicker(p => ({ ...p, label: e.target.value }))}
                  placeholder={`e.g. "Bedroom light"`}
                  className="h-9"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') commitEntity() }}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={commitEntity} className="gap-1.5">
                    <Plus size={13} /> Add entity
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPicker(p => ({ ...p, step: 'key' }))}>← Back</Button>
                  <Button size="sm" variant="ghost" onClick={resetPicker}>Cancel</Button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function entityDefaultLabel(entity: PanelEntity): string {
  if (entity.entityType === 'relay')        return entity.entityKey.replace('POWER', 'Relay ')
  if (entity.entityType === 'energy')       return entity.entityKey.replace('ENERGY.', '')
  if (entity.entityType === 'pwm')          return entity.entityKey.replace('PWM', 'PWM ')
  if (entity.entityType === 'counter')      return entity.entityKey.replace('COUNTER', 'Counter ')
  if (entity.entityType === 'button')       return entity.entityKey.replace('BUTTON', 'Button ')
  if (entity.entityType === 'switch_input') return entity.entityKey.replace('SWITCH', 'Switch ')
  if (entity.entityType === 'adc')          return entity.entityKey.replace('ADC.', '')
  if (entity.entityType === 'led')          return entity.entityKey.replace('LedPower', 'LED ')
  return entity.entityKey.split('.').pop() ?? entity.entityKey
}

const TYPE_ICONS: Record<string, string> = {
  relay: '🔌', sensor: '🌡️', energy: '⚡', pwm: '🎚️',
  counter: '#️⃣', button: '🔘', switch_input: '🔀', adc: '📊', led: '💡',
}

function EntityTypeIcon({ type }: { type: PanelEntityType }) {
  return <span className="text-[11px]">{TYPE_ICONS[type] ?? '❓'}</span>
}
