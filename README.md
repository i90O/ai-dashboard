# AI Dashboard

AI Assistant Management Console for monitoring and managing multiple AI agents.

## Features

- **Activity Feed**: Real-time operation log with bot color coding
- **Kanban Board**: Task management with Todo → In Progress → Review → Done workflow
- **Calendar View**: Scheduled tasks and cron jobs
- **Global Search**: Search across activities, tasks, and memory
- **Bot Status Panel**: Online/offline status monitoring
- **Multi-bot Support**: Color-coded bot identification

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: Drizzle ORM + Supabase Postgres
- **Styling**: Tailwind CSS (Dark theme)
- **Deployment**: Zeabur

## Getting Started

1. Clone and install:
```bash
npm install
```

2. Set up environment:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

3. Push database schema:
```bash
npm run db:push
```

4. Run development server:
```bash
npm run dev
```

## API Endpoints

### Activities
- `GET /api/activities` - List activities
- `POST /api/activities` - Create activity (requires Bearer token)

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks` - Update task status

### Bots
- `GET /api/bots` - List bots
- `POST /api/bots` - Bot heartbeat (update status)

## Bot Integration

Bots report activity using Bearer token authentication:

```bash
curl -X POST https://your-dashboard.zeabur.app/api/activities \
  -H "Authorization: Bearer YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"message","description":"Processed request","source":"xiaobei"}'
```

## Deployment (Zeabur)

1. Connect GitHub repo to Zeabur
2. Add environment variables:
   - `DATABASE_URL`
   - `API_SECRET`
3. Deploy!

## License

MIT
