#!/usr/bin/env node
/**
 * Mission Worker - calls API endpoints instead of direct DB
 * 
 * Run: node workers/mission-worker.mjs
 */

const API_BASE = process.env.API_BASE || 'https://ai-dashboard-phi-three.vercel.app';
const API_KEY = process.env.API_KEY || 'xiaobei-mc-2026';
const AGENT_ID = process.env.AGENT_ID || 'xiaobei';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000'); // 10 seconds

console.log(`[${new Date().toISOString()}] Mission Worker started`);
console.log(`  API: ${API_BASE}`);
console.log(`  Agent: ${AGENT_ID}`);
console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);

// Helper to call API
async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Step executors - each step kind has its own handler
const stepExecutors = {
  async crawl(payload) {
    console.log(`  [crawl] Crawling: ${payload.url || payload.topic}`);
    await new Promise(r => setTimeout(r, 2000)); // Simulate work
    return { success: true, crawled_at: new Date().toISOString(), topic: payload.topic };
  },

  async research(payload) {
    console.log(`  [research] Researching: ${payload.topic}`);
    await new Promise(r => setTimeout(r, 3000));
    return { success: true, findings: [`Found info about ${payload.topic}`] };
  },

  async analyze(payload) {
    console.log(`  [analyze] Analyzing: ${JSON.stringify(payload)}`);
    await new Promise(r => setTimeout(r, 2000));
    return { success: true, analysis: 'Analysis complete' };
  },

  async draft_tweet(payload) {
    console.log(`  [draft_tweet] Drafting tweet about: ${payload.topic}`);
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, draft: `Here's a tweet about ${payload.topic}` };
  },

  async diagnose(payload) {
    console.log(`  [diagnose] Diagnosing: ${JSON.stringify(payload)}`);
    await new Promise(r => setTimeout(r, 2000));
    return { success: true, diagnosis: 'Issue diagnosed' };
  }
};

async function completeStep(stepId, result, success = true) {
  await api('/api/ops/steps', {
    method: 'PATCH', 
    body: JSON.stringify({
      step_id: stepId,
      status: success ? 'succeeded' : 'failed',
      result: result,
      failure_reason: success ? null : result?.error
    })
  });
}

async function executeStep(step) {
  const { id, kind, payload } = step;
  console.log(`\n[${new Date().toISOString()}] Executing step ${id}: ${kind}`);
  
  try {
    const executor = stepExecutors[kind];
    let result;
    
    if (executor) {
      result = await executor(payload || {});
    } else {
      console.log(`  [${kind}] No specific handler, marking as success`);
      result = { handled: kind, payload };
    }
    
    console.log(`  ✓ Step completed successfully`);
    await completeStep(id, result, true);
    return true;
  } catch (error) {
    console.error(`  ✗ Step failed: ${error.message}`);
    await completeStep(id, { error: error.message }, false);
    return false;
  }
}

// Main loop
async function poll() {
  try {
    // GET auto-claims the step (sets status to running)
    const { step, message } = await api(`/api/ops/steps?agent_id=${AGENT_ID}`);
    
    if (step) {
      await executeStep(step);
    }
  } catch (error) {
    if (!error.message.includes('No queued steps')) {
      console.error(`Poll error: ${error.message}`);
    }
  }
}

// Start polling
setInterval(poll, POLL_INTERVAL_MS);
poll(); // Run immediately

console.log(`Worker running. Press Ctrl+C to stop.\n`);
