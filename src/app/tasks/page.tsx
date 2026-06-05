'use client'

import { useEffect, useState, useCallback } from 'react'
import { Kanban, Loader2, Plus, AlertTriangle, CheckCircle2, Clock, Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Task {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'normal' | 'high'
  created_at?: string
  updated_at?: string
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  todo: { label: 'To Do', color: 'text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' },
  in_progress: { label: 'In Progress', color: 'text-[var(--warning)]', dot: 'bg-[var(--warning)]' },
  done: { label: 'Done', color: 'text-[var(--success)]', dot: 'bg-[var(--success)]' },
}

const priorityStyle: Record<string, string> = {
  high: 'bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20',
  normal: 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20',
  low: 'bg-[var(--text-muted)]/10 text-[var(--text-muted)] border border-[var(--text-muted)]/20',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/data?table=tasks&limit=100&order=updated_at.desc')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTasks(data || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = activeFilter === 'all' ? tasks : tasks.filter(t => t.status === activeFilter)

  const columns = [
    { key: 'todo', tasks: filtered.filter(t => t.status === 'todo') },
    { key: 'in_progress', tasks: filtered.filter(t => t.status === 'in_progress') },
    { key: 'done', tasks: filtered.filter(t => t.status === 'done') },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Tasks</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{tasks.length} total tasks across all statuses</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="flex items-center gap-1 glass-panel border border-[var(--border)] rounded-xl p-1">
            {['all', 'todo', 'in_progress', 'done'].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  activeFilter === f
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {f === 'in_progress' ? 'Active' : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto mb-2" />
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl glass-panel border border-[var(--border)] p-16 text-center">
          <Kanban className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium text-[var(--text-secondary)]">No tasks yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Tasks created by Hermes will appear here</p>
        </div>
      ) : activeFilter === 'all' ? (
        /* Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
          {columns.map(col => {
            const config = statusConfig[col.key]
            return (
              <div key={col.key} className="rounded-2xl glass-panel border border-[var(--border)] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
                  <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">{config.label}</span>
                  <span className="ml-auto text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-md">{col.tasks.length}</span>
                </div>
                <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                  {col.tasks.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] text-center py-6">No tasks</p>
                  ) : col.tasks.map(t => (
                    <div key={t.id} className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-3 hover:border-[var(--border-hover)] transition-colors cursor-pointer">
                      <p className="text-sm text-[var(--text-primary)] leading-snug">{t.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${priorityStyle[t.priority] || priorityStyle.normal}`}>
                          {t.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View for filtered */
        <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]" style={{ animationDelay: '60ms' }}>
          {filtered.map(t => {
            const config = statusConfig[t.status]
            return (
              <div key={t.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--bg-card-hover)] transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${config.dot}`} />
                <span className="text-sm text-[var(--text-primary)] flex-1">{t.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${priorityStyle[t.priority] || priorityStyle.normal}`}>
                  {t.priority}
                </span>
                <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
