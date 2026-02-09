'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, CheckCircle, Clock, AlertCircle, Zap, FileText, Globe, Terminal, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Activity = {
  id: string;
  type: string;
  description: string;
  status: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

const botColors: Record<string, string> = {
  xiaobei: 'border-emerald-500 bg-emerald-500/10',
  clawd2: 'border-indigo-500 bg-indigo-500/10',
  clawd3: 'border-amber-500 bg-amber-500/10',
};

const botBadgeColors: Record<string, string> = {
  xiaobei: 'bg-emerald-500/20 text-emerald-400',
  clawd2: 'bg-indigo-500/20 text-indigo-400',
  clawd3: 'bg-amber-500/20 text-amber-400',
};

const typeIcons: Record<string, React.ReactNode> = {
  message: <MessageSquare className="w-4 h-4" />,
  task: <CheckCircle className="w-4 h-4" />,
  cron: <Clock className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  system: <Zap className="w-4 h-4" />,
  file_ops: <FileText className="w-4 h-4" />,
  web_search: <Globe className="w-4 h-4" />,
  command: <Terminal className="w-4 h-4" />,
  api_call: <Zap className="w-4 h-4" />,
};

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activities?limit=50');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchActivities, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchActivities]);

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.source === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-dark-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter and auto-refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
              filter === 'all' ? 'bg-dark-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
            }`}
          >
            All
          </button>
          {['xiaobei', 'clawd2', 'clawd3'].map(bot => (
            <button
              key={bot}
              onClick={() => setFilter(bot)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                filter === bot ? botBadgeColors[bot] : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
              }`}
            >
              {bot}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              autoRefresh ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-800 text-dark-400'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{autoRefresh ? 'Live' : 'Paused'}</span>
          </button>
          <button
            onClick={fetchActivities}
            className="p-1.5 rounded-lg bg-dark-800 text-dark-400 hover:bg-dark-700 hover:text-dark-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Activity List */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-12 text-dark-400">
          No activities yet. Bot reports will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map(activity => (
            <div
              key={activity.id}
              className={`p-4 rounded-lg border-l-4 ${botColors[activity.source] || 'border-dark-600 bg-dark-800'} bg-dark-800`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-dark-400">
                    {typeIcons[activity.type] || <Zap className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-dark-100">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${botBadgeColors[activity.source] || 'bg-dark-600 text-dark-300'}`}>
                        {activity.source}
                      </span>
                      <span className="text-xs text-dark-500">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  activity.status === 'success' || activity.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                  activity.status === 'error' || activity.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {activity.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
