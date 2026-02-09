-- Voxyz Complete Schema - All 8 Chapters
-- Run this in Supabase SQL Editor

-- ============================================
-- CHAPTER 1: FOUNDATION (Base Tables)
-- ============================================

-- Agent Profiles (central registry with backstory)
CREATE TABLE IF NOT EXISTS ops_agent_profiles (
  id TEXT PRIMARY KEY, -- e.g. 'xiaobei', 'clawd2'
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  backstory TEXT, -- Initial personality backstory
  voice_base JSONB DEFAULT '{}', -- Base voice config
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert our agents
INSERT INTO ops_agent_profiles (id, display_name, backstory, voice_base) VALUES
  ('xiaobei', '小北', 'A helpful compass-like AI. Direct, efficient, slightly playful. Uses metaphors. Cares about getting things done.', 
   '{"tone": "warm-efficient", "quirk": "compass metaphors", "emoji": "🧭"}'),
  ('clawd2', 'Clawd2', 'An analytical AI who grounds opinions in data. Skeptical but fair. Always cites numbers.',
   '{"tone": "analytical", "quirk": "data citations", "emoji": "📊"}'),
  ('clawd3', 'Clawd3', 'A creative AI who prefers action over planning. Energetic and wants to try things now.',
   '{"tone": "action-biased", "quirk": "lets do it", "emoji": "🚀"}')
ON CONFLICT (id) DO NOTHING;

-- Mission Proposals
CREATE TABLE IF NOT EXISTS ops_mission_proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  proposed_steps JSONB DEFAULT '[]',
  rejection_reason TEXT,
  source TEXT DEFAULT 'agent' CHECK (source IN ('agent', 'trigger', 'reaction', 'conversation', 'initiative', 'human')),
  source_trace_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proposals_agent ON ops_mission_proposals(agent_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON ops_mission_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_trace ON ops_mission_proposals(source_trace_id);

-- Missions
CREATE TABLE IF NOT EXISTS ops_missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'approved' NOT NULL CHECK (status IN ('approved', 'running', 'succeeded', 'failed', 'cancelled')),
  created_by TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  proposal_id UUID REFERENCES ops_mission_proposals(id),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_missions_status ON ops_missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_creator ON ops_missions(created_by);

-- Mission Steps
CREATE TABLE IF NOT EXISTS ops_mission_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES ops_missions(id) ON DELETE CASCADE,
  seq INTEGER DEFAULT 1, -- execution order
  kind TEXT NOT NULL,
  status TEXT DEFAULT 'queued' NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  payload JSONB DEFAULT '{}',
  result JSONB,
  executor_agent TEXT REFERENCES ops_agent_profiles(id),
  reserved_by TEXT, -- worker ID for atomic claiming
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_steps_mission ON ops_mission_steps(mission_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON ops_mission_steps(status);
CREATE INDEX IF NOT EXISTS idx_steps_kind ON ops_mission_steps(kind);

-- Agent Events
CREATE TABLE IF NOT EXISTS ops_agent_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_agent ON ops_agent_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON ops_agent_events(kind);
CREATE INDEX IF NOT EXISTS idx_events_tags ON ops_agent_events USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_events_time ON ops_agent_events(created_at DESC);

-- Policy Table
CREATE TABLE IF NOT EXISTS ops_policy (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Default policies
INSERT INTO ops_policy (key, value, description) VALUES
  ('auto_approve', '{"enabled": true, "allowed_step_kinds": ["crawl", "analyze", "research", "write_content"]}', 'Auto-approve step kinds'),
  ('x_daily_quota', '{"limit": 8, "used": 0, "reset_hour": 0}', 'Daily tweet limit'),
  ('content_policy', '{"max_drafts_per_day": 10}', 'Content limits'),
  ('initiative_limits', '{"max_per_agent_per_day": 3, "min_memories_required": 5}', 'Initiative limits from Ch5'),
  ('memory_influence', '{"probability": 0.30, "max_memories_per_prompt": 5}', 'Ch3: 30% memory influence'),
  ('conversation_limits', '{"max_turn_length": 120, "min_turns": 2, "max_turns": 10}', 'Ch2 conversation limits'),
  ('affinity_drift', '{"min": -0.03, "max": 0.03, "floor": 0.10, "ceiling": 0.95}', 'Ch4 drift bounds'),
  ('heartbeat_config', '{"interval_minutes": 5, "max_stuck_minutes": 30}', 'Heartbeat settings'),
  ('circuit_breaker', '{"failure_threshold": 5, "reset_timeout_minutes": 15, "half_open_requests": 3}', 'Ch8 circuit breaker'),
  ('reaction_matrix', '{
    "patterns": [
      {"source": "*", "tags": ["mission_failed"], "target": "xiaobei", "type": "diagnose", "probability": 1.0, "cooldown": 60},
      {"source": "*", "tags": ["tweet", "posted"], "target": "xiaobei", "type": "analyze", "probability": 0.3, "cooldown": 120},
      {"source": "*", "tags": ["content_published"], "target": "clawd2", "type": "review", "probability": 0.5, "cooldown": 90},
      {"source": "*", "tags": ["insight_promoted"], "target": "clawd3", "type": "validate", "probability": 0.4, "cooldown": 180}
    ]
  }', 'Agent-to-agent reaction patterns')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- Trigger Rules
CREATE TABLE IF NOT EXISTS ops_trigger_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  action_config JSONB DEFAULT '{}',
  cooldown_minutes INTEGER DEFAULT 60,
  enabled BOOLEAN DEFAULT true,
  fire_count INTEGER DEFAULT 0,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_triggers_event ON ops_trigger_rules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_triggers_enabled ON ops_trigger_rules(enabled);

-- Default triggers
INSERT INTO ops_trigger_rules (name, trigger_event, conditions, action_config, cooldown_minutes) VALUES
  ('Proactive News Scan', 'proactive_scan', '{"topics": ["tech", "AI", "crypto"]}', '{"target_agent": "xiaobei", "step_kind": "crawl"}', 180),
  ('Mission Failed Diagnosis', 'mission_failed', '{}', '{"target_agent": "xiaobei", "step_kind": "diagnose"}', 60),
  ('High Engagement Analysis', 'tweet_high_engagement', '{"min_engagement_rate": 0.05}', '{"target_agent": "xiaobei", "step_kind": "analyze"}', 120)
ON CONFLICT DO NOTHING;

-- Agent Reactions Queue
CREATE TABLE IF NOT EXISTS ops_agent_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_event_id UUID REFERENCES ops_agent_events(id),
  target_agent TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  reaction_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'processed', 'skipped')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reactions_status ON ops_agent_reactions(status);
CREATE INDEX IF NOT EXISTS idx_reactions_target ON ops_agent_reactions(target_agent);

-- Action Runs (audit log)
CREATE TABLE IF NOT EXISTS ops_action_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  status TEXT DEFAULT 'running' NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  summary JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_action_runs_type ON ops_action_runs(action_type);
CREATE INDEX IF NOT EXISTS idx_action_runs_time ON ops_action_runs(started_at DESC);

-- ============================================
-- CHAPTER 2: MAKING THEM TALK
-- ============================================

-- Agent Schedules (24-hour activity patterns)
CREATE TABLE IF NOT EXISTS ops_agent_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
  activity_weight NUMERIC(3,2) DEFAULT 1.0 CHECK (activity_weight >= 0 AND activity_weight <= 1),
  preferred_formats TEXT[] DEFAULT '{}', -- standup, debate, watercooler
  UNIQUE(agent_id, hour)
);

-- Seed default schedules (agents more active during work hours)
INSERT INTO ops_agent_schedules (agent_id, hour, activity_weight, preferred_formats)
SELECT 
  agent.id,
  hour,
  CASE 
    WHEN hour BETWEEN 9 AND 17 THEN 1.0
    WHEN hour BETWEEN 18 AND 22 THEN 0.7
    ELSE 0.3
  END,
  CASE 
    WHEN hour BETWEEN 9 AND 11 THEN ARRAY['standup']
    WHEN hour BETWEEN 14 AND 16 THEN ARRAY['brainstorm', 'debate']
    ELSE ARRAY['watercooler']
  END
FROM ops_agent_profiles agent
CROSS JOIN generate_series(0, 23) AS hour
ON CONFLICT (agent_id, hour) DO NOTHING;

-- Roundtable Conversation Queue
CREATE TABLE IF NOT EXISTS ops_roundtable_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  format TEXT NOT NULL CHECK (format IN ('standup', 'debate', 'watercooler', 'brainstorm', 'retrospective')),
  topic TEXT NOT NULL,
  participants TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  history JSONB DEFAULT '[]',
  memories_extracted JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]', -- Ch5: action items from conversations
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roundtable_status ON ops_roundtable_queue(status);

-- Conversation Formats Config
CREATE TABLE IF NOT EXISTS ops_conversation_formats (
  format TEXT PRIMARY KEY,
  min_agents INTEGER DEFAULT 2,
  max_agents INTEGER DEFAULT 4,
  min_turns INTEGER DEFAULT 2,
  max_turns INTEGER DEFAULT 8,
  temperature NUMERIC(2,1) DEFAULT 0.7,
  system_prompt TEXT
);

INSERT INTO ops_conversation_formats (format, min_agents, max_agents, min_turns, max_turns, temperature, system_prompt) VALUES
  ('standup', 2, 4, 4, 8, 0.6, 'Quick status updates. Each agent shares what they did, what they will do, and blockers.'),
  ('debate', 2, 3, 4, 8, 0.8, 'Structured debate on a topic. Agents take positions and argue their points.'),
  ('watercooler', 2, 3, 2, 4, 0.9, 'Casual chat. Light topics, building rapport.'),
  ('brainstorm', 2, 4, 4, 10, 0.7, 'Generate ideas freely. Build on each others suggestions.'),
  ('retrospective', 2, 4, 4, 8, 0.6, 'Review what worked, what didnt, and improvements.')
ON CONFLICT (format) DO NOTHING;

-- ============================================
-- CHAPTER 3: MAKING THEM REMEMBER
-- ============================================

-- Agent Memory (5 types)
CREATE TABLE IF NOT EXISTS ops_agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  type TEXT NOT NULL CHECK (type IN ('insight', 'pattern', 'strategy', 'preference', 'lesson')),
  content TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.60 CHECK (confidence >= 0 AND confidence <= 1),
  tags TEXT[] DEFAULT '{}',
  source TEXT, -- conversation_id, mission_id, tweet_id, etc
  source_trace_id TEXT,
  used_count INTEGER DEFAULT 0, -- track how often memory is used
  last_used_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES ops_agent_memory(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_agent ON ops_agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_type ON ops_agent_memory(type);
CREATE INDEX IF NOT EXISTS idx_memory_confidence ON ops_agent_memory(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_memory_tags ON ops_agent_memory USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memory_active ON ops_agent_memory(agent_id, superseded_by) WHERE superseded_by IS NULL;

-- Memory Cache (for 30% influence - avoids repeated queries)
CREATE TABLE IF NOT EXISTS ops_memory_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  context_type TEXT NOT NULL, -- 'conversation', 'mission', 'tweet'
  context_id TEXT NOT NULL,
  selected_memories UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, context_type, context_id)
);

-- Tweet Performance Tracking (for memory from results)
CREATE TABLE IF NOT EXISTS ops_tweet_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id TEXT NOT NULL UNIQUE,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  content TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,4) DEFAULT 0,
  reviewed BOOLEAN DEFAULT false,
  lesson_extracted UUID REFERENCES ops_agent_memory(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tweet_perf_agent ON ops_tweet_performance(agent_id);
CREATE INDEX IF NOT EXISTS idx_tweet_perf_reviewed ON ops_tweet_performance(reviewed) WHERE NOT reviewed;

-- ============================================
-- CHAPTER 4: DYNAMIC AFFINITY
-- ============================================

-- Agent Relationships (pairwise affinity)
CREATE TABLE IF NOT EXISTS ops_agent_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_a TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  agent_b TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  affinity NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (affinity >= 0.10 AND affinity <= 0.95),
  total_interactions INTEGER DEFAULT 0,
  positive_interactions INTEGER DEFAULT 0,
  negative_interactions INTEGER DEFAULT 0,
  drift_log JSONB DEFAULT '[]',
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(agent_a, agent_b),
  CHECK(agent_a < agent_b) -- alphabetical ordering
);

CREATE INDEX IF NOT EXISTS idx_relationships_agents ON ops_agent_relationships(agent_a, agent_b);

-- Seed initial relationships
INSERT INTO ops_agent_relationships (agent_a, agent_b, affinity) VALUES
  ('clawd2', 'xiaobei', 0.70),
  ('clawd3', 'xiaobei', 0.70),
  ('clawd2', 'clawd3', 0.60)
ON CONFLICT (agent_a, agent_b) DO NOTHING;

-- ============================================
-- CHAPTER 5: INITIATIVE SYSTEM
-- ============================================

-- Initiative Queue (agent self-proposals)
CREATE TABLE IF NOT EXISTS ops_initiative_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'generating', 'submitted', 'blocked', 'failed')),
  trigger_reason TEXT, -- 'memory_threshold', 'conversation_action_item', 'schedule'
  context JSONB DEFAULT '{}',
  generated_proposal JSONB,
  proposal_id UUID REFERENCES ops_mission_proposals(id),
  blocked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_initiative_agent ON ops_initiative_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_initiative_status ON ops_initiative_queue(status);

-- Daily Initiative Tracking
CREATE TABLE IF NOT EXISTS ops_initiative_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 0,
  UNIQUE(agent_id, date)
);

-- ============================================
-- CHAPTER 6: VOICE EVOLUTION
-- ============================================

-- Voice Modifiers (derived from memories, rule-based not LLM)
CREATE TABLE IF NOT EXISTS ops_voice_modifiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  modifier_type TEXT NOT NULL CHECK (modifier_type IN ('tone', 'vocabulary', 'topic_affinity', 'emoji_usage', 'formality')),
  value JSONB NOT NULL, -- e.g. {"level": 0.7, "keywords": ["data", "metrics"]}
  source_memories UUID[] DEFAULT '{}',
  confidence NUMERIC(3,2) DEFAULT 0.5,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_agent ON ops_voice_modifiers(agent_id);
CREATE INDEX IF NOT EXISTS idx_voice_active ON ops_voice_modifiers(agent_id, active) WHERE active;

-- Voice Derivation Rules (rule-based, not LLM)
CREATE TABLE IF NOT EXISTS ops_voice_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  memory_pattern JSONB NOT NULL, -- e.g. {"type": "lesson", "tags_contain": "data"}
  modifier_effect JSONB NOT NULL, -- e.g. {"modifier_type": "vocabulary", "add_keywords": ["metrics"]}
  priority INTEGER DEFAULT 5,
  active BOOLEAN DEFAULT true
);

INSERT INTO ops_voice_rules (name, description, memory_pattern, modifier_effect, priority) VALUES
  ('Data Lessons → Analytical', 'Agents who learn from data become more analytical',
   '{"type": "lesson", "tags_contain": "data", "min_count": 3}',
   '{"modifier_type": "vocabulary", "add_keywords": ["data", "metrics", "analysis"]}', 5),
  ('Social Insights → Warmer', 'Agents with social insights become warmer',
   '{"type": "insight", "tags_contain": "social", "min_count": 3}',
   '{"modifier_type": "tone", "shift": "warmer", "amount": 0.1}', 5),
  ('Failed Strategies → Cautious', 'Failed strategies make agents more cautious',
   '{"type": "strategy", "confidence_below": 0.4, "min_count": 2}',
   '{"modifier_type": "formality", "shift": "more_formal", "amount": 0.1}', 6)
ON CONFLICT DO NOTHING;

-- Voice Cache (within conversation, avoid recalculating)
CREATE TABLE IF NOT EXISTS ops_voice_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES ops_agent_profiles(id),
  context_id TEXT NOT NULL, -- conversation_id or mission_id
  compiled_voice JSONB NOT NULL, -- full voice config for this context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  UNIQUE(agent_id, context_id)
);

-- ============================================
-- CHAPTER 8: LAUNCH (Circuit Breaker State)
-- ============================================

-- Circuit Breaker State
CREATE TABLE IF NOT EXISTS ops_circuit_breaker (
  service TEXT PRIMARY KEY,
  state TEXT DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  half_open_successes INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ops_circuit_breaker (service) VALUES
  ('twitter_api'),
  ('anthropic_api'),
  ('firecrawl_api'),
  ('mission_worker'),
  ('roundtable_worker'),
  ('initiative_worker')
ON CONFLICT (service) DO NOTHING;

-- Default worker policies
INSERT INTO ops_policy (key, value, description) VALUES
  ('mission_worker', '{"enabled": true}', 'Mission worker enabled/disabled'),
  ('roundtable_worker', '{"enabled": true}', 'Roundtable worker enabled/disabled'),
  ('initiative_worker', '{"enabled": false}', 'Initiative worker - keep off until stable')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- VIEWS
-- ============================================

-- Active missions with progress
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
  COUNT(s.id) FILTER (WHERE s.status = 'failed') as failed_steps,
  COUNT(s.id) FILTER (WHERE s.status = 'running') as running_steps
FROM ops_missions m
LEFT JOIN ops_mission_steps s ON s.mission_id = m.id
WHERE m.status IN ('approved', 'running')
GROUP BY m.id;

-- Agent stats with memory counts
CREATE OR REPLACE VIEW v_agent_stats AS
SELECT 
  p.id as agent_id,
  p.display_name,
  COUNT(m.id) FILTER (WHERE m.type = 'insight' AND m.superseded_by IS NULL) as insights,
  COUNT(m.id) FILTER (WHERE m.type = 'lesson' AND m.superseded_by IS NULL) as lessons,
  COUNT(m.id) FILTER (WHERE m.type = 'strategy' AND m.superseded_by IS NULL) as strategies,
  COUNT(m.id) FILTER (WHERE m.type = 'pattern' AND m.superseded_by IS NULL) as patterns,
  COUNT(m.id) FILTER (WHERE m.type = 'preference' AND m.superseded_by IS NULL) as preferences,
  COALESCE(AVG(m.confidence) FILTER (WHERE m.superseded_by IS NULL), 0) as avg_confidence,
  COUNT(DISTINCT mis.id) FILTER (WHERE mis.status = 'succeeded') as successful_missions
FROM ops_agent_profiles p
LEFT JOIN ops_agent_memory m ON m.agent_id = p.id
LEFT JOIN ops_missions mis ON mis.created_by = p.id
GROUP BY p.id, p.display_name;

-- Pending proposals view
CREATE OR REPLACE VIEW v_pending_proposals AS
SELECT 
  p.*,
  ap.display_name as agent_name
FROM ops_mission_proposals p
JOIN ops_agent_profiles ap ON ap.id = p.agent_id
WHERE p.status = 'pending'
ORDER BY p.created_at ASC;

-- Relationship map
CREATE OR REPLACE VIEW v_relationship_map AS
SELECT
  r.agent_a,
  a.display_name as agent_a_name,
  r.agent_b,
  b.display_name as agent_b_name,
  r.affinity,
  r.total_interactions,
  CASE 
    WHEN r.affinity >= 0.8 THEN 'strong'
    WHEN r.affinity >= 0.6 THEN 'friendly'
    WHEN r.affinity >= 0.4 THEN 'neutral'
    ELSE 'tense'
  END as relationship_status
FROM ops_agent_relationships r
JOIN ops_agent_profiles a ON a.id = r.agent_a
JOIN ops_agent_profiles b ON b.id = r.agent_b;

-- Initiative status by agent
CREATE OR REPLACE VIEW v_initiative_status AS
SELECT
  p.id as agent_id,
  p.display_name,
  COALESCE(d.count, 0) as initiatives_today,
  pol.value->>'max_per_agent_per_day' as daily_limit,
  COUNT(m.id) FILTER (WHERE m.superseded_by IS NULL) >= 
    (pol.value->>'min_memories_required')::int as can_propose
FROM ops_agent_profiles p
LEFT JOIN ops_initiative_daily d ON d.agent_id = p.id AND d.date = CURRENT_DATE
CROSS JOIN ops_policy pol
LEFT JOIN ops_agent_memory m ON m.agent_id = p.id
WHERE pol.key = 'initiative_limits'
GROUP BY p.id, p.display_name, d.count, pol.value;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get agent memories with 30% probability selection
CREATE OR REPLACE FUNCTION get_memories_for_context(
  p_agent_id TEXT,
  p_context_type TEXT,
  p_context_id TEXT,
  p_types TEXT[] DEFAULT ARRAY['strategy', 'lesson', 'insight'],
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  content TEXT,
  confidence NUMERIC,
  tags TEXT[]
) AS $$
DECLARE
  v_probability NUMERIC;
  v_cached UUID[];
BEGIN
  -- Get probability from policy
  SELECT (value->>'probability')::numeric INTO v_probability
  FROM ops_policy WHERE key = 'memory_influence';
  
  -- Check if this context already has cached memories
  SELECT selected_memories INTO v_cached
  FROM ops_memory_cache
  WHERE agent_id = p_agent_id AND context_type = p_context_type AND context_id = p_context_id;
  
  IF v_cached IS NOT NULL THEN
    -- Return cached memories
    RETURN QUERY
    SELECT m.id, m.type, m.content, m.confidence, m.tags
    FROM ops_agent_memory m
    WHERE m.id = ANY(v_cached);
    RETURN;
  END IF;
  
  -- 30% chance to skip memories entirely
  IF random() > v_probability THEN
    RETURN;
  END IF;
  
  -- Select memories and cache them
  RETURN QUERY
  WITH selected AS (
    SELECT m.id, m.type, m.content, m.confidence, m.tags
    FROM ops_agent_memory m
    WHERE m.agent_id = p_agent_id
      AND m.type = ANY(p_types)
      AND m.confidence >= 0.5
      AND m.superseded_by IS NULL
    ORDER BY m.confidence DESC, random()
    LIMIT p_limit
  )
  SELECT * FROM selected;
  
  -- Cache the selection
  INSERT INTO ops_memory_cache (agent_id, context_type, context_id, selected_memories)
  SELECT p_agent_id, p_context_type, p_context_id, array_agg(s.id)
  FROM (
    SELECT m.id FROM ops_agent_memory m
    WHERE m.agent_id = p_agent_id
      AND m.type = ANY(p_types)
      AND m.confidence >= 0.5
      AND m.superseded_by IS NULL
    ORDER BY m.confidence DESC, random()
    LIMIT p_limit
  ) s
  ON CONFLICT (agent_id, context_type, context_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Apply affinity drift with bounds
CREATE OR REPLACE FUNCTION apply_affinity_drift(
  p_agent_a TEXT,
  p_agent_b TEXT,
  p_drift NUMERIC,
  p_reason TEXT,
  p_source_id TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_ordered_a TEXT;
  v_ordered_b TEXT;
  v_current NUMERIC;
  v_new NUMERIC;
  v_policy JSONB;
  v_min_drift NUMERIC;
  v_max_drift NUMERIC;
  v_floor NUMERIC;
  v_ceiling NUMERIC;
  v_clamped_drift NUMERIC;
BEGIN
  -- Order alphabetically
  IF p_agent_a < p_agent_b THEN
    v_ordered_a := p_agent_a;
    v_ordered_b := p_agent_b;
  ELSE
    v_ordered_a := p_agent_b;
    v_ordered_b := p_agent_a;
  END IF;
  
  -- Get policy
  SELECT value INTO v_policy FROM ops_policy WHERE key = 'affinity_drift';
  v_min_drift := COALESCE((v_policy->>'min')::numeric, -0.03);
  v_max_drift := COALESCE((v_policy->>'max')::numeric, 0.03);
  v_floor := COALESCE((v_policy->>'floor')::numeric, 0.10);
  v_ceiling := COALESCE((v_policy->>'ceiling')::numeric, 0.95);
  
  -- Clamp drift
  v_clamped_drift := GREATEST(v_min_drift, LEAST(v_max_drift, p_drift));
  
  -- Get current affinity
  SELECT affinity INTO v_current
  FROM ops_agent_relationships
  WHERE agent_a = v_ordered_a AND agent_b = v_ordered_b;
  
  IF v_current IS NULL THEN
    -- Create relationship
    INSERT INTO ops_agent_relationships (agent_a, agent_b, affinity)
    VALUES (v_ordered_a, v_ordered_b, 0.50);
    v_current := 0.50;
  END IF;
  
  -- Calculate new affinity with bounds
  v_new := GREATEST(v_floor, LEAST(v_ceiling, v_current + v_clamped_drift));
  
  -- Update
  UPDATE ops_agent_relationships
  SET 
    affinity = v_new,
    total_interactions = total_interactions + 1,
    positive_interactions = positive_interactions + CASE WHEN v_clamped_drift > 0 THEN 1 ELSE 0 END,
    negative_interactions = negative_interactions + CASE WHEN v_clamped_drift < 0 THEN 1 ELSE 0 END,
    last_interaction_at = NOW(),
    drift_log = (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem FROM jsonb_array_elements(COALESCE(drift_log, '[]')) elem
        ORDER BY elem->>'at' DESC
        LIMIT 19
      ) recent
    ) || jsonb_build_array(jsonb_build_object(
      'drift', v_clamped_drift,
      'reason', p_reason,
      'source_id', p_source_id,
      'at', NOW()
    ))
  WHERE agent_a = v_ordered_a AND agent_b = v_ordered_b;
  
  RETURN v_new;
END;
$$ LANGUAGE plpgsql;

-- Check if agent can submit initiative
CREATE OR REPLACE FUNCTION can_agent_submit_initiative(p_agent_id TEXT)
RETURNS TABLE (
  can_submit BOOLEAN,
  reason TEXT,
  memory_count INTEGER,
  today_count INTEGER,
  daily_limit INTEGER
) AS $$
DECLARE
  v_policy JSONB;
  v_min_memories INTEGER;
  v_max_per_day INTEGER;
  v_mem_count INTEGER;
  v_today_count INTEGER;
BEGIN
  -- Get policy
  SELECT value INTO v_policy FROM ops_policy WHERE key = 'initiative_limits';
  v_min_memories := COALESCE((v_policy->>'min_memories_required')::int, 5);
  v_max_per_day := COALESCE((v_policy->>'max_per_agent_per_day')::int, 3);
  
  -- Count active memories
  SELECT COUNT(*) INTO v_mem_count
  FROM ops_agent_memory
  WHERE agent_id = p_agent_id AND superseded_by IS NULL;
  
  -- Count today's initiatives
  SELECT COALESCE(count, 0) INTO v_today_count
  FROM ops_initiative_daily
  WHERE agent_id = p_agent_id AND date = CURRENT_DATE;
  
  -- Check conditions
  IF v_mem_count < v_min_memories THEN
    RETURN QUERY SELECT false, 'Not enough memories (need ' || v_min_memories || ')', v_mem_count, v_today_count, v_max_per_day;
  ELSIF v_today_count >= v_max_per_day THEN
    RETURN QUERY SELECT false, 'Daily limit reached', v_mem_count, v_today_count, v_max_per_day;
  ELSE
    RETURN QUERY SELECT true, 'OK', v_mem_count, v_today_count, v_max_per_day;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Circuit breaker functions
CREATE OR REPLACE FUNCTION circuit_breaker_record_failure(p_service TEXT)
RETURNS TEXT AS $$
DECLARE
  v_state TEXT;
  v_count INTEGER;
  v_threshold INTEGER;
BEGIN
  SELECT (value->>'failure_threshold')::int INTO v_threshold
  FROM ops_policy WHERE key = 'circuit_breaker';
  
  UPDATE ops_circuit_breaker
  SET 
    failure_count = failure_count + 1,
    last_failure_at = NOW(),
    updated_at = NOW()
  WHERE service = p_service
  RETURNING state, failure_count INTO v_state, v_count;
  
  IF v_state = 'closed' AND v_count >= v_threshold THEN
    UPDATE ops_circuit_breaker
    SET state = 'open', opened_at = NOW()
    WHERE service = p_service;
    RETURN 'open';
  END IF;
  
  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION circuit_breaker_record_success(p_service TEXT)
RETURNS TEXT AS $$
DECLARE
  v_state TEXT;
  v_half_open_successes INTEGER;
  v_required INTEGER;
BEGIN
  SELECT (value->>'half_open_requests')::int INTO v_required
  FROM ops_policy WHERE key = 'circuit_breaker';
  
  UPDATE ops_circuit_breaker
  SET 
    last_success_at = NOW(),
    failure_count = CASE WHEN state = 'closed' THEN 0 ELSE failure_count END,
    half_open_successes = CASE WHEN state = 'half_open' THEN half_open_successes + 1 ELSE 0 END,
    updated_at = NOW()
  WHERE service = p_service
  RETURNING state, half_open_successes INTO v_state, v_half_open_successes;
  
  IF v_state = 'half_open' AND v_half_open_successes >= v_required THEN
    UPDATE ops_circuit_breaker
    SET state = 'closed', failure_count = 0, half_open_successes = 0
    WHERE service = p_service;
    RETURN 'closed';
  END IF;
  
  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION circuit_breaker_can_proceed(p_service TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_state TEXT;
  v_opened_at TIMESTAMPTZ;
  v_timeout INTEGER;
BEGIN
  SELECT (value->>'reset_timeout_minutes')::int INTO v_timeout
  FROM ops_policy WHERE key = 'circuit_breaker';
  
  SELECT state, opened_at INTO v_state, v_opened_at
  FROM ops_circuit_breaker WHERE service = p_service;
  
  IF v_state = 'closed' THEN
    RETURN true;
  ELSIF v_state = 'open' THEN
    IF v_opened_at + (v_timeout || ' minutes')::interval < NOW() THEN
      UPDATE ops_circuit_breaker
      SET state = 'half_open', half_open_successes = 0
      WHERE service = p_service;
      RETURN true;
    END IF;
    RETURN false;
  ELSE -- half_open
    RETURN true;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Policy update trigger
CREATE OR REPLACE FUNCTION update_policy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ops_policy_updated ON ops_policy;
CREATE TRIGGER ops_policy_updated
  BEFORE UPDATE ON ops_policy
  FOR EACH ROW
  EXECUTE FUNCTION update_policy_timestamp();

-- ============================================
-- DONE - Summary
-- ============================================
-- Tables: 20+
-- Views: 5
-- Functions: 8
-- 
-- Chapter Coverage:
-- Ch1: Foundation ✅
-- Ch2: Conversations ✅
-- Ch3: Memory ✅
-- Ch4: Affinity ✅
-- Ch5: Initiative ✅
-- Ch6: Voice Evolution ✅
-- Ch8: Circuit Breaker ✅
