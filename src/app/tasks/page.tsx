'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical } from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'normal' | 'high'
  created_at: string
  updated_at: string
}

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-zinc-600' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-400' },
  { id: 'done', label: 'Done', color: 'bg-emerald-400' },
] as const

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const supabase = createClient()

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').order('updated_at', { ascending: false })
    if (data) setTasks(data as Task[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadTasks()
    const channel = supabase.channel('tasks-kanban')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadTasks, supabase])

  const createTask = async () => {
    if (!newTitle.trim()) return
    await supabase.from('tasks').insert({ title: newTitle.trim(), priority: newPriority, status: 'todo' })
    setNewTitle('')
    setShowCreate(false)
    loadTasks()
  }

  const updateStatus = async (id: string, status: 'todo' | 'in_progress' | 'done') => {
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    loadTasks()
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    loadTasks()
  }

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Task Board</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-black rounded-lg text-sm font-medium hover:bg-orange-400 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Task
        </button>
      </div>

      {showCreate && (
        <div className="bg-[#111118] rounded-xl p-4 border border-[#1e1e2a] animate-slide-in">
          <input
            autoFocus
            placeholder="Task title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createTask()}
            className="w-full bg-[#16161f] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm mb-3"
          />
          <div className="flex items-center gap-3">
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as any)} className="bg-[#16161f] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <button onClick={createTask} className="px-4 py-2 bg-orange-500 text-black rounded-lg text-sm font-medium">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-zinc-400 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          return (
            <div key={col.id} className="bg-[#111118] rounded-xl border border-[#1e1e2a] p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${col.color}`} />
                <span className="text-xs font-medium text-zinc-400">{col.label}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map(task => (
                  <div key={task.id} className="bg-[#0a0a0f] rounded-lg p-3 border border-[#1e1e2a] group">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm text-zinc-200 flex-1">{task.title}</span>
                      <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        task.priority === 'high' ? 'bg-red-500/10 text-red-400' : task.priority === 'normal' ? 'bg-sky-500/10 text-sky-400' : 'bg-zinc-700 text-zinc-400'
                      }`}>{task.priority}</span>
                      {col.id !== 'done' && (
                        <button onClick={() => updateStatus(task.id, col.id === 'todo' ? 'in_progress' : 'done')} className="text-[10px] text-zinc-500 hover:text-orange-400 ml-auto">
                          → {col.id === 'todo' ? 'Start' : 'Complete'}
                        </button>
                      )}
                      {col.id === 'done' && (
                        <button onClick={() => updateStatus(task.id, 'todo')} className="text-[10px] text-zinc-500 hover:text-orange-400 ml-auto">
                          → Reopen
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">No tasks</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
