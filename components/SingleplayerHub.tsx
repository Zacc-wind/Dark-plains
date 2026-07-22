'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCurrentUser, getDailyRunState, logout } from '@/lib/auth';
import { writeGameMode } from '@/lib/gameMode';
import { emitFxEvent } from '@/lib/fxEvents';
import { playGameSound } from '@/lib/sound';
import BackgroundMusic from '@/components/BackgroundMusic';
import CompletionOverlay from '@/components/CompletionOverlay';
import GameSettingsPanel from '@/components/GameSettingsPanel';
import ThreeFxOverlay from '@/components/ThreeFxOverlay';
import RunOverviewPanel from '@/components/RunOverviewPanel';
import RunMilestonesModal from '@/components/RunMilestonesModal';
import { DailyRunModal, getRandomLobbyBossPreview, getSavedDailyRunSummary } from '@/components/RoguelikeRunModal';
import BardMusicControls from '@/components/BardMusicControls';

export default function SingleplayerHub() {
  const router = useRouter();
  const [showRun, setShowRun] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(getCurrentUser());
  const [previewBoss] = useState(() => getRandomLobbyBossPreview());

  useEffect(() => {
    writeGameMode('singleplayer');
  }, []);

  useEffect(() => {
    document.body.classList.toggle('daily-run-open', showRun);
    return () => document.body.classList.remove('daily-run-open');
  }, [showRun]);

  const handleChangeMode = () => {
    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.42 });
    router.push('/mode');
  };

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleCloseRun = () => {
    setShowRun(false);
    setUser(getCurrentUser());
  };

  const handleStartRun = () => {
    emitFxEvent({ type: 'daily', tone: 'blue', intensity: 0.72 });
    playGameSound('ui.modalOpen', { throttleMs: 140 });
    setShowRun(true);
  };

  if (!user) return null;

  const runState = getDailyRunState(user);
  const savedDailyRun = getSavedDailyRunSummary(user);

  return (
    <div className="singleplayer-hub-shell fantasy-ui fixed inset-0 z-20 overflow-hidden bg-black/80 p-1 text-zinc-100 backdrop-blur-sm">
      <BackgroundMusic />
      <BardMusicControls />
      <ThreeFxOverlay />
      <CompletionOverlay />

      <section className="sp-hub-panel command-panel vine-frame random-run-lobby relative grid h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] w-full max-w-none overflow-hidden rounded border">
        <header className="random-run-lobby-hero sp-hub-hero relative overflow-hidden border-b">
          <Image
            src={previewBoss.assetPath}
            alt=""
            fill
            sizes="(max-width: 1200px) 80vw, 50vw"
            className="random-run-lobby-boss object-contain object-right-bottom"
            priority
          />

          <div className="relative z-10 flex h-full min-h-0 flex-col gap-4 p-4 sm:p-5 lg:p-6">
            <div className="sp-hub-topbar">
              <button
                type="button"
                className="sp-hub-menu-toggle"
                onClick={() => setMenuOpen(open => !open)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? 'Close hub menu' : 'Open hub menu'}
              >
                <span className="sp-hub-menu-ring" aria-hidden>
                  <span className="sp-hub-menu-dot" />
                  <span className="sp-hub-menu-glyph">{menuOpen ? '−' : '+'}</span>
                </span>
              </button>

              {menuOpen ? (
                <div className="sp-hub-menu-panel">
                  <button type="button" onClick={() => setShowSettings(true)} className="sp-hub-menu-item ui-button rounded px-4 py-2.5 text-sm font-black">
                    Settings
                  </button>
                  <button type="button" onClick={handleChangeMode} className="sp-hub-menu-item ui-button rounded px-4 py-2.5 text-sm font-black">
                    Change Mode
                  </button>
                  <button type="button" onClick={handleLogout} className="sp-hub-menu-item ui-button-danger rounded px-4 py-2.5 text-sm font-black">
                    Logout
                  </button>
                </div>
              ) : null}
            </div>

            <div className="sp-hub-hero-main flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-3xl">
                <div className="arcane-label sp-hub-arcane-label">Roguelike Run Hall</div>
                <h1 className="fantasy-heading sp-hub-hero-title mt-1">Run Overview</h1>
                <p className="sp-hub-hero-copy mt-3 max-w-2xl">
                  Draft a warband, clear branching roads, and bank permanent upgrades between runs.
                </p>
              </div>

              <div className="sp-hub-cta-wrap w-full shrink-0 lg:max-w-[22rem]">
                <button
                  type="button"
                  onClick={handleStartRun}
                  className="sp-hub-start-btn random-run-start ui-button-primary w-full rounded px-8 py-4 text-lg font-black"
                >
                  {savedDailyRun
                    ? `Resume Run · ${savedDailyRun.wins}/${savedDailyRun.targetBattles} wins`
                    : 'Start Run'}
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="sp-hub-body">
          <RunOverviewPanel onOpenMilestones={() => setShowMilestones(true)} />
        </div>
      </section>

      {showSettings && (
        <div className="singleplayer-settings-layer fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
          <section className="command-panel vine-frame max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-hidden rounded border">
            <div className="panel-header flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="arcane-label">Preferences</p>
                <h2 className="fantasy-heading text-2xl">Settings</h2>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className="ui-button rounded px-3 py-1 text-xs font-bold">
                Close
              </button>
            </div>
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-5">
              <GameSettingsPanel showRunTutorial />
            </div>
          </section>
        </div>
      )}

      <RunMilestonesModal
        isOpen={showMilestones}
        runState={runState}
        onClose={() => {
          setShowMilestones(false);
          setUser(getCurrentUser());
        }}
        onClaim={() => setUser(getCurrentUser())}
      />

      <DailyRunModal isOpen={showRun} onClose={handleCloseRun} tutorialScope="singleplayer" />
    </div>
  );
}
