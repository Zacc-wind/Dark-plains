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
import dynamic from 'next/dynamic';
import BackgroundMusic from '@/components/BackgroundMusic';
import LoadingScreen from '@/components/ui/LoadingScreen';

const SingleplayerTutorialOverlay = dynamic(() => import('@/components/SingleplayerTutorialOverlay'), { ssr: false });
const ThreeFxOverlay = dynamic(() => import('@/components/ThreeFxOverlay'), { ssr: false });

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

  if (!ready) return <LoadingScreen />;

  return (
    <>
      <BackgroundMusic autoStartDelayMs={3000} />
      <ThreeFxOverlay />
      <FixedModeSelectScreen />
    </>
  );
}

const MODE_CARDS: {
  mode: GameMode;
  kicker: string;
  title: string;
  copy: string;
  features: string[];
  cta: string;
  image: string;
}[] = [
  {
    mode: 'singleplayer',
    kicker: 'Solo campaign',
    title: 'Singleplayer',
    copy: 'Roguelike roads with permanent run upgrades. Retreat any time with no world-map penalty.',
    features: ['Drafted warbands', 'Omens and relics', 'Run achievements'],
    cta: 'Enter the Run Hall',
    image: '/assets/run-background.jpg',
  },
  {
    mode: 'multiplayer',
    kicker: 'Shared frontier',
    title: 'Multiplayer',
    copy: 'The living coast: towns, contracts, dungeons, and your persistent commander.',
    features: ['Story campaign', 'Co-op raids and duels', 'Trade and parties'],
    cta: 'Enter the World Map',
    image: '/assets/world-map.jpg',
  },
];

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
      const card = MODE_CARDS[Number(event.key) - 1];
      if (card) chooseMode(card.mode);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const skipTutorial = () => {
    skipModeTutorial(username);
    playGameSound('ui.click', { throttleMs: 120 });
    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.35 });
    setTutorialStepIndex(null);
  };

  return (
    <div className="dp-screen fantasy-ui">
      <Image
        src="/assets/town-harborview-bg.png"
        alt=""
        fill
        priority
        className="dp-screen-bg object-cover object-center"
        sizes="100vw"
        quality={70}
      />
      <div className="dp-screen-vignette" aria-hidden="true" />

      <header className="dp-screen-topbar">
        <span className="dp-brand">Dark Plains</span>
        {username && (
          <span className="dp-topbar-user">
            <span className="arcane-label">Commander</span>
            <strong>{username}</strong>
          </span>
        )}
      </header>

      <main className="dp-mode">
        <div className="dp-mode-hero">
          <p className="arcane-label">Choose your road</p>
          <h1 className="fantasy-heading dp-mode-title">Dark Plains</h1>
          <p className="dp-mode-lede">
            Lead a warband across the shared frontier, or walk a solo roguelike road with its own progression.
          </p>
        </div>

        <div className="dp-mode-grid">
          {MODE_CARDS.map((card, index) => (
            <button
              key={card.mode}
              type="button"
              onClick={() => chooseMode(card.mode)}
              className="dp-mode-card"
              aria-keyshortcuts={String(index + 1)}
            >
              <span className="dp-mode-card-art" aria-hidden="true">
                <Image src={card.image} alt="" fill sizes="(max-width: 768px) 100vw, 36rem" className="object-cover" quality={65} />
              </span>
              <span className="dp-mode-card-body">
                <span className="arcane-label">{card.kicker}</span>
                <span className="fantasy-heading dp-mode-card-title">{card.title}</span>
                <span className="dp-mode-card-copy">{card.copy}</span>
                <span className="dp-mode-card-features">
                  {card.features.map(feature => (
                    <span key={feature}>{feature}</span>
                  ))}
                </span>
                <span className="dp-mode-card-footer">
                  <span className="ui-button-primary dp-mode-card-cta">{card.cta}</span>
                  <kbd className="dp-kbd">{index + 1}</kbd>
                </span>
              </span>
            </button>
          ))}
        </div>
      </main>

      <footer className="dp-screen-footer">v2.0</footer>

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
