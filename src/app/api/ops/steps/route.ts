import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const agent_id = searchParams.get('agent_id');
    const kinds = searchParams.get('kinds')?.split(',');
    
    let query = supabase.from('ops_mission_steps')
      .select('*, mission:ops_missions(id, title, created_by, priority)')
      .eq('status', 'queued').order('created_at', { ascending: true }).limit(1);
    
    if (kinds?.length) query = query.in('kind', kinds);
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (!data?.length) return NextResponse.json({ step: null, message: 'No queued steps' });
    
    const step = data[0];
    
    await supabase.from('ops_mission_steps').update({ 
      status: 'running', started_at: new Date().toISOString(), executor_agent: agent_id || 'unknown'
    }).eq('id', step.id).eq('status', 'queued');
    
    const { data: missionSteps } = await supabase.from('ops_mission_steps').select('status').eq('mission_id', step.mission_id);
    const hasRunning = missionSteps?.some(s => s.status === 'running');
    
    if (hasRunning) {
      await supabase.from('ops_missions').update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', step.mission_id).eq('status', 'approved');
    }
    
    return NextResponse.json({ step });
  } catch (error) {
    console.error('Get step error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { step_id, status, result, failure_reason } = body;
    
    if (!step_id || !status) return NextResponse.json({ error: 'step_id and status required' }, { status: 400 });
    
    const validStatuses = ['succeeded', 'failed', 'skipped'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }
    
    const updates: any = { status, completed_at: new Date().toISOString() };
    if (result) updates.result = result;
    if (failure_reason) updates.failure_reason = failure_reason;
    
    const { data: step, error } = await supabase.from('ops_mission_steps').update(updates).eq('id', step_id)
      .select('*, mission:ops_missions(id, title, created_by)').single();
    
    if (error) throw error;
    
    const { data: allSteps } = await supabase.from('ops_mission_steps').select('status').eq('mission_id', step.mission_id);
    const allDone = allSteps?.every(s => ['succeeded', 'failed', 'skipped'].includes(s.status));
    
    if (allDone) {
      const anyFailed = allSteps?.some(s => s.status === 'failed');
      const missionStatus = anyFailed ? 'failed' : 'succeeded';
      
      await supabase.from('ops_missions').update({ status: missionStatus, completed_at: new Date().toISOString() })
        .eq('id', step.mission_id);
      
      await supabase.from('ops_agent_events').insert({
        agent_id: step.mission?.created_by || 'system', kind: `mission_${missionStatus}`,
        title: `Mission ${missionStatus}: ${step.mission?.title}`,
        tags: ['mission', missionStatus], metadata: { mission_id: step.mission_id }
      });
    }
    
    await supabase.from('ops_agent_events').insert({
      agent_id: step.executor_agent || 'system', kind: `step_${status}`, title: `Step ${status}: ${step.kind}`,
      tags: ['step', step.kind, status], metadata: { step_id, mission_id: step.mission_id, result }
    });
    
    return NextResponse.json({ success: true, step, mission_completed: allDone });
  } catch (error) {
    console.error('Update step error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { step_id } = body;
    
    if (!step_id) return NextResponse.json({ error: 'step_id required' }, { status: 400 });
    
    const { data: step, error } = await supabase.from('ops_mission_steps').update({ 
      status: 'queued', started_at: null, completed_at: null, failure_reason: null, result: null
    }).eq('id', step_id).select().single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, step });
  } catch (error) {
    console.error('Retry step error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
