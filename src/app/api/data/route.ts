import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table')
  const limit = parseInt(searchParams.get('limit') || '20')
  const order = searchParams.get('order') || 'created_at.desc'

  if (!table) {
    return NextResponse.json({ error: 'Table parameter required' }, { status: 400 })
  }

  // Whitelist allowed tables
  const allowedTables = ['agent_activities', 'tasks', 'sessions', 'cron_jobs']
  if (!allowedTables.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 403 })
  }

  const [field, direction] = order.split('.')
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(field, { ascending: direction === 'asc' })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { table, data } = body

  if (!table || !data) {
    return NextResponse.json({ error: 'Table and data required' }, { status: 400 })
  }

  const allowedTables = ['agent_activities', 'tasks']
  if (!allowedTables.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 403 })
  }

  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(result)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { table, id, data } = body

  if (!table || !id || !data) {
    return NextResponse.json({ error: 'Table, id, and data required' }, { status: 400 })
  }

  const allowedTables = ['tasks', 'agent_activities']
  if (!allowedTables.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 403 })
  }

  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(result)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table')
  const id = searchParams.get('id')

  if (!table || !id) {
    return NextResponse.json({ error: 'Table and id required' }, { status: 400 })
  }

  const allowedTables = ['tasks', 'agent_activities']
  if (!allowedTables.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 403 })
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
