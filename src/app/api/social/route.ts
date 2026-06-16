import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { fetchAllSocialMetrics } from '@/lib/social-metrics'
import crypto from 'crypto'

/*
 * ──────────────────────────────────────────────────────────────
 * Supabase table migration SQL — run this in your Supabase SQL editor:
 *
 * CREATE TABLE IF NOT EXISTS social_metrics (
 *   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   platform    text NOT NULL,          -- youtube, twitter, discord, github, website
 *   followers   integer NOT NULL DEFAULT 0,
 *   growth      numeric(5,2) NOT NULL DEFAULT 0,   -- weekly growth %
 *   engagement  numeric(5,2) NOT NULL DEFAULT 0,   -- engagement score 0-100
 *   recorded_at timestamptz NOT NULL DEFAULT now(),
 *   created_at  timestamptz NOT NULL DEFAULT now()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_social_metrics_platform_recorded
 *   ON social_metrics (platform, recorded_at DESC);
 *
 * CREATE TABLE IF NOT EXISTS social_growth_history (
 *   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   platform    text NOT NULL,
 *   followers   integer NOT NULL DEFAULT 0,
 *   recorded_at date NOT NULL DEFAULT CURRENT_DATE,
 *   created_at  timestamptz NOT NULL DEFAULT now(),
 *   UNIQUE(platform, recorded_at)
 * );
 *
 * CREATE TABLE IF NOT EXISTS social_content_calendar (
 *   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   platform    text NOT NULL,
 *   title       text NOT NULL,
 *   description text,
 *   scheduled_at timestamptz NOT NULL,
 *   status      text NOT NULL DEFAULT 'scheduled', -- scheduled, published, cancelled
 *   created_at  timestamptz NOT NULL DEFAULT now()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_content_calendar_scheduled
 *   ON social_content_calendar (scheduled_at ASC);
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

/** GET /api/social — Returns latest social media metrics + growth history + calendar */
export async function GET(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`social:get:${key}`, 60, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  try {
    // Get latest metrics per platform
    const { data: latestMetrics, error: metricsError } = await supabase
      .from('social_metrics')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(50)

    if (metricsError) {
      // Table might not exist yet — return empty state
      if (metricsError.message?.includes('does not exist') || metricsError.code === '42P01') {
        return NextResponse.json({
          metrics: [],
          growthHistory: [],
          calendar: [],
          tableExists: false,
        }, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
      }
    }

    // Get unique latest entry per platform
    const platformMap = new Map<string, typeof latestMetrics extends (infer T)[] | null ? T : never>()
    for (const row of latestMetrics ?? []) {
      if (!platformMap.has(row.platform)) {
        platformMap.set(row.platform, row)
      }
    }
    const metrics = Array.from(platformMap.values())

    // Get growth history for charts (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: growthHistory } = await supabase
      .from('social_growth_history')
      .select('*')
      .gte('recorded_at', thirtyDaysAgo.toISOString().split('T')[0])
      .order('recorded_at', { ascending: true })

    // Get upcoming calendar entries
    const { data: calendar } = await supabase
      .from('social_content_calendar')
      .select('*')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20)

    return NextResponse.json({
      metrics: metrics ?? [],
      growthHistory: growthHistory ?? [],
      calendar: calendar ?? [],
      tableExists: true,
    }, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
  } catch {
    return NextResponse.json({
      metrics: [],
      growthHistory: [],
      calendar: [],
      tableExists: false,
    }, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
  }
}

/** POST /api/social — Update metrics (called by cron / manual refresh) */
export async function POST(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`social:mutate:${key}`, 10, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  // Allow cron calls via internal header or CSRF
  const isInternal = request.headers.get('x-internal-cron') === 'true'
  if (!isInternal && !checkCsrf(request)) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403, headers: NO_STORE }
    )
  }

  try {
    // Fetch fresh metrics from all platforms
    const socialMetrics = await fetchAllSocialMetrics()
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const platformEntries = Object.entries(socialMetrics).map(([platform, stats]) => ({
      platform,
      followers: stats.followers,
      growth: stats.growth,
      engagement: stats.engagement,
      recorded_at: now,
    }))

    // Insert current metrics
    const { error: insertError } = await supabase
      .from('social_metrics')
      .insert(platformEntries)

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to insert metrics: ${insertError.message}` },
        { status: 500, headers: NO_STORE }
      )
    }

    // Upsert growth history (one row per platform per day)
    const historyEntries = Object.entries(socialMetrics).map(([platform, stats]) => ({
      platform,
      followers: stats.followers,
      recorded_at: today,
    }))

    const { error: historyError } = await supabase
      .from('social_growth_history')
      .upsert(historyEntries, { onConflict: 'platform,recorded_at' })

    if (historyError) {
      // Non-fatal — growth history is supplementary
      console.error('Failed to upsert growth history:', historyError.message)
    }

    return NextResponse.json({
      success: true,
      updatedAt: now,
      platforms: Object.keys(socialMetrics),
    }, { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json(
      { error: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500, headers: NO_STORE }
    )
  }
}
