#!/usr/bin/env node
/**
 * Seed initiative system policies (Ch5)
 * Run: node scripts/go-live/seed-initiative-policy.mjs
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

const INITIATIVE_POLICIES = [
  {
    key: 'initiative_worker',
    value: { enabled: false },  // Keep off until stable!
    description: 'Initiative worker - enable after system is stable'
  },
  {
    key: 'initiative_limits',
    value: { max_per_agent_per_day: 3, min_memories_required: 5 },
    description: 'Ch5: Max 3 initiatives/agent/day, need 5+ memories'
  }
];

async function main() {
  console.log('Seeding initiative policies...');
  console.log('⚠️  initiative_worker is OFF by default - enable when ready');
  
  for (const policy of INITIATIVE_POLICIES) {
    const result = await api('/api/ops/policy', {
      method: 'POST',
      body: JSON.stringify(policy)
    });
    console.log(`  ${policy.key}: ${result.success ? '✅' : '❌'}`);
  }
  
  console.log('Done!');
}

main().catch(console.error);
