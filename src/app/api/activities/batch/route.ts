import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { activities } = body;

  if (!Array.isArray(activities)) {
    return NextResponse.json({ error: 'activities must be an array' }, { status: 400 });
  }

  // TODO: Batch insert into DB
  const results = activities.map((act, i) => ({
    id: `${Date.now()}-${i}`,
    ...act,
    timestamp: act.timestamp || new Date().toISOString(),
  }));

  return NextResponse.json({ ok: true, count: results.length, activities: results }, { status: 201 });
}
