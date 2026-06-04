'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, CheckCircle2, AlertTriangle, Cpu, Zap, Clock, ArrowUpRight, Loader2 } from 'lucide-react'

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

const statusColors: Record<string, string> = {
  completed: 'bg-emerald-500',
  error: 'bg-red-500',
  running: 'bg-amber-500',
  todo: 'bg-zinc-600',
  in_progress: 'bg-amber-500',
  done: 'bg-emerald-500',
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400',
  normal: 'bg-sky-500/10 text-sky-400',
  low: 'bg-zinc-700 text-zinc-400',
}

export default function OverviewPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [actRes, taskRes] = await Promise.all([
        supabase.from('agent_activities').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('tasks').select('*').order('updated_at', { ascending: false }),
      ])
      
      if (actRes.error) {
        console.error('Activities error:', actRes.error)
        setError(`Supabase error: ${actRes.error.message}`)
      } else if (actRes.data) {
        setActivities(actRes.data as ActivityItem[])
      }
      
      if (taskRes.error) {
        console.error('Tasks error:', taskRes.error)
      } else if (taskRes.data) {
        setTasks(taskRes.data as Task[])
      }
    } catch (e: any) {
      console.error('Load error:', e)
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadData()

    // Real-time subscriptions
    const actChannel = supabase
      .channel('activities-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_activities' }, (payload) => {
        setActivities(prev => [payload.new as ActivityItem, ...prev.slice(0, 19)])
      })
      .subscribe()

    const taskChannel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(actChannel)
      supabase.removeChannel(taskChannel)
    }
  }, [loadData, supabase])

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length
  const errorCount = activities.filter(a => a.status === 'error').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#4f8fff] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          <strong>Connection Error:</strong> {error}
          <button onClick={loadData} className="ml-3 px-3 py-1 bg-red-500/20 rounded-lg text-xs hover:bg-red-500/30 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8888a0] font-medium">Tasks</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1a1a2e]">{tasks.length}</p>
          <p className="text-xs text-[#8888a0] mt-1">{todoCount} todo · {inProgressCount} active · {doneCount} done</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8888a0] font-medium">Activities</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#4f8fff]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1a1a2e]">{activities.length}</p>
          <p className="text-xs text-[#8888a0] mt-1">Last 20 events</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8888a0] font-medium">Errors</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${errorCount > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
              {errorCount > 0 ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1a1a2e]">{errorCount}</p>
          <p className="text-xs text-[#8888a0] mt-1">{errorCount > 0 ? 'Needs attention' : 'All healthy'}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8888a0] font-medium">Status</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1a1a2e]">Live</p>
          <p className="text-xs text-[#8888a0] mt-1">Real-time sync active</p>
        </div>
      </div>

      {/* Recent Activity + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#1a1a2e]">Live Activity Feed</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-[#8888a0] uppercase tracking-wider">Live</span>
            </div>
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-8 h-8 text-[#4f8fff] mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[#8888a0]">No activities yet</p>
                <p className="text-xs text-[#8888a0]/60 mt-1">Agents will log here in real-time</p>
              </div>
            ) : activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-3 border-b border-[#4f8fff08] last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusColors[a.status] || 'bg-zinc-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[#4f8fff]">{a.agent_name}</span>
                    <span className="text-xs text-[#4a4a68]">{a.action}</span>
                  </div>
                  {a.details && <p className="text-[11px] text-[#8888a0] truncate mt-0.5">{a.details}</p>}
                  <p className="text-[10px] text-[#8888a0]/60 mt-0.5">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#1a1a2e]">Tasks</h3>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[#8888a0]">No tasks yet</p>
                <p className="text-xs text-[#8888a0]/60 mt-1">Create tasks from the Tasks tab</p>
              </div>
            ) : tasks.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-2 border-b border-[#4f8fff08] last:border-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[t.status] || 'bg-zinc-500'}`} />
                <span className="text-xs text-[#4a4a68] truncate flex-1">{t.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityColors[t.priority] || 'bg-zinc-700 text-zinc-400'}`}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
