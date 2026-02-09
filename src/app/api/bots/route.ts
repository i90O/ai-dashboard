import { NextRequest, NextResponse } from 'next/server';

// Mock data
const BOTS = [
  { id: 'xiaobei', name: '小北', color: '#10B981', status: 'online', lastSeen: new Date().toISOString() },
  { id: 'clawd2', name: 'clawd2', color: '#6366F1', status: 'online', lastSeen: new Date().toISOString() },
  { id: 'clawd3', name: 'clawd3', color: '#F59E0B', status: 'online', lastSeen: new Date().toISOString() },
];

export async function GET() {
  return NextResponse.json(BOTS);
}

// Bot heartbeat - update status
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { botId, status } = body;

  if (!botId) {
    return NextResponse.json({ error: 'Missing botId' }, { status: 400 });
  }

  // TODO: Update bot status in DB
  const bot = BOTS.find(b => b.id === botId);
  if (bot) {
    bot.status = status || 'online';
    bot.lastSeen = new Date().toISOString();
  }

  return NextResponse.json({ ok: true, bot });
}
