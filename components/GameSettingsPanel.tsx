'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import {
  CombatIndicatorMode,
  COMBAT_SPEED_OPTIONS,
  CombatSpeed,
  readCombatIndicatorMode,
  readCombatSpeedSetting,
  writeCombatIndicatorMode,
  writeCombatSpeedSetting,
} from '@/lib/combatSettings';
import {
  getMusicVolumePercent,
  isMusicMuted,
  setMusicMuted,
  setMusicVolumePercent,
} from '@/lib/backgroundMusic';
import {
  getGameSoundVolumePercent,
  playGameSound,
  setGameSoundVolumePercent,
} from '@/lib/sound';
import { getCurrentUser } from '@/lib/auth';
import {
  readSingleplayerRunTutorialEnabled,
  readSingleplayerRunTutorialProgress,
  resetSingleplayerRunTutorial,
  writeSingleplayerRunTutorialEnabled,
} from '@/lib/singleplayerTutorial';

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="settings-section-head">
      <h3 className="fantasy-heading settings-section-title">{title}</h3>
      {action ? <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase">{action}</span> : null}
    </div>
  );
}

function VolumeControl({
  label,
  hint,
  valueLabel,
  value,
  disabled = false,
  onChange,
  ariaLabel,
}: {
  label: string;
  hint?: string;
  valueLabel: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="settings-volume-row">
      <div className="settings-volume-head">
        <div className="settings-volume-copy">
          <span className="settings-volume-label">{label}</span>
          {hint ? <span className="settings-volume-hint">{hint}</span> : null}
        </div>
        <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="settings-volume-range"
        aria-label={ariaLabel}
        style={{ '--settings-volume': `${value}%` } as CSSProperties}
      />
    </div>
  );
}

export default function GameSettingsPanel({ showRunTutorial = false, compact = false }: { showRunTutorial?: boolean; compact?: boolean }) {
  const [effectsVolume, setEffectsVolume] = useState(() => getGameSoundVolumePercent());
  const [musicVolume, setMusicVolume] = useState(() => getMusicVolumePercent());
  const [musicMuted, setMusicMutedState] = useState(() => isMusicMuted());
  const [combatSpeed, setCombatSpeed] = useState<CombatSpeed>(() => readCombatSpeedSetting());
  const [combatIndicatorMode, setCombatIndicatorMode] = useState<CombatIndicatorMode>(() => readCombatIndicatorMode());
  const [runTutorialEnabled, setRunTutorialEnabled] = useState(() => readSingleplayerRunTutorialEnabled());
  const [runTutorialProgress, setRunTutorialProgress] = useState(() => readSingleplayerRunTutorialProgress(getCurrentUser()?.username));

  useEffect(() => {
    const sync = () => {
      setEffectsVolume(getGameSoundVolumePercent());
      setMusicVolume(getMusicVolumePercent());
      setMusicMutedState(isMusicMuted());
      setCombatSpeed(readCombatSpeedSetting());
      setCombatIndicatorMode(readCombatIndicatorMode());
      setRunTutorialEnabled(readSingleplayerRunTutorialEnabled());
      setRunTutorialProgress(readSingleplayerRunTutorialProgress(getCurrentUser()?.username));
    };

    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const activeSpeedLabel = COMBAT_SPEED_OPTIONS.find(option => option.id === combatSpeed)?.label || 'Normal';
  const musicStatusLabel = musicMuted ? 'Muted' : `${musicVolume}%`;
  const rootClass = compact ? 'game-settings-panel game-settings-panel-compact' : 'game-settings-panel game-settings-panel-full';

  return (
    <div className={rootClass}>
      <section className="ui-card settings-block settings-block-audio rounded border p-3">
        <SectionTitle title="Audio" action={`FX ${effectsVolume}%`} />
        <div className="settings-block-body">
          <VolumeControl
            label="Sound Effects"
            hint={compact ? undefined : 'UI, map, combat, and inventory sounds'}
            valueLabel={`${effectsVolume}%`}
            value={effectsVolume}
            ariaLabel="Sound effects volume"
            onChange={(nextValue) => {
              setGameSoundVolumePercent(nextValue);
              setEffectsVolume(getGameSoundVolumePercent());
            }}
          />

          <VolumeControl
            label="Background Music"
            hint={compact ? undefined : 'Looping tavern ambience while you play'}
            valueLabel={musicStatusLabel}
            value={musicVolume}
            disabled={musicMuted}
            ariaLabel="Background music volume"
            onChange={(nextValue) => {
              setMusicVolumePercent(nextValue);
              setMusicVolume(getMusicVolumePercent());
              setMusicMutedState(isMusicMuted());
            }}
          />

          <div className="settings-inline-actions">
            <button
              type="button"
              onClick={() => {
                const nextMuted = !musicMuted;
                setMusicMuted(nextMuted);
                setMusicMutedState(isMusicMuted());
                setMusicVolume(getMusicVolumePercent());
                playGameSound('ui.toggle', { throttleMs: 100 });
              }}
              className={`settings-speed-option rounded border px-3 py-2 text-left ${musicMuted ? 'settings-speed-option-active' : ''}`}
              aria-pressed={musicMuted}
            >
              <span className="settings-option-label">{musicMuted ? 'Unmute Music' : 'Mute Music'}</span>
            </button>
            <button
              type="button"
              data-sound-click="off"
              onClick={() => playGameSound('ui.click', { throttleMs: 80 })}
              disabled={effectsVolume <= 0}
              className="ui-button rounded px-3 py-2 text-xs font-black disabled:opacity-40"
            >
              Test FX
            </button>
          </div>
        </div>
      </section>

      <section className="ui-card settings-block rounded border p-3">
        <SectionTitle title="Combat Speed" action={activeSpeedLabel} />
        <div className="settings-speed-grid settings-speed-grid-compact">
          {COMBAT_SPEED_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setCombatSpeed(option.id);
                writeCombatSpeedSetting(option.id);
                playGameSound('ui.toggle', { throttleMs: 100 });
              }}
              className={`settings-speed-option rounded border px-3 py-2 text-left ${combatSpeed === option.id ? 'settings-speed-option-active' : ''}`}
              aria-pressed={combatSpeed === option.id}
            >
              <span className="settings-option-label">{option.label}</span>
              {!compact ? (
                <span className="settings-option-hint">
                  {option.id === 'normal' ? 'Readable pacing' : option.id === 'fast' ? 'Shorter pauses' : 'Minimum waits'}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className="ui-card settings-block rounded border p-3">
        <SectionTitle title="Combat Readability" action={combatIndicatorMode === 'colorblind' ? 'Colorblind' : 'Default'} />
        <div className="settings-speed-grid settings-readability-grid">
          {([
            { id: 'default' as const, label: 'Default', detail: 'Classic red, green, and gold combat cues' },
            { id: 'colorblind' as const, label: 'Colorblind Safe', detail: 'Patterned move, heal, damage, and threat indicators' },
          ]).map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setCombatIndicatorMode(option.id);
                writeCombatIndicatorMode(option.id);
                playGameSound('ui.toggle', { throttleMs: 100 });
              }}
              className={`settings-speed-option rounded border px-3 py-2 text-left ${combatIndicatorMode === option.id ? 'settings-speed-option-active' : ''}`}
              aria-pressed={combatIndicatorMode === option.id}
            >
              <span className="settings-option-label">{option.label}</span>
              {!compact ? <span className="settings-option-hint">{option.detail}</span> : null}
            </button>
          ))}
        </div>
      </section>

      {showRunTutorial && (
        <section className="ui-card settings-block settings-block-wide rounded border p-3">
          <SectionTitle title="Singleplayer Tutorial" action={runTutorialEnabled ? 'On' : 'Off'} />
          <button
            type="button"
            onClick={() => {
              const nextEnabled = !runTutorialEnabled;
              setRunTutorialEnabled(nextEnabled);
              writeSingleplayerRunTutorialEnabled(nextEnabled);
              playGameSound('ui.toggle', { throttleMs: 100 });
            }}
            className={`settings-speed-option w-full rounded border px-3 py-2 text-left ${runTutorialEnabled ? 'settings-speed-option-active' : ''}`}
            aria-pressed={runTutorialEnabled}
          >
            <span className="settings-option-label">First Run Guide</span>
            {!compact ? (
              <span className="settings-option-hint">Cinematic singleplayer guidance on major run screens.</span>
            ) : null}
          </button>
          <div className="settings-tutorial-row">
            <span className="ui-faint text-xs font-bold">
              {runTutorialProgress.completed ? 'Complete' : `${runTutorialProgress.seenStepIds.length}/8 steps`}
            </span>
            <button
              type="button"
              onClick={() => {
                const user = getCurrentUser();
                const nextProgress = resetSingleplayerRunTutorial(user?.username);
                setRunTutorialEnabled(readSingleplayerRunTutorialEnabled());
                setRunTutorialProgress(nextProgress);
                playGameSound('ui.toggle', { throttleMs: 100 });
              }}
              className="ui-button rounded px-3 py-1.5 text-xs font-black"
            >
              Reset
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
