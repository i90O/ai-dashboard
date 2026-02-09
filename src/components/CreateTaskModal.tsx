'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  onClose: () => void;
  onCreate: (task: {
    title: string;
    description?: string;
    priority: string;
    assignee?: string;
  }) => void;
};

const BOTS = ['xiaobei', 'clawd2', 'clawd3'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default function CreateTaskModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      assignee: assignee || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h3 className="text-lg font-semibold">Create Task</h3>
          <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Task title"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-dark-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-1">Assign to</label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Unassigned</option>
                {BOTS.map((bot) => (
                  <option key={bot} value={bot}>
                    {bot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-dark-700 hover:bg-dark-600 text-dark-200 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
