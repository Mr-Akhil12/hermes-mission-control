1|1|'use client'
2|2|
3|3|import { useEffect, useState, useCallback } from 'react'
4|4|import { Clock, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Timer } from 'lucide-react'
5|import Link from 'next/link'
6|5|
7|6|export const dynamic = 'force-dynamic'
8|7|
9|8|interface CronJob {
10|9|  id: string
11|10|  name: string
12|11|  schedule: string
13|12|  schedule_display?: string
14|13|  enabled?: boolean
15|14|  state?: string
16|15|  last_run_at?: string | null
17|16|  next_run_at?: string | null
18|17|  last_status?: string | null
19|18|  last_error?: string | null
20|19|  created_at?: string
21|20|}
22|21|
23|22|function timeAgo(dateStr: string) {
24|23|  if (!dateStr) return '—'
25|24|  const s = (Date.now() - new Date(dateStr).getTime()) / 1000
26|25|  if (s < 0) return 'Pending'
27|26|  if (s < 60) return `${Math.floor(s)}s ago`
28|27|  if (s < 3600) return `${Math.floor(s / 60)}m ago`
29|28|  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
30|29|  return `${Math.floor(s / 86400)}d ago`
31|30|}
32|31|
33|32|function timeUntil(dateStr: string) {
34|33|  if (!dateStr) return '—'
35|34|  const s = (new Date(dateStr).getTime() - Date.now()) / 1000
36|35|  if (s < 0) return 'Overdue'
37|36|  if (s < 60) return `in ${Math.floor(s)}s`
38|37|  if (s < 3600) return `in ${Math.floor(s / 60)}m`
39|38|  if (s < 86400) return `in ${Math.floor(s / 3600)}h`
40|39|  return `in ${Math.floor(s / 86400)}d`
41|40|}
42|41|
43|42|function getScheduleHuman(expr: string): string {
44|43|  if (!expr) return '—'
45|44|  if (expr === '*/1 * * * *') return 'Every minute'
46|45|  if (expr === '*/15 * * * *') return 'Every 15 min'
47|46|  if (expr === '0 */2 * * *') return 'Every 2 hours'
48|47|  if (expr === '0 * * * *') return 'Hourly'
49|48|
50|49|  // Every N hours: 0 */N * * *
51|50|  const everyNHours = expr.match(/^0 \*\/(\d+) \* \* \*$/)
52|51|  if (everyNHours) {
53|52|    const n = parseInt(everyNHours[1])
54|53|    return `Every ${n} hours`
55|54|  }
56|55|
57|56|  // Daily at specific hour: 0 H * * *
58|57|  const dailyMatch = expr.match(/^0 (\d+) \* \* \*$/)
59|58|  if (dailyMatch) {
60|59|    const utcHour = parseInt(dailyMatch[1])
61|60|    const saHour = (utcHour + 2) % 24
62|61|    return `Daily at ${saHour}:00 SAST`
63|62|  }
64|63|
65|64|  // Every N days at specific hour: 0 H */N * *
66|65|  const everyNDays = expr.match(/^0 (\d+) \*\/(\d+) \* \*$/)
67|66|  if (everyNDays) {
68|67|    const utcHour = parseInt(everyNDays[1])
69|68|    const n = parseInt(everyNDays[2])
70|69|    const saHour = (utcHour + 2) % 24
71|70|    return `Every ${n} days at ${saHour}:00 SAST`
72|71|  }
73|72|
74|73|  // Weekly: 0 H * * DOW
75|74|  if (/^0 \d+ \* \* \d+$/.test(expr)) return 'Weekly'
76|75|
77|76|  // Monthly: 0 H D * *
78|77|  if (/^0 \d+ \d+ \* \*$/.test(expr)) return 'Monthly'
79|78|
80|79|  return expr
81|80|}
82|81|
83|82|export default function CronPage() {
84|83|  const [jobs, setJobs] = useState<CronJob[]>([])
85|84|  const [loading, setLoading] = useState(true)
86|85|  const [error, setError] = useState<string | null>(null)
87|86|
88|87|  const loadData = useCallback(async () => {
89|88|    try {
90|89|      setError(null)
91|90|      const res = await fetch('/api/data?table=cron_jobs&limit=50&order=created_at.desc')
92|91|      if (!res.ok) throw new Error(`HTTP ${res.status}`)
93|92|      const data = await res.json()
94|93|      setJobs(data || [])
95|94|    } catch (e: any) {
96|95|      setError(e.message)
97|96|    } finally {
98|97|      setLoading(false)
99|98|    }
100|99|  }, [])
101|100|
102|101|  useEffect(() => { loadData() }, [loadData])
103|102|
104|103|  const activeJobs = jobs.filter(j => j.enabled !== false)
105|104|  const errorJobs = jobs.filter(j => j.last_status === 'error')
106|105|
107|106|  return (
108|107|    <div className="space-y-4 sm:space-y-6">
109|108|      {/* Header */}
110|109|      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-slide-up">
111|110|        <div>
112|111|          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Cron Jobs</h1>
113|112|          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
114|113|            {activeJobs.length} active · {errorJobs.length} with errors
115|114|          </p>
116|115|        </div>
117|116|        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl glass-panel border border-[var(--border)] text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all self-start sm:self-auto">
118|117|          <RefreshCw className="w-3.5 h-3.5" /> Refresh
119|118|        </button>
120|119|      </div>
121|120|
122|121|      {loading ? (
123|122|        <div className="flex items-center justify-center py-20">
124|123|          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
125|124|        </div>
126|125|      ) : error ? (
127|126|        <div className="rounded-2xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 p-4 sm:p-6 text-center">
128|127|          <AlertTriangle className="w-8 h-8 text-[var(--danger)] mx-auto mb-2" />
129|128|          <p className="text-sm text-[var(--danger)]">{error}</p>
130|129|        </div>
131|130|      ) : jobs.length === 0 ? (
132|131|        <div className="rounded-2xl glass-panel border border-[var(--border)] p-12 sm:p-16 text-center">
133|132|          <Clock className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-30" />
134|133|          <p className="text-lg font-medium text-[var(--text-secondary)]">No cron jobs found</p>
135|134|        </div>
136|135|      ) : (
137|136|        <div className="grid gap-2 sm:gap-3 animate-slide-up" style={{ animationDelay: '60ms' }}>
138|137|          {jobs.map((job) => {
139|138|            const expr = job.schedule_display || job.schedule || '—'
140|139|            const humanSchedule = getScheduleHuman(expr)
141|140|            const hasError = job.last_status === 'error'
142|141|            return (
143|142|              <div key={job.id} className={`rounded-xl sm:rounded-2xl glass-panel border p-3 sm:p-4 card-hover ${hasError ? 'border-[var(--danger)]/30' : 'border-[var(--border)]'}`}>
144|143|                <div className="flex items-start gap-2 sm:gap-3">
145|144|                  {/* Icon */}
146|145|                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${hasError ? 'bg-[var(--danger)]/10' : 'bg-[var(--accent)]/10'}`}>
147|146|                    {hasError ? <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--danger)]" /> : <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent)]" />}
148|147|                  </div>
149|148|                  {/* Content — takes remaining space, shrinks properly */}
150|149|                  <div className="flex-1 min-w-0">
151|150|                    <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate"><Link href={`/cron/${job.id}`}>{job.name}</Link></h3>
152|151|                    <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-0.5">{humanSchedule}</p>
153|152|                    {job.last_error && (
154|153|                      <p className="text-[10px] sm:text-[11px] text-[var(--danger)]/70 mt-1 break-words leading-relaxed">{job.last_error}</p>
155|154|                    )}
156|155|                    {job.last_run_at && (
157|156|                      <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
158|157|                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /> Last: {timeAgo(job.last_run_at)}
159|158|                      </p>
160|159|                    )}
161|160|                  </div>
162|161|                  {/* Status — fixed width, never grows */}
163|162|                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
164|163|                    <div className="flex items-center gap-1">
165|164|                      {hasError ? (
166|165|                        <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[var(--danger)]" />
167|166|                      ) : (
168|167|                        <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[var(--success)]" />
169|168|                      )}
170|169|                      <span className={`text-[9px] sm:text-[10px] uppercase tracking-wider font-medium ${hasError ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
171|170|                        {hasError ? 'Error' : 'Active'}
172|171|                      </span>
173|172|                    </div>
174|173|                    {job.next_run_at && (
175|174|                      <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] flex items-center gap-0.5 sm:gap-1">
176|175|                        <Timer className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
177|176|                        {timeUntil(job.next_run_at)}
178|177|                      </span>
179|178|                    )}
180|179|                  </div>
181|180|                </div>
182|181|              </div>
183|182|            )
184|183|          })}
185|184|        </div>
186|185|      )}
187|186|    </div>
188|187|  )
189|188|}
190|189|