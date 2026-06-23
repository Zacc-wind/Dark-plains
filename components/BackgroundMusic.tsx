'use client';

import { useEffect } from 'react';
import {
  AUDIO_SETTINGS_EVENT,
  syncBackgroundMusic,
  unlockBackgroundMusic,
} from '@/lib/backgroundMusic';

interface BackgroundMusicProps {
  /** Start or resume music this many ms after mount (e.g. mode select after login). */
  autoStartDelayMs?: number;
}

export default function BackgroundMusic({ autoStartDelayMs }: BackgroundMusicProps = {}) {
  useEffect(() => {
    const handleUserGesture = () => {
      unlockBackgroundMusic();
    };

    const handleSettingsChange = () => {
      syncBackgroundMusic();
    };

    window.addEventListener('pointerdown', handleUserGesture, { once: true });
    window.addEventListener('keydown', handleUserGesture, { once: true });
    window.addEventListener(AUDIO_SETTINGS_EVENT, handleSettingsChange);

    let autoStartTimer: number | undefined;
    if (autoStartDelayMs && autoStartDelayMs > 0) {
      autoStartTimer = window.setTimeout(() => {
        syncBackgroundMusic();
      }, autoStartDelayMs);
    }

    return () => {
      if (autoStartTimer) window.clearTimeout(autoStartTimer);
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      window.removeEventListener(AUDIO_SETTINGS_EVENT, handleSettingsChange);
    };
  }, [autoStartDelayMs]);

  return null;
}
