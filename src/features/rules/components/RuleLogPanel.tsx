import { CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { useRuleStore } from '@/features/rules/store/rule-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function RuleLogPanel() {
  const log      = useRuleStore(s => s.log)
  const clearLog = useRuleStore(s => s.clearLog)

  const displayed = log.slice(0, 20)

  return (
    <div className="border border-border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Rule Log</h3>
          {log.length > 0 && (
            <Badge variant="secondary" className="text-xs">{log.length}</Badge>
          )}
        </div>
        {log.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            onClick={clearLog}
          >
            <Trash2 size={12} />
            Clear log
          </Button>
        )}
      </div>

      <Separator />

      {/* Empty state */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <p className="text-sm">No rule firings yet</p>
          <p className="text-xs mt-1">Executed rules will appear here</p>
        </div>
      ) : (
        <ul className="divide-y divide-border max-h-80 overflow-y-auto">
          {displayed.map(entry => (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
              {/* Status icon */}
              <div className="pt-0.5 shrink-0">
                {entry.error ? (
                  <XCircle size={15} className="text-destructive" />
                ) : (
                  <CheckCircle size={15} className="text-green-500" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{entry.ruleName}</span>
                  {!entry.error && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {entry.actionsExecuted} action{entry.actionsExecuted !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  {entry.error && (
                    <span className="text-xs text-destructive truncate">{entry.error}</span>
                  )}
                </div>
                {entry.triggerSummary && (
                  <p className="text-xs text-muted-foreground truncate">{entry.triggerSummary}</p>
                )}
              </div>

              {/* Timestamp */}
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-xs text-muted-foreground">{formatTime(entry.firedAt)}</p>
                <p className="text-xs text-muted-foreground/60">{formatDate(entry.firedAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {log.length > 20 && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Showing last 20 of {log.length} entries
          </p>
        </div>
      )}
    </div>
  )
}
