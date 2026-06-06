-- Cron Runs table for Mission Control
-- Run this manually in Supabase SQL Editor: https://supabase.com/dashboard/project/bwlrhvmgychtgfwwgmhn/sql

-- ─── CRON RUNS ───
CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id TEXT NOT NULL,
  job_name TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT DEFAULT 'ok' CHECK (status IN ('running', 'ok', 'error')),
  output_preview TEXT,
  output_file TEXT,
  output_size INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_id ON cron_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_cron_runs_created ON cron_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_status ON cron_runs(status);

-- ─── REALTIME ───
ALTER PUBLICATION supabase_realtime ADD TABLE cron_runs;

-- ─── RLS ───
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON cron_runs FOR ALL USING (true);
