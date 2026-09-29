'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { bootstrapSupabaseSession, isSupabaseAuthEnabled } from '@/lib/supabase/auth';
import { writeGameMode } from '@/lib/gameMode';
import SingleplayerHub from '@/components/SingleplayerHub';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function SingleplayerPage() {
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

      writeGameMode('singleplayer');
      setReady(true);
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) return <LoadingScreen label="Opening the run hall" />;

  return <SingleplayerHub />;
}
