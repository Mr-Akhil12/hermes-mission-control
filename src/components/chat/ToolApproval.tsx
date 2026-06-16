'use client'

import { useState } from 'react'
import {
  Loader2, ShieldCheck, ShieldX, ChevronDown, ChevronRight,
  Brain, Bot, AlertTriangle, CheckCircle2, Wrench,
} from 'lucide-react'
import { renderMarkdown } from './utils'
import type { ToolCall, StreamingState } from './types'

// ─── Tool Call Card ───
export function ToolCallCard({
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
              {tool.approvalCountdown}s
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
export function LiveAssistantMessage({
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
