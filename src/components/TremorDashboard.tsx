'use client';

import {
  Card,
  Metric,
  Text,
  Flex,
  Grid,
  Title,
  BarList,
  Bold,
  DonutChart,
  Legend,
  List,
  ListItem,
  Badge,
  ProgressBar,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@tremor/react';

interface Agent {
  id: string;
  display_name: string;
  stats?: {
    insights: number;
    lessons: number;
    successful_missions: number;
    avg_confidence: number;
  };
}

interface Mission {
  id: string;
  title: string;
  status: string;
  created_by: string;
  created_at: string;
}

interface Event {
  id: string;
  agent_id: string;
  kind: string;
  title: string;
  created_at: string;
  tags?: string[];
}

interface Relationship {
  agent_a: string;
  agent_b: string;
  agent_a_name: string;
  agent_b_name: string;
  affinity: number;
}

interface Conversation {
  id: string;
  format: string;
  topic: string;
  participants: string[];
  status: string;
  history?: Array<{ speaker: string; dialogue?: string }>;
}

interface Props {
  agents: Agent[];
  missions: Mission[];
  events: Event[];
  relationships: Relationship[];
  conversations: Conversation[];
  systemHealthy: boolean;
}

// Agent colors
const AGENT_COLORS: Record<string, string> = {
  xiaobei: 'orange',
  clawd2: 'blue',
  clawd3: 'green',
  clawd4: 'purple',
  clawd5: 'yellow',
  clawd6: 'red',
};

export function TremorDashboard({ 
  agents, 
  missions, 
  events, 
  relationships, 
  conversations,
  systemHealthy 
}: Props) {
  // Calculate stats
  const completedMissions = missions.filter(m => m.status === 'succeeded').length;
  const runningMissions = missions.filter(m => m.status === 'running').length;
  const totalMemories = agents.reduce((sum, a) => sum + (a.stats?.insights || 0) + (a.stats?.lessons || 0), 0);
  
  // Mission status for donut chart
  const missionStatusData = [
    { name: '成功', value: missions.filter(m => m.status === 'succeeded').length },
    { name: '运行中', value: missions.filter(m => m.status === 'running').length },
    { name: '队列中', value: missions.filter(m => m.status === 'queued').length },
    { name: '失败', value: missions.filter(m => m.status === 'failed').length },
  ].filter(d => d.value > 0);

  // Agent performance for bar list
  const agentPerformance = agents.map(a => ({
    name: a.display_name,
    value: a.stats?.successful_missions || 0,
  })).sort((a, b) => b.value - a.value);

  // Recent activity
  const recentEvents = events.slice(0, 8);

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
        <Card decoration="top" decorationColor={systemHealthy ? 'green' : 'red'}>
          <Flex justifyContent="start" className="space-x-4">
            <div className={`p-2 rounded-full ${systemHealthy ? 'bg-green-100' : 'bg-red-100'}`}>
              <span className="text-2xl">{systemHealthy ? '💚' : '💔'}</span>
            </div>
            <div>
              <Text>系统状态</Text>
              <Metric>{systemHealthy ? '正常' : '异常'}</Metric>
            </div>
          </Flex>
        </Card>

        <Card decoration="top" decorationColor="blue">
          <Flex justifyContent="start" className="space-x-4">
            <div className="p-2 rounded-full bg-blue-100">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <Text>完成任务</Text>
              <Metric>{completedMissions}</Metric>
            </div>
          </Flex>
        </Card>

        <Card decoration="top" decorationColor="purple">
          <Flex justifyContent="start" className="space-x-4">
            <div className="p-2 rounded-full bg-purple-100">
              <span className="text-2xl">🧠</span>
            </div>
            <div>
              <Text>团队记忆</Text>
              <Metric>{totalMemories}</Metric>
            </div>
          </Flex>
        </Card>

        <Card decoration="top" decorationColor="amber">
          <Flex justifyContent="start" className="space-x-4">
            <div className="p-2 rounded-full bg-amber-100">
              <span className="text-2xl">💬</span>
            </div>
            <div>
              <Text>团队对话</Text>
              <Metric>{conversations.length}</Metric>
            </div>
          </Flex>
        </Card>
      </Grid>

      {/* Main content */}
      <Grid numItemsLg={3} className="gap-6">
        {/* Agent Team */}
        <Card className="lg:col-span-2">
          <Title>🤖 AI团队</Title>
          <Grid numItemsSm={2} numItemsLg={3} className="gap-4 mt-4">
            {agents.map(agent => {
              const color = AGENT_COLORS[agent.id] || 'gray';
              const confidence = Math.round((agent.stats?.avg_confidence || 0) * 100);
              return (
                <Card key={agent.id} className="p-3">
                  <Flex justifyContent="start" className="space-x-3">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-${color}-500`}
                      style={{ backgroundColor: `var(--tremor-${color}-500, #6b7280)` }}
                    >
                      {agent.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <Text className="font-semibold">{agent.display_name}</Text>
                      <Flex className="mt-1">
                        <Badge color="green" size="xs">{agent.stats?.successful_missions || 0} 任务</Badge>
                        <Badge color="purple" size="xs" className="ml-1">{agent.stats?.insights || 0} 洞察</Badge>
                      </Flex>
                    </div>
                  </Flex>
                  <div className="mt-2">
                    <Flex>
                      <Text className="text-xs">信心度</Text>
                      <Text className="text-xs">{confidence}%</Text>
                    </Flex>
                    <ProgressBar value={confidence} color={color as any} className="mt-1" />
                  </div>
                </Card>
              );
            })}
          </Grid>
        </Card>

        {/* Mission Status */}
        <Card>
          <Title>📊 任务状态</Title>
          <DonutChart
            className="mt-4 h-40"
            data={missionStatusData}
            category="value"
            index="name"
            colors={['green', 'blue', 'gray', 'red']}
            showAnimation
          />
          <Legend
            className="mt-3"
            categories={missionStatusData.map(d => d.name)}
            colors={['green', 'blue', 'gray', 'red']}
          />
        </Card>
      </Grid>

      {/* Activity and Performance */}
      <Grid numItemsLg={2} className="gap-6">
        {/* Recent Activity */}
        <Card>
          <Title>📡 最近活动</Title>
          <List className="mt-4">
            {recentEvents.map(event => (
              <ListItem key={event.id}>
                <Flex justifyContent="start" className="truncate space-x-2">
                  <Badge color={AGENT_COLORS[event.agent_id] as any || 'gray'} size="xs">
                    {event.agent_id}
                  </Badge>
                  <Text className="truncate">{event.title}</Text>
                </Flex>
                <Text className="text-xs text-gray-500">{formatTime(event.created_at)}</Text>
              </ListItem>
            ))}
          </List>
        </Card>

        {/* Agent Performance */}
        <Card>
          <Title>🏆 Agent表现</Title>
          <Flex className="mt-4">
            <Text>Agent</Text>
            <Text>完成任务数</Text>
          </Flex>
          <BarList data={agentPerformance} className="mt-2" />
        </Card>
      </Grid>

      {/* Relationships */}
      <Card>
        <Title>🤝 团队关系</Title>
        <Grid numItemsSm={2} numItemsLg={5} className="gap-3 mt-4">
          {relationships.slice(0, 10).map(r => {
            const affinityPercent = Math.round(r.affinity * 100);
            const color = affinityPercent >= 70 ? 'green' : affinityPercent >= 50 ? 'blue' : affinityPercent >= 30 ? 'yellow' : 'red';
            return (
              <Card key={`${r.agent_a}-${r.agent_b}`} className="p-3">
                <Flex>
                  <Text className="text-xs truncate">{r.agent_a_name} ↔ {r.agent_b_name}</Text>
                  <Badge color={color as any}>{affinityPercent}%</Badge>
                </Flex>
                <ProgressBar value={affinityPercent} color={color as any} className="mt-2" />
              </Card>
            );
          })}
        </Grid>
      </Card>

      {/* Recent Conversations */}
      {conversations.length > 0 && (
        <Card>
          <Title>💬 最近对话</Title>
          <TabGroup className="mt-4">
            <TabList>
              {conversations.slice(0, 3).map(conv => (
                <Tab key={conv.id}>{conv.topic.slice(0, 15)}...</Tab>
              ))}
            </TabList>
            <TabPanels>
              {conversations.slice(0, 3).map(conv => (
                <TabPanel key={conv.id}>
                  <div className="mt-4 space-y-3">
                    <Flex>
                      <Badge>{conv.format}</Badge>
                      <Badge color={conv.status === 'completed' ? 'green' : 'blue'}>
                        {conv.status === 'completed' ? '已完成' : '进行中'}
                      </Badge>
                    </Flex>
                    <List>
                      {conv.history?.slice(0, 5).map((turn, i) => (
                        <ListItem key={i}>
                          <Bold>{turn.speaker}:</Bold>
                          <Text className="ml-2 truncate">{turn.dialogue?.slice(0, 50)}...</Text>
                        </ListItem>
                      ))}
                    </List>
                  </div>
                </TabPanel>
              ))}
            </TabPanels>
          </TabGroup>
        </Card>
      )}
    </div>
  );
}

export default TremorDashboard;
