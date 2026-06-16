'use client'

import { Plus, Trash2, MessageSquare, Search, X } from 'lucide-react'
import { timeAgo } from './utils'
import type { Conversation } from './types'

interface ChatSidebarProps {
  conversations: Conversation[]
  activeConvId: string | null
  convSearch: string
  onConvSearchChange: (value: string) => void
  editingTitle: string | null
  titleValue: string
  onTitleValueChange: (value: string) => void
  onSaveTitle: () => void
  onSetEditingTitle: (id: string | null) => void
  onSelectConversation: (id: string) => void
  onCreateConversation: () => void
  onDeleteConversation: (id: string) => void
}

export function ChatSidebar({
  conversations,
  activeConvId,
  convSearch,
  onConvSearchChange,
  editingTitle,
  titleValue,
  onTitleValueChange,
  onSaveTitle,
  onSetEditingTitle,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
}: ChatSidebarProps) {
  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  const filteredConversations = convSearch.trim()
    ? sortedConversations.filter(c => {
        const q = convSearch.toLowerCase()
        return c.title.toLowerCase().includes(q) ||
          c.messages?.some(m => m.content.toLowerCase().includes(q))
      })
    : sortedConversations

  return (
    <>
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold gradient-text">Conversations</h2>
        <button onClick={onCreateConversation} className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>
      {sortedConversations.length > 0 && (
        <div className="px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={convSearch}
              onChange={e => onConvSearchChange(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
            />
            {convSearch && (
              <button onClick={() => onConvSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
            <p className="text-xs text-[var(--text-muted)]">{convSearch ? 'No matching conversations' : 'No conversations yet'}</p>
            {!convSearch && <button onClick={onCreateConversation} className="mt-3 text-xs text-[var(--accent)] hover:underline">Start one</button>}
          </div>
        ) : filteredConversations.map(conv => (
          <div key={conv.id} onClick={() => onSelectConversation(conv.id)} className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeConvId === conv.id ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20' : 'hover:bg-[var(--bg-card)] border border-transparent'}`}>
            <MessageSquare className={`w-4 h-4 flex-shrink-0 ${activeConvId === conv.id ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
            <div className="flex-1 min-w-0">
              {editingTitle === conv.id ? (
                <input
                  autoFocus
                  value={titleValue}
                  onChange={e => onTitleValueChange(e.target.value)}
                  onBlur={onSaveTitle}
                  onKeyDown={e => { if (e.key === 'Enter') onSaveTitle(); if (e.key === 'Escape') onSetEditingTitle(null) }}
                  onClick={e => e.stopPropagation()}
                  className="w-full text-xs font-medium bg-[var(--bg-primary)] border border-[var(--accent)]/40 rounded px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none"
                />
              ) : (
                <p
                  className={`text-xs font-medium truncate ${activeConvId === conv.id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
                  onDoubleClick={e => { e.stopPropagation(); onSetEditingTitle(conv.id); onTitleValueChange(conv.title) }}
                  title="Double-click to rename"
                >
                  {conv.title}
                </p>
              )}
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {timeAgo(conv.updated_at)}
                {conv.cron_context?.length > 0 && <span className="ml-1.5 text-[var(--purple)]">⏱ {conv.cron_context.length}</span>}
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id) }} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] transition-all min-w-[44px] min-h-[44px] flex items-center justify-center p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
