'use client'

import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  Loader2, Plus, AlertTriangle, GripVertical, Clock, Trash2, X,
  Sparkles, Tag, FileEdit
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  agent_name: string | null
  created_at: string
  updated_at: string
  _column?: string // draft, todo, in_progress, done
}

interface ColumnDef {
  id: string
  title: string
  dotColor: string
  icon: string
}

const COLUMNS: ColumnDef[] = [
  { id: 'draft', title: 'Draft', dotColor: 'bg-[var(--purple)]', icon: '✏️' },
  { id: 'todo', title: 'To Do', dotColor: 'bg-[var(--text-muted)]', icon: '📋' },
  { id: 'in_progress', title: 'In Progress', dotColor: 'bg-[var(--warning)]', icon: '⚡' },
  { id: 'done', title: 'Done', dotColor: 'bg-[var(--success)]', icon: '✅' },
]

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10 border-[var(--danger)]/20' },
  normal: { label: 'Normal', color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10 border-[var(--accent)]/20' },
  low: { label: 'Low', color: 'text-[var(--text-muted)]', bg: 'bg-[var(--text-muted)]/10 border-[var(--text-muted)]/20' },
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

// Extract column from description JSON prefix
function getColumn(task: Task): string {
  if (task._column) return task._column
  if (task.description?.startsWith('{"_col":')) {
    try {
      const meta = JSON.parse(task.description.split('\n')[0])
      return meta._col || task.status
    } catch { /* fall through */ }
  }
  return task.status
}

// Get display description (without JSON prefix)
function getDisplayDesc(task: Task): string {
  if (!task.description) return ''
  if (task.description.startsWith('{"_col":')) {
    return task.description.split('\n').slice(1).join('\n')
  }
  return task.description
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/data?table=tasks&limit=200&order=updated_at.desc')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Enrich with column info from description
      const enriched = (data || []).map((t: Task) => ({
        ...t,
        _column: getColumn(t),
      }))
      setTasks(enriched)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Real-time Supabase subscription
  useEffect(() => {
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  const getColumnTasks = (colId: string) => tasks.filter(t => getColumn(t) === colId)

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newColumn = destination.droppableId
    const task = tasks.find(t => t.id === draggableId)
    if (!task) return

    // Build new description with column prefix
    const displayDesc = getDisplayDesc(task)
    const newDesc = JSON.stringify({ _col: newColumn }) + (displayDesc ? `\n${displayDesc}` : '')

    // Map column to Supabase status
    const supaStatus = newColumn === 'draft' ? 'todo' : newColumn

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === draggableId ? { ...t, _column: newColumn, status: supaStatus, description: newDesc } : t
    ))

    // Persist
    try {
      await fetch('/api/data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          id: draggableId,
          data: { status: supaStatus, description: newDesc, updated_at: new Date().toISOString() },
        }),
      })
    } catch { loadData() }
  }

  const createTask = async (column: string = 'draft') => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const desc = newDescription.trim()
        ? JSON.stringify({ _col: column }) + `\n${newDescription.trim()}`
        : JSON.stringify({ _col: column })
      const supaStatus = column === 'draft' ? 'todo' : column

      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          data: {
            title: newTitle.trim(),
            description: desc,
            status: supaStatus,
            priority: newPriority,
            agent_name: 'user',
          },
        }),
      })
      if (res.ok) {
        setNewTitle('')
        setNewDescription('')
        setNewPriority('normal')
        setShowNewTask(false)
        loadData()
      }
    } catch { /* ignore */ }
    finally { setCreating(false) }
  }

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/data?table=tasks&id=${id}`, { method: 'DELETE' })
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">Loading tasks...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto mb-2" />
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Tasks</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {tasks.length} tasks · {getColumnTasks('in_progress').length} active · {getColumnTasks('draft').length} drafts
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      {/* New Task Form */}
      {showNewTask && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--accent)]/20 p-4 sm:p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" /> New Task
            </h3>
            <button onClick={() => setShowNewTask(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTask('draft')}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
            />
            <textarea
              placeholder="Description (optional)"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 resize-none"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                {(['low', 'normal', 'high'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setNewPriority(p)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                      newPriority === p
                        ? priorityConfig[p].bg + ' ' + priorityConfig[p].color
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {priorityConfig[p].label}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => createTask('draft')}
                  disabled={!newTitle.trim() || creating}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--purple)]/10 text-[var(--purple)] border border-[var(--purple)]/20 text-sm font-medium hover:bg-[var(--purple)]/20 transition-all disabled:opacity-40"
                >
                  <FileEdit className="w-3.5 h-3.5" /> Save as Draft
                </button>
                <button
                  onClick={() => createTask('todo')}
                  disabled={!newTitle.trim() || creating}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
          {COLUMNS.map(column => {
            const columnTasks = getColumnTasks(column.id)
            return (
              <div key={column.id} className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
                {/* Column Header */}
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{column.title}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] font-medium">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowNewTask(true)
                      // Pre-select column for new task
                    }}
                    className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Droppable */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-2 min-h-[200px] max-h-[500px] overflow-y-auto space-y-2 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-[var(--accent)]/5' : ''
                      }`}
                    >
                      {columnTasks.map((task, index) => {
                        const pri = priorityConfig[task.priority] || priorityConfig.normal
                        const desc = getDisplayDesc(task)
                        return (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`rounded-xl border p-3 transition-all cursor-grab active:cursor-grabbing group ${
                                  snapshot.isDragging
                                    ? 'border-[var(--accent)]/30 bg-[var(--bg-elevated)] shadow-lg shadow-black/30 rotate-[2deg]'
                                    : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div {...provided.dragHandleProps} className="mt-0.5 flex-shrink-0">
                                    <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-30 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${pri.bg} ${pri.color}`}>
                                        {pri.label}
                                      </span>
                                      {task.agent_name && task.agent_name !== 'user' && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--purple)]/10 text-[var(--purple)] border border-[var(--purple)]/20 font-medium">
                                          {task.agent_name}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-medium text-[var(--text-primary)] leading-relaxed">{task.title}</p>
                                    {desc && (
                                      <p className="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-2">{desc}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-[9px] text-[var(--text-muted)] flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {timeAgo(task.updated_at || task.created_at)}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                                        className="ml-auto text-[var(--text-muted)] hover:text-[var(--danger)] transition-opacity md:opacity-0 md:group-hover:opacity-100 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 p-2"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                      {columnTasks.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-[11px] text-[var(--text-muted)]">Drop tasks here</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>
    </div>
  )
}
