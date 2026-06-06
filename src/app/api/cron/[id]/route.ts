import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, readdirSync, readFileSync as readFileSync2 } from 'fs'
import { join } from 'path'

const CRON_DIR = join(process.env.HOME || '/home/akhil', '.hermes', 'cron')
const JOBS_FILE = join(CRON_DIR, 'jobs.json')
const OUTPUT_DIR = join(CRON_DIR, 'output')

export const dynamic = 'force-dynamic'

interface OutputFile {
  filename: string
  timestamp: string
  size: number
  preview: string
}

export interface CronDetailResponse {
  job: {
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
    last_delivery_error: string | null
    deliver: string
    profile: string
    created_at: string | null
    prompt: string
    script: string | null
    no_agent: boolean
    enabled_toolsets: string[]
    workdir: string | null
  }
  outputs: OutputFile[]
  total_outputs: number
}

function parseOutputFile(filepath: string, filename: string): OutputFile {
  // Filename format: 2026-06-05_13-14-28.md
  const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/)
  const timestamp = timestampMatch ? timestampMatch[1].replace('_', ' ') : 'Unknown'

  let size = 0
  let preview = ''
  try {
    const stat = require('fs').statSync(filepath)
    size = stat.size

    // Read first 5KB for preview
    const content = readFileSync(filepath, 'utf-8')
    const lines = content.split('\n').slice(0, 100).join('\n')
    preview = lines.substring(0, 5000)
  } catch {
    preview = '[Unable to read file]'
  }

  return { filename, timestamp, size, preview }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // Read job from jobs.json
    const raw = readFileSync(JOBS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const jobs = parsed.jobs || parsed
    const job = jobs.find((j: { id: string }) => j.id === id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const schedule = typeof job.schedule === 'object' ? job.schedule.expr : (job.schedule || '')

    // Read output files
    const outputs: OutputFile[] = []
    let totalOutputs = 0
    try {
      const jobDir = join(OUTPUT_DIR, id)
      const files = readdirSync(jobDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse() // Most recent first

      totalOutputs = files.length

      // Get last 20 for listing, with preview for last 5
      const recentFiles = files.slice(0, 20)
      for (let i = 0; i < recentFiles.length; i++) {
        const filepath = join(jobDir, recentFiles[i])
        const output = parseOutputFile(filepath, recentFiles[i])
        // Only load full preview for the 5 most recent
        if (i >= 5) {
          output.preview = '[Preview not loaded]'
        }
        outputs.push(output)
      }
    } catch {
      // Output directory may not exist
    }

    const response: CronDetailResponse = {
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
      total_outputs: totalOutputs,
    }

    return NextResponse.json(response)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to read cron data'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
