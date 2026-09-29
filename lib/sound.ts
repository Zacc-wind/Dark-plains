export const GAME_SOUND_ASSETS = {
  'ui.click': { file: '/assets/audio/ui/click_confirm.ogg', volume: 0.55 },
  'ui.clickSoft': { file: '/assets/audio/ui/click_soft.ogg', volume: 0.48 },
  'ui.hover': { file: '/assets/audio/ui/hover_tick.ogg', volume: 0.28 },
  'ui.toggle': { file: '/assets/audio/ui/toggle_switch.ogg', volume: 0.48 },
  'ui.modalOpen': { file: '/assets/audio/ui/book_open.ogg', volume: 0.5 },
  'ui.tab': { file: '/assets/audio/ui/book_flip.ogg', volume: 0.42 },
  'world.townEnter': { file: '/assets/audio/world/town_enter.ogg', volume: 0.5 },
  'world.townLeave': { file: '/assets/audio/world/town_leave.ogg', volume: 0.44 },
  'world.walkStep1': { file: '/assets/audio/world/walk_step_1.ogg', volume: 0.32 },
  'world.walkStep2': { file: '/assets/audio/world/walk_step_2.ogg', volume: 0.32 },
  'combat.weaponDraw': { file: '/assets/audio/combat/weapon_draw.ogg', volume: 0.42 },
  'combat.meleeSlice': { file: '/assets/audio/combat/melee_slice.ogg', volume: 0.5 },
  'combat.meleeHeavy': { file: '/assets/audio/combat/melee_heavy.ogg', volume: 0.54 },
  'combat.bladeHit': { file: '/assets/audio/combat/blade_hit.ogg', volume: 0.5 },
  'combat.armorHit': { file: '/assets/audio/combat/armor_hit.ogg', volume: 0.52 },
  'combat.unitHurt': { file: '/assets/audio/combat/unit_hurt.ogg', volume: 0.46 },
  'combat.unitDeath': { file: '/assets/audio/combat/unit_death.wav', volume: 0.42 },
  'combat.moveDust': { file: '/assets/audio/combat/move_dust.ogg', volume: 0.34 },
  'combat.wait': { file: '/assets/audio/combat/wait.ogg', volume: 0.34 },
  'combat.guard': { file: '/assets/audio/combat/guard.ogg', volume: 0.43 },
  'combat.heal': { file: '/assets/audio/combat/blessing.ogg', volume: 0.5 },
  'combat.blessing': { file: '/assets/audio/combat/blessing.ogg', volume: 0.5 },
  'combat.manaFocus': { file: '/assets/audio/combat/mana_focus.ogg', volume: 0.44 },
  'combat.ranged': { file: '/assets/audio/combat/ranged.ogg', volume: 0.46 },
  'combat.rangedRelease': { file: '/assets/audio/combat/ranged_release.ogg', volume: 0.4 },
  'combat.rangedImpact': { file: '/assets/audio/combat/ranged_impact.ogg', volume: 0.48 },
  'combat.spellCast': { file: '/assets/audio/combat/spell_cast.ogg', volume: 0.5 },
  'combat.spellHit': { file: '/assets/audio/combat/spell_hit.ogg', volume: 0.52 },
  'combat.spellFire': { file: '/assets/audio/combat/spell_fire.ogg', volume: 0.48 },
  'combat.spellBuff': { file: '/assets/audio/combat/buff.ogg', volume: 0.45 },
  'combat.spellControl': { file: '/assets/audio/combat/control.ogg', volume: 0.47 },
  'combat.spellFlame': { file: '/assets/audio/combat/spell_flame.ogg', volume: 0.5 },
  'combat.spellLightning': { file: '/assets/audio/combat/spell_lightning.ogg', volume: 0.5 },
  'combat.spellShadow': { file: '/assets/audio/combat/spell_shadow.ogg', volume: 0.5 },
  'combat.spellFrost': { file: '/assets/audio/combat/spell_frost.ogg', volume: 0.5 },
  'combat.spellHoly': { file: '/assets/audio/combat/spell_holy.ogg', volume: 0.48 },
  'combat.bossRoar': { file: '/assets/audio/combat/boss_roar.ogg', volume: 0.58 },
  'combat.victory': { file: '/assets/audio/combat/victory.ogg', volume: 0.58 },
  'combat.defeat': { file: '/assets/audio/combat/defeat.ogg', volume: 0.58 },
  'inventory.coins': { file: '/assets/audio/inventory/coins.ogg', volume: 0.42 },
  'inventory.goldGain': { file: '/assets/audio/inventory/gold_gain.ogg', volume: 0.44 },
  'inventory.gemGain': { file: '/assets/audio/inventory/gem_gain.ogg', volume: 0.44 },
  'quest.claim': { file: '/assets/audio/quest/quest_claim.ogg', volume: 0.5 },
  'social.challengeReceived': { file: '/assets/audio/combat/weapon_draw.ogg', volume: 0.42 },
  'social.tradeReceived': { file: '/assets/audio/inventory/coins.ogg', volume: 0.4 },
  'social.partyInvite': { file: '/assets/audio/ui/book_open.ogg', volume: 0.44 },
  'social.accept': { file: '/assets/audio/ui/click_confirm.ogg', volume: 0.52 },
  'social.decline': { file: '/assets/audio/ui/click_soft.ogg', volume: 0.44 },
} as const;

export type GameSoundId = keyof typeof GAME_SOUND_ASSETS;

const SOUND_MUTED_KEY = 'wizardy_sound_muted';
const SOUND_VOLUME_KEY = 'wizardy_sound_volume';
const MAX_POOLED_AUDIO_PER_SOUND = 4;
const cachedAudio = new Map<GameSoundId, HTMLAudioElement>();
const audioPools = new Map<GameSoundId, HTMLAudioElement[]>();
const lastPlayedAt = new Map<GameSoundId, number>();

export function isGameSoundId(id: string): id is GameSoundId {
  return Object.prototype.hasOwnProperty.call(GAME_SOUND_ASSETS, id);
}

function canUseAudio(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

export function isGameSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SOUND_MUTED_KEY) === 'true' || getGameSoundVolumePercent() <= 0;
}

export function setGameSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_MUTED_KEY, muted ? 'true' : 'false');
  if (!muted && getGameSoundVolumePercent() <= 0) {
    setGameSoundVolumePercent(70);
    return;
  }
  notifyEffectsSettingsChanged();
}

export function getGameSoundVolumePercent(): number {
  if (typeof window === 'undefined') return 70;
  const rawValue = window.localStorage.getItem(SOUND_VOLUME_KEY);
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : 70;
  if (!Number.isFinite(parsed)) return 70;
  return Math.max(0, Math.min(100, parsed));
}

export function setGameSoundVolumePercent(value: number): void {
  if (typeof window === 'undefined') return;
  const nextValue = Math.max(0, Math.min(100, Math.round(value)));
  window.localStorage.setItem(SOUND_VOLUME_KEY, String(nextValue));
  window.localStorage.setItem(SOUND_MUTED_KEY, nextValue <= 0 ? 'true' : 'false');
  notifyEffectsSettingsChanged();
}

function notifyEffectsSettingsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wizardy:audio-settings'));
}

export function preloadGameSounds(ids: GameSoundId[] = ['ui.click', 'ui.clickSoft', 'ui.hover', 'ui.toggle']): void {
  if (!canUseAudio()) return;

  ids.forEach(id => {
    if (cachedAudio.has(id)) return;
    const config = GAME_SOUND_ASSETS[id];
    const audio = new Audio(config.file);
    audio.preload = 'auto';
    audio.volume = config.volume;
    cachedAudio.set(id, audio);
  });
}

export function playGameSound(
  id: GameSoundId,
  options: { volumeScale?: number; throttleMs?: number } = {}
): void {
  if (!canUseAudio() || isGameSoundMuted()) return;

  const config = GAME_SOUND_ASSETS[id];
  const masterVolume = getGameSoundVolumePercent() / 100;
  if (masterVolume <= 0) return;
  const now = window.performance.now();
  const throttleMs = options.throttleMs ?? 36;
  const previous = lastPlayedAt.get(id) ?? 0;
  if (now - previous < throttleMs) return;
  lastPlayedAt.set(id, now);

  const audio = acquirePooledAudio(id);
  audio.volume = Math.max(0, Math.min(1, config.volume * masterVolume * (options.volumeScale ?? 1)));
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Browsers can block audio before the first user gesture; this is non-fatal.
  });
}

function acquirePooledAudio(id: GameSoundId): HTMLAudioElement {
  const baseAudio = cachedAudio.get(id) || new Audio(GAME_SOUND_ASSETS[id].file);
  cachedAudio.set(id, baseAudio);

  let pool = audioPools.get(id);
  if (!pool) {
    pool = [];
    audioPools.set(id, pool);
  }

  const idle = pool.find(audio => audio.paused || audio.ended);
  if (idle) return idle;

  if (pool.length < MAX_POOLED_AUDIO_PER_SOUND) {
    const audio = baseAudio.cloneNode(true) as HTMLAudioElement;
    pool.push(audio);
    return audio;
  }

  // Every instance is still playing: restart the one that has played the longest.
  return pool.reduce((oldest, audio) => (audio.currentTime > oldest.currentTime ? audio : oldest));
}
