'use client'

import { Cpu, Loader2, RefreshCw, AlertTriangle, Zap } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

export const dynamic = 'force-dynamic'

export default function ModelsPage() {
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const models = [
    { name: 'OWL (OpenRouter)', provider: 'openrouter/owl-alpha', status: 'active', role: 'Primary Agent', color: 'var(--accent)' },
    { name: 'Gemma 3 12B', provider: 'google/gemma-3-12b-it:free', status: 'active', role: 'Vision Analysis', color: 'var(--purple)' },
    { name: 'Claude Sonnet 4', provider: 'anthropic/claude-sonnet-4', status: 'available', role: 'Code & Review', color: 'var(--cyan)' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Models</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">AI models available to Hermes</p>
        </div>
      </div>

      <div className="grid gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
        {models.map(m => (
          <div key={m.name} className="rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${m.color}15` }}>
                  <Cpu className="w-4 h-4" style={{ color: m.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{m.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{m.provider}</p>
                  <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">{m.role}</span>
                </div>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium capitalize ${
                m.status === 'active' ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'
              }`}>{m.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
