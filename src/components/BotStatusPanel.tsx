'use client';

import { useState, useEffect, useCallback } from 'react';
import { Circle, RefreshCw } from 'lucide-react';

type Bot = {
  id: string;
  name: string;
  color: string;
  status: 'online' | 'offline' | 'busy';
  last_seen?: string;
};

const statusColors: Record<string, string> = {
  online: 'text-emerald-500',
  offline: 'text-slate-500',
  busy: 'text-amber-500',
};

export default function BotStatusPanel() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch('/api/bots');
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || []);
      }
    } catch (err) {
      console.error('Failed to fetch bots:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBots();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBots, 30000);
    return () => clearInterval(interval);
  }, [fetchBots]);

  if (loading) {
    return (
      <div className="p-4 border-t border-dark-700">
        <h3 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">
          Bots
        </h3>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 animate-spin text-dark-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-dark-700">
      <h3 className="text-xs font-semibold text-dark-500 uppercase tracking-wider mb-3">
        Bots
      </h3>
      <div className="space-y-2">
        {bots.map(bot => (
          <div
            key={bot.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700 transition-colors cursor-pointer"
          >
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: bot.color }}
            >
              {bot.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-200 truncate">{bot.name}</p>
              <div className="flex items-center gap-1">
                <Circle className={`w-2 h-2 fill-current ${statusColors[bot.status] || statusColors.offline}`} />
                <span className="text-xs text-dark-500 capitalize">{bot.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
