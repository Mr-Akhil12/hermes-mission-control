'use client'

import { Cpu, RefreshCw, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useSupabaseQuery } from '@/lib/useSupabaseQuery'

export const dynamic = 'force-dynamic'

interface Model {
  id: string
  name: string
  provider: string
  context_length: number
  status: 'active' | 'available' | 'deprecated'
  role: string
  color: string
}

interface ModelsResponse {
  models: Model[]
  updatedAt?: string
}

function statusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
  switch (status) {
    case 'active': return 'success'
    case 'available': return 'accent'
    case 'deprecated': return 'danger'
    default: return 'neutral'
  }
}

function formatContextLength(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function ModelsPage() {
  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useSupabaseQuery<ModelsResponse>('/api/models')

  const models = data?.models || []
  const updatedAt = data?.updatedAt || null

  if (loading) {
    return <LoadingSpinner text="Loading models..." />
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="animate-slide-up">
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Models</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">AI models available to Hermes</p>
        </div>
        <EmptyState icon={Cpu} title="Failed to load models" description={error.message}>
          <button
            onClick={() => mutate()}
            className="inline-flex items-center gap-2 text-xs text-[var(--accent)] hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Models</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">AI models available to Hermes</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-[10px] text-[var(--text-muted)]">
              Updated {new Date(updatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => mutate()}
            className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center hover:bg-[var(--bg-card-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--accent)]"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {models.length === 0 ? (
        <EmptyState icon={Cpu} title="No models configured" description="Add models via MODELS_CONFIG env var" />
      ) : (
        <div className="grid gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
          {models.map((m) => (
            <div key={m.id} className="rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${m.color}15` }}>
                    <Cpu className="w-4 h-4" style={{ color: m.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{m.name}</h3>
                      <StatusDot status={m.status === 'active' ? 'success' : m.status === 'deprecated' ? 'error' : 'todo'} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{m.provider}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-[var(--text-secondary)]">{m.role}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {formatContextLength(m.context_length)} ctx
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant={statusBadgeVariant(m.status)} size="md">
                  {m.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
