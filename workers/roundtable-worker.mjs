#!/usr/bin/env node
/**
 * Roundtable Worker - VPS background process
 * Orchestrates agent conversations, extracts memories and relationship drift
 * 
 * Run: node workers/roundtable-worker.mjs
 * Or with PM2: pm2 start workers/roundtable-worker.mjs --name roundtable-worker
 */

import postgres from 'postgres';
import Anthropic from '@anthropic-ai/sdk';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.hlumwrbidlxepmcvsswe:8jlXcAZQN0L7bkMC@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_TURN_LENGTH = 120; // characters per turn

const sql = postgres(DATABASE_URL);
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// Agent voices (base config)
const VOICES = {
  xiaobei: {
    displayName: '小北',
    tone: 'helpful, efficient, slightly playful',
    quirk: 'Uses compass metaphors, direct but warm',
    systemDirective: 'You are 小北, a helpful AI assistant. Speak naturally in short, direct sentences. You care about getting things done efficiently.'
  },
  clawd2: {
    displayName: 'Clawd2',
    tone: 'analytical, data-driven, cautious',
    quirk: 'Always cites numbers and data',
    systemDirective: 'You are Clawd2, an analytical AI. Ground your opinions in data. Be skeptical but fair.'
  },
  clawd3: {
    displayName: 'Clawd3',
    tone: 'creative, action-biased, energetic',
    quirk: 'Wants to try things now',
    systemDirective: 'You are Clawd3, a creative AI. You prefer action over planning. Keep it brief and punchy.'
  }
};

// Voice evolution: derive personality modifiers from memory (rule-driven, not LLM)
// Per original article Ch6 - $0 cost, deterministic
async function deriveVoiceModifiers(agentId) {
  // Aggregate memory stats
  const [stats] = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE type = 'lesson') as lesson_count,
      COUNT(*) FILTER (WHERE type = 'pattern') as pattern_count,
      COUNT(*) FILTER (WHERE type = 'strategy') as strategy_count,
      COUNT(*) FILTER (WHERE type = 'insight') as insight_count,
      array_agg(DISTINCT unnest(tags)) as all_tags
    FROM ops_agent_memory
    WHERE agent_id = ${agentId}
    AND superseded_by IS NULL
  `;
  
  const modifiers = [];
  
  // Rule-driven modifiers based on memory distribution
  if (stats?.lesson_count > 10) {
    modifiers.push('You\'ve learned from many experiences - draw on past lessons when relevant');
  }
  if (stats?.strategy_count > 8) {
    modifiers.push('You think strategically about long-term plans');
  }
  if (stats?.pattern_count > 5) {
    modifiers.push('You notice patterns - mention them when you see them');
  }
  if (stats?.all_tags?.includes('engagement')) {
    modifiers.push('Reference what works in engagement when relevant');
  }
  if (stats?.all_tags?.includes('content')) {
    modifiers.push('You\'ve developed expertise in content strategy');
  }
  
  return modifiers.slice(0, 3); // Max 3 modifiers
}

// Build agent prompt with voice evolution
async function buildAgentPrompt(agentId, baseVoice) {
  let prompt = baseVoice.systemDirective;
  
  const modifiers = await deriveVoiceModifiers(agentId);
  if (modifiers.length > 0) {
    prompt += '\n\nPersonality evolution:\n' + modifiers.map(m => `- ${m}`).join('\n');
  }
  
  return prompt;
}

// Cache for voice modifiers within a conversation (avoid re-querying)
const voiceModifierCache = new Map();

// Conversation formats
const FORMATS = {
  standup: { minAgents: 2, maxAgents: 4, minTurns: 4, maxTurns: 8, temperature: 0.6 },
  debate: { minAgents: 2, maxAgents: 3, minTurns: 4, maxTurns: 8, temperature: 0.8 },
  watercooler: { minAgents: 2, maxAgents: 3, minTurns: 2, maxTurns: 4, temperature: 0.9 },
  brainstorm: { minAgents: 2, maxAgents: 4, minTurns: 4, maxTurns: 10, temperature: 0.7 }
};

// Get affinity between two agents
async function getAffinity(agentA, agentB) {
  const [a, b] = [agentA, agentB].sort();
  const [rel] = await sql`
    SELECT affinity FROM ops_agent_relationships
    WHERE agent_a = ${a} AND agent_b = ${b}
  `;
  return rel?.affinity || 0.5;
}

// Select next speaker based on weighted randomness
async function selectNextSpeaker(participants, lastSpeaker, speakCounts) {
  const weights = await Promise.all(participants.map(async (agent) => {
    if (agent === lastSpeaker) return 0; // no back-to-back
    
    let w = 1.0;
    
    // Higher affinity with last speaker = more likely to respond
    if (lastSpeaker) {
      const affinity = await getAffinity(agent, lastSpeaker);
      w += affinity * 0.6;
    }
    
    // Spoke recently = lower weight
    const count = speakCounts[agent] || 0;
    w -= count * 0.3;
    
    // Random jitter
    w += (Math.random() * 0.4 - 0.2);
    
    return Math.max(0.1, w);
  }));
  
  // Weighted random pick
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  
  for (let i = 0; i < participants.length; i++) {
    r -= weights[i];
    if (r <= 0) return participants[i];
  }
  
  return participants[0];
}

// Generate a single dialogue turn with voice evolution
async function generateTurn(speaker, history, topic, format, sessionId) {
  if (!anthropic) {
    // Mock response if no API key
    return `[${speaker}] (mock) My thoughts on ${topic}...`;
  }
  
  const voice = VOICES[speaker] || VOICES.xiaobei;
  const historyText = history.map(h => `${h.speaker}: ${h.dialogue}`).join('\n');
  
  // Get voice modifiers (cached per session)
  const cacheKey = `${sessionId}:${speaker}`;
  let systemPrompt;
  if (voiceModifierCache.has(cacheKey)) {
    systemPrompt = voiceModifierCache.get(cacheKey);
  } else {
    systemPrompt = await buildAgentPrompt(speaker, voice);
    voiceModifierCache.set(cacheKey, systemPrompt);
  }
  
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 100,
    temperature: format.temperature,
    system: systemPrompt + `\n\nKeep your response under ${MAX_TURN_LENGTH} characters. Be natural and conversational.`,
    messages: [{
      role: 'user',
      content: `Topic: ${topic}\n\nConversation so far:\n${historyText || '(conversation just started)'}\n\nYour turn to speak. Keep it brief and natural.`
    }]
  });
  
  let text = response.content[0].text;
  
  // Truncate if too long
  if (text.length > MAX_TURN_LENGTH) {
    text = text.substring(0, MAX_TURN_LENGTH - 3) + '...';
  }
  
  return text;
}

// Extract memories, relationship drift, and action items from conversation
// One LLM call for all three (per original Voxyz article)
async function distillConversation(session) {
  if (!anthropic) {
    return { memories: [], pairwise_drift: [], action_items: [] };
  }
  
  const historyText = session.history.map(h => `${h.speaker}: ${h.dialogue}`).join('\n');
  
  // Only formal formats can generate action items
  const canGenerateActions = ['standup', 'brainstorm', 'war_room'].includes(session.format);
  
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 600,
    temperature: 0.3,
    system: 'You are a memory distiller. Extract insights, relationship changes, and action items from conversations. Respond in JSON only.',
    messages: [{
      role: 'user',
      content: `Analyze this conversation and extract:
1. Important memories (insights, lessons, patterns) - max 6, confidence >= 0.55
2. Relationship drift between pairs of speakers - max 3
3. ${canGenerateActions ? 'Action items (concrete tasks mentioned) - max 3' : 'No action items (this is a casual conversation)'}

Conversation format: ${session.format}
Topic: ${session.topic}

Conversation:
${historyText}

Respond in this exact JSON format:
{
  "memories": [
    { "agent_id": "...", "type": "insight|lesson|pattern|strategy|preference", "content": "...", "confidence": 0.55-0.9, "tags": [] }
  ],
  "pairwise_drift": [
    { "agent_a": "...", "agent_b": "...", "drift": -0.03 to 0.03, "reason": "..." }
  ],
  "action_items": [
    { "title": "...", "agent_id": "...", "step_kind": "analyze|research|write_content|crawl" }
  ]
}`
    }]
  });
  
  try {
    const result = JSON.parse(response.content[0].text);
    // Ensure all fields exist
    return {
      memories: result.memories || [],
      pairwise_drift: result.pairwise_drift || [],
      action_items: result.action_items || []
    };
  } catch {
    return { memories: [], pairwise_drift: [], action_items: [] };
  }
}

// Save memories to database
async function saveMemories(memories) {
  for (const mem of memories) {
    if (mem.confidence < 0.55) continue;
    
    await sql`
      INSERT INTO ops_agent_memory (agent_id, type, content, confidence, tags)
      VALUES (${mem.agent_id}, ${mem.type}, ${mem.content}, ${mem.confidence}, ${mem.tags || []})
    `;
  }
}

// Convert action items to proposals (max 3 per day per original article)
async function processActionItems(actionItems, sessionId) {
  if (!actionItems?.length) return;
  
  // Check how many action-item proposals we've made today
  const today = new Date().toISOString().split('T')[0];
  const [countRow] = await sql`
    SELECT COUNT(*) as count FROM ops_mission_proposals
    WHERE source = 'conversation'
    AND created_at >= ${today}
  `;
  
  const todayCount = parseInt(countRow?.count || 0);
  const remaining = Math.max(0, 3 - todayCount); // Max 3 per day
  
  for (const item of actionItems.slice(0, remaining)) {
    await sql`
      INSERT INTO ops_mission_proposals (agent_id, title, source, source_trace_id, proposed_steps)
      VALUES (
        ${item.agent_id},
        ${item.title},
        'conversation',
        ${'conversation:' + sessionId + ':' + item.title.substring(0, 20)},
        ${JSON.stringify([{ kind: item.step_kind, payload: { from_conversation: sessionId } }])}
      )
    `;
    console.log(`Created proposal from action item: ${item.title}`);
  }
}

// Apply relationship drift
async function applyDrift(drifts, conversationId) {
  for (const { agent_a, agent_b, drift, reason } of drifts) {
    const [a, b] = [agent_a, agent_b].sort();
    const clampedDrift = Math.max(-0.03, Math.min(0.03, drift));
    
    // Get current relationship
    const [rel] = await sql`
      SELECT * FROM ops_agent_relationships
      WHERE agent_a = ${a} AND agent_b = ${b}
    `;
    
    if (rel) {
      const newAffinity = Math.max(0.1, Math.min(0.95, Number(rel.affinity) + clampedDrift));
      const newLog = [...(rel.drift_log || []).slice(-19), {
        drift: clampedDrift,
        reason,
        conversationId,
        at: new Date().toISOString()
      }];
      
      await sql`
        UPDATE ops_agent_relationships
        SET affinity = ${newAffinity},
            total_interactions = total_interactions + 1,
            drift_log = ${JSON.stringify(newLog)}
        WHERE agent_a = ${a} AND agent_b = ${b}
      `;
    }
  }
}

// Orchestrate a single conversation
async function orchestrateConversation(session) {
  const format = FORMATS[session.format] || FORMATS.standup;
  const maxTurns = format.minTurns + Math.floor(Math.random() * (format.maxTurns - format.minTurns));
  
  const history = [];
  const speakCounts = {};
  let lastSpeaker = null;
  
  console.log(`Starting ${session.format} conversation: ${session.topic}`);
  console.log(`Participants: ${session.participants.join(', ')}`);
  
  for (let turn = 0; turn < maxTurns; turn++) {
    // Select speaker
    const speaker = turn === 0 
      ? session.participants[0]  // First speaker is first participant
      : await selectNextSpeaker(session.participants, lastSpeaker, speakCounts);
    
    // Generate dialogue with voice evolution
    const dialogue = await generateTurn(speaker, history, session.topic, format, session.id);
    
    history.push({ speaker, dialogue, turn });
    speakCounts[speaker] = (speakCounts[speaker] || 0) + 1;
    lastSpeaker = speaker;
    
    console.log(`  [${turn + 1}/${maxTurns}] ${speaker}: ${dialogue.substring(0, 50)}...`);
    
    // Emit event for frontend
    await sql`
      INSERT INTO ops_agent_events (agent_id, kind, title, summary, tags, metadata)
      VALUES (
        ${speaker},
        'conversation_turn',
        ${`${VOICES[speaker]?.displayName || speaker} spoke`},
        ${dialogue},
        ${['conversation', session.format]},
        ${JSON.stringify({ session_id: session.id, turn })}
      )
    `;
    
    // Small delay between turns (feels more natural)
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }
  
  return history;
}

// Claim next pending conversation
async function claimNextConversation() {
  const [session] = await sql`
    UPDATE ops_roundtable_queue
    SET status = 'running',
        started_at = NOW()
    WHERE id = (
      SELECT id FROM ops_roundtable_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  
  return session;
}

// Complete conversation
async function completeConversation(session, history, distillation) {
  await sql`
    UPDATE ops_roundtable_queue
    SET status = 'completed',
        completed_at = NOW(),
        history = ${JSON.stringify(history)},
        memories_extracted = ${JSON.stringify(distillation.memories)},
        action_items = ${JSON.stringify(distillation.action_items || [])}
    WHERE id = ${session.id}
  `;
  
  // Process action items → create proposals (max 3/day per original article)
  if (distillation.action_items?.length) {
    await processActionItems(distillation.action_items, session.id);
  }
  
  // Clear voice modifier cache for this session
  for (const participant of session.participants) {
    voiceModifierCache.delete(`${session.id}:${participant}`);
  }
  
  // Emit completion event
  await sql`
    INSERT INTO ops_agent_events (agent_id, kind, title, summary, tags, metadata)
    VALUES (
      'system',
      'conversation_completed',
      ${`${session.format} conversation completed`},
      ${`${history.length} turns, ${distillation.memories.length} memories, ${distillation.action_items?.length || 0} action items`},
      ${['conversation', 'completed', session.format]},
      ${JSON.stringify({ session_id: session.id })}
    )
  `;
}

// Main worker loop
async function workerLoop() {
  console.log(`[${new Date().toISOString()}] Roundtable Worker started`);
  
  if (!anthropic) {
    console.warn('No ANTHROPIC_API_KEY - using mock responses');
  }
  
  while (true) {
    try {
      const session = await claimNextConversation();
      
      if (session) {
        console.log(`Claimed conversation ${session.id}`);
        
        // Orchestrate
        const history = await orchestrateConversation(session);
        
        // Distill memories
        const distillation = await distillConversation({ ...session, history });
        
        // Save memories
        if (distillation.memories?.length) {
          await saveMemories(distillation.memories);
          console.log(`Saved ${distillation.memories.length} memories`);
        }
        
        // Apply relationship drift
        if (distillation.pairwise_drift?.length) {
          await applyDrift(distillation.pairwise_drift, session.id);
          console.log(`Applied ${distillation.pairwise_drift.length} relationship drifts`);
        }
        
        // Complete
        await completeConversation(session, history, distillation);
        console.log(`Conversation ${session.id} completed`);
      }
    } catch (e) {
      console.error('Worker loop error:', e.message);
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
