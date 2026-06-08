'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Loader2, Plus, Trash2, Send, Clock, Settings, MessageSquare,
  AlertTriangle, Copy, Check, Paperclip, Brain, RefreshCw, X,
  Sparkles, Bot, User, FileText, CheckCircle2, Wrench, ShieldCheck,
  ShieldX, ChevronDown, ChevronRight
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ───
interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning: string | null
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  duration_ms: number | null
  metadata: Record<string, unknown>
  created_at: string
}

interface Conversation {
  id: string
  title: string
  model: string
  system_prompt: string | null
  thinking_mode: boolean
  cron_context: CronContextItem[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  messages?: Message[]
}

interface CronContextItem {
  id: string
  name: string
  schedule: string
  prompt?: string
  last_status?: string
  last_run_at?: string
  next_run_at?: string
  last_error?: string
  enabled?: boolean
}

interface CronJob {
  id: string
  name: string
  schedule: string
  schedule_display: string
  enabled: boolean
  state: string
  last_run_at: string | null
  next_run_at: string | null
  last_status: string | null
  last_error: string | null
  prompt: string
}

interface ToolCall {
  call_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'done' | 'error'
  approvalCountdown?: number
}

interface StreamingState {
  content: string
  reasoning: string
  toolCalls: ToolCall[]
  status: 'idle' | 'thinking' | 'streaming' | 'tool_wait' | 'done' | 'error'
  errorMessage?: string
}

// ─── Helpers ───
function timeAgo(dateStr: string) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function renderMarkdown(text: string) {
  if (!text) return ''
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-[var(--bg-primary)] rounded-xl p-4 my-3 overflow-x-auto border border-[var(--border)]"><code class="text-xs font-mono text-[var(--text-secondary)]">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--accent)] text-xs font-mono border border-[var(--border)]">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[var(--text-primary)]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-[var(--accent)] hover:underline">$1</a>')
    .replace(/\n/g, '<br />')
}

// ─── Tool Call Card Component ───
function ToolCallCard({
  tool,
  onApprove,
  onReject,
}: {
  tool: ToolCall
  onApprove: (callId: string) => void
  onReject: (callId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const statusConfig = {
    pending: { icon: Loader2, color: 'text-[var(--warning)]', bg: 'bg-[var(--warning)]/10 border-[var(--warning)]/20', label: 'Awaiting approval...' },
    approved: { icon: ShieldCheck, color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10 border-[var(--success)]/20', label: 'Approved' },
    rejected: { icon: ShieldX, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10 border-[var(--danger)]/20', label: 'Rejected by user' },
    executing: { icon: Loader2, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10 border-[var(--accent)]/20', label: 'Executing...' },
    done: { icon: CheckCircle2, color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10 border-[var(--success)]/20', label: 'Complete' },
    error: { icon: AlertTriangle, color: 'text-[var(--danger)]', bg: 'bg-[var(--danger)]/10 border-[var(--danger)]/20', label: 'Error' },
  }

  const config = statusConfig[tool.status]
  const StatusIcon = config.icon

  return (
    <div className={`rounded-xl border ${config.bg} transition-all overflow-hidden`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <Wrench className={`w-3.5 h-3.5 ${config.color} ${tool.status === 'executing' || tool.status === 'pending' ? 'animate-spin' : ''}`} />
        <span className="text-xs font-mono font-medium text-[var(--text-primary)] flex-1 truncate">
          {tool.tool_name}
        </span>
        <span className={`text-[10px] ${config.color} flex items-center gap-1`}>
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </span>
        <button onClick={() => setExpanded(!expanded)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-2">
          <pre className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-primary)] rounded-lg p-2 max-h-32 overflow-auto border border-[var(--border)]">
            {JSON.stringify(tool.tool_input, null, 2)}
          </pre>
        </div>
      )}

      {tool.status === 'pending' && (
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-0.5">
          <div className="flex-1 flex items-center gap-1.5">
            <div className="h-1 flex-1 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full bg-[var(--warning)] transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${((tool.approvalCountdown || 0) / 20) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono w-8 text-right">
              {tool.approvalCountdown || 20}s
            </span>
          </div>
          <button
            onClick={() => onReject(tool.call_id)}
            className="px-3 py-1.5 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] text-[11px] font-medium hover:bg-[var(--danger)]/20 transition-colors flex items-center gap-1"
          >
            <ShieldX className="w-3 h-3" /> Reject
          </button>
          <button
            onClick={() => onApprove(tool.call_id)}
            className="px-3 py-1.5 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20 text-[var(--success)] text-[11px] font-medium hover:bg-[var(--success)]/20 transition-colors flex items-center gap-1"
          >
            <ShieldCheck className="w-3 h-3" /> Approve
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Live Assistant Message (streaming) ───
function LiveAssistantMessage({
  streaming,
  onApproveTool,
  onRejectTool,
}: {
  streaming: StreamingState
  onApproveTool: (callId: string) => void
  onRejectTool: (callId: string) => void
}) {
  const [reasoningExpanded, setReasoningExpanded] = useState(true)

  return (
    <div className="flex justify-start animate-slide-up">
      <div className="max-w-[85%] w-full rounded-2xl px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] relative">
        {streaming.status !== 'done' && streaming.status !== 'error' && (
          <div className="absolute inset-0 rounded-2xl border border-[var(--accent)]/30 animate-pulse pointer-events-none" />
        )}

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-3.5 h-3.5 text-[var(--purple)]" />
            <span className="text-[10px] font-medium text-[var(--purple)]">Hermes</span>
            {streaming.status === 'thinking' && (
              <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                <Brain className="w-3 h-3" /> Thinking...
              </span>
            )}
            {streaming.status === 'streaming' && (
              <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                Generating...
              </span>
            )}
            {streaming.status === 'tool_wait' && (
              <span className="text-[10px] text-[var(--warning)] flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Waiting for tool approval...
              </span>
            )}
          </div>

          {streaming.reasoning && (
            <details open={reasoningExpanded} className="mb-2">
              <summary
                className="text-[10px] text-[var(--text-muted)] cursor-pointer flex items-center gap-1 list-none"
                onClick={() => setReasoningExpanded(!reasoningExpanded)}
              >
                <Brain className="w-3 h-3 text-[var(--purple)]" />
                <span className="text-[var(--purple)]">Thinking</span>
                {reasoningExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </summary>
              <div className="mt-1.5 px-3 py-2 rounded-lg bg-[var(--purple)]/5 border-l-2 border-[var(--purple)]/40">
                <p className="text-[11px] text-[var(--text-muted)] italic whitespace-pre-wrap leading-relaxed">
                  {streaming.reasoning}
                </p>
              </div>
            </details>
          )}

          {streaming.toolCalls.length > 0 && (
            <div className="space-y-2 mb-2">
              {streaming.toolCalls.map(tc => (
                <ToolCallCard
                  key={tc.call_id}
                  tool={tc}
                  onApprove={onApproveTool}
                  onReject={onRejectTool}
                />
              ))}
            </div>
          )}

          {streaming.content && (
            <div
              className="text-sm text-[var(--text-secondary)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(streaming.content) }}
            />
          )}

          {(streaming.status === 'streaming' || streaming.status === 'thinking') && (
            <span className="inline-block w-1.5 h-4 bg-[var(--accent)] animate-pulse ml-0.5 align-middle" />
          )}

          {streaming.status === 'error' && streaming.errorMessage && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20">
              <p className="text-xs text-[var(--danger)]">{streaming.errorMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Chat Page ───
export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showCronPicker, setShowCronPicker] = useState(false)
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])

  const [streaming, setStreaming] = useState<StreamingState>({
    content: '',
    reasoning: '',
    toolCalls: [],
    status: 'idle',
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  // ─── Data Loading ───
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?limit=50')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConversations(await res.json() || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setActiveConv(await res.json())
      setSidebarOpen(false)
      setStreaming({ content: '', reasoning: '', toolCalls: [], status: 'idle' })
      // Scroll to bottom after loading, with a small delay for render
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
        }
      }, 150)
    } catch { /* ignore */ }
  }, [])

  const loadCronJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/cron')
      if (res.ok) setCronJobs(await res.json() || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { loadCronJobs() }, [loadCronJobs])

  // ─── Supabase Realtime ───
  useEffect(() => {
    const channel = supabase
      .channel('chat-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, loadConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (activeConv && payload.new && (payload.new as Message).conversation_id === activeConv.id) {
          setStreaming(prev => {
            if (prev.status === 'idle' || prev.status === 'done' || prev.status === 'error') {
              loadConversation(activeConv.id)
            }
            return prev
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadConversations, loadConversation, activeConv])

  // ─── Conversation CRUD ───
  const createConversation = async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      await loadConversations()
      await loadConversation(data.id)
    } catch { /* ignore */ }
  }

  const deleteConversation = async (id: string) => {
    try {
      await fetch(`/api/chat/${id}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConv?.id === id) setActiveConv(null)
      setToast('Conversation deleted')
      setTimeout(() => setToast(null), 3000)
    } catch { /* ignore */ }
  }

  // ─── Tool Call Approval ───
  const approveToolCall = async (callId: string) => {
    setStreaming(prev => ({
      ...prev,
      toolCalls: prev.toolCalls.map(tc =>
        tc.call_id === callId ? { ...tc, status: 'approved' as const, approvalCountdown: 0 } : tc
      ),
    }))

    try {
      await fetch(`/api/chat/${activeConv?.id}/tool-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, approved: true }),
      })
    } catch { /* ignore */ }
  }

  const rejectToolCall = async (callId: string) => {
    setStreaming(prev => ({
      ...prev,
      toolCalls: prev.toolCalls.map(tc =>
        tc.call_id === callId ? { ...tc, status: 'rejected' as const, approvalCountdown: 0 } : tc
      ),
    }))

    try {
      await fetch(`/api/chat/${activeConv?.id}/tool-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, approved: false }),
      })
    } catch { /* ignore */ }
  }

  // ─── Send Message (Streaming) ───
  const sendMessage = async () => {
    if (!activeConv || (!input.trim() && attachedFiles.length === 0) || sending) return
    const userMessage = input.trim()
    setInput('')
    setSending(true)
    setError(null)

    setStreaming({ content: '', reasoning: '', toolCalls: [], status: 'thinking' })

    const uploadedFiles: Array<{ url: string; name: string; size: number; type: string }> = []
    for (const file of attachedFiles) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('conversationId', activeConv.id)
        const uploadRes = await fetch('/api/chat/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          uploadedFiles.push(uploadData)
        }
      } catch { /* continue without this file */ }
    }
    setAttachedFiles([])

    let fullContent = userMessage
    if (uploadedFiles.length > 0) {
      const fileRefs = uploadedFiles.map(f => `[File: ${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)}KB)](${f.url})`).join('\n')
      fullContent = userMessage ? `${userMessage}\n\n${fileRefs}` : fileRefs
    }

    const optimisticMsg: Message = {
      id: 'temp-' + Date.now(),
      conversation_id: activeConv.id,
      role: 'user',
      content: fullContent,
      reasoning: null, model: null, tokens_in: null, tokens_out: null, duration_ms: null,
      metadata: { files: uploadedFiles }, created_at: new Date().toISOString(),
    }
    setActiveConv(prev => prev ? { ...prev, messages: [...(prev.messages || []), optimisticMsg] } : prev)
    setTimeout(scrollToBottom, 50)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/chat/${activeConv.id}/messages?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fullContent,
          thinking_mode: activeConv.thinking_mode,
          files: uploadedFiles,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || errData.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        while (true) {
          const eventIdx = buffer.indexOf('event: ')
          if (eventIdx === -1) break

          const dataIdx = buffer.indexOf('data: ', eventIdx)
          if (dataIdx === -1) break

          const endIdx = buffer.indexOf('\n\n', dataIdx)
          if (endIdx === -1) break

          const eventType = buffer.slice(eventIdx + 7, dataIdx).trim()
          const rawData = buffer.slice(dataIdx + 6, endIdx).trim()
          buffer = buffer.slice(endIdx + 2)

          try {
            const data = JSON.parse(rawData)

            switch (eventType) {
              case 'thinking':
                setStreaming(prev => ({
                  ...prev,
                  reasoning: prev.reasoning + rawData,
                  status: 'thinking',
                }))
                break

              case 'content':
                setStreaming(prev => ({
                  ...prev,
                  content: prev.content + rawData,
                  status: 'streaming',
                }))
                break

              case 'tool_call':
                setStreaming(prev => {
                  const existing = prev.toolCalls.find(tc => tc.call_id === data.call_id)
                  if (existing) return prev
                  return {
                    ...prev,
                    toolCalls: [...prev.toolCalls, {
                      call_id: data.call_id,
                      tool_name: data.tool_name,
                      tool_input: data.tool_input || {},
                      status: 'pending' as const,
                      approvalCountdown: 20,
                    }],
                    status: 'tool_wait',
                  }
                })
                break

              case 'tool_approval':
                setStreaming(prev => ({
                  ...prev,
                  toolCalls: prev.toolCalls.map(tc =>
                    tc.call_id === data.call_id
                      ? { ...tc, status: data.approved ? 'approved' as const : 'rejected' as const, approvalCountdown: 0 }
                      : tc
                  ),
                  status: data.approved ? 'streaming' : prev.status,
                }))
                break

              case 'done':
                setStreaming(prev => ({ ...prev, status: 'done' }))
                break

              case 'error':
                setStreaming(prev => ({
                  ...prev,
                  status: 'error',
                  errorMessage: data.message || 'Unknown error',
                }))
                break
            }
          } catch {
            if (eventType === 'content') {
              setStreaming(prev => ({
                ...prev,
                content: prev.content + rawData,
                status: 'streaming',
              }))
            }
          }
        }

        scrollToBottom()
      }

      setStreaming(prev => ({ ...prev, status: 'done' }))
      await loadConversation(activeConv.id)
      await loadConversations()

    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setStreaming(prev => ({ ...prev, status: 'idle' }))
      } else {
        setError(e instanceof Error ? e.message : 'Failed to send')
        setStreaming(prev => ({
          ...prev,
          status: 'error',
          errorMessage: e instanceof Error ? e.message : 'Failed to send',
        }))
        setActiveConv(prev => prev ? { ...prev, messages: prev.messages?.filter(m => !m.id.startsWith('temp-')) || [] } : prev)
      }
    } finally {
      setSending(false)
      abortRef.current = null
      textareaRef.current?.focus()
    }
  }

  // ─── Cancel streaming ───
  const cancelStreaming = () => {
    abortRef.current?.abort()
    setStreaming({ content: '', reasoning: '', toolCalls: [], status: 'idle' })
    setSending(false)
  }

  // ─── Tool approval countdown timer ───
  useEffect(() => {
    if (streaming.status !== 'tool_wait') return

    const interval = setInterval(() => {
      setStreaming(prev => {
        const updated = prev.toolCalls.map(tc => {
          if (tc.status === 'pending' && tc.approvalCountdown !== undefined && tc.approvalCountdown > 0) {
            const newCountdown = tc.approvalCountdown - 1
            if (newCountdown <= 0) {
              approveToolCall(tc.call_id)
              return { ...tc, status: 'approved' as const, approvalCountdown: 0 }
            }
            return { ...tc, approvalCountdown: newCountdown }
          }
          return tc
        })

        const stillPending = updated.some(tc => tc.status === 'pending')
        return {
          ...prev,
          toolCalls: updated,
          status: stillPending ? 'tool_wait' as const : 'streaming' as const,
        }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [streaming.status])

  // ─── Other handlers ───
  const toggleCronContext = async (job: CronJob) => {
    if (!activeConv) return
    const current = activeConv.cron_context || []
    const exists = current.find(c => c.id === job.id)
    const updated = exists
      ? current.filter(c => c.id !== job.id)
      : [...current, { id: job.id, name: job.name, schedule: job.schedule_display || job.schedule, prompt: job.prompt, last_status: job.last_status || undefined, last_run_at: job.last_run_at || undefined, next_run_at: job.next_run_at || undefined, last_error: job.last_error || undefined, enabled: job.enabled }]
    setActiveConv(prev => prev ? { ...prev, cron_context: updated } : prev)
    await fetch(`/api/chat/${activeConv.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cron_context: updated }) })
  }

  const updateSystemPrompt = async (prompt: string) => {
    if (!activeConv) return
    setActiveConv(prev => prev ? { ...prev, system_prompt: prompt } : prev)
    await fetch(`/api/chat/${activeConv.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system_prompt: prompt }) })
  }

  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const sortedConversations = useMemo(() =>
    [...conversations].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [conversations]
  )

  // ─── Conversation list (shared mobile/desktop) ───
  const conversationListContent = (
    <>
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold gradient-text">Conversations</h2>
        <button onClick={createConversation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {sortedConversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
            <p className="text-xs text-[var(--text-muted)]">No conversations yet</p>
            <button onClick={createConversation} className="mt-3 text-xs text-[var(--accent)] hover:underline">Start one</button>
          </div>
        ) : sortedConversations.map(conv => (
          <div key={conv.id} onClick={() => loadConversation(conv.id)} className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeConv?.id === conv.id ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20' : 'hover:bg-[var(--bg-card)] border border-transparent'}`}>
            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${activeConv?.id === conv.id ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${activeConv?.id === conv.id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{conv.title}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {timeAgo(conv.updated_at)}
                {conv.cron_context?.length > 0 && <span className="ml-1.5 text-[var(--purple)]">⏱ {conv.cron_context.length}</span>}
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }} className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] transition-all p-1">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </>
  )

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
            <MessageSquare className="absolute inset-0 m-auto w-5 h-5 text-[var(--accent)]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">Loading chat...</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // MAIN RENDER — Full-bleed fixed layout
  // ═══════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-primary)]">
      {/* ─── Mobile Sidebar (overlay) ─── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col" onClick={e => e.stopPropagation()}>
            {conversationListContent}
          </div>
        </div>
      )}

      {/* ─── Desktop Sidebar ─── */}
      <div className="hidden md:flex w-[280px] lg:w-[300px] h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] flex-col flex-shrink-0">
        {conversationListContent}
      </div>

      {/* ─── Main Chat Area ───
          This is the key: flex-col with explicit height so the messages area
          can scroll independently. h-full ensures it fills the fixed parent. */}
      <div className="flex-1 flex flex-col h-full min-h-0">
        {/* ── Chat Header (pinned top, never shrinks) ── */}
        <div className="px-3 py-2.5 flex items-center gap-3 flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg-secondary)]/90 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)]">
            <MessageSquare className="w-4 h-4" />
          </button>

          {activeConv ? (
            <>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{activeConv.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--text-muted)]">{activeConv.messages?.length || 0} messages</span>
                  {activeConv.cron_context?.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--purple)]/10 text-[var(--purple)] border border-[var(--purple)]/20">⏱ {activeConv.cron_context.length}</span>}
                  {sending && streaming.status !== 'idle' && (
                    <span className="text-[10px] text-[var(--accent)] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                      {streaming.status === 'thinking' ? 'Thinking' : streaming.status === 'tool_wait' ? 'Tool wait' : 'Streaming'}
                    </span>
                  )}
                </div>
              </div>
              {sending && (
                <button onClick={cancelStreaming} className="p-2 rounded-lg text-[var(--warning)] hover:bg-[var(--warning)]/10 transition-colors" title="Cancel">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => { setShowCronPicker(!showCronPicker); setShowSettings(false) }} className={`p-2 rounded-lg transition-colors ${showCronPicker ? 'bg-[var(--purple)]/10 text-[var(--purple)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)]'}`} title="Attach cron job">
                <Clock className="w-4 h-4" />
              </button>
              <button onClick={() => { setShowSettings(!showSettings); setShowCronPicker(false) }} className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)]'}`} title="Settings">
                <Settings className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex-1 text-center"><p className="text-sm text-[var(--text-muted)]">Select or create a conversation</p></div>
          )}
        </div>

        {/* ── Settings Panel ── */}
        {showSettings && activeConv && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)]">Settings</h4>
              <button onClick={() => setShowSettings(false)}><X className="w-3.5 h-3.5 text-[var(--text-muted)]" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1 block">System Prompt</label>
                <textarea value={activeConv.system_prompt || ''} onChange={e => updateSystemPrompt(e.target.value)} placeholder="You are Hermes..." rows={3} className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 resize-none font-mono" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium">Model</label>
                <select value={activeConv.model || 'hermes'} onChange={async e => { const m = e.target.value; setActiveConv(p => p ? { ...p, model: m } : p); await fetch(`/api/chat/${activeConv.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) }) }} className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40">
                  <option value="hermes">Hermes</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Cron Context Picker ── */}
        {showCronPicker && activeConv && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] max-h-[250px] overflow-y-auto overflow-x-hidden flex-shrink-0" style={{ overscrollBehavior: 'contain' }}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-[var(--text-secondary)]">Attach Cron Job</h4>
              <button onClick={() => setShowCronPicker(false)}><X className="w-3.5 h-3.5 text-[var(--text-muted)]" /></button>
            </div>
            {cronJobs.map(job => {
              const attached = (activeConv.cron_context || []).some(c => c.id === job.id)
              return (
                <div key={job.id} onClick={() => toggleCronContext(job)} className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all border ${attached ? 'bg-[var(--purple)]/5 border-[var(--purple)]/20' : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}>
                  <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center ${attached ? 'bg-[var(--purple)] border-[var(--purple)]' : 'border-[var(--text-muted)]'}`}>
                    {attached && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">{job.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{job.schedule_display || job.schedule}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Error Banner ── */}
        {error && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 flex items-center gap-2 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
            <p className="text-xs text-[var(--danger)] flex-1">{error}</p>
            <button onClick={() => setError(null)}><X className="w-3.5 h-3.5 text-[var(--danger)]" /></button>
          </div>
        )}

        {/* ── Messages Area
            This is the scrollable zone. Key CSS:
            - flex-1 + min-h-0: allows it to shrink and grow within the flex parent
            - overflow-y: scroll (not auto): always enables scrolling, even when content fits
            - overscroll-behavior: contain: prevents scroll chaining to parent/body
            - Webkit-overflow-scrolling: touch: smooth momentum scroll on iOS
            - The ref is used for programmatic scroll-to-bottom */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden overscroll-contain px-4 py-4"
          style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        >
          {!activeConv ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--purple)]/20 blur-xl" />
                <div className="relative w-20 h-20 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                  <Bot className="w-10 h-10 text-[var(--accent)]" />
                </div>
              </div>
              <h2 className="text-lg font-bold gradient-text mb-2">Chat with Hermes</h2>
              <p className="text-sm text-[var(--text-muted)] text-center max-w-md mb-2">Real-time streaming with thinking blocks, tool calls, and live approval.</p>
              <p className="text-xs text-[var(--text-muted)] text-center max-w-md mb-6">Type <code className="px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--accent)] font-mono">/help</code> for available commands.</p>
              <button onClick={createConversation} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Start Conversation
              </button>
            </div>
          ) : (activeConv.messages || []).length === 0 && !sending ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Sparkles className="w-12 h-12 text-[var(--accent)]/30 mb-4" />
              <p className="text-sm text-[var(--text-muted)]">Send a message to start</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Thinking blocks and tool calls appear in real-time</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Completed messages */}
              {(activeConv.messages || []).map(msg => (
                <div key={msg.id} className={`animate-slide-up group ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20' : 'bg-[var(--bg-card)] border border-[var(--border)]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-[var(--accent)]" /> : <Bot className="w-3.5 h-3.5 text-[var(--purple)]" />}
                      <span className={`text-[10px] font-medium ${msg.role === 'user' ? 'text-[var(--accent)]' : 'text-[var(--purple)]'}`}>{msg.role === 'user' ? 'You' : 'Hermes'}</span>
                      {msg.model && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">{msg.model}</span>}
                    </div>
                    {msg.reasoning && (
                      <details className="mb-2">
                        <summary className="text-[10px] text-[var(--text-muted)] cursor-pointer flex items-center gap-1"><Brain className="w-3 h-3" /> Thinking...</summary>
                        <div className="mt-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border)]">
                          <p className="text-[11px] text-[var(--text-muted)] italic whitespace-pre-wrap">{msg.reasoning}</p>
                        </div>
                      </details>
                    )}
                    <div className="text-sm text-[var(--text-secondary)] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-[var(--border)]/50">
                      <span className="text-[9px] text-[var(--text-muted)]">{timeAgo(msg.created_at)}</span>
                      {msg.duration_ms && <span className="text-[9px] text-[var(--text-muted)]">{(msg.duration_ms / 1000).toFixed(1)}s</span>}
                      {msg.tokens_out && <span className="text-[9px] text-[var(--text-muted)]">{msg.tokens_out} tokens</span>}
                      <button onClick={() => copyMessage(msg.content, msg.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Live streaming message */}
              {sending && (streaming.content || streaming.reasoning || streaming.toolCalls.length > 0 || streaming.status === 'thinking') && (
                <LiveAssistantMessage
                  streaming={streaming}
                  onApproveTool={approveToolCall}
                  onRejectTool={rejectToolCall}
                />
              )}

              {/* Scroll anchor — always at the very bottom */}
              <div ref={messagesEndRef} className="h-1 flex-shrink-0" />
            </div>
          )}
        </div>

        {/* ── Input Area (pinned bottom, never shrinks) ── */}
        {activeConv && (
          <div className="px-4 py-3 border-t border-[var(--border)] flex-shrink-0 bg-[var(--bg-secondary)]/90 backdrop-blur-xl">
            {attachedFiles.length > 0 && (
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <FileText className="w-3 h-3 text-[var(--accent)]" />
                {attachedFiles.map((f, i) => (
                  <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center gap-1">
                    {f.name} ({(f.size / 1024).toFixed(1)}KB)
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-[var(--danger)]"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
            {activeConv.cron_context?.length > 0 && (
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <Clock className="w-3 h-3 text-[var(--purple)]" />
                {activeConv.cron_context.map(ctx => (
                  <span key={ctx.id} className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--purple)]/10 text-[var(--purple)] border border-[var(--purple)]/20 flex items-center gap-1">
                    {ctx.name}
                    <button onClick={() => toggleCronContext(ctx as unknown as CronJob)} className="hover:text-[var(--danger)]"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all" title="Attach files">
                  <Paperclip className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" className="hidden" multiple onChange={e => { const files = Array.from(e.target.files || []); if (files.length > 0) setAttachedFiles(prev => [...prev, ...files]); e.target.value = '' }} />
                <button onClick={() => { setShowCronPicker(!showCronPicker); setShowSettings(false) }} className={`p-2 rounded-lg transition-all ${showCronPicker ? 'text-[var(--purple)] bg-[var(--purple)]/10' : 'text-[var(--text-muted)] hover:text-[var(--purple)] hover:bg-[var(--purple)]/10'}`} title="Attach cron job">
                  <Clock className="w-4 h-4" />
                </button>
              </div>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && (input.trim() || attachedFiles.length > 0)) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder={sending ? 'Streaming...' : 'Type a message... (/help for commands)'}
                rows={1}
                disabled={sending}
                className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 resize-none max-h-[200px] disabled:opacity-50"
                style={{ minHeight: '42px' }}
              />
              {sending ? (
                <button onClick={cancelStreaming} className="p-2.5 rounded-xl bg-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)]/30 transition-colors flex-shrink-0" title="Cancel">
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={sendMessage} disabled={!input.trim() && attachedFiles.length === 0} className="p-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-lg shadow-black/30 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
          <span className="text-sm text-[var(--text-primary)]">{toast}</span>
        </div>
      )}
    </div>
  )
}
