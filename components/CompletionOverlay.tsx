'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompletionNotice, subscribeCompletionNotices, notifyCompletionOverlayState } from '@/lib/completionEvents';
import { emitFxEvent, type FxEventType } from '@/lib/fxEvents';
import { getCurrentUser } from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';

type CompletionPhase = 'burst' | 'report';
const COMPLETION_BURST_DURATION_MS = 2800;

function isStoryDialogOpen(): boolean {
  return typeof document !== 'undefined' && document.querySelector('.story-dialog-layer') !== null;
}

function getCompletionFxType(notice: CompletionNotice): FxEventType {
  if (notice.kind === 'defeat') return 'defeat';
  if (notice.kind === 'job') return 'job';
  if (notice.kind === 'quest') return 'quest';
  if (notice.kind === 'run') return 'run';
  if (notice.kind === 'recruit') return 'recruit';
  if (notice.kind === 'gear') return 'run';
  return 'victory';
}

function getGearRarityClass(description?: string): string {
  if (!description) return 'completion-gear-rarity-decent';
  const rarity = description.split(' ')[0]?.toLowerCase();
  if (rarity === 'legendary') return 'completion-gear-rarity-legendary';
  if (rarity === 'epic') return 'completion-gear-rarity-epic';
  if (rarity === 'rare') return 'completion-gear-rarity-rare';
  if (rarity === 'common') return 'completion-gear-rarity-common';
  return 'completion-gear-rarity-decent';
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
  const [queuedCount, setQueuedCount] = useState(0);
  const activeRef = useRef<CompletionNotice | null>(null);
  const queueRef = useRef<CompletionNotice[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | null>(null);
  const startNoticeRef = useRef<(notice: CompletionNotice) => void>(() => {});
  const phaseRef = useRef<CompletionPhase>('burst');

  const advanceNoticeQueue = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const next = isStoryDialogOpen() ? undefined : queueRef.current.shift();
    if (next) {
      startNoticeRef.current(next);
      return;
    }

    activeRef.current = null;
    setActiveNotice(null);
    notifyCompletionOverlayState('idle');
  }, []);

  const skipBurstToReport = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    phaseRef.current = 'report';
    setPhase('report');
  }, []);

  const startNotice = useCallback((notice: CompletionNotice) => {
    seenRef.current.add(notice.id);
    emitCompletionFx(notice);
    notifyCompletionOverlayState('busy');
    activeRef.current = notice;
    setActiveNotice(notice);
    setQueuedCount(queueRef.current.length);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;

    if (notice.skipBurst || notice.skipReport) {
      phaseRef.current = 'report';
      setPhase('report');
      return;
    }

    phaseRef.current = 'burst';
    setPhase('burst');
    timerRef.current = window.setTimeout(() => {
      phaseRef.current = 'report';
      setPhase('report');
    }, COMPLETION_BURST_DURATION_MS);
  }, []);

  useEffect(() => {
    startNoticeRef.current = startNotice;
  }, [startNotice]);

  useEffect(() => {
    activeRef.current = activeNotice;
  }, [activeNotice]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    // Rewards wait for story dialogue to close so the two never fight for the screen.
    const dialogObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
        if (activeRef.current || queueRef.current.length === 0 || isStoryDialogOpen()) return;
        const next = queueRef.current.shift();
        if (next) startNoticeRef.current(next);
      });
    if (dialogObserver && typeof document !== 'undefined') {
      dialogObserver.observe(document.body, { childList: true });
    }

    const unsubscribe = subscribeCompletionNotices((notice) => {
      if (!notice?.id || seenRef.current.has(notice.id)) return;
      if (activeRef.current || isStoryDialogOpen()) {
        seenRef.current.add(notice.id);
        queueRef.current.push(notice);
        setQueuedCount(queueRef.current.length);
        return;
      }

      startNotice(notice);
    });

    return () => {
      dialogObserver?.disconnect();
      unsubscribe();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (!activeRef.current && queueRef.current.length === 0) {
        notifyCompletionOverlayState('idle');
      }
    };
  }, [startNotice]);

  useEffect(() => {
    notifyCompletionOverlayState('idle');
  }, []);

  const closeNotice = useCallback(() => {
    advanceNoticeQueue();
  }, [advanceNoticeQueue]);

  const handleSkipOrAdvance = useCallback(() => {
    if (!activeRef.current) return;
    if (phaseRef.current === 'burst') {
      skipBurstToReport();
      return;
    }
    closeNotice();
  }, [closeNotice, skipBurstToReport]);

  useEffect(() => {
    if (!activeNotice) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSkipOrAdvance();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNotice, handleSkipOrAdvance]);

  if (!activeNotice) return null;

  const victoryTone = activeNotice.kind !== 'defeat';
  const currentUser = getCurrentUser();
  const modelPath = getPlayerModelPath(currentUser?.selectedModel || 3);
  const hasCustomArtwork = Boolean(activeNotice.artworkPath);
  const showReportArtwork = activeNotice.kind === 'defeat' || hasCustomArtwork;
  const artworkPath = activeNotice.artworkPath || (activeNotice.kind === 'defeat' ? '/assets/reaper.png' : modelPath);
  const artworkAlt = activeNotice.kind === 'defeat' ? 'Fallen reaper' : '';
  const plainArtwork = hasCustomArtwork && activeNotice.artworkStyle === 'plain';
  const isUnitRecruitReveal = activeNotice.kind === 'recruit' && plainArtwork && Boolean(activeNotice.artworkPath);
  const isGearReveal = activeNotice.kind === 'gear' && hasCustomArtwork && Boolean(activeNotice.artworkPath);
  const gearRarityClass = getGearRarityClass(activeNotice.description);
  const artworkClassName = activeNotice.kind === 'defeat'
    ? 'completion-avatar-defeat-art'
    : plainArtwork
      ? 'completion-avatar-plain-art'
      : hasCustomArtwork
        ? 'completion-avatar-item-art'
        : 'player-model-art';
  return (
    <div
      className={`completion-overlay fixed inset-0 z-[95] flex cursor-pointer items-center justify-center p-4 text-zinc-100 ${isUnitRecruitReveal || isGearReveal ? 'completion-overlay-reveal' : 'bg-black/20 backdrop-blur-[2px]'}`}
      onClick={handleSkipOrAdvance}
      role="dialog"
      aria-modal="true"
      aria-label={phase === 'burst' ? `${activeNotice.title}. Click to continue.` : activeNotice.title}
    >
      {phase === 'burst' ? (
        <div className={`completion-burst ${victoryTone ? 'completion-burst-victory' : 'completion-burst-defeat'} text-center`}>
          <div className={`completion-avatar-wrap relative mx-auto mb-5 h-44 w-44 sm:h-56 sm:w-56 ${activeNotice.kind === 'defeat' ? 'completion-avatar-wrap-defeat' : ''} ${plainArtwork ? 'completion-avatar-wrap-plain' : ''}`}>
            <Image
              src={artworkPath}
              alt={artworkAlt}
              fill
              sizes="224px"
              className={`object-contain ${artworkClassName}`}
              priority
              unoptimized
            />
          </div>
          <div className="arcane-label">{activeNotice.kicker || 'Report'}</div>
          <div className="fantasy-heading text-5xl sm:text-7xl">{activeNotice.title}</div>
          <div className="completion-skip-hint ui-muted mt-5 text-xs font-black uppercase tracking-[0.18em]">
            Click to continue{queuedCount > 0 ? ` · ${queuedCount} more waiting` : ''}
          </div>
        </div>
      ) : isUnitRecruitReveal ? (
        <section
          className="completion-recruit-panel command-panel vine-frame w-full max-w-4xl rounded border p-5 sm:p-6"
          onClick={event => event.stopPropagation()}
        >
          <div className="completion-recruit-top flex items-start justify-between gap-3">
            <div className="arcane-label">{activeNotice.kicker || 'Joined the Team'}</div>
            <button type="button" onClick={closeNotice} className="ui-button-primary shrink-0 rounded px-4 py-2 text-xs font-black">
              Continue
            </button>
          </div>

          <div className="completion-recruit-stage">
            <span className="completion-recruit-aura" aria-hidden />
            <span className="completion-recruit-ring" aria-hidden />
            <span className="completion-recruit-ring completion-recruit-ring-outer" aria-hidden />
            <span className="completion-recruit-spotlight" aria-hidden />
            <span className="completion-recruit-particles" aria-hidden>
              {Array.from({ length: 8 }, (_, index) => (
                <span
                  key={index}
                  className={`completion-recruit-particle completion-recruit-particle-${index % 3 === 0 ? 'spark' : index % 3 === 1 ? 'orbit' : 'rise'}`}
                  data-i={index}
                />
              ))}
            </span>
            <div className="completion-recruit-sprite-wrap">
              <Image
                src={activeNotice.artworkPath!}
                alt={activeNotice.title}
                fill
                sizes="768px"
                className="completion-recruit-sprite object-contain object-bottom p-0"
                priority
                unoptimized
              />
            </div>
          </div>

          <div className="completion-recruit-copy text-center">
            <h2 className="fantasy-heading text-3xl sm:text-4xl">{activeNotice.title}</h2>
            {activeNotice.description && (
              <p className="ui-muted mx-auto mt-2 max-w-md text-sm font-bold leading-relaxed">{activeNotice.description}</p>
            )}
          </div>

          {activeNotice.rewards && activeNotice.rewards.length > 0 && (
            <div className="completion-recruit-stats">
              {activeNotice.rewards.map((reward, index) => (
                <div key={`${reward.label}-${index}`} className={`completion-recruit-stat completion-recruit-stat-${reward.tone || 'neutral'}`}>
                  <div className="completion-recruit-stat-label">{reward.label}</div>
                  <div className="completion-recruit-stat-value">{reward.value}</div>
                </div>
              ))}
            </div>
          )}
          <div className="completion-skip-hint ui-muted mt-4 text-center text-[10px] font-black uppercase tracking-[0.16em]">
            Click outside or press Continue{queuedCount > 0 ? ` · ${queuedCount} more waiting` : ''}
          </div>
        </section>
      ) : isGearReveal ? (
        <section
          className={`completion-gear-panel command-panel vine-frame w-full max-w-xl rounded border p-5 sm:p-6 ${gearRarityClass}`}
          onClick={event => event.stopPropagation()}
        >
          <div className="completion-gear-top flex items-start justify-between gap-3">
            <div className="arcane-label">{activeNotice.kicker || 'Run Satchel'}</div>
            <button type="button" onClick={closeNotice} className="ui-button-primary shrink-0 rounded px-4 py-2 text-xs font-black">
              Continue
            </button>
          </div>

          <div className="completion-gear-stage">
            <span className="completion-gear-beam" aria-hidden />
            <span className="completion-gear-halo" aria-hidden />
            <span className="completion-gear-ring" aria-hidden />
            <span className="completion-gear-ring completion-gear-ring-outer" aria-hidden />
            <span className="completion-gear-pedestal" aria-hidden />
            <span className="completion-gear-sparks" aria-hidden>
              {Array.from({ length: 10 }, (_, index) => (
                <span
                  key={index}
                  className={`completion-gear-spark completion-gear-spark-${index % 3 === 0 ? 'orbit' : index % 3 === 1 ? 'rise' : 'burst'}`}
                  data-i={index}
                />
              ))}
            </span>
            <div className="completion-gear-item-wrap">
              <span className="completion-gear-item-plate" aria-hidden />
              <Image
                src={activeNotice.artworkPath!}
                alt={activeNotice.title}
                fill
                sizes="280px"
                className="completion-gear-item object-contain p-4"
                priority
                unoptimized
              />
              <span className="completion-gear-gleam" aria-hidden />
            </div>
          </div>

          <div className="completion-gear-copy text-center">
            <h2 className="fantasy-heading text-3xl sm:text-4xl">{activeNotice.title}</h2>
            {activeNotice.description && (
              <p className="ui-muted mx-auto mt-2 max-w-md text-sm font-bold leading-relaxed">{activeNotice.description}</p>
            )}
          </div>

          {activeNotice.rewards && activeNotice.rewards.length > 0 && (
            <div className="completion-gear-stats">
              {activeNotice.rewards.map((reward, index) => (
                <div key={`${reward.label}-${index}`} className={`completion-gear-stat completion-gear-stat-${reward.tone || 'neutral'}`}>
                  <div className="completion-gear-stat-label">{reward.label}</div>
                  <div className="completion-gear-stat-value">{reward.value}</div>
                </div>
              ))}
            </div>
          )}
          <div className="completion-skip-hint ui-muted mt-4 text-center text-[10px] font-black uppercase tracking-[0.16em]">
            Click outside or press Continue{queuedCount > 0 ? ` · ${queuedCount} more waiting` : ''}
          </div>
        </section>
      ) : (
        <section
          className={`completion-report command-panel vine-frame w-full max-w-2xl cursor-pointer rounded border p-5 ${victoryTone ? 'completion-report-victory' : 'completion-report-defeat'}`}
          onClick={event => {
            event.stopPropagation();
            closeNotice();
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              {showReportArtwork && (
                <span className="completion-report-art relative hidden shrink-0 overflow-hidden rounded border sm:block">
                  <Image
                    src={artworkPath}
                    alt={artworkAlt}
                    fill
                    sizes="96px"
                    className={`object-contain ${artworkClassName}`}
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
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                closeNotice();
              }}
              className="ui-button-primary rounded px-4 py-2 text-xs font-black"
            >
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
          <div className="completion-skip-hint ui-muted mt-4 text-center text-[10px] font-black uppercase tracking-[0.16em]">
            Click anywhere to continue{queuedCount > 0 ? ` · ${queuedCount} more waiting` : ''}
          </div>
        </section>
      )}
    </div>
  );
}
