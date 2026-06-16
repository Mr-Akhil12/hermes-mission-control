'use client'

import { Settings, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useSupabaseQuery } from '@/lib/useSupabaseQuery'

export const dynamic = 'force-dynamic'

interface ConfigItem {
  label: string
  value: string
  masked: boolean
}

interface ConfigSection {
  title: string
  items: ConfigItem[]
}

interface ConfigResponse {
  sections: ConfigSection[]
  updatedAt?: string
}

export default function ConfigPage() {
  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useSupabaseQuery<ConfigResponse>('/api/config')

  const sections = data?.sections || []
  const updatedAt = data?.updatedAt || null

  if (loading) {
    return <LoadingSpinner text="Loading config..." />
  }

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="animate-slide-up">
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Config</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">System configuration and status</p>
        </div>
        <EmptyState icon={Settings} title="Failed to load config" description={error.message}>
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Config</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">System configuration and status</p>
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

      {sections.length === 0 ? (
        <EmptyState icon={Settings} title="No configuration available" />
      ) : (
        <div className="grid gap-3 sm:gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
          {sections.map((section) => (
            <div key={section.title} className="rounded-xl sm:rounded-2xl glass-panel border border-[var(--border)] overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-xs sm:text-sm font-semibold">{section.title}</span>
                </div>
                <Badge variant="neutral" size="sm">
                  {section.items.length} items
                </Badge>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {section.items.map((item) => {
                  const isLongValue = item.value.length > 20
                  return (
                    <div
                      key={item.label}
                      className={`px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-[var(--bg-card-hover)] transition-colors ${
                        isLongValue
                          ? 'flex flex-col items-start gap-1'
                          : 'flex items-center justify-between'
                      }`}
                    >
                      <span className="text-xs sm:text-sm text-[var(--text-secondary)]">{item.label}</span>
                      <span
                        className={`text-xs sm:text-sm font-mono break-all ${
                          item.value === 'Not configured' ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'
                        } ${isLongValue ? 'text-left' : 'text-right'}`}
                      >
                        {item.value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
