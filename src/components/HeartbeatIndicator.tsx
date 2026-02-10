'use client';

import { useState, useEffect } from 'react';

interface Props {
  lastHeartbeat?: string;
  isHealthy: boolean;
  workersOnline: number;
  totalWorkers: number;
}

export function HeartbeatIndicator({ lastHeartbeat, isHealthy, workersOnline, totalWorkers }: Props) {
  const [beat, setBeat] = useState(false);

  // Heartbeat animation
  useEffect(() => {
    if (isHealthy) {
      const interval = setInterval(() => {
        setBeat(true);
        setTimeout(() => setBeat(false), 200);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isHealthy]);

  const timeSinceHeartbeat = lastHeartbeat 
    ? Math.round((Date.now() - new Date(lastHeartbeat).getTime()) / 1000 / 60)
    : null;

  return (
    <div className={`
      flex items-center gap-3 px-4 py-2 rounded-lg border
      ${isHealthy 
        ? 'bg-green-900/30 border-green-700' 
        : 'bg-red-900/30 border-red-700'}
    `}>
      {/* Heart icon */}
      <div className="relative">
        <span 
          className={`text-2xl transition-transform duration-200 ${beat ? 'scale-125' : 'scale-100'}`}
        >
          {isHealthy ? '💚' : '💔'}
        </span>
        {isHealthy && (
          <span 
            className="absolute inset-0 text-2xl opacity-50 animate-ping"
            style={{ animationDuration: '2s' }}
          >
            💚
          </span>
        )}
      </div>

      {/* Status text */}
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <span className={isHealthy ? 'text-green-400' : 'text-red-400'}>
            {isHealthy ? '系统正常' : '系统异常'}
          </span>
          <span className={`
            w-2 h-2 rounded-full 
            ${isHealthy ? 'bg-green-500' : 'bg-red-500'}
            ${isHealthy ? 'animate-pulse' : ''}
          `} />
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <span>
            🤖 {workersOnline}/{totalWorkers} 工作者在线
          </span>
          {timeSinceHeartbeat !== null && (
            <span>
              • 上次心跳 {timeSinceHeartbeat < 1 ? '刚刚' : `${timeSinceHeartbeat}分钟前`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default HeartbeatIndicator;
