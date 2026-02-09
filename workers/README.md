# Voxyz Workers

Background processes for the multi-agent ops system. These run on VPS (not Vercel).

## Workers

| Worker | Purpose | Poll Interval |
|--------|---------|---------------|
| `mission-worker.mjs` | Execute mission steps | 5s |
| `roundtable-worker.mjs` | Orchestrate conversations, extract memories, apply affinity drift | 30s |
| `initiative-worker.mjs` | Generate proposals from agent memories | 60s |
| `schedule-conversations.mjs` | Schedule periodic conversations based on agent schedules | Cron |

## Quick Start

```bash
# Install dependencies
npm install postgres @anthropic-ai/sdk

# Set environment
export DATABASE_URL="postgresql://..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Run single worker
node workers/mission-worker.mjs

# Run all with PM2
pm2 start workers/ecosystem.config.cjs
pm2 save
```

## PM2 Commands

```bash
pm2 list                    # List all workers
pm2 logs mission-worker     # View logs
pm2 restart all             # Restart all
pm2 stop all                # Stop all
pm2 delete all              # Remove all
```

## Systemd Setup (Production)

```bash
# Copy service files
sudo cp workers/systemd/*.service /etc/systemd/system/

# Enable and start
sudo systemctl enable ops-mission-worker
sudo systemctl start ops-mission-worker
sudo systemctl status ops-mission-worker
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ /api/ops/*  │  │ /ops page   │  │ Dashboard   │         │
│  │ (Control)   │  │ (Frontend)  │  │ (Monitor)   │         │
│  └──────┬──────┘  └─────────────┘  └─────────────┘         │
│         │                                                   │
└─────────┼───────────────────────────────────────────────────┘
          │ REST API
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgreSQL (Tables, Views, Functions)              │   │
│  │  - ops_mission_steps (step queue)                   │   │
│  │  - ops_roundtable_queue (conversation queue)        │   │
│  │  - ops_initiative_queue (initiative queue)          │   │
│  │  - ops_circuit_breaker (health state)               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          ▲
          │ FOR UPDATE SKIP LOCKED (atomic claims)
          │
┌─────────┼───────────────────────────────────────────────────┐
│         │              VPS Workers                          │
│  ┌──────┴──────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Mission     │  │ Roundtable   │  │ Initiative   │       │
│  │ Worker      │  │ Worker       │  │ Worker       │       │
│  │ (execute)   │  │ (converse)   │  │ (propose)    │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Key Patterns

### 1. Atomic Step Claiming
```sql
UPDATE ops_mission_steps
SET status = 'running'
WHERE id = (
  SELECT id FROM ops_mission_steps
  WHERE status = 'queued'
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *
```

### 2. Circuit Breaker
- Track failures per service
- Open circuit after N failures
- Half-open after timeout
- Close after N successes

### 3. Memory Influence (30%)
- 30% chance to include memories in prompts
- Cache selection per context
- Prevents over-reliance on past

### 4. Affinity Drift (±0.03)
- Max drift per interaction: ±0.03
- Floor: 0.10, Ceiling: 0.95
- Log last 20 changes

## Env Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `ANTHROPIC_API_KEY` | No | For LLM features (mock without) |
| `AGENT_ID` | No | Default agent for mission worker |

## Cost Estimate

- Supabase: $0 (free tier)
- VPS: ~$5/month (DigitalOcean droplet)
- Anthropic: ~$3/month (Haiku @ ~1000 calls/day)
- **Total: ~$8/month + LLM usage**
