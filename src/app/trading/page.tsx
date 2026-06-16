'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Target, Shield,
  BarChart3, Clock, CheckCircle2, Circle, AlertTriangle,
  Activity, Zap, Loader2, RefreshCw, Calculator,
  ArrowUpRight, ArrowDownRight, Timer, BookOpen
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useSupabaseQuery } from '@/lib/useSupabaseQuery'

/* ────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

interface Trade {
  id: string
  date: string
  direction: 'BUY' | 'SELL'
  entry: number
  sl: number
  tp: number
  result: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'PENDING'
  rr: number
  notes: string | null
}

interface Performance {
  totalTrades: number
  winRate: number
  avgRR: number
  profitFactor: number
  maxDrawdown: number
}

interface HistogramBucket {
  label: string
  count: number
  percentage: number
}

interface SimulationResult {
  winRate: number
  maxDrawdown: number
  profitFactor: number
  sharpeRatio: number
  equityCurve: number[]
  histogram: HistogramBucket[]
  medianBalance: number
  bestCase: number
  worstCase: number
  avgFinalBalance: number
}

interface TradingApiResponse {
  trades: Trade[]
  performance: Performance
  tableExists: boolean
}

interface ChecklistItem {
  id: string
  label: string
  checked: boolean
}

/* ────────────────────────────────────────────────────────────
 * Mock data (when Supabase table doesn't exist yet)
 * ──────────────────────────────────────────────────────────── */

const MOCK_TRADES: Trade[] = [
  { id: '1', date: new Date(Date.now() - 86400000 * 0).toISOString(), direction: 'BUY', entry: 2342.50, sl: 2338.00, tp: 2349.25, result: 'WIN', rr: 1.5, notes: 'Bullish engulfing at support' },
  { id: '2', date: new Date(Date.now() - 86400000 * 1).toISOString(), direction: 'SELL', entry: 2355.80, sl: 2360.00, tp: 2349.50, result: 'LOSS', rr: -1.0, notes: 'Failed breakout reversal' },
  { id: '3', date: new Date(Date.now() - 86400000 * 2).toISOString(), direction: 'BUY', entry: 2338.20, sl: 2334.00, tp: 2344.50, result: 'WIN', rr: 1.5, notes: 'Double bottom + RSI divergence' },
  { id: '4', date: new Date(Date.now() - 86400000 * 3).toISOString(), direction: 'SELL', entry: 2362.10, sl: 2366.50, tp: 2355.50, result: 'WIN', rr: 1.5, notes: 'Pin bar at resistance' },
  { id: '5', date: new Date(Date.now() - 86400000 * 4).toISOString(), direction: 'BUY', entry: 2345.00, sl: 2340.00, tp: 2352.50, result: 'WIN', rr: 1.5, notes: 'Order block + momentum' },
  { id: '6', date: new Date(Date.now() - 86400000 * 5).toISOString(), direction: 'SELL', entry: 2370.50, sl: 2375.00, tp: 2363.75, result: 'LOSS', rr: -1.0, notes: 'Stopped out before reversal' },
  { id: '7', date: new Date(Date.now() - 86400000 * 6).toISOString(), direction: 'BUY', entry: 2330.80, sl: 2326.50, tp: 2337.25, result: 'WIN', rr: 1.5, notes: 'Fibonacci 61.8% bounce' },
  { id: '8', date: new Date(Date.now() - 86400000 * 7).toISOString(), direction: 'SELL', entry: 2358.30, sl: 2362.00, tp: 2352.75, result: 'BREAKEVEN', rr: 0, notes: 'Moved SL to entry after +0.5R' },
]

const MOCK_PERFORMANCE: Performance = {
  totalTrades: 47,
  winRate: 55.3,
  avgRR: 0.82,
  profitFactor: 1.87,
  maxDrawdown: 4.2,
}

const MOCK_SIMULATION: SimulationResult = {
  winRate: 55,
  maxDrawdown: 8.3,
  profitFactor: 1.83,
  sharpeRatio: 1.42,
  equityCurve: Array.from({ length: 253 }, (_, i) => 10000 + i * 12 + Math.sin(i * 0.1) * 500 + (Math.random() - 0.45) * 200),
  histogram: Array.from({ length: 20 }, (_, i) => ({
    label: `$${8000 + i * 500}`,
    count: Math.floor(Math.random() * 800 + 100),
    percentage: Math.floor(Math.random() * 8 + 1),
  })),
  medianBalance: 13200,
  bestCase: 22500,
  worstCase: 4200,
  avgFinalBalance: 12800,
}

/* ────────────────────────────────────────────────────────────
 * Live XAUUSD Price Component
 * ──────────────────────────────────────────────────────────── */

function LivePriceDisplay() {
  const [price, setPrice] = useState(2345.82)
  const [prevPrice, setPrevPrice] = useState(2345.82)
  const [change, setChange] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPrevPrice(price)
      const delta = (Math.random() - 0.48) * 2.5
      const newPrice = Math.round((price + delta) * 100) / 100
      setPrice(newPrice)
      setChange(newPrice - 2340.00) // vs day open
    }, 2000)

    return () => clearInterval(interval)
  }, [price])

  const isUp = price >= prevPrice
  const isChangeUp = change >= 0

  return (
    <div className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-6 card-hover group">
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br from-[var(--accent)]/20 to-transparent opacity-30 blur-2xl group-hover:opacity-50 transition-opacity" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--warning)]/20 to-transparent flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">XAU/USD</span>
              <span className="ml-2"><Badge variant="accent" size="sm">LIVE</Badge></span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[var(--success)] pulse-dot text-[var(--success)]" />
            <span className="text-[10px] text-[var(--text-muted)]">Streaming</span>
          </div>
        </div>

        <div className="flex items-end gap-4 mt-4">
          <p className="text-5xl font-bold gradient-text font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {price.toFixed(2)}
          </p>
          <div className="flex items-center gap-1.5 pb-1">
            {isChangeUp ? (
              <ArrowUpRight className="w-4 h-4 text-[var(--success)]" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-[var(--danger)]" />
            )}
            <span className={`text-sm font-semibold ${isChangeUp ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {isChangeUp ? '+' : ''}{change.toFixed(2)}
            </span>
            <span className={`text-xs ${isChangeUp ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              ({isChangeUp ? '+' : ''}{((change / 2340) * 100).toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          {isUp ? (
            <TrendingUp className="w-3 h-3 text-[var(--success)]" />
          ) : (
            <TrendingDown className="w-3 h-3 text-[var(--danger)]" />
          )}
          <span className={`text-xs ${isUp ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {isUp ? 'Bullish' : 'Bearish'} tick
          </span>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Session Timer Component
 * ──────────────────────────────────────────────────────────── */

function SessionTimer() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Convert to SAST (UTC+2)
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const hours = sast.getUTCHours()
  const minutes = sast.getUTCMinutes()
  const seconds = sast.getUTCSeconds()
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  // Trading window: 18:00 - 19:00 SAST
  const sessionStart = 18 * 60
  const sessionEnd = 19 * 60
  const currentMinutes = hours * 60 + minutes
  const isSession = currentMinutes >= sessionStart && currentMinutes < sessionEnd
  const isPreSession = currentMinutes >= sessionStart - 30 && currentMinutes < sessionStart
  const isPostSession = currentMinutes >= sessionEnd && currentMinutes < sessionEnd + 30

  // Time until session
  const minsUntilSession = sessionStart - currentMinutes
  const minsAfterSession = currentMinutes - sessionEnd

  let statusText = ''
  let statusVariant: 'neutral' | 'success' | 'warning' | 'accent' | 'purple' = 'neutral'
  if (isSession) {
    statusText = `ACTIVE — ${60 - minutes}m ${60 - seconds}s remaining`
    statusVariant = 'success'
  } else if (isPreSession) {
    statusText = `PRE-SESSION — Starts in ${Math.abs(minsUntilSession)}m`
    statusVariant = 'warning'
  } else if (isPostSession) {
    statusText = `POST-SESSION — Ended ${minsAfterSession}m ago`
    statusVariant = 'accent'
  } else {
    statusText = 'OFF SESSION'
    statusVariant = 'neutral'
  }

  return (
    <div className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover group" style={{ animationDelay: '60ms' }}>
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-[var(--purple)]/20 to-transparent opacity-30 blur-2xl group-hover:opacity-50 transition-opacity" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="w-4 h-4 text-[var(--purple)]" />
          <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] font-medium">Trading Session (SAST)</span>
        </div>

        <p className="text-3xl font-bold gradient-text font-mono">{timeStr}</p>

        <div className="mt-3">
          <Badge variant={statusVariant} size="md">{statusText}</Badge>
        </div>

        {/* Session progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--text-muted)]">18:00</span>
            <span className="text-[10px] text-[var(--text-muted)]">19:00</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden relative">
            {/* Active session indicator */}
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: isSession
                  ? `${((minutes - 60) / 60) * 100}%`
                  : currentMinutes < sessionStart ? '0%' : '100%',
                background: isSession
                  ? 'linear-gradient(90deg, var(--success), var(--cyan))'
                  : 'var(--bg-elevated)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Pre-Session Checklist Component
 * ──────────────────────────────────────────────────────────── */

function PreSessionChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([
    { id: 'trend', label: 'Identified trend bias (4H / 1H)', checked: false },
    { id: 'sr', label: 'Key S/R levels marked', checked: false },
    { id: 'news', label: 'Economic news reviewed', checked: false },
    { id: 'sentiment', label: 'Market sentiment checked', checked: false },
    { id: 'risk', label: 'Risk per trade confirmed (1%)', checked: false },
    { id: 'plan', label: 'Trade plan documented', checked: false },
  ])

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    )
  }

  const completed = items.filter((i) => i.checked).length
  const total = items.length
  const isReady = completed === total

  return (
    <div className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover" style={{ animationDelay: '120ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold">Pre-Session Checklist</h3>
        </div>
        <Badge variant={isReady ? 'success' : 'warning'} size="sm">
          {completed}/{total}
        </Badge>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--bg-card-hover)] transition-colors text-left"
          >
            {item.checked ? (
              <CheckCircle2 className="w-4 h-4 text-[var(--success)] flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
            )}
            <span className={`text-xs ${item.checked ? 'text-[var(--text-primary)] line-through opacity-70' : 'text-[var(--text-secondary)]'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {isReady && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/20">
          <Zap className="w-3.5 h-3.5 text-[var(--success)]" />
          <span className="text-xs text-[var(--success)] font-medium">Ready to trade</span>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Risk Calculator Component
 * ──────────────────────────────────────────────────────────── */

function RiskCalculator() {
  const [accountSize, setAccountSize] = useState(10000)
  const [riskPercent, setRiskPercent] = useState(1)
  const [entry, setEntry] = useState(2345.00)
  const [sl, setSl] = useState(2340.00)
  const [tp, setTp] = useState(2352.50)

  const riskAmount = accountSize * (riskPercent / 100)
  const slPips = Math.abs(entry - sl) * 10 // XAUUSD: 1 pip = $0.10
  const tpPips = Math.abs(tp - entry) * 10
  const rrRatio = slPips > 0 ? (tpPips / slPips).toFixed(2) : '—'
  // Lot size: risk / (slPips * pipValue), pip value for XAUUSD = $1 per 0.01 lot per pip
  const pipValue = 10 // simplified: $10 per standard lot per pip for XAUUSD approx
  const lotSize = slPips > 0 ? (riskAmount / (slPips * pipValue)).toFixed(2) : '—'

  return (
    <div className="animate-slide-up relative overflow-hidden rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover" style={{ animationDelay: '180ms' }}>
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="w-4 h-4 text-[var(--cyan)]" />
        <h3 className="text-sm font-semibold">Risk Calculator</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Account Size ($)</label>
          <input
            type="number"
            value={accountSize}
            onChange={(e) => setAccountSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Risk (%)</label>
          <input
            type="number"
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value))}
            step={0.1}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Entry Price</label>
          <input
            type="number"
            value={entry}
            onChange={(e) => setEntry(Number(e.target.value))}
            step={0.01}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Stop Loss</label>
          <input
            type="number"
            value={sl}
            onChange={(e) => setSl(Number(e.target.value))}
            step={0.01}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--danger)] focus:outline-none focus:border-[var(--danger)] transition-colors"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Take Profit</label>
          <input
            type="number"
            value={tp}
            onChange={(e) => setTp(Number(e.target.value))}
            step={0.01}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--success)] focus:outline-none focus:border-[var(--success)] transition-colors"
          />
        </div>
      </div>

      {/* Results */}
      <div className="mt-4 p-3 rounded-xl bg-[var(--bg-input)]/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Risk Amount</span>
          <span className="text-sm font-semibold text-[var(--danger)]">${riskAmount.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">SL Pips</span>
          <span className="text-sm font-medium text-[var(--text-secondary)]">{slPips.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">TP Pips</span>
          <span className="text-sm font-medium text-[var(--text-secondary)]">{tpPips.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">R:R Ratio</span>
          <span className="text-sm font-semibold text-[var(--accent)]">{rrRatio}</span>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Lot Size</span>
          <span className="text-sm font-bold text-[var(--warning)]">{lotSize}</span>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Monte Carlo Histogram (CSS bars)
 * ──────────────────────────────────────────────────────────── */

function MonteCarloHistogram({ buckets }: { buckets: HistogramBucket[] }) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1)

  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold">Simulation Outcomes Distribution</h3>
        </div>
        <Badge variant="accent" size="sm">10K sims</Badge>
      </div>

      <div className="flex items-end gap-1 h-40">
        {buckets.map((bucket, i) => {
          const height = (bucket.count / maxCount) * 100
          const isAboveMedian = i >= buckets.length / 2
          return (
            <div
              key={i}
              className="flex-1 rounded-t transition-all duration-500 group relative cursor-default"
              style={{
                height: `${Math.max(height, 2)}%`,
                background: isAboveMedian
                  ? 'linear-gradient(to top, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.7))'
                  : 'linear-gradient(to top, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.7))',
              }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <p className="text-[10px] text-[var(--text-primary)] font-medium">{bucket.label}</p>
                <p className="text-[9px] text-[var(--text-muted)]">{bucket.count} sims ({bucket.percentage.toFixed(1)}%)</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-[var(--text-muted)]">{buckets[0]?.label}</span>
        <span className="text-[9px] text-[var(--text-muted)]">{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Equity Curve Chart (SVG line)
 * ──────────────────────────────────────────────────────────── */

function EquityCurveChart({ curve }: { curve: number[] }) {
  if (!curve || curve.length === 0) return null

  const min = Math.min(...curve)
  const max = Math.max(...curve)
  const range = max - min || 1
  const width = 600
  const height = 160
  const padding = 10

  const points = curve.map((val, i) => {
    const x = padding + (i / (curve.length - 1)) * (width - 2 * padding)
    const y = height - padding - ((val - min) / range) * (height - 2 * padding)
    return `${x},${y}`
  })

  const pathD = `M${points.join(' L')}`

  // Area fill
  const areaD = `${pathD} L${width - padding},${height - padding} L${padding},${height - padding} Z`

  // Color based on start vs end
  const isProfitable = curve[curve.length - 1] >= curve[0]

  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] p-5 card-hover" style={{ animationDelay: '360ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--success)]" />
          <h3 className="text-sm font-semibold">Equity Curve (Median)</h3>
        </div>
        <Badge variant={isProfitable ? 'success' : 'danger'} size="sm">
          {isProfitable ? 'Profitable' : 'Losing'}
        </Badge>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" preserveAspectRatio="none">
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isProfitable ? '#22c55e' : '#ef4444'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isProfitable ? '#22c55e' : '#ef4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={padding}
            y1={height - padding - pct * (height - 2 * padding)}
            x2={width - padding}
            y2={height - padding - pct * (height - 2 * padding)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}
        {/* Area fill */}
        <path d={areaD} fill="url(#equityGrad)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke={isProfitable ? '#22c55e' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-[var(--text-muted)]">Start: ${curve[0].toLocaleString()}</span>
        <span className="text-[10px] text-[var(--text-secondary)] font-medium">
          Trade #{curve.length - 1}
        </span>
        <span className={`text-[10px] font-medium ${isProfitable ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
          End: ${curve[curve.length - 1].toLocaleString()}
        </span>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Monte Carlo Metrics
 * ──────────────────────────────────────────────────────────── */

function MonteCarloMetrics({ sim }: { sim: SimulationResult }) {
  const metrics = [
    { label: 'Median Balance', value: `$${sim.medianBalance.toLocaleString()}`, color: 'blue' as const },
    { label: 'Win Rate', value: `${sim.winRate.toFixed(1)}%`, color: 'green' as const },
    { label: 'Max Drawdown', value: `${sim.maxDrawdown.toFixed(1)}%`, color: 'red' as const },
    { label: 'Profit Factor', value: sim.profitFactor.toFixed(2), color: 'purple' as const },
    { label: 'Sharpe Ratio', value: sim.sharpeRatio.toFixed(2), color: 'blue' as const },
    { label: 'Best Case', value: `$${sim.bestCase.toLocaleString()}`, color: 'green' as const },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {metrics.map((m, i) => (
        <div key={i} className="animate-slide-up rounded-xl glass-panel border border-[var(--border)] p-3 card-hover" style={{ animationDelay: `${i * 60}ms` }}>
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{m.label}</span>
          <p className="text-lg font-bold gradient-text mt-1">{m.value}</p>
        </div>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Trade Log Table
 * ──────────────────────────────────────────────────────────── */

function TradeLogTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="animate-slide-up rounded-2xl glass-panel border border-[var(--border)] overflow-hidden card-hover" style={{ animationDelay: '420ms' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--warning)]" />
          <h3 className="text-sm font-semibold">Trade Log</h3>
        </div>
        <Badge variant="accent" size="sm">{trades.length} trades</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Date</th>
              <th className="px-4 py-3 text-left text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Direction</th>
              <th className="px-4 py-3 text-right text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Entry</th>
              <th className="px-4 py-3 text-right text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">SL</th>
              <th className="px-4 py-3 text-right text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">TP</th>
              <th className="px-4 py-3 text-center text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">Result</th>
              <th className="px-4 py-3 text-right text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">R:R</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {trades.map((trade) => {
              const date = new Date(trade.date)
              const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const resultVariant =
                trade.result === 'WIN' ? 'success' :
                trade.result === 'LOSS' ? 'danger' :
                trade.result === 'BREAKEVEN' ? 'warning' : 'neutral'

              return (
                <tr key={trade.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{formattedDate}</td>
                  <td className="px-4 py-3">
                    <Badge variant={trade.direction === 'BUY' ? 'success' : 'danger'} size="sm">
                      {trade.direction === 'BUY' ? (
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 mr-1" />
                      )}
                      {trade.direction}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-primary)] text-right font-mono">{trade.entry.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--danger)] text-right font-mono">{trade.sl.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--success)] text-right font-mono">{trade.tp.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={resultVariant} size="sm">{trade.result}</Badge>
                  </td>
                  <td className={`px-4 py-3 text-xs text-right font-mono font-medium ${trade.rr >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {trade.rr > 0 ? '+' : ''}{trade.rr.toFixed(1)}R
                  </td>
                </tr>
              )
            })}
            {trades.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)] text-xs">
                  No trades logged yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
 * Main Page
 * ──────────────────────────────────────────────────────────── */

export default function TradingPage() {
  const {
    data: apiData,
    isLoading,
  } = useSupabaseQuery<TradingApiResponse>('/api/trading', 30000)

  const [simulation, setSimulation] = useState<SimulationResult>(MOCK_SIMULATION)
  const [simRunning, setSimRunning] = useState(false)
  const [simParams, setSimParams] = useState({
    initialBalance: 10000,
    riskPerTrade: 1,
    winRate: 55,
    rewardRatio: 1.5,
    numTrades: 252,
    numSimulations: 10000,
  })

  const trades = apiData?.trades && apiData.trades.length > 0
    ? apiData.trades
    : !isLoading && apiData?.tableExists === false
      ? MOCK_TRADES
      : apiData?.trades ?? MOCK_TRADES

  const performance = apiData?.performance && apiData.performance.totalTrades > 0
    ? apiData.performance
    : MOCK_PERFORMANCE

  const runSimulation = useCallback(async () => {
    setSimRunning(true)
    try {
      const res = await fetch('/api/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run-simulation',
          ...simParams,
          winRate: simParams.winRate / 100,
          riskPerTrade: simParams.riskPerTrade / 100,
        }),
      })
      const data = await res.json()
      if (data.simulation) {
        setSimulation(data.simulation)
      }
    } catch {
      // Use mock simulation on error
      setSimulation(MOCK_SIMULATION)
    } finally {
      setSimRunning(false)
    }
  }, [simParams])

  return (
    <div className="space-y-6">
      {/* Phase Indicator */}
      <div className="animate-slide-up flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold gradient-text">Trading Platform</h1>
            <Badge variant="warning" size="md">
              <AlertTriangle className="w-3 h-3 mr-1" />
              DEMO TRADING
            </Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Phase 1 — XAU/USD · Quant Edge Strategy · S/R + Momentum Continuation
          </p>
        </div>
      </div>

      {/* Top Row: Price + Session Timer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <LivePriceDisplay />
        <SessionTimer />
      </div>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 stagger">
        <Card
          label="Win Rate"
          value={`${performance.winRate.toFixed(1)}%`}
          subtitle={`${performance.totalTrades} trades`}
          icon={Target}
          color="green"
          delay={0}
        />
        <Card
          label="Avg R:R"
          value={`${performance.avgRR.toFixed(2)}R`}
          subtitle="Risk-Reward"
          icon={TrendingUp}
          color="blue"
          delay={60}
        />
        <Card
          label="Profit Factor"
          value={performance.profitFactor.toFixed(2)}
          subtitle="Gross P / Gross L"
          icon={DollarSign}
          color="purple"
          delay={120}
        />
        <Card
          label="Max Drawdown"
          value={`${performance.maxDrawdown.toFixed(1)}%`}
          subtitle="Peak-to-trough"
          icon={Shield}
          color="red"
          delay={180}
        />
        <Card
          label="Total Trades"
          value={performance.totalTrades}
          subtitle="Settled positions"
          icon={BarChart3}
          color="blue"
          delay={240}
        />
      </div>

      {/* Middle Row: Checklist + Risk Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <PreSessionChecklist />
        <RiskCalculator />
      </div>

      {/* Monte Carlo Section */}
      <div className="animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--warning)]" />
            <h2 className="text-lg font-semibold">Monte Carlo Simulation</h2>
          </div>
          <button
            onClick={runSimulation}
            disabled={simRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all disabled:opacity-50"
          >
            {simRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="text-xs">{simRunning ? 'Running...' : 'Run Simulation'}</span>
          </button>
        </div>

        {/* Sim params */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
          {[
            { label: 'Balance', key: 'initialBalance' as const, suffix: '$' },
            { label: 'Risk %', key: 'riskPerTrade' as const, suffix: '%' },
            { label: 'Win Rate', key: 'winRate' as const, suffix: '%' },
            { label: 'R:R', key: 'rewardRatio' as const, suffix: ':1' },
            { label: 'Trades', key: 'numTrades' as const, suffix: '' },
            { label: 'Sims', key: 'numSimulations' as const, suffix: '' },
          ].map((param) => (
            <div key={param.key}>
              <label className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{param.label}</label>
              <input
                type="number"
                value={simParams[param.key]}
                onChange={(e) => setSimParams((prev) => ({ ...prev, [param.key]: Number(e.target.value) }))}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>
          ))}
        </div>

        {/* Monte Carlo Metrics */}
        <MonteCarloMetrics sim={simulation} />
      </div>

      {/* Charts Row: Histogram + Equity Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <MonteCarloHistogram buckets={simulation.histogram} />
        <EquityCurveChart curve={simulation.equityCurve} />
      </div>

      {/* Trade Log */}
      <TradeLogTable trades={trades} />
    </div>
  )
}
