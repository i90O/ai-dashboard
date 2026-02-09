#!/usr/bin/env node
/**
 * Initiative Worker - VPS background process
 * Generates proposals from agents based on memories and action items
 * 
 * Run: node workers/initiative-worker.mjs
 * Or with PM2: pm2 start workers/initiative-worker.mjs --name initiative-worker
 */

import postgres from 'postgres';
import Anthropic from '@anthropic-ai/sdk';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.hlumwrbidlxepmcvsswe:8jlXcAZQN0L7bkMC@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL_MS = 60000; // 1 minute

const sql = postgres(DATABASE_URL);
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// Claim next pending initiative
async function claimNextInitiative() {
  const [init] = await sql`
    UPDATE ops_initiative_queue
    SET status = 'generating',
        processed_at = NOW()
    WHERE id = (
      SELECT id FROM ops_initiative_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  return init;
}

// Get agent's memories for proposal generation
async function getAgentContext(agentId) {
  // Get recent memories
  const memories = await sql`
    SELECT type, content, confidence, tags
    FROM ops_agent_memory
    WHERE agent_id = ${agentId}
      AND superseded_by IS NULL
      AND confidence >= 0.5
    ORDER BY confidence DESC, created_at DESC
    LIMIT 10
  `;

  // Get agent profile
  const [profile] = await sql`
    SELECT backstory, voice_base FROM ops_agent_profiles
    WHERE id = ${agentId}
  `;

  // Get recent action items from conversations
  const actionItems = await sql`
    SELECT action_items, topic
    FROM ops_roundtable_queue
    WHERE ${agentId} = ANY(participants)
      AND action_items != '[]'::jsonb
      AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 5
  `;

  return { memories, profile, actionItems };
}

// Generate proposal using LLM
async function generateProposal(agentId, context, triggerReason) {
  if (!anthropic) {
    // Mock response
    return {
      title: `[MOCK] Initiative from ${agentId}`,
      description: 'Mock proposal - no API key configured',
      proposed_steps: [{ kind: 'research', payload: { topic: 'mock' } }]
    };
  }

  const memoriesText = context.memories.map(m => 
    `- [${m.type}] ${m.content} (confidence: ${m.confidence})`
  ).join('\n');

  const actionItemsText = context.actionItems.flatMap(a => 
    (a.action_items || []).map(item => `- From "${a.topic}": ${item}`)
  ).join('\n');

  const prompt = `You are ${agentId}, an AI agent with the following background:
${context.profile?.backstory || 'A helpful AI assistant'}

Your recent learnings:
${memoriesText || '(No recent memories)'}

Recent action items from conversations:
${actionItemsText || '(No action items)'}

Trigger for this initiative: ${triggerReason}

Based on your memories and action items, propose ONE mission you should undertake.
The proposal should be actionable, specific, and achievable.

Respond in this exact JSON format:
{
  "title": "Brief mission title (max 50 chars)",
  "description": "Why this mission matters and what you'll accomplish",
  "proposed_steps": [
    { "kind": "step_type", "payload": { "relevant_data": "..." } }
  ]
}

Valid step kinds: crawl, analyze, research, write_content, draft_tweet, review
Keep it to 1-3 steps.`;

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

// Submit proposal to the system
async function submitProposal(agentId, proposal, initiativeId) {
  // Insert proposal
  const [created] = await sql`
    INSERT INTO ops_mission_proposals (
      agent_id, title, description, proposed_steps, source, source_trace_id
    ) VALUES (
      ${agentId},
      ${proposal.title},
      ${proposal.description},
      ${JSON.stringify(proposal.proposed_steps)},
      'initiative',
      ${initiativeId}
    )
    RETURNING id
  `;

  // Update initiative
  await sql`
    UPDATE ops_initiative_queue
    SET status = 'submitted',
        generated_proposal = ${JSON.stringify(proposal)},
        proposal_id = ${created.id}
    WHERE id = ${initiativeId}
  `;

  // Increment daily count
  await sql`
    INSERT INTO ops_initiative_daily (agent_id, date, count)
    VALUES (${agentId}, CURRENT_DATE, 1)
    ON CONFLICT (agent_id, date)
    DO UPDATE SET count = ops_initiative_daily.count + 1
  `;

  // Log event
  await sql`
    INSERT INTO ops_agent_events (agent_id, kind, title, tags, metadata)
    VALUES (
      ${agentId},
      'initiative_submitted',
      ${`Initiative submitted: ${proposal.title}`},
      ARRAY['initiative', 'proposal'],
      ${JSON.stringify({ initiative_id: initiativeId, proposal_id: created.id })}
    )
  `;

  return created.id;
}

// Mark initiative as failed
async function failInitiative(initiativeId, reason) {
  await sql`
    UPDATE ops_initiative_queue
    SET status = 'failed',
        blocked_reason = ${reason}
    WHERE id = ${initiativeId}
  `;
}

// Main worker loop
async function workerLoop() {
  console.log(`[${new Date().toISOString()}] Initiative Worker started`);
  
  if (!anthropic) {
    console.warn('No ANTHROPIC_API_KEY - using mock proposals');
  }

  while (true) {
    try {
      const initiative = await claimNextInitiative();

      if (initiative) {
        console.log(`Processing initiative ${initiative.id} for ${initiative.agent_id}`);

        // Get context
        const context = await getAgentContext(initiative.agent_id);

        // Check memory threshold again
        if (context.memories.length < 5 && !initiative.trigger_reason?.includes('action_item')) {
          await failInitiative(initiative.id, 'Not enough memories');
          console.log(`Initiative ${initiative.id} blocked: not enough memories`);
          continue;
        }

        // Generate proposal
        const proposal = await generateProposal(
          initiative.agent_id,
          context,
          initiative.trigger_reason || 'scheduled'
        );

        if (!proposal) {
          await failInitiative(initiative.id, 'Failed to generate proposal');
          console.log(`Initiative ${initiative.id} failed: proposal generation error`);
          continue;
        }

        // Submit
        const proposalId = await submitProposal(initiative.agent_id, proposal, initiative.id);
        console.log(`Initiative ${initiative.id} → Proposal ${proposalId}: ${proposal.title}`);
      }
    } catch (e) {
      console.error('Worker loop error:', e.message);
    }

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
