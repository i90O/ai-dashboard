'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, CheckSquare, Clock, Activity } from 'lucide-react';

type SearchResult = {
  id: string;
  type: 'activity' | 'task' | 'memory' | 'scheduled';
  title: string;
  description?: string;
  source: string;
};

const MOCK_RESULTS: SearchResult[] = [
  { id: '1', type: 'activity', title: 'Tech news digest sent', source: 'xiaobei' },
  { id: '2', type: 'task', title: 'Build AI dashboard', description: 'Create management console', source: 'xiaobei' },
  { id: '3', type: 'memory', title: 'MEMORY.md', description: 'Long-term memory file', source: 'xiaobei' },
  { id: '4', type: 'scheduled', title: 'Hourly crypto update', source: 'xiaobei' },
];

const typeIcons: Record<string, React.ReactNode> = {
  activity: <Activity className="w-4 h-4" />,
  task: <CheckSquare className="w-4 h-4" />,
  memory: <FileText className="w-4 h-4" />,
  scheduled: <Clock className="w-4 h-4" />,
};

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (query.length > 0) {
      // Filter mock results
      const filtered = MOCK_RESULTS.filter(r => 
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.description?.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Search Modal */}
      <div className="relative w-full max-w-xl bg-dark-800 rounded-xl shadow-2xl border border-dark-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-dark-700">
          <Search className="w-5 h-5 text-dark-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search activities, tasks, memory..."
            className="flex-1 bg-transparent text-dark-100 placeholder-dark-500 outline-none"
          />
          <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded">
            <X className="w-5 h-5 text-dark-500" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-96 overflow-y-auto p-2">
            {results.map(result => (
              <button
                key={result.id}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-dark-700 transition-colors text-left"
              >
                <div className="text-dark-400">
                  {typeIcons[result.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-100 truncate">{result.title}</p>
                  {result.description && (
                    <p className="text-xs text-dark-500 truncate">{result.description}</p>
                  )}
                </div>
                <span className="text-xs text-dark-500">{result.source}</span>
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {query.length > 0 && results.length === 0 && (
          <div className="p-8 text-center text-dark-500">
            No results found for "{query}"
          </div>
        )}

        {/* Keyboard Hints */}
        <div className="flex items-center justify-between p-3 border-t border-dark-700 text-xs text-dark-500">
          <span>Type to search</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
}
