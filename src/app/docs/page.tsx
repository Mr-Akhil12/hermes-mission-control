'use client'

import { BookOpen, ExternalLink, Zap, Server, Database, Globe } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function DocsPage() {
  const sections = [
    {
      title: 'Getting Started',
      icon: Zap,
      color: 'var(--accent)',
      links: [
        { label: 'Quick Start Guide', desc: 'Set up Hermes in 5 minutes' },
        { label: 'Architecture Overview', desc: 'How the system is structured' },
        { label: 'Configuration', desc: 'Config.yaml reference' },
      ]
    },
    {
      title: 'Infrastructure',
      icon: Server,
      color: 'var(--purple)',
      links: [
        { label: 'Gateway API', desc: 'Port 9119 — agent communication' },
        { label: 'Control Plane', desc: 'Port 9120 — dashboard & monitoring' },
        { label: 'n8n Integration', desc: 'Workflow automation on port 5678' },
        { label: 'Tailscale Access', desc: 'Secure remote access via mesh VPN' },
      ]
    },
    {
      title: 'Data Layer',
      icon: Database,
      color: 'var(--cyan)',
      links: [
        { label: 'Supabase Schema', desc: '4 tables: activities, tasks, sessions, cron_jobs' },
        { label: 'Realtime Subscriptions', desc: 'Live data sync to dashboard' },
        { label: 'RLS Policies', desc: 'Row-level security configuration' },
      ]
    },
    {
      title: 'Deployment',
      icon: Globe,
      color: 'var(--success)',
      links: [
        { label: 'Vercel Dashboard', desc: 'hermes-mission-control-seven.vercel.app' },
        { label: 'GitHub Repo', desc: 'github.com/Mr-Akhil12/hermes-mission-control' },
        { label: 'Docker (n8n)', desc: 'Self-hosted workflow automation' },
      ]
    },
  ]

  return (
    <div className="space-y-6">
      <div className="animate-slide-up">
        <h1 className="text-xl sm:text-2xl font-bold gradient-text">Documentation</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">Hermes OS system documentation and references</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '60ms' }}>
        {sections.map(section => {
          const Icon = section.icon
          return (
            <div key={section.title} className="rounded-2xl glass-panel border border-[var(--border)] overflow-hidden card-hover">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${section.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: section.color }} />
                </div>
                <h3 className="text-sm font-semibold">{section.title}</h3>
              </div>
              <div className="p-3 space-y-1">
                {section.links.map(link => (
                  <div key={link.label} className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer group min-h-[44px]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{link.label}</p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{link.desc}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
