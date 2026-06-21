'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { writeGameMode } from '@/lib/gameMode';
import SingleplayerHub from '@/components/SingleplayerHub';

export default function SingleplayerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const user = getCurrentUser();
      if (!user) {
        router.replace('/');
        return;
      }
      writeGameMode('singleplayer');
      setReady(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [router]);

  if (!ready) {
    return (
      <div className="fantasy-ui flex min-h-screen items-center justify-center bg-[#05080a]">
        <div className="fantasy-heading text-2xl">Loading...</div>
      </div>
    );
  }

  return <SingleplayerHub />;
}
