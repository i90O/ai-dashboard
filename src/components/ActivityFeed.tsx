'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react';
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

const MOCK_ACTIVITIES: Activity[] = [
  { id: '1', type: 'message', description: 'Processed user request for image enhancement', status: 'completed', source: 'xiaobei', timestamp: new Date().toISOString() },
  { id: '2', type: 'cron', description: 'Sent hourly tech news digest', status: 'completed', source: 'xiaobei', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', type: 'task', description: 'Completed web scraping task', status: 'completed', source: 'clawd2', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: '4', type: 'error', description: 'Failed to connect to API', status: 'failed', source: 'clawd3', timestamp: new Date(Date.now() - 10800000).toISOString() },
];

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
};

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES);
  const [filter, setFilter] = useState<string>('all');

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.source === filter);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            filter === 'all' ? 'bg-dark-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
          }`}
        >
          All
        </button>
        {['xiaobei', 'clawd2', 'clawd3'].map(bot => (
          <button
            key={bot}
            onClick={() => setFilter(bot)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === bot ? botBadgeColors[bot] : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
            }`}
          >
            {bot}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {filteredActivities.map(activity => (
          <div
            key={activity.id}
            className={`p-4 rounded-lg border-l-4 ${botColors[activity.source]} bg-dark-800`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-dark-400">
                  {typeIcons[activity.type]}
                </div>
                <div>
                  <p className="text-dark-100">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${botBadgeColors[activity.source]}`}>
                      {activity.source}
                    </span>
                    <span className="text-xs text-dark-500">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                activity.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                activity.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {activity.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
