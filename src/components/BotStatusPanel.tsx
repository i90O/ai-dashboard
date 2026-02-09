'use client';

import { Circle } from 'lucide-react';

type Bot = {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen?: string;
};

const MOCK_BOTS: Bot[] = [
  { id: 'xiaobei', name: '小北', status: 'online' },
  { id: 'clawd2', name: 'clawd2', status: 'online' },
  { id: 'clawd3', name: 'clawd3', status: 'online' },
];

const statusColors: Record<string, string> = {
  online: 'text-emerald-500',
  offline: 'text-slate-500',
  busy: 'text-amber-500',
};

const botColors: Record<string, string> = {
  xiaobei: 'bg-emerald-500',
  clawd2: 'bg-indigo-500',
  clawd3: 'bg-amber-500',
};

export default function BotStatusPanel() {
  return (
    <div className="p-4 border-t border-dark-700">
      <h3 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">
        Bots
      </h3>
      <div className="space-y-2">
        {MOCK_BOTS.map(bot => (
          <div
            key={bot.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700 transition-colors cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-full ${botColors[bot.id]} flex items-center justify-center text-white font-bold text-sm`}>
              {bot.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-200 truncate">{bot.name}</p>
              <div className="flex items-center gap-1">
                <Circle className={`w-2 h-2 fill-current ${statusColors[bot.status]}`} />
                <span className="text-xs text-dark-500 capitalize">{bot.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
