import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

/*
 * ──────────────────────────────────────────────────────────────
 * Supabase table migration SQL — run this in your Supabase SQL editor:
 *
 * CREATE TABLE IF NOT EXISTS fun_projects (
 *   id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name        text NOT NULL,
 *   description text,
 *   category    text NOT NULL DEFAULT 'experiment',
 *   status      text NOT NULL DEFAULT 'idea',        -- idea, building, live
 *   url         text,
 *   image_url   text,
 *   created_at  timestamptz NOT NULL DEFAULT now(),
 *   updated_at  timestamptz NOT NULL DEFAULT now()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_fun_projects_category
 *   ON fun_projects (category);
 *
 * CREATE INDEX IF NOT EXISTS idx_fun_projects_status
 *   ON fun_projects (status);
 *
 * -- Enable Row Level Security (optional — add policies as needed)
 * ALTER TABLE fun_projects ENABLE ROW LEVEL SECURITY;
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

/** GET /api/fun-projects — Returns all fun projects */
export async function GET(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`fun-projects:get:${key}`, 60, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = supabase
      .from('fun_projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json(
          { projects: [], tableExists: false },
          { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
        )
      }
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500, headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
      )
    }

    return NextResponse.json(
      { projects: data ?? [], tableExists: true },
      { headers: { ...NO_STORE, ...rateLimitHeaders(rl) } }
    )
  } catch {
    return NextResponse.json(
      { projects: [], tableExists: false },
      { headers: { ...NO_STORE } }
    )
  }
}

/** POST /api/fun-projects — Create a new project */
export async function POST(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`fun-projects:mutate:${key}`, 20, 60000)
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
    const { name, description, category, status, url, image_url } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400, headers: NO_STORE }
      )
    }

    const validCategories = ['websites-for-hayley', 'mini-games', 'experiment', 'build-in-public']
    const validStatuses = ['idea', 'building', 'live']

    const project = {
      name: name.trim(),
      description: (description ?? '').trim(),
      category: validCategories.includes(category) ? category : 'experiment',
      status: validStatuses.includes(status) ? status : 'idea',
      url: (url ?? '').trim() || null,
      image_url: (image_url ?? '').trim() || null,
    }

    const { data, error } = await supabase
      .from('fun_projects')
      .insert(project)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to create project: ${error.message}` },
        { status: 500, headers: NO_STORE }
      )
    }

    return NextResponse.json({ project: data }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400, headers: NO_STORE }
    )
  }
}

/** PATCH /api/fun-projects — Update a project's status or fields */
export async function PATCH(request: NextRequest) {
  const key = getClientKey(request)
  const rl = rateLimit(`fun-projects:mutate:${key}`, 20, 60000)
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
        { error: 'Project id is required' },
        { status: 400, headers: NO_STORE }
      )
    }

    // Build allowed update fields
    const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const validStatuses = ['idea', 'building', 'live']
    const validCategories = ['websites-for-hayley', 'mini-games', 'experiment', 'build-in-public']

    if (updates.status && validStatuses.includes(updates.status)) {
      updateFields.status = updates.status
    }
    if (updates.name && typeof updates.name === 'string') {
      updateFields.name = updates.name.trim()
    }
    if (updates.description && typeof updates.description === 'string') {
      updateFields.description = updates.description.trim()
    }
    if (updates.category && validCategories.includes(updates.category)) {
      updateFields.category = updates.category
    }
    if (updates.url !== undefined) {
      updateFields.url = (updates.url ?? '').trim() || null
    }
    if (updates.image_url !== undefined) {
      updateFields.image_url = (updates.image_url ?? '').trim() || null
    }

    if (Object.keys(updateFields).length <= 1) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400, headers: NO_STORE }
      )
    }

    const { data, error } = await supabase
      .from('fun_projects')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Failed to update project: ${error.message}` },
        { status: 500, headers: NO_STORE }
      )
    }

    return NextResponse.json({ project: data }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400, headers: NO_STORE }
    )
  }
}
