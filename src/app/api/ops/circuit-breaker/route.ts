import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - get circuit breaker status
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service');

  if (service) {
    const { data, error } = await supabase
      .from('ops_circuit_breaker')
      .select('*')
      .eq('service', service)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ circuit: data });
  }

  const { data, error } = await supabase
    .from('ops_circuit_breaker')
    .select('*');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ circuits: data });
}

// POST - check if service can proceed and record result
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();
  const { service, action, success } = body;

  if (!service || !action) {
    return NextResponse.json({ error: 'service and action required' }, { status: 400 });
  }

  if (action === 'check') {
    const { data, error } = await supabase.rpc('circuit_breaker_can_proceed', {
      p_service: service
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ can_proceed: data });
  }

  if (action === 'record') {
    if (success === undefined) {
      return NextResponse.json({ error: 'success required for record action' }, { status: 400 });
    }

    const fn = success ? 'circuit_breaker_record_success' : 'circuit_breaker_record_failure';
    const { data, error } = await supabase.rpc(fn, { p_service: service });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ new_state: data });
  }

  if (action === 'reset') {
    const { error } = await supabase
      .from('ops_circuit_breaker')
      .update({
        state: 'closed',
        failure_count: 0,
        half_open_successes: 0,
        updated_at: new Date().toISOString()
      })
      .eq('service', service);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reset: true, service });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
