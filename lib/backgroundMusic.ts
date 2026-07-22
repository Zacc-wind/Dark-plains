export const BACKGROUND_MUSIC_TRACKS = [
  { id: 'goblet-bounce', file: '/assets/audio/music/goblet-bounce.mp3', label: 'Goblet Bounce' },
  { id: 'goblet-bounce-v2', file: '/assets/audio/music/goblet-bounce-v2.mp3', label: 'Goblet Bounce v2' },
  { id: 'tavern-crown-shuffle', file: '/assets/audio/music/tavern-crown-shuffle.mp3', label: 'Tavern Crown Shuffle' },
  { id: 'tavern-crown-shuffle-v2', file: '/assets/audio/music/tavern-crown-shuffle-v2.mp3', label: 'Tavern Crown Shuffle v2' },
  { id: 'in-the-tavern', file: '/assets/audio/music/in-the-tavern.mp3', label: 'In the Tavern' },
  { id: 'guards-cleaning-tavern', file: '/assets/audio/music/guards-cleaning-tavern.mp3', label: 'Guards Cleaning the Tavern' },
  { id: 'burning-them-witches', file: '/assets/audio/music/burning-them-witches.mp3', label: 'Burning Them Witches' },
  { id: 'mason-of-the-crown', file: '/assets/audio/music/mason-of-the-crown.mp3', label: 'Mason of the Crown' },
  { id: 'tavern-trap', file: '/assets/audio/music/tavern-trap.mp3', label: 'Tavern Trap' },
  { id: 'tavern-trap-2', file: '/assets/audio/music/tavern-trap-2.mp3', label: 'Tavern Trap II' },
  { id: 'tavern-trap-3', file: '/assets/audio/music/tavern-trap-3.mp3', label: 'Tavern Trap III' },
  { id: 'royal-pursuit', file: '/assets/audio/music/royal-pursuit.mp3', label: 'Royal Pursuit' },
  { id: 'banger-1', file: '/assets/audio/music/banger-1.mp3', label: 'Banger 1' },
  { id: 'banger-2', file: '/assets/audio/music/banger-2.mp3', label: 'Banger 2' },
  { id: 'next-one', file: '/assets/audio/music/next-one.mp3', label: 'Next One' },
] as const;

export type BackgroundMusicTrackId = (typeof BACKGROUND_MUSIC_TRACKS)[number]['id'];

export const AUDIO_SETTINGS_EVENT = 'wizardy:audio-settings';

const MUSIC_VOLUME_KEY = 'wizardy_music_volume';
const MUSIC_MUTED_KEY = 'wizardy_music_muted';
const MUSIC_PAUSED_KEY = 'wizardy_music_paused';
const LAST_TRACK_KEY = 'wizardy_last_music_track';
const TRACK_BASE_VOLUME = 0.38;
const MUSIC_CROSSFADE_MS = 2600;
const MUSIC_VOLUME_FADE_MS = 420;
const MUSIC_FADE_TICK_MS = 40;

let activeAudio: HTMLAudioElement | null = null;
let activeTrackId: BackgroundMusicTrackId | null = null;
let unlocked = false;
let shufflePlaylist: BackgroundMusicTrackId[] = [];
let playlistIndex = 0;
let previousTrackIds: BackgroundMusicTrackId[] = [];
const endedHandlersByAudio = new WeakMap<HTMLAudioElement, () => void>();
const fadeTimersByAudio = new WeakMap<HTMLAudioElement, number>();

function canUseAudio(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

export function notifyAudioSettingsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUDIO_SETTINGS_EVENT));
}

export function getMusicVolumePercent(): number {
  if (typeof window === 'undefined') return 55;
  const rawValue = window.localStorage.getItem(MUSIC_VOLUME_KEY);
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : 55;
  if (!Number.isFinite(parsed)) return 55;
  return Math.max(0, Math.min(100, parsed));
}

export function setMusicVolumePercent(value: number): void {
  if (typeof window === 'undefined') return;
  const nextValue = Math.max(0, Math.min(100, Math.round(value)));
  window.localStorage.setItem(MUSIC_VOLUME_KEY, String(nextValue));
  if (nextValue > 0) {
    window.localStorage.setItem(MUSIC_MUTED_KEY, 'false');
  }
  notifyAudioSettingsChanged();
}

export function isMusicMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MUSIC_MUTED_KEY) === 'true' || getMusicVolumePercent() <= 0;
}

export function setMusicMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MUSIC_MUTED_KEY, muted ? 'true' : 'false');
  if (!muted && getMusicVolumePercent() <= 0) {
    setMusicVolumePercent(55);
    return;
  }
  notifyAudioSettingsChanged();
}

export function isBackgroundMusicPaused(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MUSIC_PAUSED_KEY) === 'true';
}

export function setBackgroundMusicPaused(paused: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MUSIC_PAUSED_KEY, paused ? 'true' : 'false');
  if (paused) {
    if (activeAudio) {
      clearFadeTimer(activeAudio);
      activeAudio.pause();
    }
  } else {
    unlocked = true;
    if (isMusicMuted()) setMusicMuted(false);
  }
  notifyAudioSettingsChanged();
}

export function toggleBackgroundMusicPaused(): boolean {
  const paused = !isBackgroundMusicPaused();
  setBackgroundMusicPaused(paused);
  return paused;
}

export function shouldPlayBackgroundMusic(): boolean {
  return canUseAudio() && unlocked && !isMusicMuted() && !isBackgroundMusicPaused() && getMusicVolumePercent() > 0;
}

export function getActiveBackgroundMusicTrackId(): BackgroundMusicTrackId | null {
  return activeTrackId;
}

export function getActiveBackgroundMusicTrack() {
  return BACKGROUND_MUSIC_TRACKS.find(track => track.id === activeTrackId) || null;
}

function getEffectiveMusicVolume(): number {
  return Math.max(0, Math.min(1, TRACK_BASE_VOLUME * (getMusicVolumePercent() / 100)));
}

function getLastSessionTrackId(): BackgroundMusicTrackId | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(LAST_TRACK_KEY);
  if (!value) return null;
  return BACKGROUND_MUSIC_TRACKS.some(track => track.id === value)
    ? value as BackgroundMusicTrackId
    : null;
}

function rememberTrackId(trackId: BackgroundMusicTrackId): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(LAST_TRACK_KEY, trackId);
}

function shuffleTrackIds(avoidFirstId?: BackgroundMusicTrackId | null): BackgroundMusicTrackId[] {
  const ids = BACKGROUND_MUSIC_TRACKS.map(track => track.id);

  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }

  if (avoidFirstId && ids.length > 1 && ids[0] === avoidFirstId) {
    [ids[0], ids[1]] = [ids[1], ids[0]];
  }

  return ids;
}

function rebuildShufflePlaylist(avoidFirstId?: BackgroundMusicTrackId | null): void {
  shufflePlaylist = shuffleTrackIds(avoidFirstId);
  playlistIndex = 0;
}

function ensureShufflePlaylist(): void {
  if (shufflePlaylist.length === 0 || playlistIndex >= shufflePlaylist.length) {
    rebuildShufflePlaylist(activeTrackId);
  }
}

function takeNextTrackId(): BackgroundMusicTrackId {
  ensureShufflePlaylist();
  const trackId = shufflePlaylist[playlistIndex];
  playlistIndex += 1;
  return trackId;
}

function clearFadeTimer(audio: HTMLAudioElement): void {
  const timerId = fadeTimersByAudio.get(audio);
  if (timerId === undefined) return;
  window.clearInterval(timerId);
  fadeTimersByAudio.delete(audio);
}

function fadeAudioVolume(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs: number,
  onComplete?: () => void,
): void {
  if (!canUseAudio()) return;

  clearFadeTimer(audio);

  const clampedTarget = Math.max(0, Math.min(1, targetVolume));
  if (durationMs <= 0) {
    audio.volume = clampedTarget;
    onComplete?.();
    return;
  }

  const startVolume = audio.volume;
  const startedAt = window.performance.now();
  const timerId = window.setInterval(() => {
    const progress = Math.min(1, (window.performance.now() - startedAt) / durationMs);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    audio.volume = startVolume + ((clampedTarget - startVolume) * easedProgress);

    if (progress >= 1) {
      clearFadeTimer(audio);
      audio.volume = clampedTarget;
      onComplete?.();
    }
  }, MUSIC_FADE_TICK_MS);

  fadeTimersByAudio.set(audio, timerId);
}

function applyActiveTrackVolume(smooth = true): void {
  if (!activeAudio) return;
  fadeAudioVolume(activeAudio, getEffectiveMusicVolume(), smooth ? MUSIC_VOLUME_FADE_MS : 0);
}

function detachEndedHandler(audio: HTMLAudioElement): void {
  const handler = endedHandlersByAudio.get(audio);
  if (!handler) return;
  audio.removeEventListener('ended', handler);
  endedHandlersByAudio.delete(audio);
}

function attachEndedHandler(audio: HTMLAudioElement): void {
  const handler = () => {
    if (audio !== activeAudio) return;
    handleTrackEnded();
  };
  endedHandlersByAudio.set(audio, handler);
  audio.addEventListener('ended', handler);
}

function fadeOutAndStop(audio: HTMLAudioElement, durationMs = MUSIC_CROSSFADE_MS): void {
  fadeAudioVolume(audio, 0, durationMs, () => {
    audio.pause();
    audio.currentTime = 0;
  });
}

function stopActiveTrack(fade = true): void {
  if (!activeAudio) return;
  const audio = activeAudio;
  detachEndedHandler(audio);
  activeAudio = null;
  activeTrackId = null;

  if (fade) {
    fadeOutAndStop(audio);
    return;
  }

  clearFadeTimer(audio);
  audio.pause();
  audio.currentTime = 0;
}

function handleTrackEnded(): void {
  if (!shouldPlayBackgroundMusic()) return;
  playTrack(takeNextTrackId(), true);
}

function playTrack(trackId: BackgroundMusicTrackId, crossfade = true, rememberPrevious = true): void {
  if (!canUseAudio()) return;

  const track = BACKGROUND_MUSIC_TRACKS.find(entry => entry.id === trackId);
  if (!track) return;

  if (activeTrackId === trackId && activeAudio) {
    applyActiveTrackVolume();
    if (activeAudio.paused && shouldPlayBackgroundMusic()) {
      void activeAudio.play().catch(() => {
        // Browsers can block audio before the first user gesture.
      });
    }
    return;
  }

  if (activeAudio) {
    if (activeTrackId && rememberPrevious) {
      previousTrackIds = [...previousTrackIds.slice(-19), activeTrackId];
    }
    const previousAudio = activeAudio;
    detachEndedHandler(previousAudio);
    fadeOutAndStop(previousAudio, crossfade ? MUSIC_CROSSFADE_MS : 0);
  }

  const audio = new Audio(track.file);
  audio.loop = false;
  audio.preload = 'auto';
  audio.volume = crossfade ? 0 : getEffectiveMusicVolume();
  attachEndedHandler(audio);
  activeAudio = audio;
  activeTrackId = trackId;
  rememberTrackId(trackId);

  if (shouldPlayBackgroundMusic()) {
    void audio.play().catch(() => {
      // Browsers can block audio before the first user gesture.
    });
    fadeAudioVolume(audio, getEffectiveMusicVolume(), crossfade ? MUSIC_CROSSFADE_MS : 0);
  } else {
    audio.volume = getEffectiveMusicVolume();
  }
  notifyAudioSettingsChanged();
}

export function authorizeBackgroundMusic(): void {
  if (!canUseAudio()) return;
  unlocked = true;
  if (!activeAudio) {
    rebuildShufflePlaylist(getLastSessionTrackId());
  }
}

export function unlockBackgroundMusic(): void {
  if (!canUseAudio()) return;
  unlocked = true;
  syncBackgroundMusic();
}

export function syncBackgroundMusic(): void {
  if (!canUseAudio()) return;

  if (isMusicMuted() || getMusicVolumePercent() <= 0) {
    stopActiveTrack();
    return;
  }

  if (isBackgroundMusicPaused()) {
    if (activeAudio) {
      clearFadeTimer(activeAudio);
      activeAudio.pause();
    }
    return;
  }

  if (!unlocked) return;

  if (activeAudio && activeTrackId) {
    applyActiveTrackVolume();
    if (activeAudio.paused) {
      void activeAudio.play().catch(() => {
        // Browsers can block audio before the first user gesture.
      });
    }
    return;
  }

  rebuildShufflePlaylist(getLastSessionTrackId());
  playTrack(takeNextTrackId());
}

export function skipBackgroundMusicTrack(): void {
  if (!canUseAudio()) return;
  unlocked = true;
  playTrack(takeNextTrackId(), true);
}

export function playPreviousBackgroundMusicTrack(): void {
  if (!canUseAudio()) return;
  unlocked = true;

  let previousTrackId = previousTrackIds.pop();
  if (!previousTrackId) {
    const activeIndex = BACKGROUND_MUSIC_TRACKS.findIndex(track => track.id === activeTrackId);
    const previousIndex = activeIndex <= 0 ? BACKGROUND_MUSIC_TRACKS.length - 1 : activeIndex - 1;
    previousTrackId = BACKGROUND_MUSIC_TRACKS[previousIndex].id;
  }

  playTrack(previousTrackId, true, false);
}
