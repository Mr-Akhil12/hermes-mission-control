'use client'

import { FileText, Loader2, RefreshCw, AlertTriangle, Terminal } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

export const dynamic = 'force-dynamic'

export default function LogsPage() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<string[]>([])

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/data?table=agent_activities&limit=50&order=created_at.desc')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLogs((data || []).map((a: any) => `[${new Date(a.created_at).toLocaleTimeString()}] ${a.agent_name}: ${a.action}${a.details ? ' — ' + a.details : ''}`))
    } catch {
      setLogs(['Unable to load logs'])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Logs</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">System and agent logs</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl glass-panel border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)]">
          <Terminal className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">Agent Log Stream</span>
        </div>
        <div className="max-h-[600px] overflow-y-auto overflow-x-auto p-4 font-mono text-xs leading-relaxed">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-[var(--text-muted)] text-center py-10">No logs available</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="py-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors whitespace-nowrap">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
