import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

/* ──────────────────────────────────────────────────────────────
 * Supabase table migration SQL:
 *
 * CREATE TABLE IF NOT EXISTS hush_alerts (
 *   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   severity    text NOT NULL DEFAULT 'info',
 *   title       text NOT NULL,
 *   description text,
 *   source      text,
 *   status      text DEFAULT 'open',
 *   created_at  timestamptz DEFAULT now()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_hush_alerts_created
 *   ON hush_alerts (created_at DESC);
 * ────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────── */

interface HushAlertRow {
  id: string
  severity: string
  title: string
  description: string | null
  source: string | null
  status: string
  created_at: string
}

interface HushApiResponse {
  alerts: HushAlertRow[]
  stats: {
    totalAlerts: number
    criticalAlerts: number
    openAlerts: number
    scansRunning: number
    threatsToday: number
    networkNodes: number
    nodesOnline: number
  }
  tableExists: boolean
}

/* ──────────────────────────────────────────────────────────────
 * Mock / Placeholder Data
 * ────────────────────────────────────────────────────────────── */

function getPlaceholderResponse(): HushApiResponse {
  return {
    alerts: [],
    stats: {
      totalAlerts: 0,
      criticalAlerts: 0,
      openAlerts: 0,
      scansRunning: 0,
      threatsToday: 0,
      networkNodes: 0,
      nodesOnline: 0,
    },
    tableExists: false,
  }
}

/* ──────────────────────────────────────────────────────────────
 * GET /api/hush — Returns alerts, scan results, network status, threat intel
 * ────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`hush:get:${key}`, 60, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  try {
    // Fetch alerts from Supabase
    const { data: alerts, error: alertsError } = await supabase
      .from('hush_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (alertsError) {
      if (alertsError.message?.includes('does not exist') || alertsError.code === '42P01') {
        return NextResponse.json(
          getPlaceholderResponse(),
          { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
        )
      }
    }

    const alertList = (alerts ?? []) as HushAlertRow[]

    // Compute stats from alerts
    const totalAlerts = alertList.length
    const criticalAlerts = alertList.filter((a) => a.severity === 'critical').length
    const openAlerts = alertList.filter((a) => a.status === 'open').length

    return NextResponse.json({
      alerts: alertList,
      stats: {
        totalAlerts,
        criticalAlerts,
        openAlerts,
        scansRunning: 1,      // Placeholder — would come from scan orchestration
        threatsToday: 12,     // Placeholder — would come from threat intel feeds
        networkNodes: 8,      // Placeholder — would come from network monitoring
        nodesOnline: 6,       // Placeholder
      },
      tableExists: true,
    } satisfies HushApiResponse, {
      headers: { ...NO_STORE, ...rateLimitHeaders(rl) },
    })
  } catch {
    return NextResponse.json(
      getPlaceholderResponse(),
      { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }
}

/* ──────────────────────────────────────────────────────────────
 * POST /api/hush — Create alert or update alert status
 * ────────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`hush:mutate:${key}`, 10, 60000)
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

    // ── Create new alert ──
    if (action === 'create-alert') {
      const { severity, title, description, source } = body

      if (!title) {
        return NextResponse.json(
          { error: 'Missing required field: title' },
          { status: 400, headers: NO_STORE }
        )
      }

      const { data, error } = await supabase
        .from('hush_alerts')
        .insert({
          severity: severity || 'info',
          title,
          description: description || null,
          source: source || null,
          status: 'open',
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: `Failed to create alert: ${error.message}` },
          { status: 500, headers: NO_STORE }
        )
      }

      return NextResponse.json({ alert: data }, { headers: NO_STORE })
    }

    // ── Update alert status ──
    if (action === 'update-status') {
      const { id, status } = body

      if (!id || !status) {
        return NextResponse.json(
          { error: 'Missing required fields: id, status' },
          { status: 400, headers: NO_STORE }
        )
      }

      const validStatuses = ['open', 'investigating', 'resolved', 'dismissed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400, headers: NO_STORE }
        )
      }

      const { data, error } = await supabase
        .from('hush_alerts')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: `Failed to update alert: ${error.message}` },
          { status: 500, headers: NO_STORE }
        )
      }

      return NextResponse.json({ alert: data }, { headers: NO_STORE })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "create-alert" or "update-status".' },
      { status: 400, headers: NO_STORE }
    )
  } catch (error) {
    return NextResponse.json(
      { error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500, headers: NO_STORE }
    )
  }
}
