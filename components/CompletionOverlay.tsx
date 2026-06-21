'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CompletionNotice, subscribeCompletionNotices, notifyCompletionOverlayState } from '@/lib/completionEvents';
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

    activeRef.current = null;
    setActiveNotice(null);
    notifyCompletionOverlayState('idle');
  }, []);

  const startNotice = useCallback((notice: CompletionNotice) => {
    seenRef.current.add(notice.id);
    emitCompletionFx(notice);
    notifyCompletionOverlayState('busy');
    activeRef.current = notice;
    setActiveNotice(notice);

    if (timerRef.current) window.clearTimeout(timerRef.current);

    if (notice.skipBurst || notice.skipReport) {
      setPhase('report');
      return;
    }

    setPhase('burst');
    timerRef.current = window.setTimeout(() => {
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
      if (!activeRef.current && queueRef.current.length === 0) {
        notifyCompletionOverlayState('idle');
      }
    };
  }, [startNotice]);

  useEffect(() => {
    notifyCompletionOverlayState('idle');
  }, []);

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
    <div className={`completion-overlay fixed inset-0 z-[95] flex items-center justify-center p-4 text-zinc-100 ${isUnitRecruitReveal || isGearReveal ? 'completion-overlay-reveal' : 'bg-black/20 backdrop-blur-[2px]'}`}>
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
        </div>
      ) : isUnitRecruitReveal ? (
        <section className="completion-recruit-panel command-panel vine-frame w-full max-w-4xl rounded border p-5 sm:p-6">
          <div className="completion-recruit-top flex items-start justify-between gap-3">
            <div className="arcane-label">{activeNotice.kicker || 'Joined the Team'}</div>
            <button onClick={closeNotice} className="ui-button-primary shrink-0 rounded px-4 py-2 text-xs font-black">
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
        </section>
      ) : isGearReveal ? (
        <section className={`completion-gear-panel command-panel vine-frame w-full max-w-xl rounded border p-5 sm:p-6 ${gearRarityClass}`}>
          <div className="completion-gear-top flex items-start justify-between gap-3">
            <div className="arcane-label">{activeNotice.kicker || 'Run Satchel'}</div>
            <button onClick={closeNotice} className="ui-button-primary shrink-0 rounded px-4 py-2 text-xs font-black">
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
        </section>
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
