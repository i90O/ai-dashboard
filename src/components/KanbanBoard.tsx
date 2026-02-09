'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MoreHorizontal, CheckCircle, XCircle, X, RefreshCw } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  assigned_by?: string;
  review_count: number;
  first_try_success?: boolean;
  retro_note?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
};

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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addToColumn, setAddToColumn] = useState<string>('todo');
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium', assignee: 'xiaobei' });

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          status: addToColumn,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks([...tasks, data.task]);
        setNewTask({ title: '', description: '', priority: 'medium', assignee: 'xiaobei' });
        setShowAddModal(false);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string, extraFields?: Partial<Task>) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          ...extraFields,
        }),
      });
      if (res.ok) {
        setTasks(tasks.map(t => 
          t.id === taskId ? { ...t, status: newStatus as Task['status'], ...extraFields } : t
        ));
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleApprove = (task: Task) => {
    handleUpdateStatus(task.id, 'done', {
      completed_at: new Date().toISOString(),
      first_try_success: task.review_count === 0,
    });
  };

  const handleReject = (task: Task) => {
    handleUpdateStatus(task.id, 'in_progress', {
      review_count: task.review_count + 1,
    });
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== taskId));
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-dark-400" />
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 h-full overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
        {columns.map(column => {
          const columnTasks = tasks.filter(t => t.status === column.id);
          return (
            <div key={column.id} className="flex-shrink-0 w-[85vw] sm:w-72 snap-center md:snap-align-none">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-medium text-dark-200">{column.title}</h3>
                  <span className="text-xs text-dark-500 bg-dark-700 px-2 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
                <button 
                  onClick={() => { setAddToColumn(column.id); setShowAddModal(true); }}
                  className="p-1 hover:bg-dark-700 rounded"
                >
                  <Plus className="w-4 h-4 text-dark-400" />
                </button>
              </div>

              {/* Tasks */}
              <div className="space-y-3">
                {columnTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-dark-800 rounded-lg p-3 border border-dark-700 hover:border-dark-600 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-medium text-dark-100">{task.title}</h4>
                      <div className="relative">
                        <button 
                          onClick={() => handleDelete(task.id)}
                          className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-dark-400 mt-1 line-clamp-2">{task.description}</p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${priorityColors[task.priority]}`}>
                        {task.priority}
                      </span>
                      {task.review_count > 0 && (
                        <span className="text-xs text-dark-500">
                          {task.review_count} review{task.review_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {task.assignee && (
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full ${botColors[task.assignee] || 'bg-dark-600'} flex items-center justify-center text-xs text-white font-bold`}>
                            {task.assignee[0].toUpperCase()}
                          </div>
                          <span className="text-xs text-dark-400">{task.assignee}</span>
                        </div>
                        
                        {/* Review Actions */}
                        {task.status === 'review' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleApprove(task)}
                              className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(task)}
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

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-lg p-6 w-96 border border-dark-700">
            <h3 className="text-lg font-semibold mb-4">Add Task to {columns.find(c => c.id === addToColumn)?.title}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-300 mb-1">Title</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:border-emerald-500"
                  placeholder="Task title..."
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm text-dark-300 mb-1">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:border-emerald-500 h-20 resize-none"
                  placeholder="Optional description..."
                />
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-dark-300 mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm text-dark-300 mb-1">Assignee</label>
                  <select
                    value={newTask.assignee}
                    onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}
                    className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-dark-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="xiaobei">xiaobei</option>
                    <option value="clawd2">clawd2</option>
                    <option value="clawd3">clawd3</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-dark-300 hover:text-dark-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
