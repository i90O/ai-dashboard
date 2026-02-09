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

/**
 * Single entry point for all proposal creation.
 * All paths (API, triggers, reactions) must use this function.
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
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('ops_mission_proposals')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agent_id)
        .gte('created_at', today);
      
      if ((count || 0) >= limitPolicy.value.max_per_agent_per_day) {
        return {
          success: false,
          auto_approved: false,
          rejected: true,
          rejection_reason: `Daily proposal limit reached (${count}/${limitPolicy.value.max_per_agent_per_day})`
        };
      }
    }

    // 2. Check Cap Gates (tweet quota, content quota, etc.)
    const gateResult = await checkCapGates(supabase, stepKinds);
    if (!gateResult.ok) {
      // Insert as rejected
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

/**
 * Check cap gates for step kinds (tweet quota, content quota, etc.)
 */
async function checkCapGates(
  supabase: SupabaseClient,
  stepKinds: string[]
): Promise<{ ok: boolean; reason?: string }> {
  
  // Tweet quota
  if (stepKinds.includes('post_tweet') || stepKinds.includes('draft_tweet')) {
    const { data: policy } = await supabase
      .from('ops_policy')
      .select('value')
      .eq('key', 'x_daily_quota')
      .single();
    
    if (policy?.value) {
      const limit = policy.value.limit || 8;
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('ops_agent_events')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'tweet_posted')
        .gte('created_at', today);
      
      if ((count || 0) >= limit) {
        return { ok: false, reason: `Tweet quota full (${count}/${limit})` };
      }
    }
  }

  // Content quota
  if (stepKinds.includes('write_content')) {
    const { data: policy } = await supabase
      .from('ops_policy')
      .select('value')
      .eq('key', 'content_policy')
      .single();
    
    if (policy?.value?.max_drafts_per_day) {
      const limit = policy.value.max_drafts_per_day;
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('ops_mission_steps')
        .select('*', { count: 'exact', head: true })
        .eq('kind', 'write_content')
        .gte('created_at', today);
      
      if ((count || 0) >= limit) {
        return { ok: false, reason: `Content quota full (${count}/${limit})` };
      }
    }
  }

  return { ok: true };
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
