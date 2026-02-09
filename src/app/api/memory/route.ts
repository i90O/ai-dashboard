import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source');
  const type = searchParams.get('type');

  let query = supabase
    .from('memory_files')
    .select('*')
    .order('updated_at', { ascending: false });

  if (source) query = query.eq('source', source);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ files: data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, content, path, type = 'daily', source } = body;

  if (!name || !path || !source) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('memory_files')
    .upsert({
      name,
      content,
      path,
      type,
      source,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'path,source',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ file: data }, { status: 201 });
}
