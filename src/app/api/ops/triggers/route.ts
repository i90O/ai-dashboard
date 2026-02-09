import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - list trigger rules
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const event = searchParams.get('event');
  const enabled = searchParams.get('enabled');

  let query = supabase
    .from('ops_trigger_rules')
    .select('*')
    .order('created_at', { ascending: false });

  if (event) query = query.eq('trigger_event', event);
  if (enabled !== null) query = query.eq('enabled', enabled === 'true');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ triggers: data });
}

// POST - create a new trigger rule
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();
  const { name, trigger_event, conditions, action_config, cooldown_minutes } = body;

  if (!name || !trigger_event) {
    return NextResponse.json(
      { error: 'name and trigger_event required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('ops_trigger_rules')
    .insert({
      name,
      trigger_event,
      conditions: conditions || {},
      action_config: action_config || {},
      cooldown_minutes: cooldown_minutes || 60
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trigger: data, created: true });
}

// PATCH - update trigger (enable/disable/update)
export async function PATCH(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();
  const { trigger_id, enabled, conditions, action_config, cooldown_minutes } = body;

  if (!trigger_id) {
    return NextResponse.json({ error: 'trigger_id required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (enabled !== undefined) updates.enabled = enabled;
  if (conditions !== undefined) updates.conditions = conditions;
  if (action_config !== undefined) updates.action_config = action_config;
  if (cooldown_minutes !== undefined) updates.cooldown_minutes = cooldown_minutes;

  const { data, error } = await supabase
    .from('ops_trigger_rules')
    .update(updates)
    .eq('id', trigger_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trigger: data, updated: true });
}

// DELETE - delete trigger rule
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const triggerId = searchParams.get('trigger_id');

  if (!triggerId) {
    return NextResponse.json({ error: 'trigger_id required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('ops_trigger_rules')
    .delete()
    .eq('id', triggerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
