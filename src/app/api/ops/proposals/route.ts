import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

async function checkCapGates(stepKinds: string[]): Promise<{ ok: boolean; reason?: string }> {
  const supabase = getSupabase();
  
  if (stepKinds.includes('post_tweet')) {
    const policy = await supabase.from('ops_policy').select('value').eq('key', 'x_daily_quota').single();
    if (policy.data) {
      const limit = policy.data.value.limit || 8;
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('ops_agent_events').select('*', { count: 'exact', head: true })
        .eq('kind', 'tweet_posted').gte('created_at', today);
      if ((count || 0) >= limit) return { ok: false, reason: `Tweet quota full (${count}/${limit})` };
    }
  }
  
  if (stepKinds.includes('write_content')) {
    const policy = await supabase.from('ops_policy').select('value').eq('key', 'content_policy').single();
    if (policy.data?.value?.enabled) {
      const limit = policy.data.value.max_drafts_per_day || 10;
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('ops_mission_steps').select('*', { count: 'exact', head: true })
        .eq('kind', 'write_content').gte('created_at', today);
      if ((count || 0) >= limit) return { ok: false, reason: `Content quota full (${count}/${limit})` };
    }
  }
  
  return { ok: true };
}

async function shouldAutoApprove(stepKinds: string[]): Promise<boolean> {
  const supabase = getSupabase();
  const policy = await supabase.from('ops_policy').select('value').eq('key', 'auto_approve').single();
  if (!policy.data?.value?.enabled) return false;
  const allowed = policy.data.value.allowed_step_kinds || [];
  return stepKinds.every(kind => allowed.includes(kind));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { agent_id, title, description, proposed_steps, source, source_trace_id } = body;
    
    if (!agent_id || !title) return NextResponse.json({ error: 'agent_id and title required' }, { status: 400 });
    
    if (source_trace_id) {
      const existing = await supabase.from('ops_mission_proposals').select('id').eq('source_trace_id', source_trace_id).single();
      if (existing.data) return NextResponse.json({ success: true, proposal_id: existing.data.id, message: 'Already exists' });
    }
    
    const stepKinds = (proposed_steps || []).map((s: any) => s.kind);
    const gateResult = await checkCapGates(stepKinds);
    
    if (!gateResult.ok) {
      const { data: rejected } = await supabase.from('ops_mission_proposals').insert({
        agent_id, title, description, proposed_steps, source: source || 'human', source_trace_id,
        status: 'rejected', rejection_reason: gateResult.reason, reviewed_at: new Date().toISOString()
      }).select().single();
      return NextResponse.json({ success: false, rejected: true, reason: gateResult.reason, proposal_id: rejected?.id });
    }
    
    const { data: proposal, error } = await supabase.from('ops_mission_proposals').insert({
      agent_id, title, description, proposed_steps, source: source || 'human', source_trace_id, status: 'pending'
    }).select().single();
    
    if (error) throw error;
    
    const autoApprove = await shouldAutoApprove(stepKinds);
    
    if (autoApprove) {
      const { data: mission } = await supabase.from('ops_missions').insert({
        title, description, created_by: agent_id, proposal_id: proposal.id, status: 'approved'
      }).select().single();
      
      if (mission && proposed_steps?.length) {
        const steps = proposed_steps.map((s: any) => ({
          mission_id: mission.id, kind: s.kind, payload: s.payload || {}, status: 'queued'
        }));
        await supabase.from('ops_mission_steps').insert(steps);
      }
      
      await supabase.from('ops_mission_proposals').update({ status: 'accepted', reviewed_at: new Date().toISOString() }).eq('id', proposal.id);
      await supabase.from('ops_agent_events').insert({
        agent_id, kind: 'proposal_auto_approved', title: `Auto-approved: ${title}`,
        summary: `Mission created with ${proposed_steps?.length || 0} steps`,
        tags: ['proposal', 'auto-approved'], metadata: { proposal_id: proposal.id, mission_id: mission?.id }
      });
      
      return NextResponse.json({ success: true, proposal_id: proposal.id, mission_id: mission?.id, auto_approved: true });
    }
    
    await supabase.from('ops_agent_events').insert({
      agent_id, kind: 'proposal_submitted', title: `Proposal: ${title}`,
      summary: description || `${proposed_steps?.length || 0} steps proposed`,
      tags: ['proposal', 'pending'], metadata: { proposal_id: proposal.id }
    });
    
    return NextResponse.json({ success: true, proposal_id: proposal.id, auto_approved: false });
  } catch (error) {
    console.error('Proposal error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const agent_id = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    let query = supabase.from('ops_mission_proposals').select('*').order('created_at', { ascending: false }).limit(limit);
    if (status) query = query.eq('status', status);
    if (agent_id) query = query.eq('agent_id', agent_id);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ proposals: data });
  } catch (error) {
    console.error('List proposals error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { proposal_id, action, reason } = body;
    
    if (!proposal_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'proposal_id and action (approve/reject) required' }, { status: 400 });
    }
    
    const { data: proposal } = await supabase.from('ops_mission_proposals').select('*').eq('id', proposal_id).single();
    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    if (proposal.status !== 'pending') return NextResponse.json({ error: 'Proposal already processed' }, { status: 400 });
    
    if (action === 'reject') {
      await supabase.from('ops_mission_proposals').update({ 
        status: 'rejected', rejection_reason: reason || 'Manually rejected', reviewed_at: new Date().toISOString()
      }).eq('id', proposal_id);
      return NextResponse.json({ success: true, status: 'rejected' });
    }
    
    const { data: mission } = await supabase.from('ops_missions').insert({
      title: proposal.title, description: proposal.description, created_by: proposal.agent_id, proposal_id: proposal.id, status: 'approved'
    }).select().single();
    
    if (mission && proposal.proposed_steps?.length) {
      const steps = proposal.proposed_steps.map((s: any) => ({
        mission_id: mission.id, kind: s.kind, payload: s.payload || {}, status: 'queued'
      }));
      await supabase.from('ops_mission_steps').insert(steps);
    }
    
    await supabase.from('ops_mission_proposals').update({ status: 'accepted', reviewed_at: new Date().toISOString() }).eq('id', proposal_id);
    await supabase.from('ops_agent_events').insert({
      agent_id: proposal.agent_id, kind: 'proposal_approved', title: `Approved: ${proposal.title}`,
      tags: ['proposal', 'approved'], metadata: { proposal_id, mission_id: mission?.id }
    });
    
    return NextResponse.json({ success: true, status: 'approved', mission_id: mission?.id });
  } catch (error) {
    console.error('Patch proposal error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
