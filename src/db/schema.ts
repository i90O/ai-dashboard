import { pgTable, text, timestamp, uuid, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

// Activities - Real-time operation log
export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // 'message', 'task', 'cron', 'error', 'system'
  description: text('description').notNull(),
  status: text('status').default('completed'), // 'pending', 'completed', 'failed'
  source: text('source').notNull(), // bot identifier: 'xiaobei', 'clawd2', 'clawd3'
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata'), // additional data
});

// Tasks - Kanban board items
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('todo').notNull(), // 'todo', 'in_progress', 'review', 'done'
  priority: text('priority').default('medium'), // 'low', 'medium', 'high', 'urgent'
  assignee: text('assignee'), // bot identifier
  assignedBy: text('assigned_by'), // human who assigned
  reviewCount: integer('review_count').default(0),
  firstTrySuccess: boolean('first_try_success'),
  retroNote: text('retro_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Scheduled Tasks - Cron jobs
export const scheduledTasks = pgTable('scheduled_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').default('cron'), // 'cron', 'one-time'
  cronExpression: text('cron_expression'),
  status: text('status').default('active'), // 'active', 'paused', 'completed'
  source: text('source').notNull(), // bot identifier
  nextRun: timestamp('next_run'),
  lastRun: timestamp('last_run'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Memory Files - Bot memory snapshots
export const memoryFiles = pgTable('memory_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  content: text('content'),
  path: text('path').notNull(),
  type: text('type').default('daily'), // 'daily', 'memory', 'soul', 'agents'
  source: text('source').notNull(), // bot identifier
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Bots - Bot registry
export const bots = pgTable('bots', {
  id: text('id').primaryKey(), // 'xiaobei', 'clawd2', 'clawd3'
  name: text('name').notNull(),
  color: text('color').notNull(), // hex color for UI
  status: text('status').default('offline'), // 'online', 'offline', 'busy'
  lastSeen: timestamp('last_seen'),
  apiToken: text('api_token'), // hashed bearer token
  metadata: jsonb('metadata'),
});

export type Activity = typeof activities.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type MemoryFile = typeof memoryFiles.$inferSelect;
export type Bot = typeof bots.$inferSelect;
