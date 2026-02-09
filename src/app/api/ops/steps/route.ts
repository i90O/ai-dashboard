import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

// GET - Atomic step claiming with FOR UPDATE SKIP LOCKED
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const worker_id = searchParams.get('worker_id') || 'unknown';
    const kinds = searchParams.get('kinds')?.split(',');
    
    // Use atomic RPC function for claiming
    const { data, error } = await supabase.rpc('claim_next_step', {
      p_worker_id: worker_id,
      p_allowed_kinds: kinds?.length ? kinds : null
    });
    
    if (error) {
      // Fallback to non-atomic if RPC doesn't exist yet
      if (error.message.includes('function') || error.message.includes('does not exist')) {
        return fallbackClaim(supabase, worker_id, kinds);
      }
      throw error;
    }
    
    if (!data?.length) {
      return NextResponse.json({ step: null, message: 'No queued steps' });
    }
    
    const claimed = data[0];
    
    // Update mission status if needed
    const { data: missionSteps } = await supabase
      .from('ops_mission_steps')
      .select('status')
      .eq('mission_id', claimed.mission_id);
      
    const hasRunning = missionSteps?.some(s => s.status === 'running');
    if (hasRunning) {
      await supabase.from('ops_missions')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', claimed.mission_id)
        .eq('status', 'approved');
    }
    
    // Return in expected format
    return NextResponse.json({ 
      step: {
        id: claimed.step_id,
        mission_id: claimed.mission_id,
        kind: claimed.kind,
        payload: claimed.payload,
        mission: {
          id: claimed.mission_id,
          title: claimed.mission_title,
          priority: claimed.priority
        }
      },
      atomic: true 
    });
  } catch (error) {
    console.error('Get step error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Fallback for when RPC doesn't exist (will be removed after migration)
async function fallbackClaim(supabase: any, workerId: string, kinds?: string[]) {
  let query = supabase.from('ops_mission_steps')
    .select('*, mission:ops_missions(id, title, created_by, priority)')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);
  
  if (kinds?.length) query = query.in('kind', kinds);
  
  const { data, error } = await query;
  if (error) throw error;
  
  if (!data?.length) {
    return NextResponse.json({ step: null, message: 'No queued steps' });
  }
  
  const step = data[0];
  
  // Non-atomic update (race condition possible)
  const { error: updateError } = await supabase
    .from('ops_mission_steps')
    .update({ 
      status: 'running', 
      started_at: new Date().toISOString(), 
      worker_id: workerId 
    })
    .eq('id', step.id)
    .eq('status', 'queued'); // Only update if still queued
  
  if (updateError) throw updateError;
  
  return NextResponse.json({ step, atomic: false });
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { step_id, status, result, failure_reason } = body;
    
    if (!step_id || !status) {
      return NextResponse.json({ error: 'step_id and status required' }, { status: 400 });
    }
    
    const validStatuses = ['succeeded', 'failed', 'skipped'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }
    
    const updates: Record<string, any> = { 
      status, 
      completed_at: new Date().toISOString() 
    };
    if (result) updates.result = result;
    if (failure_reason) updates.failure_reason = failure_reason;
    
    const { data: step, error } = await supabase
      .from('ops_mission_steps')
      .update(updates)
      .eq('id', step_id)
      .select('*, mission:ops_missions(id, title, created_by)')
      .single();
    
    if (error) throw error;
    
    // Check if all steps done
    const { data: allSteps } = await supabase
      .from('ops_mission_steps')
      .select('status')
      .eq('mission_id', step.mission_id);
      
    const allDone = allSteps?.every(s => ['succeeded', 'failed', 'skipped'].includes(s.status));
    
    if (allDone) {
      const anyFailed = allSteps?.some(s => s.status === 'failed');
      const missionStatus = anyFailed ? 'failed' : 'succeeded';
      
      await supabase.from('ops_missions')
        .update({ status: missionStatus, completed_at: new Date().toISOString() })
        .eq('id', step.mission_id);
      
      await supabase.from('ops_agent_events').insert({
        agent_id: step.mission?.created_by || 'system',
        kind: `mission_${missionStatus}`,
        title: `Mission ${missionStatus}: ${step.mission?.title}`,
        tags: ['mission', missionStatus],
        metadata: { mission_id: step.mission_id }
      });
    }
    
    // Log step event
    await supabase.from('ops_agent_events').insert({
      agent_id: step.executor_agent || 'system',
      kind: `step_${status}`,
      title: `Step ${status}: ${step.kind}`,
      tags: ['step', step.kind, status],
      metadata: { step_id, mission_id: step.mission_id, result }
    });
    
    return NextResponse.json({ success: true, step, mission_completed: allDone });
  } catch (error) {
    console.error('Update step error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST - Retry a failed step
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { step_id } = body;
    
    if (!step_id) {
      return NextResponse.json({ error: 'step_id required' }, { status: 400 });
    }
    
    const { data: step, error } = await supabase
      .from('ops_mission_steps')
      .update({ 
        status: 'queued', 
        started_at: null, 
        completed_at: null, 
        failure_reason: null, 
        result: null,
        worker_id: null
      })
      .eq('id', step_id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, step });
  } catch (error) {
    console.error('Retry step error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
