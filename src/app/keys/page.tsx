'use client'

import { KeyRound, Loader2, RefreshCw, AlertTriangle, Eye, EyeOff, Shield, Copy, Check } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

export const dynamic = 'force-dynamic'

export default function KeysPage() {
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { setLoading(false) }, [])

  const toggleReveal = (key: string) => setRevealed(prev => ({ ...prev, [key]: !prev[key] }))
  const copyKey = (key: string, value: string) => {
    navigator.clipboard?.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const keys = [
    { name: 'Supabase URL', value: 'https://bwlrhvmgychtgfwwgmhn.supabase.co', sensitive: false },
    { name: 'Supabase Anon Key', value: 'sb_secret_fvbQJfqx6n5bMYXdQYwTdA_***', sensitive: true },
    { name: 'OpenRouter API', value: 'sk-or-v1-***', sensitive: true },
    { name: 'Cloudflare Token', value: 'cfat_***', sensitive: true },
    { name: 'n8n API Key', value: 'n8n_api_***', sensitive: true },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Keys</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">API keys and secrets management</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--warning)]/5 border border-[var(--warning)]/20 p-4 flex items-start gap-3 animate-slide-up" style={{ animationDelay: '30ms' }}>
        <Shield className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--warning)]">Sensitive Information</p>
          <p className="text-xs text-[var(--warning)]/70 mt-0.5">Keys are masked by default. Click the eye icon to reveal. Never share these publicly.</p>
        </div>
      </div>

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
                    <button onClick={() => toggleReveal(key.name)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all">
                      {revealed[key.name] ? <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    </button>
                  )}
                  <button onClick={() => copyKey(key.name, key.value)} className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-all">
                    {copied === key.name ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--success)]" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
