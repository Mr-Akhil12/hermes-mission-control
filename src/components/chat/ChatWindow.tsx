'use client'

import { useEffect, useCallback } from 'react'
import {
  Loader2, Send, Clock, Settings, AlertTriangle, Copy, Check,
  Paperclip, Brain, RefreshCw, X, Sparkles, Bot, User, FileText,
  ChevronDown, ChevronRight, ArrowDown, MessageSquare, Pencil, Plus,
} from 'lucide-react'
import { timeAgo, renderMarkdown } from './utils'
import { LiveAssistantMessage } from './ToolApproval'
import type { Conversation, StreamingState, CronJob, CronContextItem } from './types'

interface ChatWindowProps {
  activeConv: Conversation | null
  sending: boolean
  streaming: StreamingState
  error: string | null
  input: string
  attachedFiles: File[]
  showSettings: boolean
  showCronPicker: boolean
  cronJobs: CronJob[]
  isNearBottom: boolean
  copiedId: string | null

  onInputChange: (value: string) => void
  onSend: () => void
  onCancel: () => void
  onRetry: () => void
  onSetError: (error: string | null) => void
  onSetAttachedFiles: React.Dispatch<React.SetStateAction<File[]>>
  onSetShowSettings: (show: boolean) => void
  onSetShowCronPicker: (show: boolean) => void
  onScrollToBottom: () => void
  onCopyMessage: (content: string, id: string) => void
  onToggleThinkingMode: () => void
  onToggleCronContext: (job: CronJob | CronContextItem) => void
  onUpdateSystemPrompt: (prompt: string) => void
  onUpdateModel: (model: string) => void
  onStartEditTitle: () => void
  onToggleSidebar: () => void
  onCreateConversation: () => void
  onApproveTool: (callId: string) => void
  onRejectTool: (callId: string) => void

  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>

  onScroll: () => void
}

export function ChatWindow({
  activeConv,
  sending,
  streaming,
  error,
  input,
  attachedFiles,
  showSettings,
  showCronPicker,
  cronJobs,
  isNearBottom,
  copiedId,
  onInputChange,
  onSend,
  onCancel,
  onRetry,
  onSetError,
  onSetAttachedFiles,
  onSetShowSettings,
  onSetShowCronPicker,
  onScrollToBottom,
  onCopyMessage,
  onToggleThinkingMode,
  onToggleCronContext,
  onUpdateSystemPrompt,
  onUpdateModel,
  onStartEditTitle,
  onToggleSidebar,
  onCreateConversation,
  onApproveTool,
  onRejectTool,
  textareaRef,
  fileInputRef,
  scrollContainerRef,
  messagesEndRef,
  onScroll,
}: ChatWindowProps) {
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input, textareaRef])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && (input.trim() || attachedFiles.length > 0)) {
      e.preventDefault()
      onSend()
    } else if (e.key === 'Escape' && sending) {
      onCancel()
    }
  }, [input, attachedFiles.length, sending, onSend, onCancel])

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* ── Chat Header (pinned top, never shrinks) ── */}
      <div className="px-3 py-2.5 flex items-center gap-3 flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg-secondary)]/90 backdrop-blur-xl group">
        <div className="flex items-center gap-1.5">
          <a href="/" className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Back to Dashboard">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <button onClick={onToggleSidebar} className="md:hidden min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center hover:bg-[var(--bg-card)] text-[var(--text-muted)]">
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        {activeConv ? (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate" title="Double-click to rename">{activeConv.title}</h3>
                <button onClick={onStartEditTitle} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all hidden md:block min-w-[44px] min-h-[44px] flex items-center justify-center" title="Rename">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-[var(--text-muted)]">{activeConv.messages?.length || 0} messages</span>
                {activeConv.cron_context?.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--purple)]/10 text-[var(--purple)] border border-[var(--purple)]/20">⏱ {activeConv.cron_context.length}</span>}
                {activeConv.thinking_mode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--purple)]/10 text-[var(--purple)] border border-[var(--purple)]/20 flex items-center gap-1"><Brain className="w-2.5 h-2.5" /> Thinking</span>}
                {sending && streaming.status !== 'idle' && (
                  <span className="text-[10px] text-[var(--accent)] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    {streaming.status === 'thinking' ? 'Thinking' : streaming.status === 'tool_wait' ? 'Tool wait' : 'Streaming'}
                  </span>
                )}
              </div>
            </div>
            {sending && (
              <button onClick={onCancel} className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-[var(--warning)] hover:bg-[var(--warning)]/10 transition-colors" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => { onSetShowCronPicker(!showCronPicker); onSetShowSettings(false) }} className={`min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center transition-colors ${showCronPicker ? 'bg-[var(--purple)]/10 text-[var(--purple)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)]'}`} title="Attach cron job">
              <Clock className="w-5 h-5" />
            </button>
            <button onClick={onToggleThinkingMode} className={`min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center transition-colors ${activeConv.thinking_mode ? 'bg-[var(--purple)]/10 text-[var(--purple)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)]'}`} title={activeConv.thinking_mode ? 'Thinking ON — click to disable' : 'Thinking OFF — click to enable'}>
              <Brain className="w-5 h-5" />
            </button>
            <button onClick={() => { onSetShowSettings(!showSettings); onSetShowCronPicker(false) }} className={`min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center transition-colors ${showSettings ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)]'}`} title="Settings">
              <Settings className="w-5 h-5" />
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
            <button onClick={() => onSetShowSettings(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1 block">System Prompt</label>
              <textarea value={activeConv.system_prompt || ''} onChange={e => onUpdateSystemPrompt(e.target.value)} placeholder="You are Hermes..." rows={3} className="w-full px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 resize-none font-mono" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium">Model</label>
              <select value={activeConv.model || 'hermes'} onChange={e => onUpdateModel(e.target.value)} className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40">
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
            <button onClick={() => onSetShowCronPicker(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
          </div>
          {cronJobs.map(job => {
            const attached = (activeConv.cron_context || []).some(c => c.id === job.id)
            return (
              <div key={job.id} onClick={() => onToggleCronContext(job)} className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all border ${attached ? 'bg-[var(--purple)]/5 border-[var(--purple)]/20' : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}>
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
          <button onClick={onRetry} className="px-2 py-2 min-h-[44px] rounded-lg bg-[var(--danger)]/10 text-[var(--danger)] text-[10px] font-medium hover:bg-[var(--danger)]/20 transition-colors flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
          <button onClick={() => onSetError(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-4 h-4 text-[var(--danger)]" /></button>
        </div>
      )}

      {/* ── Messages Area ── */}
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
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
            <button onClick={onCreateConversation} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
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
                    <button onClick={() => onCopyMessage(msg.content, msg.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all min-w-[44px] min-h-[44px] flex items-center justify-center -m-1">
                      {copiedId === msg.id ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Live streaming message */}
            {sending && (streaming.content || streaming.reasoning || streaming.toolCalls.length > 0 || streaming.status === 'thinking') && (
              <LiveAssistantMessage
                streaming={streaming}
                onApproveTool={onApproveTool}
                onRejectTool={onRejectTool}
              />
            )}

            {/* Scroll anchor — always at the very bottom */}
            <div ref={messagesEndRef} className="h-1 flex-shrink-0" />
          </div>
        )}
      </div>

      {/* ── Scroll-to-bottom FAB ── */}
      {activeConv && !isNearBottom && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-28 right-4 z-20 min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-card)] border border-[var(--border)] shadow-lg shadow-black/20 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all md:bottom-24 md:right-6"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* ── Input Area (pinned bottom, never shrinks) ── */}
      {activeConv && (
        <div className="px-4 py-3 border-t border-[var(--border)] flex-shrink-0 bg-[var(--bg-secondary)]/90 backdrop-blur-xl">
          {attachedFiles.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <FileText className="w-3 h-3 text-[var(--accent)]" />
              {attachedFiles.map((f, i) => (
                <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center gap-1">
                  {f.name} ({(f.size / 1024).toFixed(1)}KB)
                  <button onClick={() => onSetAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-[var(--danger)]"><X className="w-2.5 h-2.5" /></button>
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
                  <button onClick={() => onToggleCronContext(ctx)} className="hover:text-[var(--danger)]"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
              <button onClick={() => fileInputRef.current?.click()} className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all" title="Attach files">
                <Paperclip className="w-4 h-4" />
              </button>
              <input ref={fileInputRef} type="file" className="hidden" multiple onChange={e => { const files = Array.from(e.target.files || []); if (files.length > 0) onSetAttachedFiles(prev => [...prev, ...files]); e.target.value = '' }} />
              <button onClick={() => { onSetShowCronPicker(!showCronPicker); onSetShowSettings(false) }} className={`min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center transition-all ${showCronPicker ? 'text-[var(--purple)] bg-[var(--purple)]/10' : 'text-[var(--text-muted)] hover:text-[var(--purple)] hover:bg-[var(--purple)]/10'}`} title="Attach cron job">
                <Clock className="w-4 h-4" />
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sending ? 'Streaming... (Esc to cancel)' : 'Type a message... ↵ Enter to send · ⇧↵ for new line · /help'}
              rows={1}
              disabled={sending}
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 resize-none max-h-[200px] disabled:opacity-50"
              style={{ minHeight: '42px' }}
            />
            {sending ? (
              <button onClick={onCancel} className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)]/30 transition-colors flex-shrink-0" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={onSend} disabled={!input.trim() && attachedFiles.length === 0} className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
