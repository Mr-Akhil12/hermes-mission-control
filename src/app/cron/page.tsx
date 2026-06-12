'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Timer, FileText, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface CronJob {
  id: string
  name: string
  schedule: string
  schedule_display: string
  enabled: boolean
  state: string
  last_run_at: string | null
  next_run_at: string | null
  last_status: string | null
  last_error: string | null
  deliver: string
  output_count: number
  prompt?: string
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 0) return 'Pending'
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function timeUntil(dateStr: string | null) {
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

  const everyNHours = expr.match(/^0 \*\/(\d+) \* \* \*$/)
  if (everyNHours) return `Every ${everyNHours[1]} hours`

  const dailyMatch = expr.match(/^0 (\d+) \* \* \*$/)
  if (dailyMatch) {
    const saHour = (parseInt(dailyMatch[1]) + 2) % 24
    return `Daily at ${saHour}:00 SAST`
  }

  const everyNDays = expr.match(/^0 (\d+) \*\/(\d+) \* \*$/)
  if (everyNDays) {
    const saHour = (parseInt(everyNDays[1]) + 2) % 24
    return `Every ${everyNDays[2]} days at ${saHour}:00 SAST`
  }

  if (/^0 \d+ \* \* \d+$/.test(expr)) return 'Weekly'
  if (/^0 \d+ \d+ \* \*$/.test(expr)) return 'Monthly'

  return expr
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openingChat, setOpeningChat] = useState<string | null>(null)
  const router = useRouter()

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/cron')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setJobs(data || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const filtered = jobs.filter(j =>
    j.name.toLowerCase().includes(search.toLowerCase()) ||
    j.deliver.toLowerCase().includes(search.toLowerCase())
  )

  const activeJobs = jobs.filter(j => j.enabled)
  const errorJobs = jobs.filter(j => j.last_status === 'error')
  const pausedJobs = jobs.filter(j => !j.enabled)

  const openChatWithCron = async (job: CronJob, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpeningChat(job.id)
    try {
      const res = await fetch('/api/chat/with-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cron_job_id: job.id,
          cron_job_name: job.name,
          cron_job_schedule: job.schedule_display || job.schedule,
          cron_job_prompt: job.prompt || '',
          cron_job_status: job.last_status,
          cron_job_last_run: job.last_run_at,
          cron_job_next_run: job.next_run_at,
          cron_job_error: job.last_error,
          cron_job_enabled: job.enabled,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/chat?conv=${data.id}`)
      }
    } catch { /* ignore */ }
    finally { setOpeningChat(null) }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Cron Jobs</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {activeJobs.length} active · {pausedJobs.length} paused · {errorJobs.length} errors · {jobs.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all w-40 sm:w-48"
          />
          <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl glass-panel border border-[var(--border)] text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-4 sm:p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto mb-2" />
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl glass-panel border border-[var(--border)] p-12 sm:p-16 text-center">
          <Clock className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium text-[var(--text-secondary)]">
            {search ? 'No matching jobs' : 'No cron jobs found'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
          {filtered.map((job) => {
            const expr = job.schedule_display || job.schedule || '—'
            const humanSchedule = getScheduleHuman(expr)
            const hasError = job.last_status === 'error'
            const isPaused = !job.enabled

            return (
              <div
                key={job.id}
                className={`rounded-xl sm:rounded-2xl glass-panel border p-3 sm:p-4 card-hover relative group ${
                  hasError ? 'border-[var(--danger)]/30' : isPaused ? 'border-[var(--text-muted)]/20 opacity-70' : 'border-[var(--border)]'
                }`}
              >
                <Link
                  href={`/cron/${job.id}`}
                  className="block"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    {/* Icon */}
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${
                      hasError ? 'bg-[var(--danger)]/10' : isPaused ? 'bg-[var(--text-muted)]/10' : 'bg-[var(--accent)]/10'
                    }`}>
                      {hasError ? (
                        <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--danger)]" />
                      ) : isPaused ? (
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-muted)]" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent)]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">{job.name}</h3>
                      <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-0.5">{humanSchedule}</p>
                      {job.last_error && (
                        <p className="text-[10px] sm:text-[11px] text-[var(--danger)]/70 mt-1 break-words leading-relaxed">{job.last_error}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        {job.last_run_at && (
                          <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /> Last: {timeAgo(job.last_run_at)}
                          </p>
                        )}
                        <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1">
                          <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /> {job.deliver}
                        </p>
                      </div>
                    </div>

                    {/* Status + Runs */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        {hasError ? (
                          <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[var(--danger)]" />
                        ) : isPaused ? (
                          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[var(--text-muted)]/30" />
                        ) : (
                          <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[var(--success)]" />
                        )}
                        <span className={`text-[9px] sm:text-[10px] uppercase tracking-wider font-medium ${
                          hasError ? 'text-[var(--danger)]' : isPaused ? 'text-[var(--text-muted)]' : 'text-[var(--success)]'
                        }`}>
                          {hasError ? 'Error' : isPaused ? 'Paused' : 'Active'}
                        </span>
                      </div>
                      {job.output_count > 0 && (
                        <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">
                          {job.output_count} runs
                        </span>
                      )}
                      {job.next_run_at && !isPaused && (
                        <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 sm:gap-1">
                          <Timer className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                          {timeUntil(job.next_run_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Chat button — positioned at bottom-right of card, below content */}
                <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-end opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => openChatWithCron(job, e)}
                    disabled={openingChat === job.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--purple)]/15 border border-[var(--purple)]/30 text-[var(--purple)] text-[10px] font-medium hover:bg-[var(--purple)]/25 transition-all disabled:opacity-50"
                    title="Open in Chat"
                  >
                    {openingChat === job.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <MessageSquare className="w-3 h-3" />
                    )}
                    <span>Chat</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
