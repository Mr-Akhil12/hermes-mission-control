'use client'

import { Settings, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'

export const dynamic = 'force-dynamic'

export default function ConfigPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => { setLoading(false) }, [])

  const configSections = [
    {
      title: 'Gateway',
      items: [
        { label: 'API Port', value: '9119', type: 'port' },
        { label: 'Control Plane', value: '9120', type: 'port' },
        { label: 'Status', value: 'Running', type: 'status' },
      ]
    },
    {
      title: 'Database',
      items: [
        { label: 'Supabase URL', value: 'bwlrhvmgychtgfwwgmhn.supabase.co', type: 'url' },
        { label: 'Realtime', value: 'Enabled', type: 'status' },
        { label: 'Tables', value: '4 active', type: 'count' },
      ]
    },
    {
      title: 'Integrations',
      items: [
        { label: 'n8n', value: 'Connected (:5678)', type: 'status' },
        { label: 'Tailscale', value: 'Active', type: 'status' },
        { label: 'Vercel', value: 'Deployed', type: 'status' },
      ]
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-slide-up">
        <h1 className="text-xl sm:text-2xl font-bold gradient-text">Config</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">System configuration and status</p>
      </div>

      <div className="grid gap-3 sm:gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
        {configSections.map(section => (
          <div key={section.title} className="rounded-xl sm:rounded-2xl glass-panel border border-[var(--border)] overflow-hidden">
            <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 border-b border-[var(--border)]">
              <Settings className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs sm:text-sm font-semibold">{section.title}</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {section.items.map(item => {
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
                    <span className={`text-xs sm:text-sm font-mono break-all ${
                      item.type === 'status' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'
                    } ${isLongValue ? 'text-left' : 'text-right'}`}>{item.value}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
