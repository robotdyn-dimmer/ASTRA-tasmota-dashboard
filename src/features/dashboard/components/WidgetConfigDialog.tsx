/**
 * WidgetConfigDialog — renders a configuration form for a widget.
 *
 * Top section: Device selector (for single-device widgets).
 * Main section: Schema-driven fields from widget's configSchema.
 * Supports: string, number, boolean, array (comma-separated).
 * No @rjsf dependency — pure shadcn/ui.
 */

import { useState } from 'react'
import { Monitor, Settings2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { widgetRegistry } from '@/features/widgets/registry/widget-registry'
import { useDeviceStore } from '@/features/devices/store/device-store'
import type { JSONSchema7 } from 'json-schema'

interface WidgetConfigDialogProps {
  open:        boolean
  widgetType:  string
  instanceId:  string
  dashboardId: string
  settings:    Record<string, unknown>
  deviceIds:   string[]
  onSave:      (settings: Record<string, unknown>, deviceIds?: string[]) => void
  onClose:     () => void
}

export function WidgetConfigDialog({
  open, widgetType, settings, deviceIds, onSave, onClose,
}: WidgetConfigDialogProps) {
  const definition = widgetRegistry.get(widgetType)
  const allDevices = useDeviceStore(s => s.devices)
  const deviceList = Object.values(allDevices)

  const [formData,        setFormData]        = useState<Record<string, unknown>>({ ...settings })
  const [selectedDevice,  setSelectedDevice]  = useState<string>(deviceIds[0] ?? '')

  if (!definition) return null

  // entity-panel handles its own config dialog — don't show here
  if (definition.configComponent) return null

  const schema          = definition.configSchema
  const properties      = schema.properties ?? {}
  const propertyEntries = Object.entries(properties)

  const handleChange = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    const newDeviceIds = selectedDevice ? [selectedDevice] : deviceIds
    onSave(formData, newDeviceIds)
    onClose()
  }

  const hasSchema = propertyEntries.length > 0
  const showDeviceSelector = deviceList.length > 0  // always show if devices exist

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-muted-foreground" />
            <DialogTitle>{definition.name} — Settings</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground pt-1">{definition.description}</p>
        </DialogHeader>

        {/* ── Device selector ── */}
        {showDeviceSelector && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Monitor size={13} /> Device
              </Label>
              <select
                value={selectedDevice}
                onChange={e => setSelectedDevice(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— select device —</option>
                {deviceList.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.friendlyName}
                    {d.ipAddress ? ` (${d.ipAddress})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* ── Schema fields ── */}
        {!hasSchema && !showDeviceSelector ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            This widget has no configuration options.
          </div>
        ) : hasSchema ? (
          <>
            <Separator />
            <div className="space-y-4 py-2">
              {propertyEntries.map(([key, schemaDef]) => (
                <SchemaField
                  key={key}
                  fieldKey={key}
                  schema={schemaDef as JSONSchema7}
                  value={formData[key]}
                  onChange={v => handleChange(key, v)}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Field renderer ────────────────────────────────────────────────────────────

interface FieldProps {
  fieldKey: string
  schema:   JSONSchema7
  value:    unknown
  onChange: (value: unknown) => void
}

function SchemaField({ fieldKey, schema, value, onChange }: FieldProps) {
  const label       = schema.title ?? fieldKey
  const description = typeof schema.description === 'string' ? schema.description : undefined
  const type        = schema.type as string | undefined

  if (type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <Switch
          checked={Boolean(value ?? schema.default ?? false)}
          onCheckedChange={onChange}
        />
      </div>
    )
  }

  if (type === 'number' || type === 'integer') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldKey}>{label}</Label>
        <Input
          id={fieldKey}
          type="number"
          min={schema.minimum}
          max={schema.maximum}
          value={String(value ?? schema.default ?? '')}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder={String(schema.default ?? '')}
        />
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    )
  }

  if (type === 'array') {
    const arrVal = Array.isArray(value) ? value : []
    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldKey}>{label}</Label>
        <Input
          id={fieldKey}
          value={arrVal.join(', ')}
          onChange={e => onChange(
            e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)
          )}
          placeholder={description ?? 'Comma-separated values'}
        />
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldKey}>{label}</Label>
      <Input
        id={fieldKey}
        value={String(value ?? schema.default ?? '')}
        onChange={e => onChange(e.target.value)}
        placeholder={String(schema.default ?? '')}
      />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}
