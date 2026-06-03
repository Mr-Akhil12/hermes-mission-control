'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Cpu } from 'lucide-react'

interface ModelStat {
  model: string
  sessions: number
  messages: number
}

export default function ModelsPage() {
  const [stats, setStats] = useState<ModelStat[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sessions').select('model, message_count').then(({ data }) => {
      if (data) {
        const grouped: Record<string, { sessions: number; messages: number }> = {}
        for (const s of data) {
          const m = s.model || 'unknown'
          if (!grouped[m]) grouped[m] = { sessions: 0, messages: 0 }
          grouped[m].sessions++
          grouped[m].messages += s.message_count || 0
        }
        setStats(Object.entries(grouped).map(([model, v]) => ({ model, ...v })).sort((a, b) => b.sessions - a.sessions))
      }
      setLoading(false)
    })
  }, [supabase])

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Model Usage</h2>
      {stats.length === 0 ? <p className="text-sm text-zinc-600 text-center py-12">No session data</p> :
        <div className="grid gap-3">
          {stats.map(s => (
            <div key={s.model} className="bg-[#111118] rounded-xl p-4 border border-[#1e1e2a] flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-orange-400"><Cpu className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono font-medium truncate">{s.model}</div>
                <div className="text-xs text-zinc-500">{s.sessions} sessions · {s.messages} messages</div>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  )
}
