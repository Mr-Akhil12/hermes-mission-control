'use client'

import { useState, useEffect } from 'react'
import { Activity, RefreshCw, Search, Clock, AlertTriangle, CheckCircle2, X, ChevronDown, Timer, Calendar, Settings, FileText } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { StatusDot } from '@/components/ui/StatusDot'
import { Pagination } from '@/components/ui/Pagination'
import { useSupabaseQuery } from '@/lib/useSupabaseQuery'

export const dynamic = 'force-dynamic'

interface ActivityItem {
  id: string
  agent_name: string
  action: string
  details: string | null
  status: 'running' | 'completed' | 'error'
  created_at: string
  metadata?: {
    job_id?: string
    job_name?: string
    session_id?: string
    model?: string
    messages?: number
    [key: string]: unknown
  }
}

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
  deliver?: string
  profile?: string
  created_at?: string
  updated_at?: string
}

const ITEMS_PER_PAGE = 20

function timeAgo(dateStr: string) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
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

  const everyNHours = expr.match(/^0 \*\/(\d+) \* \* \*$/)
  if (everyNHours) {
    const n = parseInt(everyNHours[1])
    return `Every ${n} hours`
  }

  const dailyMatch = expr.match(/^0 (\d+) \* \* \*$/)
  if (dailyMatch) {
    const utcHour = parseInt(dailyMatch[1])
    const saHour = (utcHour + 2) % 24
    return `Daily at ${saHour}:00 SAST`
  }

  const everyNDays = expr.match(/^0 (\d+) \*\/(\d+) \* \*$/)
  if (everyNDays) {
    const utcHour = parseInt(everyNDays[1])
    const n = parseInt(everyNDays[2])
    const saHour = (utcHour + 2) % 24
    return `Every ${n} days at ${saHour}:00 SAST`
  }

  if (/^0 \d+ \* \* \d+$/.test(expr)) return 'Weekly'
  if (/^0 \d+ \d+ \* \*$/.test(expr)) return 'Monthly'

  return expr
}

const statusDotClass: Record<string, string> = {
  completed: 'bg-[var(--success)]',
  error: 'bg-[var(--danger)]',
  running: 'bg-[var(--warning)]',
}

const statusLabel: Record<string, { text: string; color: string }> = {
  completed: { text: 'Completed', color: 'text-[var(--success)]' },
  error: { text: 'Error', color: 'text-[var(--danger)]' },
  running: { text: 'Running', color: 'text-[var(--warning)]' },
}

const TIME_FILTERS = [
  { key: '48h', label: '48 hours', hours: 48 },
  { key: '1d', label: 'Past day', hours: 24 },
  { key: '7d', label: 'Past 7 days', hours: 168 },
  { key: 'all', label: 'All time', hours: 0 },
]

const ACTIVITIES_KEY = '/api/data?table=agent_activities&limit=1000&order=created_at.desc'
const CRON_JOBS_KEY = '/api/data?table=cron_jobs&limit=100&order=created_at.desc'

export default function ActivityPage() {
  const {
    data: activitiesData,
    error: actError,
    isLoading: actLoading,
    mutate: mutateActivities,
  } = useSupabaseQuery<ActivityItem[]>(ACTIVITIES_KEY)

  const {
    data: cronData,
    error: cronError,
    isLoading: cronLoading,
  } = useSupabaseQuery<CronJob[]>(CRON_JOBS_KEY)

  const activities = activitiesData || []
  const cronJobs = cronData || []

  const loading = actLoading || cronLoading
  const error = actError?.message || cronError?.message || null
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [timeFilter, setTimeFilter] = useState<string>('7d')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null)
  const [cronOnly, setCronOnly] = useState(false)

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1) }, [search, statusFilter, timeFilter, cronOnly])

  // Build a map of cron job ID -> job details for quick lookup
  const cronJobMap = new Map<string, CronJob>()
  cronJobs.forEach(job => cronJobMap.set(job.id, job))

  // Apply all filters
  const filtered = activities.filter(a => {
    if (cronOnly && !(a.agent_name === 'cron' && a.action === 'job_executed')) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (timeFilter !== 'all') {
      const tf = TIME_FILTERS.find(t => t.key === timeFilter)
      if (tf && tf.hours > 0) {
        const cutoff = Date.now() - (tf.hours * 3600 * 1000)
        if (new Date(a.created_at).getTime() < cutoff) return false
      }
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        a.agent_name.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        (a.details && a.details.toLowerCase().includes(q))
      )
    }
    return true
  })

  // Pagination calculations
  const totalFiltered = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalFiltered)
  const pageItems = filtered.slice(startIndex, endIndex)

  const counts = {
    all: activities.length,
    completed: activities.filter(a => a.status === 'completed').length,
    error: activities.filter(a => a.status === 'error').length,
    running: activities.filter(a => a.status === 'running').length,
    cron: activities.filter(a => a.agent_name === 'cron').length,
  }

  const getActivityDisplayName = (a: ActivityItem): string => {
    if (a.agent_name === 'cron' && a.action === 'job_executed') {
      const jobName = a.metadata?.job_name
      if (jobName) return jobName
      const jobId = a.metadata?.job_id
      if (jobId && cronJobMap.has(jobId)) return cronJobMap.get(jobId)!.name || jobId
      return 'Cron Job'
    }
    return a.agent_name
  }

  const getCronJobForActivity = (a: ActivityItem): CronJob | null => {
    if (a.agent_name !== 'cron' || a.action !== 'job_executed') return null
    const jobId = a.metadata?.job_id
    if (jobId && cronJobMap.has(jobId)) return cronJobMap.get(jobId)!
    return null
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Activity Log</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {totalFiltered > 0
              ? `Showing ${startIndex + 1}–${endIndex} of ${totalFiltered} events`
              : `${activities.length} total events`}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-auto">
          <button
            onClick={() => mutateActivities()}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl glass-panel border border-[var(--border)] text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actLoading ? 'animate-spin' : ''}`} />
            {actLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="animate-slide-up space-y-3" style={{ animationDelay: '60ms' }}>
        {/* Search row */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by agent, action, or details..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-panel border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Time filters + Status filters + Cron toggle */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap">
          {/* Time filter */}
          <div className="flex items-center gap-1 glass-panel border border-[var(--border)] rounded-xl p-1">
            {TIME_FILTERS.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeFilter(tf.key)}
                className={`px-2.5 py-2 min-h-[44px] rounded-lg text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                  timeFilter === tf.key
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-1 glass-panel border border-[var(--border)] rounded-xl p-1">
            {(['all', 'completed', 'error', 'running'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-2 min-h-[44px] rounded-lg text-[10px] sm:text-xs font-medium transition-all capitalize ${
                  statusFilter === f
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
          {/* Cron-only toggle */}
          <button
            onClick={() => setCronOnly(!cronOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl border text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
              cronOnly
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30'
                : 'glass-panel border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
            }`}
          >
            <Clock className="w-3 h-3" />
            Cron only ({counts.cron})
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && activities.length === 0 ? (
        <LoadingSpinner text="Loading activities..." size="md" />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activities found"
          description="Try adjusting your filters or search query"
        />
      ) : (
        <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden" style={{ animationDelay: '120ms' }}>
          <div className="divide-y divide-[var(--border)]">
            {pageItems.map((a) => {
              const st = statusLabel[a.status] || { text: a.status, color: 'text-[var(--text-muted)]' }
              const displayName = getActivityDisplayName(a)
              const isCron = a.agent_name === 'cron' && a.action === 'job_executed'
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedActivity(a)}
                  className="w-full text-left flex items-start gap-3 px-4 sm:px-5 py-3.5 hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                >
                  <div className="mt-1 flex-shrink-0">
                    <StatusDot status={a.status} pulse={a.status === 'running'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold ${isCron ? 'text-[var(--warning)]' : 'text-[var(--accent)]'}`}>{displayName}</span>
                      {isCron && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)] font-medium uppercase tracking-wider">cron</span>}
                      <span className="text-xs text-[var(--text-secondary)]">{a.action}</span>
                      <span className={`text-[10px] font-medium ${st.color}`}>· {st.text}</span>
                    </div>
                    {a.details && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{a.details}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">{timeAgo(a.created_at)}</span>
                    <ChevronDown className="w-3 h-3 text-[var(--text-muted)] opacity-50" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[var(--text-muted)] hidden sm:block">
            Page {safeCurrentPage} of {totalPages}
          </p>
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Activity Detail Modal */}
      {selectedActivity && (() => {
        const isCron = selectedActivity.agent_name === 'cron' && selectedActivity.action === 'job_executed'
        const cronJob = isCron ? getCronJobForActivity(selectedActivity) : null
        const displayName = getActivityDisplayName(selectedActivity)
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setSelectedActivity(null)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal */}
            <div
              className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl glass-panel border border-[var(--border)] p-5 sm:p-6 animate-slide-up"
              onClick={e => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedActivity(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Status badge */}
              <div className="flex items-center gap-2 mb-4">
                <StatusDot status={selectedActivity.status} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${statusLabel[selectedActivity.status]?.color || 'text-[var(--text-muted)]'}`}>
                  {statusLabel[selectedActivity.status]?.text || selectedActivity.status}
                </span>
              </div>

              {/* Title */}
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">{displayName}</h2>
                {isCron && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)] font-medium uppercase tracking-wider">cron</span>}
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{selectedActivity.action}</p>

              {/* ─── CRON JOB DETAILS ─── */}
              {isCron && cronJob && (
                <div className="space-y-3 mb-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium flex items-center gap-1.5">
                    <Settings className="w-3 h-3" /> Cron Job Details
                  </p>

                  {/* Schedule */}
                  <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Schedule</p>
                        <p className="text-sm text-[var(--text-primary)] font-medium">{getScheduleHuman(cronJob.schedule_display || cronJob.schedule || '')}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{cronJob.schedule}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">State</p>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${cronJob.enabled !== false ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]'}`} />
                          <span className="text-xs text-[var(--text-secondary)]">{cronJob.enabled !== false ? 'Enabled' : 'Disabled'}</span>
                          {cronJob.state && <span className="text-[10px] text-[var(--text-muted)]">({cronJob.state})</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Profile</p>
                        <p className="text-xs text-[var(--text-secondary)]">{cronJob.profile || 'default'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Last Run</p>
                        <p className="text-xs text-[var(--text-secondary)]">{cronJob.last_run_at ? timeAgo(cronJob.last_run_at) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Next Run</p>
                        <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {cronJob.next_run_at ? timeUntil(cronJob.next_run_at) : '—'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Deliver To</p>
                      <p className="text-xs text-[var(--text-secondary)]">{cronJob.deliver || 'local'}</p>
                    </div>

                    {cronJob.last_status && (
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Last Status</p>
                        <div className="flex items-center gap-1.5">
                          {cronJob.last_status === 'ok' || cronJob.last_status === 'completed' ? (
                            <CheckCircle2 className="w-3 h-3 text-[var(--success)]" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-[var(--danger)]" />
                          )}
                          <span className={`text-xs ${cronJob.last_status === 'ok' || cronJob.last_status === 'completed' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            {cronJob.last_status}
                          </span>
                        </div>
                      </div>
                    )}

                    {cronJob.last_error && (
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Last Error</p>
                        <p className="text-xs text-[var(--danger)]/80 leading-relaxed break-words">{cronJob.last_error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Details */}
              {selectedActivity.details && (
                <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4 mb-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Details
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed break-words">{selectedActivity.details}</p>
                </div>
              )}

              {/* Timestamp */}
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">
                  {new Date(selectedActivity.created_at).toLocaleString('en-ZA', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Africa/Johannesburg',
                  })}
                  {' · '}
                  {timeAgo(selectedActivity.created_at)}
                </span>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
