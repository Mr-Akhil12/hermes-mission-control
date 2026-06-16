'use client'

import { useCallback, useRef } from 'react'
import type { StreamingState } from './types'

interface UseMessageStreamParams {
  setStreaming: React.Dispatch<React.SetStateAction<StreamingState>>
  setError: (error: string | null) => void
  setActiveConv: React.Dispatch<React.SetStateAction<import('./types').Conversation | null>>
  onStreamComplete: (conversationId: string) => Promise<void>
  scrollToEnd: () => void
}

interface StartStreamingParams {
  conversationId: string
  content: string
  thinkingMode: boolean
  files: Array<{ url: string; name: string; size: number; type: string }>
}

/**
 * Custom hook that manages SSE streaming via fetch + ReadableStream.
 * Parses SSE events (thinking, content, tool_call, tool_approval, done, error)
 * and updates streaming state via the provided setter.
 */
export function useMessageStream({
  setStreaming,
  setError,
  setActiveConv,
  onStreamComplete,
  scrollToEnd,
}: UseMessageStreamParams) {
  const abortRef = useRef<AbortController | null>(null)

  const startStreaming = useCallback(async ({
    conversationId,
    content,
    thinkingMode,
    files,
  }: StartStreamingParams) => {
    // Abort any in-flight stream before starting a new one
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/chat/${conversationId}/messages?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          thinking_mode: thinkingMode,
          files,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || errData.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages (terminated by \n\n)
        while (true) {
          const msgEnd = buffer.indexOf('\n\n')
          if (msgEnd === -1) break

          const rawMsg = buffer.slice(0, msgEnd)
          buffer = buffer.slice(msgEnd + 2)

          // Parse the SSE message: extract event type and data
          let eventType = ''
          let dataLines: string[] = []

          const rawLines = rawMsg.split('\n')
          for (const line of rawLines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              dataLines.push(line.slice(6))
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5))
            }
          }

          const rawData = dataLines.join('\n')
          if (!eventType || !rawData) continue

          try {
            const data = JSON.parse(rawData)
            switch (eventType) {
              case 'thinking':
                setStreaming(prev => ({
                  ...prev,
                  reasoning: prev.reasoning + (data.content || rawData),
                  status: 'thinking',
                }))
                break
              case 'content':
                setStreaming(prev => ({
                  ...prev,
                  content: prev.content + (data.content || rawData),
                  status: 'streaming',
                }))
                break
              case 'tool_call':
                setStreaming(prev => {
                  const existing = prev.toolCalls.find(tc => tc.call_id === data.call_id)
                  if (existing) return prev
                  return {
                    ...prev,
                    toolCalls: [...prev.toolCalls, {
                      call_id: data.call_id,
                      tool_name: data.tool_name,
                      tool_input: data.tool_input || {},
                      status: 'pending' as const,
                      approvalCountdown: 20,
                    }],
                    status: 'tool_wait',
                  }
                })
                break
              case 'tool_approval':
                setStreaming(prev => ({
                  ...prev,
                  toolCalls: prev.toolCalls.map(tc =>
                    tc.call_id === data.call_id
                      ? { ...tc, status: data.approved ? 'approved' as const : 'rejected' as const, approvalCountdown: 0 }
                      : tc
                  ),
                  status: data.approved ? 'streaming' : prev.status,
                }))
                break
              case 'done':
                setStreaming(prev => ({ ...prev, status: 'done' }))
                break
              case 'error':
                setStreaming(prev => ({
                  ...prev,
                  status: 'error',
                  errorMessage: data.message || 'Unknown error',
                }))
                break
            }
          } catch {
            // If JSON parse fails, treat content events as raw text
            if (eventType === 'content') {
              setStreaming(prev => ({
                ...prev,
                content: prev.content + rawData,
                status: 'streaming',
              }))
            }
          }
        }

        scrollToEnd()
      }

      setStreaming(prev => ({ ...prev, status: 'done' }))
      await onStreamComplete(conversationId)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setStreaming(prev => ({ ...prev, status: 'idle' }))
      } else {
        setError(e instanceof Error ? e.message : 'Failed to send')
        setStreaming(prev => ({
          ...prev,
          status: 'error',
          errorMessage: e instanceof Error ? e.message : 'Failed to send',
        }))
        setActiveConv(prev => prev ? { ...prev, messages: prev.messages?.filter(m => !m.id.startsWith('temp-')) || [] } : prev)
      }
    } finally {
      abortRef.current = null
    }
  }, [setStreaming, setError, setActiveConv, onStreamComplete, scrollToEnd])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return { startStreaming, cancel }
}
