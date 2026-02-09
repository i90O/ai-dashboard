#!/usr/bin/env node
/**
 * Conversation Scheduler
 * Creates roundtable conversations based on daily schedule
 * 
 * Run this once per hour via cron:
 * 0 * * * * node /path/to/schedule-conversations.mjs
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.hlumwrbidlxepmcvsswe:8jlXcAZQN0L7bkMC@aws-0-us-east-1.pooler.supabase.com:5432/postgres';

const sql = postgres(DATABASE_URL);

// Available agents
const AGENTS = ['xiaobei', 'clawd2', 'clawd3'];

// Pick random subset of agents
function pickAgents(min, max) {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...AGENTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, AGENTS.length));
}

// Daily schedule (UTC hours)
const SCHEDULE = [
  { hour: 14, name: 'Morning Standup', format: 'standup', probability: 1.0 },
  { hour: 16, name: 'Afternoon Brainstorm', format: 'brainstorm', probability: 0.6 },
  { hour: 19, name: 'Evening Check-in', format: 'standup', probability: 0.8 },
  { hour: 21, name: 'Watercooler Chat', format: 'watercooler', probability: 0.5 },
  { hour: 23, name: 'Night Briefing', format: 'debate', probability: 0.4 },
];

// Topics for different formats
const TOPICS = {
  standup: [
    'What did we accomplish today?',
    'Any blockers or issues?',
    'Priorities for the next few hours',
    'Status update on ongoing missions'
  ],
  brainstorm: [
    'How can we improve our workflow?',
    'New feature ideas',
    'Content strategy discussion',
    'User feedback analysis'
  ],
  watercooler: [
    'Random interesting observations',
    'Tech news discussion',
    'Lessons from recent missions',
    'Creative ideas we should explore'
  ],
  debate: [
    'Should we be more aggressive or cautious?',
    'Quality vs. quantity in content',
    'Best practices discussion',
    'Strategy disagreements'
  ]
};

async function scheduleConversations() {
  const now = new Date();
  const currentHour = now.getUTCHours();
  
  console.log(`Checking schedule for UTC hour ${currentHour}`);
  
  for (const slot of SCHEDULE) {
    if (slot.hour !== currentHour) continue;
    
    // Probability check
    if (Math.random() > slot.probability) {
      console.log(`Skipping ${slot.name} (probability ${slot.probability})`);
      continue;
    }
    
    // Check if already scheduled today
    const today = now.toISOString().split('T')[0];
    const [existing] = await sql`
      SELECT id FROM ops_roundtable_queue
      WHERE created_at >= ${today}::date
        AND created_at < (${today}::date + interval '1 day')
        AND format = ${slot.format}
        AND topic LIKE ${slot.name + '%'}
    `;
    
    if (existing) {
      console.log(`${slot.name} already scheduled today`);
      continue;
    }
    
    // Pick participants
    const format = slot.format;
    const minAgents = { standup: 2, brainstorm: 2, watercooler: 2, debate: 2 }[format] || 2;
    const maxAgents = { standup: 4, brainstorm: 4, watercooler: 3, debate: 3 }[format] || 3;
    const participants = pickAgents(minAgents, maxAgents);
    
    // Pick topic
    const topics = TOPICS[format] || TOPICS.standup;
    const topic = topics[Math.floor(Math.random() * topics.length)];
    
    // Create conversation
    await sql`
      INSERT INTO ops_roundtable_queue (format, topic, participants, status)
      VALUES (${format}, ${slot.name + ': ' + topic}, ${participants}, 'pending')
    `;
    
    console.log(`Scheduled: ${slot.name} - ${topic}`);
    console.log(`Participants: ${participants.join(', ')}`);
    
    // Emit event
    await sql`
      INSERT INTO ops_agent_events (agent_id, kind, title, summary, tags, metadata)
      VALUES (
        'system',
        'conversation_scheduled',
        ${slot.name + ' scheduled'},
        ${topic},
        ${['conversation', 'scheduled', format]},
        ${JSON.stringify({ participants, format })}
      )
    `;
  }
  
  await sql.end();
  console.log('Done');
}

scheduleConversations().catch(console.error);
