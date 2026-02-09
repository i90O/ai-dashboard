'use client';

import { useState } from 'react';
import { Bot, Key, Bell, Database, Save, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [bots, setBots] = useState([
    { id: 'xiaobei', name: '小北', color: '#10B981', token: '' },
    { id: 'clawd2', name: 'clawd2', color: '#6366F1', token: '' },
    { id: 'clawd3', name: 'clawd3', color: '#F59E0B', token: '' },
  ]);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    // TODO: Save to backend
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-dark-700 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Bot Configuration */}
        <section className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          <div className="p-4 border-b border-dark-700 flex items-center gap-3">
            <Bot className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold">Bot Configuration</h2>
          </div>
          <div className="p-4 space-y-4">
            {bots.map((bot, index) => (
              <div key={bot.id} className="flex items-center gap-4 p-3 bg-dark-700/50 rounded-lg">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: bot.color }}
                >
                  {bot.name[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={bot.name}
                    onChange={(e) => {
                      const newBots = [...bots];
                      newBots[index].name = e.target.value;
                      setBots(newBots);
                    }}
                    className="bg-transparent text-dark-100 font-medium focus:outline-none"
                  />
                  <p className="text-xs text-dark-500">{bot.id}</p>
                </div>
                <input
                  type="password"
                  placeholder="API Token"
                  value={bot.token}
                  onChange={(e) => {
                    const newBots = [...bots];
                    newBots[index].token = e.target.value;
                    setBots(newBots);
                  }}
                  className="flex-1 bg-dark-600 border border-dark-500 rounded px-3 py-1.5 text-sm text-dark-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="color"
                  value={bot.color}
                  onChange={(e) => {
                    const newBots = [...bots];
                    newBots[index].color = e.target.value;
                    setBots(newBots);
                  }}
                  className="w-8 h-8 rounded cursor-pointer"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          <div className="p-4 border-b border-dark-700 flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold">Notifications</h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: 'Activity alerts', desc: 'Notify on errors and warnings' },
              { label: 'Task completion', desc: 'Notify when bots complete tasks' },
              { label: 'Daily digest', desc: 'Send daily summary email' },
            ].map((item) => (
              <label key={item.label} className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg cursor-pointer">
                <div>
                  <p className="text-dark-100">{item.label}</p>
                  <p className="text-xs text-dark-500">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded bg-dark-600 border-dark-500 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Database */}
        <section className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          <div className="p-4 border-b border-dark-700 flex items-center gap-3">
            <Database className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold">Database</h2>
          </div>
          <div className="p-4">
            <p className="text-sm text-dark-400 mb-3">Supabase connection</p>
            <input
              type="password"
              placeholder="postgresql://..."
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-dark-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  );
}
