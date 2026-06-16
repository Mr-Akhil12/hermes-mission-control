'use client'

// v2 — cache bust for chat page rebuild
import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, MessageSquare, CheckCircle2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { useMessageStream } from '@/components/chat/MessageStream'
import type { Conversation, Message, StreamingState, CronJob, CronContextItem } from '@/components/chat/types'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Main Chat Page ───
function ChatPageInner() {
  const searchParams = useSearchParams()
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
  const [convSearch, setConvSearch] = useState('')
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [titleValue, setTitleValue] = useState('')

  const [streaming, setStreaming] = useState<StreamingState>({
    content: '',
    reasoning: '',
    toolCalls: [],
    status: 'idle',
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
      setIsNearBottom(true)
    }
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsNearBottom(distanceFromBottom < 100)
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

  // Auto-open conversation from ?conv= query param (e.g. from cron page)
  useEffect(() => {
    const convId = searchParams.get('conv')
    if (convId && !activeConv) {
      loadConversation(convId)
    }
  }, [searchParams, loadConversation, activeConv])

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

  // ─── Stream completion callback ───
  const handleStreamComplete = useCallback(async (conversationId: string) => {
    await loadConversation(conversationId)
    await loadConversations()
  }, [loadConversation, loadConversations])

  // ─── Message Stream Hook ───
  const { startStreaming, cancel } = useMessageStream({
    setStreaming,
    setError,
    setActiveConv,
    onStreamComplete: handleStreamComplete,
    scrollToEnd: scrollToBottom,
  })

  // ─── Send Message ───
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

    try {
      await startStreaming({
        conversationId: activeConv.id,
        content: fullContent,
        thinkingMode: activeConv.thinking_mode,
        files: uploadedFiles,
      })
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  // ─── Cancel streaming ───
  const cancelStreaming = () => {
    cancel()
    setStreaming({ content: '', reasoning: '', toolCalls: [], status: 'idle' })
    setSending(false)
  }

  // ─── Retry last failed message ───
  const retryMessage = useCallback(() => {
    if (!activeConv || sending) return
    const messages = activeConv.messages || []
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        const lastAssistantIdx = messages.findIndex((m, idx) => idx > i && m.role === 'assistant')
        if (lastAssistantIdx !== -1) {
          setActiveConv(prev => prev ? {
            ...prev,
            messages: prev.messages?.filter((_, idx) => idx !== lastAssistantIdx) || []
          } : prev)
        }
        setInput(messages[i].content)
        setTimeout(() => textareaRef.current?.focus(), 50)
        return
      }
    }
  }, [activeConv, sending])

  // ─── Tool approval countdown timer ───
  useEffect(() => {
    if (streaming.status !== 'tool_wait') return
    const interval = setInterval(() => {
      setStreaming(prev => {
        const updated = prev.toolCalls.map(tc => {
          if (tc.status === 'pending' && tc.approvalCountdown !== undefined && tc.approvalCountdown > 0) {
            return { ...tc, approvalCountdown: tc.approvalCountdown - 1 }
          }
          return tc
        })
        const stillPending = updated.some(tc => tc.status === 'pending')
        return {
          ...prev,
          toolCalls: updated,
          status: stillPending ? 'tool_wait' as const : prev.status,
        }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [streaming.status])

  // ─── Other handlers ───
  const toggleCronContext = async (jobOrCtx: CronJob | CronContextItem) => {
    if (!activeConv) return
    const job = jobOrCtx as CronJob
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

  const updateModel = async (model: string) => {
    if (!activeConv) return
    setActiveConv(prev => prev ? { ...prev, model } : prev)
    await fetch(`/api/chat/${activeConv.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
  }

  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const startEditTitle = () => {
    if (!activeConv) return
    setEditingTitle(activeConv.id)
    setTitleValue(activeConv.title)
  }

  const saveTitle = async () => {
    if (!activeConv || !titleValue.trim()) { setEditingTitle(null); return }
    const newTitle = titleValue.trim()
    setActiveConv(prev => prev ? { ...prev, title: newTitle } : prev)
    setEditingTitle(null)
    await fetch(`/api/chat/${activeConv.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) })
    await loadConversations()
  }

  const toggleThinkingMode = async () => {
    if (!activeConv) return
    const newMode = !activeConv.thinking_mode
    setActiveConv(prev => prev ? { ...prev, thinking_mode: newMode } : prev)
    await fetch(`/api/chat/${activeConv.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thinking_mode: newMode }) })
    setToast(`Thinking mode ${newMode ? 'enabled' : 'disabled'}`)
    setTimeout(() => setToast(null), 2000)
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[var(--bg-primary)] flex items-center justify-center" style={{ zIndex: 50 }}>
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
    <div className="fixed inset-0 z-50 flex flex-row bg-[var(--bg-primary)]" style={{ height: '100dvh' }}>
      {/* ─── Mobile Sidebar (overlay) ─── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[100] md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col" onClick={e => e.stopPropagation()}>
            <ChatSidebar
              conversations={conversations}
              activeConvId={activeConv?.id || null}
              convSearch={convSearch}
              onConvSearchChange={setConvSearch}
              editingTitle={editingTitle}
              titleValue={titleValue}
              onTitleValueChange={setTitleValue}
              onSaveTitle={saveTitle}
              onSetEditingTitle={setEditingTitle}
              onSelectConversation={loadConversation}
              onCreateConversation={createConversation}
              onDeleteConversation={deleteConversation}
            />
          </div>
        </div>
      )}

      {/* ─── Desktop Sidebar ─── */}
      <div className="hidden md:flex w-[280px] lg:w-[300px] shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex-col">
        <ChatSidebar
          conversations={conversations}
          activeConvId={activeConv?.id || null}
          convSearch={convSearch}
          onConvSearchChange={setConvSearch}
          editingTitle={editingTitle}
          titleValue={titleValue}
          onTitleValueChange={setTitleValue}
          onSaveTitle={saveTitle}
          onSetEditingTitle={setEditingTitle}
          onSelectConversation={loadConversation}
          onCreateConversation={createConversation}
          onDeleteConversation={deleteConversation}
        />
      </div>

      {/* ─── Main Chat Area ─── */}
      <ChatWindow
        activeConv={activeConv}
        sending={sending}
        streaming={streaming}
        error={error}
        input={input}
        attachedFiles={attachedFiles}
        showSettings={showSettings}
        showCronPicker={showCronPicker}
        cronJobs={cronJobs}
        isNearBottom={isNearBottom}
        copiedId={copiedId}
        onInputChange={setInput}
        onSend={sendMessage}
        onCancel={cancelStreaming}
        onRetry={retryMessage}
        onSetError={setError}
        onSetAttachedFiles={setAttachedFiles}
        onSetShowSettings={setShowSettings}
        onSetShowCronPicker={setShowCronPicker}
        onScrollToBottom={scrollToBottom}
        onCopyMessage={copyMessage}
        onToggleThinkingMode={toggleThinkingMode}
        onToggleCronContext={toggleCronContext}
        onUpdateSystemPrompt={updateSystemPrompt}
        onUpdateModel={updateModel}
        onStartEditTitle={startEditTitle}
        onToggleSidebar={() => setSidebarOpen(true)}
        onCreateConversation={createConversation}
        onApproveTool={approveToolCall}
        onRejectTool={rejectToolCall}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        scrollContainerRef={scrollContainerRef}
        messagesEndRef={messagesEndRef}
        onScroll={handleScroll}
      />

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

export default function ChatPage() {
  return (
    <Suspense fallback={
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
    }>
      <ChatPageInner />
    </Suspense>
  )
}
