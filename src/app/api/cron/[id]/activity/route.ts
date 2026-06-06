import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const CRON_DIR = join(process.env.HOME || '/home/akhil', '.hermes', 'cron')
const OUTPUT_DIR = join(CRON_DIR, 'output')

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const { searchParams } = new URL(_request.url)
  const type = searchParams.get('type') || 'all' // 'outputs', 'history', or 'all'

  // Try Supabase first — read from agent_activities where metadata.job_id = id
  const supabase = getSupabase()
  if (supabase) {
    try {
      // Get job_executed activities for this cron job
      const { data: activities, error } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('agent_name', 'cron')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && activities) {
        // Filter by job_id in metadata
        const jobActivities = activities.filter(a =>
          a.metadata?.job_id === id || a.metadata?.session_id?.includes(`cron_${id}`)
        )

        const outputs = jobActivities
          .filter(a => a.action === 'job_executed' || a.details)
          .map(a => ({
            id: a.id,
            timestamp: a.created_at,
            status: a.status || 'unknown',
            job_name: a.metadata?.job_name || a.agent_name,
            details: a.details || null,
            metadata: a.metadata || {},
          }))

        const history = jobActivities.map(a => ({
          id: a.id,
          timestamp: a.created_at,
          status: a.status || 'unknown',
          action: a.action,
          job_name: a.metadata?.job_name,
          session_id: a.metadata?.session_id,
          model: a.metadata?.model,
        }))

        return NextResponse.json({
          source: 'supabase',
          outputs: type === 'history' ? [] : outputs,
          history,
          total: jobActivities.length,
        })
      }
    } catch {
      // Fall through to local
    }
  }

  // Fallback: read from local filesystem
  try {
    const jobDir = join(OUTPUT_DIR, id)
    const files = readdirSync(jobDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()

    const outputs = files.slice(0, 20).map((filename, i) => {
      const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/)
      const timestamp = timestampMatch ? timestampMatch[1].replace('_', ' ') : 'Unknown'
      let size = 0
      let preview = ''
      let status = 'ok'
      try {
        size = statSync(join(jobDir, filename)).size
        if (i < 10) {
          const content = readFileSync(join(jobDir, filename), 'utf-8')
          // Check for error markers
          if (content.includes('ERROR') || content.includes('error') || content.includes('Traceback')) {
            status = 'error'
          }
          preview = content.split('\n').slice(0, 80).join('\n').substring(0, 5000)
        }
      } catch { /* skip */ }
      return { id: filename, filename, timestamp, status, size, preview, metadata: {} }
    })

    const history = files.slice(0, 50).map(filename => {
      const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/)
      return {
        id: filename,
        timestamp: timestampMatch ? timestampMatch[1].replace('_', ' ') : filename,
        status: 'ok',
        action: 'job_executed',
      }
    })

    return NextResponse.json({
      source: 'local',
      outputs,
      history,
      total: files.length,
    })
  } catch {
    return NextResponse.json({
      source: 'empty',
      outputs: [],
      history: [],
      total: 0,
    })
  }
}
