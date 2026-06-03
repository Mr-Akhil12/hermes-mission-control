'use client'
import { BookOpen, Activity, Kanban, Clock, Cpu, FileText, Settings, KeyRound, Zap } from 'lucide-react'

const features = [
  { icon: Activity, title: 'Live Activity Feed', desc: 'Real-time stream of every agent action. Powered by Supabase Realtime subscriptions — no polling needed.' },
  { icon: Kanban, title: 'Task Board', desc: 'Kanban-style task tracker. Create tasks, move them through todo → in progress → done. All stored in Supabase.' },
  { icon: Clock, title: 'Cron Jobs', desc: 'View and manage scheduled agent tasks. Pause, resume, or delete cron jobs.' },
  { icon: Cpu, title: 'Model Analytics', desc: 'See which AI models are being used across sessions.' },
  { icon: FileText, title: 'Logs', desc: 'Real-time Hermes agent and gateway logs.' },
  { icon: Settings, title: 'Config', desc: 'View and edit your hermes config.yaml.' },
  { icon: KeyRound, title: 'Keys', desc: 'View environment variables and API keys.' },
]

export default function DocsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold mb-2">Hermes OS Mission Control</h2>
        <p className="text-sm text-zinc-400">A real-time dashboard for monitoring and managing your Hermes AI agents. Built with Next.js, Supabase, and deployed on Vercel.</p>
      </div>

      <div className="grid gap-3">
        {features.map(f => (
          <div key={f.title} className="bg-[#111118] rounded-xl p-4 border border-[#1e1e2a] flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <f.icon className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <div className="text-sm font-medium">{f.title}</div>
              <p className="text-xs text-zinc-500 mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#111118] rounded-xl p-4 border border-[#1e1e2a]">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-orange-400" /> Architecture</h3>
        <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
          <li><strong className="text-zinc-300">Supabase</strong> — PostgreSQL database with Realtime subscriptions</li>
          <li><strong className="text-zinc-300">Next.js</strong> — React framework, deployed on Vercel</li>
          <li><strong className="text-zinc-300">Vercel</strong> — Auto-deploys from GitHub on every push</li>
          <li><strong className="text-zinc-300">Cloudflare Tunnel</strong> — Exposes local Hermes API to Vercel</li>
          <li><strong className="text-zinc-300">Agent Logger</strong> — Background service that logs agent activity to Supabase</li>
        </ul>
      </div>
    </div>
  )
}
