import { getSupabase } from '@/lib/supabase';
import { createProposalAndMaybeAutoApprove } from '@/lib/proposal-service';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET - List proposals
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const agentId = searchParams.get('agent_id');

    let query = supabase.from('ops_mission_proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (status) query = query.eq('status', status);
    if (agentId) query = query.eq('agent_id', agentId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ proposals: data });
  } catch (error) {
    console.error('Get proposals error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST - Create proposal (uses shared service)
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { agent_id, title, description, proposed_steps, source, source_trace_id } = body;

    if (!agent_id || !title) {
      return NextResponse.json({ error: 'agent_id and title required' }, { status: 400 });
    }

    // Check for duplicate
    if (source_trace_id) {
      const existing = await supabase
        .from('ops_mission_proposals')
        .select('id')
        .eq('source_trace_id', source_trace_id)
        .single();
      
      if (existing.data) {
        return NextResponse.json({ 
          success: true, 
          proposal_id: existing.data.id, 
          message: 'Already exists' 
        });
      }
    }

    // Use shared proposal service (single entry point for all proposal creation)
    const result = await createProposalAndMaybeAutoApprove(supabase, {
      agent_id,
      title,
      description,
      proposed_steps: proposed_steps || [],
      source: source || 'human',
      source_trace_id
    });

    if (!result.success) {
      if (result.rejected) {
        return NextResponse.json({ 
          success: false, 
          rejected: true, 
          reason: result.rejection_reason,
          proposal_id: result.proposal_id
        });
      }
      throw new Error(result.error || 'Failed to create proposal');
    }

    return NextResponse.json({
      success: true,
      proposal_id: result.proposal_id,
      mission_id: result.mission_id,
      auto_approved: result.auto_approved
    });

  } catch (error) {
    console.error('Create proposal error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH - Approve/reject proposal
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { proposal_id, action } = body;

    if (!proposal_id || !action) {
      return NextResponse.json({ error: 'proposal_id and action required' }, { status: 400 });
    }

    // Get proposal
    const { data: proposal, error: fetchError } = await supabase
      .from('ops_mission_proposals')
      .select('*')
      .eq('id', proposal_id)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.status !== 'pending') {
      return NextResponse.json({ error: 'Proposal already processed' }, { status: 400 });
    }

    if (action === 'approve') {
      // Create mission
      const { data: mission } = await supabase.from('ops_missions').insert({
        title: proposal.title,
        description: proposal.description,
        created_by: proposal.agent_id,
        proposal_id: proposal.id,
        status: 'approved'
      }).select().single();

      // Create steps
      if (mission && proposal.proposed_steps?.length) {
        const steps = proposal.proposed_steps.map((s: any, i: number) => ({
          mission_id: mission.id,
          seq: i + 1,
          kind: s.kind,
          payload: s.payload || {},
          status: 'queued'
        }));
        await supabase.from('ops_mission_steps').insert(steps);
      }

      // Update proposal
      await supabase.from('ops_mission_proposals')
        .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
        .eq('id', proposal_id);

      // Log event
      await supabase.from('ops_agent_events').insert({
        agent_id: proposal.agent_id,
        kind: 'proposal_approved',
        title: `Approved: ${proposal.title}`,
        tags: ['proposal', 'approved'],
        metadata: { proposal_id, mission_id: mission?.id }
      });

      return NextResponse.json({ 
        success: true, 
        mission_id: mission?.id,
        status: 'approved'
      });

    } else if (action === 'reject') {
      const { rejection_reason } = body;

      await supabase.from('ops_mission_proposals')
        .update({ 
          status: 'rejected', 
          rejection_reason,
          reviewed_at: new Date().toISOString() 
        })
        .eq('id', proposal_id);

      await supabase.from('ops_agent_events').insert({
        agent_id: proposal.agent_id,
        kind: 'proposal_rejected',
        title: `Rejected: ${proposal.title}`,
        tags: ['proposal', 'rejected'],
        metadata: { proposal_id, reason: rejection_reason }
      });

      return NextResponse.json({ success: true, status: 'rejected' });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Update proposal error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
