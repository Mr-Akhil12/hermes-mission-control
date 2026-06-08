import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/chat/[id] — get conversation with messages
export async function GET(
  request: NextRequest,
  { params }: any
) {
  const { id } = await params

  const [convResult, msgResult] = await Promise.all([
    supabase.from('conversations').select('*').eq('id', id).single(),
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (convResult.error) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...convResult.data,
    messages: msgResult.data || [],
  })
}

// PATCH /api/chat/[id] — update conversation
export async function PATCH(
  request: NextRequest,
  { params }: any
) {
  const { id } = await params
  const body = await request.json()

  const allowed = ['title', 'model', 'system_prompt', 'thinking_mode', 'cron_context', 'metadata']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/chat/[id] — delete conversation + messages
export async function DELETE(
  request: NextRequest,
  { params }: any
) {
  const { id } = await params

  // Messages cascade-delete via FK constraint
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
