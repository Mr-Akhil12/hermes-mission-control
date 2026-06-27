'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Activity, Kanban, Clock, Cpu,
  FileText, Settings, KeyRound, BookOpen, Zap,
  X, ChevronRight, MessageSquare, TrendingUp,
  DollarSign, Sparkles, Gamepad2, Shield
} from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

const dashboardTabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'tasks', label: 'Tasks', icon: Kanban, path: '/tasks' },
  { id: 'cron', label: 'Cron', icon: Clock, path: '/cron' },
  { id: 'models', label: 'Models', icon: Cpu, path: '/models' },
  { id: 'social', label: 'Social', icon: TrendingUp, path: '/social' },
  { id: 'trading', label: 'Trading', icon: DollarSign, path: '/trading', subTabs: [
    { id: 'trading-overview', label: 'Overview', path: '/trading' },
    { id: 'twp-activation', label: 'TWP Kit', path: '/trading/twp-activation' },
  ]},
  { id: 'fun-projects', label: 'Fun Projects', icon: Sparkles, path: '/fun-projects' },
  { id: 'dirt-hands-crew', label: 'Dirt Hands Crew', icon: Gamepad2, path: '/dirt-hands-crew' },
  { id: 'hush', label: 'Hush', icon: Shield, path: '/hush' },
]

const systemTabs = [
  { id: 'logs', label: 'Logs', icon: FileText, path: '/logs' },
  { id: 'config', label: 'Config', icon: Settings, path: '/config' },
  { id: 'keys', label: 'Keys', icon: KeyRound, path: '/keys' },
  { id: 'docs', label: 'Docs', icon: BookOpen, path: '/docs' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const renderNavItem = (tab: typeof dashboardTabs[0], onClick?: () => void) => {
    const Icon = tab.icon
    const active = isActive(tab.path)
    const hasSubTabs = 'subTabs' in tab && tab.subTabs
    return (
      <div key={tab.id}>
        <Link
          href={tab.path}
          onClick={onClick}
          className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-[13px] transition-all ${
            active
              ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
          }`}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span>{tab.label}</span>
          {active && <div className={`ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)]`} />}
        </Link>
        {hasSubTabs && active && (
          <div className="ml-6 mt-1 space-y-0.5">
            {tab.subTabs!.map(sub => (
              <Link
                key={sub.id}
                href={sub.path}
                onClick={onClick}
                className={`block px-3 py-1.5 rounded-lg text-[11px] transition-all ${
                  pathname === sub.path
                    ? 'text-[var(--accent)] font-medium bg-[var(--accent)]/5'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {sub.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ─── Mobile Header ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 md:hidden h-16 py-[5px] bg-[var(--bg-secondary)]/90 backdrop-blur-xl border-b border-[var(--border)] flex items-center justify-between px-4 gap-3">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Hermes" width={42} height={42} sizes="42px" priority className="rounded-xl" />
          <div>
            <span className="text-sm font-bold tracking-tight block leading-none">Hermes OS</span>
            <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest leading-none mt-[2px] block">Mission Control</span>
          </div>
        </button>
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/20"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        )}
      </header>

      {/* ─── Mobile Pill Navigation ─── */}
      {mobileOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 md:hidden py-2 px-4
          bg-gradient-to-br from-[rgba(79,143,255,0.85)] to-[rgba(168,85,247,0.85)] backdrop-blur-md text-white
          rounded-b-2xl shadow-lg animate-slide-down">
          <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2">
            {dashboardTabs.map(tab => {
              const active = isActive(tab.path)
              return (
                <Link
                  key={tab.id}
                  href={tab.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex-shrink-0 rounded-full px-4 py-2 text-sm transition-all whitespace-nowrap
                    ${active
                      ? 'bg-gradient-to-r from-[#4f8fff] to-[#a855f7] font-medium text-white shadow-md'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
          <div className="border-t border-white/20 my-2" />
          <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2">
            {systemTabs.map(tab => {
              const active = isActive(tab.path)
              return (
                <Link
                  key={tab.id}
                  href={tab.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex-shrink-0 rounded-full px-4 py-2 text-sm transition-all whitespace-nowrap
                    ${active
                      ? 'bg-gradient-to-r from-[#4f8fff] to-[#a855f7] font-medium text-white shadow-md'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Desktop Sidebar ─── */}
      <aside className="fixed left-0 top-0 bottom-0 z-30 w-[220px] bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-r border-[var(--border)] hidden md:flex flex-col">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 px-5 h-16 flex-shrink-0 border-b border-[var(--border)]">
          <Image src="/logo.png" alt="Hermes" width={48} height={48} sizes="48px" priority className="rounded-xl" />
          <div>
            <span className="text-sm font-bold tracking-tight block leading-none">Hermes OS</span>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest leading-none mt-[2px] block">Mission Control</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium">Dashboard</p>
          {dashboardTabs.map(tab => renderNavItem(tab))}

          <div className="my-3 border-t border-[var(--border)]" />

          <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-medium">System</p>
          {systemTabs.map(tab => renderNavItem(tab))}
        </nav>

        {/* Bottom status */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--success)] pulse-dot text-[var(--success)]" />
            <span className="text-[11px] text-[var(--text-muted)]">All systems operational</span>
          </div>
        </div>
      </aside>
    </>
  )
}
