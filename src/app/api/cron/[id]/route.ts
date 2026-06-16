import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const CRON_DIR = join(process.env.HOME || '/home/akhil', '.hermes', 'cron')
const JOBS_FILE = join(CRON_DIR, 'jobs.json')
const OUTPUT_DIR = join(CRON_DIR, 'output')

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function extractSchedule(schedule: unknown): string {
  if (!schedule) return ''
  if (typeof schedule === 'string') {
    try {
      const parsed = JSON.parse(schedule)
      return parsed.expr || parsed.display || schedule
    } catch {
      const exprMatch = schedule.match(/'expr':\s*'([^']+)'/)
      if (exprMatch) return exprMatch[1]
      if (/^[\d\*\/\-\s]+$/.test(schedule.trim())) return schedule.trim()
      return schedule
    }
  }
  if (typeof schedule === 'object' && schedule !== null) {
    return (schedule as Record<string, string>).expr || (schedule as Record<string, string>).display || ''
  }
  return String(schedule)
}

interface OutputFile {
  filename: string
  timestamp: string
  size: number
  preview: string
}

function getLocalOutputs(jobId: string): { outputs: OutputFile[]; total: number } {
  try {
    const jobDir = join(OUTPUT_DIR, jobId)
    const files = readdirSync(jobDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()

    const outputs: OutputFile[] = files.slice(0, 20).map((filename, i) => {
      const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/)
      const timestamp = timestampMatch ? timestampMatch[1].replace('_', ' ') : 'Unknown'
      let size = 0
      let preview = ''
      try {
        size = statSync(join(jobDir, filename)).size
        if (i < 5) {
          preview = readFileSync(join(jobDir, filename), 'utf-8')
            .split('\n').slice(0, 100).join('\n')
            .substring(0, 5000)
        }
      } catch { /* skip */ }
      return { filename, timestamp, size, preview }
    })

    return { outputs, total: files.length }
  } catch {
    return { outputs: [], total: 0 }
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  // Try Supabase first
  const supabase = getSupabase()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cron_jobs')
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) {
        // Get local outputs if available
        const { outputs, total } = getLocalOutputs(id)

        return NextResponse.json({
          job: {
            id: data.id,
            name: data.name,
            schedule: extractSchedule(data.schedule),
            schedule_display: data.schedule_display || extractSchedule(data.schedule),
            enabled: data.enabled,
            state: data.state || 'unknown',
            last_run_at: data.last_run_at || null,
            next_run_at: data.next_run_at || null,
            last_status: data.last_status || null,
            last_error: data.last_error || null,
            last_delivery_error: data.last_delivery_error || null,
            deliver: data.deliver || 'local',
            profile: data.profile || 'default',
            created_at: data.created_at || null,
            prompt: data.prompt || '',
            script: data.script || null,
            no_agent: data.no_agent || false,
            enabled_toolsets: data.enabled_toolsets || [],
            workdir: data.workdir || null,
          },
          outputs,
          total_outputs: total,
        })
      }
    } catch {
      // Fall through to local
    }
  }

  // Fallback: local filesystem
  try {
    const raw = readFileSync(JOBS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const job = (parsed.jobs || parsed).find((j: Record<string, string>) => j.id === id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const schedule = typeof job.schedule === 'object' && job.schedule !== null
      ? (job.schedule as Record<string, string>).expr
      : (job.schedule || '')

    const { outputs, total } = getLocalOutputs(id)

    return NextResponse.json({
      job: {
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
        last_delivery_error: job.last_delivery_error || null,
        deliver: job.deliver || 'local',
        profile: job.profile || 'default',
        created_at: job.created_at || null,
        prompt: job.prompt || '',
        script: job.script || null,
        no_agent: job.no_agent || false,
        enabled_toolsets: job.enabled_toolsets || [],
        workdir: job.workdir || null,
      },
      outputs,
      total_outputs: total,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to read cron data'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — toggle enabled/disabled
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  let body: { enabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  // Try Supabase first
  const supabase = getSupabase()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cron_jobs')
        .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()

      if (!error && data) {
        return NextResponse.json({
          id: data.id,
          name: data.name,
          enabled: data.enabled,
          success: true,
        })
      }
    } catch {
      // Fall through to local
    }
  }

  // Fallback: update local jobs.json
  try {
    const raw = readFileSync(JOBS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const jobs = parsed.jobs || parsed
    const jobIndex = jobs.findIndex((j: Record<string, unknown>) => j.id === id)

    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    jobs[jobIndex].enabled = body.enabled
    jobs[jobIndex].state = body.enabled ? 'scheduled' : 'paused'
    parsed.jobs = jobs

    const { writeFileSync } = await import('fs')
    writeFileSync(JOBS_FILE, JSON.stringify(parsed, null, 2))

    return NextResponse.json({
      id: jobs[jobIndex].id,
      name: jobs[jobIndex].name,
      enabled: jobs[jobIndex].enabled,
      success: true,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update cron job'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST — trigger a manual run immediately
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = getSupabase()
  const now = new Date().toISOString()

  let jobRecord: Record<string, unknown> | null = null

  // Fetch the job to validate it exists and get its info
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cron_jobs')
        .select('*')
        .eq('id', id)
        .single()

      if (!error && data) {
        jobRecord = data
      }
    } catch {
      // Fall through to local
    }
  }

  // Fallback: local
  if (!jobRecord) {
    try {
      const raw = readFileSync(JOBS_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      jobRecord = (parsed.jobs || parsed).find((j: Record<string, unknown>) => j.id === id) || null
    } catch {
      // ignore
    }
  }

  if (!jobRecord) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Log the manual run in cron_runs if Supabase is available
  if (supabase) {
    try {
      await supabase.from('cron_runs').insert({
        cron_job_id: id,
        status: 'running',
        started_at: now,
        triggered_by: 'manual',
      })
    } catch {
      // cron_runs table may not exist; non-fatal
    }
  }

  // Update last_run_at on the job
  if (supabase) {
    try {
      await supabase
        .from('cron_jobs')
        .update({ last_run_at: now })
        .eq('id', id)
    } catch {
      // non-fatal
    }
  }

  // Trigger the Hermes cron runner for this job
  // Use the Hermes CLI to run the job
  const { execSync } = await import('child_process')
  const profile = (jobRecord as Record<string, string>).profile || 'default'
  try {
    // Fire-and-forget the hermes cron run command
    execSync(`hermes cron run ${id} --profile ${profile} 2>/dev/null &`, {
      timeout: 5000,
      shell: '/bin/bash',
    })
  } catch {
    // Command may timeout (expected since it's async) or fail — non-fatal
  }

  return NextResponse.json({
    success: true,
    message: `Job "${jobRecord.name || id}" triggered successfully`,
    triggered_at: now,
  })
}
