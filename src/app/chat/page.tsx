'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Loader2, Plus, Trash2, Send, Clock, Settings, MessageSquare,
  AlertTriangle, Copy, Check, Paperclip, Brain, RefreshCw, X,
  Sparkles, Bot, User, FileText, CheckCircle2
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

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
      setTimeout(scrollToBottom, 100)
    } catch { /* ignore */ }
  }, [scrollToBottom])

  const loadCronJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/cron')
      if (res.ok) setCronJobs(await res.json() || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => { loadCronJobs() }, [loadCronJobs])

  useEffect(() => {
    const channel = supabase
      .channel('chat-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, loadConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (activeConv && payload.new && (payload.new as Message).conversation_id === activeConv.id) {
          loadConversation(activeConv.id)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadConversations, loadConversation, activeConv])

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

  const sendMessage = async () => {
    if (!activeConv || (!input.trim() && attachedFiles.length === 0) || sending) return
    const userMessage = input.trim()
    setInput('')
    setSending(true)
    setError(null)

    // Upload files first
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

    // Build message content with file references
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

    try {
      const res = await fetch(`/api/chat/${activeConv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fullContent,
          thinking_mode: activeConv.thinking_mode,
          files: uploadedFiles,
        }),
      })

      const data = await res.json()

      // Handle slash command responses
      if (data.action) {
        setToast(data.message)
        setTimeout(() => setToast(null), 3000)
        // Refresh conversation to reflect changes
        await loadConversation(activeConv.id)
        setSending(false)
        return
      }

      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
      await loadConversation(activeConv.id)
      await loadConversations()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send')
      setActiveConv(prev => prev ? { ...prev, messages: prev.messages?.filter(m => !m.id.startsWith('temp-')) || [] } : prev)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter alone = newline. Send button only.
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

  // Conversation list content (shared between mobile and desktop)
  const conversationListContent = (
    <>
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold gradient-text">Conversations</h2>
        <button onClick={createConversation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
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

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
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

  return (
    <div className="flex -mt-14 md:mt-0 -mx-4 md:-mx-6 lg:-mx-8 -mb-4 md:-mb-6 lg:-mb-8" style={{ height: 'calc(100dvh + 56px)' }}>
      {/* ─── Mobile Sidebar (overlay) ─── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setSidebarOpen(false)}>
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

      {/* ─── Main Chat Area ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="px-3 py-2.5 flex items-center gap-3 flex-shrink-0 border-b border-[var(--border)]">
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
                </div>
              </div>
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

        {/* Settings Panel */}
        {showSettings && activeConv && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
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

        {/* Cron Context Picker */}
        {showCronPicker && activeConv && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] max-h-[250px] overflow-y-auto">
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

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
            <p className="text-xs text-[var(--danger)] flex-1">{error}</p>
            <button onClick={() => setError(null)}><X className="w-3.5 h-3.5 text-[var(--danger)]" /></button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!activeConv ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--purple)]/20 blur-xl" />
                <div className="relative w-20 h-20 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
                  <Bot className="w-10 h-10 text-[var(--accent)]" />
                </div>
              </div>
              <h2 className="text-lg font-bold gradient-text mb-2">Chat with Hermes</h2>
              <p className="text-sm text-[var(--text-muted)] text-center max-w-md mb-6">Start a conversation with your AI assistant. Attach cron job context, adjust system prompts, and switch models.</p>
              <button onClick={createConversation} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
                <Plus className="w-4 h-4" /> Start Conversation
              </button>
            </div>
          ) : (activeConv.messages || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Sparkles className="w-12 h-12 text-[var(--accent)]/30 mb-4" />
              <p className="text-sm text-[var(--text-muted)]">Send a message to start</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
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
              {sending && (
                <div className="flex justify-start animate-slide-up">
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 text-[var(--purple)]" />
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-[var(--purple)] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {activeConv && (
          <div className="px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
            {/* Attached files */}
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
            {/* Cron context indicators */}
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
              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type a message..." rows={1} className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 resize-none max-h-[200px]" style={{ minHeight: '42px' }} />
              <button onClick={sendMessage} disabled={(!input.trim() && attachedFiles.length === 0) || sending} className="p-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-lg shadow-black/30 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
          <span className="text-sm text-[var(--text-primary)]">{toast}</span>
        </div>
      )}
    </div>
  )
}
