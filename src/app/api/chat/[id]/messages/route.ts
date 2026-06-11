import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HERMES_API_BASE = process.env.HERMES_API_URL || 'http://127.0.0.1:8642'
const HERMES_API_KEY = process.env.HERMES_API_KEY || ''

declare global {
  var __pendingToolCalls: Map<string, {
    resolve: (approved: boolean) => void
    timestamp: number
    resolved: boolean
  }> | undefined
}

function getPendingToolCalls() {
  if (!globalThis.__pendingToolCalls) {
    globalThis.__pendingToolCalls = new Map()
  }
  return globalThis.__pendingToolCalls
}

// Cleanup stale tool call entries (no auto-approve — user must decide)
let cleanupInterval: ReturnType<typeof setInterval> | null = null
function ensureCleanup() {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const pending = getPendingToolCalls()
    const now = Date.now()
    for (const [id, entry] of pending) {
      // Clean up entries older than 5 minutes (no longer pending)
      if (now - entry.timestamp > 300000 && !entry.resolved) {
        entry.resolved = true
        entry.resolve(false) // Reject stale approvals — user did not respond
        pending.delete(id)
      }
    }
  }, 30000)
}
ensureCleanup()

function waitForToolApproval(callId: string): Promise<boolean> {
  const pending = getPendingToolCalls()
  return new Promise((resolve) => {
    const existing = pending.get(callId)
    if (existing?.resolved) {
      pending.delete(callId)
      resolve(true)
      return
    }
    pending.set(callId, { resolve, timestamp: Date.now(), resolved: false })
  })
}

export function resolveToolCall(callId: string, approved: boolean): boolean {
  const pending = getPendingToolCalls()
  const entry = pending.get(callId)
  if (entry && !entry.resolved) {
    entry.resolved = true
    pending.delete(callId)
    entry.resolve(approved)
    return true
  }
  return false
}

function encodeSSE(event: string, data: string): string {
  return `event: ${event}\ndata: ${data.replace(/\n/g, '\\n')}\n\n`
}

// GET /api/chat/[id]/messages
export async function GET(
  request: NextRequest,
  { params }: any
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const before = searchParams.get('before')

  let query = supabase.from('messages').select('*').eq('conversation_id', id)
    .order('created_at', { ascending: true }).limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/chat/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: any
) {
  const { id } = await params
  const body = await request.json()
  const { content, thinking_mode, files } = body

  if (!content?.trim() && (!files || files.length === 0)) {
    return NextResponse.json({ error: 'Message content or files required' }, { status: 400 })
  }

  const trimmedContent = (content || '').trim()
  const useStreaming = new URL(request.url).searchParams.get('stream') === 'true'

  if (trimmedContent.startsWith('/')) {
    const [command, ...args] = trimmedContent.split(' ')
    const cmd = command.toLowerCase()

    let result: { action: string; message: string; [key: string]: unknown }

    if (cmd === '/clear') {
      await supabase.from('messages').delete().eq('conversation_id', id)
      result = { action: 'clear', message: 'Conversation cleared' }
    } else if (cmd === '/model') {
      const model = args[0] || 'hermes-agent'
      await supabase.from('conversations').update({ model }).eq('id', id)
      result = { action: 'model', model, message: `Switched to ${model}` }
    } else if (cmd === '/system') {
      await supabase.from('conversations').update({ system_prompt: args.join(' ') }).eq('id', id)
      result = { action: 'system', message: 'System prompt updated' }
    } else if (cmd === '/think') {
      const enabled = args[0] !== 'off'
      await supabase.from('conversations').update({ thinking_mode: enabled }).eq('id', id)
      result = { action: 'think', thinking_mode: enabled, message: `Thinking mode ${enabled ? 'enabled' : 'disabled'}` }
    } else if (cmd === '/help') {
      result = { action: 'help', message: 'Available: /clear, /model, /system, /think, /cron, /status, /help' }
    } else if (cmd === '/status') {
      result = { action: 'status', message: `Connected to ${HERMES_API_BASE}` }
    } else {
      result = { action: 'unknown', message: `Unknown: ${cmd}. Try /help` }
    }

    // Return as SSE when streaming is requested, JSON otherwise
    if (useStreaming) {
      const sseBody = encodeSSE('content', result.message) + encodeSSE('done', JSON.stringify({ duration_ms: 0 }))
      return new Response(sseBody, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
      })
    }
    return NextResponse.json(result)
  }

  const { data: conversation, error: convError } = await supabase
    .from('conversations').select('*').eq('id', id).single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const { error: userMsgError } = await supabase.from('messages').insert({
    conversation_id: id, role: 'user', content: content.trim(),
    metadata: files?.length ? { files } : {},
  })
  if (userMsgError) return NextResponse.json({ error: userMsgError.message }, { status: 500 })

  const { data: history } = await supabase.from('messages')
    .select('role, content').eq('conversation_id', id).order('created_at', { ascending: true })

  let systemPrompt = conversation.system_prompt || 'You are Hermes, a helpful AI assistant.'
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
    systemPrompt += `\n\n--- CRON JOB CONTEXT ---\n${cronInfo}`
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
  ]

  const startTime = Date.now()

  if (useStreaming) {
    try {
      let hermesResponse: Response
      try {
        hermesResponse = await fetch(`${HERMES_API_BASE}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${HERMES_API_KEY}` },
          body: JSON.stringify({ model: conversation.model || 'hermes-agent', messages, stream: true }),
        })
      } catch (fetchErr: unknown) {
        const detail = fetchErr instanceof Error ? fetchErr.message : 'Connection refused'
        return new Response(
          encodeSSE('error', JSON.stringify({ message: `Cannot reach Hermes API at ${HERMES_API_BASE}`, detail })) +
          encodeSSE('done', JSON.stringify({ duration_ms: Date.now() - startTime })),
          { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } }
        )
      }

      if (!hermesResponse.ok) {
        const errText = await hermesResponse.text()
        return new Response(
          encodeSSE('error', JSON.stringify({ message: `Hermes API error: ${hermesResponse.status}`, detail: errText.substring(0, 500) })) +
          encodeSSE('done', JSON.stringify({ duration_ms: Date.now() - startTime })),
          { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } }
        )
      }

      const reader = hermesResponse.body?.getReader()
      if (!reader) {
        return new Response(
          encodeSSE('error', JSON.stringify({ message: 'Hermes API returned an empty response body' })) +
          encodeSSE('done', JSON.stringify({ duration_ms: Date.now() - startTime })),
          { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } }
        )
      }

      let fullContent = ''
      let fullReasoning = ''

      const stream = new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder()
          let buffer = ''
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })

              while (true) {
                const dataIdx = buffer.indexOf('data: ')
                if (dataIdx === -1) break
                const endIdx = buffer.indexOf('\n\n', dataIdx)
                if (endIdx === -1) break
                const raw = buffer.slice(dataIdx + 6, endIdx).trim()
                buffer = buffer.slice(endIdx + 2)

                if (raw === '[DONE]') {
                  const duration = Date.now() - startTime
                  try {
                    await supabase.from('messages').insert({
                      conversation_id: id, role: 'assistant', content: fullContent || 'No response.',
                      reasoning: fullReasoning || null, model: conversation.model, duration_ms: duration, metadata: {},
                    })
                  } catch (e) { console.error('Save error:', e) }
                  controller.enqueue(encodeSSE('done', JSON.stringify({ duration_ms: duration })))
                  controller.close()
                  return
                }

                try {
                  const parsed = JSON.parse(raw)
                  const delta = parsed.choices?.[0]?.delta
                  if (delta?.content) {
                    fullContent += delta.content
                    controller.enqueue(encodeSSE('content', delta.content))
                  }
                  // Handle all known thinking/reasoning formats from different providers
                  const reasoning = delta?.reasoning || delta?.thinking || delta?.reasoning_content || delta?.thinking_content
                  if (reasoning) {
                    fullReasoning += reasoning
                    controller.enqueue(encodeSSE('thinking', reasoning))
                  }
                  // Some providers use tool_calls in delta
                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      if (tc.id && tc.function?.name) {
                        controller.enqueue(encodeSSE('tool_call', JSON.stringify({
                          call_id: tc.id,
                          tool_name: tc.function.name,
                          tool_input: tc.function.arguments ? (() => { try { return JSON.parse(tc.function.arguments) } catch { return {} } })() : {},
                        })))
                      }
                    }
                  }
                } catch { /* skip malformed */ }
              }
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Stream error'
            controller.enqueue(encodeSSE('error', JSON.stringify({ message: msg })))
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return new Response(
        encodeSSE('error', JSON.stringify({ message: `Failed to connect to Hermes gateway: ${msg}` })) +
        encodeSSE('done', JSON.stringify({ duration_ms: Date.now() - startTime })),
        { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } }
      )
    }
  }

  // Non-streaming
  try {
    const response = await fetch(`${HERMES_API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${HERMES_API_KEY}` },
      body: JSON.stringify({ model: conversation.model || 'hermes-agent', messages, stream: false }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ error: `Hermes API returned ${response.status}`, detail: errText.substring(0, 500) }, { status: 502 })
    }

    const result = await response.json()
    const duration = Date.now() - startTime
    const assistantContent = result.choices?.[0]?.message?.content || 'No response generated.'

    await supabase.from('messages').insert({
      conversation_id: id, role: 'assistant', content: assistantContent,
      model: result.model || conversation.model, duration_ms: duration, metadata: {},
    })

    return NextResponse.json({ content: assistantContent, duration_ms: duration, model: result.model })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to connect to Hermes gateway', detail: msg }, { status: 502 })
  }
}
