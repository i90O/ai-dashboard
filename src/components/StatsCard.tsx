'use client';

import { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  color?: string;
};

export default function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  color = 'emerald',
}: Props) {
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    indigo: 'bg-indigo-500/20 text-indigo-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400',
  };

  const changeColors: Record<string, string> = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-dark-500',
  };

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dark-500">{title}</p>
          <p className="text-2xl font-bold text-dark-100 mt-1">{value}</p>
          {change && (
            <p className={`text-xs mt-1 ${changeColors[changeType]}`}>{change}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
