'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowUpRight, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

interface Activity {
  id: string
  agent_name: string
  action: string
  details: string | null
  status: 'running' | 'completed' | 'error'
  metadata: Record<string, any> | null
  created_at: string
}

function timeAgo(dateStr: string) {
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const supabase = createClient()

  const loadData = useCallback(async () => {
    let query = supabase.from('agent_activities').select('*').order('created_at', { ascending: false }).limit(200)
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    if (data) setActivities(data as Activity[])
    setLoading(false)
  }, [supabase, filter])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const channel = supabase.channel('activity-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_activities' }, (payload) => {
        if (filter === 'all' || (payload.new as Activity).status === filter) {
          setActivities(prev => [payload.new as Activity, ...prev.slice(0, 199)])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, filter])

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="w-3 h-3 text-emerald-400" />
    if (status === 'error') return <AlertTriangle className="w-3 h-3 text-red-400" />
    return <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agent Activity</h2>
        <div className="flex gap-2">
          {['all', 'running', 'completed', 'error'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === s ? 'bg-orange-500/10 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[#111118] rounded-xl border border-[#1e1e2a] overflow-hidden">
          {activities.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-12">No activities yet</p>
          ) : (
            <div className="divide-y divide-[#16161f]">
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 hover:bg-[#0a0a0f]/50 transition-colors animate-slide-in">
                  <div className="mt-0.5">{statusIcon(a.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-orange-400">{a.agent_name}</span>
                      <span className="text-xs text-zinc-300">{a.action}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        a.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>{a.status}</span>
                    </div>
                    {a.details && <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{a.details}</p>}
                    <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
