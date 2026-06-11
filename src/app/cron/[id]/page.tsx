'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, RefreshCw, Clock, AlertTriangle, Settings, Timer,
  FileText, ChevronDown, ChevronRight,
  ArrowLeft, Copy, Check, MessageSquare, Terminal
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

function renderMarkdown(text: string) {
  if (!text) return ''
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-[var(--bg-primary)] rounded-xl p-4 my-3 overflow-x-auto border border-[var(--border)]"><code class="text-xs font-mono text-[var(--text-secondary)]">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--accent)] text-xs font-mono border border-[var(--border)]">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[var(--text-primary)]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-[var(--accent)] hover:underline">$1</a>')
    .replace(/\n/g, '<br />')
}

export default function CronDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<CronDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'outputs' | 'prompt'>('overview')
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null)
  const [fullContent, setFullContent] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [openingChat, setOpeningChat] = useState(false)
  const router = useRouter()

  useEffect(() => { params.then((p: { id: string }) => setJobId(p.id)) }, [params])

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

  const openChatWithCron = async () => {
    if (!data?.job) return
    setOpeningChat(true)
    try {
      const res = await fetch('/api/chat/with-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cron_job_id: data.job.id,
          cron_job_name: data.job.name,
          cron_job_schedule: data.job.schedule_display || data.job.schedule,
          cron_job_prompt: data.job.prompt || '',
          cron_job_status: data.job.last_status,
          cron_job_last_run: data.job.last_run_at,
          cron_job_next_run: data.job.next_run_at,
          cron_job_error: data.job.last_error,
          cron_job_enabled: data.job.enabled,
        }),
      })
      if (res.ok) {
        const conv = await res.json()
        router.push(`/chat?conv=${conv.id}`)
      }
    } catch { /* ignore */ }
    finally { setOpeningChat(false) }
  }

  const loadFullContent = async (filename: string) => {
    if (fullContent[filename]) return
    try {
      const res = await fetch(`/api/cron/${jobId}/activity?file=${filename}`)
      if (res.ok) {
        const data = await res.json()
        setFullContent(prev => ({ ...prev, [filename]: data.content || 'No content' }))
      }
    } catch { /* ignore */ }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
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

              {/* Quick stats */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Timer className="w-3.5 h-3.5" />
                  <span>{humanSchedule}</span>
                </div>
                {job.last_run_at && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Last: {timeAgo(job.last_run_at)}</span>
                  </div>
                )}
                {job.next_run_at && !isPaused && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <Timer className="w-3.5 h-3.5" />
                    <span>Next: {timeUntil(job.next_run_at)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{total_outputs} runs</span>
                </div>
              </div>

              {job.last_error && (
                <div className="mt-3 px-3 py-2 rounded-xl bg-[var(--danger)]/5 border border-[var(--danger)]/20">
                  <p className="text-xs text-[var(--danger)] break-words">{job.last_error}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-start">
              <button
                onClick={openChatWithCron}
                disabled={openingChat}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--purple)]/10 border border-[var(--purple)]/20 text-sm text-[var(--purple)] hover:bg-[var(--purple)]/20 transition-all disabled:opacity-50"
              >
                {openingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Chat
              </button>
              <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="animate-slide-up" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] w-fit">
          {([
            { id: 'overview' as const, label: 'Overview', icon: Settings },
            { id: 'outputs' as const, label: `Outputs (${total_outputs})`, icon: FileText },
            { id: 'prompt' as const, label: 'Prompt', icon: Terminal },
          ]).map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.id
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-slide-up" style={{ animationDelay: '120ms' }}>
        {tab === 'overview' && (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {/* Schedule */}
            <div className="rounded-2xl glass-panel border border-[var(--border)] p-4 sm:p-5">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-[var(--accent)]" /> Schedule
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Cron Expression</span>
                  <span className="text-xs font-mono text-[var(--text-primary)]">{job.schedule || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Human Readable</span>
                  <span className="text-xs text-[var(--text-primary)]">{humanSchedule}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Status</span>
                  <span className={`text-xs font-medium ${hasError ? 'text-[var(--danger)]' : isPaused ? 'text-[var(--text-muted)]' : 'text-[var(--success)]'}`}>
                    {hasError ? 'Error' : isPaused ? 'Paused' : 'Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Profile</span>
                  <span className="text-xs text-[var(--text-primary)]">{job.profile || 'default'}</span>
                </div>
              </div>
            </div>

            {/* Timing */}
            <div className="rounded-2xl glass-panel border border-[var(--border)] p-4 sm:p-5">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[var(--accent)]" /> Timing
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Last Run</span>
                  <span className="text-xs text-[var(--text-primary)]">{timeAgo(job.last_run_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Next Run</span>
                  <span className="text-xs text-[var(--text-primary)]">{timeUntil(job.next_run_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Total Runs</span>
                  <span className="text-xs text-[var(--text-primary)]">{total_outputs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Created</span>
                  <span className="text-xs text-[var(--text-primary)]">{timeAgo(job.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="rounded-2xl glass-panel border border-[var(--border)] p-4 sm:p-5">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[var(--accent)]" /> Delivery
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Target</span>
                  <span className="text-xs text-[var(--text-primary)] truncate max-w-[200px]">{job.deliver || 'local'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Agent Mode</span>
                  <span className="text-xs text-[var(--text-primary)]">{job.no_agent ? 'Script Only' : 'LLM Agent'}</span>
                </div>
                {job.workdir && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">Workdir</span>
                    <span className="text-[10px] font-mono text-[var(--text-primary)] truncate max-w-[200px]">{job.workdir}</span>
                  </div>
                )}
                {job.enabled_toolsets && job.enabled_toolsets.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-muted)]">Toolsets</span>
                    <span className="text-[10px] text-[var(--text-primary)]">{job.enabled_toolsets.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Errors */}
            <div className="rounded-2xl glass-panel border border-[var(--border)] p-4 sm:p-5">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--accent)]" /> Errors
              </h3>
              {job.last_error ? (
                <div className="px-3 py-2 rounded-xl bg-[var(--danger)]/5 border border-[var(--danger)]/20">
                  <p className="text-[11px] text-[var(--danger)] break-words leading-relaxed">{job.last_error}</p>
                </div>
              ) : job.last_delivery_error ? (
                <div className="px-3 py-2 rounded-xl bg-[var(--warning)]/5 border border-[var(--warning)]/20">
                  <p className="text-[11px] text-[var(--warning)] break-words leading-relaxed">{job.last_delivery_error}</p>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">No errors recorded</p>
              )}
            </div>
          </div>
        )}

        {tab === 'outputs' && (
          <div className="space-y-2">
            {outputs.length === 0 ? (
              <div className="rounded-2xl glass-panel border border-[var(--border)] p-12 text-center">
                <FileText className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[var(--text-secondary)]">No outputs yet</p>
              </div>
            ) : outputs.map((output) => (
              <div key={output.filename} className="rounded-xl glass-panel border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => {
                    const next = expandedOutput === output.filename ? null : output.filename
                    setExpandedOutput(next)
                    if (next) loadFullContent(output.filename)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{output.filename}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{output.timestamp} · {formatBytes(output.size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(fullContent[output.filename] || output.preview, output.filename)
                      }}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                      title="Copy"
                    >
                      {copiedId === output.filename ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
                    </button>
                    {expandedOutput === output.filename ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </div>
                </button>
                {expandedOutput === output.filename && (
                  <div className="px-4 pb-4 border-t border-[var(--border)]">
                    <div className="mt-3 p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] max-h-[400px] overflow-y-auto">
                      {fullContent[output.filename] ? (
                        <div
                          className="text-xs text-[var(--text-secondary)] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(fullContent[output.filename]) }}
                        />
                      ) : (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'prompt' && (
          <div className="rounded-2xl glass-panel border border-[var(--border)] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" /> Job Prompt
              </h3>
              {job.prompt && (
                <button
                  onClick={() => copyToClipboard(job.prompt, 'prompt')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                >
                  {copiedId === 'prompt' ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
              )}
            </div>
            {job.prompt ? (
              <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-xl p-4 border border-[var(--border)] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {job.prompt}
              </pre>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No prompt configured for this job.</p>
            )}

            {job.script && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[var(--accent)]" /> Script
                </h3>
                <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-xl p-4 border border-[var(--border)] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {job.script}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
