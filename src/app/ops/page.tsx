'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';

// Types
interface Agent {
  id: string;
  display_name: string;
  backstory?: string;
  stats?: {
    insights: number;
    lessons: number;
    strategies: number;
    patterns: number;
    avg_confidence: number;
    successful_missions: number;
  };
}

interface Mission {
  id: string;
  title: string;
  status: string;
  created_by: string;
  priority: number;
  created_at: string;
  steps?: Step[];
}

interface Step {
  id: string;
  kind: string;
  status: string;
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

interface Conversation {
  id: string;
  format: string;
  topic: string;
  participants: string[];
  status: string;
  created_at: string;
}

interface CircuitBreaker {
  service: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
}

// Main Component
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

  const fetchData = useCallback(async () => {
    try {
      const [
        agentsRes,
        missionsRes,
        eventsRes,
        proposalsRes,
        relationshipsRes,
        conversationsRes,
        circuitsRes
      ] = await Promise.all([
        fetch('/api/ops/agents?include_stats=true'),
        fetch('/api/ops/missions'),
        fetch('/api/ops/events?limit=50'),
        fetch('/api/ops/proposals?status=pending'),
        fetch('/api/ops/relationships'),
        fetch('/api/ops/roundtable?limit=10'),
        fetch('/api/ops/circuit-breaker')
      ]);

      const [agentsData, missionsData, eventsData, proposalsData, relData, convData, circData] = await Promise.all([
        agentsRes.json(),
        missionsRes.json(),
        eventsRes.json(),
        proposalsRes.json(),
        relationshipsRes.json(),
        conversationsRes.json(),
        circuitsRes.json()
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function approveProposal(id: string) {
    await fetch('/api/ops/proposals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_id: id, action: 'approve' })
    });
    fetchData();
  }

  async function rejectProposal(id: string) {
    await fetch('/api/ops/proposals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_id: id, action: 'reject' })
    });
    fetchData();
  }

  async function triggerHeartbeat() {
    setLoading(true);
    await fetch('/api/ops/heartbeat');
    await fetchData();
  }

  async function scheduleConversation(format: string, topic: string, participants: string[]) {
    await fetch('/api/ops/roundtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, topic, participants })
    });
    fetchData();
  }

  async function resetCircuitBreaker(service: string) {
    await fetch('/api/ops/circuit-breaker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, action: 'reset' })
    });
    fetchData();
  }

  const statusColors: Record<string, string> = {
    queued: 'bg-gray-500',
    running: 'bg-blue-500 animate-pulse',
    succeeded: 'bg-green-500',
    failed: 'bg-red-500',
    pending: 'bg-yellow-500',
    approved: 'bg-blue-400',
    completed: 'bg-green-400',
    closed: 'bg-green-500',
    open: 'bg-red-500',
    half_open: 'bg-yellow-500'
  };

  const affinityColors: Record<string, string> = {
    strong: 'text-green-400',
    friendly: 'text-blue-400',
    neutral: 'text-gray-400',
    tense: 'text-red-400'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🎛️ Ops Center
              <span className="text-sm font-normal text-gray-400">Multi-Agent Operations</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={triggerHeartbeat}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1"
            >
              💓 Heartbeat
            </button>
          </div>
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
                activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-white'
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pending Proposals */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                📋 Pending Proposals
                {proposals.length > 0 && (
                  <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">
                    {proposals.length}
                  </span>
                )}
              </h2>
              {proposals.length === 0 ? (
                <p className="text-gray-500 text-sm">No pending proposals</p>
              ) : (
                <div className="space-y-2">
                  {proposals.slice(0, 5).map(p => (
                    <div key={p.id} className="bg-gray-700 rounded p-2 text-sm">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-gray-400">
                        {agents.find(a => a.id === p.agent_id)?.display_name || p.agent_id}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => approveProposal(p.id)}
                          className="px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded text-xs"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => rejectProposal(p.id)}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 rounded text-xs"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Missions */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3">🎯 Active Missions</h2>
              {missions.length === 0 ? (
                <p className="text-gray-500 text-sm">No active missions</p>
              ) : (
                <div className="space-y-2">
                  {missions.slice(0, 5).map(m => (
                    <div key={m.id} className="bg-gray-700 rounded p-2 text-sm">
                      <div className="flex justify-between items-start">
                        <p className="font-medium">{m.title}</p>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[m.status]}`}>
                          {m.status}
                        </span>
                      </div>
                      {m.steps && m.steps.length > 0 && (
                        <div className="flex gap-0.5 mt-1">
                          {m.steps.map(s => (
                            <div
                              key={s.id}
                              className={`w-4 h-1.5 rounded ${statusColors[s.status]}`}
                              title={`${s.kind}: ${s.status}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event Stream */}
            <div className="bg-gray-800 rounded-lg p-4 lg:row-span-2">
              <h2 className="font-semibold mb-3">📡 Event Stream</h2>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {events.slice(0, 20).map(e => (
                  <div key={e.id} className="bg-gray-700 rounded p-1.5 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{e.agent_id}</span>
                      <span className="text-gray-500">
                        {format(new Date(e.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-gray-300">{e.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Relationships */}
            <div className="bg-gray-800 rounded-lg p-4 lg:col-span-2">
              <h2 className="font-semibold mb-3">🤝 Agent Relationships</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {relationships.map(r => (
                  <div key={`${r.agent_a}-${r.agent_b}`} className="bg-gray-700 rounded p-2 text-sm">
                    <div className="flex justify-between">
                      <span>{r.agent_a_name} ↔ {r.agent_b_name}</span>
                      <span className={affinityColors[r.relationship_status]}>
                        {(r.affinity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          r.affinity >= 0.7 ? 'bg-green-500' :
                          r.affinity >= 0.5 ? 'bg-blue-500' :
                          r.affinity >= 0.3 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
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
                    {agent.id === 'xiaobei' ? '🧭' : agent.id === 'clawd2' ? '📊' : '🚀'}
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.display_name}</h3>
                    <p className="text-xs text-gray-400">{agent.id}</p>
                  </div>
                </div>
                {agent.backstory && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{agent.backstory}</p>
                )}
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
            {/* Schedule New */}
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
                </select>
                <input
                  name="topic"
                  placeholder="Topic..."
                  className="bg-gray-700 rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]"
                  required
                />
                <input
                  name="participants"
                  placeholder="xiaobei, clawd2, clawd3"
                  defaultValue="xiaobei, clawd2"
                  className="bg-gray-700 rounded px-3 py-1.5 text-sm"
                />
                <button type="submit" className="bg-green-600 hover:bg-green-700 rounded px-4 py-1.5 text-sm">
                  Schedule
                </button>
              </form>
            </div>

            {/* Recent Conversations */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3">💬 Recent Conversations</h2>
              <div className="space-y-2">
                {conversations.map(c => (
                  <div key={c.id} className="bg-gray-700 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-xs mr-2 ${statusColors[c.status]}`}>
                          {c.format}
                        </span>
                        <span className="font-medium">{c.topic}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {format(new Date(c.created_at), 'MMM d HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      Participants: {c.participants.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memory' && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-3">🧠 Agent Memories</h2>
            <p className="text-gray-400 text-sm mb-4">
              5 memory types: insight, pattern, strategy, preference, lesson
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents.map(agent => (
                <div key={agent.id} className="bg-gray-700 rounded p-3">
                  <h3 className="font-medium mb-2">{agent.display_name}</h3>
                  {agent.stats && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Insights</span>
                        <span className="text-blue-400">{agent.stats.insights}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Lessons</span>
                        <span className="text-green-400">{agent.stats.lessons}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Strategies</span>
                        <span className="text-purple-400">{agent.stats.strategies}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Patterns</span>
                        <span className="text-yellow-400">{agent.stats.patterns}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-600 pt-1 mt-1">
                        <span className="text-gray-400">Avg Confidence</span>
                        <span>{((agent.stats.avg_confidence || 0) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-4">
            {/* Circuit Breakers */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3">⚡ Circuit Breakers</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {circuits.map(c => (
                  <div key={c.service} className="bg-gray-700 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{c.service.replace('_', ' ')}</span>
                      <span className={`w-3 h-3 rounded-full ${statusColors[c.state]}`} />
                    </div>
                    <p className="text-xs text-gray-400">
                      {c.state} • {c.failure_count} failures
                    </p>
                    {c.state !== 'closed' && (
                      <button
                        onClick={() => resetCircuitBreaker(c.service)}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* System Stats */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="font-semibold mb-3">📊 System Stats</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-400">{missions.length}</p>
                  <p className="text-sm text-gray-400">Active Missions</p>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-400">{proposals.length}</p>
                  <p className="text-sm text-gray-400">Pending Proposals</p>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-400">
                    {conversations.filter(c => c.status === 'running').length}
                  </p>
                  <p className="text-sm text-gray-400">Active Conversations</p>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-purple-400">
                    {circuits.filter(c => c.state === 'closed').length}/{circuits.length}
                  </p>
                  <p className="text-sm text-gray-400">Services Healthy</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
