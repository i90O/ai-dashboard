# Go-Live Scripts

Run these scripts in order after database migrations to initialize the OPS system.

## Prerequisites

1. Database tables created (run `supabase/voxyz-complete.sql`)
2. Environment variables set (or use defaults):
   - `API_BASE` - Dashboard API URL (default: https://ai-dashboard-phi-three.vercel.app)
   - `API_KEY` - API key (default: xiaobei-mc-2026)

## Execution Order

```bash
# 1. Core policies (auto_approve, quotas, circuit breaker)
node scripts/go-live/seed-ops-policy.mjs

# 2. Roundtable/conversation policies
node scripts/go-live/seed-roundtable-policy.mjs

# 3. Initiative policies (disabled by default)
node scripts/go-live/seed-initiative-policy.mjs

# 4. Agent relationships (15 pairs)
node scripts/go-live/seed-relationships.mjs
```

## Policy Recommendations

| Policy | Recommended Start | Notes |
|--------|-------------------|-------|
| `auto_approve` | `enabled: true` | Auto-approve safe steps |
| `x_daily_quota.limit` | 5 | Start conservative |
| `roundtable_limits.max_per_day` | 5 | Start conservative |
| `memory_influence.probability` | 0.3 | 30% of prompts get memory |
| `affinity_drift.max` | 0.03 | Max relationship change |
| `initiative_worker.enabled` | false | Enable after stable |

## Enabling Features

Start with everything conservative. Once system is stable:

1. Increase `x_daily_quota.limit` to 8-10
2. Increase `roundtable_limits.max_per_day` to 10
3. Enable `initiative_worker` (set enabled: true)

Use the `/api/ops/policy` PATCH endpoint to update policies:

```bash
curl -X PATCH \
  -H "x-api-key: xiaobei-mc-2026" \
  -H "Content-Type: application/json" \
  -d '{"key": "initiative_worker", "value": {"enabled": true}}' \
  https://ai-dashboard-phi-three.vercel.app/api/ops/policy
```
