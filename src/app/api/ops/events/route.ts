import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { agent_id, kind, title, summary, tags, metadata } = body;
    
    if (!agent_id || !kind || !title) {
      return NextResponse.json({ error: 'agent_id, kind, and title required' }, { status: 400 });
    }
    
    const { data: event, error } = await supabase.from('ops_agent_events').insert({
      agent_id, kind, title, summary, tags: tags || [], metadata: metadata || {}
    }).select().single();
    
    if (error) throw error;
    
    // Check reaction matrix
    const { data: policy } = await supabase.from('ops_policy').select('value').eq('key', 'reaction_matrix').single();
    
    if (policy?.value?.patterns) {
      for (const pattern of policy.value.patterns) {
        const sourceMatch = pattern.source === '*' || pattern.source === agent_id;
        const tagsMatch = pattern.tags.some((t: string) => tags?.includes(t));
        
        if (sourceMatch && tagsMatch) {
          if (Math.random() > pattern.probability) continue;
          
          if (pattern.cooldown) {
            const cooldownTime = new Date(Date.now() - pattern.cooldown * 60 * 1000);
            const { count } = await supabase.from('ops_agent_reactions').select('*', { count: 'exact', head: true })
              .eq('target_agent', pattern.target).eq('reaction_type', pattern.type).gte('created_at', cooldownTime.toISOString());
            if ((count || 0) > 0) continue;
          }
          
          await supabase.from('ops_agent_reactions').insert({
            source_event_id: event.id, target_agent: pattern.target, reaction_type: pattern.type,
            metadata: { source_agent: agent_id, event_title: title }
          });
        }
      }
    }
    
    return NextResponse.json({ success: true, event_id: event.id });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const agent_id = searchParams.get('agent_id');
    const kind = searchParams.get('kind');
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') || '50');
    const since = searchParams.get('since');
    
    let query = supabase.from('ops_agent_events').select(`*, bots:agent_id (name, color)`)
      .order('created_at', { ascending: false }).limit(limit);
    
    if (agent_id) query = query.eq('agent_id', agent_id);
    if (kind) query = query.eq('kind', kind);
    if (tag) query = query.contains('tags', [tag]);
    if (since) query = query.gte('created_at', since);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json({ events: data });
  } catch (error) {
    console.error('List events error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
