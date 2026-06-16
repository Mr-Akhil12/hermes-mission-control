import { Zap } from 'lucide-react'

interface LoadingSpinnerProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeConfig: Record<string, { wrapper: string; icon: string }> = {
  sm: { wrapper: 'w-10 h-10', icon: 'w-4 h-4' },
  md: { wrapper: 'w-16 h-16', icon: 'w-5 h-5' },
  lg: { wrapper: 'w-20 h-20', icon: 'w-6 h-6' },
}

export function LoadingSpinner({ text, size = 'md' }: LoadingSpinnerProps) {
  const config = sizeConfig[size]
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center">
        <div className={`relative ${config.wrapper} mx-auto mb-4`}>
          <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
          <Zap className={`absolute inset-0 m-auto ${config.icon} text-[var(--accent)]`} />
        </div>
        {text && (
          <p className="text-sm text-[var(--text-secondary)]">{text}</p>
        )}
      </div>
    </div>
  )
}
