'use client';

import { useState } from 'react';
import { Activity, LayoutGrid, Calendar, Search, Bot } from 'lucide-react';
import ActivityFeed from '@/components/ActivityFeed';
import KanbanBoard from '@/components/KanbanBoard';
import CalendarView from '@/components/CalendarView';
import BotStatusPanel from '@/components/BotStatusPanel';
import GlobalSearch from '@/components/GlobalSearch';

type Tab = 'activity' | 'kanban' | 'calendar';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
        <div className="p-4 border-b border-dark-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-emerald-400" />
            AI Dashboard
          </h1>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setActiveTab('activity')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'activity' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'text-dark-300 hover:bg-dark-700'
                }`}
              >
                <Activity className="w-5 h-5" />
                Activity Feed
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('kanban')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'kanban' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'text-dark-300 hover:bg-dark-700'
                }`}
              >
                <LayoutGrid className="w-5 h-5" />
                Kanban Board
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'calendar' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'text-dark-300 hover:bg-dark-700'
                }`}
              >
                <Calendar className="w-5 h-5" />
                Calendar
              </button>
            </li>
          </ul>
        </nav>

        {/* Bot Status Panel */}
        <BotStatusPanel />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-dark-800 border-b border-dark-700 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-dark-700 rounded-lg text-dark-300 hover:text-dark-100 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Search</span>
            <kbd className="text-xs bg-dark-600 px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'activity' && <ActivityFeed />}
          {activeTab === 'kanban' && <KanbanBoard />}
          {activeTab === 'calendar' && <CalendarView />}
        </div>
      </main>

      {/* Global Search Modal */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
