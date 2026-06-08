import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HERMES_API_BASE = process.env.HERMES_API_URL || 'http://127.0.0.1:8642'
const HERMES_API_KEY = process.env.HERMES_API_KEY || ''

// ─── Pending tool call approvals (in-memory, per-process) ───
// Maps call_id → { resolve, timestamp }
const pendingToolCalls = new Map<string, { resolve: (approved: boolean) => void, timestamp: number }>()

// Cleanup stale entries (> 60s)
setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of pendingToolCalls) {
    if (now - entry.timestamp > 60000) {
      entry.resolve(true) // auto-approve stale calls
      pendingToolCalls.delete(id)
    }
  }
}, 10000)

// GET /api/chat/[id]/messages — list messages for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string> }>
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const before = searchParams.get('before')

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

// Helper: wait for tool call approval
async function waitForToolApproval(callId: string): Promise<boolean> {
  // Check if already resolved (e.g., from a previous request)
  if (!pendingToolCalls.has(callId)) {
    // Create a new pending entry and wait
    return new Promise((resolve) => {
      pendingToolCalls.set(callId, { resolve, timestamp: Date.now() })
      // Auto-approve after 15 seconds
      setTimeout(() => {
        if (pendingToolCalls.has(callId)) {
          pendingToolCalls.delete(callId)
          resolve(true)
        }
      }, 15000)
    })
  }
  return new Promise((resolve) => {
    const entry = pendingToolCalls.get(callId)!
    entry.resolve = resolve
    pendingToolCalls.set(callId, { ...entry, timestamp: Date.now() })
    setTimeout(() => {
      if (pendingToolCalls.has(callId)) {
        pendingToolCalls.delete(callId)
        resolve(true)
      }
    }, 15000)
  })
}

// POST /api/chat/[id]/messages — send a message and get AI response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string> }>
) {
  const { id } = await params
  const body = await request.json()

  const { content, thinking_mode, files } = body
  if (!content?.trim() && (!files || files.length === 0)) {
    return NextResponse.json({ error: 'Message content or files required' }, { status: 400 })
  }

  // Handle slash commands (non-streaming)
  const trimmedContent = (content || '').trim()
  if (trimmedContent.startsWith('/')) {
    const [command, ...args] = trimmedContent.split(' ')
    const cmd = command.toLowerCase()

    if (cmd === '/clear') {
      await supabase.from('messages').delete().eq('conversation_id', id)
      return NextResponse.json({ action: 'clear', message: 'Conversation cleared' })
    }

    if (cmd === '/model') {
      const model = args[0] || 'hermes'
      await supabase.from('conversations').update({ model }).eq('id', id)
      return NextResponse.json({ action: 'model', model, message: `Switched to ${model}` })
    }

    if (cmd === '/system') {
      const systemPrompt = args.join(' ')
      await supabase.from('conversations').update({ system_prompt: systemPrompt }).eq('id', id)
      return NextResponse.json({ action: 'system', message: 'System prompt updated' })
    }

    if (cmd === '/think') {
      const enabled = args[0] !== 'off'
      await supabase.from('conversations').update({ thinking_mode: enabled }).eq('id', id)
      return NextResponse.json({ action: 'think', thinking_mode: enabled, message: `Thinking mode ${enabled ? 'enabled' : 'disabled'}` })
    }

    if (cmd === '/cron') {
      return NextResponse.json({ action: 'cron_list', message: 'Use the ⏱ button to attach cron jobs' })
    }

    if (cmd === '/help') {
      return NextResponse.json({ action: 'help', message: 'Available commands: /clear, /model &lt;name&gt;, /system &lt;prompt&gt;, /think [on|off], /cron, /help, /status' })
    }

    if (cmd === '/status') {
      return NextResponse.json({ action: 'status', message: `Connected to ${HERMES_API_BASE} • Streaming active` })
    }

    return NextResponse.json({ action: 'unknown', message: `Unknown command: ${cmd}. Try /help` })
  }

  // ─── Get the conversation ───
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // ─── Save the user message ───
  const { error: userMsgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      role: 'user',
      content: content.trim(),
      metadata: files?.length ? { files } : {},
    })

  if (userMsgError) {
    return NextResponse.json({ error: userMsgError.message }, { status: 500 })
  }

  // ─── Build conversation history ───
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  // ─── Build system prompt with cron context ───
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

    systemPrompt += `\n\n--- CRON JOB CONTEXT ---\nThe user has attached the following cron jobs for reference:\n\n${cronInfo}\n\nYou can help adjust schedules, troubleshoot errors, or discuss the cron jobs above.`
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  ]

  // ─── Check for streaming request ───
  const url = new URL(request.url)
  const useStreaming = url.searchParams.get('stream') === 'true'

  const startTime = Date.now()

  if (useStreaming) {
    // ═══════════════════════════════════════════
    // STREAMING MODE — SSE response
    // ═══════════════════════════════════════════
    try {
      const hermesResponse = await fetch(`${HERMES_API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HERMES_API_KEY}`,
        },
        body: JSON.stringify({
          model: conversation.model || 'hermes-agent',
          messages,
          stream: true,
        }),
      })

      if (!hermesResponse.ok) {
        const errText = await hermesResponse.text()
        return new Response(
          sseEvent('error', JSON.stringify({ message: `Hermes API error: ${response.status}`, detail: errText.substring(0, 500) })),
          { status: 502, headers: { 'Content-Type': 'text/event-stream' } }
        )
      }

      const reader = hermesResponse.body?.getReader()
      if (!reader) {
        return new Response(sseEvent('error', JSON.stringify({ message: 'No response body' })), {
          status: 502,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      }

      // Accumulate for saving to DB
      let fullContent = ''
      let fullReasoning = ''

      const stream = new ReadableStream({
        async start(controller) {
          const decoder = new TextDecoder()
          let toolCallBuffer: Record<string, { id: string, name: string, args: string }> = {}

          try {
            let buffer = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })

              // Process complete SSE frames from buffer
              while (true) {
                const dataIndex = buffer.indexOf('data: ')
                if (dataIndex === -1) break

                const endIndex = buffer.indexOf('\n\n', dataIndex)
                if (endIndex === -1) break

                const raw = buffer.slice(dataIndex + 6, endIndex).trim()
                buffer = buffer.slice(endIndex + 2)

                if (raw === '[DONE]') {
                  const duration = Date.now() - startTime

                  // Save accumulated message to DB
                  try {
                    await supabase.from('messages').insert({
                      conversation_id: id,
                      role: 'assistant',
                      content: fullContent || 'No response generated.',
                      reasoning: fullReasoning || null,
                      model: conversation.model,
                      duration_ms: duration,
                      metadata: {},
                    })

                    if (conversation.title === 'New Conversation') {
                      const title = content.trim().substring(0, 80) + (content.length > 80 ? '...' : '')
                      await supabase.from('conversations').update({ title }).eq('id', id)
                    }
                  } catch (saveErr) {
                    console.error('[Chat] Failed to save streamed message:', saveErr)
                  }

                  controller.enqueue(encodeSSE('done', JSON.stringify({
                    duration_ms: duration,
                    model: conversation.model,
                  })))
                  controller.close()
                  return
                }

                try {
                  const parsed = JSON.parse(raw)
                  const delta = parsed.choices?.[0]?.delta
                  const finishReason = parsed.choices?.[0]?.finish_reason

                  if (delta) {
                    // Content delta
                    if (delta.content) {
                      fullContent += delta.content
                      controller.enqueue(encodeSSE('content', delta.content))
                    }

                    // Thinking/reasoning delta
                    const reasoning = delta.reasoning || delta.thinking
                    if (reasoning) {
                      fullReasoning += reasoning
                      controller.enqueue(encodeSSE('thinking', reasoning))
                    }

                    // Tool call delta (OpenAI streaming format)
                    if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                      for (const tc of delta.tool_calls) {
                        const tcId = tc.index !== undefined ? `tc-${tc.index}` : tc.id || `tc-${Date.now()}`

                        if (!toolCallBuffer[tcId]) {
                          toolCallBuffer[tcId] = { id: tcId, name: '', args: '' }
                        }

                        if (tc.function?.name) {
                          toolCallBuffer[tcId].name = tc.function.name
                        }
                        if (tc.function?.arguments) {
                          toolCallBuffer[tcId].args += tc.function.arguments
                        }

                        // When we have a complete tool call (finish_reason or both name+args), emit it
                        if (finishReason === 'tool_calls' || (toolCallBuffer[tcId].name && tc.function?.arguments)) {
                          try {
                            const parsedArgs = JSON.parse(toolCallBuffer[tcId].args || '{}')
                            controller.enqueue(encodeSSE('tool_call', JSON.stringify({
                              call_id: tcId,
                              tool_name: toolCallBuffer[tcId].name,
                              tool_input: parsedArgs,
                            })))

                            // Wait for approval BEFORE continuing stream
                            const approved = await waitForToolApproval(tcId)

                            controller.enqueue(encodeSSE('tool_approval', JSON.stringify({
                              call_id: tcId,
                              approved,
                            })))
                          } catch (e) {
                            // If args aren't valid JSON yet, just emit what we have
                            controller.enqueue(encodeSSE('tool_call', JSON.stringify({
                              call_id: tcId,
                              tool_name: toolCallBuffer[tcId].name || 'unknown',
                              tool_input: { raw: toolCallBuffer[tcId].args },
                            })))

                            await waitForToolApproval(tcId)
                            controller.enqueue(encodeSSE('tool_approval', JSON.stringify({
                              call_id: tcId,
                              approved: true,
                            })))
                          }
                        }
                      }
                    }
                  }
                } catch (_) {
                  // Malformed chunk, skip
                }
              }
            }

            // Stream ended without [DONE]
            const duration = Date.now() - startTime
            controller.enqueue(encodeSSE('done', JSON.stringify({
              duration_ms: duration,
              model: conversation.model,
            })))
            controller.close()
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Stream error'
            console.error('[Chat] Streaming error:', msg)
            controller.enqueue(encodeSSE('error', JSON.stringify({ message: msg })))

            // Save error to DB
            try {
              await supabase.from('messages').insert({
                conversation_id: id,
                role: 'assistant',
                content: `⚠️ Streaming error: ${msg}`,
                model: conversation.model,
                metadata: { error: true },
              })
            } catch { /* ignore save error */ }

            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json(
        { error: 'Failed to connect to Hermes gateway', detail: msg },
        { status: 502 }
      )
    }
  }

  // ═══════════════════════════════════════════
  // NON-STREAMING MODE (backward compat)
  // ═══════════════════════════════════════════
  try {
    const response = await fetch(`${HERMES_API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HERMES_API_KEY}`,
      },
      body: JSON.stringify({
        model: conversation.model || 'hermes-agent',
        messages,
        stream: false,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Chat] Hermes API error:', response.status, errText)

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

// ─── SSE Helpers ───
function encodeSSE(event: string, data: string): Uint8Array {
  const payload = `event: ${event}\ndata: ${data.replace(/\n/g, '\\n')}\n\n`
  return new TextEncoder().encode(payload)
}

function sseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`
}
