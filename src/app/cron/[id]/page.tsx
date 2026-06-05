import { useEffect, useState, useCallback } from 'react'
import { 
  Activity, Loader2, RefreshCw, Search, Clock, AlertTriangle, CheckCircle2, X, ChevronDown, 
  Timer, Calendar, Settings, FileText, Terminal, TrendingUp, BarChart3, PieChart, 
  ActivitySquare, Zap, Save, Copy, Download 
} from 'lucide-react'

export const dynamic = 'force-dynamic'

interface CronJob {
  id: string
  name: string
  schedule: string
  schedule_display?: string
  enabled?: boolean
  state?: string
  last_run_at?: string | null
  next_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  deliver?: string
  profile?: string
  created_at?: string
  updated_at?: string
}

interface CronActivity {
  id: string
  agent_name: string
  action: string
  details: string | null
  status: 'running' | 'completed' | 'error'
  created_at: string
  metadata?: {
    job_id?: string
    job_name?: string
    [key: string]: unknown
  }
}

interface CronOutput {
  filename: string
  timestamp: string
  content: string
  hasResult: boolean
  resultText: string | null
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '—'
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function timeUntil(dateStr: string) {
  if (!dateStr) return '—'
  const s = (new Date(dateStr).getTime() - Date.now()) / 1000
  if (s < 0) return 'Overdue'
  if (s < 60) return `in ${Math.floor(s)}s`
  if (s < 3600) return `in ${Math.floor(s / 60)}m`
  if (s < 86400) return `in ${Math.floor(s / 3600)}h`
  return `in ${Math.floor(s / 86400)}d`
}

function getScheduleHuman(expr: string): string {
  if (!expr) return '—'
  if (expr === '*/1 * * * *') return 'Every minute'
  if (expr === '*/15 * * * *') return 'Every 15 min'
  if (expr === '0 */2 * * *') return 'Every 2 hours'
  if (expr === '0 * * * *') return 'Hourly'

  // Every N hours: 0 */N * * *
  const everyNHours = expr.match(/^0 \*\/(\d+) \* \* \*$/)
  if (everyNHours) {
    const n = parseInt(everyNHours[1])
    return `Every ${n} hours`
  }

  // Daily at specific hour: 0 H * * *
  const dailyMatch = expr.match(/^0 (\d+) \* \* \*$/)
  if (dailyMatch) {
    const utcHour = parseInt(dailyMatch[1])
    const saHour = (utcHour + 2) % 24
    return `Daily at ${saHour}:00 SAST`
  }

  // Every N days at specific hour: 0 H */N * * *
  const everyNDays = expr.match(/^0 (\d+) \*\/(\d+) \* \*$/)
  if (everyNDays) {
    const utcHour = parseInt(everyNDays[1])
    const n = parseInt(everyNDays[2])
    const saHour = (utcHour + 2) % 24
    return `Every ${n} days at ${saHour}:00 SAST`
  }

  // Weekly: 0 H * * DOW
  if (/^0 \d+ \* \* \d+$/.test(expr)) return 'Weekly'

  // Monthly: 0 H D * * *
  if (/^0 \d+ \d+ \* \*$/.test(expr)) return 'Monthly'

  return expr
}

export default function CronDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<CronJob | null>(null)
  const [activities, setActivities] = useState<CronActivity[]>([])
  const [outputs, setOutputs] = useState<CronOutput[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [manualTriggering, setManualTriggering] = useState(false)
  const [triggerSuccess, setTriggerSuccess] = useState<boolean | null>(null)
  const [selectedOutput, setSelectedOutput] = useState<CronOutput | null>(null)
  const [outputTab, setOutputTab] = useState<'overview' | 'outputs' | 'history'>('overview')

  const loadData = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      
      // Fetch cron job details
      const jobRes = await fetch(`/api/data?table=cron_jobs&id=${params.id}`)
      if (!jobRes.ok) throw new Error(`Failed to fetch cron job: ${jobRes.status}`)
      const jobData = await jobRes.json()
      setJob(jobData[0] || null)
      
      // Fetch recent activities for this cron
      const activityRes = await fetch(`/api/data?table=agent_activities&metadata.job_id.eq=${params.id}&limit=20&order=created_at.desc`)
      if (!activityRes.ok) throw new Error(`Failed to fetch activities: ${activityRes.status}`)
      const activityData = await activityRes.json()
      setActivities(activityData || [])
      
      // For outputs, we'll need to read from filesystem via a special API endpoint
      // For now, we'll simulate or use a placeholder
      setOutputs([])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData, params.id])

  const handleManualTrigger = async () => {
    setManualTriggering(true)
    setTriggerSuccess(null)
    try {
      // In a real implementation, this would trigger the cron job via the control plane
      // For now, we'll simulate
      await new Promise(resolve => setTimeout(resolve, 2000))
      setTriggerSuccess(true)
      // Refresh data after trigger
      await loadData()
    } catch (e: any) {
      setTriggerSuccess(false)
      setError(`Failed to trigger cron: ${e.message}`)
    } finally {
      setManualTriggering(false)
    }
  }

  const parseCronOutput = (content: string): CronOutput => {
    const lines = content.split('\n')
    let hasResult = false
    let resultText = null
    
    // Look for RESULT_START and RESULT_END markers
    const startIdx = lines.findIndex(line => line.includes('---RESULT_START---'))
    const endIdx = lines.findIndex(line => line.includes('---RESULT_END---'))
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      hasResult = true
      resultText = lines.slice(startIdx + 1, endIdx).join('\n').trim()
    }
    
    // Extract timestamp from filename (assuming format YYYY-MM-DD_HH-mm-ss.md)
    const timestampMatch = content.match(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/)
    const timestamp = timestampMatch ? timestampMatch[0] : 'Unknown'
    
    return {
      filename: 'unknown.md',
      timestamp,
      content,
      hasResult,
      resultText: hasResult ? resultText : null
    }
  }

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto mb-2" />
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="rounded-2xl glass-panel border border-[var(--border)] p-12 text-center">
        <p className="text-sm text-[var(--text-secondary)]">Cron job not found</p>
      </div>
    )
  }

  const hasError = job.last_status === 'error'
  const humanSchedule = getScheduleHuman(job.schedule_display || job.schedule || '')
  
  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-sm sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">{job.name}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {job.enabled ? 'Enabled' : 'Disabled'} • 
            {job.profile || 'default'} • 
            Deliver to: {job.deliver || 'local'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleManualTrigger}
            disabled={manualTriggering}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl glass-panel border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all ${
              manualTriggering ? 'opacity-70' : ''
            }`}
          >
            {manualTriggering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Triggering...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Trigger Now
              </>
            )}
          </button>
          {triggerSuccess !== null && (
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              triggerSuccess ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--danger)]/20 text-[var(--danger)]'
            }`}>
              {triggerSuccess ? 'Success' : 'Failed'}
            </span>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase">Last Run</p>
              <p className="text-sm font-medium">{job.last_run_at ? timeAgo(job.last_run_at) : 'Never'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase">Next Run</p>
              <p className="text-sm font-medium">{job.next_run_at ? timeUntil(job.next_run_at) : 'Never scheduled'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <ActivitySquare className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase">Status</p>
              <p className="text-sm font-medium">{job.last_status || 'Unknown'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase">Success Rate</p>
              <p className="text-sm font-medium">Calculating...</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="flex border-b border-[var(--border)]">
          <button
            onClick={() => setOutputTab('overview')}
            className={`flex-1 px-4 py-3 text-left text-sm font-medium transition-all ${
              outputTab === 'overview'
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setOutputTab('outputs')}
            className={`flex-1 px-4 py-3 text-left text-sm font-medium transition-all ${
              outputTab === 'outputs'
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            Outputs
          </button>
          <button
            onClick={() => setOutputTab('history')}
            className={`flex-1 px-4 py-3 text-left text-sm font-medium transition-all ${
              outputTab === 'history'
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            History
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="py-4">
          {outputTab === 'overview' && (
            <>
              {/* Schedule Details */}
              <div className="space-y-4">
                <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Schedule
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-[var(--text-primary)] font-medium">{humanSchedule}</p>
                    {job.schedule_display && job.schedule !== job.schedule_display && (
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">{job.schedule}</p>
                    )}
                  </div>
                </div>
                
                {/* Configuration */}
                <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] p-4">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium flex items-center gap-1.5">
                    <Settings className="w-3 h-3" /> Configuration
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Profile</p>
                        <p className="text-xs text-[var(--text-secondary)]">{job.profile || 'default'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">State</p>
                        <p className="text-xs text-[var(--text-secondary)]">{job.state || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Deliver To</p>
                        <p className="text-xs text-[var(--text-secondary)]">{job.deliver || 'local'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Created At</p>
                        <p className="text-xs text-[var(--text-secondary)]">{job.created_at ? timeAgo(job.created_at) : 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Recent Activity */}
              <div className="space-y-4">
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> Recent Activity
                </p>
                {activities.length > 0 ? (
                  <div className="max-h-[200px] overflow-y-auto divide-y divide-[var(--border)]">
                    {activities.map((activity) => {
                      const st = activity.status === 'completed' 
                        ? { text: 'Completed', color: 'text-[var(--success)]' }
                        : activity.status === 'error' 
                          ? { text: 'Error', color: 'text-[var(--danger)]' }
                          : { text: 'Running', color: 'text-[var(--warning)]' };
                      
                      return (
                        <div key={activity.id} className="px-3 py-2 border-b border-[var(--border)] last:border-b-0">
                          <div className="flex items-start gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${st.color}/20`} />
                            <div>
                              <p className="text-xs font-semibold">{activity.agent_name}</p>
                              <p className="text-[10px] text-[var(--text-secondary)]">{activity.action}</p>
                              {activity.details && (
                                <p className="text-[10px] text-[var(--text-muted)]">{activity.details}</p>
                              )}
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${st.color}`} />
                              <span className="text-xs">{st.text}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] text-center">No recent activity</p>
                )}
              </div>
            </>
          )}
          {outputTab === 'outputs' && (
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-3">Recent outputs will be shown here once filesystem access is implemented</p>
            </div>
          )}
          {outputTab === 'history' && (
            <div>
              <p className="text-sm text-[var(--text-muted)] mb-3">Run history view coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
