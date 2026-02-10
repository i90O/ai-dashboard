'use client';

import { useState } from 'react';

interface Turn {
  turn?: number;
  speaker: string;
  dialogue?: string;
  content?: string;
  timestamp?: string;
}

interface Conversation {
  id: string;
  format: string;
  topic: string;
  participants: string[];
  status: string;
  history?: Turn[];
  created_at: string;
}

interface Props {
  conversations: Conversation[];
  onSelect?: (conv: Conversation) => void;
}

const FORMAT_ICONS: Record<string, string> = {
  standup: '🌅',
  brainstorm: '💡',
  debate: '⚔️',
  watercooler: '☕',
  planning: '📋',
  retrospective: '🔍'
};

const AGENT_COLORS: Record<string, string> = {
  xiaobei: '#f97316',
  clawd2: '#3b82f6',
  clawd3: '#22c55e',
  clawd4: '#a855f7',
  clawd5: '#eab308',
  clawd6: '#ef4444'
};

export function ConversationPanel({ conversations, onSelect }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const selectedConv = conversations.find(c => c.id === selectedId);
  const recentConvs = conversations.slice(0, 5);

  const handleSelect = (conv: Conversation) => {
    setSelectedId(conv.id === selectedId ? null : conv.id);
    onSelect?.(conv);
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h2 className="font-bold text-lg flex items-center gap-2">
          💬 团队对话
          <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-400">
            {conversations.length} 次
          </span>
        </h2>
      </div>

      <div className="flex">
        {/* Conversation list */}
        <div className="w-1/3 border-r border-gray-700 max-h-[400px] overflow-y-auto">
          {recentConvs.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">暂无对话</p>
          ) : (
            recentConvs.map(conv => (
              <div
                key={conv.id}
                onClick={() => handleSelect(conv)}
                className={`
                  p-3 border-b border-gray-700/50 cursor-pointer
                  hover:bg-gray-700/50 transition-colors
                  ${selectedId === conv.id ? 'bg-gray-700/70 border-l-2 border-l-blue-500' : ''}
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{FORMAT_ICONS[conv.format] || '💬'}</span>
                  <span className="text-xs font-medium text-gray-300 truncate flex-1">
                    {conv.topic}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {conv.participants?.slice(0, 3).map(p => (
                    <div
                      key={p}
                      className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center"
                      style={{ backgroundColor: `${AGENT_COLORS[p] || '#6b7280'}40` }}
                    >
                      {p[0].toUpperCase()}
                    </div>
                  ))}
                  {(conv.participants?.length || 0) > 3 && (
                    <span className="text-[10px] text-gray-500">+{conv.participants.length - 3}</span>
                  )}
                  <span className={`
                    ml-auto text-[10px] px-1.5 py-0.5 rounded
                    ${conv.status === 'completed' ? 'bg-green-900/50 text-green-400' : 
                      conv.status === 'running' ? 'bg-blue-900/50 text-blue-400' : 
                      'bg-gray-700 text-gray-400'}
                  `}>
                    {conv.status === 'completed' ? '完成' : conv.status === 'running' ? '进行中' : '等待'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Conversation detail */}
        <div className="flex-1 max-h-[400px] overflow-y-auto">
          {selectedConv ? (
            <div className="p-4">
              <div className="mb-3">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  {FORMAT_ICONS[selectedConv.format] || '💬'}
                  {selectedConv.topic}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedConv.participants?.join(', ')}
                </p>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                {selectedConv.history?.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">对话未开始</p>
                ) : (
                  selectedConv.history?.map((turn, i) => (
                    <div key={i} className="flex gap-2">
                      {/* Avatar */}
                      <div
                        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ 
                          backgroundColor: `${AGENT_COLORS[turn.speaker] || '#6b7280'}30`,
                          color: AGENT_COLORS[turn.speaker] || '#6b7280'
                        }}
                      >
                        {turn.speaker.slice(0, 2).toUpperCase()}
                      </div>
                      
                      {/* Message */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span 
                            className="text-xs font-semibold"
                            style={{ color: AGENT_COLORS[turn.speaker] || '#9ca3af' }}
                          >
                            {turn.speaker}
                          </span>
                          {turn.timestamp && (
                            <span className="text-[10px] text-gray-600">
                              {new Date(turn.timestamp).toLocaleTimeString('zh-CN', { 
                                hour: '2-digit', minute: '2-digit' 
                              })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {turn.dialogue || turn.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p className="text-4xl mb-2">💭</p>
              <p className="text-sm">选择一个对话查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConversationPanel;
