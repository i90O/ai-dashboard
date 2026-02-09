import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Bot colors
export const BOT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  xiaobei: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-400',
    border: 'border-emerald-500',
  },
  clawd2: {
    bg: 'bg-indigo-500',
    text: 'text-indigo-400',
    border: 'border-indigo-500',
  },
  clawd3: {
    bg: 'bg-amber-500',
    text: 'text-amber-400',
    border: 'border-amber-500',
  },
};

export function getBotColor(botId: string) {
  return BOT_COLORS[botId] || {
    bg: 'bg-slate-500',
    text: 'text-slate-400',
    border: 'border-slate-500',
  };
}

// Status colors
export const STATUS_COLORS: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-amber-500/20 text-amber-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  error: 'bg-red-500/20 text-red-400',
  failed: 'bg-red-500/20 text-red-400',
  todo: 'bg-slate-500/20 text-slate-400',
  review: 'bg-purple-500/20 text-purple-400',
  done: 'bg-emerald-500/20 text-emerald-400',
};

export function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.pending;
}

// Priority colors
export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-500/20 text-slate-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
};

export function getPriorityColor(priority: string) {
  return PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
}
