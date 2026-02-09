-- AI Dashboard Database Schema
-- Run this in Supabase SQL Editor

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  source TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  metadata JSONB
);

CREATE INDEX idx_activities_source ON activities(source);
CREATE INDEX idx_activities_timestamp ON activities(timestamp DESC);
CREATE INDEX idx_activities_type ON activities(type);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' NOT NULL,
  priority TEXT DEFAULT 'medium',
  assignee TEXT,
  assigned_by TEXT,
  review_count INTEGER DEFAULT 0,
  first_try_success BOOLEAN,
  retro_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);

-- Scheduled tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'cron',
  cron_expression TEXT,
  status TEXT DEFAULT 'active',
  source TEXT NOT NULL,
  next_run TIMESTAMPTZ,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_scheduled_tasks_source ON scheduled_tasks(source);

-- Memory files table
CREATE TABLE IF NOT EXISTS memory_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT,
  path TEXT NOT NULL,
  type TEXT DEFAULT 'daily',
  source TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_memory_files_source ON memory_files(source);

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMPTZ,
  api_token_hash TEXT,
  metadata JSONB
);

-- Insert default bots
INSERT INTO bots (id, name, color, status) VALUES
  ('xiaobei', '小北', '#10B981', 'online'),
  ('clawd2', 'clawd2', '#6366F1', 'online'),
  ('clawd3', 'clawd3', '#F59E0B', 'online')
ON CONFLICT (id) DO NOTHING;

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tasks
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger for memory_files
CREATE TRIGGER memory_files_updated_at
  BEFORE UPDATE ON memory_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security (optional, for multi-tenant)
-- ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
