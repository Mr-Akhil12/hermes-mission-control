import { z } from 'zod'

export const allowedTables = [
  'agent_activities',
  'tasks',
  'sessions',
  'cron_jobs',
  'cron_runs',
  'conversations',
  'messages',
] as const

export const dataQuerySchema = z.object({
  table: z.enum(allowedTables),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  order: z.string().regex(/^\w+\.(asc|desc)$/).default('created_at.desc'),
  id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
})

export const dataMutationSchema = z.object({
  table: z.enum(allowedTables),
  data: z.record(z.string(), z.unknown()).refine(
    (d) => Object.keys(d).length > 0,
    { message: 'Data object cannot be empty' }
  ),
})

export const dataPatchSchema = z.object({
  table: z.enum(allowedTables),
  id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()).refine(
    (d) => Object.keys(d).length > 0,
    { message: 'Data object cannot be empty' }
  ),
})
