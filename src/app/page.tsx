'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Activity, CheckCircle2, AlertTriangle, Zap, Clock,
  ArrowUpRight, Loader2, TrendingUp, Shield, Wifi, WifiOff,
  Sparkles, BarChart3
} from 'lucide-react'

export const dynamic = 'force-dynamic'

interface ActivityItem {
  id: string
  agent_name: string
  action: string
  details: string | null
  status: 'running' | 'completed' | 'error'
  created_at: string
}

interface Task {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'normal' | 'high'
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const agentColors: Record<string, string> = {
  system: 'text-[var(--accent)]',
  cron: 'text-[var(--purple)]',
  agent: 'text-[var(--cyan)]',
  default: 'text-[var(--text-secondary)]',
}

function getAgentColor(name: string) {
  const key = Object.keys(agentColors).find(k => name.toLowerCase().includes(k))
  return agentColors[key || 'default']
}

const statusDot: Record<string, string> = {
  completed: 'bg-[var(--success)]',
  error: 'bg-[var(--danger)]',
  running: 'bg-[var(--warning)]',
  todo: 'bg-[var(--text-muted)]',
  in_progress: 'bg-[var(--warning)]',
  done: 'bg-[var(--success)]',
}

const priorityStyle: Record<string, string> = {
  high: 'bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20',
  normal: 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20',
  low: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)] border border-[var(--text-muted)]/20',
}

/* ─── KPI Card ─── */
function KPICard({ label, value, subtitle, icon: Icon, color, delay, href }: {
  label: string; value: string | number; subtitle: string;
  icon: React.ElementType; color: string; delay: number; href?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-[var(--accent)]/20 to-transparent text-[var(--accent)]',
    green: 'from-[var(--success)]/20 to-transparent text-[var(--success)]',
    red: 'from-[var(--danger)]/20 to-transparent text-[var(--danger)]',
    purple: 'from-[var(--purple)]/20 to-transparent text-[var(--purple)]',
  }
  const gradientClass = colorMap[color] || colorMap.blue

  const inner = (
    <>
      {/* Background gradient glow */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${gradientClass} opacity-30 blur-2xl group-hover:opacity-50 transition-opacity`} />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">{label}</span>
          <div className="flex items-center gap-1">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            {href && <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        </div>
        <p className="text-4xl font-bold gradient-text mb-1">{value}</p>
        <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
      </div>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover group cursor-pointer block"
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
      </Link>
    )
  }

  return (
    <div
      className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover group"
      style={{ animationDelay: `${delay}ms` }}
    >
      {inner}
    </div>
  )
}

export default function OverviewPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('connecting')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [actRes, taskRes] = await Promise.all([
        fetch('/api/data?table=agent_activities&limit=20&order=created_at.desc'),
        fetch('/api/data?table=tasks&limit=50&order=updated_at.desc'),
      ])

      if (!actRes.ok) {
        const errData = await actRes.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${actRes.status}`)
      }

      const actData = await actRes.json()
      const taskData = await taskRes.json()

      setActivities(actData || [])
      setTasks(taskData || [])
      setConnectionStatus('online')
      setLastUpdated(new Date())
    } catch (e: any) {
      console.error('Load error:', e)
      setError(e.message || 'Failed to load data')
      setConnectionStatus('offline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length
  const errorCount = activities.filter(a => a.status === 'error').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
            <Zap className="absolute inset-0 m-auto w-5 h-5 text-[var(--accent)]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">Connecting to Hermes...</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Loading mission data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Mission Control</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {lastUpdated
              ? `Last synced ${timeAgo(lastUpdated.toISOString())}`
              : 'Real-time system overview'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'online' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20">
              <div className="w-2 h-2 rounded-full bg-[var(--success)] pulse-dot text-[var(--success)]" />
              <span className="text-xs font-medium text-[var(--success)]">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/20">
              <WifiOff className="w-3 h-3 text-[var(--danger)]" />
              <span className="text-xs font-medium text-[var(--danger)]">Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="animate-slide-up rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--danger)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--danger)]">Connection Error</p>
            <p className="text-xs text-[var(--danger)]/70 mt-0.5 truncate">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 rounded-xl bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-xs font-medium text-[var(--danger)] transition-colors flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 stagger">
        <KPICard
          label="Tasks"
          value={tasks.length}
          subtitle={`${todoCount} todo · ${inProgressCount} active · ${doneCount} done`}
          icon={CheckCircle2}
          color="green"
          delay={0}
          href="/tasks"
        />
        <KPICard
          label="Activities"
          value={activities.length}
          subtitle="Last 20 events"
          icon={Activity}
          color="blue"
          delay={60}
          href="/activity"
        />
        <KPICard
          label="Errors"
          value={errorCount}
          subtitle={errorCount > 0 ? 'Needs attention' : 'All healthy'}
          icon={errorCount > 0 ? AlertTriangle : Shield}
          color={errorCount > 0 ? 'red' : 'green'}
          delay={120}
        />
        <KPICard
          label="Status"
          value={connectionStatus === 'online' ? 'Live' : 'Offline'}
          subtitle={connectionStatus === 'online' ? 'Real-time sync active' : 'Retrying...'}
          icon={connectionStatus === 'online' ? Zap : WifiOff}
          color="purple"
          delay={180}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        {/* Activity Feed */}
        <Link href="/activity" className="lg:col-span-2 animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden block group" style={{ animationDelay: '240ms' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold group-hover:text-[var(--accent)] transition-colors">Live Activity Feed</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'online' ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'} pulse-dot`} />
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{connectionStatus}</span>
              <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center py-16">
                <Activity className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[var(--text-secondary)]">No activities yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Agents will log here in real-time</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {activities.map((a, i) => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--bg-card-hover)] transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDot[a.status] || 'bg-[var(--text-muted)]'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${getAgentColor(a.agent_name)}`}>{a.agent_name}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{a.action}</span>
                      </div>
                      {a.details && (
                        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{a.details}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 whitespace-nowrap">{timeAgo(a.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Link>

        {/* Tasks Panel */}
        <Link href="/tasks" className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden block group" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--purple)]" />
              <h3 className="text-sm font-semibold group-hover:text-[var(--accent)] transition-colors">Tasks</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-md">{tasks.length}</span>
              <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[var(--text-secondary)]">No tasks yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Create tasks from the Tasks tab</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {tasks.slice(0, 15).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-card-hover)] transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[t.status] || 'bg-[var(--text-muted)]'}`} />
                    <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{t.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${priorityStyle[t.priority] || priorityStyle.normal}`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  )
}
