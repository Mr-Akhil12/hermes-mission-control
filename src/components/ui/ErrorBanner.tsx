'use client'

import { AlertTriangle } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  variant?: 'danger' | 'warning'
}

const variantStyles = {
  danger: {
    wrapper: 'bg-[var(--danger)]/5 border-[var(--danger)]/20',
    icon: 'text-[var(--danger)]',
    text: 'text-[var(--danger)]',
    subtext: 'text-[var(--danger)]/70',
    button: 'bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-[var(--danger)]',
  },
  warning: {
    wrapper: 'bg-[var(--warning)]/5 border-[var(--warning)]/20',
    icon: 'text-[var(--warning)]',
    text: 'text-[var(--warning)]',
    subtext: 'text-[var(--warning)]/70',
    button: 'bg-[var(--warning)]/10 hover:bg-[var(--warning)]/20 text-[var(--warning)]',
  },
}

export function ErrorBanner({ message, onRetry, variant = 'danger' }: ErrorBannerProps) {
  const s = variantStyles[variant]
  return (
    <div className={`animate-slide-up rounded-2xl border p-4 flex items-center gap-3 ${s.wrapper}`}>
      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${s.icon}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${s.text}`}>Connection Error</p>
        <p className={`text-xs mt-0.5 truncate ${s.subtext}`}>{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors flex-shrink-0 ${s.button}`}
        >
          Retry
        </button>
      )}
    </div>
  )
}
