'use client';

import { FixedSizeList as List } from 'react-window';
import { format } from 'date-fns';

interface Event {
  id: string;
  agent_id: string;
  kind: string;
  title: string;
  summary?: string;
  tags: string[];
  created_at: string;
}

interface Props {
  events: Event[];
  height?: number;
}

const AGENT_COLORS: Record<string, string> = {
  xiaobei: 'text-green-400',
  clawd2: 'text-blue-400',
  clawd3: 'text-purple-400',
  clawd4: 'text-yellow-400',
  clawd5: 'text-pink-400',
  clawd6: 'text-orange-400',
  system: 'text-gray-400'
};

export function VirtualizedEventList({ events, height = 400 }: Props) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const event = events[index];
    return (
      <div style={style} className="px-2">
        <div className="bg-gray-700 rounded p-2 text-xs mb-1">
          <div className="flex items-center justify-between">
            <span className={`font-medium ${AGENT_COLORS[event.agent_id] || 'text-gray-300'}`}>
              {event.agent_id}
            </span>
            <span className="text-gray-500">
              {format(new Date(event.created_at), 'HH:mm:ss')}
            </span>
          </div>
          <p className="text-gray-300 mt-0.5">{event.title}</p>
          {event.summary && (
            <p className="text-gray-500 text-[10px] mt-0.5 line-clamp-1">{event.summary}</p>
          )}
          {event.tags?.length > 0 && (
            <div className="flex gap-1 mt-1">
              {event.tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-1 py-0.5 bg-gray-600 rounded text-[10px]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <List
      height={height}
      itemCount={events.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
}

export default VirtualizedEventList;
