import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - check initiative status or list queue
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agent_id');
  const status = searchParams.get('status');

  if (agentId && searchParams.get('check') === 'true') {
    // Check if agent can submit initiative
    const { data, error } = await supabase.rpc('can_agent_submit_initiative', {
      p_agent_id: agentId
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ initiative_status: data?.[0] });
  }

  // Get initiative status view
  if (searchParams.get('view') === 'status') {
    const { data, error } = await supabase
      .from('v_initiative_status')
      .select('*');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ agents: data });
  }

  // List queue items
  let query = supabase
    .from('ops_initiative_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (agentId) query = query.eq('agent_id', agentId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ initiatives: data });
}

// POST - queue an initiative request
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();
  const { agent_id, trigger_reason, context } = body;

  if (!agent_id) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }

  // Check if agent can submit
  const { data: checkData, error: checkError } = await supabase.rpc('can_agent_submit_initiative', {
    p_agent_id: agent_id
  });

  if (checkError) return NextResponse.json({ error: checkError.message }, { status: 500 });

  const check = checkData?.[0];
  if (!check?.can_submit) {
    return NextResponse.json(
      { error: check?.reason || 'Cannot submit initiative', blocked: true },
      { status: 403 }
    );
  }

  // Queue the initiative
  const { data, error } = await supabase
    .from('ops_initiative_queue')
    .insert({
      agent_id,
      trigger_reason: trigger_reason || 'manual',
      context: context || {},
      status: 'pending'
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log event
  await supabase.from('ops_agent_events').insert({
    agent_id,
    kind: 'initiative_queued',
    title: `Initiative queued: ${trigger_reason || 'manual'}`,
    tags: ['initiative', trigger_reason || 'manual'],
    metadata: { initiative_id: data.id }
  });

  return NextResponse.json({ initiative: data, queued: true });
}
