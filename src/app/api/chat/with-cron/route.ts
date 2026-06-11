import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/chat/with-cron — create a conversation pre-loaded with cron job context
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { cron_job_id, cron_job_name, cron_job_schedule, cron_job_prompt, cron_job_status, cron_job_last_run, cron_job_next_run, cron_job_error, cron_job_enabled } = body

  if (!cron_job_id) {
    return NextResponse.json({ error: 'cron_job_id required' }, { status: 400 })
  }

  const cronContext = [{
    id: cron_job_id,
    name: cron_job_name || 'Unknown Cron Job',
    schedule: cron_job_schedule || '',
    prompt: cron_job_prompt || '',
    last_status: cron_job_status || undefined,
    last_run_at: cron_job_last_run || undefined,
    next_run_at: cron_job_next_run || undefined,
    last_error: cron_job_error || undefined,
    enabled: cron_job_enabled ?? true,
  }]

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      title: `Cron: ${cron_job_name || 'Job'}`,
      model: 'hermes',
      system_prompt: `You are helping manage and adjust a cron job. The user may ask you to analyze its behavior, fix errors, adjust its schedule, modify its prompt, or review its recent runs. Be helpful and specific.\n\nCurrent cron job details are attached as context.`,
      thinking_mode: false,
      cron_context: cronContext,
      metadata: { source: 'cron-page', cron_job_id },
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
