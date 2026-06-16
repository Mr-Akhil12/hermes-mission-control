'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp, Users, Calendar, BarChart3,
  Play, AtSign, Code, Globe, MessageCircle,
  ArrowUpRight, ArrowDownRight, Loader2, RefreshCw
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useSupabaseQuery } from '@/lib/useSupabaseQuery'
import { timeAgo } from '@/lib/utils'

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

interface PlatformMetric {
  platform: string
  followers: number
  growth: number
  engagement: number
  recorded_at: string
}

interface GrowthHistory {
  platform: string
  followers: number
  recorded_at: string
}

interface CalendarEntry {
  id: string
  platform: string
  title: string
  description: string | null
  scheduled_at: string
  status: string
}

interface SocialApiResponse {
  metrics: PlatformMetric[]
  growthHistory: GrowthHistory[]
  calendar: CalendarEntry[]
  tableExists: boolean
}

/* ────────────────────────────────────────────────────────────
 * Platform config
 * ──────────────────────────────────────────────────────────── */

interface PlatformConfig {
  name: string
  icon: typeof Play
  color: string
  colorClass: string
  gradientClass: string
}

const PLATFORMS: Record<string, PlatformConfig> = {
  youtube: {
    name: 'YouTube',
    icon: Play,
    color: '#FF0000',
    colorClass: 'text-[#FF0000]',
    gradientClass: 'from-[#FF0000]/20 to-transparent',
  },
  twitter: {
    name: 'X / Twitter',
    icon: AtSign,
    color: '#1DA1F2',
    colorClass: 'text-[#1DA1F2]',
    gradientClass: 'from-[#1DA1F2]/20 to-transparent',
  },
  discord: {
    name: 'Discord',
    icon: MessageCircle,
    color: '#5865F2',
    colorClass: 'text-[#5865F2]',
    gradientClass: 'from-[#5865F2]/20 to-transparent',
  },
  github: {
    name: 'GitHub',
    icon: Code,
    color: '#f0f0f5',
    colorClass: 'text-[var(--text-primary)]',
    gradientClass: 'from-white/10 to-transparent',
  },
  website: {
    name: 'Website',
    icon: Globe,
    color: '#22d3ee',
    colorClass: 'text-[var(--cyan)]',
    gradientClass: 'from-[var(--cyan)]/20 to-transparent',
  },
}

const MOCK_SOCIAL_KEY = '/api/social'

/* ────────────────────────────────────────────────────────────
 * Mock data (used when Supabase table doesn't exist yet)
 * ──────────────────────────────────────────────────────────── */

const MOCK_METRICS: PlatformMetric[] = [
  { platform: 'youtube', followers: 1247, growth: 5.3, engagement: 72, recorded_at: new Date().toISOString() },
  { platform: 'twitter', followers: 3892, growth: 8.1, engagement: 64, recorded_at: new Date().toISOString() },
  { platform: 'discord', followers: 568, growth: 12.4, engagement: 85, recorded_at: new Date().toISOString() },
  { platform: 'github', followers: 2156, growth: 3.2, engagement: 91, recorded_at: new Date().toISOString() },
  { platform: 'website', followers: 8420, growth: 15.7, engagement: 58, recorded_at: new Date().toISOString() },
]

const MOCK_GROWTH: GrowthHistory[] = (() => {
  const history: GrowthHistory[] = []
  const platforms = ['youtube', 'twitter', 'discord', 'github', 'website']
  const baseValues = { youtube: 1100, twitter: 3200, discord: 420, github: 2000, website: 6800 }
  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    for (const p of platforms) {
      const base = baseValues[p as keyof typeof baseValues]
      const growth = Math.floor(base + (30 - i) * (base * 0.005) + Math.random() * (base * 0.02))
      history.push({ platform: p, followers: growth, recorded_at: dateStr })
    }
  }
  return history
})()

const MOCK_CALENDAR: CalendarEntry[] = [
  { id: '1', platform: 'youtube', title: 'Weekly Hermes Update #42', description: 'Covering new agent features and performance improvements', scheduled_at: new Date(Date.now() + 86400000 * 1).toISOString(), status: 'scheduled' },
  { id: '2', platform: 'twitter', title: 'Thread: AI Agent Best Practices', description: '7-part thread on building reliable AI agents', scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(), status: 'scheduled' },
  { id: '3', platform: 'discord', title: 'Community AMA Session', description: 'Open Q&A about Hermes OS roadmap', scheduled_at: new Date(Date.now() + 86400000 * 3).toISOString(), status: 'scheduled' },
  { id: '4', platform: 'github', title: 'Release v0.2.0', description: 'Major release with social tracker, cron improvements', scheduled_at: new Date(Date.now() + 86400000 * 5).toISOString(), status: 'scheduled' },
  { id: '5', platform: 'website', title: 'Blog Post: Mission Control Deep Dive', description: 'Technical walkthrough of the dashboard architecture', scheduled_at: new Date(Date.now() + 86400000 * 7).toISOString(), status: 'scheduled' },
  { id: '6', platform: 'twitter', title: 'Showcase: Real-time Activity Feed', description: 'Video demo of the live monitoring feature', scheduled_at: new Date(Date.now() + 86400000 * 10).toISOString(), status: 'scheduled' },
]

/* ────────────────────────────────────────────────────────────
 * Helper components
 * ──────────────────────────────────────────────────────────── */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function PlatformCard({ metric, config }: { metric: PlatformMetric; config: PlatformConfig }) {
  const Icon = config.icon
  const isPositive = metric.growth >= 0

  return (
    <div
      className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover group"
    >
      {/* Background gradient glow */}
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${config.gradientClass} opacity-30 blur-2xl group-hover:opacity-50 transition-opacity`}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">
            {config.name}
          </span>
          <div className="flex items-center gap-1">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradientClass} flex items-center justify-center`}
            >
              <Icon className="w-4.5 h-4.5" />
            </div>
          </div>
        </div>

        {/* Follower count */}
        <p className="text-4xl font-bold gradient-text mb-1">
          {formatNumber(metric.followers)}
        </p>

        {/* Growth */}
        <div className="flex items-center gap-2 mt-1">
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3 text-[var(--success)]" />
          ) : (
            <ArrowDownRight className="w-3 h-3 text-[var(--danger)]" />
          )}
          <span
            className={`text-xs font-medium ${isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
          >
            {isPositive ? '+' : ''}{metric.growth.toFixed(1)}% this week
          </span>
        </div>

        {/* Engagement bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--text-muted)]">Engagement</span>
            <span className="text-[10px] text-[var(--text-secondary)] font-medium">{metric.engagement}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${metric.engagement}%`,
                background: `linear-gradient(90deg, ${config.color}80, ${config.color})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Bar Chart (pure CSS — no extra dependency)
 * ──────────────────────────────────────────────────────────── */

function BarChart({ metrics }: { metrics: PlatformMetric[] }) {
  const maxFollowers = Math.max(...metrics.map((m) => m.followers), 1)

  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold">Platform Comparison</h3>
        </div>
        <Badge variant="accent" size="sm">Followers</Badge>
      </div>

      <div className="space-y-4">
        {metrics.map((m) => {
          const config = PLATFORMS[m.platform]
          if (!config) return null
          const pct = (m.followers / maxFollowers) * 100
          const Icon = config.icon
          return (
            <div key={m.platform} className="flex items-center gap-3">
              <div className="w-24 flex items-center gap-2 flex-shrink-0">
                <Icon className={`w-3.5 h-3.5 ${config.colorClass}`} />
                <span className="text-xs text-[var(--text-secondary)] truncate">{config.name}</span>
              </div>
              <div className="flex-1 h-6 rounded-lg bg-[var(--bg-input)] overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.max(pct, 3)}%`,
                    background: `linear-gradient(90deg, ${config.color}30, ${config.color}80)`,
                  }}
                >
                  {pct > 20 && (
                    <span className="text-[10px] font-medium text-white/90">{formatNumber(m.followers)}</span>
                  )}
                </div>
                {pct <= 20 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
                    {formatNumber(m.followers)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Growth Line Chart (pure CSS sparkline)
 * ──────────────────────────────────────────────────────────── */

function GrowthLineChart({ history }: { history: GrowthHistory[] }) {
  // Group by platform
  const platforms = ['youtube', 'twitter', 'discord', 'github', 'website']

  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover" style={{ animationDelay: '360ms' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--success)]" />
          <h3 className="text-sm font-semibold">Growth Over Time</h3>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">Last 30 days</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => {
          const config = PLATFORMS[platform]
          if (!config) return null
          const data = history.filter((h) => h.platform === platform)
          if (data.length === 0) return null

          const values = data.map((d) => d.followers)
          const min = Math.min(...values)
          const max = Math.max(...values)
          const range = max - min || 1

          return (
            <div key={platform} className="rounded-xl bg-[var(--bg-input)]/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <config.icon className={`w-3 h-3 ${config.colorClass}`} />
                <span className="text-[10px] text-[var(--text-secondary)] font-medium">{config.name}</span>
              </div>
              {/* Mini sparkline using SVG */}
              <div className="h-16 relative">
                <svg viewBox="0 0 100 32" className="w-full h-full" preserveAspectRatio="none">
                  {/* Area fill */}
                  <defs>
                    <linearGradient id={`grad-${platform}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={config.color} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={config.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {values.length > 1 && (
                    <>
                      <path
                        d={`M0,${32 - ((values[0] - min) / range) * 28} ${values.map((v, i) => `L${(i / (values.length - 1)) * 100},${32 - ((v - min) / range) * 28}`).join(' ')} L100,32 L0,32 Z`}
                        fill={`url(#grad-${platform})`}
                      />
                      <path
                        d={`M0,${32 - ((values[0] - min) / range) * 28} ${values.map((v, i) => `L${(i / (values.length - 1)) * 100},${32 - ((v - min) / range) * 28}`).join(' ')}`}
                        fill="none"
                        stroke={config.color}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                </svg>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] text-[var(--text-muted)]">{formatNumber(values[0])}</span>
                <span className="text-[9px] text-[var(--text-muted)]">{formatNumber(values[values.length - 1])}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Content Calendar
 * ──────────────────────────────────────────────────────────── */

function ContentCalendar({ entries }: { entries: CalendarEntry[] }) {
  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden card-hover" style={{ animationDelay: '420ms' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--purple)]" />
          <h3 className="text-sm font-semibold">Content Calendar</h3>
        </div>
        <Badge variant="purple" size="sm">{entries.length} upcoming</Badge>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
            <Calendar className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No scheduled posts</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry) => {
              const config = PLATFORMS[entry.platform]
              const Icon = config?.icon ?? Globe
              const scheduledDate = new Date(entry.scheduled_at)
              const daysUntil = Math.ceil(
                (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <div className="mt-0.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${config?.color ?? '#888'}20, ${config?.color ?? '#888'}40)`,
                      }}
                    >
                      <Icon className={`w-3.5 h-3.5 ${config?.colorClass ?? 'text-[var(--text-secondary)]'}`} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{entry.title}</span>
                      <Badge
                        variant={entry.status === 'published' ? 'success' : entry.status === 'cancelled' ? 'danger' : 'accent'}
                        size="sm"
                      >
                        {entry.status}
                      </Badge>
                    </div>
                    {entry.description && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">{entry.description}</p>
                    )}
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      {daysUntil <= 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                      {' · '}
                      {scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Main Page
 * ──────────────────────────────────────────────────────────── */

export default function SocialPage() {
  const {
    data: apiData,
    error,
    isLoading,
  } = useSupabaseQuery<SocialApiResponse>(MOCK_SOCIAL_KEY, 60000)

  const [isRefreshing, setIsRefreshing] = useState(false)

  // Use mock data when API returns empty or table doesn't exist
  const metrics: PlatformMetric[] =
    apiData?.metrics && apiData.metrics.length > 0
      ? apiData.metrics
      : !isLoading && apiData?.tableExists === false
        ? MOCK_METRICS
        : apiData?.metrics ?? MOCK_METRICS

  const growthHistory: GrowthHistory[] =
    apiData?.growthHistory && apiData.growthHistory.length > 0
      ? apiData.growthHistory
      : MOCK_GROWTH

  const calendar: CalendarEntry[] =
    apiData?.calendar && apiData.calendar.length > 0
      ? apiData.calendar
      : MOCK_CALENDAR

  // KPI calculations
  const totalFollowers = metrics.reduce((sum, m) => sum + m.followers, 0)
  const avgGrowth =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.growth, 0) / metrics.length
      : 0
  const postsThisWeek = calendar.filter((c) => {
    const d = new Date(c.scheduled_at)
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    return d >= now && d <= weekFromNow
  }).length

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetch(MOCK_SOCIAL_KEY, { method: 'POST' })
      // Re-fetch via SWR — mutate the key
      window.location.reload()
    } catch {
      // Silently handle refresh errors
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Social Media Tracker</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Monitor followers, growth, and engagement across all platforms
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-all disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="text-xs">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 stagger">
        <Card
          label="Total Followers"
          value={formatNumber(totalFollowers)}
          subtitle="Across all platforms"
          icon={Users}
          color="blue"
          delay={0}
        />
        <Card
          label="Avg. Growth"
          value={`${avgGrowth >= 0 ? '+' : ''}${avgGrowth.toFixed(1)}%`}
          subtitle="Weekly average"
          icon={TrendingUp}
          color={avgGrowth >= 0 ? 'green' : 'red'}
          delay={60}
        />
        <Card
          label="Posts This Week"
          value={postsThisWeek}
          subtitle="Scheduled content"
          icon={Calendar}
          color="purple"
          delay={120}
        />
      </div>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 stagger">
        {metrics.map((metric) => {
          const config = PLATFORMS[metric.platform]
          if (!config) return null
          return (
            <PlatformCard key={metric.platform} metric={metric} config={config} />
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <BarChart metrics={metrics} />
        <GrowthLineChart history={growthHistory} />
      </div>

      {/* Content Calendar */}
      <ContentCalendar entries={calendar} />
    </div>
  )
}
