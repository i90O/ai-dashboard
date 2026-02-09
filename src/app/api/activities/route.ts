import { NextRequest, NextResponse } from 'next/server';
// import { db } from '@/db';
// import { activities } from '@/db/schema';
// import { desc } from 'drizzle-orm';

// Mock data for now
const MOCK_ACTIVITIES = [
  { id: '1', type: 'message', description: 'Processed user request', status: 'completed', source: 'xiaobei', timestamp: new Date().toISOString() },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source');
  const limit = parseInt(searchParams.get('limit') || '50');

  // TODO: Replace with actual DB query
  // const result = await db
  //   .select()
  //   .from(activities)
  //   .where(source ? eq(activities.source, source) : undefined)
  //   .orderBy(desc(activities.timestamp))
  //   .limit(limit);

  return NextResponse.json(MOCK_ACTIVITIES);
}

export async function POST(request: NextRequest) {
  // Verify API token
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, description, status, source, metadata } = body;

  if (!type || !description || !source) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // TODO: Insert into DB
  // const [activity] = await db.insert(activities).values({
  //   type,
  //   description,
  //   status: status || 'completed',
  //   source,
  //   metadata,
  // }).returning();

  const activity = { id: Date.now().toString(), type, description, status: status || 'completed', source, metadata, timestamp: new Date().toISOString() };

  return NextResponse.json(activity, { status: 201 });
}
