import { NextRequest, NextResponse } from 'next/server'
import { resolveToolCall } from '../messages/route'

// POST /api/chat/[id]/tool-approve — approve or reject a pending tool call
export async function POST(
  request: NextRequest,
  { params }: any
) {
  const { id: _conversationId } = await params
  const body = await request.json().catch(() => ({}))
  const { call_id, approved } = body

  if (!call_id) {
    return NextResponse.json({ error: 'call_id required' }, { status: 400 })
  }

  const resolved = resolveToolCall(call_id, approved !== false)

  if (resolved) {
    return NextResponse.json({ success: true, call_id, approved: approved !== false })
  }

  // Not found — may have already been auto-approved or timed out
  return NextResponse.json({
    success: false,
    message: 'Tool call not found or already resolved (may have auto-approved after timeout)',
    call_id,
  })
}
