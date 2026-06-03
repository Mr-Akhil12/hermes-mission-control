'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Play, Pause, Trash2, Zap } from 'lucide-react'

interface CronJob {
  id: string
  name: string
  schedule_display: string
  enabled: boolean
  state: string
  last_run_at: string | null
  last_status: string
  deliver: string
  profile: string
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadJobs = async () => {
    const { data } = await supabase.from('cron_jobs').select('*').order('updated_at', { ascending: false })
    if (data) setJobs(data as CronJob[])
    setLoading(false)
  }

  useEffect(() => { loadJobs() }, [])
  useEffect(() => {
    const ch = supabase.channel('cron-page').on('postgres_changes', { event: '*', schema: 'public', table: 'cron_jobs' }, loadJobs).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const toggleJob = async (job: CronJob) => {
    await fetch(`${process.env.NEXT_PUBLIC_HERMES_API || 'http://127.0.0.1:9119'}/api/cron/${job.id}/${job.enabled ? 'pause' : 'resume'}`, { method: 'POST' })
    await supabase.from('cron_jobs').update({ enabled: !job.enabled, state: job.enabled ? 'paused' : 'scheduled' }).eq('id', job.id)
    loadJobs()
  }

  const deleteJob = async (id: string) => {
    if (!confirm('Delete this cron job?')) return
    await fetch(`${process.env.NEXT_PUBLIC_HERMES_API || 'http://127.0.0.1:9119'}/api/cron/${id}`, { method: 'DELETE' })
    await supabase.from('cron_jobs').delete().eq('id', id)
    loadJobs()
  }

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Cron Jobs ({jobs.length})</h2>
      <div className="space-y-3">
        {jobs.length === 0 ? <p className="text-sm text-zinc-600 text-center py-12">No cron jobs found</p> :
          jobs.map(j => (
            <div key={j.id} className="bg-[#111118] rounded-xl p-4 border border-[#1e1e2a]">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{j.name || j.id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${j.last_status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{j.last_status}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{j.profile}</span>
                    {j.deliver !== 'local' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{j.deliver}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="font-mono">{j.schedule_display || '—'}</span>
                    <span>Last: {timeAgo(j.last_run_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleJob(j)} className={`p-1.5 rounded-lg ${j.enabled ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}>
                    {j.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => deleteJob(j.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}
