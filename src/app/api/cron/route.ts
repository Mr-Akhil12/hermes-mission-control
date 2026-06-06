import { NextResponse } from 'next/server'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const CRON_DIR = join(process.env.HOME || '/home/akhil', '.hermes', 'cron')
const JOBS_FILE = join(CRON_DIR, 'jobs.json')
const OUTPUT_DIR = join(CRON_DIR, 'output')

export const dynamic = 'force-dynamic'

interface HermesCronJob {
  id: string
  name: string
  prompt?: string
  skills?: string[]
  script?: string
  no_agent?: boolean
  schedule: {
    kind: string
    expr: string
    display: string
  } | string
  schedule_display?: string
  enabled: boolean
  state: string
  last_run_at?: string | null
  next_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  deliver?: string
  profile?: string
  created_at?: string
  workdir?: string
  enabled_toolsets?: string[]
}

export interface CronsListJob {
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
  deliver: string
  profile: string
  created_at: string | null
  output_count: number
  prompt: string
  script: string | null
  no_agent: boolean
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
  try {
    const raw = readFileSync(JOBS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const jobs: HermesCronJob[] = parsed.jobs || parsed

    const enriched: CronsListJob[] = jobs.map(job => {
      const schedule = typeof job.schedule === 'object' ? job.schedule.expr : (job.schedule || '')
      const scheduleDisplay = job.schedule_display || schedule

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
        output_count: getOutputCount(job.id),
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
