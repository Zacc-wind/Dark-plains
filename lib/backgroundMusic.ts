export const BACKGROUND_MUSIC_TRACKS = [
  { id: 'goblet-bounce', file: '/assets/audio/music/goblet-bounce.mp3', label: 'Goblet Bounce' },
  { id: 'goblet-bounce-v2', file: '/assets/audio/music/goblet-bounce-v2.mp3', label: 'Goblet Bounce v2' },
  { id: 'tavern-crown-shuffle', file: '/assets/audio/music/tavern-crown-shuffle.mp3', label: 'Tavern Crown Shuffle' },
  { id: 'tavern-crown-shuffle-v2', file: '/assets/audio/music/tavern-crown-shuffle-v2.mp3', label: 'Tavern Crown Shuffle v2' },
  { id: 'in-the-tavern', file: '/assets/audio/music/in-the-tavern.mp3', label: 'In the Tavern' },
  { id: 'guards-cleaning-tavern', file: '/assets/audio/music/guards-cleaning-tavern.mp3', label: 'Guards Cleaning the Tavern' },
  { id: 'burning-them-witches', file: '/assets/audio/music/burning-them-witches.mp3', label: 'Burning Them Witches' },
  { id: 'mason-of-the-crown', file: '/assets/audio/music/mason-of-the-crown.mp3', label: 'Mason of the Crown' },
] as const;

export type BackgroundMusicTrackId = (typeof BACKGROUND_MUSIC_TRACKS)[number]['id'];

export const AUDIO_SETTINGS_EVENT = 'wizardy:audio-settings';

const MUSIC_VOLUME_KEY = 'wizardy_music_volume';
const MUSIC_MUTED_KEY = 'wizardy_music_muted';
const TRACK_BASE_VOLUME = 0.38;
const MUSIC_CROSSFADE_MS = 2600;
const MUSIC_VOLUME_FADE_MS = 420;
const MUSIC_FADE_TICK_MS = 40;

let activeAudio: HTMLAudioElement | null = null;
let activeTrackId: BackgroundMusicTrackId | null = null;
let unlocked = false;
let shufflePlaylist: BackgroundMusicTrackId[] = [];
let playlistIndex = 0;
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

export function shouldPlayBackgroundMusic(): boolean {
  return canUseAudio() && unlocked && !isMusicMuted() && getMusicVolumePercent() > 0;
}

export function getActiveBackgroundMusicTrackId(): BackgroundMusicTrackId | null {
  return activeTrackId;
}

function getEffectiveMusicVolume(): number {
  return Math.max(0, Math.min(1, TRACK_BASE_VOLUME * (getMusicVolumePercent() / 100)));
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

function playTrack(trackId: BackgroundMusicTrackId, crossfade = true): void {
  if (!canUseAudio()) return;

  const track = BACKGROUND_MUSIC_TRACKS.find(entry => entry.id === trackId);
  if (!track) return;

  if (activeTrackId === trackId && activeAudio) {
    applyActiveTrackVolume();
    if (activeAudio.paused) {
      void activeAudio.play().catch(() => {
        // Browsers can block audio before the first user gesture.
      });
    }
    return;
  }

  if (activeAudio) {
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

  void audio.play().catch(() => {
    // Browsers can block audio before the first user gesture.
  });
  fadeAudioVolume(audio, getEffectiveMusicVolume(), crossfade ? MUSIC_CROSSFADE_MS : 0);
}

export function authorizeBackgroundMusic(): void {
  if (!canUseAudio() || unlocked) return;
  unlocked = true;
}

export function unlockBackgroundMusic(): void {
  if (!canUseAudio() || unlocked) return;
  unlocked = true;
  syncBackgroundMusic();
}

export function syncBackgroundMusic(): void {
  if (!canUseAudio()) return;

  if (!shouldPlayBackgroundMusic()) {
    stopActiveTrack();
    return;
  }

  if (activeAudio && activeTrackId) {
    applyActiveTrackVolume();
    if (activeAudio.paused) {
      void activeAudio.play().catch(() => {
        // Browsers can block audio before the first user gesture.
      });
    }
    return;
  }

  if (shufflePlaylist.length === 0) {
    rebuildShufflePlaylist();
  }

  playTrack(takeNextTrackId());
}

export function skipBackgroundMusicTrack(): void {
  if (!shouldPlayBackgroundMusic()) return;
  playTrack(takeNextTrackId(), true);
}
