'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles, Plus, ExternalLink, Share2, Grid3X3, List,
  Gamepad2, Heart, FlaskConical, Megaphone, Rocket,
  Loader2, RefreshCw, Globe, Image as ImageIcon
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { getCsrfToken } from '@/lib/csrf-client'

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

interface FunProject {
  id: string
  name: string
  description: string | null
  category: string
  status: string
  url: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

/* ────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'websites-for-hayley', label: 'Websites for Hayley', icon: Heart },
  { id: 'mini-games', label: 'Mini Games', icon: Gamepad2 },
  { id: 'experiment', label: 'Experiments', icon: FlaskConical },
  { id: 'build-in-public', label: 'Build in Public', icon: Megaphone },
]

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'accent' }> = {
  live: { label: 'Live', variant: 'success' },
  building: { label: 'Building', variant: 'warning' },
  idea: { label: 'Idea', variant: 'accent' },
}

const CATEGORY_COLORS: Record<string, string> = {
  'websites-for-hayley': 'from-pink-500/20 to-transparent text-pink-400',
  'mini-games': 'from-purple-500/20 to-transparent text-purple-400',
  'experiment': 'from-[var(--accent)]/20 to-transparent text-[var(--accent)]',
  'build-in-public': 'from-emerald-500/20 to-transparent text-emerald-400',
}

interface QuickBuildCard {
  title: string
  description: string
  category: string
  icon: typeof Sparkles
  gradient: string
  iconBg: string
}

const QUICK_BUILDS: QuickBuildCard[] = [
  {
    title: 'Build for Hayley',
    description: 'Pre-configured romantic & beautiful template',
    category: 'websites-for-hayley',
    icon: Heart,
    gradient: 'from-pink-500/10 to-purple-500/10',
    iconBg: 'from-pink-500/20 to-purple-500/20',
  },
  {
    title: 'Mini Game',
    description: 'Simple game starter (canvas-based)',
    category: 'mini-games',
    icon: Gamepad2,
    gradient: 'from-purple-500/10 to-blue-500/10',
    iconBg: 'from-purple-500/20 to-blue-500/20',
  },
  {
    title: 'Experiment',
    description: 'Blank canvas for trying new tech',
    category: 'experiment',
    icon: FlaskConical,
    gradient: 'from-[var(--accent)]/10 to-cyan-500/10',
    iconBg: 'from-[var(--accent)]/20 to-cyan-500/20',
  },
  {
    title: 'Build in Public',
    description: 'Template for shareable project',
    category: 'build-in-public',
    icon: Megaphone,
    gradient: 'from-emerald-500/10 to-teal-500/10',
    iconBg: 'from-emerald-500/20 to-teal-500/20',
  },
]

/* ────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────── */

export default function FunProjectsPage() {
  const [projects, setProjects] = useState<FunProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showNewModal, setShowNewModal] = useState(false)
  const [creating, setCreating] = useState(false)

  // New project form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('experiment')
  const [newStatus, setNewStatus] = useState('idea')
  const [newUrl, setNewUrl] = useState('')

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (activeCategory !== 'all') params.set('category', activeCategory)
      const res = await fetch(`/api/fun-projects?${params}`)
      const data = await res.json()
      if (data.tableExists === false) {
        setProjects([])
        setError('Table not yet created. Run the migration SQL first.')
      } else if (data.error) {
        setError(data.error)
      } else {
        setProjects(data.projects ?? [])
      }
    } catch {
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [activeCategory])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = async (overrides: Partial<FunProject> = {}) => {
    try {
      setCreating(true)
      const payload = {
        name: overrides.name || newName || 'Untitled Project',
        description: overrides.description || newDescription || '',
        category: overrides.category || newCategory || 'experiment',
        status: overrides.status || newStatus || 'idea',
        url: overrides.url || newUrl || '',
      }

      const res = await fetch('/api/fun-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (data.project) {
        setProjects(prev => [data.project, ...prev])
        setShowNewModal(false)
        setNewName('')
        setNewDescription('')
        setNewCategory('experiment')
        setNewStatus('idea')
        setNewUrl('')
      }
    } catch {
      // CSRF interceptor handles token automatically
    } finally {
      setCreating(false)
    }
  }

  const shareProject = async (project: FunProject) => {
    const shareData = {
      title: project.name,
      text: project.description || `Check out ${project.name}!`,
      url: project.url || window.location.href,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled
      }
    } else if (project.url) {
      window.open(project.url, '_blank')
    } else {
      await navigator.clipboard.writeText(shareData.url)
    }
  }

  const filteredProjects = activeCategory === 'all'
    ? projects
    : projects.filter(p => p.category === activeCategory)

  return (
    <div className="space-y-8 animate-slide-up">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--purple)]/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Fun Projects</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Creative experiments & side projects</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchProjects()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
            }}
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
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
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-medium'
                  : 'text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* ─── View Toggle ─── */}
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setViewMode('grid')}
          className={`p-2 rounded-lg transition-all ${
            viewMode === 'grid'
              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-2 rounded-lg transition-all ${
            viewMode === 'list'
              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <List className="w-4 h-4" />
        </button>
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

      {/* ─── Projects Grid / List ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
        </div>
      ) : filteredProjects.length === 0 && !error ? (
        <div className="glass-panel rounded-2xl border border-[var(--border)] p-12 text-center">
          <Sparkles className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-4" />
          <p className="text-sm text-[var(--text-secondary)] font-medium">No projects yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
            Create your first fun project or use a Quick Build starter below.
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
            }}
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {filteredProjects.map(project => (
            <ProjectGridCard
              key={project.id}
              project={project}
              onShare={shareProject}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2 stagger">
          {filteredProjects.map(project => (
            <ProjectListRow
              key={project.id}
              project={project}
              onShare={shareProject}
            />
          ))}
        </div>
      )}

      {/* ─── Quick Build Section ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold gradient-text-blue">Quick Build</h2>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">One-click starters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          {QUICK_BUILDS.map(build => {
            const Icon = build.icon
            return (
              <button
                key={build.title}
                onClick={() => {
                  setNewCategory(build.category)
                  setNewName(build.title)
                  setNewDescription(build.description)
                  setNewStatus('idea')
                  setShowNewModal(true)
                }}
                className={`glass-panel rounded-2xl border border-[var(--border)] p-5 text-left card-hover group bg-gradient-to-br ${build.gradient}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${build.iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{build.title}</p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{build.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── New Project Modal ─── */}
      {showNewModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !creating && setShowNewModal(false)} />
          <div className="relative glass-panel-solid rounded-2xl border border-[var(--border)] p-6 w-full max-w-md animate-slide-up">
            <h3 className="text-lg font-bold gradient-text mb-4">New Fun Project</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="My Awesome Project"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Description</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="What are you building?"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/30 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/30 transition-all"
                  >
                    {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Status</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/30 transition-all"
                  >
                    <option value="idea">Idea</option>
                    <option value="building">Building</option>
                    <option value="live">Live</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium mb-1.5">Live URL (optional)</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/30 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => !creating && setShowNewModal(false)}
                className="px-4 py-2 rounded-xl text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => createProject()}
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
                }}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Project
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

function ProjectGridCard({ project, onShare }: { project: FunProject; onShare: (p: FunProject) => void }) {
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.idea
  const catColor = CATEGORY_COLORS[project.category] || 'from-[var(--accent)]/20 to-transparent text-[var(--accent)]'
  const catLabel = CATEGORIES.find(c => c.id === project.category)?.label || project.category

  return (
    <div className="glass-panel rounded-2xl border border-[var(--border)] overflow-hidden card-hover group animate-slide-up">
      {/* Screenshot placeholder */}
      <div className={`h-32 bg-gradient-to-br ${catColor} relative overflow-hidden`}>
        {project.image_url ? (
          <img src={project.image_url} alt={project.name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 opacity-20" />
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-3 right-3">
          <Badge variant={status.variant} size="sm">{status.label}</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{project.name}</h3>
        </div>
        {project.description && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 leading-relaxed">{project.description}</p>
        )}
        <div className="flex items-center justify-between">
          <Badge variant="neutral" size="sm">{catLabel}</Badge>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onShare(project)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
              title="Share"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                title="Visit live site"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectListRow({ project, onShare }: { project: FunProject; onShare: (p: FunProject) => void }) {
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.idea
  const catLabel = CATEGORIES.find(c => c.id === project.category)?.label || project.category

  return (
    <div className="glass-panel rounded-xl border border-[var(--border)] px-4 py-3 flex items-center gap-4 card-hover group animate-slide-up">
      <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
        <Globe className="w-4 h-4 text-[var(--text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">{project.name}</h3>
          <Badge variant={status.variant} size="sm">{status.label}</Badge>
          <Badge variant="neutral" size="sm">{catLabel}</Badge>
        </div>
        {project.description && (
          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{project.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onShare(project)}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
          title="Share"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
        {project.url && (
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
            title="Visit live site"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
