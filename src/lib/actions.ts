import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ─── TYPES ───
export interface AgentActivity {
  id: string
  agent_name: string
  action: string
  details: string | null
  status: 'running' | 'completed' | 'error'
  metadata: Record<string, any> | null
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'normal' | 'high'
  agent_name: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  title: string | null
  source: string
  model: string | null
  message_count: number
  last_active: string
  is_active: boolean
}

// ─── SERVER ACTIONS ───
export async function getActivities(limit = 50) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data: data as AgentActivity[] | null, error }
}

export async function getTasks() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('updated_at', { ascending: false })
  return { data: data as Task[] | null, error }
}

export async function createTask(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const priority = formData.get('priority') as 'low' | 'normal' | 'high'
  
  const { error } = await supabase.from('tasks').insert({
    title,
    description: description || null,
    priority: priority || 'normal',
    status: 'todo',
  })
  
  if (error) throw error
  revalidatePath('/')
}

export async function updateTaskStatus(id: string, status: 'todo' | 'in_progress' | 'done') {
  'use server'
  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) throw error
  revalidatePath('/')
}

export async function deleteTask(id: string) {
  'use server'
  const supabase = await createClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/')
}

export async function logActivity(
  agentName: string,
  action: string,
  details?: string,
  status: 'running' | 'completed' | 'error' = 'completed',
  metadata?: Record<string, any>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('agent_activities').insert({
    agent_name: agentName,
    action,
    details: details || null,
    status,
    metadata: metadata || null,
  })
  return { error }
}
