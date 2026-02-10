#!/usr/bin/env node
/**
 * Initiative Worker - API-based version
 * Generates proposals from agents based on memories (≥5 threshold)
 * Implements 30% memory influence per article spec
 */

const API_BASE = process.env.API_BASE || 'https://ai-dashboard-phi-three.vercel.app';
const API_KEY = process.env.API_KEY || 'xiaobei-mc-2026';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const POLL_INTERVAL_MS = 60000; // 1 minute

let Anthropic;
try {
  Anthropic = (await import('@anthropic-ai/sdk')).default;
} catch {
  console.warn('Anthropic SDK not installed');
}

const anthropic = ANTHROPIC_API_KEY && Anthropic ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const llmProvider = GEMINI_API_KEY ? 'gemini' : (anthropic ? 'anthropic' : 'mock');

console.log(`[${new Date().toISOString()}] Initiative Worker started`);
console.log(`  API: ${API_BASE}`);
console.log(`  LLM: ${llmProvider}`);

// ============================================================
// MEMORY CACHE - avoid repeated DB queries per article Ch3
// ============================================================
const memoryCache = new Map();
const CACHE_TTL_MS = 60000; // 1 minute cache

function getCachedMemories(agentId) {
  const cached = memoryCache.get(agentId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.memories;
  }
  return null;
}

function setCachedMemories(agentId, memories) {
  memoryCache.set(agentId, { memories, timestamp: Date.now() });
}

// ============================================================
// API HELPERS
// ============================================================
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

async function callGemini(prompt, systemPrompt, temperature = 0.7, maxTokens = 500) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    })
  });
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ============================================================
// MEMORY INFLUENCE - 30% probability per article Ch3
// ============================================================
let memoryInfluencePolicy = null;

async function getMemoryInfluencePolicy() {
  if (memoryInfluencePolicy) return memoryInfluencePolicy;
  const { policies } = await api('/api/ops/policy?key=memory_influence');
  memoryInfluencePolicy = policies?.[0]?.value || { probability: 0.30, max_memories_per_prompt: 5 };
  return memoryInfluencePolicy;
}

async function enrichTopicWithMemory(agentId, baseTopic, allTopics = []) {
  const policy = await getMemoryInfluencePolicy();
  
  // 70% use original topic - maintain baseline behavior
  if (Math.random() > policy.probability) {
    return { topic: baseTopic, memoryInfluenced: false };
  }
  
  // 30% take the memory path
  const memories = await getAgentMemories(agentId, ['strategy', 'lesson'], 0.6);
  if (!memories.length) {
    return { topic: baseTopic, memoryInfluenced: false };
  }
  
  // Find topic that matches a memory keyword
  const memoryKeywords = memories.flatMap(m => m.tags || []);
  const matched = allTopics.find(t => 
    memoryKeywords.some(kw => t.toLowerCase().includes(kw.toLowerCase()))
  );
  
  if (matched) {
    console.log(`  Memory influenced topic: ${baseTopic} → ${matched}`);
    return { topic: matched, memoryInfluenced: true, memoryId: memories[0].id };
  }
  
  return { topic: baseTopic, memoryInfluenced: false };
}

async function getAgentMemories(agentId, types = [], minConfidence = 0.5) {
  // Check cache first
  const cached = getCachedMemories(agentId);
  if (cached) {
    return cached.filter(m => 
      (!types.length || types.includes(m.type)) &&
      m.confidence >= minConfidence
    );
  }
  
  // Fetch from API
  const { memories } = await api(`/api/ops/memory?agent_id=${agentId}&limit=20`);
  setCachedMemories(agentId, memories || []);
  
  return (memories || []).filter(m => 
    (!types.length || types.includes(m.type)) &&
    m.confidence >= minConfidence
  );
}

async function getAgentContext(agentId) {
  const memories = await getAgentMemories(agentId);
  const { agent } = await api(`/api/ops/agents?id=${agentId}`);
  return { memories, profile: agent };
}

// ============================================================
// PROPOSAL GENERATION
// ============================================================
async function generateProposal(agentId, context, triggerReason) {
  const policy = await getMemoryInfluencePolicy();
  const maxMemories = policy.max_memories_per_prompt || 5;
  
  // Filter to top N memories by confidence
  const topMemories = context.memories
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxMemories);
  
  const memoriesText = topMemories.map(m => 
    `- [${m.type}] ${m.content} (conf: ${m.confidence})`
  ).join('\n');

  const prompt = `You are ${agentId}, an AI agent.
Background: ${context.profile?.backstory || 'A helpful AI'}

Your learnings:
${memoriesText || '(No memories yet)'}

Trigger: ${triggerReason}

Based on your memories and experience, propose ONE mission that would benefit the team.

Respond in JSON only:
{
  "title": "Brief title (max 50 chars)",
  "description": "Why this matters based on your learnings",
  "proposed_steps": [
    { "kind": "crawl|analyze|research|write_content|draft_tweet", "payload": {"topic": "..."} }
  ]
}`;

  let result = null;
  
  if (llmProvider === 'gemini') {
    const text = await callGemini(prompt, 'You are a strategic AI. Respond only with valid JSON.', 0.7, 500);
    if (text) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse Gemini response:', e.message);
      }
    }
  } else if (llmProvider === 'anthropic' && anthropic) {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });
    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse Anthropic response');
    }
  } else {
    // Mock mode
    result = {
      title: `[MOCK] Initiative from ${agentId}`,
      description: 'Mock proposal for testing',
      proposed_steps: [{ kind: 'research', payload: { topic: 'mock' } }]
    };
  }
  
  return result;
}

// ============================================================
// MAIN POLL LOOP
// ============================================================
async function poll() {
  try {
    // Check for pending initiatives
    const { initiatives } = await api('/api/ops/initiative?status=pending&limit=1');
    
    if (initiatives?.length) {
      const init = initiatives[0];
      console.log(`\nProcessing initiative ${init.id} for ${init.agent_id}`);
      
      // Mark as generating
      await api('/api/ops/initiative', {
        method: 'PATCH',
        body: JSON.stringify({ id: init.id, status: 'generating' })
      });
      
      // Get context (uses memory cache)
      const context = await getAgentContext(init.agent_id);
      
      // Check memory threshold (≥5) unless triggered by action_item
      const minMemories = 5;
      if (context.memories.length < minMemories && !init.trigger_reason?.includes('action_item')) {
        console.log(`  Blocked: only ${context.memories.length} memories (need ${minMemories})`);
        await api('/api/ops/initiative', {
          method: 'PATCH',
          body: JSON.stringify({ id: init.id, status: 'failed', blocked_reason: 'Not enough memories' })
        });
        return;
      }
      
      // Apply memory influence to topic selection (30% chance)
      const topicResult = await enrichTopicWithMemory(
        init.agent_id, 
        init.trigger_reason || 'scheduled',
        ['tech-trends', 'ai-news', 'crypto', 'productivity', 'automation']
      );
      console.log(`  Memory influenced: ${topicResult.memoryInfluenced}`);
      
      // Generate proposal
      const proposal = await generateProposal(init.agent_id, context, topicResult.topic);
      
      if (!proposal) {
        await api('/api/ops/initiative', {
          method: 'PATCH',
          body: JSON.stringify({ id: init.id, status: 'failed', blocked_reason: 'Generation failed' })
        });
        return;
      }
      
      // Submit proposal
      const { proposal_id, rejected, rejection_reason } = await api('/api/ops/proposals', {
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
      
      if (rejected) {
        console.log(`  Proposal rejected by gate: ${rejection_reason}`);
        await api('/api/ops/initiative', {
          method: 'PATCH',
          body: JSON.stringify({
            id: init.id,
            status: 'rejected',
            blocked_reason: rejection_reason
          })
        });
        return;
      }
      
      // Complete initiative
      await api('/api/ops/initiative', {
        method: 'PATCH',
        body: JSON.stringify({
          id: init.id,
          status: 'submitted',
          generated_proposal: proposal,
          proposal_id,
          memory_influenced: topicResult.memoryInfluenced
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
          tags: ['initiative', 'proposal'],
          metadata: { memoryInfluenced: topicResult.memoryInfluenced }
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
