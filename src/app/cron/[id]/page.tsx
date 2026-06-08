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
  const everyNHours = expr.match(/^0 \*\\/(\d+) \* \* \*$/)
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
            </div>
            <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all self-start">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
