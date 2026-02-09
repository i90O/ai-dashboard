import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

const MAX_MEMORIES_PER_AGENT = 200;
const MIN_CONFIDENCE = 0.55;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { agent_id, type, content, confidence, tags, source_trace_id } = body;
    
    if (!agent_id || !type || !content) {
      return NextResponse.json({ error: 'agent_id, type, and content required' }, { status: 400 });
    }
    
    const validTypes = ['insight', 'pattern', 'strategy', 'preference', 'lesson'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }
    
    const actualConfidence = confidence || 0.6;
    if (actualConfidence < MIN_CONFIDENCE) {
      return NextResponse.json({ success: false, skipped: true, reason: `Confidence ${actualConfidence} below minimum ${MIN_CONFIDENCE}` });
    }
    
    if (source_trace_id) {
      const { data: existing } = await supabase.from('ops_agent_memory').select('id').eq('source_trace_id', source_trace_id).single();
      if (existing) return NextResponse.json({ success: true, memory_id: existing.id, message: 'Already exists' });
    }
    
    const { count } = await supabase.from('ops_agent_memory').select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id).is('superseded_by', null);
    
    if ((count || 0) >= MAX_MEMORIES_PER_AGENT) {
      const toRemove = (count || 0) - MAX_MEMORIES_PER_AGENT + 1;
      const { data: oldest } = await supabase.from('ops_agent_memory').select('id').eq('agent_id', agent_id)
        .is('superseded_by', null).order('created_at', { ascending: true }).limit(toRemove);
      if (oldest?.length) {
        await supabase.from('ops_agent_memory').update({ superseded_by: '00000000-0000-0000-0000-000000000000' })
          .in('id', oldest.map(m => m.id));
      }
    }
    
    const { data: memory, error } = await supabase.from('ops_agent_memory').insert({
      agent_id, type, content, confidence: actualConfidence, tags: tags || [], source_trace_id
    }).select().single();
    
    if (error) throw error;
    
    await supabase.from('ops_agent_events').insert({
      agent_id, kind: 'memory_created', title: `New ${type}: ${content.substring(0, 50)}...`,
      tags: ['memory', type, ...(tags || [])], metadata: { memory_id: memory.id, confidence: actualConfidence }
    });
    
    return NextResponse.json({ success: true, memory_id: memory.id });
  } catch (error) {
    console.error('Create memory error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const agent_id = searchParams.get('agent_id');
    const types = searchParams.get('types')?.split(',');
    const minConfidence = parseFloat(searchParams.get('min_confidence') || '0.6');
    const limit = parseInt(searchParams.get('limit') || '10');
    const tag = searchParams.get('tag');
    
    if (!agent_id) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
    
    let query = supabase.from('ops_agent_memory').select('id, type, content, confidence, tags, created_at')
      .eq('agent_id', agent_id).is('superseded_by', null).gte('confidence', minConfidence)
      .order('confidence', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
    
    if (types?.length) query = query.in('type', types);
    if (tag) query = query.contains('tags', [tag]);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ memories: data });
  } catch (error) {
    console.error('Query memory error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const memory_id = searchParams.get('id');
    const replaced_by = searchParams.get('replaced_by');
    
    if (!memory_id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    
    await supabase.from('ops_agent_memory').update({ superseded_by: replaced_by || '00000000-0000-0000-0000-000000000000' }).eq('id', memory_id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete memory error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
