'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import MapRenderer from '@/components/MapRenderer';
import GameCommandCenter from '@/components/GameCommandCenter';
import PlayerModelSelector from '@/components/PlayerModelSelector';
import CompletionOverlay from '@/components/CompletionOverlay';
import ThreeFxOverlay from '@/components/ThreeFxOverlay';
import MapFogOverlay from '@/components/MapFogOverlay';

export default function GamePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const user = getCurrentUser();
      setHasUser(Boolean(user));
      setAuthChecked(true);
      if (!user) router.replace('/');
    });

    return () => window.cancelAnimationFrame(frameId);
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
      <GameCommandCenter onOpenAvatar={() => setShowAvatar(true)} />
      <main className="flex-1">
        <MapRenderer />
      </main>
      <MapFogOverlay />
      <ThreeFxOverlay />
      <PlayerModelSelector isOpen={showAvatar} onClose={() => setShowAvatar(false)} />
      <CompletionOverlay />
    </div>
  );
}
