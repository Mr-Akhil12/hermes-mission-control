'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, RefreshCw, Clock, AlertTriangle, Calendar, Settings, Timer,
  ActivitySquare, TrendingUp, FileText, ChevronDown, ChevronRight,
  Terminal, ArrowLeft, Download, Copy, Check
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

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function CronDetailPage({ params }: any) {
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
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { params.then(p => setJobId(p.id)) }, [params])

  const loadData = useCallback(async () => {
    if (!jobId) return
    try {
      setError(null)
      setLoading(true)
      const res = await fetch(`/api/cron/${jobId}`)
      if (!res.ok) {
        if (res.status === 404) { setError('Cron job not found'); return }
        throw new Error(`HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setLoading(false) }
  }, [jobId])

  useEffect(() => { loadData() }, [loadData])

  const loadActivity = useCallback(async () => {
    if (!jobId || (tab !== 'outputs' && tab !== 'history')) return
    if (activityOutputs.length > 0 || activityHistory.length > 0) return
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

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">Loading cron job...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-[var(--danger)] mx-auto mb-3" />
        <p className="text-sm text-[var(--danger)] font-medium">{error || 'No data'}</p>
        <Link href="/cron" className="text-xs text-[var(--accent)] mt-4 inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-3 h-3" /> Back to Cron Jobs
        </Link>
      </div>
    )
  }

  const { job, outputs, total_outputs } = data
  const humanSchedule = getScheduleHuman(job.schedule_display || job.schedule || '')
  const isPaused = !job.enabled
  const hasError = job.last_status === 'error'

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient accent */}
      <div className="animate-slide-up">
        <Link href="/cron" className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex items-center gap-1 mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to Cron Jobs
        </Link>
        <div className="rounded-2xl bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-secondary)] border border-[var(--border)] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl sm:text-2xl font-bold gradient-text truncate">{job.name}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 ${
                  hasError ? 'bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/20' :
                  isPaused ? 'bg-[var(--text-muted)]/10 text-[var(--text-muted)] border border-[var(--text-muted)]/20' :
                  'bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hasError ? 'bg-[var(--danger)]' : isPaused ? 'bg-[var(--text-muted)]' : 'bg-[var(--success)] animate-pulse'}`} />
                  {hasError ? 'Error' : isPaused ? 'Paused' : 'Active'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)]" />
                  {job.deliver}
                </span>
                {job.profile !== 'default' && (
                  <>
                    <span className="text-[var(--border)]">·</span>
                    <span>{job.profile}</span>
                  </>
                )}
                <span className="text-[var(--border)]">·</span>
                <span className="font-mono text-[10px]">{job.id}</span>
              </div>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/20 hover:border-[var(--accent)]/30 transition-all self-start"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats cards with glow */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="Last Run"
          value={job.last_run_at ? timeAgo(job.last_run_at) : 'Never'}
          color="var(--accent)"
        />
        <StatCard
          icon={<Timer className="w-5 h-5" />}
          label="Next Run"
          value={job.next_run_at ? timeUntil(job.next_run_at) : 'Never'}
          color={job.next_run_at && timeUntil(job.next_run_at) === 'Overdue' ? 'var(--danger)' : 'var(--accent)'}
        />
        <StatCard
          icon={<ActivitySquare className="w-5 h-5" />}
          label="Status"
          value={job.last_status || 'Unknown'}
          color={hasError ? 'var(--danger)' : 'var(--success)'}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Total Runs"
          value={String(total_outputs)}
          color="var(--purple)"
        />
      </div>

      {/* Tabs with better styling */}
      <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)] animate-slide-up" style={{ animationDelay: '120ms' }}>
        <div className="flex border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          {([
            { key: 'overview' as const, label: 'Overview', icon: <Settings className="w-3.5 h-3.5" /> },
            { key: 'outputs' as const, label: 'Outputs', icon: <FileText className="w-3.5 h-3.5" />, count: total_outputs },
            { key: 'history' as const, label: 'History', icon: <Clock className="w-3.5 h-3.5" /> },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all relative ${
                tab === t.key
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold">
                  {t.count}
                </span>
              )}
              {tab === t.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Overview tab */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <SectionCard title="Schedule" icon={<Calendar className="w-3.5 h-3.5" />}>
                <p className="text-sm font-medium text-[var(--text-primary)]">{humanSchedule}</p>
                <p className="text-[11px] text-[var(--text-muted)] font-mono mt-1">{job.schedule || job.schedule_display}</p>
              </SectionCard>

              <SectionCard title="Configuration" icon={<Settings className="w-3.5 h-3.5" />}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              </SectionCard>

              {job.last_error && (
                <div className="rounded-xl bg-[var(--danger)]/5 border border-[var(--danger)]/15 p-4">
                  <p className="text-[11px] text-[var(--danger)] uppercase tracking-wider font-semibold flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> Last Error
                  </p>
                  <p className="text-xs text-[var(--danger)]/80 break-words leading-relaxed">{job.last_error}</p>
                </div>
              )}

              {job.prompt && (
                <SectionCard title="Prompt" icon={<Terminal className="w-3.5 h-3.5" />}>
                  <pre className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto font-mono leading-relaxed">
                    {job.prompt.substring(0, 2000)}
                    {job.prompt.length > 2000 && '\n\n... [truncated]'}
                  </pre>
                </SectionCard>
              )}
            </div>
          )}

          {/* Outputs tab */}
          {tab === 'outputs' && (
            <div className="space-y-3">
              {activityLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
                  <p className="text-xs text-[var(--text-muted)]">Loading outputs...</p>
                </div>
              ) : activityOutputs.length === 0 && outputs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-[var(--accent)]/30" />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] font-medium">No outputs yet</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">Outputs appear here after the job runs</p>
                </div>
              ) : (
                <>
                  {activityOutputs.map((output) => {
                    const isExpanded = expandedOutput === output.id
                    const filename = (output.metadata?.output_file as string) || output.id
                    const size = (output.metadata?.output_size as number) || 0
                    const runTime = (output.metadata?.run_timestamp as string) || output.timestamp
                    const content = output.details || ''

                    return (
                      <div key={output.id} className={`rounded-xl border overflow-hidden transition-all ${
                        isExpanded ? 'border-[var(--accent)]/30 bg-[var(--bg-secondary)]' : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                      }`}>
                        <div className="flex items-center">
                          <button
                            onClick={() => {
                              if (isExpanded) { setExpandedOutput(null) }
                              else { setExpandedOutput(output.id); setFullContent(prev => ({ ...prev, [output.id]: content })) }
                            }}
                            className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
                          >
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${output.status === 'error' ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'}`} />
                            <FileText className="w-4 h-4 text-[var(--accent)]/60 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{filename}</p>
                              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{runTime}</p>
                            </div>
                            {size > 0 && <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 mr-2">{formatBytes(size)}</span>}
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
                          </button>
                          {/* Download button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadFile(filename, content) }}
                            className="px-3 py-3 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors border-l border-[var(--border)]"
                            title="Download output"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {/* Copy button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(content, output.id) }}
                            className="px-3 py-3 text-[var(--text-muted)] hover:text-[var(--success)] transition-colors border-l border-[var(--border)]"
                            title="Copy to clipboard"
                          >
                            {copiedId === output.id ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        {isExpanded && content && (
                          <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-primary)]/50">
                            <pre className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-[500px] overflow-y-auto font-mono leading-relaxed">
                              {content}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {outputs.map((output) => {
                    const isExpanded = expandedOutput === output.filename
                    return (
                      <div key={output.filename} className={`rounded-xl border overflow-hidden transition-all ${
                        isExpanded ? 'border-[var(--accent)]/30 bg-[var(--bg-secondary)]' : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                      }`}>
                        <div className="flex items-center">
                          <button
                            onClick={() => {
                              if (isExpanded) { setExpandedOutput(null) }
                              else { setExpandedOutput(output.filename); setFullContent(prev => ({ ...prev, [output.filename]: output.preview })) }
                            }}
                            className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
                          >
                            <FileText className="w-4 h-4 text-[var(--accent)]/60 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{output.filename}</p>
                              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{output.timestamp}</p>
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 mr-2">{formatBytes(output.size)}</span>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadFile(output.filename, fullContent[output.filename] || output.preview) }}
                            className="px-3 py-3 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors border-l border-[var(--border)]"
                            title="Download output"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(fullContent[output.filename] || output.preview, output.filename) }}
                            className="px-3 py-3 text-[var(--text-muted)] hover:text-[var(--success)] transition-colors border-l border-[var(--border)]"
                            title="Copy to clipboard"
                          >
                            {copiedId === output.filename ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        {isExpanded && (fullContent[output.filename] || output.preview) && (
                          <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-primary)]/50">
                            <pre className="text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-[500px] overflow-y-auto font-mono leading-relaxed">
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
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
                  <p className="text-xs text-[var(--text-muted)]">Loading history...</p>
                </div>
              ) : activityHistory.length === 0 && outputs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-[var(--accent)]/30" />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] font-medium">No run history</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activityHistory.length > 0 ? activityHistory.map((h, i) => (
                    <div key={h.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-elevated)] transition-all border border-transparent hover:border-[var(--border)]">
                      <div className="relative">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          h.status === 'error' ? 'bg-[var(--danger)]' :
                          h.status === 'running' ? 'bg-[var(--warning)] animate-pulse' :
                          'bg-[var(--success)]'
                        }`} />
                        {i < activityHistory.length - 1 && (
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-6 bg-[var(--border)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {new Date(h.timestamp).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {h.action === 'job_executed' ? 'Executed' : h.action}
                          {h.model && <span className="text-[var(--accent)]/60"> · {h.model}</span>}
                        </p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md ${
                        h.status === 'error' ? 'bg-[var(--danger)]/10 text-[var(--danger)]' :
                        h.status === 'running' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' :
                        'bg-[var(--success)]/10 text-[var(--success)]'
                      }`}>
                        {h.status}
                      </span>
                    </div>
                  )) : outputs.map((output, i) => (
                    <div key={output.filename} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-elevated)] transition-all border border-transparent hover:border-[var(--border)]">
                      <div className="relative">
                        <div className="w-3 h-3 rounded-full bg-[var(--success)] flex-shrink-0" />
                        {i < outputs.length - 1 && (
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-6 bg-[var(--border)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{output.timestamp}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{output.filename}</p>
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

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 hover:border-[var(--border-hover)] transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">{label}</p>
          <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4">
      <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold flex items-center gap-1.5 mb-3">
        {icon} {title}
      </p>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{label}</p>
      <p className={`text-xs text-[var(--text-secondary)] ${mono ? 'font-mono text-[10px]' : ''} break-all`}>{value}</p>
    </div>
  )
}
