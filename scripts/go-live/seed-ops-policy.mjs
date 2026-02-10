#!/usr/bin/env node
/**
 * Seed core OPS policies
 * Run: node scripts/go-live/seed-ops-policy.mjs
 */

const API_BASE = process.env.API_BASE || 'https://ai-dashboard-phi-three.vercel.app';
const API_KEY = process.env.API_KEY || 'xiaobei-mc-2026';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers
    }
  });
  return res.json();
}

const CORE_POLICIES = [
  {
    key: 'auto_approve',
    value: { enabled: true, allowed_step_kinds: ['crawl', 'analyze', 'research', 'write_content'] },
    description: 'Auto-approve safe step kinds'
  },
  {
    key: 'x_daily_quota',
    value: { limit: 5, used: 0, reset_hour: 0 },
    description: 'Daily tweet limit (start conservative)'
  },
  {
    key: 'content_policy',
    value: { max_drafts_per_day: 10 },
    description: 'Content creation limits'
  },
  {
    key: 'heartbeat_config',
    value: { interval_minutes: 5, max_stuck_minutes: 30 },
    description: 'Heartbeat settings'
  },
  {
    key: 'mission_worker',
    value: { enabled: true },
    description: 'Mission worker enabled'
  },
  {
    key: 'circuit_breaker',
    value: { failure_threshold: 5, reset_timeout_minutes: 15, half_open_requests: 3 },
    description: 'Circuit breaker for external services'
  }
];

async function main() {
  console.log('Seeding core policies...');
  
  for (const policy of CORE_POLICIES) {
    const result = await api('/api/ops/policy', {
      method: 'POST',
      body: JSON.stringify(policy)
    });
    console.log(`  ${policy.key}: ${result.success ? '✅' : '❌'}`);
  }
  
  console.log('Done!');
}

main().catch(console.error);
