'use client';

import { useRef, useState, useEffect } from 'react';
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

const ITEM_HEIGHT = 80;

export function VirtualizedEventList({ events, height = 400 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  const endIndex = Math.min(startIndex + Math.ceil(height / ITEM_HEIGHT) + 1, events.length);
  
  const visibleEvents = events.slice(startIndex, endIndex);
  const totalHeight = events.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="overflow-y-auto"
      style={{ height }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, width: '100%' }}>
          {visibleEvents.map((event, i) => (
            <div key={event.id} className="px-2" style={{ height: ITEM_HEIGHT }}>
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
          ))}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedEventList;
