'use client'
import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'

interface EnvVar {
  key: string
  value: string
  source: string
}

export default function KeysPage() {
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${process.env.HERMES_API_URL || 'http://127.0.0.1:9119'}/api/env`)
      .then(r => r.json())
      .then(d => {
        const vars = Object.entries(d).map(([key, v]: [string, any]) => ({
          key,
          value: typeof v === 'object' ? v.value || JSON.stringify(v) : String(v),
          source: typeof v === 'object' ? v.source || '.env' : '.env',
        }))
        setEnvVars(vars)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Environment Variables ({envVars.length})</h2>
      {loading ? <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div> :
        envVars.length === 0 ? <p className="text-sm text-zinc-600 text-center py-12">No environment variables</p> :
        <div className="grid gap-2">
          {envVars.map(v => (
            <div key={v.key} className="bg-[#111118] rounded-xl p-3 border border-[#1e1e2a]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono font-medium">{v.key}</span>
                <span className="text-[10px] text-zinc-600">{v.source}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1 font-mono truncate">{v.value}</p>
            </div>
          ))}
        </div>
      }
    </div>
  )
}
