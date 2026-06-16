import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  dataQuerySchema,
  dataMutationSchema,
  dataPatchSchema,
} from '@/lib/validation'
import crypto from 'crypto'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Get a stable client identifier for rate limiting.
 * Uses a hash of x-forwarded-for to prevent spoofing while still
 * being stable for the same client behind a proxy.
 * Falls back to 'unknown' if no header present.
 */
function getClientKey(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  const ip = xff?.split(',')[0]?.trim() || 'unknown'
  // Hash to prevent memory exhaustion from random XFF values
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

/**
 * Timing-safe CSRF token comparison to prevent timing side-channel attacks.
 */
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

export async function GET(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`get:${key}`, 60, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  const { searchParams } = new URL(request.url)
  const parsed = dataQuerySchema.safeParse({
    table: searchParams.get('table'),
    limit: searchParams.get('limit') || undefined,
    order: searchParams.get('order') || undefined,
    id: searchParams.get('id') || undefined,
    job_id: searchParams.get('job_id') || undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}` },
      { status: 400, headers: NO_STORE }
    )
  }

  const { table, limit, offset, order, id, job_id } = parsed.data
  const [field, direction] = order.split('.')

  let query = supabase.from(table).select('*')

  if (id) {
    query = query.eq('id', id)
  }

  if (job_id) {
    query = query.eq('job_id', job_id)
  }

  const { data, error } = await query
    .order(field, { ascending: direction === 'asc' })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_STORE }
    )
  }

  return NextResponse.json(data, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
}

export async function POST(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`mutate:${key}`, 30, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  if (!checkCsrf(request)) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403, headers: NO_STORE }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: NO_STORE }
    )
  }

  const parsed = dataMutationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}` },
      { status: 400, headers: NO_STORE }
    )
  }

  const { table, data } = parsed.data

  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_STORE }
    )
  }

  return NextResponse.json(result, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
}

export async function PATCH(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`mutate:${key}`, 30, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  if (!checkCsrf(request)) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403, headers: NO_STORE }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: NO_STORE }
    )
  }

  const parsed = dataPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}` },
      { status: 400, headers: NO_STORE }
    )
  }

  const { table, id, data } = parsed.data

  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_STORE }
    )
  }

  return NextResponse.json(result, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
}

export async function DELETE(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`delete:${key}`, 30, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  if (!checkCsrf(request)) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403, headers: NO_STORE }
    )
  }

  const { searchParams } = new URL(request.url)
  const parsed = dataQuerySchema.safeParse({
    table: searchParams.get('table'),
    id: searchParams.get('id'),
  })

  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json(
      { error: 'Table and valid UUID id required' },
      { status: 400, headers: NO_STORE }
    )
  }

  const { table, id } = parsed.data

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: NO_STORE }
    )
  }

  return NextResponse.json({ success: true }, { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } })
}
