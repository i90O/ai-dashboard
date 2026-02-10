'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy load heavy components
const VirtualizedEventList = dynamic(() => import('@/components/VirtualizedEventList'), { ssr: false });
const PixelOffice = dynamic(() => import('@/components/PixelOffice'), { ssr: false });
const MissionReplay = dynamic(() => import('@/components/MissionReplay'), { ssr: false });
const AgentCard = dynamic(() => import('@/components/AgentCard'), { ssr: false });
const TaskKanban = dynamic(() => import('@/components/TaskKanban'), { ssr: false });
const ConversationPanel = dynamic(() => import('@/components/ConversationPanel'), { ssr: false });
const HeartbeatIndicator = dynamic(() => import('@/components/HeartbeatIndicator'), { ssr: false });

// Types
interface Agent {
  id: string;
  display_name: string;
  backstory?: string;
  voice_base?: { emoji?: string };
  stats?: {
    insights: number;
    lessons: number;
    strategies: number;
    patterns: number;
    avg_confidence: number;
    successful_missions: number;
  };
}

interface Step {
  id: string;
  seq?: number;
  kind: string;
  status: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
}

interface Mission {
  id: string;
  title: string;
  status: string;
  created_by: string;
  priority: number;
  created_at: string;
  completed_at?: string;
  steps?: Step[];
}

interface Event {
  id: string;
  agent_id: string;
  kind: string;
  title: string;
  summary?: string;
  tags: string[];
  created_at: string;
}

interface Proposal {
  id: string;
  agent_id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
}

interface Relationship {
  agent_a: string;
  agent_a_name: string;
  agent_b: string;
  agent_b_name: string;
  affinity: number;
  relationship_status: string;
}

interface ConversationTurn {
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
  created_at: string;
  history?: ConversationTurn[];
}

interface CircuitBreaker {
  service: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
}

export default function OpsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'conversations' | 'memory' | 'health'>('overview');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [circuits, setCircuits] = useState<CircuitBreaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [expandedConversation, setExpandedConversation] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, missionsRes, eventsRes, proposalsRes, relRes, convRes, circRes] = await Promise.all([
        fetch('/api/ops/agents?include_stats=true'),
        fetch('/api/ops/missions'),
        fetch('/api/ops/events?limit=100'),
        fetch('/api/ops/proposals?status=pending'),
        fetch('/api/ops/relationships'),
        fetch('/api/ops/roundtable?limit=10'),
        fetch('/api/ops/circuit-breaker')
      ]);

      const [agentsData, missionsData, eventsData, proposalsData, relData, convData, circData] = await Promise.all([
        agentsRes.json(), missionsRes.json(), eventsRes.json(), proposalsRes.json(),
        relRes.json(), convRes.json(), circRes.json()
      ]);

      setAgents(agentsData.agents || []);
      setMissions(missionsData.missions || []);
      setEvents(eventsData.events || []);
      setProposals(proposalsData.proposals || []);
      setRelationships(relData.relationships || []);
      setConversations(convData.conversations || []);
      setCircuits(circData.circuits || []);
    } catch (error) {
      console.error('Failed to fetch ops data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const approveProposal = async (id: string) => {
    await fetch('/api/ops/proposals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_id: id, action: 'approve' })
    });
    fetchData();
  };

  const rejectProposal = async (id: string) => {
    await fetch('/api/ops/proposals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_id: id, action: 'reject' })
    });
    fetchData();
  };

  const triggerHeartbeat = async () => {
    setLoading(true);
    await fetch('/api/ops/heartbeat');
    await fetchData();
  };

  const scheduleConversation = async (format: string, topic: string, participants: string[]) => {
    await fetch('/api/ops/roundtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, topic, participants })
    });
    fetchData();
  };

  const resetCircuitBreaker = async (service: string) => {
    await fetch('/api/ops/circuit-breaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, action: 'reset' })
    });
    fetchData();
  };

  const statusColors: Record<string, string> = {
    queued: 'bg-gray-500', running: 'bg-blue-500 animate-pulse', succeeded: 'bg-green-500',
    failed: 'bg-red-500', pending: 'bg-yellow-500', approved: 'bg-blue-400',
    completed: 'bg-green-400', closed: 'bg-green-500', open: 'bg-red-500', half_open: 'bg-yellow-500'
  };

  const activeConversation = conversations.find(c => c.status === 'running');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <div className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🎛️ Ops Center
              <span className="text-sm font-normal text-gray-400">Multi-Agent Operations</span>
            </h1>
            <button onClick={triggerHeartbeat} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1">
              💓 Heartbeat
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800 px-6">
          <div className="max-w-7xl mx-auto flex gap-1">
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'agents', label: '🤖 Agents' },
              { id: 'conversations', label: '💬 Conversations' },
              { id: 'memory', label: '🧠 Memory' },
              { id: 'health', label: '🔧 Health' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  activeTab === tab.id ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top row: Heartbeat + Agent Cards */}
              <div className="flex flex-wrap items-start gap-4">
                {/* Heartbeat indicator */}
                <ErrorBoundary fallback={<div>心跳不可用</div>}>
                  <HeartbeatIndicator 
                    isHealthy={circuits.every(cb => cb.state === 'closed')}
                    workersOnline={circuits.filter(cb => cb.state === 'closed').length}
                    totalWorkers={circuits.length || 3}
                    lastHeartbeat={events[0]?.created_at}
                  />
                </ErrorBoundary>
                
                {/* Quick stats */}
                <div className="flex gap-3 ml-auto">
                  <div className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                    <p className="text-2xl font-bold text-green-400">{missions.filter(m => m.status === 'succeeded').length}</p>
                    <p className="text-xs text-gray-500">完成任务</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                    <p className="text-2xl font-bold text-blue-400">{conversations.length}</p>
                    <p className="text-xs text-gray-500">团队对话</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg px-4 py-2 text-center">
                    <p className="text-2xl font-bold text-purple-400">{events.length}</p>
                    <p className="text-xs text-gray-500">活动事件</p>
                  </div>
                </div>
              </div>

              {/* Agent Cards Grid */}
              <div>
                <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                  🤖 AI团队 <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-400">{agents.length}个成员</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {agents.map(agent => (
                    <ErrorBoundary key={agent.id} fallback={<div className="bg-gray-800 rounded-lg p-2">Agent不可用</div>}>
                      <AgentCard 
                        agent={{
                          ...agent,
                          status: activeConversation?.participants.includes(agent.id) ? 'talking' : 
                                  missions.some(m => m.status === 'running' && m.created_by === agent.id) ? 'working' : 'online'
                        }}
                        isActive={activeConversation?.participants.includes(agent.id)}
                      />
                    </ErrorBoundary>
                  ))}
                </div>
              </div>

              {/* Main content: Office + Proposals side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pixel Office */}
                <div className="lg:col-span-2">
                  <ErrorBoundary fallback={<div className="bg-gray-800 rounded-lg p-4">Office unavailable</div>}>
                    <PixelOffice 
                      agents={agents} 
                      activeConversation={activeConversation}
                      recentTasks={missions.slice(0, 10).map(m => ({
                        id: m.id,
                        title: m.title,
                        agent: m.created_by,
                        status: m.status as 'running' | 'succeeded' | 'failed',
                        completedAt: m.completed_at
                      }))}
                    />
                  </ErrorBoundary>
                </div>

                {/* Pending Proposals */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700">
                  <h2 className="font-bold mb-3 flex items-center gap-2">
                    📋 待审提案
                    {proposals.length > 0 && (
                      <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full animate-pulse">{proposals.length}</span>
                    )}
                  </h2>
                  {proposals.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">✨</p>
                      <p className="text-gray-500 text-sm">暂无待审提案</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {proposals.map(p => (
                        <div key={p.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                          <p className="font-medium text-sm">{p.title}</p>
                          <p className="text-xs text-gray-400 mt-1">{agents.find(a => a.id === p.agent_id)?.display_name || p.agent_id}</p>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => approveProposal(p.id)} className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium transition-colors">✓ 批准</button>
                            <button onClick={() => rejectProposal(p.id)} className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium transition-colors">✗ 拒绝</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Task Kanban */}
              <ErrorBoundary fallback={<div className="bg-gray-800 rounded-lg p-4">看板不可用</div>}>
                <TaskKanban tasks={missions.map(m => ({
                  id: m.id,
                  title: m.title,
                  status: m.status as 'queued' | 'running' | 'succeeded' | 'failed',
                  agent: m.created_by,
                  priority: m.priority,
                  created_at: m.created_at,
                  completed_at: m.completed_at
                }))} />
              </ErrorBoundary>

              {/* Conversation Panel */}
              <ErrorBoundary fallback={<div className="bg-gray-800 rounded-lg p-4">对话面板不可用</div>}>
                <ConversationPanel conversations={conversations} />
              </ErrorBoundary>

              {/* Activity Feed */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700">
                <h2 className="font-bold mb-3 flex items-center gap-2">
                  📡 实时活动流
                  <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-400">{events.length}条</span>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-auto" title="实时更新中" />
                </h2>
                <ErrorBoundary fallback={<div>活动流不可用</div>}>
                  <VirtualizedEventList events={events} />
                </ErrorBoundary>
              </div>

              {/* Relationships at bottom */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700">
                <h2 className="font-bold mb-3 flex items-center gap-2">
                  🤝 经纪人关系 
                  <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-400">{relationships.length}对</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {relationships.map(r => (
                    <div key={`${r.agent_a}-${r.agent_b}`} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium">{r.agent_a_name} ↔ {r.agent_b_name}</span>
                        <span className={`text-sm font-bold ${r.affinity >= 0.7 ? 'text-green-400' : r.affinity >= 0.5 ? 'text-blue-400' : r.affinity >= 0.3 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {(r.affinity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${r.affinity >= 0.7 ? 'bg-green-500' : r.affinity >= 0.5 ? 'bg-blue-500' : r.affinity >= 0.3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${r.affinity * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <div key={agent.id} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-lg">
                      {agent.voice_base?.emoji || '🤖'}
                    </div>
                    <div>
                      <h3 className="font-semibold">{agent.display_name}</h3>
                      <p className="text-xs text-gray-400">{agent.id}</p>
                    </div>
                  </div>
                  {agent.backstory && <p className="text-sm text-gray-400 mb-3 line-clamp-2">{agent.backstory}</p>}
                  {agent.stats && (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-gray-700 rounded p-2">
                        <p className="text-lg font-bold text-blue-400">{agent.stats.insights}</p>
                        <p className="text-gray-400">Insights</p>
                      </div>
                      <div className="bg-gray-700 rounded p-2">
                        <p className="text-lg font-bold text-green-400">{agent.stats.lessons}</p>
                        <p className="text-gray-400">Lessons</p>
                      </div>
                      <div className="bg-gray-700 rounded p-2">
                        <p className="text-lg font-bold text-purple-400">{agent.stats.successful_missions}</p>
                        <p className="text-gray-400">Missions</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'conversations' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="font-semibold mb-3">📅 Schedule Conversation</h2>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const data = new FormData(form);
                    scheduleConversation(
                      data.get('format') as string,
                      data.get('topic') as string,
                      (data.get('participants') as string).split(',').map(s => s.trim())
                    );
                    form.reset();
                  }}
                  className="flex flex-wrap gap-2"
                >
                  <select name="format" className="bg-gray-700 rounded px-3 py-1.5 text-sm">
                    <option value="standup">Standup</option>
                    <option value="debate">Debate</option>
                    <option value="brainstorm">Brainstorm</option>
                    <option value="watercooler">Watercooler</option>
                    <option value="planning">Planning</option>
                    <option value="retrospective">Retrospective</option>
                    <option value="review">Code Review</option>
                    <option value="oneonone">1:1</option>
                    <option value="pitch">Pitch</option>
                    <option value="consensus">Consensus</option>
                    <option value="social">Social</option>
                  </select>
                  <input name="topic" placeholder="Topic..." className="bg-gray-700 rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]" required />
                  <input name="participants" placeholder="xiaobei, clawd2, clawd3" defaultValue="xiaobei, clawd2" className="bg-gray-700 rounded px-3 py-1.5 text-sm" />
                  <button type="submit" className="bg-green-600 hover:bg-green-700 rounded px-4 py-1.5 text-sm">Schedule</button>
                </form>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="font-semibold mb-3">💬 Conversations ({conversations.length})</h2>
                <div className="space-y-2">
                  {conversations.map(c => (
                    <div key={c.id} className="bg-gray-700 rounded p-3">
                      <div 
                        className="flex justify-between items-start cursor-pointer"
                        onClick={() => setExpandedConversation(expandedConversation === c.id ? null : c.id)}
                      >
                        <div>
                          <span className={`px-2 py-0.5 rounded text-xs mr-2 ${statusColors[c.status]}`}>{c.format}</span>
                          <span className="font-medium">{c.topic}</span>
                          {c.history && c.history.length > 0 && (
                            <span className="text-xs text-gray-400 ml-2">({c.history.length} turns)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{format(new Date(c.created_at), 'MMM d HH:mm')}</span>
                          <span className="text-gray-400">{expandedConversation === c.id ? '▼' : '▶'}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">Participants: {c.participants.join(', ')}</p>
                      
                      {/* Expanded History */}
                      {expandedConversation === c.id && c.history && c.history.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-600 space-y-2 max-h-96 overflow-y-auto">
                          {c.history.map((turn, idx) => (
                            <div key={idx} className="bg-gray-800 rounded p-2 text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-green-400">{turn.speaker}</span>
                                {turn.turn !== undefined && <span className="text-xs text-gray-500">#{turn.turn}</span>}
                              </div>
                              <p className="text-gray-300 whitespace-pre-wrap">{turn.dialogue || turn.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3">🧠 Agent Memories</h2>
              <p className="text-gray-400 text-sm mb-4">5 memory types: insight, pattern, strategy, preference, lesson</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map(agent => (
                  <div key={agent.id} className="bg-gray-700 rounded p-3">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      {agent.voice_base?.emoji || '🤖'} {agent.display_name}
                    </h3>
                    {agent.stats ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-gray-400">Insights</span><span className="text-blue-400">{agent.stats.insights}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Lessons</span><span className="text-green-400">{agent.stats.lessons}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Strategies</span><span className="text-purple-400">{agent.stats.strategies}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Patterns</span><span className="text-yellow-400">{agent.stats.patterns}</span></div>
                        <div className="flex justify-between border-t border-gray-600 pt-1 mt-1">
                          <span className="text-gray-400">Avg Confidence</span>
                          <span>{((agent.stats.avg_confidence || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No stats available</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="font-semibold mb-3">⚡ Circuit Breakers ({circuits.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {circuits.map(c => (
                    <div key={c.service} className="bg-gray-700 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{c.service.replace(/_/g, ' ')}</span>
                        <span className={`w-3 h-3 rounded-full ${statusColors[c.state]}`} />
                      </div>
                      <p className="text-xs text-gray-400">{c.state} • {c.failure_count} failures</p>
                      {c.state !== 'closed' && (
                        <button onClick={() => resetCircuitBreaker(c.service)} className="mt-2 text-xs text-blue-400 hover:text-blue-300">Reset</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="font-semibold mb-3">📊 System Stats</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-400">{missions.length}</p>
                    <p className="text-sm text-gray-400">Total Missions</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-400">{proposals.length}</p>
                    <p className="text-sm text-gray-400">Pending Proposals</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-400">{agents.length}</p>
                    <p className="text-sm text-gray-400">Active Agents</p>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-purple-400">{circuits.filter(c => c.state === 'closed').length}/{circuits.length}</p>
                    <p className="text-sm text-gray-400">Services Healthy</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mission Replay Modal */}
        {selectedMission && (
          <MissionReplay mission={selectedMission} onClose={() => setSelectedMission(null)} />
        )}
      </div>
    </ErrorBoundary>
  );
}
// force redeploy Mon Feb  9 18:46:08 EST 2026
