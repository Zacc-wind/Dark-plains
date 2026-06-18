'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompletionNotice, subscribeCompletionNotices } from '@/lib/completionEvents';
import { emitFxEvent, type FxEventType } from '@/lib/fxEvents';
import { getCurrentUser } from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';

type CompletionPhase = 'burst' | 'report';
const COMPLETION_BURST_DURATION_MS = 4200;

function getCompletionFxType(notice: CompletionNotice): FxEventType {
  if (notice.kind === 'defeat') return 'defeat';
  if (notice.kind === 'job') return 'job';
  if (notice.kind === 'quest') return 'quest';
  if (notice.kind === 'run') return 'run';
  if (notice.kind === 'recruit') return 'recruit';
  return 'victory';
}

function emitCompletionFx(notice: CompletionNotice): void {
  emitFxEvent({
    type: getCompletionFxType(notice),
    intensity: notice.kind === 'defeat' ? 1.1 : notice.kind === 'run' ? 1.35 : 1.15,
  });
}

export default function CompletionOverlay() {
  const [activeNotice, setActiveNotice] = useState<CompletionNotice | null>(null);
  const [phase, setPhase] = useState<CompletionPhase>('burst');
  const activeRef = useRef<CompletionNotice | null>(null);
  const queueRef = useRef<CompletionNotice[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);
  const startNoticeRef = useRef<(notice: CompletionNotice) => void>(() => {});

  const advanceNoticeQueue = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const next = queueRef.current.shift();
    if (next) {
      startNoticeRef.current(next);
      return;
    }

    setActiveNotice(null);
  }, []);

  const startNotice = useCallback((notice: CompletionNotice) => {
    seenRef.current.add(notice.id);
    emitCompletionFx(notice);
    setActiveNotice(notice);
    setPhase('burst');

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (notice.skipReport) {
        advanceNoticeQueue();
        return;
      }
      setPhase('report');
    }, COMPLETION_BURST_DURATION_MS);
  }, [advanceNoticeQueue]);

  useEffect(() => {
    startNoticeRef.current = startNotice;
  }, [startNotice]);

  useEffect(() => {
    activeRef.current = activeNotice;
  }, [activeNotice]);

  useEffect(() => {
    const unsubscribe = subscribeCompletionNotices((notice) => {
      if (!notice?.id || seenRef.current.has(notice.id)) return;
      if (activeRef.current) {
        seenRef.current.add(notice.id);
        queueRef.current.push(notice);
        return;
      }

      startNotice(notice);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [startNotice]);

  const closeNotice = () => {
    advanceNoticeQueue();
  };

  if (!activeNotice) return null;

  const victoryTone = activeNotice.kind !== 'defeat';
  const currentUser = getCurrentUser();
  const modelPath = getPlayerModelPath(currentUser?.selectedModel || 3);
  const hasCustomArtwork = Boolean(activeNotice.artworkPath);
  const showReportArtwork = activeNotice.kind === 'defeat' || hasCustomArtwork;
  const artworkPath = activeNotice.artworkPath || (activeNotice.kind === 'defeat' ? '/assets/reaper.png' : modelPath);
  const artworkAlt = activeNotice.kind === 'defeat' ? 'Fallen reaper' : '';

  return (
    <div className="completion-overlay fixed inset-0 z-[95] flex items-center justify-center bg-black/20 p-4 text-zinc-100 backdrop-blur-[2px]">
      {phase === 'burst' ? (
        <div className={`completion-burst ${victoryTone ? 'completion-burst-victory' : 'completion-burst-defeat'} text-center`}>
          <div className={`completion-avatar-wrap relative mx-auto mb-5 h-44 w-44 sm:h-56 sm:w-56 ${activeNotice.kind === 'defeat' ? 'completion-avatar-wrap-defeat' : ''}`}>
            <Image
              src={artworkPath}
              alt={artworkAlt}
              fill
              sizes="224px"
              className={`object-contain ${activeNotice.kind === 'defeat' ? 'completion-avatar-defeat-art' : hasCustomArtwork ? 'completion-avatar-item-art' : 'player-model-art'}`}
              priority
              unoptimized
            />
          </div>
          <div className="arcane-label">{activeNotice.kicker || 'Report'}</div>
          <div className="fantasy-heading text-5xl sm:text-7xl">{activeNotice.title}</div>
        </div>
      ) : (
        <section className={`completion-report command-panel vine-frame w-full max-w-2xl rounded border p-5 ${victoryTone ? 'completion-report-victory' : 'completion-report-defeat'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              {showReportArtwork && (
                <span className="completion-report-art relative hidden shrink-0 overflow-hidden rounded border sm:block">
                  <Image
                    src={artworkPath}
                    alt={artworkAlt}
                    fill
                    sizes="96px"
                    className={`object-contain ${activeNotice.kind === 'defeat' ? 'completion-avatar-defeat-art' : hasCustomArtwork ? 'completion-avatar-item-art' : 'player-model-art'}`}
                    unoptimized
                  />
                </span>
              )}
              <div className="min-w-0">
                <div className="arcane-label">{activeNotice.kicker || 'Completion'}</div>
                <h2 className="fantasy-heading text-3xl">{activeNotice.title}</h2>
                {activeNotice.description && (
                  <p className="ui-muted mt-2 max-w-xl text-sm font-bold">{activeNotice.description}</p>
                )}
              </div>
            </div>
            <button onClick={closeNotice} className="ui-button-primary rounded px-4 py-2 text-xs font-black">
              Continue
            </button>
          </div>

          {activeNotice.rewards && activeNotice.rewards.length > 0 && (
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeNotice.rewards.map((reward, index) => (
                <div key={`${reward.label}-${index}`} className={`completion-reward completion-reward-${reward.tone || 'neutral'} rounded border px-3 py-2`}>
                  <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{reward.label}</div>
                  <div className="ui-value mt-0.5 truncate text-sm font-black">{reward.value}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
