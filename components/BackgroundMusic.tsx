'use client';

import { useEffect } from 'react';
import {
  AUDIO_SETTINGS_EVENT,
  syncBackgroundMusic,
  unlockBackgroundMusic,
} from '@/lib/backgroundMusic';

export default function BackgroundMusic() {
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

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      window.removeEventListener(AUDIO_SETTINGS_EVENT, handleSettingsChange);
    };
  }, []);

  return null;
}
