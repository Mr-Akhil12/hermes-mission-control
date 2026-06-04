'use client'

import { useEffect, useState, useCallback } from 'react'
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
  todo: 'bg-zinc-400',
  in_progress: 'bg-amber-500',
  done: 'bg-emerald-500',
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-500',
  normal: 'bg-[#4f8fff]/10 text-[#4f8fff]',
  low: 'bg-zinc-100 text-zinc-500',
}

export default function OverviewPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'connecting'>('connecting')

  const loadData = useCallback(async () => {
    try {
      setError(null)
      
      const [actRes, taskRes] = await Promise.all([
        fetch('/api/data?table=agent_activities&limit=20&order=created_at.desc'),
        fetch('/api/data?table=tasks&limit=50&order=updated_at.desc'),
      ])
      
      if (!actRes.ok) {
        const errData = await actRes.json().catch(() => ({}))
        throw new Error(errData.error || `Activities: HTTP ${actRes.status}`)
      }
      
      const actData = await actRes.json()
      const taskData = await taskRes.json()
      
      setActivities(actData || [])
      setTasks(taskData || [])
      setConnectionStatus('online')
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
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length
  const errorCount = activities.filter(a => a.status === 'error').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#4f8fff] animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8888a0]">Connecting to Supabase...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection status banner */}
      {connectionStatus === 'offline' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Connection Error</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button onClick={loadData} className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-xl text-xs font-medium text-red-700 transition-colors">
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f] hover:shadow-[0_8px_40px_#4f8fff1f] transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8888a0] font-medium">Tasks</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1a1a2e]">{tasks.length}</p>
          <p className="text-xs text-[#8888a0] mt-1">{todoCount} todo · {inProgressCount} active · {doneCount} done</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f] hover:shadow-[0_8px_40px_#4f8fff1f] transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8888a0] font-medium">Activities</span>
            <div className="w-9 h-9 rounded-xl bg-[#4f8fff]/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#4f8fff]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1a1a2e]">{activities.length}</p>
          <p className="text-xs text-[#8888a0] mt-1">Last 20 events</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f] hover:shadow-[0_8px_40px_#4f8fff1f] transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8888a0] font-medium">Errors</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${errorCount > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              {errorCount > 0 ? <AlertTriangle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1a1a2e]">{errorCount}</p>
          <p className="text-xs text-[#8888a0] mt-1">{errorCount > 0 ? 'Needs attention' : 'All healthy'}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f] hover:shadow-[0_8px_40px_#4f8fff1f] transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] uppercase tracking-wider text-[#8888a0] font-medium">Status</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#1a1a2e]">{connectionStatus === 'online' ? 'Live' : 'Offline'}</p>
          <p className="text-xs text-[#8888a0] mt-1">{connectionStatus === 'online' ? 'Real-time sync active' : 'Retrying...'}</p>
        </div>
      </div>

      {/* Recent Activity + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-[#4f8fff1f] shadow-[0_4px_24px_#4f8fff0f]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#1a1a2e]">Live Activity Feed</h3>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-[10px] text-[#8888a0] uppercase tracking-wider">{connectionStatus}</span>
            </div>
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {activities.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-8 h-8 text-[#4f8fff] mx-auto mb-3 opacity-20" />
                <p className="text-sm text-[#8888a0]">No activities yet</p>
                <p className="text-xs text-[#8888a0]/60 mt-1">Agents will log here in real-time</p>
              </div>
            ) : activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-3 border-b border-[#4f8fff08] last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusColors[a.status] || 'bg-zinc-400'}`} />
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
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3 opacity-20" />
                <p className="text-sm text-[#8888a0]">No tasks yet</p>
                <p className="text-xs text-[#8888a0]/60 mt-1">Create tasks from the Tasks tab</p>
              </div>
            ) : tasks.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-2 border-b border-[#4f8fff08] last:border-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[t.status] || 'bg-zinc-400'}`} />
                <span className="text-xs text-[#4a4a68] truncate flex-1">{t.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityColors[t.priority] || 'bg-zinc-100 text-zinc-500'}`}>{t.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
