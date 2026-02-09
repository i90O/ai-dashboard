-- Step Kind Gate Policies
-- Insert or update policies for cap gates

INSERT INTO ops_policy (key, value, description) VALUES
  ('x_autopost', '{"enabled": true}', 'Enable/disable automatic X posting'),
  ('x_daily_quota', '{"limit": 8}', 'Daily tweet posting limit'),
  ('content_policy', '{"max_drafts_per_day": 20}', 'Daily content generation limit'),
  ('deploy_policy', '{"enabled": true, "cooldown_minutes": 60}', 'Deploy policy with cooldown'),
  ('roundtable_limits', '{"max_per_day": 10}', 'Daily roundtable conversation limit')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;
