'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Gamepad2, Box, Paintbrush, Volume2, Wrench, Users,
  ExternalLink, Plus, RefreshCw, Loader2, Trash2, Pencil,
  Package, Trophy, BookOpen, GitBranch, ChevronDown, ChevronUp,
  HardDrive, Layers, FileText
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { getCsrfToken } from '@/lib/csrf-client'

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

interface DhcItem {
  id: string
  name: string
  description: string | null
  category: string | null
  status: string
  url: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/* ────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Package },
  { id: 'model', label: '3D Models', icon: Box },
  { id: 'texture', label: 'Textures', icon: Paintbrush },
  { id: 'sound', label: 'Sound', icon: Volume2 },
  { id: 'build', label: 'Builds', icon: Wrench },
  { id: 'milestone', label: 'Milestones', icon: Trophy },
  { id: 'link', label: 'Links', icon: ExternalLink },
  { id: 'team', label: 'Team', icon: Users },
]

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'accent' | 'neutral' }> = {
  'idea': { label: 'Idea', variant: 'accent' },
  'in-progress': { label: 'In Progress', variant: 'warning' },
  'done': { label: 'Done', variant: 'success' },
}

const CATEGORY_ICONS: Record<string, typeof Box> = {
  model: Box,
  texture: Paintbrush,
  sound: Volume2,
  build: Wrench,
  team: Users,
  link: ExternalLink,
  milestone: Trophy,
}

/* ────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────── */

export default function DirtHandsCrewPage() {
  const [items, setItems] = useState<DhcItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeStatus, setActiveStatus] = useState('all')
  const [showNewModal, setShowNewModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingItem, setEditingItem] = useState<DhcItem | null>(null)
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('model')
  const [formStatus, setFormStatus] = useState('idea')
  const [formUrl, setFormUrl] = useState('')

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (activeCategory !== 'all') params.set('category', activeCategory)
      if (activeStatus !== 'all') params.set('status', activeStatus)
      const res = await fetch(`/api/dirt-hands-crew?${params}`)
      const data = await res.json()
      if (data.tableExists === false) {
        setItems([])
        setError('Table not yet created. Run the migration SQL first.')
      } else if (data.error) {
        setError(data.error)
      } else {
        setItems(data.items ?? [])
      }
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [activeCategory, activeStatus])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormCategory('model')
    setFormStatus('idea')
    setFormUrl('')
  }

  const openNewModal = () => {
    resetForm()
    setEditingItem(null)
    setShowNewModal(true)
  }

  const openEditModal = (item: DhcItem) => {
    setEditingItem(item)
    setFormName(item.name)
    setFormDescription(item.description || '')
    setFormCategory(item.category || 'model')
    setFormStatus(item.status || 'idea')
    setFormUrl(item.url || '')
    setShowNewModal(true)
  }

  const handleSubmit = async () => {
    try {
      setCreating(true)
      const payload = {
        name: formName || 'Untitled',
        description: formDescription || '',
        category: formCategory,
        status: formStatus,
        url: formUrl || '',
      }

      if (editingItem) {
        const res = await fetch('/api/dirt-hands-crew', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        })
        const data = await res.json()
        if (data.item) {
          setItems(prev => prev.map(i => i.id === editingItem.id ? data.item : i))
          setShowNewModal(false)
          setEditingItem(null)
          resetForm()
        }
      } else {
        const res = await fetch('/api/dirt-hands-crew', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.item) {
          setItems(prev => [data.item, ...prev])
          setShowNewModal(false)
          resetForm()
        }
      }
    } catch {
      // CSRF interceptor handles token automatically
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/dirt-hands-crew?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setItems(prev => prev.filter(i => i.id !== id))
      }
    } catch {
      // CSRF interceptor handles token
    }
  }

  const filteredItems = items.filter(item => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false
    if (activeStatus !== 'all' && item.status !== activeStatus) return false
    return true
  })

  // Derived stats
  const models = items.filter(i => i.category === 'model')
  const textures = items.filter(i => i.category === 'texture')
  const sounds = items.filter(i => i.category === 'sound')
  const builds = items.filter(i => i.category === 'build')
  const milestones = items.filter(i => i.category === 'milestone')
  const inProgressCount = items.filter(i => i.status === 'in-progress').length
  const doneCount = items.filter(i => i.status === 'done').length
  const totalCount = items.length

  return (
    <div className="space-y-8 animate-slide-up">
      {/* ─── Hero Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
            <Gamepad2 className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Dirt Hands Crew</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">JDM Racing Game — Development Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchItems()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
            }}
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* ─── Project Overview Panel ─── */}
      <div className="glass-panel rounded-2xl border border-[var(--border)] p-5 animate-slide-up" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-2 mb-3">
          <Gamepad2 className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold gradient-text">Project Overview</h2>
          <Badge variant="success" size="sm">Active</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Dirt Hands Crew is a viral JDM car driving mobile game — inspired by TikTok&apos;s @dirtyhandscrew.brush.
              Featuring car customization, drift mechanics, and social features built on Flutter + Flame engine.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-xl bg-[var(--bg-elevated)]">
              <p className="text-2xl font-bold gradient-text">{totalCount}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total Assets</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-[var(--bg-elevated)]">
              <p className="text-2xl font-bold gradient-text">{inProgressCount}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">In Progress</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-[var(--bg-elevated)]">
              <p className="text-2xl font-bold text-[var(--success)]">{doneCount}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Completed</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-[var(--bg-elevated)]">
              <p className="text-2xl font-bold text-amber-400">{milestones.length}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Milestones</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Asset Breakdown Stats ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 stagger">
        <StatCard
          label="3D Models"
          count={models.length}
          doneCount={models.filter(i => i.status === 'done').length}
          icon={Box}
          color="blue"
          delay={0}
        />
        <StatCard
          label="Textures"
          count={textures.length}
          doneCount={textures.filter(i => i.status === 'done').length}
          icon={Paintbrush}
          color="purple"
          delay={60}
        />
        <StatCard
          label="Sounds"
          count={sounds.length}
          doneCount={sounds.filter(i => i.status === 'done').length}
          icon={Volume2}
          color="green"
          delay={120}
        />
        <StatCard
          label="Builds"
          count={builds.length}
          doneCount={builds.filter(i => i.status === 'done').length}
          icon={Wrench}
          color="red"
          delay={180}
        />
      </div>

      {/* ─── Quick Links ─── */}
      <div className="glass-panel rounded-2xl border border-[var(--border)] p-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
        <div className="flex items-center gap-2 mb-4">
          <ExternalLink className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold gradient-text">Quick Links</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink href="https://github.com/dirtyhandscrew" icon={GitBranch} label="GitHub Repo" />
          <QuickLink href="#" icon={HardDrive} label="Build Artifacts" />
          <QuickLink href="#" icon={BookOpen} label="Dev Logs" />
          <QuickLink href="#" icon={Layers} label="Design Docs" />
        </div>
      </div>

      {/* ─── Category Tabs ─── */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          const active = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] whitespace-nowrap transition-all ${
                active
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium'
                  : 'text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              {cat.id !== 'all' && (
                <span className="text-[10px] text-[var(--text-muted)]">
                  ({items.filter(i => i.category === cat.id).length})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Status Filter ─── */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Status:</span>
        {['all', 'idea', 'in-progress', 'done'].map(s => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all ${
              activeStatus === s
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {s === 'all' ? 'All' : s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* ─── Error Banner ─── */}
      {error && (
        <div className="glass-panel rounded-2xl border border-[var(--danger)]/20 p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--danger)]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[var(--danger)] text-sm">!</span>
          </div>
          <div>
            <p className="text-sm text-[var(--text-primary)]">{error}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Run the migration SQL from the API route file in your Supabase SQL editor.
            </p>
          </div>
        </div>
      )}

      {/* ─── Items List ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
      ) : filteredItems.length === 0 && !error ? (
        <div className="glass-panel rounded-2xl border border-[var(--border)] p-12 text-center">
          <Gamepad2 className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-4 opacity-30" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">No items yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
            Add your first asset, build, or milestone to track progress.
          </p>
          <button
            onClick={openNewModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' }}
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      ) : (
        <div className="space-y-2 stagger">
          {filteredItems.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              expanded={expandedItem === item.id}
              onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              onEdit={() => openEditModal(item)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {/* ─── Milestone Timeline ─── */}
      {milestones.length > 0 && (
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '360ms' }}>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold gradient-text">Milestones</h2>
          </div>
          <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="divide-y divide-[var(--border)]">
              {milestones.map(m => {
                const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.idea
                return (
                  <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      m.status === 'done' ? 'bg-[var(--success)]' :
                      m.status === 'in-progress' ? 'bg-[var(--warning)] animate-pulse' :
                      'bg-[var(--accent)]/40'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{m.name}</span>
                        <Badge variant={st.variant} size="sm">{st.label}</Badge>
                      </div>
                      {m.description && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{m.description}</p>
                      )}
                    </div>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── New/Edit Modal ─── */}
      {showNewModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !creating && setShowNewModal(false)} />
          <div className="relative glass-panel-solid rounded-2xl border border-[var(--border)] p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-bold gradient-text mb-4">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Honda Civic Model"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Details about this item..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/30 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Category</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/30 transition-all"
                  >
                    {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Status</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500/30 transition-all"
                  >
                    <option value="idea">Idea</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">URL (optional)</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/30 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => { !creating && setShowNewModal(false); setEditingItem(null) }}
                className="px-4 py-2 rounded-xl text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={creating || !formName.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' }}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : editingItem ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────── */

function StatCard({ label, count, doneCount, icon: Icon, color, delay }: {
  label: string
  count: number
  doneCount: number
  icon: typeof Box
  color: 'blue' | 'green' | 'red' | 'purple'
  delay: number
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-[var(--accent)]/20 to-transparent text-[var(--accent)]',
    green: 'from-[var(--success)]/20 to-transparent text-[var(--success)]',
    red: 'from-[var(--danger)]/20 to-transparent text-[var(--danger)]',
    purple: 'from-[var(--purple)]/20 to-transparent text-[var(--purple)]',
  }
  const gradientClass = colorMap[color] || colorMap.blue

  return (
    <div
      className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${gradientClass} opacity-30 blur-2xl group-hover:opacity-50 transition-opacity`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">{label}</span>
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        </div>
        <p className="text-3xl font-bold gradient-text mb-1">{count}</p>
        <p className="text-xs text-[var(--text-muted)]">{doneCount} completed</p>
      </div>
    </div>
  )
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof ExternalLink; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] transition-all group"
    >
      <Icon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-amber-400 transition-colors" />
      <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{label}</span>
      <ExternalLink className="w-3 h-3 text-[var(--text-muted)] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  )
}

function ItemRow({ item, expanded, onToggle, onEdit, onDelete }: {
  item: DhcItem
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.idea
  const CatIcon = CATEGORY_ICONS[item.category || ''] || Package
  const catLabel = CATEGORIES.find(c => c.id === item.category)?.label || item.category || 'Other'

  return (
    <div className="glass-panel rounded-xl border border-[var(--border)] overflow-hidden card-hover group animate-slide-up">
      <div className="flex items-center gap-4 px-4 py-3">
        <button onClick={onToggle} className="flex-shrink-0 p-1 rounded-lg hover:bg-[var(--bg-elevated)] transition-all">
          {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
        </button>
        <div className="w-9 h-9 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
          <CatIcon className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</span>
            <Badge variant={st.variant} size="sm">{st.label}</Badge>
            <Badge variant="neutral" size="sm">{catLabel}</Badge>
          </div>
          {item.description && !expanded && (
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{item.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-400 hover:bg-amber-400/10 transition-all"
              title="Open link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={onEdit} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-5 pb-4 pt-1 border-t border-[var(--border)]">
          {item.description && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">{item.description}</p>
          )}
          <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
            <span>Created: {new Date(item.created_at).toLocaleDateString()}</span>
            <span>Updated: {new Date(item.updated_at).toLocaleDateString()}</span>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                View URL →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
