'use client';

import { useCallback, useEffect, useState } from 'react';

export interface PollingOptions {
  enabled?: boolean;
  pauseWhenHidden?: boolean;
  /** Run once as soon as polling starts (deferred to a 0ms timeout). */
  immediate?: boolean;
  /** Changing this value restarts the chain (and runs immediately when `immediate`). */
  restartKey?: string | number;
}

/**
 * Calls `fn` every `intervalMs` using a setTimeout chain so async calls never overlap.
 * While the document is hidden the chain stops; it runs immediately when the tab is visible again.
 * The effect restarts whenever `fn` changes identity, so pass a stable (memoized) callback.
 */
export function usePolling(
  fn: () => unknown,
  intervalMs: number,
  { enabled = true, pauseWhenHidden = true, immediate = true, restartKey }: PollingOptions = {},
): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let disposed = false;
    let running = false;
    let timer: number | undefined;

    const clear = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };

    const schedule = (delay: number) => {
      clear();
      if (disposed || (pauseWhenHidden && document.hidden)) return;
      timer = window.setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      timer = undefined;
      if (disposed) return;
      if (running) {
        schedule(intervalMs);
        return;
      }
      running = true;
      try {
        await fn();
      } catch {
        // Polling callbacks own their error handling; a failed tick must not stop the chain.
      } finally {
        running = false;
      }
      schedule(intervalMs);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clear();
        return;
      }
      schedule(0);
    };

    schedule(immediate ? 0 : intervalMs);
    if (pauseWhenHidden) document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      clear();
      if (pauseWhenHidden) document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fn, intervalMs, enabled, pauseWhenHidden, immediate, restartKey]);
}

/** A `Date.now()` clock that ticks every `intervalMs` and pauses while the tab is hidden. */
export function useClock(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  const tick = useCallback(() => setNow(Date.now()), []);
  usePolling(tick, intervalMs, { enabled });
  return now;
}
