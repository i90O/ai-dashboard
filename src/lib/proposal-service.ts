import { SupabaseClient } from '@supabase/supabase-js';

export interface ProposalStep {
  kind: string;
  payload?: Record<string, unknown>;
}

export interface ProposalServiceInput {
  agent_id: string;
  title: string;
  description?: string;
  proposed_steps: ProposalStep[];
  source: 'human' | 'trigger' | 'reaction' | 'conversation' | 'initiative' | 'agent';
  source_trace_id?: string;
}

export interface ProposalServiceResult {
  success: boolean;
  proposal_id?: string;
  mission_id?: string;
  auto_approved: boolean;
  rejected?: boolean;
  rejection_reason?: string;
  error?: string;
}

// ============================================================
// STEP KIND GATES - Reject at entry point, not in queue
// Each step kind can have its own gate check
// ============================================================

type StepKindGate = (supabase: SupabaseClient) => Promise<{ ok: boolean; reason?: string }>;

function startOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// Tweet gate: check X posting quota
async function checkPostTweetGate(supabase: SupabaseClient): Promise<{ ok: boolean; reason?: string }> {
  // Check if autopost is enabled
  const { data: autopostPolicy } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', 'x_autopost')
    .single();
  
  if (autopostPolicy?.value?.enabled === false) {
    return { ok: false, reason: 'x_autopost disabled' };
  }

  // Check daily quota
  const { data: quotaPolicy } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', 'x_daily_quota')
    .single();
  
  const limit = quotaPolicy?.value?.limit ?? 8;
  
  const { count } = await supabase
    .from('ops_agent_events')
    .select('*', { count: 'exact', head: true })
    .eq('kind', 'tweet_posted')
    .gte('created_at', startOfTodayUtcIso());

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Daily tweet quota reached (${count}/${limit})` };
  }

  return { ok: true };
}

// Content gate: check content generation quota  
async function checkWriteContentGate(supabase: SupabaseClient): Promise<{ ok: boolean; reason?: string }> {
  const { data: policy } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', 'content_policy')
    .single();

  if (!policy?.value?.max_drafts_per_day) {
    return { ok: true }; // No limit configured
  }

  const limit = policy.value.max_drafts_per_day;
  
  const { count } = await supabase
    .from('ops_mission_steps')
    .select('*', { count: 'exact', head: true })
    .eq('kind', 'write_content')
    .gte('created_at', startOfTodayUtcIso());

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Content quota full (${count}/${limit})` };
  }

  return { ok: true };
}

// Deploy gate: check deploy policy
async function checkDeployGate(supabase: SupabaseClient): Promise<{ ok: boolean; reason?: string }> {
  const { data: policy } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', 'deploy_policy')
    .single();

  // Deploy disabled?
  if (policy?.value?.enabled === false) {
    return { ok: false, reason: 'Deploy disabled by policy' };
  }

  // Check cooldown (e.g., only 1 deploy per hour)
  if (policy?.value?.cooldown_minutes) {
    const cooldownMs = policy.value.cooldown_minutes * 60 * 1000;
    const since = new Date(Date.now() - cooldownMs).toISOString();
    
    const { count } = await supabase
      .from('ops_agent_events')
      .select('*', { count: 'exact', head: true })
      .eq('kind', 'deploy_completed')
      .gte('created_at', since);

    if ((count ?? 0) > 0) {
      return { ok: false, reason: `Deploy cooldown active (wait ${policy.value.cooldown_minutes} min)` };
    }
  }

  return { ok: true };
}

// Roundtable gate: check daily conversation limit
async function checkRoundtableGate(supabase: SupabaseClient): Promise<{ ok: boolean; reason?: string }> {
  const { data: policy } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', 'roundtable_limits')
    .single();

  if (!policy?.value?.max_per_day) {
    return { ok: true };
  }

  const limit = policy.value.max_per_day;
  
  const { count } = await supabase
    .from('ops_roundtable_conversations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfTodayUtcIso());

  if ((count ?? 0) >= limit) {
    return { ok: false, reason: `Roundtable quota full (${count}/${limit})` };
  }

  return { ok: true };
}

// Gate registry - extensible for new step kinds
const STEP_KIND_GATES: Record<string, StepKindGate> = {
  post_tweet: checkPostTweetGate,
  draft_tweet: checkPostTweetGate,
  write_content: checkWriteContentGate,
  deploy: checkDeployGate,
  roundtable: checkRoundtableGate,
};

/**
 * Check all cap gates for the given step kinds.
 * Key principle: Reject at the gate, don't pile up in the queue.
 */
async function checkCapGates(
  supabase: SupabaseClient,
  stepKinds: string[]
): Promise<{ ok: boolean; reason?: string; failed_gate?: string }> {
  
  for (const kind of stepKinds) {
    const gate = STEP_KIND_GATES[kind];
    if (gate) {
      const result = await gate(supabase);
      if (!result.ok) {
        return { ok: false, reason: result.reason, failed_gate: kind };
      }
    }
  }

  return { ok: true };
}

/**
 * Emit a warning event when a gate rejects
 */
async function emitGateRejectionWarning(
  supabase: SupabaseClient,
  agentId: string,
  title: string,
  reason: string,
  failedGate?: string
): Promise<void> {
  await supabase.from('ops_agent_events').insert({
    agent_id: agentId,
    kind: 'gate_rejection',
    title: `Gate rejected: ${title}`,
    tags: ['warning', 'gate', failedGate || 'unknown'].filter(Boolean),
    metadata: { reason, failed_gate: failedGate }
  });
}

/**
 * Check if step kinds qualify for auto-approval
 */
async function checkAutoApprove(
  supabase: SupabaseClient,
  stepKinds: string[]
): Promise<boolean> {
  const { data: policy } = await supabase
    .from('ops_policy')
    .select('value')
    .eq('key', 'auto_approve')
    .single();
  
  if (!policy?.value?.enabled) return false;
  
  const allowedKinds = policy.value.allowed_step_kinds || [];
  return stepKinds.every(kind => allowedKinds.includes(kind));
}

/**
 * Single entry point for all proposal creation.
 * All paths (API, triggers, reactions) must use this function.
 * 
 * Flow:
 * 1. Check daily limit per agent
 * 2. Check Cap Gates (reject at entry, not in queue!)
 * 3. Check auto-approve policy
 * 4. Insert proposal
 * 5. If auto-approved → create mission + steps
 */
export async function createProposalAndMaybeAutoApprove(
  supabase: SupabaseClient,
  input: ProposalServiceInput
): Promise<ProposalServiceResult> {
  const { agent_id, title, description, proposed_steps, source, source_trace_id } = input;
  const stepKinds = proposed_steps.map(s => s.kind);

  try {
    // 1. Check daily limit per agent
    const { data: limitPolicy } = await supabase
      .from('ops_policy')
      .select('value')
      .eq('key', 'initiative_limits')
      .single();
    
    if (limitPolicy?.value?.max_per_agent_per_day) {
      const { count } = await supabase
        .from('ops_mission_proposals')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agent_id)
        .gte('created_at', startOfTodayUtcIso());
      
      if ((count || 0) >= limitPolicy.value.max_per_agent_per_day) {
        const reason = `Daily proposal limit reached (${count}/${limitPolicy.value.max_per_agent_per_day})`;
        await emitGateRejectionWarning(supabase, agent_id, title, reason, 'daily_limit');
        return {
          success: false,
          auto_approved: false,
          rejected: true,
          rejection_reason: reason
        };
      }
    }

    // 2. Check Cap Gates - KEY: Reject at entry point, not in queue!
    const gateResult = await checkCapGates(supabase, stepKinds);
    if (!gateResult.ok) {
      // Insert as rejected (for auditing - don't silently drop)
      const { data: rejected } = await supabase
        .from('ops_mission_proposals')
        .insert({
          agent_id,
          title,
          description,
          proposed_steps,
          source,
          source_trace_id,
          status: 'rejected',
          rejection_reason: gateResult.reason
        })
        .select()
        .single();

      // Emit warning event
      await emitGateRejectionWarning(supabase, agent_id, title, gateResult.reason!, gateResult.failed_gate);

      return {
        success: false,
        proposal_id: rejected?.id,
        auto_approved: false,
        rejected: true,
        rejection_reason: gateResult.reason
      };
    }

    // 3. Check auto-approve policy
    const shouldAutoApprove = await checkAutoApprove(supabase, stepKinds);

    // 4. Insert proposal
    const { data: proposal, error: insertError } = await supabase
      .from('ops_mission_proposals')
      .insert({
        agent_id,
        title,
        description,
        proposed_steps,
        source,
        source_trace_id,
        status: shouldAutoApprove ? 'accepted' : 'pending'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 5. Emit event
    await supabase.from('ops_agent_events').insert({
      agent_id,
      kind: 'proposal_created',
      title: `Proposal: ${title}`,
      tags: ['proposal', source],
      metadata: { proposal_id: proposal.id, source, auto_approved: shouldAutoApprove }
    });

    let mission_id: string | undefined;

    // 6. If auto-approved → create mission + steps
    if (shouldAutoApprove) {
      const { data: mission } = await supabase
        .from('ops_missions')
        .insert({
          title,
          description,
          created_by: agent_id,
          proposal_id: proposal.id,
          status: 'approved'
        })
        .select()
        .single();

      if (mission && proposed_steps.length) {
        const steps = proposed_steps.map((s, i) => ({
          mission_id: mission.id,
          seq: i + 1,
          kind: s.kind,
          payload: s.payload || {},
          status: 'queued'
        }));
        await supabase.from('ops_mission_steps').insert(steps);
        mission_id = mission.id;

        // Emit mission created event
        await supabase.from('ops_agent_events').insert({
          agent_id,
          kind: 'mission_auto_created',
          title: `Mission auto-approved: ${title}`,
          tags: ['mission', 'auto_approved'],
          metadata: { mission_id: mission.id, proposal_id: proposal.id }
        });
      }
    }

    // 7. Return result
    return {
      success: true,
      proposal_id: proposal.id,
      mission_id,
      auto_approved: shouldAutoApprove
    };

  } catch (error) {
    return {
      success: false,
      auto_approved: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
