'use client';

import { useState, useEffect } from 'react';

interface Agent {
  id: string;
  display_name: string;
  emoji?: string;
  status?: 'idle' | 'working' | 'talking' | 'thinking';
  currentTask?: string;
}

interface RecentTask {
  id: string;
  title: string;
  agent: string;
  status: 'running' | 'succeeded' | 'failed';
  completedAt?: string;
}

interface Props {
  agents: Agent[];
  activeConversation?: {
    participants: string[];
    topic: string;
    currentSpeaker?: string;
    lastMessage?: string;
  };
  recentTasks?: RecentTask[];
}

// Agent avatar configurations - more personality!
const AGENT_CONFIGS: Record<string, { avatar: string; color: string; role: string }> = {
  xiaobei: { avatar: '🧭', color: '#f97316', role: '协调者' },
  clawd2: { avatar: '📊', color: '#3b82f6', role: '分析师' },
  clawd3: { avatar: '🚀', color: '#22c55e', role: '行动派' },
  clawd4: { avatar: '🔍', color: '#a855f7', role: '审查员' },
  clawd5: { avatar: '✨', color: '#eab308', role: '乐观派' },
  clawd6: { avatar: '⚡', color: '#ef4444', role: '执行者' },
};

// Desk positions in a more dynamic layout
const DESK_POSITIONS = [
  { x: 60, y: 50, desk: true },
  { x: 180, y: 40, desk: true },
  { x: 300, y: 50, desk: true },
  { x: 100, y: 150, desk: true },
  { x: 220, y: 160, desk: true },
  { x: 340, y: 150, desk: true },
];

export function PixelOffice({ agents, activeConversation, recentTasks = [] }: Props) {
  const [frame, setFrame] = useState(0);
  const [showTaskComplete, setShowTaskComplete] = useState<string | null>(null);

  // Animation loop - faster for more life
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 8);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // Task completion notification
  useEffect(() => {
    const latest = recentTasks.find(t => t.status === 'succeeded');
    if (latest && latest.id !== showTaskComplete) {
      setShowTaskComplete(latest.id);
      setTimeout(() => setShowTaskComplete(null), 3000);
    }
  }, [recentTasks, showTaskComplete]);

  const getAgentStatus = (agentId: string) => {
    if (activeConversation?.currentSpeaker === agentId) return 'talking';
    if (activeConversation?.participants.includes(agentId)) return 'thinking';
    const agent = agents.find(a => a.id === agentId);
    if (agent?.currentTask) return 'working';
    return agent?.status || 'idle';
  };

  const getConfig = (agentId: string) => {
    return AGENT_CONFIGS[agentId] || { avatar: '🤖', color: '#6b7280', role: 'Agent' };
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'working': return { color: '#22c55e', text: '工作中', pulse: true };
      case 'talking': return { color: '#3b82f6', text: '发言中', pulse: true };
      case 'thinking': return { color: '#eab308', text: '思考中', pulse: false };
      default: return { color: '#6b7280', text: '空闲', pulse: false };
    }
  };

  const justCompleted = recentTasks.filter(t => t.status === 'succeeded').slice(0, 3);

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg flex items-center gap-2">
          🏢 代理办公室
          {activeConversation && (
            <span className="text-xs bg-blue-600 px-2 py-1 rounded-full animate-pulse">
              🎙️ 对话中
            </span>
          )}
        </h2>
      </div>
      
      <div className="flex gap-4">
        {/* Office visualization */}
        <div 
          className="relative bg-gradient-to-b from-gray-900 to-gray-950 rounded-lg overflow-hidden flex-1 border border-gray-700"
          style={{ height: 260 }}
        >
          {/* Window with day/night cycle */}
          <div className="absolute top-2 right-2 w-20 h-12 bg-gradient-to-b from-indigo-900 to-purple-900 rounded border border-gray-600">
            <div className="absolute top-1 left-1 w-2 h-2 bg-yellow-200 rounded-full animate-pulse" /> {/* Star */}
            <div className="absolute top-3 right-2 w-3 h-3 bg-gray-300 rounded-full opacity-80" /> {/* Moon */}
          </div>
          
          {/* Floor */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-amber-900/30 to-transparent" />
          
          {/* Central meeting table when conversation active */}
          {activeConversation && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="w-28 h-20 bg-gradient-to-b from-amber-800 to-amber-900 rounded-lg border-2 border-amber-700 shadow-lg flex flex-col items-center justify-center p-2">
                <span className="text-[9px] text-amber-200 text-center leading-tight">
                  📋 {activeConversation.topic.slice(0, 25)}{activeConversation.topic.length > 25 ? '...' : ''}
                </span>
              </div>
              
              {/* Speech bubble */}
              {activeConversation.lastMessage && (
                <div 
                  className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-gray-900 text-[10px] px-3 py-1.5 rounded-lg shadow-lg max-w-[160px] border"
                  style={{ 
                    animation: 'fadeIn 0.3s ease-out',
                    opacity: frame % 4 < 3 ? 1 : 0.9
                  }}
                >
                  <div className="font-bold text-blue-600 mb-0.5">
                    {activeConversation.currentSpeaker}:
                  </div>
                  {activeConversation.lastMessage.slice(0, 50)}...
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white transform rotate-45 border-r border-b" />
                </div>
              )}
            </div>
          )}
          
          {/* Agents */}
          {agents.slice(0, 6).map((agent, i) => {
            const pos = DESK_POSITIONS[i];
            const status = getAgentStatus(agent.id);
            const config = getConfig(agent.id);
            const indicator = getStatusIndicator(status);
            const isTalking = activeConversation?.participants.includes(agent.id);
            const isSpeaker = activeConversation?.currentSpeaker === agent.id;
            
            // Calculate meeting position
            const meetingOffset = isTalking ? {
              x: (i % 3 - 1) * 50,
              y: Math.floor(i / 3) * 40 - 30
            } : { x: 0, y: 0 };
            
            return (
              <div
                key={agent.id}
                className="absolute transition-all duration-500 ease-out"
                style={{
                  left: isTalking ? `calc(50% + ${meetingOffset.x}px)` : pos.x,
                  top: isTalking ? `calc(50% + ${meetingOffset.y}px)` : pos.y,
                  transform: isTalking ? 'translate(-50%, -50%)' : 'none',
                  zIndex: isSpeaker ? 30 : isTalking ? 20 : 10
                }}
              >
                {/* Desk (only when not in meeting) */}
                {!isTalking && pos.desk && (
                  <div className="absolute top-12 left-1/2 -translate-x-1/2">
                    <div className="w-14 h-5 bg-gradient-to-b from-amber-700 to-amber-800 rounded-sm shadow" />
                    <div className="w-10 h-8 bg-gray-800 rounded-sm mx-auto -mt-1 flex items-center justify-center">
                      <div className="w-8 h-5 bg-gray-700 rounded-sm flex items-center justify-center text-[6px]">
                        {status === 'working' && '▓▓▓'}
                        {status === 'idle' && '___'}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Agent avatar */}
                <div className="relative flex flex-col items-center">
                  {/* Status ring */}
                  <div 
                    className={`absolute -inset-1 rounded-full ${indicator.pulse ? 'animate-ping' : ''}`}
                    style={{ 
                      backgroundColor: indicator.color,
                      opacity: 0.3,
                      animationDuration: '1.5s'
                    }}
                  />
                  
                  {/* Avatar container */}
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl relative border-2 shadow-lg transition-transform"
                    style={{ 
                      backgroundColor: `${config.color}20`,
                      borderColor: config.color,
                      transform: `scale(${isSpeaker ? 1.2 : 1}) translateY(${status === 'working' ? (frame % 2) : 0}px)`,
                      boxShadow: isSpeaker ? `0 0 20px ${config.color}` : undefined
                    }}
                  >
                    {config.avatar}
                    
                    {/* Working animation */}
                    {status === 'working' && (
                      <div className="absolute -top-1 -right-1 text-[10px] animate-bounce">⚙️</div>
                    )}
                    
                    {/* Speaking animation */}
                    {isSpeaker && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[12px]">🎤</div>
                    )}
                  </div>
                  
                  {/* Name & role */}
                  <div className="text-center mt-1">
                    <div className="text-[9px] font-bold" style={{ color: config.color }}>
                      {agent.display_name}
                    </div>
                    <div className="text-[7px] text-gray-500">
                      {config.role}
                    </div>
                  </div>
                  
                  {/* Status badge */}
                  <div 
                    className="text-[7px] px-1.5 py-0.5 rounded-full mt-0.5"
                    style={{ 
                      backgroundColor: `${indicator.color}30`,
                      color: indicator.color
                    }}
                  >
                    {indicator.text}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Task completion toast */}
          {showTaskComplete && (
            <div className="absolute top-2 left-2 right-2 bg-green-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg animate-bounce z-50">
              ✅ 任务完成！{justCompleted[0]?.title}
            </div>
          )}
        </div>
        
        {/* Task blackboard */}
        <div className="w-48 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg border border-gray-700 p-3">
          <h3 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1">
            📋 任务黑板
          </h3>
          
          {/* Current tasks */}
          <div className="mb-3">
            <div className="text-[8px] text-gray-500 uppercase mb-1">进行中</div>
            {recentTasks.filter(t => t.status === 'running').length === 0 ? (
              <div className="text-[9px] text-gray-600 italic">无进行中任务</div>
            ) : (
              recentTasks.filter(t => t.status === 'running').map(task => (
                <div key={task.id} className="text-[9px] text-yellow-400 flex items-center gap-1 mb-1">
                  <span className="animate-spin">⏳</span> {task.title.slice(0, 20)}
                </div>
              ))
            )}
          </div>
          
          {/* Completed tasks */}
          <div>
            <div className="text-[8px] text-gray-500 uppercase mb-1">已完成</div>
            {justCompleted.length === 0 ? (
              <div className="text-[9px] text-gray-600 italic">暂无完成任务</div>
            ) : (
              justCompleted.map(task => (
                <div key={task.id} className="text-[9px] text-green-400 flex items-center gap-1 mb-1">
                  ✅ {task.title.slice(0, 18)}
                  <span className="text-gray-600">({task.agent})</span>
                </div>
              ))
            )}
          </div>
          
          {/* Stats */}
          <div className="mt-3 pt-2 border-t border-gray-700">
            <div className="text-[8px] text-gray-500">
              今日: {recentTasks.filter(t => t.status === 'succeeded').length} 完成
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) translateX(-50%); }
          to { opacity: 1; transform: translateY(0) translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export default PixelOffice;
