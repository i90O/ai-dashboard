import { getSupabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Checker functions for each trigger_event type
async function checkMissionFailed(supabase: any, conditions: any) {
  const lookback = conditions.lookback_minutes || 60;
  const { data: recentFails } = await supabase.from('ops_missions').select('id, title')
    .eq('status', 'failed')
    .gte('completed_at', new Date(Date.now() - lookback * 60 * 1000).toISOString())
    .limit(3);
  
  if (!recentFails?.length) return { fired: false };
  return {
    fired: true,
    proposal: {
      title: 'Diagnose failed missions',
      proposed_steps: [{ kind: 'diagnose', payload: { failed_missions: recentFails.map((m: any) => m.id) } }]
    }
  };
}

async function checkTweetHighEngagement(supabase: any, conditions: any) {
  const minRate = conditions.engagement_rate_min || 0.05;
  const lookback = conditions.lookback_minutes || 60;
  
  const { data: metrics } = await supabase.from('ops_tweet_performance')
    .select('*')
    .gt('engagement_rate', minRate)
    .gte('posted_at', new Date(Date.now() - lookback * 60 * 1000).toISOString())
    .eq('reviewed', false)
    .limit(3);
  
  if (!metrics?.length) return { fired: false };
  return {
    fired: true,
    proposal: {
      title: 'Analyze high-engagement tweets',
      proposed_steps: [{ kind: 'analyze', payload: { topic: 'tweet-performance', tweet_ids: metrics.map((m: any) => m.tweet_id) } }]
    }
  };
}

async function checkProactiveTrigger(supabase: any, conditions: any, actionConfig: any) {
  // 10-15% skip probability ("not feeling like it today")
  if (Math.random() < 0.15) return { fired: false, reason: 'skipped_randomly' };
  
  // Topic rotation from conditions
  const topics = conditions.topics || ['general'];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  
  return {
    fired: true,
    proposal: {
      title: `Proactive: ${actionConfig.step_kind || 'task'} - ${topic}`,
      proposed_steps: [{ kind: actionConfig.step_kind || 'research', payload: { topic } }]
    },
    jitter_ms: 25 * 60 * 1000 + Math.random() * 20 * 60 * 1000 // 25-45 min jitter
  };
}

const TRIGGER_CHECKERS: Record<string, (sb: any, cond: any, act: any) => Promise<any>> = {
  mission_failed: checkMissionFailed,
  tweet_high_engagement: checkTweetHighEngagement,
  proactive_scan: checkProactiveTrigger,
  proactive_draft_tweet: checkProactiveTrigger,
  proactive_research: checkProactiveTrigger,
  proactive_analyze_ops: checkProactiveTrigger,
};

async function evaluateTriggers(budgetMs: number = 4000): Promise<any[]> {
  const supabase = getSupabase();
  const startTime = Date.now();
  const fired: any[] = [];
  
  const { data: triggers } = await supabase.from('ops_trigger_rules').select('*').eq('enabled', true);
  if (!triggers) return fired;
  
  for (const trigger of triggers) {
    if (Date.now() - startTime > budgetMs) break;
    
    // Cooldown check (cheap, do first)
    if (trigger.last_fired_at) {
      const cooldownMs = trigger.cooldown_minutes * 60 * 1000;
      const elapsed = Date.now() - new Date(trigger.last_fired_at).getTime();
      if (elapsed < cooldownMs) continue;
    }
    
    // Get checker function
    const checker = TRIGGER_CHECKERS[trigger.trigger_event];
    if (!checker) continue;
    
    // Run checker (potentially expensive)
    const result = await checker(supabase, trigger.conditions || {}, trigger.action_config || {});
    
    if (result.fired) {
      // Create proposal through standard pipeline
      const targetAgent = trigger.action_config?.target_agent || 'xiaobei';
      const proposedSteps = result.proposal.proposed_steps || [];
      
      // Check auto-approve policy
      const { data: autoApprovePolicy } = await supabase.from('ops_policy')
        .select('value').eq('key', 'auto_approve').single();
      const allowedKinds = autoApprovePolicy?.value?.allowed_step_kinds || [];
      const stepKinds = proposedSteps.map((s: any) => s.kind);
      const shouldAutoApprove = autoApprovePolicy?.value?.enabled && 
        stepKinds.every((k: string) => allowedKinds.includes(k));
      
      const { data: proposal } = await supabase.from('ops_mission_proposals').insert({
        agent_id: targetAgent,
        title: result.proposal.title,
        proposed_steps: proposedSteps,
        source: 'trigger',
        source_trace_id: `trigger:${trigger.id}:${Date.now()}`,
        status: shouldAutoApprove ? 'accepted' : 'pending'
      }).select().single();
      
      let missionId = null;
      
      // Auto-approve: create mission + steps immediately
      if (shouldAutoApprove && proposal) {
        const { data: mission } = await supabase.from('ops_missions').insert({
          title: result.proposal.title,
          created_by: targetAgent,
          proposal_id: proposal.id,
          status: 'approved'
        }).select().single();
        
        if (mission && proposedSteps.length) {
          const steps = proposedSteps.map((s: any, i: number) => ({
            mission_id: mission.id,
            seq: i + 1,
            kind: s.kind,
            payload: s.payload || {},
            status: 'queued'
          }));
          await supabase.from('ops_mission_steps').insert(steps);
          missionId = mission.id;
        }
      }
      
      // Update trigger stats
      await supabase.from('ops_trigger_rules').update({ 
        last_fired_at: new Date().toISOString(), 
        fire_count: (trigger.fire_count || 0) + 1
      }).eq('id', trigger.id);
      
      fired.push({ 
        trigger_id: trigger.id, 
        name: trigger.name, 
        event: trigger.trigger_event, 
        proposal_id: proposal?.id,
        mission_id: missionId,
        auto_approved: shouldAutoApprove
      });
    }
  }
  
  return fired;
}

// Check recent events against reaction matrix and queue reactions
async function evaluateReactionMatrix(): Promise<number> {
  const supabase = getSupabase();
  
  // Get reaction matrix from policy
  const { data: policy } = await supabase.from('ops_policy').select('value').eq('key', 'reaction_matrix').single();
  if (!policy?.value?.patterns) return 0;
  
  const patterns = policy.value.patterns;
  
  // Get recent unprocessed events (last 5 minutes)
  const { data: events } = await supabase.from('ops_agent_events')
    .select('*')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (!events?.length) return 0;
  
  let queued = 0;
  for (const event of events) {
    const eventTags = event.tags || [];
    
    for (const pattern of patterns) {
      // Check source match
      if (pattern.source !== '*' && pattern.source !== event.agent_id) continue;
      
      // Check tags match (any overlap)
      const patternTags = pattern.tags || [];
      const tagsMatch = patternTags.some((t: string) => eventTags.includes(t));
      if (!tagsMatch) continue;
      
      // Probability roll
      if (Math.random() > (pattern.probability || 1.0)) continue;
      
      // Check cooldown - look for recent reactions of this type
      const { data: recent } = await supabase.from('ops_agent_reactions')
        .select('id')
        .eq('target_agent', pattern.target)
        .eq('reaction_type', pattern.type)
        .gte('created_at', new Date(Date.now() - (pattern.cooldown || 60) * 60 * 1000).toISOString())
        .limit(1);
      
      if (recent?.length) continue; // Still in cooldown
      
      // Queue the reaction
      await supabase.from('ops_agent_reactions').insert({
        source_event_id: event.id,
        target_agent: pattern.target,
        reaction_type: pattern.type,
        metadata: { event_kind: event.kind, event_title: event.title, pattern_source: pattern.source }
      });
      queued++;
    }
  }
  
  return queued;
}

async function processReactionQueue(budgetMs: number = 3000): Promise<number> {
  const supabase = getSupabase();
  const startTime = Date.now();
  let processed = 0;
  
  const { data: reactions } = await supabase.from('ops_agent_reactions').select('*')
    .eq('status', 'pending').order('created_at', { ascending: true }).limit(5);
  
  if (!reactions) return 0;
  
  for (const reaction of reactions) {
    if (Date.now() - startTime > budgetMs) break;
    
    // Create proposal through standard pipeline (respects Cap Gates)
    await supabase.from('ops_mission_proposals').insert({
      agent_id: reaction.target_agent, 
      title: `Reaction: ${reaction.reaction_type}`, 
      source: 'reaction',
      source_trace_id: `reaction:${reaction.id}`,
      proposed_steps: [{ kind: reaction.reaction_type, payload: reaction.metadata }]
    });
    
    await supabase.from('ops_agent_reactions').update({ 
      status: 'processed', 
      processed_at: new Date().toISOString() 
    }).eq('id', reaction.id);
    processed++;
  }
  
  return processed;
}

async function recoverStaleSteps(): Promise<number> {
  const supabase = getSupabase();
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: stale } = await supabase.from('ops_mission_steps').select('id')
    .eq('status', 'running').lt('started_at', staleThreshold);
  
  if (!stale?.length) return 0;
  
  await supabase.from('ops_mission_steps').update({ 
    status: 'failed', failure_reason: 'Stale - exceeded 30 min timeout', completed_at: new Date().toISOString()
  }).in('id', stale.map(s => s.id));
  
  return stale.length;
}

// Recover stuck roundtable conversations
async function recoverStaleRoundtables(): Promise<number> {
  const supabase = getSupabase();
  const staleThreshold = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour
  
  const { data: stale } = await supabase.from('ops_roundtable_queue').select('id')
    .eq('status', 'running').lt('started_at', staleThreshold);
  
  if (!stale?.length) return 0;
  
  await supabase.from('ops_roundtable_queue').update({ 
    status: 'failed', completed_at: new Date().toISOString()
  }).in('id', stale.map(s => s.id));
  
  return stale.length;
}

// Promote high-confidence insights to permanent memory
async function promoteInsights(): Promise<number> {
  const supabase = getSupabase();
  
  // Find insights with multiple upvotes/confirmations
  const { data: insights } = await supabase.from('ops_agent_memory')
    .select('*')
    .eq('type', 'insight')
    .gte('confidence', 0.8)
    .is('superseded_by', null)
    .limit(5);
  
  if (!insights?.length) return 0;
  
  let promoted = 0;
  for (const insight of insights) {
    // Promote to strategy or lesson based on content
    const newType = insight.content.includes('should') || insight.content.includes('better') 
      ? 'strategy' 
      : 'lesson';
    
    await supabase.from('ops_agent_memory').insert({
      agent_id: insight.agent_id,
      type: newType,
      content: insight.content,
      confidence: Math.min(0.95, insight.confidence + 0.05),
      tags: [...(insight.tags || []), 'promoted'],
      source_trace_id: `promoted:${insight.id}`
    });
    
    // Mark original as superseded
    await supabase.from('ops_agent_memory').update({
      superseded_by: insight.id
    }).eq('id', insight.id);
    
    promoted++;
  }
  
  return promoted;
}

// Learn from tweet/content outcomes
async function learnFromOutcomes(): Promise<number> {
  const supabase = getSupabase();
  
  // Find recent events with performance data
  const { data: events } = await supabase.from('ops_agent_events')
    .select('*')
    .in('kind', ['tweet_posted', 'content_published'])
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(10);
  
  if (!events?.length) return 0;
  
  // TODO: Fetch actual performance metrics and write lessons
  // For now, return 0
  return 0;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const supabase = getSupabase();
  
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Heartbeat called without valid CRON_SECRET');
  }
  
  try {
    const { data: run } = await supabase.from('ops_action_runs').insert({ action_type: 'heartbeat', status: 'running' }).select().single();
    const results: Record<string, any> = {};
    
    // 1. Evaluate triggers (creates proposals from conditions)
    try { results.triggers = await evaluateTriggers(4000); } catch (e) { results.triggers_error = String(e); }
    // 2. Evaluate reaction matrix (queues reactions from events)
    try { results.reactions_queued = await evaluateReactionMatrix(); } catch (e) { results.reactions_queued_error = String(e); }
    // 3. Process reaction queue (creates proposals from reactions)
    try { results.reactions_processed = await processReactionQueue(3000); } catch (e) { results.reactions_error = String(e); }
    // 3. Promote insights
    try { results.insights_promoted = await promoteInsights(); } catch (e) { results.insights_error = String(e); }
    // 4. Learn from outcomes
    try { results.outcomes_learned = await learnFromOutcomes(); } catch (e) { results.outcomes_error = String(e); }
    // 5. Recover stale steps
    try { results.stale_steps_recovered = await recoverStaleSteps(); } catch (e) { results.stale_steps_error = String(e); }
    // 6. Recover stale roundtables
    try { results.stale_roundtables_recovered = await recoverStaleRoundtables(); } catch (e) { results.stale_roundtables_error = String(e); }
    
    if (run) {
      await supabase.from('ops_action_runs').update({ status: 'completed', completed_at: new Date().toISOString(), summary: results }).eq('id', run.id);
    }
    
    return NextResponse.json({ success: true, duration_ms: Date.now() - startTime, results });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
