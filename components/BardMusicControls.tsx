'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUDIO_SETTINGS_EVENT,
  getActiveBackgroundMusicTrack,
  getMusicVolumePercent,
  isBackgroundMusicPaused,
  playPreviousBackgroundMusicTrack,
  setBackgroundMusicPaused,
  setMusicVolumePercent,
  skipBackgroundMusicTrack,
  toggleBackgroundMusicPaused,
} from '@/lib/backgroundMusic';

export default function BardMusicControls() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(55);
  const [paused, setPaused] = useState(false);
  const [trackLabel, setTrackLabel] = useState('Roadside shuffle');

  const refreshState = useCallback(() => {
    setVolume(getMusicVolumePercent());
    setPaused(isBackgroundMusicPaused());
    setTrackLabel(getActiveBackgroundMusicTrack()?.label || 'Roadside shuffle');
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(refreshState);
    window.addEventListener(AUDIO_SETTINGS_EVENT, refreshState);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener(AUDIO_SETTINGS_EVENT, refreshState);
    };
  }, [refreshState]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleTogglePlayback = () => {
    if (paused && volume <= 0) setMusicVolumePercent(55);
    toggleBackgroundMusicPaused();
    refreshState();
  };

  const handlePrevious = () => {
    playPreviousBackgroundMusicTrack();
    refreshState();
  };

  const handleNext = () => {
    skipBackgroundMusicTrack();
    refreshState();
  };

  return (
    <div ref={rootRef} className={`bard-music-controls ${open ? 'bard-music-controls-open' : ''}`}>
      {open ? (
        <div className="bard-music-popover command-panel vine-frame" role="dialog" aria-label="Music controls">
          <div className="bard-music-now-playing">
            <span>Now playing</span>
            <strong aria-live="polite">{trackLabel}</strong>
          </div>
          <div className="bard-music-transport">
            <button type="button" onClick={handlePrevious} title="Previous track" aria-label="Previous track">
              <span aria-hidden>&#9198;</span>
            </button>
            <button
              type="button"
              onClick={handleTogglePlayback}
              title={paused ? 'Play music' : 'Pause music'}
              aria-label={paused ? 'Play music' : 'Pause music'}
            >
              <span aria-hidden>{paused ? <>&#9654;</> : <>&#10074;&#10074;</>}</span>
            </button>
            <button type="button" onClick={handleNext} title="Next track" aria-label="Next track">
              <span aria-hidden>&#9197;</span>
            </button>
          </div>
          <label className="bard-music-volume">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={volume}
              onChange={event => {
                const nextVolume = Number(event.target.value);
                setVolume(nextVolume);
                setMusicVolumePercent(nextVolume);
                if (nextVolume <= 0) setBackgroundMusicPaused(true);
              }}
              aria-label="Music volume"
            />
            <output>{volume}%</output>
          </label>
        </div>
      ) : null}

      <button
        type="button"
        className="bard-music-toggle"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close music controls' : 'Open music controls'}
        title="Music controls"
      >
        <Image src="/assets/ui/bard.png" alt="" width={96} height={96} priority className="bard-music-art" />
        <span className="bard-music-note" aria-hidden>&#9835;</span>
      </button>
    </div>
  );
}
