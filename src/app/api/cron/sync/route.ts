import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const CRON_DIR = join(process.env.HOME || '/home/akhil', '.hermes', 'cron')
const JOBS_FILE = join(CRON_DIR, 'jobs.json')
const OUTPUT_DIR = join(CRON_DIR, 'output')

export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Read local jobs
    const raw = readFileSync(JOBS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const jobs = parsed.jobs || parsed

    // 2. Upsert each job into Supabase
    let jobsSynced = 0
    for (const job of jobs) {
      const schedule = typeof job.schedule === 'object' && job.schedule !== null
        ? job.schedule.expr
        : (job.schedule || '')

      const record = {
        id: job.id,
        name: job.name,
        schedule,
        schedule_display: job.schedule_display || schedule,
        enabled: job.enabled,
        state: job.state || 'unknown',
        last_run_at: job.last_run_at || null,
        next_run_at: job.next_run_at || null,
        last_status: job.last_status || null,
        last_error: job.last_error || null,
        deliver: job.deliver || 'local',
        profile: job.profile || 'default',
        prompt: job.prompt || '',
        script: job.script || null,
        no_agent: job.no_agent || false,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('cron_jobs')
        .upsert(record, { onConflict: 'id' })

      if (!error) jobsSynced++
    }

    return NextResponse.json({
      success: true,
      jobs_synced: jobsSynced,
      total_jobs: jobs.length,
      timestamp: new Date().toISOString(),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Sync failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET to check sync status
export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { count, error } = await supabase
      .from('cron_jobs')
      .select('*', { count: 'exact', head: true })

    let localCount = 0
    try {
      const raw = readFileSync(JOBS_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      localCount = (parsed.jobs || parsed).length
    } catch { /* no local file */ }

    return NextResponse.json({
      supabase_count: error ? 'error' : count,
      local_count: localCount,
      in_sync: count === localCount,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Status check failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
