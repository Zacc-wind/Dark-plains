'use client';

import Image from 'next/image';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { SingleplayerRunTutorialStep } from '@/lib/singleplayerTutorial';

export type TutorialOverlayStep = Omit<SingleplayerRunTutorialStep, 'id'> & {
  id: string;
};

const MOBILE_TUTORIAL_QUERY = '(max-width: 820px), (pointer: coarse)';

function subscribeToMobileTutorialSuppression(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mediaQuery = window.matchMedia(MOBILE_TUTORIAL_QUERY);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getMobileTutorialSuppressionSnapshot(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_TUTORIAL_QUERY).matches;
}

export default function SingleplayerTutorialOverlay({
  step,
  onContinue,
  onSkip,
}: {
  step: TutorialOverlayStep;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const actionFiredRef = useRef(false);
  const suppressOnMobile = useSyncExternalStore(
    subscribeToMobileTutorialSuppression,
    getMobileTutorialSuppressionSnapshot,
    () => false
  );

  useEffect(() => {
    actionFiredRef.current = false;
  }, [step.id]);

  useEffect(() => {
    if (!suppressOnMobile || actionFiredRef.current) return;
    actionFiredRef.current = true;
    onSkip();
  }, [onSkip, suppressOnMobile]);

  const fireAction = (handler: () => void) => {
    if (actionFiredRef.current) return;
    actionFiredRef.current = true;
    handler();
  };

  if (suppressOnMobile) return null;

  const overlay = (
    <div
      className="singleplayer-tutorial-layer fixed inset-0 z-[120] flex items-end justify-center p-3 text-zinc-100 sm:p-5"
      data-step-id={step.id}
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
    >
      <div className="singleplayer-tutorial-stage pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="singleplayer-tutorial-guide relative">
          <Image
            src={step.guideAssetPath}
            alt=""
            fill
            sizes={step.id === 'combat' ? '420px' : '70vw'}
            className="object-contain object-bottom"
            priority
            unoptimized
          />
        </div>
      </div>

      <section className="singleplayer-tutorial-dialog command-panel vine-frame relative w-full max-w-4xl rounded border p-4 sm:p-5">
        <div className="singleplayer-tutorial-dialog-glow" aria-hidden="true" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="arcane-label">{step.kicker}</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="fantasy-heading text-2xl sm:text-3xl">{step.speakerName}</h2>
              <span className="ui-faint text-[10px] font-black uppercase tracking-[0.12em]">{step.speakerTitle}</span>
            </div>
            <h3 className="fantasy-heading mt-4 text-xl sm:text-2xl">{step.title}</h3>
            <p className="ui-muted mt-2 max-w-3xl text-sm font-bold leading-relaxed sm:text-base">{step.body}</p>
            {step.cards && step.cards.length > 0 && (
              <div className="singleplayer-tutorial-card-grid mt-4">
                {step.cards.map((card) => (
                  <div key={`${step.id}-${card.title}`} className="singleplayer-tutorial-card">
                    <div className="singleplayer-tutorial-card-icon relative" aria-hidden="true">
                      <Image
                        src={card.iconPath}
                        alt=""
                        fill
                        sizes="54px"
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="singleplayer-tutorial-card-title">{card.title}</div>
                      <p className="singleplayer-tutorial-card-body">{card.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {step.hint && (
              <p className="singleplayer-tutorial-hint mt-3 rounded border px-3 py-2 text-xs font-black sm:text-sm">
                {step.hint}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                fireAction(onSkip);
              }}
              className="ui-button rounded px-4 py-2.5 text-xs font-black"
            >
              Skip Tutorial
            </button>
            <button
              type="button"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                fireAction(onContinue);
              }}
              className="singleplayer-tutorial-continue-button ui-button-primary rounded px-6 py-3 text-sm font-black"
            >
              {step.continueLabel || 'Continue'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  if (typeof document === 'undefined') return overlay;

  return createPortal(overlay, document.body);
}
