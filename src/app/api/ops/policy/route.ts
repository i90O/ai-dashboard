import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    
    if (key) {
      const { data, error } = await supabase.from('ops_policy').select('*').eq('key', key).single();
      if (error) throw error;
      return NextResponse.json({ policy: data });
    }
    
    const { data, error } = await supabase.from('ops_policy').select('*').order('key');
    if (error) throw error;
    
    return NextResponse.json({ policies: data });
  } catch (error) {
    console.error('Get policy error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { key, value, description } = body;
    
    if (!key || value === undefined) return NextResponse.json({ error: 'key and value required' }, { status: 400 });
    
    const updates: any = { value };
    if (description) updates.description = description;
    
    const { data, error } = await supabase.from('ops_policy').upsert({ key, ...updates }).select().single();
    if (error) throw error;
    
    await supabase.from('ops_agent_events').insert({
      agent_id: 'system', kind: 'policy_updated', title: `Policy updated: ${key}`,
      tags: ['policy', 'config'], metadata: { key, value }
    });
    
    return NextResponse.json({ success: true, policy: data });
  } catch (error) {
    console.error('Update policy error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
