#!/usr/bin/env node
/**
 * Initiative Worker - API-based version
 * Generates proposals from agents based on memories (≥5 threshold)
 */

const API_BASE = process.env.API_BASE || 'https://ai-dashboard-phi-three.vercel.app';
const API_KEY = process.env.API_KEY || 'xiaobei-mc-2026';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL_MS = 60000; // 1 minute

let Anthropic;
try {
  Anthropic = (await import('@anthropic-ai/sdk')).default;
} catch {
  console.warn('Anthropic SDK not installed - using mock responses');
}

const anthropic = ANTHROPIC_API_KEY && Anthropic ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

console.log(`[${new Date().toISOString()}] Initiative Worker started`);
console.log(`  API: ${API_BASE}`);
console.log(`  Anthropic: ${anthropic ? 'enabled' : 'mock mode'}`);

// API helper
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
  return res.json();
}

async function getAgentContext(agentId) {
  // Get memories
  const { memories } = await api(`/api/ops/memory?agent_id=${agentId}&limit=15`);
  
  // Get agent profile
  const { agent } = await api(`/api/ops/agents?id=${agentId}`);
  
  return { memories: memories || [], profile: agent };
}

async function generateProposal(agentId, context, triggerReason) {
  if (!anthropic) {
    return {
      title: `[MOCK] Initiative from ${agentId}`,
      description: 'Mock proposal',
      proposed_steps: [{ kind: 'research', payload: { topic: 'mock' } }]
    };
  }

  const memoriesText = context.memories.map(m => 
    `- [${m.type}] ${m.content} (conf: ${m.confidence})`
  ).join('\n');

  const prompt = `You are ${agentId}, an AI agent.
Background: ${context.profile?.backstory || 'A helpful AI'}

Your learnings:
${memoriesText || '(No memories)'}

Trigger: ${triggerReason}

Based on your memories, propose ONE mission.

Respond in JSON:
{
  "title": "Brief title (max 50 chars)",
  "description": "Why this matters",
  "proposed_steps": [
    { "kind": "crawl|analyze|research|write_content|draft_tweet", "payload": {...} }
  ]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    console.error('Failed to parse LLM response');
    return null;
  }
}

async function poll() {
  try {
    // Check for pending initiatives
    const { can_submit, initiatives } = await api('/api/ops/initiative?status=pending&limit=1');
    
    if (initiatives?.length) {
      const init = initiatives[0];
      console.log(`\nProcessing initiative ${init.id} for ${init.agent_id}`);
      
      // Mark as generating
      await api('/api/ops/initiative', {
        method: 'PATCH',
        body: JSON.stringify({ id: init.id, status: 'generating' })
      });
      
      // Get context
      const context = await getAgentContext(init.agent_id);
      
      // Check memory threshold (≥5)
      if (context.memories.length < 5 && !init.trigger_reason?.includes('action_item')) {
        console.log(`  Blocked: only ${context.memories.length} memories (need 5)`);
        await api('/api/ops/initiative', {
          method: 'PATCH',
          body: JSON.stringify({ id: init.id, status: 'failed', blocked_reason: 'Not enough memories' })
        });
        return;
      }
      
      // Generate proposal
      const proposal = await generateProposal(init.agent_id, context, init.trigger_reason || 'scheduled');
      
      if (!proposal) {
        await api('/api/ops/initiative', {
          method: 'PATCH',
          body: JSON.stringify({ id: init.id, status: 'failed', blocked_reason: 'Generation failed' })
        });
        return;
      }
      
      // Submit proposal
      const { proposal_id } = await api('/api/ops/proposals', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: init.agent_id,
          title: proposal.title,
          description: proposal.description,
          source: 'initiative',
          source_trace_id: init.id,
          proposed_steps: proposal.proposed_steps
        })
      });
      
      // Complete initiative
      await api('/api/ops/initiative', {
        method: 'PATCH',
        body: JSON.stringify({
          id: init.id,
          status: 'submitted',
          generated_proposal: proposal,
          proposal_id
        })
      });
      
      console.log(`  Created proposal: ${proposal.title}`);
      
      // Log event
      await api('/api/ops/events', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: init.agent_id,
          kind: 'initiative_submitted',
          title: `Initiative: ${proposal.title}`,
          tags: ['initiative', 'proposal']
        })
      });
    }
  } catch (error) {
    console.error(`Poll error: ${error.message}`);
  }
}

// Main loop
setInterval(poll, POLL_INTERVAL_MS);
poll();

console.log(`Worker running. Poll interval: ${POLL_INTERVAL_MS}ms\n`);
