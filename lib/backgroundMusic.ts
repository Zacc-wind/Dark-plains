export const BACKGROUND_MUSIC_TRACKS = [
  { id: 'goblet-bounce', file: '/assets/audio/music/goblet-bounce.mp3', label: 'Goblet Bounce' },
  { id: 'goblet-bounce-v2', file: '/assets/audio/music/goblet-bounce-v2.mp3', label: 'Goblet Bounce v2' },
  { id: 'tavern-crown-shuffle', file: '/assets/audio/music/tavern-crown-shuffle.mp3', label: 'Tavern Crown Shuffle' },
  { id: 'tavern-crown-shuffle-v2', file: '/assets/audio/music/tavern-crown-shuffle-v2.mp3', label: 'Tavern Crown Shuffle v2' },
  { id: 'in-the-tavern', file: '/assets/audio/music/in-the-tavern.mp3', label: 'In the Tavern' },
  { id: 'guards-cleaning-tavern', file: '/assets/audio/music/guards-cleaning-tavern.mp3', label: 'Guards Cleaning the Tavern' },
] as const;

export type BackgroundMusicTrackId = (typeof BACKGROUND_MUSIC_TRACKS)[number]['id'];

export const AUDIO_SETTINGS_EVENT = 'wizardy:audio-settings';

const MUSIC_VOLUME_KEY = 'wizardy_music_volume';
const MUSIC_MUTED_KEY = 'wizardy_music_muted';
const TRACK_BASE_VOLUME = 0.38;

let activeAudio: HTMLAudioElement | null = null;
let activeTrackId: BackgroundMusicTrackId | null = null;
let onEndedHandler: (() => void) | null = null;
let unlocked = false;
let shufflePlaylist: BackgroundMusicTrackId[] = [];
let playlistIndex = 0;

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

function applyActiveTrackVolume(): void {
  if (!activeAudio) return;
  activeAudio.volume = getEffectiveMusicVolume();
}

function detachEndedHandler(audio: HTMLAudioElement): void {
  if (!onEndedHandler) return;
  audio.removeEventListener('ended', onEndedHandler);
  onEndedHandler = null;
}

function stopActiveTrack(): void {
  if (!activeAudio) return;
  detachEndedHandler(activeAudio);
  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
  activeTrackId = null;
}

function handleTrackEnded(): void {
  if (!shouldPlayBackgroundMusic()) return;
  playTrack(takeNextTrackId());
}

function playTrack(trackId: BackgroundMusicTrackId): void {
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

  stopActiveTrack();

  const audio = new Audio(track.file);
  audio.loop = false;
  audio.preload = 'auto';
  audio.volume = getEffectiveMusicVolume();
  onEndedHandler = handleTrackEnded;
  audio.addEventListener('ended', onEndedHandler);
  activeAudio = audio;
  activeTrackId = trackId;

  void audio.play().catch(() => {
    // Browsers can block audio before the first user gesture.
  });
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
  stopActiveTrack();
  playTrack(takeNextTrackId());
}
