-- Ch8: Atomic step claiming with FOR UPDATE SKIP LOCKED
-- Run this in Supabase SQL Editor

-- Add worker_id column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ops_mission_steps' AND column_name = 'worker_id'
  ) THEN
    ALTER TABLE ops_mission_steps ADD COLUMN worker_id TEXT;
  END IF;
END $$;

-- Create atomic claim function
CREATE OR REPLACE FUNCTION claim_next_step(
  p_worker_id TEXT,
  p_allowed_kinds TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  step_id UUID,
  mission_id UUID,
  kind TEXT,
  payload JSONB,
  mission_title TEXT,
  priority INTEGER
) AS $$
DECLARE
  v_step RECORD;
BEGIN
  -- Atomic claim: select + lock + update in one transaction
  SELECT s.id, s.mission_id, s.kind, s.payload, m.title, m.priority
  INTO v_step
  FROM ops_mission_steps s
  JOIN ops_missions m ON m.id = s.mission_id
  WHERE s.status = 'queued'
    AND (p_allowed_kinds IS NULL OR s.kind = ANY(p_allowed_kinds))
  ORDER BY m.priority DESC, s.created_at ASC
  LIMIT 1
  FOR UPDATE OF s SKIP LOCKED;
  
  IF v_step.id IS NULL THEN
    RETURN;
  END IF;
  
  -- Update status atomically
  UPDATE ops_mission_steps
  SET status = 'running',
      started_at = NOW(),
      worker_id = p_worker_id
  WHERE id = v_step.id;
  
  -- Return the claimed step
  step_id := v_step.id;
  mission_id := v_step.mission_id;
  kind := v_step.kind;
  payload := v_step.payload;
  mission_title := v_step.title;
  priority := v_step.priority;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION claim_next_step TO authenticated, anon, service_role;
