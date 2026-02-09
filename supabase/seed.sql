-- Seed data for AI Dashboard Ops System
-- Run AFTER voxyz-upgrade.sql

-- ============================================
-- CORE POLICIES
-- ============================================

-- Auto-approve policy
INSERT INTO ops_policy (key, value, description) VALUES
  ('auto_approve', '{
    "enabled": true,
    "allowed_step_kinds": ["crawl", "analyze", "research", "write_content", "draft_tweet", "review"]
  }', 'Which step kinds can be auto-approved')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Tweet quota
INSERT INTO ops_policy (key, value, description) VALUES
  ('x_daily_quota', '{"limit": 5}', 'Daily tweet limit - start conservative')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Content policy
INSERT INTO ops_policy (key, value, description) VALUES
  ('content_policy', '{
    "enabled": true,
    "max_drafts_per_day": 8
  }', 'Content generation limits')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Roundtable policy
INSERT INTO ops_policy (key, value, description) VALUES
  ('roundtable_policy', '{
    "enabled": true,
    "max_conversations_per_day": 5,
    "min_interval_minutes": 60
  }', 'Conversation scheduling limits')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Initiative policy (disabled initially)
INSERT INTO ops_policy (key, value, description) VALUES
  ('initiative_policy', '{
    "enabled": false,
    "min_memories_required": 5,
    "cooldown_hours": 4
  }', 'Agent self-proposal settings - enable when stable')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Reaction matrix
INSERT INTO ops_policy (key, value, description) VALUES
  ('reaction_matrix', '{
    "patterns": [
      {
        "source": "*",
        "tags": ["mission_failed"],
        "target": "xiaobei",
        "type": "diagnose",
        "probability": 1.0,
        "cooldown": 60
      },
      {
        "source": "*",
        "tags": ["tweet_posted"],
        "target": "xiaobei",
        "type": "analyze",
        "probability": 0.3,
        "cooldown": 120
      },
      {
        "source": "*",
        "tags": ["content_published"],
        "target": "xiaobei",
        "type": "review",
        "probability": 0.5,
        "cooldown": 60
      },
      {
        "source": "*",
        "tags": ["insight"],
        "target": "xiaobei",
        "type": "analyze",
        "probability": 0.3,
        "cooldown": 180
      }
    ]
  }', 'Agent-to-agent reaction rules')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Heartbeat config
INSERT INTO ops_policy (key, value, description) VALUES
  ('heartbeat_config', '{
    "interval_minutes": 5,
    "max_stuck_minutes": 30,
    "max_roundtable_stuck_minutes": 60
  }', 'Heartbeat settings')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================
-- TRIGGER RULES
-- ============================================

-- Proactive news scan
INSERT INTO ops_trigger_rules (name, trigger_event, conditions, action_config, cooldown_minutes, enabled)
VALUES (
  'Proactive News Scan',
  'proactive_scan_signals',
  '{"topics": ["tech", "AI", "crypto"]}',
  '{"target_agent": "xiaobei", "step_kind": "crawl"}',
  180,
  true
) ON CONFLICT DO NOTHING;

-- Mission failed diagnosis
INSERT INTO ops_trigger_rules (name, trigger_event, conditions, action_config, cooldown_minutes, enabled)
VALUES (
  'Mission Failed Diagnosis',
  'mission_failed',
  '{}',
  '{"target_agent": "xiaobei", "step_kind": "diagnose"}',
  60,
  true
) ON CONFLICT DO NOTHING;

-- High engagement analysis
INSERT INTO ops_trigger_rules (name, trigger_event, conditions, action_config, cooldown_minutes, enabled)
VALUES (
  'High Engagement Analysis',
  'tweet_high_engagement',
  '{"engagement_rate_min": 0.05}',
  '{"target_agent": "xiaobei", "step_kind": "analyze"}',
  120,
  true
) ON CONFLICT DO NOTHING;

-- Content published review
INSERT INTO ops_trigger_rules (name, trigger_event, conditions, action_config, cooldown_minutes, enabled)
VALUES (
  'Content Published Review',
  'content_published',
  '{}',
  '{"target_agent": "xiaobei", "step_kind": "review"}',
  60,
  true
) ON CONFLICT DO NOTHING;

-- ============================================
-- AGENT RELATIONSHIPS
-- ============================================

-- Initial relationships between bots
INSERT INTO ops_agent_relationships (agent_a, agent_b, affinity) VALUES
  ('clawd2', 'xiaobei', 0.70),
  ('clawd3', 'xiaobei', 0.70),
  ('clawd2', 'clawd3', 0.60)
ON CONFLICT (agent_a, agent_b) DO NOTHING;

-- ============================================
-- INITIAL MEMORIES (Optional - gives agents starting knowledge)
-- ============================================

-- Xiaobei's initial lessons
INSERT INTO ops_agent_memory (agent_id, type, content, confidence, tags)
VALUES 
  ('xiaobei', 'lesson', 'Concise messages get better engagement than long ones', 0.75, '{"communication", "engagement"}'),
  ('xiaobei', 'strategy', 'Always verify data before reporting to avoid errors', 0.80, '{"reliability", "accuracy"}'),
  ('xiaobei', 'insight', 'Users prefer actionable information over raw data', 0.70, '{"user-experience", "content"}')
ON CONFLICT DO NOTHING;

-- ============================================
-- DONE!
-- ============================================
-- Seed data initialized. System ready for launch.
