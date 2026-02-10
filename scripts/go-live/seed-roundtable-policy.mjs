#!/usr/bin/env node
/**
 * Seed roundtable/conversation policies
 * Run: node scripts/go-live/seed-roundtable-policy.mjs
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

const ROUNDTABLE_POLICIES = [
  {
    key: 'roundtable_worker',
    value: { enabled: true },
    description: 'Roundtable worker enabled'
  },
  {
    key: 'roundtable_limits',
    value: { max_per_day: 5 },
    description: 'Max daily conversations (start conservative)'
  },
  {
    key: 'conversation_limits',
    value: { max_turns: 10, min_turns: 2, max_turn_length: 120 },
    description: 'Ch2 conversation limits'
  },
  {
    key: 'memory_influence',
    value: { probability: 0.3, max_memories_per_prompt: 5 },
    description: 'Ch3: 30% memory influence'
  },
  {
    key: 'affinity_drift',
    value: { max: 0.03, min: -0.03, floor: 0.1, ceiling: 0.95 },
    description: 'Ch4 relationship drift bounds'
  }
];

async function main() {
  console.log('Seeding roundtable policies...');
  
  for (const policy of ROUNDTABLE_POLICIES) {
    const result = await api('/api/ops/policy', {
      method: 'POST',
      body: JSON.stringify(policy)
    });
    console.log(`  ${policy.key}: ${result.success ? '✅' : '❌'}`);
  }
  
  console.log('Done!');
}

main().catch(console.error);
