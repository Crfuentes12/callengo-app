'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const TASKS = [
  { id: 'added_contacts', label: 'Add contacts' },
  { id: 'configured_agent', label: 'Configure agent' },
  { id: 'launched_campaign', label: 'Launch campaign' },
  { id: 'tested_agent', label: 'Test agent call' },
  { id: 'connected_google', label: 'Connect Google' },
  { id: 'viewed_analytics', label: 'View analytics' },
  { id: 'listened_call', label: 'Listen to call' },
  { id: 'viewed_transcript', label: 'View transcript' },
  { id: 'updated_contact', label: 'Update contact' },
  { id: 'explored_integrations', label: 'Explore integrations' },
];

interface ProgressTrackerProps {
  initialTasks?: Record<string, boolean>;
}

export default function ProgressTracker({ initialTasks = {} }: ProgressTrackerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [tasks, setTasks] = useState<Record<string, boolean>>(initialTasks);
  const [recentlyCompleted, setRecentlyCompleted] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('callengo:progress_dismissed') === '1';
  });
  const [caliMinimized, setCaliMinimized] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completedCount = Object.values(tasks).filter(Boolean).length;
  const totalTasks = TASKS.length;
  const progressPercent = Math.round((completedCount / totalTasks) * 100);
  const allComplete = completedCount === totalTasks;

  // Fetch progress on mount
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch('/api/get-started');
        if (res.ok) {
          const data = await res.json();
          if (data.progress) {
            setTasks(prev => ({ ...prev, ...data.progress }));
          }
        }
      } catch {
        // Silently fail
      }
    };
    fetchProgress();
  }, []);

  // Listen for task completion events
  useEffect(() => {
    const handler = (e: CustomEvent<{ taskId: string }>) => {
      const { taskId } = e.detail;
      setTasks(prev => {
        if (prev[taskId]) return prev;
        return { ...prev, [taskId]: true };
      });
      setRecentlyCompleted(taskId);
      setIsExpanded(true);

      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = setTimeout(() => {
        setRecentlyCompleted(null);
        setIsExpanded(false);
      }, 3000);

      // Persist to server
      fetch('/api/get-started', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      }).catch(() => {});
    };

    window.addEventListener('callengo:task-complete', handler as EventListener);
    return () => {
      window.removeEventListener('callengo:task-complete', handler as EventListener);
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  // Listen for Cali minimize/restore events to shift position
  useEffect(() => {
    const handler = (e: CustomEvent<{ minimized: boolean }>) => {
      setCaliMinimized(e.detail.minimized);
    };
    window.addEventListener('callengo:cali-minimized', handler as EventListener);
    return () => window.removeEventListener('callengo:cali-minimized', handler as EventListener);
  }, []);

  const handleDismiss = () => {
    setIsExpanded(false);
    // Small delay before hiding so the panel can animate closed first
    setTimeout(() => {
      setDismissed(true);
      sessionStorage.setItem('callengo:progress_dismissed', '1');
    }, 300);
  };

  const handleToggle = () => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsExpanded(prev => !prev);
  };

  // Don't show on onboarding or home page
  if (pathname === '/onboarding' || pathname === '/home') return null;
  if (dismissed || allComplete) return null;

  return (
    <div
      className="fixed bottom-4 z-40 transition-[right] duration-300 ease-in-out"
      style={{ right: caliMinimized ? '168px' : '16px' }}
    >
      {/* Expanded panel — always in DOM, animated with max-height + opacity */}
      <div
        className="mb-2 bg-white border border-[var(--border-default)] rounded-xl shadow-2xl w-72 overflow-hidden"
        style={{
          maxHeight: isExpanded ? '360px' : '0px',
          opacity: isExpanded ? 1 : 0,
          transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
      >
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--color-ink)]">Your Progress</p>
            <p className="text-xs text-[var(--color-neutral-500)]">{completedCount}/{totalTasks} completed</p>
          </div>
          <span className="text-lg font-black text-[var(--color-primary)]">{progressPercent}%</span>
        </div>
        <div className="p-3 max-h-[220px] overflow-y-auto">
          <div className="space-y-1">
            {TASKS.map((task) => {
              const isCompleted = tasks[task.id];
              const isRecent = recentlyCompleted === task.id;
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-all ${
                    isRecent ? 'bg-[var(--color-success-50)] border border-[var(--color-success-200)]' : ''
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isCompleted ? 'bg-[var(--color-success-500)]' : 'border border-[var(--color-neutral-300)]'
                    } ${isRecent ? 'animate-bounce' : ''}`}
                  >
                    {isCompleted && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      isCompleted ? 'line-through text-[var(--color-neutral-400)]' : 'text-[var(--color-ink)]'
                    }`}
                  >
                    {task.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <button
            onClick={() => router.push('/home')}
            className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline"
          >
            View all tasks
          </button>
          <button
            onClick={handleDismiss}
            className="text-[10px] text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)]"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Minimized pill */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-[var(--border-default)] rounded-full shadow-lg hover:shadow-xl transition-all group"
      >
        <div className="relative w-6 h-6">
          <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--color-neutral-200)"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
              strokeDasharray={`${progressPercent}, 100`}
              className="transition-all duration-700"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-[var(--color-primary)]">
            {progressPercent}%
          </span>
        </div>
        <span className="text-xs font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-primary)] transition-colors hidden sm:inline">
          Progress
        </span>
        <svg
          className={`w-3 h-3 text-[var(--color-neutral-400)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
    </div>
  );
}
