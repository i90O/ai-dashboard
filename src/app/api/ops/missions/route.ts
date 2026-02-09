import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const agent_id = searchParams.get('agent_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeSteps = searchParams.get('include_steps') !== 'false';
    
    let query = supabase.from('ops_missions')
      .select(includeSteps ? '*, steps:ops_mission_steps(*)' : '*')
      .order('created_at', { ascending: false }).limit(limit);
    
    if (status) {
      if (status === 'active') query = query.in('status', ['approved', 'running']);
      else query = query.eq('status', status);
    }
    if (agent_id) query = query.eq('created_by', agent_id);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ missions: data });
  } catch (error) {
    console.error('List missions error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { mission_id, status, failure_reason } = body;
    
    if (!mission_id || !status) return NextResponse.json({ error: 'mission_id and status required' }, { status: 400 });
    
    const validStatuses = ['approved', 'running', 'succeeded', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }
    
    const updates: any = { status };
    if (status === 'running') updates.started_at = new Date().toISOString();
    else if (['succeeded', 'failed', 'cancelled'].includes(status)) {
      updates.completed_at = new Date().toISOString();
      if (failure_reason) updates.failure_reason = failure_reason;
    }
    
    const { data: mission, error } = await supabase.from('ops_missions').update(updates).eq('id', mission_id).select().single();
    if (error) throw error;
    
    await supabase.from('ops_agent_events').insert({
      agent_id: mission.created_by, kind: `mission_${status}`, title: `Mission ${status}: ${mission.title}`,
      tags: ['mission', status], metadata: { mission_id }
    });
    
    return NextResponse.json({ success: true, mission });
  } catch (error) {
    console.error('Update mission error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
