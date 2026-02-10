#!/usr/bin/env node
/**
 * Ch8 Verification Script
 * Checks that all system components are working
 */

const API_BASE = process.env.API_BASE || 'https://ai-dashboard-phi-three.vercel.app';
const API_KEY = process.env.API_KEY || 'xiaobei-mc-2026';

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-api-key': API_KEY }
  });
  return res.json();
}

async function check(name, fn) {
  try {
    const result = await fn();
    console.log(`✅ ${name}: ${result}`);
    return true;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔍 Voxyz System Verification\n');
  console.log(`API: ${API_BASE}\n`);
  
  let passed = 0;
  let total = 0;

  // 1. Heartbeat
  total++;
  if (await check('Heartbeat API', async () => {
    const { healthy } = await api('/api/ops/heartbeat');
    return healthy ? 'healthy' : 'unhealthy';
  })) passed++;

  // 2. Policies loaded
  total++;
  if (await check('Policies', async () => {
    const { policies } = await api('/api/ops/policy');
    return `${policies?.length || 0} loaded`;
  })) passed++;

  // 3. Agents exist
  total++;
  if (await check('Agents', async () => {
    const { agents } = await api('/api/ops/agents');
    return `${agents?.length || 0} agents`;
  })) passed++;

  // 4. Relationships
  total++;
  if (await check('Relationships', async () => {
    const { relationships } = await api('/api/ops/relationships');
    return `${relationships?.length || 0} pairs`;
  })) passed++;

  // 5. Recent events
  total++;
  if (await check('Events (last 24h)', async () => {
    const { events } = await api('/api/ops/events?limit=100');
    return `${events?.length || 0} events`;
  })) passed++;

  // 6. Memories
  total++;
  if (await check('Memories', async () => {
    const { memories } = await api('/api/ops/memory?limit=100');
    return `${memories?.length || 0} memories`;
  })) passed++;

  // 7. Conversations
  total++;
  if (await check('Conversations', async () => {
    const { conversations } = await api('/api/ops/roundtable?limit=20');
    const completed = conversations?.filter(c => c.status === 'completed').length || 0;
    return `${completed} completed`;
  })) passed++;

  // 8. Circuit breaker
  total++;
  if (await check('Circuit Breaker', async () => {
    const { status } = await api('/api/ops/circuit-breaker');
    const open = Object.values(status || {}).filter(s => s.state === 'open').length;
    return open > 0 ? `${open} open` : 'all closed';
  })) passed++;

  // 9. Workers enabled
  total++;
  if (await check('Workers', async () => {
    const { policies } = await api('/api/ops/policy');
    const missionEnabled = policies?.find(p => p.key === 'mission_worker')?.value?.enabled;
    const roundtableEnabled = policies?.find(p => p.key === 'roundtable_worker')?.value?.enabled;
    return `mission=${missionEnabled}, roundtable=${roundtableEnabled}`;
  })) passed++;

  console.log(`\n📊 Result: ${passed}/${total} checks passed\n`);
  
  if (passed === total) {
    console.log('🎉 System is fully operational!\n');
  } else {
    console.log('⚠️  Some checks failed. Review above.\n');
  }
}

main().catch(console.error);
