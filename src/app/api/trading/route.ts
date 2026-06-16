import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { runMonteCarlo, type MonteCarloParams } from '@/lib/monte-carlo'
import crypto from 'crypto'

/*
 * ──────────────────────────────────────────────────────────────
 * Supabase table migration SQL — run this in your Supabase SQL editor:
 *
 * CREATE TABLE IF NOT EXISTS trades (
 *   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   date        timestamptz NOT NULL DEFAULT now(),
 *   direction   text NOT NULL CHECK (direction IN ('BUY', 'SELL')),
 *   entry       numeric(10,2) NOT NULL,
 *   sl          numeric(10,2) NOT NULL,
 *   tp          numeric(10,2) NOT NULL,
 *   result      text NOT NULL DEFAULT 'PENDING' CHECK (result IN ('WIN', 'LOSS', 'BREAKEVEN', 'PENDING')),
 *   rr          numeric(5,2) NOT NULL DEFAULT 0,
 *   notes       text,
 *   created_at  timestamptz NOT NULL DEFAULT now()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_trades_date
 *   ON trades (date DESC);
 *
 * CREATE TABLE IF NOT EXISTS monte_carlo_results (
 *   id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   date          timestamptz NOT NULL DEFAULT now(),
 *   win_rate      numeric(5,2) NOT NULL,
 *   max_drawdown  numeric(5,2) NOT NULL,
 *   profit_factor numeric(5,2) NOT NULL,
 *   sharpe_ratio  numeric(5,2) NOT NULL,
 *   simulations   integer NOT NULL DEFAULT 10000,
 *   params        jsonb,
 *   created_at    timestamptz NOT NULL DEFAULT now()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_monte_carlo_date
 *   ON monte_carlo_results (date DESC);
 * ──────────────────────────────────────────────────────────────
 */

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NO_STORE = { 'Cache-Control': 'no-store' } as const

function getClientKey(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  const ip = xff?.split(',')[0]?.trim() || 'unknown'
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

function checkCsrf(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token')
  const cookie = request.cookies.get('csrf-token')?.value
  if (!token || !cookie) return false
  if (token.length !== cookie.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cookie))
  } catch {
    return false
  }
}

function rateLimitHeaders(rl: { success: boolean; remaining: number; retryAfter?: number }) {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': String(rl.remaining),
  }
  if (!rl.success && rl.retryAfter) {
    headers['Retry-After'] = String(rl.retryAfter)
  }
  return headers
}

interface TradeRow {
  id: string
  date: string
  direction: string
  entry: number
  sl: number
  tp: number
  result: string
  rr: number
  notes: string | null
}

interface MonteCarloRow {
  id: string
  date: string
  win_rate: number
  max_drawdown: number
  profit_factor: number
  sharpe_ratio: number
  simulations: number
}

interface TradingApiResponse {
  trades: TradeRow[]
  monteCarlo: MonteCarloRow[]
  performance: {
    totalTrades: number
    winRate: number
    avgRR: number
    profitFactor: number
    maxDrawdown: number
  }
  tableExists: boolean
}

/** GET /api/trading — Returns trades, latest Monte Carlo results, and performance metrics */
export async function GET(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`trading:get:${key}`, 60, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  try {
    // Get recent trades
    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .order('date', { ascending: false })
      .limit(100)

    if (tradesError) {
      if (tradesError.message?.includes('does not exist') || tradesError.code === '42P01') {
        return NextResponse.json({
          trades: [],
          monteCarlo: [],
          performance: { totalTrades: 0, winRate: 0, avgRR: 0, profitFactor: 0, maxDrawdown: 0 },
          tableExists: false,
        } satisfies TradingApiResponse, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
      }
    }

    // Get latest Monte Carlo results
    const { data: monteCarlo } = await supabase
      .from('monte_carlo_results')
      .select('*')
      .order('date', { ascending: false })
      .limit(10)

    // Compute performance from trades
    const tradeList = (trades ?? []) as TradeRow[]
    const settledTrades = tradeList.filter((t) => t.result === 'WIN' || t.result === 'LOSS')
    const totalTrades = settledTrades.length
    const wins = settledTrades.filter((t) => t.result === 'WIN').length
    const losses = settledTrades.filter((t) => t.result === 'LOSS').length
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
    const avgRR = totalTrades > 0
      ? settledTrades.reduce((sum, t) => sum + t.rr, 0) / totalTrades
      : 0
    const grossProfit = settledTrades
      .filter((t) => t.result === 'WIN')
      .reduce((sum, t) => sum + t.rr, 0)
    const grossLoss = Math.abs(
      settledTrades
        .filter((t) => t.result === 'LOSS')
        .reduce((sum, t) => sum + t.rr, 0)
    )
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

    // Simple max drawdown calculation from trade equity curve
    let equity = 10000
    let peak = equity
    let maxDD = 0
    for (const t of settledTrades) {
      if (t.result === 'WIN') equity += equity * 0.01 * t.rr
      else equity -= equity * 0.01
      if (equity > peak) peak = equity
      const dd = (peak - equity) / peak
      if (dd > maxDD) maxDD = dd
    }

    return NextResponse.json({
      trades: tradeList,
      monteCarlo: monteCarlo ?? [],
      performance: {
        totalTrades,
        winRate,
        avgRR,
        profitFactor: profitFactor === Infinity ? 999 : profitFactor,
        maxDrawdown: maxDD * 100,
      },
      tableExists: true,
    } satisfies TradingApiResponse, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
  } catch {
    return NextResponse.json({
      trades: [],
      monteCarlo: [],
      performance: { totalTrades: 0, winRate: 0, avgRR: 0, profitFactor: 0, maxDrawdown: 0 },
      tableExists: false,
    } satisfies TradingApiResponse, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
  }
}

/** POST /api/trading — Log a new trade or run Monte Carlo simulation */
export async function POST(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`trading:mutate:${key}`, 10, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  const isInternal = request.headers.get('x-internal-cron') === 'true'
  if (!isInternal && !checkCsrf(request)) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403, headers: NO_STORE }
    )
  }

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'run-simulation') {
      // Run Monte Carlo simulation server-side
      const params: Partial<MonteCarloParams> = {
        initialBalance: body.initialBalance,
        riskPerTrade: body.riskPerTrade,
        winRate: body.winRate,
        rewardRatio: body.rewardRatio,
        numTrades: body.numTrades,
        numSimulations: body.numSimulations,
      }

      const result = runMonteCarlo(params)

      // Optionally store result in Supabase
      try {
        await supabase.from('monte_carlo_results').insert({
          win_rate: result.winRate,
          max_drawdown: result.maxDrawdown,
          profit_factor: result.profitFactor,
          sharpe_ratio: result.sharpeRatio,
          simulations: params.numSimulations ?? 10000,
          params: params,
        })
      } catch {
        // Non-fatal — table may not exist
      }

      return NextResponse.json({ simulation: result }, { headers: NO_STORE })
    }

    if (action === 'log-trade') {
      const { direction, entry, sl, tp, result, notes } = body

      if (!direction || !entry || !sl || !tp) {
        return NextResponse.json(
          { error: 'Missing required fields: direction, entry, sl, tp' },
          { status: 400, headers: NO_STORE }
        )
      }

      // Calculate RR
      const risk = Math.abs(entry - sl)
      const reward = Math.abs(tp - entry)
      const rr = risk > 0 ? Number((reward / risk).toFixed(2)) : 0

      const { data, error } = await supabase
        .from('trades')
        .insert({
          direction: direction.toUpperCase(),
          entry,
          sl,
          tp,
          result: result?.toUpperCase() || 'PENDING',
          rr,
          notes,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: `Failed to log trade: ${error.message}` },
          { status: 500, headers: NO_STORE }
        )
      }

      return NextResponse.json({ trade: data }, { headers: NO_STORE })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "run-simulation" or "log-trade".' },
      { status: 400, headers: NO_STORE }
    )
  } catch (error) {
    return NextResponse.json(
      { error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500, headers: NO_STORE }
    )
  }
}
