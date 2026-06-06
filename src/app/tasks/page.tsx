'use client'

import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  Loader2, Plus, AlertTriangle, GripVertical, Clock, Trash2, X,
  ChevronDown, Sparkles, Tag, Calendar
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
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'normal' | 'high'
  agent_name: string | null
  created_at: string
  updated_at: string
}

interface Column {
  id: string
  title: string
  color: string
  dotColor: string
}

const COLUMNS: Column[] = [
  { id: 'todo', title: 'To Do', color: 'var(--text-muted)', dotColor: 'bg-[var(--text-muted)]' },
  { id: 'in_progress', title: 'In Progress', color: 'var(--warning)', dotColor: 'bg-[var(--warning)]' },
  { id: 'done', title: 'Done', color: 'var(--success)', dotColor: 'bg-[var(--success)]' },
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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [newDescription, setNewDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/data?table=tasks&limit=200&order=updated_at.desc')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTasks(data || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  // Group tasks by status
  const getColumnTasks = (status: string) => tasks.filter(t => t.status === status)

  // Handle drag end
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStatus = destination.droppableId as Task['status']

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === draggableId ? { ...t, status: newStatus } : t
    ))

    // Persist to Supabase
    try {
      await fetch('/api/data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          id: draggableId,
          data: { status: newStatus, updated_at: new Date().toISOString() },
        }),
      })
    } catch {
      // Revert on failure
      loadData()
    }
  }

  // Create new task
  const createTask = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'tasks',
          data: {
            title: newTitle.trim(),
            description: newDescription.trim() || null,
            status: 'todo',
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

  // Delete task
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
            {tasks.length} tasks · {getColumnTasks('in_progress').length} active
          </p>
        </div>
        <button
          onClick={() => setShowNewTask(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white text-sm font-medium hover:opacity-90 transition-opacity self-start"
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
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
              onKeyDown={e => e.key === 'Enter' && createTask()}
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
              <button
                onClick={createTask}
                disabled={!newTitle.trim() || creating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
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
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-3 min-h-[200px] space-y-2 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-[var(--accent)]/5' : ''
                      }`}
                    >
                      {columnTasks.map((task, index) => {
                        const pri = priorityConfig[task.priority] || priorityConfig.normal
                        return (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`rounded-xl border p-3 transition-all cursor-grab active:cursor-grabbing ${
                                  snapshot.isDragging
                                    ? 'border-[var(--accent)]/30 bg-[var(--bg-elevated)] shadow-lg shadow-black/30 rotate-[2deg]'
                                    : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)]'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div {...provided.dragHandleProps} className="mt-0.5 flex-shrink-0">
                                    <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-40 hover:opacity-100" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
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
                                    {task.description && (
                                      <p className="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-2">{task.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-[9px] text-[var(--text-muted)] flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {timeAgo(task.updated_at || task.created_at)}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                                        className="ml-auto text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors opacity-0 group-hover:opacity-100"
                                        style={{ opacity: 0.4 }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
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
