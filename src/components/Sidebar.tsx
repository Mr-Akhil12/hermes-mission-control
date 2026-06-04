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
      <aside className={`fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300 bg-white border-r border-[#4f8fff1f] hidden md:flex ${collapsed ? 'w-14' : 'w-56'}`}>
        <div className="flex items-center gap-2 px-4 h-14 flex-shrink-0 border-b border-[#4f8fff1f]">
          <div className="w-8 h-8 rounded-xl bg-[#4f8fff] flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && <span className="text-sm font-bold tracking-tight text-[#1a1a2e]">Hermes OS</span>}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.path)
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-[#4f8fff10] text-[#4f8fff] font-medium'
                    : 'text-[#8888a0] hover:text-[#4a4a68] hover:bg-[#4f8fff08]'
                }`}
                title={collapsed ? tab.label : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{tab.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 pb-3 flex-shrink-0 border-t border-[#4f8fff1f]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 rounded-xl text-[#8888a0] hover:text-[#4a4a68] hover:bg-[#4f8fff08] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 md:hidden h-14 bg-white border-b border-[#4f8fff1f] flex items-center px-4">
        <div className="w-8 h-8 rounded-xl bg-[#4f8fff] flex items-center justify-center mr-3">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold text-[#1a1a2e]">Hermes OS</span>
      </header>

      {/* Mobile Tab Bar */}
      <div className="fixed top-14 left-0 right-0 z-30 md:hidden overflow-x-auto bg-white border-b border-[#4f8fff1f]">
        <div className="flex items-center gap-1 px-2 py-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.path)
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  active ? 'bg-[#4f8fff10] text-[#4f8fff]' : 'text-[#8888a0] hover:text-[#4a4a68]'
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
