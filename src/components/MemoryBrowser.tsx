'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type MemoryFile = {
  id: string;
  name: string;
  content: string;
  path: string;
  type: string;
  source: string;
  updated_at: string;
};

const botColors: Record<string, string> = {
  xiaobei: 'bg-emerald-500/20 text-emerald-400 border-emerald-500',
  clawd2: 'bg-indigo-500/20 text-indigo-400 border-indigo-500',
  clawd3: 'bg-amber-500/20 text-amber-400 border-amber-500',
};

export default function MemoryBrowser() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBot, setFilterBot] = useState('all');

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/memory');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to fetch memory files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filteredFiles = files.filter(f => {
    const matchesSearch = !searchQuery || 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBot = filterBot === 'all' || f.source === filterBot;
    return matchesSearch && matchesBot;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-dark-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full gap-4">
      {/* File List */}
      <div className="w-full md:w-80 flex-shrink-0 flex flex-col">
        {/* Search & Filter */}
        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search memory..."
              className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-10 pr-4 py-2 text-dark-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterBot('all')}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                filterBot === 'all' ? 'bg-dark-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
              }`}
            >
              All
            </button>
            {['xiaobei', 'clawd2', 'clawd3'].map(bot => (
              <button
                key={bot}
                onClick={() => setFilterBot(bot)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  filterBot === bot ? botColors[bot] : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                }`}
              >
                {bot}
              </button>
            ))}
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-auto space-y-2 max-h-48 md:max-h-none">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-dark-400">
              No memory files found
            </div>
          ) : (
            filteredFiles.map(file => (
              <button
                key={file.id}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedFile?.id === file.id
                    ? 'bg-dark-700 border-emerald-500'
                    : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-dark-400" />
                  <span className="text-sm font-medium text-dark-200 truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${botColors[file.source] || 'bg-dark-600 text-dark-300'}`}>
                    {file.source}
                  </span>
                  <span className="text-xs text-dark-500">
                    {formatDistanceToNow(new Date(file.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* File Content */}
      <div className="flex-1 bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
        {selectedFile ? (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-dark-700 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-dark-100">{selectedFile.name}</h3>
                <p className="text-xs text-dark-500">{selectedFile.path}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${botColors[selectedFile.source] || 'bg-dark-600'}`}>
                {selectedFile.source}
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-dark-300 whitespace-pre-wrap font-mono">
                {selectedFile.content || 'No content'}
              </pre>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-dark-500">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select a file to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
