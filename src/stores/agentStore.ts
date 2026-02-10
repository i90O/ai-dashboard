import { create } from 'zustand'

export interface AgentState {
  id: string
  name: string
  color: string
  position: [number, number, number]
  status: 'idle' | 'thinking' | 'working' | 'talking'
  thought?: string
  lastHeartbeat?: Date
}

interface AgentStore {
  agents: AgentState[]
  selectedAgentId: string | null
  
  setAgents: (agents: AgentState[]) => void
  selectAgent: (id: string | null) => void
  updateAgentStatus: (id: string, status: AgentState['status'], thought?: string) => void
  updateAgentHeartbeat: (id: string) => void
}

// Default agent positions in the 3D office
const defaultAgents: AgentState[] = [
  {
    id: 'xiaobei',
    name: '小北',
    color: '#14b8a6', // teal
    position: [-4, 0, 1.5],
    status: 'idle',
    thought: '等待指令...'
  },
  {
    id: 'clawd2',
    name: 'Clawd2',
    color: '#f59e0b', // amber
    position: [0, 0, 1.5],
    status: 'idle',
    thought: '准备中...'
  },
  {
    id: 'clawd3',
    name: 'Clawd3',
    color: '#8b5cf6', // purple
    position: [4, 0, 1.5],
    status: 'idle',
    thought: '待命...'
  }
]

export const useAgentStore = create<AgentStore>((set) => ({
  agents: defaultAgents,
  selectedAgentId: null,
  
  setAgents: (agents) => set({ agents }),
  
  selectAgent: (id) => set({ selectedAgentId: id }),
  
  updateAgentStatus: (id, status, thought) => 
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, status, thought: thought || agent.thought } : agent
      )
    })),
  
  updateAgentHeartbeat: (id) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id ? { ...agent, lastHeartbeat: new Date() } : agent
      )
    }))
}))

// Activity colors for UI
export const activityColors = {
  idle: '#64748b',
  thinking: '#f59e0b',
  working: '#22c55e',
  talking: '#3b82f6'
}

export const activityEmojis = {
  idle: '😴',
  thinking: '🤔',
  working: '⚡',
  talking: '💬'
}
