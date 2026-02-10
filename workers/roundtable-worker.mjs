#!/usr/bin/env node
/**
 * Roundtable Worker - Gemini + Anthropic support
 * Orchestrates agent conversations, extracts memories and relationship drift
 */

const API_BASE = process.env.API_BASE || 'https://ai-dashboard-phi-three.vercel.app';
const API_KEY = process.env.API_KEY || 'xiaobei-mc-2026';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const POLL_INTERVAL_MS = 30000; // 30 seconds
const MAX_TURN_LENGTH = 120;

// Determine which LLM to use
let llmProvider = null;
let Anthropic = null;

if (GEMINI_API_KEY) {
  llmProvider = 'gemini';
  console.log('Using Gemini API');
} else if (ANTHROPIC_API_KEY) {
  try {
    Anthropic = (await import('@anthropic-ai/sdk')).default;
    llmProvider = 'anthropic';
    console.log('Using Anthropic API');
  } catch {
    console.warn('Anthropic SDK not installed');
  }
}

const anthropic = llmProvider === 'anthropic' ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

console.log(`[${new Date().toISOString()}] Roundtable Worker started`);
console.log(`  API: ${API_BASE}`);
console.log(`  LLM: ${llmProvider || 'mock mode'}`);

// Gemini API helper
async function callGemini(prompt, systemPrompt = '', temperature = 0.7, maxTokens = 150) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    })
  });
  
  const data = await res.json();
  if (data.error) {
    console.error('Gemini error:', data.error.message);
    return null;
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

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
  xiaobei: { displayName: '小北', tone: 'helpful, efficient', systemDirective: 'You are 小北, a direct and warm AI assistant. Speak in short sentences. Be helpful but concise.' },
  clawd2: { displayName: 'Clawd2', tone: 'analytical', systemDirective: 'You are Clawd2, an analytical AI who cites data and thinks logically.' },
  clawd3: { displayName: 'Clawd3', tone: 'action-biased', systemDirective: 'You are Clawd3, a creative AI who prefers action over planning.' },
  clawd4: { displayName: 'Clawd4', tone: 'cautious', systemDirective: 'You are Clawd4, a careful AI who considers risks and asks clarifying questions.' },
  clawd5: { displayName: 'Clawd5', tone: 'optimistic', systemDirective: 'You are Clawd5, an enthusiastic AI who sees opportunities everywhere.' },
  clawd6: { displayName: 'Clawd6', tone: 'pragmatic', systemDirective: 'You are Clawd6, focused on shipping and execution. Less talk, more action.' }
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
  
  const voice = VOICES[agentId] || { displayName: agentId, tone: 'neutral', systemDirective: `You are ${agentId}` };
  const modifiers = await deriveVoiceModifiers(agentId);
  
  let prompt = voice.systemDirective;
  if (modifiers.length) prompt += '\n\nStyle notes: ' + modifiers.join('; ');
  
  voiceCache.set(cacheKey, prompt);
  setTimeout(() => voiceCache.delete(cacheKey), 60000); // 1 min cache
  return prompt;
}

async function getAffinity(agentA, agentB) {
  const { relationship } = await api(`/api/ops/relationships?agent_a=${agentA}&agent_b=${agentB}`);
  return relationship?.affinity || 0.5;
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

// Interaction type based on affinity (per article Ch4)
async function getInteractionType(speaker, lastSpeaker) {
  if (!lastSpeaker) return 'neutral';
  
  const affinity = await getAffinity(speaker, lastSpeaker);
  const tension = 1 - affinity;
  
  if (tension > 0.6) {
    // High tension → 20% chance of direct challenge
    return Math.random() < 0.2 ? 'challenge' : 'critical';
  } else if (tension < 0.3) {
    // Low tension → 40% chance of supportive
    return Math.random() < 0.4 ? 'supportive' : 'agreement';
  }
  return 'neutral';
}

async function generateTurn(speaker, history, topic, format, lastSpeaker = null) {
  const historyText = history.map(h => `${h.speaker}: ${h.dialogue}`).join('\n');
  const systemPrompt = await buildAgentPrompt(speaker);
  
  // Get interaction type based on affinity
  const interactionType = await getInteractionType(speaker, lastSpeaker);
  const interactionHint = {
    'challenge': 'Be direct and challenge the last point made. Disagree constructively.',
    'critical': 'Be analytical and point out potential issues or gaps.',
    'supportive': 'Build on what was said and offer encouragement.',
    'agreement': 'Agree with the direction and add value.',
    'neutral': ''
  }[interactionType];
  
  const userPrompt = `Topic: ${topic}\n\nConversation so far:\n${historyText || '(starting)'}\n\n${interactionHint ? `Tone: ${interactionHint}\n\n` : ''}Your turn to speak. Keep it under ${MAX_TURN_LENGTH} characters. Be natural and conversational.`;
  
  let text = null;
  
  if (llmProvider === 'gemini') {
    text = await callGemini(userPrompt, systemPrompt, format.temperature, 100);
  } else if (llmProvider === 'anthropic') {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      temperature: format.temperature,
      system: systemPrompt + `\n\nKeep response under ${MAX_TURN_LENGTH} chars.`,
      messages: [{ role: 'user', content: userPrompt }]
    });
    text = response.content[0].text;
  }
  
  if (!text) {
    return `[${speaker}] (mock) My thoughts on ${topic}...`;
  }
  
  // Clean up and truncate
  text = text.trim();
  if (text.length > MAX_TURN_LENGTH) text = text.substring(0, MAX_TURN_LENGTH - 3) + '...';
  return text;
}

async function distillConversation(session) {
  const historyText = session.history.map(h => `${h.speaker}: ${h.dialogue}`).join('\n');
  const canGenerateActions = ['standup', 'brainstorm', 'planning'].includes(session.format);
  
  const prompt = `Analyze this ${session.format} conversation about "${session.topic}":

${historyText}

Extract:
1. memories (insights/lessons/patterns) - max 3
2. pairwise_drift (relationship changes between speakers) - max 2
3. ${canGenerateActions ? 'action_items (concrete tasks) - max 2' : 'no action_items'}

Respond ONLY with valid JSON:
{
  "memories": [{"agent_id": "speaker_id", "type": "insight|lesson|pattern", "content": "brief insight", "confidence": 0.7, "tags": []}],
  "pairwise_drift": [{"agent_a": "id1", "agent_b": "id2", "drift": 0.01, "reason": "brief"}],
  "action_items": []
}`;

  let result = null;
  
  if (llmProvider === 'gemini') {
    const text = await callGemini(prompt, 'You are a conversation analyst. Respond only with valid JSON.', 0.3, 500);
    if (text) {
      try {
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse distillation:', e.message);
      }
    }
  } else if (llmProvider === 'anthropic') {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 600,
      temperature: 0.3,
      system: 'Extract insights from conversations. Respond in JSON only.',
      messages: [{ role: 'user', content: prompt }]
    });
    try {
      const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse distillation');
    }
  }
  
  return result || { memories: [], pairwise_drift: [], action_items: [] };
}

async function saveMemories(memories) {
  for (const mem of memories) {
    await api('/api/ops/memory', {
      method: 'POST',
      body: JSON.stringify(mem)
    });
  }
}

async function applyDrift(drifts) {
  for (const d of drifts) {
    await api('/api/ops/relationships', {
      method: 'POST',
      body: JSON.stringify({
        agent_a: d.agent_a,
        agent_b: d.agent_b,
        drift: d.drift,
        reason: d.reason
      })
    });
  }
}

async function processActionItems(actionItems, sessionId) {
  for (const item of actionItems) {
    await api('/api/ops/proposals', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: item.agent_id,
        title: item.title,
        description: `From conversation: ${sessionId}`,
        source: 'conversation',
        proposed_steps: [{ kind: item.step_kind || 'research', payload: { from_conversation: sessionId } }]
      })
    });
  }
}

async function orchestrateConversation(session) {
  const format = FORMATS[session.format] || FORMATS.standup;
  const participants = session.participants || ['xiaobei', 'clawd2'];
  const numTurns = Math.floor(Math.random() * (format.maxTurns - format.minTurns + 1)) + format.minTurns;
  
  const history = [];
  const speakCounts = {};
  let lastSpeaker = null;
  
  for (let i = 0; i < numTurns; i++) {
    const speaker = await selectNextSpeaker(participants, lastSpeaker, speakCounts);
    speakCounts[speaker] = (speakCounts[speaker] || 0) + 1;
    
    const dialogue = await generateTurn(speaker, history, session.topic, format, lastSpeaker);
    history.push({ turn: i, speaker, dialogue, timestamp: new Date().toISOString() });
    
    console.log(`  [${i + 1}/${numTurns}] ${speaker}: ${dialogue.substring(0, 50)}...`);
    
    // Log event
    await api('/api/ops/events', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: speaker,
        kind: 'conversation_turn',
        title: `${VOICES[speaker]?.displayName || speaker} spoke`,
        tags: ['conversation', session.format],
        metadata: { session_id: session.id, turn: i }
      })
    });
    
    lastSpeaker = speaker;
    
    // Small delay between turns
    await new Promise(r => setTimeout(r, 500));
  }
  
  return history;
}

async function poll() {
  try {
    // Get pending conversations
    const { conversations } = await api('/api/ops/roundtable?status=pending&limit=1');
    
    if (conversations?.length) {
      const session = conversations[0];
      console.log(`\nClaimed conversation ${session.id}`);
      
      // Mark as running
      await api('/api/ops/roundtable', {
        method: 'PATCH',
        body: JSON.stringify({ id: session.id, status: 'running', started_at: new Date().toISOString() })
      });
      
      console.log(`\nStarting ${session.format}: ${session.topic}`);
      console.log(`Participants: ${session.participants?.join(', ')}`);
      
      // Run conversation
      const history = await orchestrateConversation(session);
      
      // Distill memories
      const distilled = await distillConversation({ ...session, history });
      
      // Save results
      if (distilled.memories?.length) {
        console.log(`  Saving ${distilled.memories.length} memories`);
        await saveMemories(distilled.memories.map(m => ({ ...m, source_conversation: session.id })));
      }
      
      if (distilled.pairwise_drift?.length) {
        console.log(`  Applying ${distilled.pairwise_drift.length} relationship drifts`);
        await applyDrift(distilled.pairwise_drift);
      }
      
      if (distilled.action_items?.length) {
        console.log(`  Creating ${distilled.action_items.length} action items`);
        await processActionItems(distilled.action_items, session.id);
      }
      
      // Mark complete
      await api('/api/ops/roundtable', {
        method: 'PATCH',
        body: JSON.stringify({
          id: session.id,
          status: 'completed',
          history,
          memories_extracted: distilled.memories || [],
          action_items: distilled.action_items || [],
          completed_at: new Date().toISOString()
        })
      });
      
      console.log(`Conversation ${session.id} completed\n`);
    }
  } catch (error) {
    console.error(`Poll error: ${error.message}`);
  }
}

// Main loop
setInterval(poll, POLL_INTERVAL_MS);
poll();

console.log(`Worker running. Poll interval: ${POLL_INTERVAL_MS}ms\n`);
