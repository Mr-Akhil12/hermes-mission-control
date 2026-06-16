interface StatusDotProps {
  status: string
  pulse?: boolean
}

const statusColors: Record<string, string> = {
  completed: 'bg-[var(--success)]',
  success: 'bg-[var(--success)]',
  done: 'bg-[var(--success)]',
  error: 'bg-[var(--danger)]',
  danger: 'bg-[var(--danger)]',
  running: 'bg-[var(--warning)]',
  warning: 'bg-[var(--warning)]',
  in_progress: 'bg-[var(--warning)]',
  todo: 'bg-[var(--text-muted)]',
}

export function StatusDot({ status, pulse = true }: StatusDotProps) {
  const colorClass = statusColors[status] || 'bg-[var(--text-muted)]'
  return (
    <div
      className={`w-2 h-2 rounded-full flex-shrink-0 ${colorClass}${pulse ? ' pulse-dot' : ''}`}
    />
  )
}
