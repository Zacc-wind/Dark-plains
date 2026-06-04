'use client';

import { useEffect, useState } from 'react';
import { cancelTravel, checkTravelComplete, getCurrentUser, getTravelProgress } from '@/lib/auth';

export default function TravelIndicator() {
  const [user, setUser] = useState(getCurrentUser());
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
      const currentUser = getCurrentUser();
      setUser(currentUser);

      if (currentUser?.traveling) {
        const travelComplete = checkTravelComplete();
        if (travelComplete) {
          setUser(getCurrentUser());
        } else {
          setProgress(getTravelProgress());
        }
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, []);

  if (!user?.traveling || now === 0) return null;

  const distance = Math.abs(user.traveling.targetX - user.x) + Math.abs(user.traveling.targetY - user.y);
  const remainingTime = Math.max(0, user.traveling.duration - (now - user.traveling.startTime));
  const minutes = Math.floor(remainingTime / 60000);
  const seconds = Math.floor((remainingTime % 60000) / 1000);

  return (
    <div className="command-panel vine-frame fixed bottom-5 left-1/2 z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded border text-zinc-100">
      <div className="panel-header border-b px-4 py-3 text-center">
        <h3 className="fantasy-heading text-base">Traveling</h3>
        <p className="arcane-label">
          Destination {user.traveling.targetX}:{user.traveling.targetY}
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 text-center">
          <TravelPill label="Distance" value={`${distance} tiles`} />
          <TravelPill label="Time" value={`${minutes}:${seconds.toString().padStart(2, '0')}`} />
        </div>

        <div>
          <div className="ui-muted mb-2 flex items-center justify-between text-xs font-bold">
            <span>Progress</span>
            <span>{Math.floor(progress)}%</span>
          </div>
          <div className="ui-progress-track h-2 overflow-hidden rounded border">
            <div
              className="ui-progress-fill h-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => {
            cancelTravel();
            setUser(getCurrentUser());
          }}
          className="ui-button-danger w-full rounded px-4 py-2 text-xs font-black transition"
        >
          Stop Here
        </button>

        <p className="text-center text-[11px] font-bold text-zinc-500">You can inspect towns, quests, and queue jobs while walking.</p>
      </div>
    </div>
  );
}

function TravelPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-pill rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value text-sm font-black">{value}</div>
    </div>
  );
}
