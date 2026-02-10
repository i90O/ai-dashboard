'use client'
import { useAgentStore, activityColors, activityEmojis } from '@/stores/agentStore'

export default function TeamActivityPanel() {
  const { agents, selectedAgentId, selectAgent } = useAgentStore()
  
  const activeAgents = agents.filter(a => a.status !== 'idle')
  
  return (
    <div className="fixed bottom-6 left-6 bg-slate-900/95 backdrop-blur-md rounded-xl shadow-2xl p-4 border border-slate-700/50 z-30 max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <h3 className="font-semibold text-white text-sm">
          Team Status ({agents.length})
        </h3>
      </div>
      
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {agents.map(agent => (
          <div
            key={agent.id}
            onClick={() => selectAgent(agent.id)}
            className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-300 cursor-pointer
              ${selectedAgentId === agent.id 
                ? 'bg-slate-700 border-2 border-white/50' 
                : 'bg-slate-800/80 hover:bg-slate-700 border border-transparent hover:border-slate-600'
              }`}
          >
            {/* Avatar */}
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: agent.color }}
            >
              {agent.name.charAt(0)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-white truncate">
                  {agent.name}
                </span>
                <span className="text-lg">{activityEmojis[agent.status]}</span>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: activityColors[agent.status] }}
                />
              </div>
              <p className="text-xs text-slate-400 truncate mt-1">
                {agent.thought || 'No activity'}
              </p>
              {agent.lastHeartbeat && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Last seen: {new Date(agent.lastHeartbeat).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {activeAgents.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="text-xs text-slate-400">
            ⚡ {activeAgents.length} agent{activeAgents.length > 1 ? 's' : ''} working
          </div>
        </div>
      )}
    </div>
  )
}
