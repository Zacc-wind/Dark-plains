'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser, cancelJob, getJobProgress, getJobTimeRemaining } from '@/lib/auth';

export default function JobQueue() {
  const [user, setUser] = useState(getCurrentUser());
  const [isVisible, setIsVisible] = useState(true);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      setUser(getCurrentUser());
    }, 100); // Update every 100ms for smooth progress

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCancelJob = (jobId: string) => {
    cancelJob(jobId);
    setUser(getCurrentUser());
  };

  if (!user || user.jobQueue.length === 0 || now === 0) {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-24 right-4 bg-slate-900 text-yellow-300 px-4 py-2 border-2 border-amber-500 hover:border-yellow-400 transition-all shadow-lg font-bold z-30 rounded-lg"
        style={{ 
          textShadow: '1px 1px 0 #000',
          boxShadow: '0 0 0 2px rgba(245,158,11,0.5)',
          imageRendering: 'pixelated',
          backgroundColor: '#0f172a'
        }}
      >
        JOBS ({user.jobQueue.length})
      </button>
    );
  }

  return (
    <div className="fixed top-24 right-4 w-80 max-w-[calc(100vw-2rem)] z-30">
      <div className="bg-slate-900 border:0 rounded-xl p-4 shadow-2xl" style={{backgroundColor: '#0f172a' }}>
        <div className="flex justify-between items-center mb-3 border-b-2 border-amber-600 pb-2">
          <h3 className="text-yellow-300 font-bold text-lg">
            ⚒️ ACTIVE JOBS ({user.jobQueue.length}/4)
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-white hover:text-amber-300 text-2xl font-bold leading-none"
            style={{ textShadow: '1px 1px 0 #000' }}
          >
            ×
          </button>
        </div>
        
        <div className="space-y-2">
          {user.jobQueue.map((job, index) => {
            const hasStarted = now >= job.startTime;
            const progress = getJobProgress(job, now);
            const timeRemaining = getJobTimeRemaining(job, now);
            const elapsed = now - job.startTime;
            const travelDuration = job.duration - job.workDuration;
            const isTraveling = hasStarted && !job.travelComplete && elapsed < travelDuration;
            const isQueued = !hasStarted;

            return (
              <div
                key={job.id}
                className="bg-slate-800 border-2 border-amber-500 rounded-lg p-3 hover:bg-slate-700 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm truncate" style={{ textShadow: '1px 1px 0 #000' }}>
                      {job.jobName}
                    </div>
                    <div className="text-yellow-300 text-xs font-bold truncate">
                      📍 {job.poiName}
                    </div>
                    {isQueued && (
                      <div className="text-amber-400 text-xs font-bold mt-1">
                        ⏸️ Queued (#{index + 1})
                      </div>
                    )}
                    {isTraveling && !isQueued && (
                      <div className="text-cyan-300 text-xs font-bold mt-1">
                        🚶 Traveling...
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancelJob(job.id)}
                    className="ml-2 bg-red-800 hover:bg-red-700 text-red-200 font-bold px-2 py-1 border-2 border-red-600 rounded text-xs transition-all"
                    title="Cancel job"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-2">
                  <div className="bg-slate-900 border-2 border-amber-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-100 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-yellow-300">
                    ⏱️ {formatTime(timeRemaining)}
                  </span>
                  <span className="text-yellow-300">
                    {Math.floor(progress)}%
                  </span>
                </div>

                <div className="flex gap-3 mt-2 text-xs text-yellow-300 font-bold flex-wrap">
                  {job.rewards.gold > 0 && <span>💰 +{job.rewards.gold}</span>}
                  <span>⭐ +{job.rewards.exp}</span>
                  {job.rewards.rareGems && <span className="text-cyan-300">💎 +{job.rewards.rareGems}</span>}
                  {job.rewards.healthRestore && <span className="text-cyan-300">❤️ +{job.rewards.healthRestore}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
