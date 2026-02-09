'use client';

import { useState, useEffect } from 'react';

interface Agent {
  id: string;
  display_name: string;
  emoji?: string;
  status?: 'idle' | 'working' | 'talking' | 'thinking';
  currentTask?: string;
}

interface Props {
  agents: Agent[];
  activeConversation?: {
    participants: string[];
    topic: string;
  };
}

// Pixel-style desk positions (6 desks in 2 rows)
const DESK_POSITIONS = [
  { x: 80, y: 60 },
  { x: 200, y: 60 },
  { x: 320, y: 60 },
  { x: 80, y: 160 },
  { x: 200, y: 160 },
  { x: 320, y: 160 },
];

export function PixelOffice({ agents, activeConversation }: Props) {
  const [frame, setFrame] = useState(0);

  // Animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const getAgentStatus = (agentId: string) => {
    if (activeConversation?.participants.includes(agentId)) return 'talking';
    const agent = agents.find(a => a.id === agentId);
    return agent?.status || 'idle';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'bg-green-500';
      case 'talking': return 'bg-blue-500 animate-pulse';
      case 'thinking': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getAgentEmoji = (agentId: string) => {
    const emojis: Record<string, string> = {
      xiaobei: '🧭', clawd2: '📊', clawd3: '🚀',
      clawd4: '🔍', clawd5: '✨', clawd6: '⚡'
    };
    return emojis[agentId] || '🤖';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="font-semibold mb-3 flex items-center gap-2">
        🏢 Agent Office
        {activeConversation && (
          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded animate-pulse">
            {activeConversation.participants.length} talking
          </span>
        )}
      </h2>
      
      <div 
        className="relative bg-gray-900 rounded-lg overflow-hidden"
        style={{ height: 240, width: '100%' }}
      >
        {/* Floor grid pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />
        
        {/* Meeting area (center) */}
        {activeConversation && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-24 h-16 bg-gray-700 rounded-lg border-2 border-blue-500 flex items-center justify-center">
              <span className="text-[10px] text-center text-gray-400 px-1">
                {activeConversation.topic.slice(0, 20)}
              </span>
            </div>
            {/* Speech bubbles */}
            <div 
              className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-black text-[8px] px-1 rounded"
              style={{ opacity: frame % 2 === 0 ? 1 : 0.5 }}
            >
              💬
            </div>
          </div>
        )}
        
        {/* Agent desks */}
        {agents.slice(0, 6).map((agent, i) => {
          const pos = DESK_POSITIONS[i];
          const status = getAgentStatus(agent.id);
          const isTalking = activeConversation?.participants.includes(agent.id);
          
          return (
            <div
              key={agent.id}
              className="absolute transition-all duration-300"
              style={{
                left: isTalking ? '50%' : pos.x,
                top: isTalking ? '50%' : pos.y,
                transform: isTalking 
                  ? `translate(-50%, -50%) translate(${(i % 3 - 1) * 40}px, ${Math.floor(i / 3) * 30 - 40}px)`
                  : 'none',
                zIndex: isTalking ? 10 : 1
              }}
            >
              {/* Desk */}
              {!isTalking && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-12 h-6 bg-amber-900 rounded-sm" />
              )}
              
              {/* Agent */}
              <div className="relative flex flex-col items-center">
                {/* Status indicator */}
                <div className={`w-2 h-2 rounded-full ${getStatusColor(status)} absolute -top-1 -right-1`} />
                
                {/* Avatar */}
                <div 
                  className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-lg border-2 border-gray-600"
                  style={{ 
                    transform: status === 'working' ? `translateY(${frame % 2}px)` : 'none',
                    borderColor: isTalking ? '#3b82f6' : undefined
                  }}
                >
                  {getAgentEmoji(agent.id)}
                </div>
                
                {/* Name */}
                <span className="text-[8px] text-gray-400 mt-0.5 whitespace-nowrap">
                  {agent.display_name}
                </span>
              </div>
            </div>
          );
        })}
        
        {/* Legend */}
        <div className="absolute bottom-2 right-2 flex gap-2 text-[8px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /> idle</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> work</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> talk</span>
        </div>
      </div>
    </div>
  );
}

export default PixelOffice;
