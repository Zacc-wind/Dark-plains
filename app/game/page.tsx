'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { bootstrapSupabaseSession, isSupabaseAuthEnabled } from '@/lib/supabase/auth';
import BackgroundMusic from '@/components/BackgroundMusic';
import MapRenderer from '@/components/MapRenderer';
import GameCommandCenter from '@/components/GameCommandCenter';
import PlayerModelSelector from '@/components/PlayerModelSelector';
import CompletionOverlay from '@/components/CompletionOverlay';
import ThreeFxOverlay from '@/components/ThreeFxOverlay';
import MapFogOverlay from '@/components/MapFogOverlay';
import PvpChallengeOverlay from '@/components/PvpChallengeOverlay';
import SocialRequestOverlay from '@/components/SocialRequestOverlay';
import TradeSessionOverlay from '@/components/TradeSessionOverlay';
import MultiplayerTutorialSpotlight from '@/components/MultiplayerTutorialSpotlight';
import PvpDuelSessionOverlay from '@/components/PvpDuelSessionOverlay';
import CoopRaidSessionOverlay from '@/components/CoopRaidSessionOverlay';
import CoopDungeonSessionOverlay from '@/components/CoopDungeonSessionOverlay';
import { writeGameMode } from '@/lib/gameMode';
import { applyGraphicsQualityToDocument } from '@/lib/graphicsSettings';
import BardMusicControls from '@/components/BardMusicControls';

export default function GamePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  useEffect(() => {
    applyGraphicsQualityToDocument();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (isSupabaseAuthEnabled()) {
        await bootstrapSupabaseSession();
      }

      if (cancelled) return;

      const user = getCurrentUser();
      setHasUser(Boolean(user));
      setAuthChecked(true);
      if (!user) router.replace('/');
      else writeGameMode('multiplayer');
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authChecked || !hasUser) {
    return (
      <div className="fantasy-ui flex min-h-screen items-center justify-center bg-[#05080a]">
        <div className="fantasy-heading text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fantasy-ui flex min-h-screen flex-col bg-[#05080a] text-[var(--ui-text)]">
      <BackgroundMusic />
      <BardMusicControls />
      <GameCommandCenter onOpenAvatar={() => setShowAvatar(true)} showRandomRun={false} />
      <main className="flex-1">
        <MapRenderer />
      </main>
      <MapFogOverlay />
      <ThreeFxOverlay />
      <PlayerModelSelector isOpen={showAvatar} onClose={() => setShowAvatar(false)} />
      <CompletionOverlay />
      <PvpChallengeOverlay />
      <SocialRequestOverlay />
      <TradeSessionOverlay />
      <PvpDuelSessionOverlay />
      <CoopRaidSessionOverlay />
      <CoopDungeonSessionOverlay />
      <MultiplayerTutorialSpotlight />
    </div>
  );
}
