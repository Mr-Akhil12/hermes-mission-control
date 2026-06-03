'use client'
import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'

export default function LogsPage() {
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(true)
  const [lines, setLines] = useState(100)

  useEffect(() => {
    setLoading(true)
    fetch(`${process.env.HERMES_API_URL || 'http://127.0.0.1:9119'}/api/logs?lines=${lines}`)
      .then(r => r.json())
      .then(d => setLogs(d.content || d.logs || 'No logs'))
      .catch(() => setLogs('Failed to fetch logs'))
      .finally(() => setLoading(false))
  }, [lines])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Logs</h2>
        <div className="flex gap-2">
          {[50, 100, 500].map(n => (
            <button key={n} onClick={() => setLines(n)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${lines === n ? 'bg-orange-500/10 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-[#111118] rounded-xl border border-[#1e1e2a] p-4 max-h-[calc(100vh-200px)] overflow-auto">
        {loading ? <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div> :
          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">{logs}</pre>
        }
      </div>
    </div>
  )
}
