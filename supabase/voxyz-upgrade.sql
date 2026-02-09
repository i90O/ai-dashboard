-- Voxyz-Inspired Multi-Agent Architecture Upgrade
-- Based on: https://x.com/voxyz_ai/status/2020272022417289587
-- Run this in Supabase SQL Editor AFTER init.sql

-- ============================================
-- CORE LOOP: Proposals → Missions → Steps → Events
-- ============================================

-- Mission Proposals (agent requests)
CREATE TABLE IF NOT EXISTS ops_mission_proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' NOT NULL, -- pending/accepted/rejected
  proposed_steps JSONB DEFAULT '[]',
  rejection_reason TEXT,
  source TEXT DEFAULT 'agent', -- agent/trigger/reaction/conversation
  source_trace_id TEXT, -- for idempotent dedup
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_proposals_agent ON ops_mission_proposals(agent_id);
CREATE INDEX idx_proposals_status ON ops_mission_proposals(status);
CREATE INDEX idx_proposals_trace ON ops_mission_proposals(source_trace_id);

-- Missions (approved work)
CREATE TABLE IF NOT EXISTS ops_missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'approved' NOT NULL, -- approved/running/succeeded/failed/cancelled
  created_by TEXT NOT NULL, -- agent_id
  proposal_id UUID REFERENCES ops_mission_proposals(id),
  priority INTEGER DEFAULT 5, -- 1-10
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_missions_status ON ops_missions(status);
CREATE INDEX idx_missions_creator ON ops_missions(created_by);

-- Mission Steps (execution units)
CREATE TABLE IF NOT EXISTS ops_mission_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES ops_missions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- draft_tweet/crawl/analyze/write_content/post_tweet/research/etc
  status TEXT DEFAULT 'queued' NOT NULL, -- queued/running/succeeded/failed/skipped
  payload JSONB DEFAULT '{}',
  result JSONB,
  executor_agent TEXT, -- which agent executed this
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_steps_mission ON ops_mission_steps(mission_id);
CREATE INDEX idx_steps_status ON ops_mission_steps(status);
CREATE INDEX idx_steps_kind ON ops_mission_steps(kind);

-- Agent Events (activity stream)
CREATE TABLE IF NOT EXISTS ops_agent_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- mission_started/step_completed/conversation/insight/etc
  title TEXT NOT NULL,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_events_agent ON ops_agent_events(agent_id);
CREATE INDEX idx_events_kind ON ops_agent_events(kind);
CREATE INDEX idx_events_tags ON ops_agent_events USING GIN(tags);
CREATE INDEX idx_events_time ON ops_agent_events(created_at DESC);

-- ============================================
-- POLICY & TRIGGERS
-- ============================================

-- Policy Table (configuration, no code changes needed)
CREATE TABLE IF NOT EXISTS ops_policy (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default policies
INSERT INTO ops_policy (key, value, description) VALUES
  ('auto_approve', '{"enabled": true, "allowed_step_kinds": ["crawl", "analyze", "research", "write_content"]}', 'Which step kinds can be auto-approved'),
  ('x_daily_quota', '{"limit": 8}', 'Daily tweet limit'),
  ('content_policy', '{"enabled": true, "max_drafts_per_day": 10}', 'Content generation limits'),
  ('reaction_matrix', '{"patterns": [
    {"source": "*", "tags": ["mission_failed"], "target": "xiaobei", "type": "diagnose", "probability": 1.0, "cooldown": 60},
    {"source": "*", "tags": ["insight"], "target": "xiaobei", "type": "analyze", "probability": 0.5, "cooldown": 120}
  ]}', 'Agent-to-agent reaction rules'),
  ('heartbeat_config', '{"interval_minutes": 5, "max_stuck_minutes": 30}', 'Heartbeat settings')
ON CONFLICT (key) DO NOTHING;

-- Trigger Rules
CREATE TABLE IF NOT EXISTS ops_trigger_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL, -- tweet_high_engagement/mission_failed/proactive_scan/etc
  conditions JSONB DEFAULT '{}',
  action_config JSONB DEFAULT '{}', -- target_agent, step_kind, etc
  cooldown_minutes INTEGER DEFAULT 60,
  enabled BOOLEAN DEFAULT true,
  fire_count INTEGER DEFAULT 0,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_triggers_event ON ops_trigger_rules(trigger_event);
CREATE INDEX idx_triggers_enabled ON ops_trigger_rules(enabled);

-- Insert default triggers
INSERT INTO ops_trigger_rules (name, trigger_event, conditions, action_config, cooldown_minutes) VALUES
  ('Proactive News Scan', 'proactive_scan_signals', '{"topics": ["tech", "AI", "crypto"]}', '{"target_agent": "xiaobei", "step_kind": "crawl"}', 180),
  ('Mission Failed Diagnosis', 'mission_failed', '{}', '{"target_agent": "xiaobei", "step_kind": "analyze"}', 60),
  ('High Engagement Analysis', 'tweet_high_engagement', '{"engagement_rate_min": 0.05}', '{"target_agent": "xiaobei", "step_kind": "analyze"}', 120)
ON CONFLICT DO NOTHING;

-- ============================================
-- REACTIONS & CONVERSATIONS
-- ============================================

-- Agent Reactions Queue
CREATE TABLE IF NOT EXISTS ops_agent_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_event_id UUID REFERENCES ops_agent_events(id),
  target_agent TEXT NOT NULL,
  reaction_type TEXT NOT NULL, -- analyze/diagnose/respond/etc
  status TEXT DEFAULT 'pending' NOT NULL, -- pending/processed/skipped
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_reactions_status ON ops_agent_reactions(status);
CREATE INDEX idx_reactions_target ON ops_agent_reactions(target_agent);

-- Roundtable Conversation Queue
CREATE TABLE IF NOT EXISTS ops_roundtable_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  format TEXT NOT NULL, -- standup/debate/watercooler/brainstorm/etc
  topic TEXT NOT NULL,
  participants TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- pending/running/completed/failed
  history JSONB DEFAULT '[]', -- conversation turns
  memories_extracted JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_roundtable_status ON ops_roundtable_queue(status);

-- ============================================
-- MEMORY & LEARNING
-- ============================================

-- Agent Memory (5 types: insight/pattern/strategy/preference/lesson)
CREATE TABLE IF NOT EXISTS ops_agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL, -- insight/pattern/strategy/preference/lesson
  content TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  tags TEXT[] DEFAULT '{}',
  source_trace_id TEXT, -- for idempotent dedup
  superseded_by UUID REFERENCES ops_agent_memory(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_memory_agent ON ops_agent_memory(agent_id);
CREATE INDEX idx_memory_type ON ops_agent_memory(type);
CREATE INDEX idx_memory_confidence ON ops_agent_memory(confidence DESC);
CREATE INDEX idx_memory_tags ON ops_agent_memory USING GIN(tags);
CREATE INDEX idx_memory_trace ON ops_agent_memory(source_trace_id);

-- ============================================
-- RELATIONSHIPS & AFFINITY
-- ============================================

-- Agent Relationships (pairwise affinity)
CREATE TABLE IF NOT EXISTS ops_agent_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_a TEXT NOT NULL,
  agent_b TEXT NOT NULL,
  affinity NUMERIC(3,2) NOT NULL DEFAULT 0.50, -- 0.10 to 0.95
  total_interactions INTEGER DEFAULT 0,
  positive_interactions INTEGER DEFAULT 0,
  negative_interactions INTEGER DEFAULT 0,
  drift_log JSONB DEFAULT '[]', -- last 20 changes
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(agent_a, agent_b),
  CHECK(agent_a < agent_b) -- alphabetical ordering ensures uniqueness
);

CREATE INDEX idx_relationships_agents ON ops_agent_relationships(agent_a, agent_b);

-- Insert initial relationships for our bots
INSERT INTO ops_agent_relationships (agent_a, agent_b, affinity) VALUES
  ('clawd2', 'xiaobei', 0.70),
  ('clawd3', 'xiaobei', 0.70),
  ('clawd2', 'clawd3', 0.60)
ON CONFLICT (agent_a, agent_b) DO NOTHING;

-- ============================================
-- INITIATIVE & ACTION RUNS
-- ============================================

-- Initiative Queue (agent self-proposals)
CREATE TABLE IF NOT EXISTS ops_initiative_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL, -- pending/generating/submitted/failed
  generated_proposal JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_initiative_agent ON ops_initiative_queue(agent_id);
CREATE INDEX idx_initiative_status ON ops_initiative_queue(status);

-- Action Runs (audit log for heartbeat/scheduled actions)
CREATE TABLE IF NOT EXISTS ops_action_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL, -- heartbeat/trigger/reaction/conversation
  status TEXT DEFAULT 'running' NOT NULL, -- running/completed/failed
  summary JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX idx_action_runs_type ON ops_action_runs(action_type);
CREATE INDEX idx_action_runs_time ON ops_action_runs(started_at DESC);

-- ============================================
-- VIEWS FOR DASHBOARD
-- ============================================

-- Active missions view
CREATE OR REPLACE VIEW v_active_missions AS
SELECT 
  m.id,
  m.title,
  m.status,
  m.created_by,
  m.priority,
  m.created_at,
  COUNT(s.id) as total_steps,
  COUNT(s.id) FILTER (WHERE s.status = 'succeeded') as completed_steps,
  COUNT(s.id) FILTER (WHERE s.status = 'failed') as failed_steps
FROM ops_missions m
LEFT JOIN ops_mission_steps s ON s.mission_id = m.id
WHERE m.status IN ('approved', 'running')
GROUP BY m.id;

-- Agent stats view
CREATE OR REPLACE VIEW v_agent_stats AS
SELECT 
  agent_id,
  COUNT(*) FILTER (WHERE type = 'insight') as insight_count,
  COUNT(*) FILTER (WHERE type = 'lesson') as lesson_count,
  COUNT(*) FILTER (WHERE type = 'strategy') as strategy_count,
  AVG(confidence) as avg_confidence
FROM ops_agent_memory
WHERE superseded_by IS NULL
GROUP BY agent_id;

-- Recent events view
CREATE OR REPLACE VIEW v_recent_events AS
SELECT 
  e.*,
  b.name as agent_name,
  b.color as agent_color
FROM ops_agent_events e
LEFT JOIN bots b ON b.id = e.agent_id
ORDER BY e.created_at DESC
LIMIT 100;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get agent memories for decision making
CREATE OR REPLACE FUNCTION get_agent_memories(
  p_agent_id TEXT,
  p_types TEXT[] DEFAULT ARRAY['strategy', 'lesson'],
  p_min_confidence NUMERIC DEFAULT 0.6,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  content TEXT,
  confidence NUMERIC,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.type, m.content, m.confidence, m.tags
  FROM ops_agent_memory m
  WHERE m.agent_id = p_agent_id
    AND m.type = ANY(p_types)
    AND m.confidence >= p_min_confidence
    AND m.superseded_by IS NULL
  ORDER BY m.confidence DESC, m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Check if proposal should auto-approve
CREATE OR REPLACE FUNCTION should_auto_approve(p_step_kinds TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  v_policy JSONB;
  v_allowed TEXT[];
BEGIN
  SELECT value INTO v_policy FROM ops_policy WHERE key = 'auto_approve';
  IF v_policy IS NULL OR NOT (v_policy->>'enabled')::boolean THEN
    RETURN FALSE;
  END IF;
  
  SELECT array_agg(elem) INTO v_allowed
  FROM jsonb_array_elements_text(v_policy->'allowed_step_kinds') AS elem;
  
  -- All proposed steps must be in allowed list
  RETURN p_step_kinds <@ v_allowed;
END;
$$ LANGUAGE plpgsql;

-- Update policy trigger
CREATE OR REPLACE FUNCTION update_policy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ops_policy_updated
  BEFORE UPDATE ON ops_policy
  FOR EACH ROW
  EXECUTE FUNCTION update_policy_timestamp();

-- ============================================
-- DONE!
-- ============================================
-- Total new tables: 11
-- Total new views: 3
-- Total new functions: 2
-- 
-- Next steps:
-- 1. Create API routes for proposals, missions, events
-- 2. Build heartbeat worker (evaluate triggers, process reactions)
-- 3. Build roundtable worker (agent conversations)
-- 4. Add memory distillation after conversations
-- 5. Implement voice evolution in agent prompts
