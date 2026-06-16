// ─── Shared Types for Chat Components ───

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning: string | null
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  duration_ms: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  model: string
  system_prompt: string | null
  thinking_mode: boolean
  cron_context: CronContextItem[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  messages?: Message[]
}

export interface CronContextItem {
  id: string
  name: string
  schedule: string
  prompt?: string
  last_status?: string
  last_run_at?: string
  next_run_at?: string
  last_error?: string
  enabled?: boolean
}

export interface CronJob {
  id: string
  name: string
  schedule: string
  schedule_display: string
  enabled: boolean
  state: string
  last_run_at: string | null
  next_run_at: string | null
  last_status: string | null
  last_error: string | null
  prompt: string
}

export interface ToolCall {
  call_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'done' | 'error'
  approvalCountdown?: number
}

export interface StreamingState {
  content: string
  reasoning: string
  toolCalls: ToolCall[]
  status: 'idle' | 'thinking' | 'streaming' | 'tool_wait' | 'done' | 'error'
  errorMessage?: string
}
