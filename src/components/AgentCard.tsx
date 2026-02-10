'use client';

import { useState, useEffect } from 'react';

interface AgentStats {
  insights: number;
  lessons: number;
  strategies: number;
  patterns: number;
  avg_confidence: number;
  successful_missions: number;
}

interface Agent {
  id: string;
  display_name: string;
  backstory?: string;
  voice_base?: { emoji?: string };
  stats?: AgentStats;
  status?: 'online' | 'offline' | 'working' | 'talking';
  currentTask?: string;
  lastSeen?: string;
}

// Agent configurations with generated avatar placeholders
const AGENT_PROFILES: Record<string, {
  avatar: string;
  color: string;
  gradient: string;
  role: string;
  personality: string;
}> = {
  xiaobei: {
    avatar: '🧭',
    color: '#f97316',
    gradient: 'from-orange-500 to-amber-600',
    role: '首席协调员',
    personality: '高效、温暖、直接'
  },
  clawd2: {
    avatar: '📊',
    color: '#3b82f6',
    gradient: 'from-blue-500 to-indigo-600',
    role: '数据分析师',
    personality: '逻辑、数据驱动'
  },
  clawd3: {
    avatar: '🚀',
    color: '#22c55e',
    gradient: 'from-green-500 to-emerald-600',
    role: '行动执行者',
    personality: '冲劲、创意、行动派'
  },
  clawd4: {
    avatar: '🔍',
    color: '#a855f7',
    gradient: 'from-purple-500 to-violet-600',
    role: '风险审查员',
    personality: '谨慎、细致、提问'
  },
  clawd5: {
    avatar: '✨',
    color: '#eab308',
    gradient: 'from-yellow-500 to-orange-500',
    role: '创意乐观师',
    personality: '热情、乐观、发现机会'
  },
  clawd6: {
    avatar: '⚡',
    color: '#ef4444',
    gradient: 'from-red-500 to-pink-600',
    role: '快速执行者',
    personality: '务实、少废话、多干活'
  }
};

interface Props {
  agent: Agent;
  isActive?: boolean;
  onClick?: () => void;
}

export function AgentCard({ agent, isActive, onClick }: Props) {
  const [pulse, setPulse] = useState(false);
  const profile = AGENT_PROFILES[agent.id] || {
    avatar: '🤖',
    color: '#6b7280',
    gradient: 'from-gray-500 to-gray-600',
    role: 'Agent',
    personality: '未知'
  };

  // Heartbeat pulse animation
  useEffect(() => {
    if (agent.status === 'working' || agent.status === 'talking') {
      const interval = setInterval(() => setPulse(p => !p), 1000);
      return () => clearInterval(interval);
    }
  }, [agent.status]);

  const statusConfig = {
    online: { color: 'bg-green-500', text: '在线', icon: '🟢' },
    offline: { color: 'bg-gray-500', text: '离线', icon: '🔴' },
    working: { color: 'bg-blue-500', text: '工作中', icon: '🔵' },
    talking: { color: 'bg-purple-500', text: '对话中', icon: '💬' }
  };

  const status = statusConfig[agent.status || 'online'];

  return (
    <div 
      className={`
        relative bg-gradient-to-br from-gray-800 to-gray-900 
        rounded-xl border-2 transition-all duration-300 cursor-pointer
        hover:scale-[1.02] hover:shadow-xl
        ${isActive ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-gray-700'}
      `}
      onClick={onClick}
      style={{ borderColor: isActive ? profile.color : undefined }}
    >
      {/* Status indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${status.color} ${pulse ? 'animate-pulse' : ''}`} />
        <span className="text-[10px] text-gray-400">{status.text}</span>
      </div>

      <div className="p-4">
        {/* Avatar section */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div 
            className={`
              w-14 h-14 rounded-xl flex items-center justify-center text-2xl
              bg-gradient-to-br ${profile.gradient}
              shadow-lg transition-transform duration-300
              ${agent.status === 'working' ? 'animate-bounce' : ''}
              ${agent.status === 'talking' ? 'scale-110' : ''}
            `}
            style={{ 
              boxShadow: `0 4px 20px ${profile.color}40`
            }}
          >
            {profile.avatar}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate">{agent.display_name}</h3>
            <p className="text-xs text-gray-400">{profile.role}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{profile.personality}</p>
          </div>
        </div>

        {/* Current task */}
        {agent.currentTask && (
          <div className="mt-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="animate-spin">⚙️</span>
              <span className="text-gray-300 truncate">{agent.currentTask}</span>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {agent.stats && (
          <div className="mt-3 flex gap-2 text-[10px]">
            <div className="flex-1 bg-gray-800 rounded px-2 py-1 text-center">
              <span className="text-purple-400 font-bold">{agent.stats.insights || 0}</span>
              <span className="text-gray-500 ml-1">洞察</span>
            </div>
            <div className="flex-1 bg-gray-800 rounded px-2 py-1 text-center">
              <span className="text-green-400 font-bold">{agent.stats.successful_missions || 0}</span>
              <span className="text-gray-500 ml-1">任务</span>
            </div>
            <div className="flex-1 bg-gray-800 rounded px-2 py-1 text-center">
              <span className="text-blue-400 font-bold">{Math.round((agent.stats.avg_confidence || 0) * 100)}%</span>
              <span className="text-gray-500 ml-1">信心</span>
            </div>
          </div>
        )}
      </div>

      {/* Active glow */}
      {isActive && (
        <div 
          className="absolute inset-0 rounded-xl opacity-20 pointer-events-none"
          style={{ 
            background: `radial-gradient(circle at 50% 50%, ${profile.color}, transparent 70%)`
          }}
        />
      )}
    </div>
  );
}

export default AgentCard;
