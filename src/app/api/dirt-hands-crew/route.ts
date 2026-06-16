import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

/* ──────────────────────────────────────────────────────────────
 * Supabase table migration SQL — run this in your Supabase SQL editor:
 *
 * CREATE TABLE IF NOT EXISTS dirt_hands_crew (
 *   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name        text NOT NULL,
 *   description text,
 *   category    text,
 *   status      text NOT NULL DEFAULT 'idea',        -- idea, in-progress, done
 *   url         text,
 *   metadata    jsonb,
 *   created_at  timestamptz NOT NULL DEFAULT now(),
 *   updated_at  timestamptz NOT NULL DEFAULT now()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_dhc_category
 *   ON dirt_hands_crew (category);
 *
 * CREATE INDEX IF NOT EXISTS idx_dhc_status
 *   ON dirt_hands_crew (status);
 *
 * ALTER TABLE dirt_hands_crew ENABLE ROW LEVEL SECURITY;
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

/** GET /api/dirt-hands-crew — Returns all Dirt Hands Crew items */
export async function GET(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`dhc:get:${key}`, 60, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')

    let query = supabase
      .from('dirt_hands_crew')
      .select('*')
      .order('created_at', { ascending: false })

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json(
          { items: [], tableExists: false },
          { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
        )
      }
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
      )
    }

    return NextResponse.json(
      { items: data ?? [], tableExists: true },
      { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  } catch {
    return NextResponse.json(
      { items: [], tableExists: false },
      { headers: { ...NO_STORE } }
    )
  }
}

/** POST /api/dirt-hands-crew — Create a new item */
export async function POST(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`dhc:mutate:${key}`, 20, 60000)
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

  try {
    const body = await request.json()
    const { name, description, category, status, url, metadata } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400, headers: NO_STORE }
      )
    }

    const validCategories = ['model', 'texture', 'sound', 'build', 'team', 'link', 'milestone']
    const validStatuses = ['idea', 'in-progress', 'done']

    const item = {
      name: name.trim(),
      description: (description ?? '').trim(),
      category: validCategories.includes(category) ? category : null,
      status: validStatuses.includes(status) ? status : 'idea',
      url: (url ?? '').trim() || null,
      metadata: metadata && typeof metadata === 'object' ? metadata : null,
    }

    const { data, error } = await supabase
      .from('dirt_hands_crew')
      .insert(item)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to create item: ${error.message}` },
        { status: 500, headers: NO_STORE }
      )
    }

    return NextResponse.json({ item: data }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400, headers: NO_STORE }
    )
  }
}

/** PATCH /api/dirt-hands-crew — Update an item */
export async function PATCH(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`dhc:mutate:${key}`, 20, 60000)
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

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Item id is required' },
        { status: 400, headers: NO_STORE }
      )
    }

    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const validStatuses = ['idea', 'in-progress', 'done']
    const validCategories = ['model', 'texture', 'sound', 'build', 'team', 'link', 'milestone']

    if (updates.status && validStatuses.includes(updates.status)) {
      updateFields.status = updates.status
    }
    if (updates.name && typeof updates.name === 'string') {
      updateFields.name = updates.name.trim()
    }
    if (updates.description !== undefined && typeof updates.description === 'string') {
      updateFields.description = updates.description.trim()
    }
    if (updates.category !== undefined) {
      updateFields.category = validCategories.includes(updates.category) ? updates.category : null
    }
    if (updates.url !== undefined) {
      updateFields.url = (updates.url ?? '').trim() || null
    }
    if (updates.metadata !== undefined) {
      updateFields.metadata = updates.metadata && typeof updates.metadata === 'object' ? updates.metadata : null
    }

    if (Object.keys(updateFields).length <= 1) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400, headers: NO_STORE }
      )
    }

    const { data, error } = await supabase
      .from('dirt_hands_crew')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to update item: ${error.message}` },
        { status: 500, headers: NO_STORE }
      )
    }

    return NextResponse.json({ item: data }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400, headers: NO_STORE }
    )
  }
}

/** DELETE /api/dirt-hands-crew — Delete an item */
export async function DELETE(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`dhc:mutate:${key}`, 20, 60000)
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

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Item id is required' },
        { status: 400, headers: NO_STORE }
      )
    }

    const { error } = await supabase
      .from('dirt_hands_crew')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete item: ${error.message}` },
        { status: 500, headers: NO_STORE }
      )
    }

    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400, headers: NO_STORE }
    )
  }
}
