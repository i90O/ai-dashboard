import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - list relationships or get between two agents
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const agentA = searchParams.get('agent_a');
  const agentB = searchParams.get('agent_b');

  if (agentA && agentB) {
    // Get specific relationship (order alphabetically)
    const [a, b] = [agentA, agentB].sort();
    const { data, error } = await supabase
      .from('ops_agent_relationships')
      .select('*')
      .eq('agent_a', a)
      .eq('agent_b', b)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ relationship: data });
  }

  // Get all relationships with agent names
  const { data, error } = await supabase
    .from('v_relationship_map')
    .select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ relationships: data });
}

// POST - manually adjust affinity
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();
  const { agent_a, agent_b, drift, reason } = body;

  if (!agent_a || !agent_b || drift === undefined) {
    return NextResponse.json(
      { error: 'agent_a, agent_b, and drift required' },
      { status: 400 }
    );
  }

  // Call the database function
  const { data, error } = await supabase.rpc('apply_affinity_drift', {
    p_agent_a: agent_a,
    p_agent_b: agent_b,
    p_drift: drift,
    p_reason: reason || 'manual_adjustment',
    p_source_id: null
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ new_affinity: data, applied: true });
}
