'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { bootstrapSupabaseSession, isSupabaseAuthEnabled } from '@/lib/supabase/auth';
import BackgroundMusic from '@/components/BackgroundMusic';
import MapRenderer from '@/components/MapRenderer';
import GameCommandCenter from '@/components/GameCommandCenter';
import CompletionOverlay from '@/components/CompletionOverlay';
import { writeGameMode } from '@/lib/gameMode';
import { applyGraphicsQualityToDocument } from '@/lib/graphicsSettings';

const PlayerModelSelector = dynamic(() => import('@/components/PlayerModelSelector'), { ssr: false });
const ThreeFxOverlay = dynamic(() => import('@/components/ThreeFxOverlay'), { ssr: false });
const MapFogOverlay = dynamic(() => import('@/components/MapFogOverlay'), { ssr: false });
const PvpChallengeOverlay = dynamic(() => import('@/components/PvpChallengeOverlay'), { ssr: false });
const SocialRequestOverlay = dynamic(() => import('@/components/SocialRequestOverlay'), { ssr: false });
const TradeSessionOverlay = dynamic(() => import('@/components/TradeSessionOverlay'), { ssr: false });
const MultiplayerTutorialSpotlight = dynamic(() => import('@/components/MultiplayerTutorialSpotlight'), { ssr: false });
const PvpDuelSessionOverlay = dynamic(() => import('@/components/PvpDuelSessionOverlay'), { ssr: false });
const CoopRaidSessionOverlay = dynamic(() => import('@/components/CoopRaidSessionOverlay'), { ssr: false });
const CoopDungeonSessionOverlay = dynamic(() => import('@/components/CoopDungeonSessionOverlay'), { ssr: false });
const BardMusicControls = dynamic(() => import('@/components/BardMusicControls'), { ssr: false });

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
      {showAvatar && <PlayerModelSelector isOpen onClose={() => setShowAvatar(false)} />}
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
