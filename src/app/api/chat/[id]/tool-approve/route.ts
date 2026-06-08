import { NextRequest, NextResponse } from 'next/server'

// Reference to the pending tool calls map from the messages route.
// Since they're in separate modules, we use a global for cross-module sharing.
declare global {
  var __pendingToolCalls: Map<string, { resolve: (approved: boolean) => void, timestamp: number }> | undefined
}

// Initialize if not exists
if (!globalThis.__pendingToolCalls) {
  globalThis.__pendingToolCalls = new Map()
}

// POST /api/chat/[id]/tool-approve — approve or reject a pending tool call
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string> }>
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { call_id, approved } = body

  if (!call_id) {
    return NextResponse.json({ error: 'call_id required' }, { status: 400 })
  }

  const pending = globalThis.__pendingToolCalls

  if (pending && pending.has(call_id)) {
    const entry = pending.get(call_id)!
    pending.delete(call_id)
    entry.resolve(approved !== false)
    return NextResponse.json({ success: true, call_id, approved: approved !== false })
  }

  // If not found, it may have already been auto-approved or timed out
  return NextResponse.json({ success: false, message: 'Tool call not found or already resolved', call_id })
}
