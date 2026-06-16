'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface CardProps {
  label: string
  value: string | number
  subtitle: string
  icon: LucideIcon
  color: 'blue' | 'green' | 'red' | 'purple'
  delay: number
  href?: string
}

const colorMap: Record<string, string> = {
  blue: 'from-[var(--accent)]/20 to-transparent text-[var(--accent)]',
  green: 'from-[var(--success)]/20 to-transparent text-[var(--success)]',
  red: 'from-[var(--danger)]/20 to-transparent text-[var(--danger)]',
  purple: 'from-[var(--purple)]/20 to-transparent text-[var(--purple)]',
}

const wrapperClasses =
  'animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover group'

export function Card({ label, value, subtitle, icon: Icon, color, delay, href }: CardProps) {
  const gradientClass = colorMap[color] || colorMap.blue

  const inner = (
    <>
      {/* Background gradient glow */}
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${gradientClass} opacity-30 blur-2xl group-hover:opacity-50 transition-opacity`}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">
            {label}
          </span>
          <div className="flex items-center gap-1">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center`}
            >
              <Icon className="w-4.5 h-4.5" />
            </div>
            {href && (
              <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>
        <p className="text-4xl font-bold gradient-text mb-1">{value}</p>
        <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
      </div>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={`${wrapperClasses} cursor-pointer block`}
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
      </Link>
    )
  }

  return (
    <div className={wrapperClasses} style={{ animationDelay: `${delay}ms` }}>
      {inner}
    </div>
  )
}
