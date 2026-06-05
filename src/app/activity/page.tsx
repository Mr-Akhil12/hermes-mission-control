'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Loader2, RefreshCw, Search, Clock, AlertTriangle, CheckCircle2, X, ChevronDown } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface ActivityItem {
  id: string
  agent_name: string
  action: string
  details: string | null
  status: 'running' | 'completed' | 'error'
  created_at: string
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const statusDot: Record<string, string> = {
  completed: 'bg-[var(--success)]',
  error: 'bg-[var(--danger)]',
  running: 'bg-[var(--warning)]',
}

const statusLabel: Record<string, { text: string; color: string }> = {
  completed: { text: 'Completed', color: 'text-[var(--success)]' },
  error: { text: 'Error', color: 'text-[var(--danger)]' },
  running: { text: 'Running', color: 'text-[var(--warning)]' },
}

const TIME_FILTERS = [
  { key: '48h', label: '48 hours', hours: 48 },
  { key: '1d', label: 'Past day', hours: 24 },
  { key: '7d', label: 'Past 7 days', hours: 168 },
  { key: 'all', label: 'All time', hours: 0 },
]

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [timeFilter, setTimeFilter] = useState<string>('7d')
  const [limit, setLimit] = useState<number>(50)
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      setRefreshing(true)
      // Fetch a large pool so we can filter client-side
      const res = await fetch('/api/data?table=agent_activities&limit=500&order=created_at.desc')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setActivities(data || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Apply all filters
  const filtered = activities.filter(a => {
    // Status filter
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    // Time filter
    if (timeFilter !== 'all') {
      const tf = TIME_FILTERS.find(t => t.key === timeFilter)
      if (tf && tf.hours > 0) {
        const cutoff = Date.now() - (tf.hours * 3600 * 1000)
        if (new Date(a.created_at).getTime() < cutoff) return false
      }
    }
    // Search filter
    if (search) {
      const q = search.toLowerCase()
      return (
        a.agent_name.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        (a.details && a.details.toLowerCase().includes(q))
      )
    }
    return true
  }).slice(0, limit)

  const counts = {
    all: activities.length,
    completed: activities.filter(a => a.status === 'completed').length,
    error: activities.filter(a => a.status === 'error').length,
    running: activities.filter(a => a.status === 'running').length,
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Activity Log</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {filtered.length} of {activities.length} events
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">Show:</label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="px-2 py-2 rounded-lg glass-panel border border-[var(--border)] text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]/40 bg-transparent"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl glass-panel border border-[var(--border)] text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="animate-slide-up space-y-3" style={{ animationDelay: '60ms' }}>
        {/* Search + Limit row */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by agent, action, or details..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-panel border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Time filters + Status filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Time filter */}
          <div className="flex items-center gap-1 glass-panel border border-[var(--border)] rounded-xl p-1">
            {TIME_FILTERS.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeFilter(tf.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                  timeFilter === tf.key
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-1 glass-panel border border-[var(--border)] rounded-xl p-1">
            {(['all', 'completed', 'error', 'running'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all capitalize ${
                  statusFilter === f
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto mb-2" />
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl glass-panel border border-[var(--border)] p-12 text-center">
          <Activity className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-sm text-[var(--text-secondary)]">No activities found</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Try adjusting your filters or search query</p>
        </div>
      ) : (
        <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden" style={{ animationDelay: '120ms' }}>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-[var(--border)]">
            {filtered.map((a) => {
              const st = statusLabel[a.status] || { text: a.status, color: 'text-[var(--text-muted)]' }
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedActivity(a)}
                  className="w-full text-left flex items-start gap-3 px-4 sm:px-5 py-3.5 hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                >
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${statusDot[a.status] || 'bg-[var(--text-muted)]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[var(--accent)]">{a.agent_name}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{a.action}</span>
                      <span className={`text-[10px] font-medium ${st.color}`}>· {st.text}</span>
                    </div>
                    {a.details && <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">{a.details}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">{timeAgo(a.created_at)}</span>
                    <ChevronDown className="w-3 h-3 text-[var(--text-muted)] opacity-50" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setSelectedActivity(null)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl glass-panel border border-[var(--border)] p-5 sm:p-6 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedActivity(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Status badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${statusDot[selectedActivity.status] || 'bg-[var(--text-muted)]'}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${statusLabel[selectedActivity.status]?.color || 'text-[var(--text-muted)]'}`}>
                {statusLabel[selectedActivity.status]?.text || selectedActivity.status}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{selectedActivity.agent_name}</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{selectedActivity.action}</p>

            {/* Details */}
            {selectedActivity.details && (
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4 mb-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2 font-medium">Details</p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed break-words">{selectedActivity.details}</p>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">
                {new Date(selectedActivity.created_at).toLocaleString('en-ZA', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {' · '}
                {timeAgo(selectedActivity.created_at)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
