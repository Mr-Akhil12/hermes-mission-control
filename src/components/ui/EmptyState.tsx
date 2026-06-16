import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  children?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <Icon className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
      <p className="text-sm text-[var(--text-secondary)]">{title}</p>
      {description && (
        <p className="text-xs text-[var(--text-muted)] mt-1">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
