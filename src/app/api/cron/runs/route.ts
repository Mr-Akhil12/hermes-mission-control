import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const CRON_DIR = join(process.env.HOME || '/home/akhil', '.hermes', 'cron')
const OUTPUT_DIR = join(CRON_DIR, 'output')

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

interface RunEntry {
  id: string
  job_id: string
  timestamp: string
  status: string
  action: string
  details: string | null
  metadata: Record<string, unknown>
  source: string
}

export async function GET() {
  // Try Supabase first — get all cron job run activities
  const supabase = getSupabase()
  if (supabase) {
    try {
      const { data: activities, error } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('agent_name', 'cron')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error && activities && activities.length > 0) {
        // Group by job_id
        const runsByJob: Record<string, RunEntry[]> = {}

        for (const a of activities) {
          // Determine job_id from metadata or session_id
          let jobId = a.metadata?.job_id as string | undefined
          if (!jobId && a.metadata?.session_id) {
            const match = (a.metadata.session_id as string).match(/cron_([a-f0-9-]+)/)
            if (match) jobId = match[1]
          }
          if (!jobId) continue

          const entry: RunEntry = {
            id: a.id,
            job_id: jobId,
            timestamp: a.created_at,
            status: a.status || 'unknown',
            action: a.action,
            details: a.details || null,
            metadata: a.metadata || {},
            source: 'supabase',
          }

          if (!runsByJob[jobId]) runsByJob[jobId] = []
          if (runsByJob[jobId].length < 10) {
            runsByJob[jobId].push(entry)
          }
        }

        return NextResponse.json({
          source: 'supabase',
          runs: runsByJob,
          total: activities.length,
        })
      }
    } catch {
      // Fall through to local
    }
  }

  // Fallback: read from local output directories
  try {
    const runsByJob: Record<string, RunEntry[]> = {}

    const jobDirs = readdirSync(OUTPUT_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    for (const jobId of jobDirs) {
      try {
        const jobDir = join(OUTPUT_DIR, jobId)
        const files = readdirSync(jobDir)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse()
          .slice(0, 5)

        const runs: RunEntry[] = files.map(filename => {
          const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/)
          const timestamp = timestampMatch ? timestampMatch[1].replace('_', ' ') : 'Unknown'
          let status = 'completed'
          try {
            const content = readFileSync(join(jobDir, filename), 'utf-8').substring(0, 5000)
            if (content.includes('ERROR') || content.includes('error') || content.includes('Traceback')) {
              status = 'error'
            }
          } catch { /* skip */ }

          return {
            id: filename,
            job_id: jobId,
            timestamp,
            status,
            action: 'job_executed',
            details: null,
            metadata: { filename },
            source: 'local',
          }
        })

        if (runs.length > 0) {
          runsByJob[jobId] = runs
        }
      } catch { /* skip */ }
    }

    return NextResponse.json({
      source: 'local',
      runs: runsByJob,
      total: Object.values(runsByJob).reduce((sum, r) => sum + r.length, 0),
    })
  } catch {
    return NextResponse.json({
      source: 'empty',
      runs: {},
      total: 0,
    })
  }
}
