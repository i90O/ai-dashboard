/**
 * Voice Evolution System (Chapter 7)
 * 
 * Derives personality modifiers dynamically from agent memory.
 * Rule-driven, not LLM - deterministic, $0 cost, debuggable.
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface MemoryStats {
  lesson_count: number;
  pattern_count: number;
  insight_count: number;
  strategy_count: number;
  preference_count: number;
  total_count: number;
  tags: string[];
  top_tag: string | null;
  avg_confidence: number;
}

/**
 * Aggregate memory statistics for an agent
 */
export async function aggregateMemoryStats(
  sb: SupabaseClient,
  agentId: string
): Promise<MemoryStats> {
  const { data: memories, error } = await sb
    .from('ops_memory')
    .select('kind, tags, confidence')
    .eq('agent_id', agentId);

  if (error || !memories) {
    return {
      lesson_count: 0,
      pattern_count: 0,
      insight_count: 0,
      strategy_count: 0,
      preference_count: 0,
      total_count: 0,
      tags: [],
      top_tag: null,
      avg_confidence: 0,
    };
  }

  // Count by kind
  const counts = {
    lesson: 0,
    pattern: 0,
    insight: 0,
    strategy: 0,
    preference: 0,
  };

  const tagFrequency: Record<string, number> = {};
  let totalConfidence = 0;

  for (const mem of memories) {
    // Count kinds
    if (mem.kind in counts) {
      counts[mem.kind as keyof typeof counts]++;
    }

    // Aggregate tags
    if (mem.tags && Array.isArray(mem.tags)) {
      for (const tag of mem.tags) {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      }
    }

    // Sum confidence
    totalConfidence += mem.confidence || 0.5;
  }

  // Find top tag
  let topTag: string | null = null;
  let maxFreq = 0;
  for (const [tag, freq] of Object.entries(tagFrequency)) {
    if (freq > maxFreq) {
      maxFreq = freq;
      topTag = tag;
    }
  }

  return {
    lesson_count: counts.lesson,
    pattern_count: counts.pattern,
    insight_count: counts.insight,
    strategy_count: counts.strategy,
    preference_count: counts.preference,
    total_count: memories.length,
    tags: Object.keys(tagFrequency),
    top_tag: topTag,
    avg_confidence: memories.length > 0 ? totalConfidence / memories.length : 0,
  };
}

/**
 * Derive voice modifiers from agent's accumulated memory
 * Rule-driven: deterministic, no LLM hallucination, $0 cost
 */
export async function deriveVoiceModifiers(
  sb: SupabaseClient,
  agentId: string
): Promise<string[]> {
  const stats = await aggregateMemoryStats(sb, agentId);
  const modifiers: string[] = [];

  // Engagement expertise
  if (stats.lesson_count > 10 && stats.tags.includes('engagement')) {
    modifiers.push('Reference what works in engagement when relevant');
  }

  // Content strategy expertise
  if (stats.pattern_count > 5 && stats.top_tag === 'content') {
    modifiers.push("You've developed expertise in content strategy");
  }

  // Strategic thinking
  if (stats.strategy_count > 8) {
    modifiers.push('You think strategically about long-term plans');
  }

  // Data-driven personality
  if (stats.pattern_count > 10 && stats.tags.includes('analytics')) {
    modifiers.push('Lead with data and metrics when making points');
  }

  // Collaborative nature
  if (stats.insight_count > 15 && stats.tags.includes('teamwork')) {
    modifiers.push('Value team input and cross-agent collaboration');
  }

  // Preference-aware
  if (stats.preference_count > 5) {
    modifiers.push('Aware of established preferences - respect them');
  }

  // High confidence = assertive
  if (stats.avg_confidence > 0.8 && stats.total_count > 20) {
    modifiers.push('Speak with confidence based on proven experience');
  }

  // Lesson-rich = cautious
  if (stats.lesson_count > 15) {
    modifiers.push('Draw from past lessons when evaluating new ideas');
  }

  // Max 3 modifiers as per article spec
  return modifiers.slice(0, 3);
}

/**
 * Build complete agent prompt with voice evolution
 */
export async function buildAgentPrompt(
  sb: SupabaseClient,
  agentId: string,
  baseSystemDirective: string
): Promise<string> {
  const modifiers = await deriveVoiceModifiers(sb, agentId);
  
  let prompt = baseSystemDirective;
  
  if (modifiers.length > 0) {
    prompt += '\n\nPersonality evolution:\n';
    prompt += modifiers.map(m => `- ${m}`).join('\n');
  }
  
  return prompt;
}

// Cache for within-conversation consistency
const voiceModifierCache = new Map<string, { modifiers: string[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get voice modifiers with caching for conversation consistency
 */
export async function getCachedVoiceModifiers(
  sb: SupabaseClient,
  agentId: string
): Promise<string[]> {
  const cached = voiceModifierCache.get(agentId);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.modifiers;
  }
  
  const modifiers = await deriveVoiceModifiers(sb, agentId);
  voiceModifierCache.set(agentId, { modifiers, timestamp: now });
  
  return modifiers;
}

/**
 * Clear cache for an agent (call after memory updates)
 */
export function clearVoiceModifierCache(agentId: string): void {
  voiceModifierCache.delete(agentId);
}
