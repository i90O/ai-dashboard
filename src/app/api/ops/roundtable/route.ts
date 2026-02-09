import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - list conversations or get single
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (id) {
    const { data, error } = await supabase
      .from('ops_roundtable_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ conversation: data });
  }

  let query = supabase
    .from('ops_roundtable_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversations: data });
}

// POST - schedule a new conversation
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();

  const { format, topic, participants } = body;

  if (!format || !topic || !participants?.length) {
    return NextResponse.json(
      { error: 'format, topic, and participants required' },
      { status: 400 }
    );
  }

  // Get format config
  const { data: formatConfig } = await supabase
    .from('ops_conversation_formats')
    .select('*')
    .eq('format', format)
    .single();

  if (formatConfig) {
    if (participants.length < formatConfig.min_agents) {
      return NextResponse.json(
        { error: `${format} requires at least ${formatConfig.min_agents} participants` },
        { status: 400 }
      );
    }
    if (participants.length > formatConfig.max_agents) {
      return NextResponse.json(
        { error: `${format} allows max ${formatConfig.max_agents} participants` },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from('ops_roundtable_queue')
    .insert({
      format,
      topic,
      participants,
      status: 'pending'
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log event
  await supabase.from('ops_agent_events').insert({
    agent_id: 'system',
    kind: 'conversation_scheduled',
    title: `${format} scheduled: ${topic}`,
    tags: ['conversation', format],
    metadata: { conversation_id: data.id, participants }
  });

  return NextResponse.json({ conversation: data, created: true });
}

// PATCH - update conversation status
export async function PATCH(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();

  const { id, status, history, memories_extracted, action_items } = body;

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    if (status === 'running') {
      updates.started_at = new Date().toISOString();
    }
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
  }
  if (history) updates.history = history;
  if (memories_extracted) updates.memories_extracted = memories_extracted;
  if (action_items) updates.action_items = action_items;

  const { data, error } = await supabase
    .from('ops_roundtable_queue')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation: data, updated: true });
}
