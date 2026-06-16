'use client'

import Link from 'next/link'
import {
  Activity, CheckCircle2, AlertTriangle, Zap,
  ArrowUpRight, Shield, WifiOff,
  Sparkles, BarChart3
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { timeAgo, getAgentColor } from '@/lib/utils'
import { useSupabaseQuery } from '@/lib/useSupabaseQuery'

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

const priorityVariant: Record<string, 'danger' | 'accent' | 'neutral'> = {
  high: 'danger',
  normal: 'accent',
  low: 'neutral',
}

const ACTIVITIES_KEY = '/api/data?table=agent_activities&limit=20&order=created_at.desc'
const TASKS_KEY = '/api/data?table=tasks&limit=50&order=updated_at.desc'

export default function OverviewPage() {
  const {
    data: actData,
    error: actError,
    isLoading: actLoading,
  } = useSupabaseQuery<ActivityItem[] | Record<string, unknown>[]>(ACTIVITIES_KEY, 30000)

  const {
    data: taskData,
    error: taskError,
    isLoading: taskLoading,
  } = useSupabaseQuery<Task[] | Record<string, unknown>[]>(TASKS_KEY, 30000)

  const activities = Array.isArray(actData) ? (actData as ActivityItem[]) : []
  const tasks = Array.isArray(taskData) ? (taskData as Task[]) : []

  const loading = actLoading || taskLoading
  const error = actError?.message || taskError?.message || null
  const connectionStatus: 'online' | 'offline' | 'connecting' = loading
    ? 'connecting'
    : error
      ? 'offline'
      : 'online'

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length
  const errorCount = activities.filter(a => a.status === 'error').length

  if (loading && activities.length === 0 && tasks.length === 0) {
    return <LoadingSpinner text="Connecting to Hermes..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Mission Control</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Real-time system overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'online' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20">
              <div className="w-2 h-2 rounded-full bg-[var(--success)] pulse-dot text-[var(--success)]" />
              <span className="text-xs font-medium text-[var(--success)]">Live</span>
            </div>
          ) : connectionStatus === 'connecting' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--warning)]/10 border border-[var(--warning)]/20">
              <div className="w-2 h-2 rounded-full bg-[var(--warning)] animate-pulse" />
              <span className="text-xs font-medium text-[var(--warning)]">Connecting...</span>
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
      {error && <ErrorBanner message={error} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 stagger">
        <Card
          label="Tasks"
          value={tasks.length}
          subtitle={`${todoCount} todo · ${inProgressCount} active · ${doneCount} done`}
          icon={CheckCircle2}
          color="green"
          delay={0}
          href="/tasks"
        />
        <Card
          label="Activities"
          value={activities.length}
          subtitle="Last 20 events"
          icon={Activity}
          color="blue"
          delay={60}
          href="/activity"
        />
        <Card
          label="Errors"
          value={errorCount}
          subtitle={errorCount > 0 ? 'Needs attention' : 'All healthy'}
          icon={errorCount > 0 ? AlertTriangle : Shield}
          color={errorCount > 0 ? 'red' : 'green'}
          delay={120}
        />
        <Card
          label="Status"
          value={connectionStatus === 'online' ? 'Live' : connectionStatus === 'connecting' ? 'Syncing' : 'Offline'}
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
              <EmptyState
                icon={Activity}
                title="No activities yet"
                description="Agents will log here in real-time"
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--bg-card-hover)] transition-colors">
                    <div className="mt-1.5">
                      <StatusDot status={a.status} pulse={false} />
                    </div>
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
              <EmptyState
                icon={CheckCircle2}
                title="No tasks yet"
                description="Create tasks from the Tasks tab"
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {tasks.slice(0, 15).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-card-hover)] transition-colors">
                    <StatusDot status={t.status} pulse={false} />
                    <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{t.title}</span>
                    <Badge variant={priorityVariant[t.priority] || 'neutral'} size="sm">
                      {t.priority}
                    </Badge>
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
