'use client';

interface Task {
  id: string;
  title: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  agent?: string;
  priority?: number;
  created_at: string;
  completed_at?: string;
}

interface Props {
  tasks: Task[];
}

const COLUMNS = [
  { id: 'queued', title: '📋 待办', color: 'border-gray-500', bg: 'bg-gray-800/50' },
  { id: 'running', title: '🔄 进行中', color: 'border-blue-500', bg: 'bg-blue-900/30' },
  { id: 'succeeded', title: '✅ 已完成', color: 'border-green-500', bg: 'bg-green-900/30' },
  { id: 'failed', title: '❌ 失败', color: 'border-red-500', bg: 'bg-red-900/30' }
];

export function TaskKanban({ tasks }: Props) {
  const getTasksByStatus = (status: string) => {
    return tasks.filter(t => t.status === status).slice(0, 5);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700">
      <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
        📊 任务看板
        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-400">
          共 {tasks.length} 个任务
        </span>
      </h2>

      <div className="grid grid-cols-4 gap-3">
        {COLUMNS.map(col => {
          const colTasks = getTasksByStatus(col.id);
          return (
            <div key={col.id} className={`${col.bg} rounded-lg border-t-2 ${col.color} min-h-[200px]`}>
              {/* Column header */}
              <div className="p-2 border-b border-gray-700">
                <h3 className="text-sm font-semibold flex items-center justify-between">
                  {col.title}
                  <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">
                    {colTasks.length}
                  </span>
                </h3>
              </div>

              {/* Tasks */}
              <div className="p-2 space-y-2">
                {colTasks.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">无任务</p>
                ) : (
                  colTasks.map(task => (
                    <TaskCard key={task.id} task={task} formatTime={formatTime} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, formatTime }: { task: Task; formatTime: (d: string) => string }) {
  const priorityColors = {
    3: 'border-l-red-500',
    2: 'border-l-yellow-500',
    1: 'border-l-green-500',
    0: 'border-l-gray-500'
  };

  return (
    <div 
      className={`
        bg-gray-800 rounded-lg p-2 border-l-2
        ${priorityColors[task.priority as keyof typeof priorityColors] || 'border-l-gray-500'}
        hover:bg-gray-750 transition-colors cursor-pointer
      `}
    >
      <p className="text-xs font-medium text-gray-200 truncate">
        {task.title}
      </p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-500">
          {task.agent || 'system'}
        </span>
        <span className="text-[10px] text-gray-600">
          {formatTime(task.completed_at || task.created_at)}
        </span>
      </div>
      
      {/* Running animation */}
      {task.status === 'running' && (
        <div className="mt-1.5 h-1 bg-gray-700 rounded overflow-hidden">
          <div className="h-full w-1/2 bg-blue-500 animate-pulse rounded" 
            style={{ animation: 'loading 1.5s ease-in-out infinite' }} 
          />
        </div>
      )}
    </div>
  );
}

export default TaskKanban;
