'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Timer } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface CronJob {
  id: string
  name: string
  schedule: string
  schedule_display?: string
  enabled?: boolean
  state?: string
  last_run_at?: string | null
  next_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  created_at?: string
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 0) return 'Pending'
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function timeUntil(dateStr: string) {
  if (!dateStr) return '—'
  const s = (new Date(dateStr).getTime() - Date.now()) / 1000
  if (s < 0) return 'Overdue'
  if (s < 60) return `in ${Math.floor(s)}s`
  if (s < 3600) return `in ${Math.floor(s / 60)}m`
  if (s < 86400) return `in ${Math.floor(s / 3600)}h`
  return `in ${Math.floor(s / 86400)}d`
}

function getScheduleHuman(expr: string): string {
  if (!expr) return '—'
  if (expr === '*/1 * * * *') return 'Every minute'
  if (expr === '*/15 * * * *') return 'Every 15 min'
  if (expr === '0 */2 * * *') return 'Every 2 hours'
  if (expr === '0 * * * *') return 'Hourly'
  if (/^0 \d+ \* \* \*$/.test(expr)) {
    const utcHour = parseInt(expr.split(' ')[1])
    const saHour = (utcHour + 2) % 24
    return `Daily at ${saHour}:00 SAST`
  }
  if (/^0 \d+ \* \* \d+$/.test(expr)) return 'Weekly'
  if (/^0 \d+ \d+ \* \*$/.test(expr)) return 'Monthly'
  return expr
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/data?table=cron_jobs&limit=50&order=created_at.desc')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setJobs(data || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const activeJobs = jobs.filter(j => j.enabled !== false)
  const errorJobs = jobs.filter(j => j.last_status === 'error')

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Cron Jobs</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {activeJobs.length} active · {errorJobs.length} with errors
          </p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl glass-panel border border-[var(--border)] text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-4 sm:p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto mb-2" />
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl glass-panel border border-[var(--border)] p-12 sm:p-16 text-center">
          <Clock className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium text-[var(--text-secondary)]">No cron jobs found</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
          {jobs.map((job) => {
            const expr = job.schedule_display || job.schedule || '—'
            const humanSchedule = getScheduleHuman(expr)
            const hasError = job.last_status === 'error'
            return (
              <div key={job.id} className={`rounded-xl sm:rounded-2xl glass-panel border p-3 sm:p-4 card-hover ${hasError ? 'border-[var(--danger)]/30' : 'border-[var(--border)]'}`}>
                <div className="flex items-start gap-2 sm:gap-3">
                  {/* Icon */}
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${hasError ? 'bg-[var(--danger)]/10' : 'bg-[var(--accent)]/10'}`}>
                    {hasError ? <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--danger)]" /> : <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent)]" />}
                  </div>
                  {/* Content — takes remaining space, shrinks properly */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">{job.name}</h3>
                    <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-0.5">{humanSchedule}</p>
                    {job.last_error && (
                      <p className="text-[10px] sm:text-[11px] text-[var(--danger)]/70 mt-1 break-words leading-relaxed">{job.last_error}</p>
                    )}
                    {job.last_run_at && (
                      <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /> Last: {timeAgo(job.last_run_at)}
                      </p>
                    )}
                  </div>
                  {/* Status — fixed width, never grows */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      {hasError ? (
                        <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[var(--danger)]" />
                      ) : (
                        <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[var(--success)]" />
                      )}
                      <span className={`text-[9px] sm:text-[10px] uppercase tracking-wider font-medium ${hasError ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                        {hasError ? 'Error' : 'Active'}
                      </span>
                    </div>
                    {job.next_run_at && (
                      <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 sm:gap-1">
                        <Timer className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                        {timeUntil(job.next_run_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
