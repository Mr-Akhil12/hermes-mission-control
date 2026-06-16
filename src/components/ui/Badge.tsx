interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'accent' | 'purple'
  size?: 'sm' | 'md'
}

const variantClasses: Record<string, string> = {
  success: 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20',
  warning: 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20',
  danger: 'bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20',
  neutral: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)] border border-[var(--text-muted)]/20',
  accent: 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20',
  purple: 'bg-[var(--purple)]/10 text-[var(--purple)] border border-[var(--purple)]/20',
}

const sizeClasses: Record<string, string> = {
  sm: 'text-[9px] px-1.5 py-0.5',
  md: 'text-[10px] px-2 py-0.5',
}

export function Badge({ children, variant = 'neutral', size = 'md' }: BadgeProps) {
  return (
    <span
      className={`${sizeClasses[size]} rounded-md font-medium inline-flex items-center ${variantClasses[variant]}`}
    >
      {children}
    </span>
  )
}
