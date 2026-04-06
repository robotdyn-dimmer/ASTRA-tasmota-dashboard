import type { WidgetDefinition } from './widget-types'

class WidgetRegistry {
  private widgets = new Map<string, WidgetDefinition>()

  register(definition: WidgetDefinition): void {
    if (this.widgets.has(definition.type)) {
      console.warn(`[WidgetRegistry] Widget type "${definition.type}" already registered, overwriting.`)
    }
    this.widgets.set(definition.type, definition)
  }

  get(type: string): WidgetDefinition | undefined {
    return this.widgets.get(type)
  }

  getAll(): WidgetDefinition[] {
    return Array.from(this.widgets.values())
  }

  has(type: string): boolean {
    return this.widgets.has(type)
  }
}

export const widgetRegistry = new WidgetRegistry()
