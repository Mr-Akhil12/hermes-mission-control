'use client'
import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'

export default function ConfigPage() {
  const [config, setConfig] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${process.env.HERMES_API_URL || 'http://127.0.0.1:9119'}/api/config`)
      .then(r => r.text())
      .then(setConfig)
      .catch(() => setConfig('Failed to fetch config'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Configuration</h2>
      <div className="bg-[#111118] rounded-xl border border-[#1e1e2a] p-4 max-h-[calc(100vh-200px)] overflow-auto">
        {loading ? <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div> :
          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">{config}</pre>
        }
      </div>
    </div>
  )
}
