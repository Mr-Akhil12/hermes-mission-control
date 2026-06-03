'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Activity, Kanban, Clock, Cpu,
  FileText, Settings, KeyRound, BookOpen, Zap, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useState } from 'react'

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'tasks', label: 'Tasks', icon: Kanban, path: '/tasks' },
  { id: 'cron', label: 'Cron', icon: Clock, path: '/cron' },
  { id: 'models', label: 'Models', icon: Cpu, path: '/models' },
  { id: 'logs', label: 'Logs', icon: FileText, path: '/logs' },
  { id: 'config', label: 'Config', icon: Settings, path: '/config' },
  { id: 'keys', label: 'Keys', icon: KeyRound, path: '/keys' },
  { id: 'docs', label: 'Docs', icon: BookOpen, path: '/docs' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`fixed left-0 top-0 h-full z-50 flex-col transition-all duration-300 bg-[#0d0d14] border-r border-[#1e1e2a] hidden md:flex ${collapsed ? 'w-14' : 'w-56'}`}>
        <div className="flex items-center gap-2 px-4 h-14 flex-shrink-0 border-b border-[#1e1e2a]">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-black" />
          </div>
          {!collapsed && <span className="text-sm font-semibold tracking-tight">Hermes OS</span>}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.path)
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title={collapsed ? tab.label : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{tab.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 pb-3 flex-shrink-0 border-t border-[#1e1e2a]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 md:hidden h-14 bg-[#0d0d14] border-b border-[#1e1e2a] flex items-center px-4">
        <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center mr-3">
          <Zap className="w-4 h-4 text-black" />
        </div>
        <span className="text-sm font-semibold">Hermes OS</span>
      </header>

      {/* Mobile Tab Bar */}
      <div className="fixed top-14 left-0 right-0 z-30 md:hidden overflow-x-auto bg-[#0d0d14] border-b border-[#1e1e2a]">
        <div className="flex items-center gap-1 px-2 py-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.path)
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  active ? 'bg-orange-500/10 text-orange-400' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
