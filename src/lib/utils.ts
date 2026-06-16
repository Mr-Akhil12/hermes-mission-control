/**
 * Utility functions extracted from pages for reuse across the app.
 */

/** Convert an ISO date string to a relative time string (e.g. "5m ago"). */
export function timeAgo(dateStr: string): string {
  if (!dateStr) return '—'
  const ms = new Date(dateStr).getTime()
  if (isNaN(ms)) return '—'
  const s = (Date.now() - ms) / 1000
  if (s < 0) return 'just now'
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Like timeAgo but without the " ago" suffix (for compact displays). */
export function timeAgoShort(dateStr: string): string {
  if (!dateStr) return '—'
  const ms = new Date(dateStr).getTime()
  if (isNaN(ms)) return '—'
  const s = (Date.now() - ms) / 1000
  if (s < 0) return 'now'
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

/** Map an agent name to a color class based on keywords. */
const agentColorKeys = ['system', 'cron', 'agent'] as const
const agentColorMap: Record<string, string> = {
  system: 'text-[var(--accent)]',
  cron: 'text-[var(--purple)]',
  agent: 'text-[var(--cyan)]',
}

export function getAgentColor(name: string): string {
  const lower = name.toLowerCase()
  for (const key of agentColorKeys) {
    if (lower.includes(key)) return agentColorMap[key]
  }
  return 'text-[var(--text-secondary)]'
}
