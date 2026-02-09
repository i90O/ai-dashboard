'use client';

import { useState } from 'react';
import { Plus, MoreHorizontal, CheckCircle, XCircle } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  reviewCount: number;
};

const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Set up new Telegram bot', status: 'done', priority: 'high', assignee: 'xiaobei', reviewCount: 1 },
  { id: '2', title: 'Implement image watermark removal', status: 'review', priority: 'medium', assignee: 'xiaobei', reviewCount: 2 },
  { id: '3', title: 'Research cosplay wig market', status: 'in_progress', priority: 'low', assignee: 'clawd2', reviewCount: 0 },
  { id: '4', title: 'Fix hourly news deduplication', status: 'done', priority: 'urgent', assignee: 'xiaobei', reviewCount: 1 },
  { id: '5', title: 'Build AI dashboard', status: 'in_progress', priority: 'high', assignee: 'xiaobei', reviewCount: 0 },
];

const columns = [
  { id: 'todo', title: 'Todo', color: 'bg-slate-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'review', title: 'Review', color: 'bg-amber-500' },
  { id: 'done', title: 'Done', color: 'bg-emerald-500' },
];

const priorityColors: Record<string, string> = {
  low: 'bg-slate-500/20 text-slate-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
};

const botColors: Record<string, string> = {
  xiaobei: 'bg-emerald-500',
  clawd2: 'bg-indigo-500',
  clawd3: 'bg-amber-500',
};

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);

  const handleApprove = (taskId: string) => {
    setTasks(tasks.map(t => 
      t.id === taskId ? { ...t, status: 'done' as const } : t
    ));
  };

  const handleReject = (taskId: string) => {
    setTasks(tasks.map(t => 
      t.id === taskId ? { ...t, status: 'in_progress' as const, reviewCount: t.reviewCount + 1 } : t
    ));
  };

  return (
    <div className="flex gap-4 h-full overflow-x-auto pb-4">
      {columns.map(column => {
        const columnTasks = tasks.filter(t => t.status === column.id);
        return (
          <div key={column.id} className="flex-shrink-0 w-72">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${column.color}`} />
                <h3 className="font-medium text-dark-200">{column.title}</h3>
                <span className="text-xs text-dark-500 bg-dark-700 px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>
              <button className="p-1 hover:bg-dark-700 rounded">
                <Plus className="w-4 h-4 text-dark-400" />
              </button>
            </div>

            {/* Tasks */}
            <div className="space-y-3">
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-dark-800 rounded-lg p-3 border border-dark-700 hover:border-dark-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-medium text-dark-100">{task.title}</h4>
                    <button className="p-1 hover:bg-dark-700 rounded">
                      <MoreHorizontal className="w-4 h-4 text-dark-500" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    {task.reviewCount > 0 && (
                      <span className="text-xs text-dark-500">
                        {task.reviewCount} review{task.reviewCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {task.assignee && (
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full ${botColors[task.assignee]} flex items-center justify-center text-xs text-white font-bold`}>
                          {task.assignee[0].toUpperCase()}
                        </div>
                        <span className="text-xs text-dark-400">{task.assignee}</span>
                      </div>
                      
                      {/* Review Actions */}
                      {task.status === 'review' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleApprove(task.id)}
                            className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(task.id)}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
