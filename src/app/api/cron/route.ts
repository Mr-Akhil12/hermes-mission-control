import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const CRON_DIR = join(process.env.HOME || '/home/akhil', '.hermes', 'cron')
const JOBS_FILE = join(CRON_DIR, 'jobs.json')
const OUTPUT_DIR = join(CRON_DIR, 'output')

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function getOutputCount(jobId: string): number {
  try {
    const jobDir = join(OUTPUT_DIR, jobId)
    return readdirSync(jobDir).filter(f => f.endsWith('.md')).length
  } catch {
    return 0
  }
}

export async function GET() {
  // Try Supabase first (works on Vercel)
  const supabase = getSupabase()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cron_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data && data.length > 0) {
        // Enrich with local output counts if available
        const enriched = data.map(job => ({
          ...job,
          output_count: getOutputCount(job.id),
        }))
        return NextResponse.json(enriched)
      }
    } catch {
      // Fall through to local filesystem
    }
  }

  // Fallback: read from local filesystem
  try {
    const raw = readFileSync(JOBS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const jobs = parsed.jobs || parsed

    const enriched = jobs.map((job: Record<string, unknown>) => {
      const schedule = typeof job.schedule === 'object' && job.schedule !== null
        ? (job.schedule as Record<string, string>).expr
        : (job.schedule as string || '')
      const scheduleDisplay = (job.schedule_display as string) || schedule

      return {
        id: job.id,
        name: job.name,
        schedule,
        schedule_display: scheduleDisplay,
        enabled: job.enabled,
        state: job.state || 'unknown',
        last_run_at: job.last_run_at || null,
        next_run_at: job.next_run_at || null,
        last_status: job.last_status || null,
        last_error: job.last_error || null,
        deliver: job.deliver || 'local',
        profile: job.profile || 'default',
        created_at: job.created_at || null,
        output_count: getOutputCount(job.id as string),
        prompt: job.prompt || '',
        script: job.script || null,
        no_agent: job.no_agent || false,
      }
    })

    return NextResponse.json(enriched)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to read cron data'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
