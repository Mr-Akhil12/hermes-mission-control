'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, RefreshCw, Clock, AlertTriangle, Calendar, Settings, Timer,
  ActivitySquare, TrendingUp, Zap, FileText, ChevronDown, ChevronRight,
  Terminal, ArrowLeft
} from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface CronJobDetail {
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
  last_delivery_error: string | null
  deliver: string
  profile: string
  created_at: string | null
  prompt: string
  script: string | null
  no_agent: boolean
  enabled_toolsets: string[]
  workdir: string | null
}

interface OutputFile {
  filename: string
  timestamp: string
  size: number
  preview: string
}

interface CronDetailData {
  job: CronJobDetail
  outputs: OutputFile[]
  total_outputs: number
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

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CronDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<CronDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'outputs' | 'history'>('overview')
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null)
  const [fullContent, setFullContent] = useState<Record<string, string>>({})
  const [activityOutputs, setActivityOutputs] = useState<Array<{ id: string; timestamp: string; status: string; details: string | null; metadata: Record<string, unknown> }>>([])
  const [activityHistory, setActivityHistory] = useState<Array<{ id: string; timestamp: string; status: string; action: string; session_id?: string; model?: string }>>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Resolve params (Next.js 16: params is a Promise)
  useEffect(() => {
    params.then(p => setJobId(p.id))
  }, [params])

  const loadData = useCallback(async () => {
    if (!jobId) return
    try {
      setError(null)
      setLoading(true)
      const res = await fetch(`/api/cron/${jobId}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Cron job not found')
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const result = await res.json()
      setData(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { loadData() }, [loadData])

  // Fetch activity data when switching to outputs or history tab
  const loadActivity = useCallback(async () => {
    if (!jobId || (tab !== 'outputs' && tab !== 'history')) return
    if (activityOutputs.length > 0 || activityHistory.length > 0) return // Already loaded
    try {
      setActivityLoading(true)
      const res = await fetch(`/api/cron/${jobId}/activity?type=${tab}`)
      if (res.ok) {
        const result = await res.json()
        setActivityOutputs(result.outputs || [])
        setActivityHistory(result.history || [])
      }
    } catch { /* ignore */ }
    finally { setActivityLoading(false) }
  }, [jobId, tab, activityOutputs.length, activityHistory.length])

  useEffect(() => { loadActivity() }, [loadActivity])

  const loadFullContent = async (filename: string) => {
    if (fullContent[filename]) return // Already loaded
    // The preview is already in the data — use it
    const output = data?.outputs.find(o => o.filename === filename)
    if (output) {
      setFullContent(prev => ({ ...prev, [filename]: output.preview }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto mb-2" />
        <p className="text-sm text-[var(--danger)]">{error || 'No data'}</p>
        <Link href="/cron" className="text-xs text-[var(--accent)] mt-3 inline-block hover:underline">← Back to Cron Jobs</Link>
      </div>
    )
  }

  const { job, outputs, total_outputs } = data
  const humanSchedule = getScheduleHuman(job.schedule_display || job.schedule || '')
  const isPaused = !job.enabled
  const hasError = job.last_status === 'error'

  return (
    <div className="space-y-6">
      {/* Back link + Header */}
      <div className="animate-slide-up">
        <Link href="/cron" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex items-center gap-1 mb-3">
          <ArrowLeft className="w-3 h-3" /> Back to Cron Jobs
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text">{job.name}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                hasError ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : isPaused ? 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]' : 'bg-[var(--success)]/10 text-[var(--success)]'
              }`}>
                {hasError ? 'Error' : isPaused ? 'Paused' : 'Active'}
              </span>
              <span className="ml-2">{job.deliver}</span>
              {job.profile !== 'default' && <span className="ml-2">· {job.profile}</span>}
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all self-start"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
        <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent)]" />
            <div>
              <p className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase">Last Run</p>
              <p className="text-xs sm:text-sm font-medium">{job.last_run_at ? timeAgo(job.last_run_at) : 'Never'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Timer className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent)]" />
            <div>
              <p className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase">Next Run</p>
              <p className="text-xs sm:text-sm font-medium">{job.next_run_at ? timeUntil(job.next_run_at) : 'Never'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <ActivitySquare className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent)]" />
            <div>
              <p className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase">Status</p>
              <p className="text-xs sm:text-sm font-medium">{job.last_status || 'Unknown'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent)]" />
            <div>
              <p className="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase">Total Runs</p>
              <p className="text-xs sm:text-sm font-medium">{total_outputs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: '120ms' }}>
        <div className="flex border-b border-[var(--border)]">
          {(['overview', 'outputs', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-3 text-left text-sm font-medium capitalize transition-all ${
                tab === t
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t}{t === 'outputs' && total_outputs > 0 ? ` (${total_outputs})` : ''}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Overview tab */}
          {tab === 'overview' && (
            <div className="space-y-4">
              {/* Schedule */}
              <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium flex items-center gap-1.5 mb-2">
                  <Calendar className="w-3 h-3" /> Schedule
                </p>
                <p className="text-sm text-[var(--text-primary)] font-medium">{humanSchedule}</p>
                {job.schedule_display && job.schedule !== job.schedule_display && (
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">{job.schedule}</p>
                )}
              </div>

              {/* Configuration */}
              <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium flex items-center gap-1.5 mb-2">
                  <Settings className="w-3 h-3" /> Configuration
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow label="Profile" value={job.profile || 'default'} />
                  <InfoRow label="State" value={job.state || 'Unknown'} />
                  <InfoRow label="Deliver To" value={job.deliver || 'local'} />
                  <InfoRow label="Created" value={job.created_at ? timeAgo(job.created_at) : 'Unknown'} />
                  <InfoRow label="Agent" value={job.no_agent ? 'Script only' : 'LLM Agent'} />
                  {job.script && <InfoRow label="Script" value={job.script} mono />}
                  {job.workdir && <InfoRow label="Workdir" value={job.workdir} mono />}
                  {job.enabled_toolsets.length > 0 && (
                    <InfoRow label="Toolsets" value={job.enabled_toolsets.join(', ')} />
                  )}
                </div>
              </div>

              {/* Errors */}
              {job.last_error && (
                <div className="rounded-xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-4">
                  <p className="text-xs text-[var(--danger)] uppercase tracking-wider font-medium flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3 h-3" /> Last Error
                  </p>
                  <p className="text-xs text-[var(--danger)]/80 break-words">{job.last_error}</p>
                </div>
              )}

              {job.last_delivery_error && (
                <div className="rounded-xl bg-[var(--warning)]/5 border border-[var(--warning)]/20 p-4">
                  <p className="text-xs text-[var(--warning)] uppercase tracking-wider font-medium flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3 h-3" /> Delivery Error
                  </p>
                  <p className="text-xs text-[var(--warning)]/80 break-words">{job.last_delivery_error}</p>
                </div>
              )}

              {/* Prompt preview */}
              {job.prompt && (
                <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium flex items-center gap-1.5 mb-2">
                    <Terminal className="w-3 h-3" /> Prompt
                  </p>
                  <pre className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto font-mono">
                    {job.prompt.substring(0, 2000)}
                    {job.prompt.length > 2000 && '\n\n... [truncated]'}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Outputs tab */}
          {tab === 'outputs' && (
            <div className="space-y-2">
              {activityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
                </div>
              ) : activityOutputs.length === 0 && outputs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-[var(--text-secondary)]">No outputs yet</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">Outputs appear here after the job runs</p>
                </div>
              ) : (
                <>
                  {/* Activity-sourced outputs (from Supabase) */}
                  {activityOutputs.map((output) => {
                    const isExpanded = expandedOutput === output.id
                    const filename = (output.metadata?.output_file as string) || output.id
                    const size = (output.metadata?.output_size as number) || 0
                    const runTime = output.metadata?.run_timestamp as string || output.timestamp
                    return (
                      <div key={output.id} className="rounded-xl border border-[var(--border)] overflow-hidden">
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedOutput(null)
                            } else {
                              setExpandedOutput(output.id)
                              setFullContent(prev => ({ ...prev, [output.id]: output.details || '' }))
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left"
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${output.status === 'error' ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'}`} />
                          <FileText className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{filename}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{runTime}</p>
                          </div>
                          {size > 0 && <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{formatBytes(size)}</span>}
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                        </button>
                        {isExpanded && output.details && (
                          <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-3">
                            <pre className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto font-mono leading-relaxed">
                              {output.details}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {/* Local filesystem outputs (when running locally) */}
                  {outputs.map((output) => {
                    const isExpanded = expandedOutput === output.filename
                    return (
                      <div key={output.filename} className="rounded-xl border border-[var(--border)] overflow-hidden">
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedOutput(null)
                            } else {
                              setExpandedOutput(output.filename)
                              loadFullContent(output.filename)
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-elevated)] transition-colors text-left"
                        >
                          <FileText className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{output.filename}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{output.timestamp}</p>
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{formatBytes(output.size)}</span>
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                        </button>
                        {isExpanded && (fullContent[output.filename] || output.preview) && (
                          <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-3">
                            <pre className="text-[10px] text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto font-mono leading-relaxed">
                              {fullContent[output.filename] || output.preview}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* History tab */}
          {tab === 'history' && (
            <div>
              {activityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
                </div>
              ) : activityHistory.length === 0 && outputs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-[var(--text-secondary)]">No run history</p>
                </div>
              ) : (
                <div className="space-y-1 divide-y divide-[var(--border)]">
                  {activityHistory.length > 0 ? activityHistory.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.status === 'error' ? 'bg-[var(--danger)]' : h.status === 'running' ? 'bg-[var(--warning)] animate-pulse' : 'bg-[var(--success)]'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)]">
                          {new Date(h.timestamp).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {h.action === 'job_executed' ? 'Executed' : h.action}
                          {h.model && ` · ${h.model}`}
                          {h.session_id && ` · ${h.session_id.substring(0, 20)}...`}
                        </p>
                      </div>
                      <span className={`text-[9px] uppercase tracking-wider font-medium ${
                        h.status === 'error' ? 'text-[var(--danger)]' : h.status === 'running' ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                      }`}>
                        {h.status}
                      </span>
                    </div>
                  )) : outputs.map((output) => (
                    <div key={output.filename} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors">
                      <div className="w-2 h-2 rounded-full bg-[var(--success)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)]">{output.timestamp}</p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate">{output.filename}</p>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">{formatBytes(output.size)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p className={`text-xs text-[var(--text-secondary)] ${mono ? 'font-mono' : ''} break-all`}>{value}</p>
    </div>
  )
}
