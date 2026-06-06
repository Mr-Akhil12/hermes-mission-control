'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Activity, Kanban, Clock, Cpu,
  FileText, Settings, KeyRound, BookOpen, Zap,
  Menu, X, ChevronRight
} from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

const dashboardTabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'tasks', label: 'Tasks', icon: Kanban, path: '/tasks' },
  { id: 'cron', label: 'Cron', icon: Clock, path: '/cron' },
  { id: 'models', label: 'Models', icon: Cpu, path: '/models' },
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
    return (
      <Link
        key={tab.id}
        href={tab.path}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
          active
            ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
        }`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{tab.label}</span>
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
      </Link>
    )
  }

  return (
    <>
      {/* ─── Mobile Header ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 md:hidden h-16 py-[5px] bg-[var(--bg-secondary)]/90 backdrop-blur-xl border-b border-[var(--border)] flex items-center justify-between px-4 gap-3">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <Image src="/logo.png" alt="Hermes" width={42} height={42} className="rounded-xl" />
          <div>
            <span className="text-sm font-bold tracking-tight block leading-tight">Hermes OS</span>
            <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest">Mission Control</span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group"
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 50%, var(--pink) 100%)',
            boxShadow: '0 0 20px rgba(79, 143, 255, 0.3), 0 0 40px rgba(168, 85, 247, 0.15)',
          }}
        >
          <Menu className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </header>

      {/* ─── Mobile Fullscreen Overlay ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Fullscreen Menu */}
          <div className="absolute inset-0 bg-[var(--bg-secondary)] flex flex-col animate-slide-up">
            {/* Menu Header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-[var(--border)] flex-shrink-0">
              <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
                <Image src="/logo.png" alt="Hermes" width={48} height={48} className="rounded-xl" />
                <div>
                  <span className="text-sm font-bold tracking-tight block leading-tight">Hermes OS</span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Mission Control</span>
                </div>
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group"
                style={{
                  background: 'linear-gradient(135deg, var(--danger) 0%, var(--pink) 100%)',
                  boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)',
                }}
              >
                <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            {/* Nav Content */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
              {/* Dashboard Section */}
              <div>
                <p className="px-3 mb-3 text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">Dashboard</p>
                <div className="space-y-1">
                  {dashboardTabs.map(tab => renderNavItem(tab, () => setMobileOpen(false)))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--border)]" />

              {/* System Section */}
              <div>
                <p className="px-3 mb-3 text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">System</p>
                <div className="space-y-1">
                  {systemTabs.map(tab => renderNavItem(tab, () => setMobileOpen(false)))}
                </div>
              </div>
            </div>

            {/* Bottom Status */}
            <div className="px-5 py-4 border-t border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--success)] pulse-dot text-[var(--success)]" />
                <span className="text-[11px] text-[var(--text-muted)]">All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Desktop Sidebar ─── */}
      <aside className="fixed left-0 top-0 bottom-0 z-30 w-[220px] bg-[var(--bg-secondary)]/95 backdrop-blur-xl border-r border-[var(--border)] hidden md:flex flex-col">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 px-5 h-16 flex-shrink-0 border-b border-[var(--border)]">
          <Image src="/logo.png" alt="Hermes" width={48} height={48} className="rounded-xl" />
          <div>
            <span className="text-sm font-bold tracking-tight block leading-tight">Hermes OS</span>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Mission Control</span>
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
