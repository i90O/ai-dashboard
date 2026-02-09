'use client';

import { useState } from 'react';
import { Activity, LayoutGrid, Calendar, Search, Bot, Terminal, FileText, Menu, X, Settings2 } from 'lucide-react';
import Link from 'next/link';
import ActivityFeed from '@/components/ActivityFeed';
import KanbanBoard from '@/components/KanbanBoard';
import CalendarView from '@/components/CalendarView';
import MemoryBrowser from '@/components/MemoryBrowser';
import BotStatusPanel from '@/components/BotStatusPanel';
import GlobalSearch from '@/components/GlobalSearch';
import CommandPanel from '@/components/CommandPanel';

type Tab = 'activity' | 'kanban' | 'calendar' | 'memory';

const tabs = [
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'kanban', label: 'Tasks', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'memory', label: 'Memory', icon: FileText },
] as const;

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [searchOpen, setSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen h-[100dvh] flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden h-14 bg-dark-800 border-b border-dark-700 flex items-center justify-between px-4 flex-shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-dark-700 rounded-lg"
        >
          <Menu className="w-5 h-5 text-dark-300" />
        </button>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" />
          AI Dashboard
        </h1>
        <button
          onClick={() => setSearchOpen(true)}
          className="p-2 hover:bg-dark-700 rounded-lg"
        >
          <Search className="w-5 h-5 text-dark-300" />
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile, shown as overlay when sidebarOpen */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        w-64 bg-dark-800 border-r border-dark-700 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-4 border-b border-dark-700 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-emerald-400" />
            AI Dashboard
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-dark-700 rounded"
          >
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'text-dark-300 hover:bg-dark-700'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
          
          {/* Ops Center Link */}
          <div className="mt-6 pt-4 border-t border-dark-700">
            <Link
              href="/ops"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-dark-300 hover:bg-dark-700 hover:text-emerald-400 transition-colors"
            >
              <Settings2 className="w-5 h-5" />
              Ops Center
            </Link>
          </div>
        </nav>

        {/* Command Center Button */}
        <div className="p-4 border-t border-dark-700">
          <button
            onClick={() => {
              setCommandOpen(true);
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-300 hover:text-emerald-400 transition-colors"
          >
            <Terminal className="w-5 h-5" />
            Command Center
          </button>
        </div>

        {/* Bot Status Panel */}
        <BotStatusPanel />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Desktop Header */}
        <header className="hidden md:flex h-14 bg-dark-800 border-b border-dark-700 items-center justify-between px-6 flex-shrink-0">
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
        <div className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          {activeTab === 'activity' && <ActivityFeed />}
          {activeTab === 'kanban' && <KanbanBoard />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'memory' && <MemoryBrowser />}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-700 flex justify-around items-center h-16 z-30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activeTab === tab.id
                ? 'text-emerald-400'
                : 'text-dark-400'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-xs mt-1">{tab.label}</span>
          </button>
        ))}
        <button
          onClick={() => setCommandOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full text-dark-400"
        >
          <Terminal className="w-5 h-5" />
          <span className="text-xs mt-1">Command</span>
        </button>
      </nav>

      {/* Global Search Modal */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {/* Command Panel Modal */}
      {commandOpen && <CommandPanel onClose={() => setCommandOpen(false)} />}
    </div>
  );
}
