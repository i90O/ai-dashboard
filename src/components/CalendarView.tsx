'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Repeat } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';

type ScheduledTask = {
  id: string;
  title: string;
  type: 'cron' | 'one-time';
  cronExpression?: string;
  status: 'active' | 'paused' | 'completed';
  source: string;
  time?: string;
};

const MOCK_SCHEDULED: ScheduledTask[] = [
  { id: '1', title: 'Tech News Digest', type: 'cron', cronExpression: '0 9,14,20 * * *', status: 'active', source: 'xiaobei', time: '09:00' },
  { id: '2', title: 'Crypto Price Update', type: 'cron', cronExpression: '0 * * * *', status: 'active', source: 'xiaobei', time: 'hourly' },
  { id: '3', title: 'Daily Reflection Tweet', type: 'cron', cronExpression: '0 22 * * *', status: 'active', source: 'xiaobei', time: '22:00' },
  { id: '4', title: 'Memory Cleanup', type: 'cron', cronExpression: '0 3 * * *', status: 'paused', source: 'clawd2', time: '03:00' },
];

const botColors: Record<string, string> = {
  xiaobei: 'bg-emerald-500',
  clawd2: 'bg-indigo-500',
  clawd3: 'bg-amber-500',
};

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="lg:col-span-2 bg-dark-800 rounded-lg p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{format(currentDate, 'MMMM yyyy')}</h3>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="p-2 hover:bg-dark-700 rounded">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-dark-700 rounded">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm text-dark-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Padding for start of month */}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}
          
          {days.map(day => (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors
                ${isToday(day) ? 'bg-emerald-500/20 text-emerald-400 font-bold' : ''}
                ${selectedDate?.toDateString() === day.toDateString() ? 'ring-2 ring-emerald-500' : ''}
                ${!isSameMonth(day, currentDate) ? 'text-dark-600' : 'text-dark-200 hover:bg-dark-700'}
              `}
            >
              {format(day, 'd')}
              {/* Task indicators */}
              <div className="flex gap-0.5 mt-0.5">
                {MOCK_SCHEDULED.slice(0, 3).map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-emerald-500" />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled Tasks List */}
      <div className="bg-dark-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Scheduled Tasks</h3>
        <div className="space-y-3">
          {MOCK_SCHEDULED.map(task => (
            <div
              key={task.id}
              className={`p-3 rounded-lg border border-dark-700 ${
                task.status === 'paused' ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {task.type === 'cron' ? (
                    <Repeat className="w-4 h-4 text-dark-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-dark-400" />
                  )}
                  <span className="text-sm font-medium">{task.title}</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${botColors[task.source]}`} />
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-dark-500">
                <span>{task.time}</span>
                <span>•</span>
                <span>{task.source}</span>
                <span className={`ml-auto px-2 py-0.5 rounded ${
                  task.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                  task.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
