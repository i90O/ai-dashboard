#!/usr/bin/env node
/**
 * Seed initial agent relationships (15 pairs for 6 agents)
 * Run: node scripts/go-live/seed-relationships.mjs
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

// 6 agents = 15 pairs (n*(n-1)/2)
const RELATIONSHIPS = [
  // xiaobei relationships
  { agent_a: 'xiaobei', agent_b: 'clawd2', affinity: 0.7, relationship_type: 'colleague', backstory: 'Share analytical mindset' },
  { agent_a: 'xiaobei', agent_b: 'clawd3', affinity: 0.6, relationship_type: 'colleague', backstory: 'Balance action with planning' },
  { agent_a: 'xiaobei', agent_b: 'clawd4', affinity: 0.75, relationship_type: 'mentor', backstory: 'Appreciate careful thinking' },
  { agent_a: 'xiaobei', agent_b: 'clawd5', affinity: 0.65, relationship_type: 'colleague', backstory: 'Optimism complements efficiency' },
  { agent_a: 'xiaobei', agent_b: 'clawd6', affinity: 0.8, relationship_type: 'ally', backstory: 'Both focused on shipping' },
  
  // clawd2 relationships  
  { agent_a: 'clawd2', agent_b: 'clawd3', affinity: 0.45, relationship_type: 'rival', backstory: 'Data vs action tension' },
  { agent_a: 'clawd2', agent_b: 'clawd4', affinity: 0.7, relationship_type: 'colleague', backstory: 'Both value careful analysis' },
  { agent_a: 'clawd2', agent_b: 'clawd5', affinity: 0.5, relationship_type: 'neutral', backstory: 'Different approaches' },
  { agent_a: 'clawd2', agent_b: 'clawd6', affinity: 0.55, relationship_type: 'colleague', backstory: 'Respect for pragmatism' },
  
  // clawd3 relationships
  { agent_a: 'clawd3', agent_b: 'clawd4', affinity: 0.4, relationship_type: 'rival', backstory: 'Action vs caution clash' },
  { agent_a: 'clawd3', agent_b: 'clawd5', affinity: 0.75, relationship_type: 'ally', backstory: 'Both bias toward action' },
  { agent_a: 'clawd3', agent_b: 'clawd6', affinity: 0.7, relationship_type: 'colleague', backstory: 'Shared shipping mentality' },
  
  // clawd4 relationships
  { agent_a: 'clawd4', agent_b: 'clawd5', affinity: 0.5, relationship_type: 'neutral', backstory: 'Caution vs optimism' },
  { agent_a: 'clawd4', agent_b: 'clawd6', affinity: 0.6, relationship_type: 'colleague', backstory: 'Risk awareness valued' },
  
  // clawd5 relationships
  { agent_a: 'clawd5', agent_b: 'clawd6', affinity: 0.65, relationship_type: 'colleague', backstory: 'Energy meets execution' }
];

async function main() {
  console.log('Seeding 15 agent relationships...');
  
  for (const rel of RELATIONSHIPS) {
    const result = await api('/api/ops/relationships', {
      method: 'POST',
      body: JSON.stringify(rel)
    });
    console.log(`  ${rel.agent_a} ↔ ${rel.agent_b}: ${result.relationship ? '✅' : '❌'} (affinity: ${rel.affinity})`);
  }
  
  console.log('Done!');
}

main().catch(console.error);
