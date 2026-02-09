import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - get agent voice config or modifiers
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agent_id');
  const contextId = searchParams.get('context_id');

  if (!agentId) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }

  // Check cache first
  if (contextId) {
    const { data: cached } = await supabase
      .from('ops_voice_cache')
      .select('compiled_voice')
      .eq('agent_id', agentId)
      .eq('context_id', contextId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      return NextResponse.json({ voice: cached.compiled_voice, cached: true });
    }
  }

  // Get base voice from profile
  const { data: profile } = await supabase
    .from('ops_agent_profiles')
    .select('voice_base, backstory')
    .eq('id', agentId)
    .single();

  // Get active modifiers
  const { data: modifiers } = await supabase
    .from('ops_voice_modifiers')
    .select('*')
    .eq('agent_id', agentId)
    .eq('active', true)
    .order('confidence', { ascending: false });

  // Compile voice config
  const voice = {
    base: profile?.voice_base || {},
    backstory: profile?.backstory,
    modifiers: modifiers || [],
    compiled_prompt_additions: compileModifiers(modifiers || [])
  };

  // Cache if context provided
  if (contextId) {
    await supabase.from('ops_voice_cache').upsert({
      agent_id: agentId,
      context_id: contextId,
      compiled_voice: voice,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
    });
  }

  return NextResponse.json({ voice, cached: false });
}

// POST - derive voice modifiers from memories (rule-based)
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();
  const { agent_id } = body;

  if (!agent_id) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }

  // Get all rules
  const { data: rules } = await supabase
    .from('ops_voice_rules')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: false });

  // Get agent memories
  const { data: memories } = await supabase
    .from('ops_agent_memory')
    .select('*')
    .eq('agent_id', agent_id)
    .is('superseded_by', null);

  const newModifiers: Array<{
    agent_id: string;
    modifier_type: string;
    value: Record<string, unknown>;
    source_memories: string[];
    confidence: number;
  }> = [];

  // Apply each rule
  for (const rule of rules || []) {
    const pattern = rule.memory_pattern as Record<string, unknown>;
    
    // Find matching memories
    const matching = (memories || []).filter(m => {
      if (pattern.type && m.type !== pattern.type) return false;
      if (pattern.tags_contain) {
        const tags = m.tags || [];
        if (!tags.includes(pattern.tags_contain as string)) return false;
      }
      if (pattern.confidence_below && m.confidence >= (pattern.confidence_below as number)) return false;
      return true;
    });

    // Check minimum count
    const minCount = (pattern.min_count as number) || 1;
    if (matching.length >= minCount) {
      const effect = rule.modifier_effect as Record<string, unknown>;
      newModifiers.push({
        agent_id,
        modifier_type: effect.modifier_type as string,
        value: effect,
        source_memories: matching.slice(0, 5).map(m => m.id),
        confidence: Math.min(0.9, 0.5 + matching.length * 0.1)
      });
    }
  }

  // Upsert modifiers (deactivate old, insert new)
  if (newModifiers.length > 0) {
    // Deactivate existing
    await supabase
      .from('ops_voice_modifiers')
      .update({ active: false })
      .eq('agent_id', agent_id);

    // Insert new
    const { error } = await supabase
      .from('ops_voice_modifiers')
      .insert(newModifiers);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Clear cache
    await supabase
      .from('ops_voice_cache')
      .delete()
      .eq('agent_id', agent_id);
  }

  // Log event
  await supabase.from('ops_agent_events').insert({
    agent_id,
    kind: 'voice_evolved',
    title: `Voice evolved: ${newModifiers.length} modifiers`,
    tags: ['voice', 'evolution'],
    metadata: { modifiers_count: newModifiers.length }
  });

  return NextResponse.json({
    modifiers_created: newModifiers.length,
    modifiers: newModifiers
  });
}

// Helper to compile modifiers into prompt additions
function compileModifiers(modifiers: Array<{ modifier_type: string; value: Record<string, unknown> }>): string {
  const additions: string[] = [];

  for (const mod of modifiers) {
    const value = mod.value;
    switch (mod.modifier_type) {
      case 'vocabulary':
        if (value.add_keywords) {
          additions.push(`Use terminology like: ${(value.add_keywords as string[]).join(', ')}`);
        }
        break;
      case 'tone':
        if (value.shift === 'warmer') {
          additions.push('Be slightly warmer and more empathetic in responses.');
        } else if (value.shift === 'analytical') {
          additions.push('Be more precise and data-driven.');
        }
        break;
      case 'formality':
        if (value.shift === 'more_formal') {
          additions.push('Use more formal language and hedging.');
        }
        break;
      case 'emoji_usage':
        additions.push(`Emoji usage level: ${value.level || 'moderate'}`);
        break;
    }
  }

  return additions.join(' ');
}
