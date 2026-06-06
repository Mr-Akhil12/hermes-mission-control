import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HERMES_API_BASE = process.env.HERMES_API_URL || 'http://127.0.0.1:9119'

// GET /api/chat/[id]/messages — list messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const before = searchParams.get('before') // cursor-based pagination

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/chat/[id]/messages — send a message and get AI response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  const { content, thinking_mode } = body
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Message content required' }, { status: 400 })
  }

  // 1. Get the conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // 2. Save the user message
  const { error: userMsgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      role: 'user',
      content: content.trim(),
      metadata: {},
    })

  if (userMsgError) {
    return NextResponse.json({ error: userMsgError.message }, { status: 500 })
  }

  // 3. Build conversation history for the API call
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  // 4. Build system prompt with cron context if present
  let systemPrompt = conversation.system_prompt || 'You are Hermes, a helpful AI assistant.'
  
  // Add cron context if attached
  if (conversation.cron_context && Array.isArray(conversation.cron_context) && conversation.cron_context.length > 0) {
    const cronInfo = conversation.cron_context.map((ctx: Record<string, unknown>) => {
      const parts = [`Cron Job: ${ctx.name || 'Unknown'}`]
      if (ctx.schedule) parts.push(`Schedule: ${ctx.schedule}`)
      if (ctx.prompt) parts.push(`Prompt: ${ctx.prompt}`)
      if (ctx.last_status) parts.push(`Last Status: ${ctx.last_status}`)
      if (ctx.last_run_at) parts.push(`Last Run: ${ctx.last_run_at}`)
      if (ctx.next_run_at) parts.push(`Next Run: ${ctx.next_run_at}`)
      if (ctx.last_error) parts.push(`Last Error: ${ctx.last_error}`)
      return parts.join('\n')
    }).join('\n\n---\n\n')
    
    systemPrompt += `\n\n--- CRON JOB CONTEXT ---\nThe user has attached the following cron jobs for reference:\n\n${cronInfo}\n\nYou can help adjust schedules, troubleshoot errors, or discuss the cron jobs above.`
  }

  // 5. Build messages array for the API
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  ]

  // 6. Call Hermes gateway API
  const startTime = Date.now()
  try {
    const response = await fetch(`${HERMES_API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: conversation.model || 'hermes',
        messages,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Chat] Hermes API error:', response.status, errText)
      
      // Save error as assistant message
      await supabase.from('messages').insert({
        conversation_id: id,
        role: 'assistant',
        content: `⚠️ Error communicating with Hermes: ${response.status} — ${errText.substring(0, 200)}`,
        model: conversation.model,
        metadata: { error: true },
      })

      return NextResponse.json({
        error: `Hermes API returned ${response.status}`,
        detail: errText.substring(0, 500),
      }, { status: 502 })
    }

    const result = await response.json()
    const duration = Date.now() - startTime

    const assistantContent = result.choices?.[0]?.message?.content || 'No response generated.'
    const reasoning = result.choices?.[0]?.message?.reasoning || null
    const usage = result.usage || {}

    // 7. Save assistant message
    const { data: savedMsg, error: saveError } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        role: 'assistant',
        content: assistantContent,
        reasoning: reasoning,
        model: result.model || conversation.model,
        tokens_in: usage.prompt_tokens || null,
        tokens_out: usage.completion_tokens || null,
        duration_ms: duration,
        metadata: {},
      })
      .select()
      .single()

    if (saveError) {
      console.error('[Chat] Failed to save assistant message:', saveError)
    }

    // 8. Auto-generate title from first user message if still default
    if (conversation.title === 'New Conversation') {
      const title = content.trim().substring(0, 80) + (content.length > 80 ? '...' : '')
      await supabase
        .from('conversations')
        .update({ title })
        .eq('id', id)
    }

    return NextResponse.json({
      message: savedMsg,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
      duration_ms: duration,
      model: result.model,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Chat] Gateway connection error:', msg)
    
    await supabase.from('messages').insert({
      conversation_id: id,
      role: 'assistant',
      content: `⚠️ Could not connect to Hermes gateway at ${HERMES_API_BASE}. Make sure the gateway is running.\n\nError: ${msg}`,
      model: conversation.model,
      metadata: { error: true },
    })

    return NextResponse.json({
      error: 'Failed to connect to Hermes gateway',
      detail: msg,
    }, { status: 502 })
  }
}
