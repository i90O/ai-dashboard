# AI Dashboard - Voxyz Multi-Agent Ops System

## 📁 代码位置

```
~/clawd/ai-dashboard/
├── src/
│   ├── app/
│   │   ├── api/ops/           # 14个 API Routes
│   │   │   ├── agents/        # Agent CRUD + stats
│   │   │   ├── circuit-breaker/ # 断路器
│   │   │   ├── events/        # 事件日志
│   │   │   ├── heartbeat/     # 心跳 + 触发器
│   │   │   ├── initiative/    # 主动提案队列
│   │   │   ├── memory/        # Agent 记忆
│   │   │   ├── missions/      # 任务管理
│   │   │   ├── policy/        # 策略配置
│   │   │   ├── proposals/     # 提案审批
│   │   │   ├── relationships/ # Agent 关系
│   │   │   ├── roundtable/    # 对话管理
│   │   │   ├── steps/         # 任务步骤 (原子抢占)
│   │   │   ├── triggers/      # 触发规则
│   │   │   └── voice/         # 语音演化
│   │   ├── ops/
│   │   │   └── page.tsx       # Ops Dashboard 主页
│   │   └── page.tsx           # 主 Dashboard
│   ├── components/
│   │   ├── PixelOffice.tsx    # 像素风办公室
│   │   ├── MissionReplay.tsx  # 任务回放
│   │   ├── VirtualizedEventList.tsx # 虚拟化列表
│   │   └── ErrorBoundary.tsx  # 错误边界
│   └── lib/
│       └── supabase.ts        # Supabase 客户端
├── workers/
│   ├── mission-worker.mjs     # 任务执行 Worker
│   ├── roundtable-worker.mjs  # 对话编排 Worker
│   ├── initiative-worker.mjs  # 主动提案 Worker
│   ├── schedule-conversations.mjs # 定时对话调度
│   └── systemd/               # VPS 部署配置
└── supabase/
    ├── voxyz-complete.sql     # 完整数据库 Schema (852行)
    └── atomic-claim.sql       # 原子抢占函数
```

## 🌐 部署

### 前端 + API (Vercel)
- **URL**: https://ai-dashboard-phi-three.vercel.app
- **Git**: https://github.com/i90O/ai-dashboard
- **自动部署**: push 到 main 自动触发

### 数据库 (Supabase)
- **Project ID**: hlumwrbidlxepmcvsswe
- **Dashboard**: https://supabase.com/dashboard/project/hlumwrbidlxepmcvsswe
- **Region**: US East 1

### Workers (本地 / VPS)
```bash
# 本地启动
cd ~/clawd/ai-dashboard/workers
export API_BASE="https://ai-dashboard-phi-three.vercel.app"
export API_KEY="xiaobei-mc-2026"

nohup node mission-worker.mjs > /tmp/mission-worker.log 2>&1 &
nohup node roundtable-worker.mjs > /tmp/roundtable-worker.log 2>&1 &

# 查看日志
tail -f /tmp/mission-worker.log
tail -f /tmp/roundtable-worker.log

# 停止
kill $(cat /tmp/mission-worker.pid /tmp/roundtable-worker.pid)
```

## 🔑 环境变量

### Vercel (.env.local)
```
DATABASE_URL="postgresql://postgres.hlumwrbidlxepmcvsswe:8jlXcAZQN0L7bkMC@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://hlumwrbidlxepmcvsswe.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_c936k8DogeMsRRXKDG31zA_airavduG"
MC_TOKEN="xiaobei-mc-2026"
```

### Workers 环境变量
```
API_BASE="https://ai-dashboard-phi-three.vercel.app"
API_KEY="xiaobei-mc-2026"
ANTHROPIC_API_KEY="your-key"  # 可选，用于真实对话生成
```

## 📊 数据库 Schema

### 核心表 (Ch1)
```sql
-- 提案
ops_mission_proposals (id, agent_id, title, description, status, source, proposed_steps)

-- 任务
ops_missions (id, proposal_id, title, created_by, status, priority, started_at, completed_at)

-- 任务步骤
ops_mission_steps (id, mission_id, seq, kind, status, payload, result, worker_id)

-- 事件日志
ops_agent_events (id, agent_id, kind, title, summary, tags, metadata)

-- 策略配置
ops_policy (key, value, description)
```

### Agent 表 (Ch2-4)
```sql
-- Agent 档案
ops_agent_profiles (id, display_name, backstory, voice_base, avatar_url, active)

-- Agent 关系
ops_agent_relationships (agent_a, agent_b, affinity, drift_log, total_interactions)

-- 对话会话
ops_roundtable_sessions (id, format, topic, participants, status, history, memories_extracted)
```

### 记忆表 (Ch3)
```sql
-- Agent 记忆 (5种类型: insight, pattern, strategy, preference, lesson)
ops_agent_memory (id, agent_id, type, content, confidence, source_conversation, tags, superseded_by)
```

### 高级表 (Ch5-8)
```sql
-- 主动提案队列
ops_initiative_queue (id, agent_id, status, trigger_reason, generated_proposal)

-- 语音规则
ops_voice_rules (id, memory_pattern, modifier_effect, priority, active)

-- 语音修饰符
ops_voice_modifiers (id, agent_id, modifier_type, value, source_memories, confidence)

-- 断路器
ops_circuit_breaker (service, state, failure_count, last_failure, next_retry)

-- 触发规则
ops_trigger_rules (id, name, trigger_event, conditions, action_config, cooldown_minutes)

-- 操作日志
ops_action_runs (id, trigger_id, event_data, success, error_message)
```

### 关键视图
```sql
v_agent_stats        -- Agent 统计 (memories, missions)
v_relationship_map   -- 关系网络
v_initiative_status  -- 主动提案状态
```

### 关键函数
```sql
apply_affinity_drift(agent_a, agent_b, drift, reason)  -- Ch4: 亲密度漂移
claim_next_step(worker_id, allowed_kinds)              -- Ch8: 原子抢占
```

## 🔧 API 认证

所有 `/api/ops/*` 路由需要 header:
```
x-api-key: xiaobei-mc-2026
```

## 📈 当前数据状态

| 数据 | 数量 |
|------|------|
| Agents | 6 (xiaobei, clawd2-6) |
| Relationships | 15 (完整网状) |
| Conversations | 2 (completed) |
| Missions | 5 (4 succeeded) |
| Events | 10+ |
| Circuit Breakers | 6 |
| Policies | 13 |
| Triggers | 3 |

## 🏗️ 架构图

```
┌─────────────────┐     ┌─────────────────┐
│   Telegram      │     │   Dashboard     │
│   (OpenClaw)    │     │   (Vercel)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    ┌──────────────────┤
         │    │                  │
         ▼    ▼                  ▼
┌─────────────────────────────────────────┐
│           API Routes (Vercel)           │
│  /api/ops/agents, missions, steps...    │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│           Supabase (Postgres)           │
│   Tables, Views, Functions              │
└────────────────────┬────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Mission Worker  │     │Roundtable Worker│
│  (Local/VPS)    │     │  (Local/VPS)    │
└─────────────────┘     └─────────────────┘
```

## 🚀 快速启动

```bash
# 1. 克隆代码
git clone https://github.com/i90O/ai-dashboard.git
cd ai-dashboard

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入 Supabase 凭证

# 4. 运行 SQL Schema
# 在 Supabase SQL Editor 运行 supabase/voxyz-complete.sql

# 5. 启动开发服务器
npm run dev

# 6. 启动 Workers (另一个终端)
cd workers
export API_BASE="http://localhost:3000"
export API_KEY="xiaobei-mc-2026"
node mission-worker.mjs
```

## 📚 Voxyz 8 章对应

| 章节 | 功能 | 文件 |
|------|------|------|
| Ch1 | Foundation | proposals/, missions/, steps/, policy/, triggers/ |
| Ch2 | Conversations | roundtable/, agents/, roundtable-worker.mjs |
| Ch3 | Memory | memory/, distillConversation in worker |
| Ch4 | Affinity | relationships/, apply_affinity_drift |
| Ch5 | Initiative | initiative/, initiative-worker.mjs |
| Ch6 | Voice | voice/, deriveVoiceModifiers |
| Ch7 | Frontend | ops/page.tsx, PixelOffice, MissionReplay |
| Ch8 | Observability | circuit-breaker/, claim_next_step, systemd/ |
