'use client'

import { KeyRound, Loader2, RefreshCw, AlertTriangle, Eye, EyeOff, Shield, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useSupabaseQuery } from '@/lib/useSupabaseQuery'

export const dynamic = 'force-dynamic'

interface KeyInfo {
  name: string
  value: string
  sensitive: boolean
  configured: boolean
}

export default function KeysPage() {
  const {
    data: keys,
    error,
    isLoading: loading,
    mutate,
  } = useSupabaseQuery<KeyInfo[]>('/api/keys')

  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)

  const toggleReveal = (key: string) => setRevealed(prev => ({ ...prev, [key]: !prev[key] }))
  const copyKey = (key: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Keys</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">API keys and secrets management</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--warning)]/5 border border-[var(--warning)]/20 p-4 flex items-start gap-3 animate-slide-up" style={{ animationDelay: '30ms' }}>
        <Shield className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--warning)]">Sensitive Information</p>
          <p className="text-xs text-[var(--warning)]/70 mt-0.5">Keys are masked server-side for security. Click the eye icon to show partial value. Full keys are never exposed to the browser.</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 animate-slide-up">
          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
          <span className="ml-2 text-sm text-[var(--text-muted)]">Loading keys...</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-4 flex items-start gap-3 animate-slide-up">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-500">Error loading keys</p>
            <p className="text-xs text-red-500/70 mt-0.5">{error.message}</p>
            <button onClick={() => mutate()} className="mt-2 text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && keys && (
        <div className="grid gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
          {keys.map(key => {
            const displayValue = key.sensitive && !revealed[key.name] ? '••••••••••••••••' : key.value
            const isLongValue = displayValue.length > 20
            return (
              <div key={key.name} className="rounded-xl sm:rounded-2xl glass-panel border border-[var(--border)] p-3 sm:p-4 card-hover">
                <div className={isLongValue ? 'flex flex-col gap-2' : 'flex items-center justify-between gap-3'}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                      <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium">{key.name}</p>
                      <p className="text-[10px] sm:text-xs font-mono text-[var(--text-muted)] mt-0.5 truncate">{displayValue}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 ${isLongValue ? 'self-end' : 'flex-shrink-0'}`}>
                    {key.sensitive && (
                      <button onClick={() => toggleReveal(key.name)} className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all">
                        {revealed[key.name] ? <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                      </button>
                    )}
                    <button onClick={() => copyKey(key.name, key.value)} className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all">
                      {copied === key.name ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--success)]" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
