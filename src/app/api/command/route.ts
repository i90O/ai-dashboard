import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MC_TOKEN = process.env.MC_TOKEN || 'xiaobei-mc-2026';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// POST: Queue a command for a bot
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (token !== MC_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { botId, message, sessionKey } = body;

  if (!botId || !message) {
    return NextResponse.json({ error: 'Missing botId or message' }, { status: 400 });
  }

  // Queue the command
  const { data, error } = await supabase
    .from('commands')
    .insert({
      bot_id: botId,
      message,
      session_key: sessionKey || 'main',
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to queue command:', error);
    return NextResponse.json({ error: 'Failed to queue command' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, commandId: data.id, status: 'queued' });
}

// GET: Fetch pending commands for a bot (bot polls this)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (token !== MC_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');

  if (!botId) {
    return NextResponse.json({ error: 'Missing botId' }, { status: 400 });
  }

  // Get pending commands for this bot
  const { data: commands, error } = await supabase
    .from('commands')
    .select('*')
    .eq('bot_id', botId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('Failed to fetch commands:', error);
    return NextResponse.json({ error: 'Failed to fetch commands' }, { status: 500 });
  }

  return NextResponse.json({ commands: commands || [] });
}

// PATCH: Update command status (bot reports back)
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (token !== MC_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { commandId, status, result } = body;

  if (!commandId || !status) {
    return NextResponse.json({ error: 'Missing commandId or status' }, { status: 400 });
  }

  const { error } = await supabase
    .from('commands')
    .update({
      status,
      result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', commandId);

  if (error) {
    console.error('Failed to update command:', error);
    return NextResponse.json({ error: 'Failed to update command' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
// Build trigger 1770661876
