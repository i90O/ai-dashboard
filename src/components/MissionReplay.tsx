'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Step {
  id: string;
  seq?: number;
  kind: string;
  status: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  started_at?: string;
  completed_at?: string;
}

interface Mission {
  id: string;
  title: string;
  status: string;
  created_by: string;
  created_at: string;
  completed_at?: string;
  steps?: Step[];
}

interface Props {
  mission: Mission;
  onClose: () => void;
}

export function MissionReplay({ mission, onClose }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  
  const steps = mission.steps || [];
  const step = steps[currentStep];
  const progress = steps.length > 0 
    ? ((currentStep + 1) / steps.length) * 100 
    : 0;

  // Auto-advance when playing
  useEffect(() => {
    if (!playing) return;
    if (currentStep >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setCurrentStep(s => s + 1);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [playing, currentStep, steps.length]);

  const getStepIcon = (kind: string) => {
    const icons: Record<string, string> = {
      crawl: '🕷️',
      research: '🔬',
      analyze: '📊',
      draft_tweet: '✍️',
      write_content: '📝',
      review: '👀',
      diagnose: '🩺'
    };
    return icons[kind] || '⚙️';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'running': return 'bg-blue-500 animate-pulse';
      case 'queued': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-semibold text-lg">{mission.title}</h2>
              <p className="text-sm text-gray-400">
                by {mission.created_by} • {format(new Date(mission.created_at), 'MMM d HH:mm')}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-700">
          <div 
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step display */}
        <div className="p-6">
          {step && (
            <div className="text-center">
              <div className="text-4xl mb-3">{getStepIcon(step.kind)}</div>
              <h3 className="text-xl font-semibold mb-2">
                Step {step.seq}: {step.kind}
              </h3>
              <div className={`inline-block px-2 py-1 rounded text-sm ${getStatusColor(step.status)}`}>
                {step.status}
              </div>
              
              {/* Payload */}
              <div className="mt-4 bg-gray-900 rounded p-3 text-left">
                <p className="text-xs text-gray-500 mb-1">Payload:</p>
                <pre className="text-xs text-gray-300 overflow-auto">
                  {JSON.stringify(step.payload, null, 2)}
                </pre>
              </div>
              
              {/* Result */}
              {step.result && (
                <div className="mt-3 bg-gray-900 rounded p-3 text-left">
                  <p className="text-xs text-gray-500 mb-1">Result:</p>
                  <pre className="text-xs text-green-300 overflow-auto max-h-32">
                    {JSON.stringify(step.result, null, 2)}
                  </pre>
                </div>
              )}

              {/* Timing */}
              {step.started_at && (
                <p className="text-xs text-gray-500 mt-3">
                  {format(new Date(step.started_at), 'HH:mm:ss')}
                  {step.completed_at && ` → ${format(new Date(step.completed_at), 'HH:mm:ss')}`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="px-6 pb-4">
          <div className="flex gap-1 justify-center">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setCurrentStep(i); setPlaying(false); }}
                className={`w-8 h-2 rounded transition-all ${
                  i === currentStep 
                    ? 'bg-blue-500' 
                    : i < currentStep 
                      ? 'bg-green-500/50' 
                      : 'bg-gray-600'
                }`}
                title={`Step ${s.seq}: ${s.kind}`}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-gray-700 flex justify-center gap-3">
          <button
            onClick={() => setCurrentStep(0)}
            disabled={currentStep === 0}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
          >
            ⏮️ Start
          </button>
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
          >
            ◀️ Prev
          </button>
          <button
            onClick={() => setPlaying(!playing)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            {playing ? '⏸️ Pause' : '▶️ Play'}
          </button>
          <button
            onClick={() => setCurrentStep(s => Math.min(steps.length - 1, s + 1))}
            disabled={currentStep >= steps.length - 1}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
          >
            Next ▶️
          </button>
          <button
            onClick={() => setCurrentStep(steps.length - 1)}
            disabled={currentStep >= steps.length - 1}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
          >
            End ⏭️
          </button>
        </div>
      </div>
    </div>
  );
}

export default MissionReplay;
