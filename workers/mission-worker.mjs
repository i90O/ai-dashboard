#!/usr/bin/env node
/**
 * Mission Worker - VPS background process
 * Polls ops_mission_steps for queued steps, claims and executes them
 * 
 * Run: node workers/mission-worker.mjs
 * Or with PM2: pm2 start workers/mission-worker.mjs --name mission-worker
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.hlumwrbidlxepmcvsswe:8jlXcAZQN0L7bkMC@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const AGENT_ID = process.env.AGENT_ID || 'xiaobei';
const WORKER_ID = process.env.WORKER_ID || `mission-worker-${process.pid}`;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000'); // 5 seconds
const MAX_STEP_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const CIRCUIT_BREAKER_THRESHOLD = 3; // failures before auto-disable

const sql = postgres(DATABASE_URL);

// Circuit breaker state
let consecutiveFailures = 0;

// Step executors - each step kind has its own handler
const stepExecutors = {
  async crawl(payload) {
    console.log(`[crawl] Crawling: ${payload.url || payload.topic}`);
    // TODO: Implement actual crawling with Firecrawl
    return { success: true, data: { crawled: true, topic: payload.topic } };
  },
  
  async analyze(payload) {
    console.log(`[analyze] Analyzing: ${payload.topic}`);
    // TODO: Call LLM for analysis
    return { success: true, data: { analysis: 'Analysis complete', topic: payload.topic } };
  },
  
  async research(payload) {
    console.log(`[research] Researching: ${payload.topic}`);
    // TODO: Implement deep research
    return { success: true, data: { research: 'Research complete' } };
  },
  
  async write_content(payload) {
    console.log(`[write_content] Writing: ${payload.topic}`);
    // TODO: Call LLM for content generation
    return { success: true, data: { content: 'Generated content', topic: payload.topic } };
  },
  
  async draft_tweet(payload) {
    console.log(`[draft_tweet] Drafting tweet: ${payload.topic}`);
    // TODO: Call LLM for tweet drafting
    return { success: true, data: { draft: 'Tweet draft here', topic: payload.topic } };
  },
  
  async post_tweet(payload) {
    console.log(`[post_tweet] Would post tweet: ${payload.content}`);
    // TODO: Integrate with Twitter API
    return { success: true, data: { posted: true, tweet_id: 'mock_id' } };
  },
  
  async diagnose(payload) {
    console.log(`[diagnose] Diagnosing: ${payload.mission_id}`);
    // TODO: Analyze failed mission
    return { success: true, data: { diagnosis: 'Root cause identified' } };
  },
  
  async review(payload) {
    console.log(`[review] Reviewing: ${payload.content_id}`);
    // TODO: Quality review
    return { success: true, data: { review: 'Quality check passed' } };
  }
};

// Check if worker is enabled
async function isWorkerEnabled() {
  const [policy] = await sql`
    SELECT value FROM ops_policy WHERE key = 'mission_worker'
  `;
  return policy?.value?.enabled !== false;
}

// Record circuit breaker failure
async function recordCircuitBreakerFailure() {
  await sql`
    SELECT circuit_breaker_record_failure('mission_worker')
  `;
  consecutiveFailures++;
  
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.error(`Circuit breaker triggered - ${consecutiveFailures} consecutive failures. Auto-disabling worker.`);
    // Insert alert event
    await sql`
      INSERT INTO ops_agent_events (agent_id, kind, title, summary, tags)
      VALUES ('system', 'worker_circuit_breaker', 'Mission worker auto-disabled',
        ${'Worker failed ' + consecutiveFailures + ' times consecutively'},
        ${{ 'worker', 'circuit_breaker', 'alert' }})
    `;
  }
}

// Record circuit breaker success
async function recordCircuitBreakerSuccess() {
  await sql`
    SELECT circuit_breaker_record_success('mission_worker')
  `;
  consecutiveFailures = 0;
}

// Claim next available step (atomic compare-and-swap per original article)
async function claimNextStep() {
  try {
    // Check circuit breaker
    const [canProceed] = await sql`
      SELECT circuit_breaker_can_proceed('mission_worker') as ok
    `;
    if (!canProceed?.ok) {
      console.log('Circuit breaker open - skipping');
      return null;
    }
    
    // 1. Fetch next queued step
    const [candidate] = await sql`
      SELECT * FROM ops_mission_steps
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `;
    
    if (!candidate) return null;
    
    // 2. Atomic claim with compare-and-swap (per original article)
    // The .eq('status', 'queued') ensures only one worker wins
    const [step] = await sql`
      UPDATE ops_mission_steps
      SET status = 'running',
          started_at = NOW(),
          executor_agent = ${AGENT_ID},
          reserved_by = ${WORKER_ID}
      WHERE id = ${candidate.id}
        AND status = 'queued'
      RETURNING *
    `;
    
    // If step is null, another worker claimed it first
    return step || null;
  } catch (e) {
    console.error('Error claiming step:', e.message);
    await recordCircuitBreakerFailure();
    return null;
  }
}

// Execute a step
async function executeStep(step) {
  const executor = stepExecutors[step.kind];
  
  if (!executor) {
    console.warn(`No executor for step kind: ${step.kind}`);
    return { success: false, error: `Unknown step kind: ${step.kind}` };
  }
  
  try {
    const result = await executor(step.payload || {});
    return result;
  } catch (e) {
    console.error(`Step ${step.id} failed:`, e.message);
    return { success: false, error: e.message };
  }
}

// Mark step as completed
async function completeStep(step, result) {
  const status = result.success ? 'succeeded' : 'failed';
  
  await sql`
    UPDATE ops_mission_steps
    SET status = ${status},
        completed_at = NOW(),
        result = ${JSON.stringify(result.data || {})},
        failure_reason = ${result.error || null}
    WHERE id = ${step.id}
  `;
  
  // Check if mission is complete
  const steps = await sql`
    SELECT status FROM ops_mission_steps WHERE mission_id = ${step.mission_id}
  `;
  
  const allDone = steps.every(s => ['succeeded', 'failed', 'skipped'].includes(s.status));
  
  if (allDone) {
    const anyFailed = steps.some(s => s.status === 'failed');
    const missionStatus = anyFailed ? 'failed' : 'succeeded';
    
    await sql`
      UPDATE ops_missions
      SET status = ${missionStatus},
          completed_at = NOW()
      WHERE id = ${step.mission_id}
    `;
    
    // Emit event
    await sql`
      INSERT INTO ops_agent_events (agent_id, kind, title, tags, metadata)
      VALUES (
        ${AGENT_ID},
        ${'mission_' + missionStatus},
        ${'Mission ' + missionStatus},
        ${['mission', missionStatus]},
        ${JSON.stringify({ mission_id: step.mission_id })}
      )
    `;
    
    console.log(`Mission ${step.mission_id} ${missionStatus}`);
  }
  
  // Emit step event
  await sql`
    INSERT INTO ops_agent_events (agent_id, kind, title, tags, metadata)
    VALUES (
      ${AGENT_ID},
      ${'step_' + status},
      ${'Step ' + status + ': ' + step.kind},
      ${['step', step.kind, status]},
      ${JSON.stringify({ step_id: step.id, mission_id: step.mission_id })}
    )
  `;
  
  console.log(`Step ${step.id} (${step.kind}) -> ${status}`);
}

// Update mission status if first step starts running
async function updateMissionIfNeeded(step) {
  await sql`
    UPDATE ops_missions
    SET status = 'running',
        started_at = NOW()
    WHERE id = ${step.mission_id}
      AND status = 'approved'
  `;
}

// Main worker loop
async function workerLoop() {
  console.log(`[${new Date().toISOString()}] Mission Worker started`);
  console.log(`  Agent: ${AGENT_ID}`);
  console.log(`  Worker ID: ${WORKER_ID}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);
  
  while (true) {
    try {
      // 1. Check if worker is enabled (via ops_policy)
      if (!await isWorkerEnabled()) {
        console.log('Worker disabled via policy - sleeping');
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS * 2));
        continue;
      }
      
      const step = await claimNextStep();
      
      if (step) {
        console.log(`Claimed step ${step.id} (${step.kind})`);
        
        // Update mission status
        await updateMissionIfNeeded(step);
        
        // Execute
        const result = await executeStep(step);
        
        // Complete
        await completeStep(step, result);
        
        // Record success for circuit breaker
        if (result.success) {
          await recordCircuitBreakerSuccess();
        } else {
          await recordCircuitBreakerFailure();
        }
      }
    } catch (e) {
      console.error('Worker loop error:', e.message);
      await recordCircuitBreakerFailure();
    }
    
    // Wait before next poll
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down worker...');
  await sql.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down worker...');
  await sql.end();
  process.exit(0);
});

// Start
workerLoop();
