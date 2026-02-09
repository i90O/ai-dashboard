import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - list agents or get single agent with stats
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('id');
  const includeStats = searchParams.get('include_stats') === 'true';

  if (agentId) {
    const { data: agent, error } = await supabase
      .from('ops_agent_profiles')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    if (includeStats) {
      const { data: stats } = await supabase
        .from('v_agent_stats')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      const { data: initiative } = await supabase
        .from('v_initiative_status')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      return NextResponse.json({ agent, stats, initiative });
    }

    return NextResponse.json({ agent });
  }

  // List all agents with stats
  const { data: agents, error } = await supabase
    .from('ops_agent_profiles')
    .select('*')
    .eq('active', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (includeStats) {
    const { data: stats } = await supabase.from('v_agent_stats').select('*');
    const statsMap = Object.fromEntries((stats || []).map(s => [s.agent_id, s]));

    const enriched = (agents || []).map(a => ({
      ...a,
      stats: statsMap[a.id] || null
    }));

    return NextResponse.json({ agents: enriched });
  }

  return NextResponse.json({ agents });
}

// PATCH - update agent profile
export async function PATCH(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();
  const { agent_id, display_name, backstory, voice_base, active } = body;

  if (!agent_id) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (display_name !== undefined) updates.display_name = display_name;
  if (backstory !== undefined) updates.backstory = backstory;
  if (voice_base !== undefined) updates.voice_base = voice_base;
  if (active !== undefined) updates.active = active;

  const { data, error } = await supabase
    .from('ops_agent_profiles')
    .update(updates)
    .eq('id', agent_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agent: data, updated: true });
}

// POST - create new agent
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();
  const { id, display_name, backstory, voice_base } = body;

  if (!id || !display_name) {
    return NextResponse.json({ error: 'id and display_name required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ops_agent_profiles')
    .insert({
      id,
      display_name,
      backstory: backstory || '',
      voice_base: voice_base || {}
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create schedule for new agent
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const schedules = hours.map(hour => ({
    agent_id: id,
    hour,
    activity_weight: hour >= 9 && hour <= 17 ? 1.0 : hour >= 18 && hour <= 22 ? 0.7 : 0.3,
    preferred_formats: hour >= 9 && hour <= 11 ? ['standup'] : hour >= 14 && hour <= 16 ? ['brainstorm', 'debate'] : ['watercooler']
  }));

  await supabase.from('ops_agent_schedules').insert(schedules);

  // Log event
  await supabase.from('ops_agent_events').insert({
    agent_id: id,
    kind: 'agent_created',
    title: `Agent created: ${display_name}`,
    tags: ['agent', 'created']
  });

  return NextResponse.json({ agent: data, created: true });
}
