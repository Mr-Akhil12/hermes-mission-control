'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, CheckCircle2, AlertTriangle, Cpu, Zap, Clock, ArrowUpRight } from 'lucide-react'

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

function KpiCard({ title, value, subtitle, icon: Icon, accent = 'text-orange-400' }: {
  title: string; value: string | number; subtitle?: string; icon: any; accent?: string
}) {
  return (
    <div className="bg-[#111118] rounded-xl p-4 border border-[#1e1e2a]">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">{title}</span>
        <div className={`w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function timeAgo(dateStr: string) {
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function OverviewPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const [actRes, taskRes] = await Promise.all([
      supabase.from('agent_activities').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('tasks').select('*').order('updated_at', { ascending: false }),
    ])
    if (actRes.data) setActivities(actRes.data as ActivityItem[])
    if (taskRes.data) setTasks(taskRes.data as Task[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()

    // Real-time subscription for activities
    const actChannel = supabase
      .channel('activities-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_activities' }, (payload) => {
        setActivities(prev => [payload.new as ActivityItem, ...prev.slice(0, 19)])
      })
      .subscribe()

    // Real-time subscription for tasks
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
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard title="Tasks" value={tasks.length} subtitle={`${todoCount} todo · ${inProgressCount} active · ${doneCount} done`} icon={CheckCircle2} accent="text-emerald-400" />
        <KpiCard title="Activities" value={activities.length} subtitle="Last 20 events" icon={Activity} accent="text-sky-400" />
        <KpiCard title="Errors" value={errorCount} subtitle={errorCount > 0 ? 'Needs attention' : 'All healthy'} icon={errorCount > 0 ? AlertTriangle : CheckCircle2} accent={errorCount > 0 ? 'text-red-400' : 'text-emerald-400'} />
        <KpiCard title="Status" value="Online" subtitle="Real-time sync active" icon={Zap} accent="text-orange-400" />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[#111118] rounded-xl p-4 border border-[#1e1e2a]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Live Activity Feed</h3>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {activities.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">No activities yet. Agents will log here in real-time.</p>
            ) : activities.map((a) => (
              <div key={a.id} className="flex items-start gap-2 py-2 border-b border-[#16161f] animate-slide-in">
                <ArrowUpRight className="w-3 h-3 text-zinc-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-orange-400">{a.agent_name}</span>
                    <span className="text-xs text-zinc-300">{a.action}</span>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      a.status === 'completed' ? 'bg-emerald-400' : a.status === 'error' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                    }`} />
                  </div>
                  {a.details && <p className="text-[11px] text-zinc-500 truncate mt-0.5">{a.details}</p>}
                  <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task Summary */}
        <div className="bg-[#111118] rounded-xl p-4 border border-[#1e1e2a]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Tasks</h3>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">No tasks yet</p>
            ) : tasks.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-[#16161f]">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  t.status === 'done' ? 'bg-emerald-400' : t.status === 'in_progress' ? 'bg-amber-400' : 'bg-zinc-600'
                }`} />
                <span className="text-xs text-zinc-300 truncate flex-1">{t.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  t.priority === 'high' ? 'bg-red-500/10 text-red-400' : t.priority === 'normal' ? 'bg-sky-500/10 text-sky-400' : 'bg-zinc-700 text-zinc-400'
                }`}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
