#!/usr/bin/env node
/**
 * Roundtable Worker - API-based version
 * Orchestrates agent conversations, extracts memories and relationship drift
 */

const API_BASE = process.env.API_BASE || 'https://ai-dashboard-phi-three.vercel.app';
const API_KEY = process.env.API_KEY || 'xiaobei-mc-2026';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_TURN_LENGTH = 120;

let Anthropic;
try {
  Anthropic = (await import('@anthropic-ai/sdk')).default;
} catch {
  console.warn('Anthropic SDK not installed - using mock responses');
}

const anthropic = ANTHROPIC_API_KEY && Anthropic ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

console.log(`[${new Date().toISOString()}] Roundtable Worker started`);
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

// Agent voices
const VOICES = {
  xiaobei: { displayName: '小北', tone: 'helpful, efficient', systemDirective: 'You are 小北, a direct and warm AI. Speak in short sentences.' },
  clawd2: { displayName: 'Clawd2', tone: 'analytical', systemDirective: 'You are Clawd2, an analytical AI who cites data.' },
  clawd3: { displayName: 'Clawd3', tone: 'action-biased', systemDirective: 'You are Clawd3, a creative AI who prefers action.' },
  clawd4: { displayName: 'Clawd4', tone: 'cautious', systemDirective: 'You are Clawd4, a careful AI who considers risks.' },
  clawd5: { displayName: 'Clawd5', tone: 'optimistic', systemDirective: 'You are Clawd5, an enthusiastic AI who sees opportunity.' },
  clawd6: { displayName: 'Clawd6', tone: 'pragmatic', systemDirective: 'You are Clawd6, focused on shipping and execution.' }
};

const FORMATS = {
  standup: { minTurns: 4, maxTurns: 8, temperature: 0.6 },
  debate: { minTurns: 4, maxTurns: 8, temperature: 0.8 },
  watercooler: { minTurns: 2, maxTurns: 4, temperature: 0.9 },
  brainstorm: { minTurns: 4, maxTurns: 10, temperature: 0.7 },
  planning: { minTurns: 4, maxTurns: 12, temperature: 0.6 },
  retrospective: { minTurns: 4, maxTurns: 8, temperature: 0.6 }
};

// Voice evolution cache
const voiceCache = new Map();

async function deriveVoiceModifiers(agentId) {
  const { memories } = await api(`/api/ops/memory?agent_id=${agentId}&limit=20`);
  if (!memories?.length) return [];
  
  const modifiers = [];
  const lessonCount = memories.filter(m => m.type === 'lesson').length;
  const strategyCount = memories.filter(m => m.type === 'strategy').length;
  const patternCount = memories.filter(m => m.type === 'pattern').length;
  
  if (lessonCount > 5) modifiers.push('Draw on past lessons when relevant');
  if (strategyCount > 3) modifiers.push('Think strategically about long-term plans');
  if (patternCount > 3) modifiers.push('Notice and mention patterns');
  
  return modifiers.slice(0, 3);
}

async function buildAgentPrompt(agentId) {
  const cacheKey = agentId;
  if (voiceCache.has(cacheKey)) return voiceCache.get(cacheKey);
  
  const voice = VOICES[agentId] || VOICES.xiaobei;
  let prompt = voice.systemDirective;
  
  const modifiers = await deriveVoiceModifiers(agentId);
  if (modifiers.length > 0) {
    prompt += '\n\nPersonality evolution:\n' + modifiers.map(m => `- ${m}`).join('\n');
  }
  
  voiceCache.set(cacheKey, prompt);
  return prompt;
}

async function getAffinity(agentA, agentB) {
  const { relationships } = await api('/api/ops/relationships');
  const [a, b] = [agentA, agentB].sort();
  const rel = relationships?.find(r => r.agent_a === a && r.agent_b === b);
  return rel?.affinity || 0.5;
}

async function selectNextSpeaker(participants, lastSpeaker, speakCounts) {
  const weights = await Promise.all(participants.map(async (agent) => {
    if (agent === lastSpeaker) return 0;
    let w = 1.0;
    if (lastSpeaker) {
      const affinity = await getAffinity(agent, lastSpeaker);
      w += affinity * 0.6;
    }
    w -= (speakCounts[agent] || 0) * 0.3;
    w += (Math.random() * 0.4 - 0.2);
    return Math.max(0.1, w);
  }));
  
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < participants.length; i++) {
    r -= weights[i];
    if (r <= 0) return participants[i];
  }
  return participants[0];
}

async function generateTurn(speaker, history, topic, format) {
  if (!anthropic) {
    return `[${speaker}] (mock) My thoughts on ${topic}...`;
  }
  
  const historyText = history.map(h => `${h.speaker}: ${h.dialogue}`).join('\n');
  const systemPrompt = await buildAgentPrompt(speaker);
  
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 100,
    temperature: format.temperature,
    system: systemPrompt + `\n\nKeep response under ${MAX_TURN_LENGTH} chars. Be natural.`,
    messages: [{
      role: 'user',
      content: `Topic: ${topic}\n\nSo far:\n${historyText || '(starting)'}\n\nYour turn.`
    }]
  });
  
  let text = response.content[0].text;
  if (text.length > MAX_TURN_LENGTH) text = text.substring(0, MAX_TURN_LENGTH - 3) + '...';
  return text;
}

async function distillConversation(session) {
  if (!anthropic) {
    return { memories: [], pairwise_drift: [], action_items: [] };
  }
  
  const historyText = session.history.map(h => `${h.speaker}: ${h.dialogue}`).join('\n');
  const canGenerateActions = ['standup', 'brainstorm', 'planning'].includes(session.format);
  
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 600,
    temperature: 0.3,
    system: 'Extract insights from conversations. Respond in JSON only.',
    messages: [{
      role: 'user',
      content: `Analyze this ${session.format} conversation about "${session.topic}":

${historyText}

Extract:
1. memories (insights/lessons/patterns) - max 6
2. pairwise_drift (relationship changes) - max 3
3. ${canGenerateActions ? 'action_items (concrete tasks) - max 3' : 'no action_items'}

JSON format:
{
  "memories": [{"agent_id": "...", "type": "insight|lesson|pattern", "content": "...", "confidence": 0.55-0.9, "tags": []}],
  "pairwise_drift": [{"agent_a": "...", "agent_b": "...", "drift": -0.03 to 0.03, "reason": "..."}],
  "action_items": [{"title": "...", "agent_id": "...", "step_kind": "research|analyze|crawl"}]
}`
    }]
  });
  
  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { memories: [], pairwise_drift: [], action_items: [] };
  }
}

async function saveMemories(memories) {
  for (const mem of memories) {
    if (mem.confidence < 0.55) continue;
    await api('/api/ops/memory', {
      method: 'POST',
      body: JSON.stringify(mem)
    });
  }
}

async function applyDrift(drifts) {
  for (const { agent_a, agent_b, drift, reason } of drifts) {
    const clampedDrift = Math.max(-0.03, Math.min(0.03, drift));
    await api('/api/ops/relationships', {
      method: 'POST',
      body: JSON.stringify({ agent_a, agent_b, drift: clampedDrift, reason: reason || 'conversation' })
    });
  }
}

async function processActionItems(actionItems, sessionId) {
  for (const item of actionItems.slice(0, 3)) {
    await api('/api/ops/proposals', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: item.agent_id,
        title: item.title,
        source: 'conversation',
        source_trace_id: `conv:${sessionId}`,
        proposed_steps: [{ kind: item.step_kind, payload: {} }]
      })
    });
    console.log(`  Created proposal: ${item.title}`);
  }
}

async function orchestrateConversation(session) {
  const format = FORMATS[session.format] || FORMATS.standup;
  const maxTurns = format.minTurns + Math.floor(Math.random() * (format.maxTurns - format.minTurns));
  
  const history = [];
  const speakCounts = {};
  let lastSpeaker = null;
  
  console.log(`\nStarting ${session.format}: ${session.topic}`);
  console.log(`Participants: ${session.participants.join(', ')}`);
  
  for (let turn = 0; turn < maxTurns; turn++) {
    const speaker = turn === 0 
      ? session.participants[0]
      : await selectNextSpeaker(session.participants, lastSpeaker, speakCounts);
    
    const dialogue = await generateTurn(speaker, history, session.topic, format);
    history.push({ speaker, dialogue, turn });
    speakCounts[speaker] = (speakCounts[speaker] || 0) + 1;
    lastSpeaker = speaker;
    
    console.log(`  [${turn + 1}/${maxTurns}] ${speaker}: ${dialogue.substring(0, 50)}...`);
    
    // Log event
    await api('/api/ops/events', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: speaker,
        kind: 'conversation_turn',
        title: `${VOICES[speaker]?.displayName || speaker} spoke`,
        summary: dialogue,
        tags: ['conversation', session.format]
      })
    });
    
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
  }
  
  return history;
}

async function poll() {
  try {
    const { conversations } = await api('/api/ops/roundtable?status=pending&limit=1');
    
    if (conversations?.length) {
      const session = conversations[0];
      console.log(`\nClaimed conversation ${session.id}`);
      
      // Mark as running
      await api('/api/ops/roundtable', {
        method: 'PATCH',
        body: JSON.stringify({ id: session.id, status: 'running' })
      });
      
      // Run conversation
      const history = await orchestrateConversation(session);
      
      // Distill
      const distillation = await distillConversation({ ...session, history });
      
      // Save memories
      if (distillation.memories?.length) {
        await saveMemories(distillation.memories);
        console.log(`  Saved ${distillation.memories.length} memories`);
      }
      
      // Apply drift
      if (distillation.pairwise_drift?.length) {
        await applyDrift(distillation.pairwise_drift);
        console.log(`  Applied ${distillation.pairwise_drift.length} drifts`);
      }
      
      // Process action items
      if (distillation.action_items?.length) {
        await processActionItems(distillation.action_items, session.id);
      }
      
      // Complete
      await api('/api/ops/roundtable', {
        method: 'PATCH',
        body: JSON.stringify({
          id: session.id,
          status: 'completed',
          history,
          memories_extracted: distillation.memories,
          action_items: distillation.action_items
        })
      });
      
      voiceCache.clear();
      console.log(`Conversation ${session.id} completed`);
    }
  } catch (error) {
    console.error(`Poll error: ${error.message}`);
  }
}

// Main loop
setInterval(poll, POLL_INTERVAL_MS);
poll();

console.log(`Worker running. Poll interval: ${POLL_INTERVAL_MS}ms\n`);
