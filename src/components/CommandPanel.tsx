'use client';

import { useState } from 'react';
import { Send, Terminal, X } from 'lucide-react';

type Props = {
  onClose: () => void;
};

const botColors: Record<string, string> = {
  xiaobei: 'bg-emerald-500',
  clawd2: 'bg-indigo-500',
  clawd3: 'bg-amber-500',
};

export default function CommandPanel({ onClose }: Props) {
  const [selectedBot, setSelectedBot] = useState('xiaobei');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    setSending(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer xiaobei-mc-2026',
        },
        body: JSON.stringify({
          botId: selectedBot,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to send command');
      } else {
        setResponse(JSON.stringify(data.response, null, 2));
        setMessage('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-lg w-full max-w-[600px] mx-4 max-h-[85vh] flex flex-col border border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold">Command Center</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded">
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>

        {/* Bot Selector */}
        <div className="p-4 border-b border-dark-700">
          <label className="block text-sm text-dark-400 mb-2">Send to:</label>
          <div className="flex gap-2">
            {['xiaobei', 'clawd2', 'clawd3'].map(bot => (
              <button
                key={bot}
                onClick={() => setSelectedBot(bot)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  selectedBot === bot
                    ? 'bg-dark-600 ring-2 ring-emerald-500'
                    : 'bg-dark-700 hover:bg-dark-600'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${botColors[bot]}`} />
                <span className="text-sm">{bot}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <div className="p-4 flex-1 overflow-auto">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Enter command or message..."
            className="w-full h-32 bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-dark-100 focus:outline-none focus:border-emerald-500 resize-none font-mono text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter' && e.metaKey) {
                handleSend();
              }
            }}
          />
          
          {/* Response */}
          {response && (
            <div className="mt-4">
              <label className="block text-sm text-dark-400 mb-2">Response:</label>
              <pre className="bg-dark-900 border border-dark-700 rounded-lg p-4 text-sm text-emerald-400 overflow-auto max-h-48 font-mono">
                {response}
              </pre>
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark-700">
          <span className="text-xs text-dark-500">⌘+Enter to send</span>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
