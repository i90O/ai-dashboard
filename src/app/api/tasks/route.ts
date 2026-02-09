import { NextRequest, NextResponse } from 'next/server';

// Mock data
const MOCK_TASKS = [
  { id: '1', title: 'Build AI dashboard', status: 'in_progress', priority: 'high', assignee: 'xiaobei', reviewCount: 0 },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const assignee = searchParams.get('assignee');

  // TODO: Replace with actual DB query
  let filtered = MOCK_TASKS;
  if (status) filtered = filtered.filter(t => t.status === status);
  if (assignee) filtered = filtered.filter(t => t.assignee === assignee);

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, priority, assignee } = body;

  if (!title) {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 });
  }

  const task = {
    id: Date.now().toString(),
    title,
    description,
    status: 'todo',
    priority: priority || 'medium',
    assignee,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, status, retroNote, firstTrySuccess } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
  }

  // TODO: Update in DB
  const updated = { id, status, retroNote, firstTrySuccess, updatedAt: new Date().toISOString() };

  return NextResponse.json(updated);
}
