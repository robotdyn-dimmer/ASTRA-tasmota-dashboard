import { ExternalLink, Code, Mail, Globe } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function AboutPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">ASTRA</h2>
        <p className="text-sm text-muted-foreground mt-1">Admin System for Tasmota Remote Access</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm leading-relaxed">
            ASTRA is an open-source browser-based dashboard for managing
            {' '}<a href="https://tasmota.github.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Tasmota</a>{' '}
            ESP32 devices on your local network. Control relays, monitor sensors and energy, configure
            rules and timers, build custom dashboards — all from a single interface.
          </p>

          <p className="text-sm leading-relaxed">
            Try it online at{' '}
            <a href="https://astra-app.rocketcontroller.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              astra-app.rocketcontroller.com
            </a>
          </p>

          <p className="text-sm leading-relaxed">
            The project is under active development. We welcome your feedback,
            bug reports, feature requests, and contributions.
          </p>

          <Separator />

          <div className="space-y-3">
            <a
              href="https://github.com/robotdyn-dimmer/ASTRA-tasmota-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Code size={16} className="shrink-0" />
              <span>GitHub Repository</span>
              <ExternalLink size={12} className="text-muted-foreground" />
            </a>

            <a
              href="https://www.rocketcontroller.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Globe size={16} className="shrink-0" />
              <span>rocketcontroller.com</span>
              <ExternalLink size={12} className="text-muted-foreground" />
            </a>

            <a
              href="mailto:info@rocketcontroller.com"
              className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
            >
              <Mail size={16} className="shrink-0" />
              <span>info@rocketcontroller.com</span>
            </a>
          </div>

          <Separator />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Version 0.1.0-dev</span>
            <span>License: MIT</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
