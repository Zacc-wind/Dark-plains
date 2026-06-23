'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { emitFxEvent } from '@/lib/fxEvents';
import { bootstrapSupabaseSession, isSupabaseAuthEnabled } from '@/lib/supabase/auth';
import { writeGameMode, type GameMode } from '@/lib/gameMode';
import {
  completeModeTutorial,
  createModeTutorialStep,
  MODE_TUTORIAL_STEP_IDS,
  shouldShowModeTutorial,
  skipModeTutorial,
} from '@/lib/modeTutorial';
import { playGameSound } from '@/lib/sound';
import BackgroundMusic from '@/components/BackgroundMusic';
import SingleplayerTutorialOverlay from '@/components/SingleplayerTutorialOverlay';
import ThreeFxOverlay from '@/components/ThreeFxOverlay';

export default function ModePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (isSupabaseAuthEnabled()) {
        await bootstrapSupabaseSession();
      }

      if (cancelled) return;

      const user = getCurrentUser();
      if (!user) {
        router.replace('/');
        return;
      }

      setReady(true);
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="fantasy-ui flex min-h-screen items-center justify-center bg-[#05080a]">
        <div className="fantasy-heading text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <BackgroundMusic autoStartDelayMs={3000} />
      <ThreeFxOverlay />
      <FixedModeSelectScreen />
    </>
  );
}

function FixedModeSelectScreen() {
  const router = useRouter();
  const [username] = useState(() => getCurrentUser()?.username || null);
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number | null>(() => (
    shouldShowModeTutorial(getCurrentUser()?.username || null) ? 0 : null
  ));
  const tutorialStep = useMemo(() => (
    tutorialStepIndex === null ? null : createModeTutorialStep(MODE_TUTORIAL_STEP_IDS[tutorialStepIndex])
  ), [tutorialStepIndex]);

  const chooseMode = (mode: GameMode) => {
    if (tutorialStep) return;
    writeGameMode(mode);
    emitFxEvent({
      type: mode === 'multiplayer' ? 'city' : 'daily',
      tone: mode === 'multiplayer' ? 'gold' : 'blue',
      intensity: 0.72,
    });
    playGameSound('ui.modalOpen', { throttleMs: 140 });
    router.push(mode === 'multiplayer' ? '/game' : '/singleplayer');
  };

  const continueTutorial = () => {
    playGameSound('ui.click', { throttleMs: 120 });
    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.35 });

    setTutorialStepIndex(currentIndex => {
      if (currentIndex === null) return null;
      const nextIndex = currentIndex + 1;
      if (nextIndex >= MODE_TUTORIAL_STEP_IDS.length) {
        completeModeTutorial(username);
        return null;
      }
      return nextIndex;
    });
  };

  const skipTutorial = () => {
    skipModeTutorial(username);
    playGameSound('ui.click', { throttleMs: 120 });
    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.35 });
    setTutorialStepIndex(null);
  };

  return (
    <div className="mode-select-screen fantasy-ui relative min-h-screen overflow-hidden text-zinc-100">
      <Image
        src="/assets/town-harborview-bg.png"
        alt=""
        fill
        priority
        className="mode-select-bg object-cover object-center"
        sizes="100vw"
      />
      <div className="mode-select-vignette absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="mode-select-copy mb-10 text-center">
          <p className="arcane-label mb-3">Choose your road</p>
          <h1 className="fantasy-heading mode-select-title">Dark Plains</h1>
          <p className="ui-muted mx-auto mt-4 max-w-xl text-sm font-bold leading-relaxed">
            Lead armies on the shared world map, or carve a solo roguelike road with separate run progression.
          </p>
        </div>

        <div className="mode-select-grid grid w-full max-w-4xl gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseMode('singleplayer')}
            className="mode-select-card command-panel vine-frame rounded border p-6 text-left transition"
          >
            <span className="mode-select-card-kicker arcane-label">Solo Campaign</span>
            <span className="fantasy-heading mt-2 block text-3xl">Singleplayer</span>
            <span className="ui-muted mt-3 block text-sm font-bold leading-relaxed">
              Run overview, roguelike roads, permanent run upgrades, and achievements. Retreat returns here with no world-map penalty.
            </span>
            <span className="mode-select-card-cta ui-button-primary mt-6 inline-flex rounded px-4 py-2 text-xs font-black uppercase">
              Enter Run Hall
            </span>
          </button>

          <button
            type="button"
            onClick={() => chooseMode('multiplayer')}
            className="mode-select-card command-panel vine-frame rounded border p-6 text-left transition"
          >
            <span className="mode-select-card-kicker arcane-label">Shared Frontier</span>
            <span className="fantasy-heading mt-2 block text-3xl">Multiplayer</span>
            <span className="ui-muted mt-3 block text-sm font-bold leading-relaxed">
              Explore the world map, towns, quests, dungeons, social play, and your persistent commander profile.
            </span>
            <span className="mode-select-card-cta ui-button-primary mt-6 inline-flex rounded px-4 py-2 text-xs font-black uppercase">
              Enter World Map
            </span>
          </button>
        </div>
      </div>

      {tutorialStep && (
        <SingleplayerTutorialOverlay
          key={tutorialStep.id}
          step={tutorialStep}
          onContinue={continueTutorial}
          onSkip={skipTutorial}
        />
      )}
    </div>
  );
}
