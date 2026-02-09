import { NextRequest, NextResponse } from 'next/server';
import { supabase, MC_TOKEN } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bots: data || [] });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (token !== MC_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { botId, status = 'online' } = body;

  if (!botId) {
    return NextResponse.json({ error: 'Missing botId' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('bots')
    .update({ status, last_seen: new Date().toISOString() })
    .eq('id', botId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bot: data });
}
