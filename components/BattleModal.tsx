'use client';

import Image from 'next/image';
import type { CSSProperties, MouseEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BATTLE_SPELLS,
  BATTLE_TERRAIN_LABELS,
  BattleLogEntry,
  BattleState,
  BattleSpell,
  BattleTerrainType,
  BattleUnit,
  WorldEnemy,
  advanceBattleTurn,
  attackBattleUnit,
  canAttack,
  canBonusMoveTo,
  canHeal,
  canMoveTo,
  canRetaliateAfterAttack,
  castBattleSpell,
  createNpcBattleState,
  getBattleSpellLogStyle,
  BATTLE_DEATH_DISSOLVE_MS,
  BATTLE_DEATH_HIT_MS,
  BATTLE_DEFAULT_PRESENTATION_MS,
  BOSS_LAST_STAND_PRESENTATION_MS,
  BOSS_LAST_STAND_RESPAWN_REVEAL_MS,
  BOSS_SPECIAL_PRESENTATION_MS,
  BOSS_SPECIAL_SUMMON_REVEAL_MS,
  getBattleLogPresentationMs,
  getRecentPresentationLogEntry,
  hasDefeatedLogTarget,
  pickFreshPresentationLogEntry,
  focusCommanderMana,
  getActiveUnit,
  getAttackDamage,
  getBattleMana,
  getDistance,
  getHealAmount,
  getMinionSupportAbility,
  getRetaliationDamage,
  getTerrainAt,
  getTurnTimeRemaining,
  getTurnOrder,
  getUnitAt,
  healBattleUnit,
  isBonusMovePending,
  isObstacle,
  markWorldEnemyDefeated,
  moveBattleUnit,
  moveBonusBattleUnit,
  runEnemyBattleTurn,
  applyMinionSupportAbility,
  skipBonusBattleMove,
  waitBattleUnit,
} from '@/lib/battle';
import {
  ActivityEntry,
  CharacterStats,
  DEFAULT_EQUIPPED_SPELL_IDS,
  Equipment,
  EquipmentRarity,
  InventoryItem,
  MinionCasualtyReport,
  MinionStack,
  User,
  applyMinionBattleCasualties,
  addEquipmentWithLimit,
  addInventoryItemsWithLimit,
  generateEquipment,
  getCurrentUser,
  getCityQuestStatus,
  getCityQuestTemplate,
  getMinionTemplate,
  getStoryQuestStatus,
  makeInventoryItem,
  MINION_CLASS_LABELS,
  MINION_TIER_LABELS,
  recruitMinionsFromOffer,
  recordPvpDuelOutcome,
  rollInventoryBonusDrops,
  STORY_CHAPTERS,
  updateCurrentUser,
} from '@/lib/auth';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import {
  CombatSpeed,
  readCombatIndicatorMode,
  readCombatSpeedSetting,
} from '@/lib/combatSettings';
import { emitFxEvent, type FxEventType } from '@/lib/fxEvents';
import { readGameJson, writeGameJson } from '@/lib/gameStore';
import { playGameSound, preloadGameSounds, type GameSoundId } from '@/lib/sound';
import { getSpellIconPath } from '@/lib/spellAssets';
import CombatThreeFxLayer from './CombatThreeFxLayer';
import SingleplayerTutorialOverlay from './SingleplayerTutorialOverlay';
import {
  SINGLEPLAYER_RUN_TUTORIAL_GUIDE_ASSET,
  type SingleplayerRunTutorialStep,
  type SingleplayerRunTutorialStepId,
} from '@/lib/singleplayerTutorial';

interface BattleModalProps {
  enemy: WorldEnemy;
  onClose: () => void;
  playerStacks?: MinionStack[];
  playerStats?: CharacterStats;
  playerFormation?: Record<string, { x: number; y: number }>;
  availableSpellIds?: string[];
  persistentResults?: boolean;
  onBattleEnd?: (result: { status: BattleResultReportData['status']; battle: BattleState; reward?: VictoryRewardReport; healthLost?: number; retreated?: boolean }) => void;
  contextLabel?: string;
  tutorialStep?: SingleplayerRunTutorialStep | null;
  onTutorialContinue?: (stepId: SingleplayerRunTutorialStepId) => void;
  onTutorialSkip?: () => void;
}

type BattleCueTone = 'player' | 'enemy' | 'neutral' | 'danger' | 'victory';

interface BattleCue {
  headline: string;
  detail: string;
  tone: BattleCueTone;
}

type CombatTutorialStageId =
  | 'unit-wait'
  | 'healer-blessing'
  | 'commander-focus'
  | 'commander-open-spells'
  | 'commander-select-spell'
  | 'commander-pick-target';

type BattleTutorialOrbFocus = 'wait' | 'mana' | 'spell';

interface CombatTutorialStage {
  id: CombatTutorialStageId;
  kicker: string;
  title: string;
  body: string;
  hint: string;
  orbFocus?: BattleTutorialOrbFocus;
  acknowledge?: 'unit-wait' | 'healer-blessing';
}

interface BattleTurnBannerData {
  id: string;
  side: BattleUnit['side'];
  title: string;
  detail: string;
}

interface BattleHoverPreviewData {
  title: string;
  detail: string;
  tone: 'neutral' | 'good' | 'danger';
}

interface BattleHoverForecastData {
  unit: BattleUnit;
  actionLabel?: string;
  amount?: number;
  retaliationDamage?: number;
  retaliationCurrentHealth?: number;
  retaliationProjectedHealth?: number;
  retaliationMaxHealth?: number;
  tone: 'neutral' | 'good' | 'danger';
  currentHealth: number;
  projectedHealth: number;
  maxHealth: number;
}

type BattlePieceAnimation =
  | 'move'
  | 'melee'
  | 'ranged'
  | 'hit-melee'
  | 'hit-ranged'
  | 'heal'
  | 'buff'
  | 'defend'
  | 'debuff'
  | 'morale'
  | 'commander-spell'
  | 'spell-hit'
  | 'rise'
  | null;

interface BattleSpeedConfig {
  label: string;
  playerDelayMs: number;
}

/** Shared spell icon / unit presentation window for every spell cast. */
const SPELL_PRESENTATION_MS = 2300;
const SPELL_NOTICE_MS = 1450;
const BATTLE_MOVE_TRANSIT_MS = 1450;
const RUN_VICTORY_BANNER_DELAY_MS = 500;
const RUN_VICTORY_AFTER_ANIMATION_HOLD_MS = 3000;
const RUN_VICTORY_HANDOFF_FLOOR_MS = BATTLE_DEATH_HIT_MS + BATTLE_DEATH_DISSOLVE_MS + RUN_VICTORY_AFTER_ANIMATION_HOLD_MS;

/** Enemy turns always use this pacing, regardless of the combat speed setting. */
const ENEMY_BATTLE_PACE = {
  delayBeforeMs: 1250,
  actionHoldMs: 850,
  commanderDelayBonusMs: 400,
  commanderHoldBonusMs: 550,
  presentationMs: 1850,
  spellPresentationMs: SPELL_PRESENTATION_MS,
  spellNoticeMs: 1750,
} as const;

interface PresentationPin {
  entry: BattleLogEntry;
  expiresAt: number;
}

const BATTLE_SPEEDS: Record<CombatSpeed, BattleSpeedConfig> = {
  normal: { label: 'Normal', playerDelayMs: 950 },
  fast: { label: 'Fast', playerDelayMs: 760 },
  instant: { label: 'Instant', playerDelayMs: 420 },
};

interface VictoryRewardReport {
  gold: number;
  exp: number;
  rareGems?: number;
  equipmentRarity?: EquipmentRarity;
  rareGemsAccepted?: number;
  equipmentNames?: string[];
  itemNames?: string[];
  questProgress?: QuestProgressLine[];
  inventoryFull?: boolean;
}

interface QuestProgressLine {
  id: string;
  label: string;
  value: string;
  complete: boolean;
}

interface BattleResultReportData {
  status: 'victory' | 'defeat' | 'recruited';
  reward?: VictoryRewardReport;
  healthLost?: number;
  recruitedMinions?: string[];
  casualtyReport?: MinionCasualtyReport;
  completedAt: number;
}

interface BattleSpellCastNoticeData {
  id: string;
  spell: BattleSpell;
  side?: 'player' | 'enemy';
}

interface BattleSpellImpactData {
  spell: BattleSpell;
  iconPath: string;
  tone: 'damage' | 'support' | 'field';
}

interface BattleStanceIconImpactData {
  iconPath: string;
  tone: 'support' | 'field';
  sizeClass: 'wait' | 'mana-focus' | 'support';
}

const BATTLE_WAIT_SHIELD_ICON = '/assets/icons/defense.png';
const BATTLE_MANA_FOCUS_ICON = '/assets/icons/xp.png';

const BATTLE_PRELOAD_SOUND_IDS: GameSoundId[] = [
  'combat.weaponDraw',
  'combat.meleeSlice',
  'combat.meleeHeavy',
  'combat.bladeHit',
  'combat.armorHit',
  'combat.unitHurt',
  'combat.unitDeath',
  'combat.moveDust',
  'combat.wait',
  'combat.guard',
  'combat.heal',
  'combat.blessing',
  'combat.manaFocus',
  'combat.ranged',
  'combat.rangedRelease',
  'combat.rangedImpact',
  'combat.spellCast',
  'combat.spellHit',
  'combat.spellFire',
  'combat.spellBuff',
  'combat.spellControl',
  'combat.spellFlame',
  'combat.spellLightning',
  'combat.spellShadow',
  'combat.spellFrost',
  'combat.spellHoly',
  'combat.victory',
  'combat.defeat',
];

const CONFIRM_MOVE_SETTING_KEY = 'pirate_game_confirm_move_enabled';

export default function BattleModal({
  enemy,
  onClose,
  playerStacks,
  playerStats,
  playerFormation,
  availableSpellIds,
  persistentResults = true,
  onBattleEnd,
  tutorialStep,
  onTutorialContinue,
  onTutorialSkip,
}: BattleModalProps) {
  const [battle, setBattle] = useState<BattleState | null>(() => {
    const user = getCurrentUser();
    return user ? createNpcBattleState(user, enemy, {
      playerStacks,
      playerStats,
      playerFormation,
      suppressRecruitOffer: !persistentResults,
    }) : null;
  });
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [isSpellMenuOpen, setIsSpellMenuOpen] = useState(false);
  const [battleSpeed] = useState<CombatSpeed>(() => readCombatSpeedSetting());
  const [spellCastNotice, setSpellCastNotice] = useState<BattleSpellCastNoticeData | null>(null);
  const [presentationPin, setPresentationPin] = useState<PresentationPin | null>(null);
  const [resultReport, setResultReport] = useState<BattleResultReportData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [bossLastStandCue, setBossLastStandCue] = useState<{
    id: string;
    commanderName: string;
    assetPath: string;
    subtitle?: string;
    resurrectedUnits: Array<{ id: string; assetPath: string; x: number; y: number }>;
  } | null>(null);
  const [bossSpecialCue, setBossSpecialCue] = useState<{
    id: string;
    commanderName: string;
    assetPath: string;
    subtitle?: string;
    spellName: string;
    summonedUnits: Array<{ id: string; assetPath: string; x: number; y: number }>;
  } | null>(null);
  const [isResolvingAction, setIsResolvingAction] = useState(false);
  const [battleCue, setBattleCue] = useState<BattleCue | null>(null);
  const [turnBanner, setTurnBanner] = useState<BattleTurnBannerData | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [hoverCursor, setHoverCursor] = useState<{ x: number; y: number } | null>(null);
  const [pendingMoveUndo, setPendingMoveUndo] = useState<BattleState | null>(null);
  const [confirmMoveEnabled, setConfirmMoveEnabled] = useState(() => readGameJson(CONFIRM_MOVE_SETTING_KEY, false));
  const [indicatorMode] = useState(() => readCombatIndicatorMode());
  const [combatTutorialIntroDismissed, setCombatTutorialIntroDismissed] = useState(false);
  const [combatTutorialUnitWaitSeen, setCombatTutorialUnitWaitSeen] = useState(false);
  const [combatTutorialHealerBlessingSeen, setCombatTutorialHealerBlessingSeen] = useState(false);
  const [combatTutorialCommanderSpellCast, setCombatTutorialCommanderSpellCast] = useState(false);
  const [combatTutorialNudge, setCombatTutorialNudge] = useState<string | null>(null);
  const enemyTimer = useRef<number | null>(null);
  const enemyActionHoldTimer = useRef<number | null>(null);
  const playerActionTimer = useRef<number | null>(null);
  const battleEndNotifyTimer = useRef<number | null>(null);
  const defeatExitTimer = useRef<number | null>(null);
  const combatTutorialCompleteTimerRef = useRef<number | null>(null);
  const battleSoundTimers = useRef<number[]>([]);
  const bossLastStandTimer = useRef<number | null>(null);
  const bossLastStandCueRef = useRef<typeof bossLastStandCue>(null);
  const bossSpecialTimer = useRef<number | null>(null);
  const bossSpecialCueRef = useRef<typeof bossSpecialCue>(null);
  const queuedBossSpecialCue = useRef<typeof bossSpecialCue>(null);
  const spellNoticeTimer = useRef<number | null>(null);
  const turnBannerTimer = useRef<number | null>(null);
  const activeSpellNoticeRef = useRef<BattleSpellCastNoticeData | null>(null);
  const queuedTurnBanner = useRef<BattleTurnBannerData | null>(null);
  const lastTurnBannerSide = useRef<BattleUnit['side'] | null>(null);
  const lastSoundLogEntryId = useRef<string | null>(null);
  const processedBattleLogIds = useRef<Set<string>>(new Set());
  const rewardClaimed = useRef(false);
  const battleEndNotified = useRef(false);
  const completionNoticeEmitted = useRef(false);
  const closeRequested = useRef(false);
  const resultSoundEmitted = useRef(false);
  const combatTutorialCompletedRef = useRef(false);
  const speedConfig = BATTLE_SPEEDS[battleSpeed];
  const isCombatTutorialStep = tutorialStep?.id === 'combat' && Boolean(onTutorialContinue && onTutorialSkip);
  const baseActiveSpellIds = availableSpellIds || getCurrentUser()?.equippedSpellIds || DEFAULT_EQUIPPED_SPELL_IDS;
  const activeSpellIds = isCombatTutorialStep
    ? Array.from(new Set(['ember-dart', ...baseActiveSpellIds])).slice(0, 4)
    : baseActiveSpellIds;
  const availableSpells = BATTLE_SPELLS.filter(spell => activeSpellIds.includes(spell.id)).slice(0, 4);

  useEffect(() => {
    preloadGameSounds(BATTLE_PRELOAD_SOUND_IDS);
  }, []);

  useEffect(() => {
    const tickMs = battle?.status === 'active' ? 50 : 1000;
    const interval = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(interval);
  }, [battle?.status]);

  useEffect(() => () => {
    if (enemyTimer.current) window.clearTimeout(enemyTimer.current);
    if (enemyActionHoldTimer.current) window.clearTimeout(enemyActionHoldTimer.current);
    if (playerActionTimer.current) window.clearTimeout(playerActionTimer.current);
    if (battleEndNotifyTimer.current) window.clearTimeout(battleEndNotifyTimer.current);
    if (bossLastStandTimer.current) window.clearTimeout(bossLastStandTimer.current);
    if (bossSpecialTimer.current) window.clearTimeout(bossSpecialTimer.current);
    if (defeatExitTimer.current) window.clearTimeout(defeatExitTimer.current);
    if (combatTutorialCompleteTimerRef.current) window.clearTimeout(combatTutorialCompleteTimerRef.current);
    if (spellNoticeTimer.current) window.clearTimeout(spellNoticeTimer.current);
    if (turnBannerTimer.current) window.clearTimeout(turnBannerTimer.current);
    battleSoundTimers.current.forEach(timer => window.clearTimeout(timer));
    battleSoundTimers.current = [];
  }, []);

  useEffect(() => {
    if (!combatTutorialNudge) return;
    const timer = window.setTimeout(() => setCombatTutorialNudge(null), 2200);
    return () => window.clearTimeout(timer);
  }, [combatTutorialNudge]);

  const showTurnBanner = useCallback((banner: BattleTurnBannerData) => {
    if (turnBannerTimer.current) window.clearTimeout(turnBannerTimer.current);
    setTurnBanner(banner);
    turnBannerTimer.current = window.setTimeout(() => {
      setTurnBanner(current => current?.id === banner.id ? null : current);
      turnBannerTimer.current = null;
    }, banner.side === 'enemy' ? 1450 : 1250);
  }, []);

  const flushQueuedTurnBanner = useCallback(() => {
    if (queuedTurnBanner.current && !activeSpellNoticeRef.current && !bossLastStandCueRef.current && !bossSpecialCueRef.current) {
      const banner = queuedTurnBanner.current;
      queuedTurnBanner.current = null;
      showTurnBanner(banner);
    }
  }, [showTurnBanner]);

  const flushQueuedBossSpecialCue = useCallback(() => {
    if (queuedBossSpecialCue.current && !bossLastStandCueRef.current && !bossSpecialCueRef.current) {
      const cue = queuedBossSpecialCue.current;
      queuedBossSpecialCue.current = null;
      bossSpecialCueRef.current = cue;
      setBossSpecialCue(cue);
      setIsResolvingAction(true);
      setTurnBanner(null);
      playGameSound('combat.spellCast', { volumeScale: 0.82, throttleMs: 900 });
      emitFxEvent({ type: 'spell', tone: 'red', intensity: 0.84 });
      bossSpecialTimer.current = window.setTimeout(() => {
        bossSpecialTimer.current = null;
        bossSpecialCueRef.current = null;
        setBossSpecialCue(null);
        setIsResolvingAction(false);
        setBattleCue(null);
        flushQueuedTurnBanner();
      }, BOSS_SPECIAL_PRESENTATION_MS);
    }
  }, [flushQueuedTurnBanner]);

  const queueOrShowTurnBanner = useCallback((banner: BattleTurnBannerData) => {
    if (activeSpellNoticeRef.current || bossLastStandCueRef.current || bossSpecialCueRef.current) {
      queuedTurnBanner.current = banner;
      return;
    }

    showTurnBanner(banner);
  }, [showTurnBanner]);

  useEffect(() => {
    bossLastStandCueRef.current = bossLastStandCue;
  }, [bossLastStandCue]);

  useEffect(() => {
    bossSpecialCueRef.current = bossSpecialCue;
  }, [bossSpecialCue]);

  useEffect(() => {
    activeSpellNoticeRef.current = spellCastNotice;

    if (!spellCastNotice && queuedTurnBanner.current && !bossLastStandCueRef.current && !bossSpecialCueRef.current) {
      const banner = queuedTurnBanner.current;
      queuedTurnBanner.current = null;
      showTurnBanner(banner);
    }
  }, [showTurnBanner, spellCastNotice]);

  useEffect(() => {
    let scheduleTimer: number | null = null;

    if (!battle || battle.status !== 'active') {
      lastTurnBannerSide.current = null;
      queuedTurnBanner.current = null;
      activeSpellNoticeRef.current = null;
      scheduleTimer = window.setTimeout(() => setTurnBanner(null), 0);
      return () => {
        if (scheduleTimer) window.clearTimeout(scheduleTimer);
      };
    }

    const active = getActiveUnit(battle);
    if (!active || lastTurnBannerSide.current === active.side) {
      return () => {
        if (scheduleTimer) window.clearTimeout(scheduleTimer);
      };
    }

    lastTurnBannerSide.current = active.side;
    const id = `${battle.id}-${battle.round}-${battle.activeUnitId}-${active.side}`;
    const banner = {
      id,
      side: active.side,
      title: active.side === 'enemy' ? 'Enemy Turn' : 'Your Turn',
      detail: active.side === 'enemy' ? `${active.name} advances.` : `${active.name} is ready.`,
    };
    scheduleTimer = window.setTimeout(() => {
      if (spellCastNotice || activeSpellNoticeRef.current || bossLastStandCueRef.current || bossSpecialCueRef.current) {
        queuedTurnBanner.current = banner;
        return;
      }
      queueOrShowTurnBanner(banner);
    }, 0);

    return () => {
      if (scheduleTimer) window.clearTimeout(scheduleTimer);
    };
  }, [battle, queueOrShowTurnBanner, spellCastNotice]);

  useEffect(() => {
    if (!battle) return;

    if (lastSoundLogEntryId.current === null) {
      battle.log.forEach(entry => processedBattleLogIds.current.add(entry.id));
      lastSoundLogEntryId.current = battle.log[0]?.id ?? null;
      return;
    }

    const freshEntries = battle.log.filter(entry => !processedBattleLogIds.current.has(entry.id));
    freshEntries.forEach(entry => processedBattleLogIds.current.add(entry.id));

    const bossStandEntry = freshEntries.find(item => item.style === 'boss-phase');
    if (bossStandEntry) {
      queuedBossSpecialCue.current = null;
      const commander = battle.units.find(unit => unit.id === bossStandEntry.actorId);
      if (commander) {
        if (bossLastStandTimer.current) window.clearTimeout(bossLastStandTimer.current);
        if (playerActionTimer.current) window.clearTimeout(playerActionTimer.current);
        if (enemyActionHoldTimer.current) window.clearTimeout(enemyActionHoldTimer.current);
        if (enemyTimer.current) window.clearTimeout(enemyTimer.current);

        const resurrectedUnits = (bossStandEntry.resurrectedUnitIds || [])
          .map(id => battle.units.find(unit => unit.id === id))
          .filter((unit): unit is BattleUnit => Boolean(unit))
          .map(unit => ({ id: unit.id, assetPath: unit.assetPath, x: unit.x, y: unit.y }));

        const cue = {
          id: bossStandEntry.id,
          commanderName: commander.name,
          assetPath: commander.assetPath,
          subtitle: battle.enemy.subtitle,
          resurrectedUnits,
        };
        bossLastStandCueRef.current = cue;
        setBossLastStandCue(cue);
        setIsResolvingAction(true);
        setTurnBanner(null);
        playGameSound('combat.spellHoly', { volumeScale: 0.88, throttleMs: 1200 });
        emitFxEvent({ type: 'spell', tone: 'gold', intensity: 0.92 });
        bossLastStandTimer.current = window.setTimeout(() => {
          bossLastStandTimer.current = null;
          bossLastStandCueRef.current = null;
          setBossLastStandCue(null);
          setIsResolvingAction(false);
          setBattleCue(null);
          flushQueuedBossSpecialCue();
          flushQueuedTurnBanner();
        }, BOSS_LAST_STAND_PRESENTATION_MS);
      }
    }

    const bossSpecialEntry = freshEntries.find(item => item.style === 'boss-special');
    if (bossSpecialEntry) {
      const commander = battle.units.find(unit => unit.id === bossSpecialEntry.actorId);
      if (commander) {
        const spell = getBattleSpellFromLogEntry(bossSpecialEntry);
        const summonedUnits = (bossSpecialEntry.summonedUnitIds || [])
          .map(id => battle.units.find(unit => unit.id === id))
          .filter((unit): unit is BattleUnit => Boolean(unit))
          .map(unit => ({ id: unit.id, assetPath: unit.assetPath, x: unit.x, y: unit.y }));

        const cue = {
          id: bossSpecialEntry.id,
          commanderName: commander.name,
          assetPath: commander.assetPath,
          subtitle: battle.enemy.subtitle,
          spellName: spell?.name || 'Boss Rite',
          summonedUnits,
        };

        const startBossSpecialCue = () => {
          if (bossSpecialTimer.current) window.clearTimeout(bossSpecialTimer.current);
          if (playerActionTimer.current) window.clearTimeout(playerActionTimer.current);
          if (enemyActionHoldTimer.current) window.clearTimeout(enemyActionHoldTimer.current);
          if (enemyTimer.current) window.clearTimeout(enemyTimer.current);
          if (spellNoticeTimer.current) window.clearTimeout(spellNoticeTimer.current);
          setSpellCastNotice(null);
          activeSpellNoticeRef.current = null;
          bossSpecialCueRef.current = cue;
          setBossSpecialCue(cue);
          setIsResolvingAction(true);
          setTurnBanner(null);
          playGameSound('combat.spellCast', { volumeScale: 0.82, throttleMs: 900 });
          emitFxEvent({ type: 'spell', tone: 'red', intensity: 0.84 });
          bossSpecialTimer.current = window.setTimeout(() => {
            bossSpecialTimer.current = null;
            bossSpecialCueRef.current = null;
            setBossSpecialCue(null);
            setIsResolvingAction(false);
            setBattleCue(null);
            flushQueuedTurnBanner();
          }, BOSS_SPECIAL_PRESENTATION_MS);
        };

        if (bossStandEntry || bossLastStandCueRef.current) {
          queuedBossSpecialCue.current = cue;
        } else {
          startBossSpecialCue();
        }
      }
    }

    const entry = pickFreshPresentationLogEntry(freshEntries);
    if (!entry || lastSoundLogEntryId.current === entry.id) return;
    lastSoundLogEntryId.current = entry.id;

    battleSoundTimers.current.forEach(timer => window.clearTimeout(timer));
    battleSoundTimers.current = getBattleLogSoundPlan(battle, entry, battleSpeed).map(sound => (
      window.setTimeout(() => {
        playGameSound(sound.id, { volumeScale: sound.volumeScale, throttleMs: sound.throttleMs });
      }, sound.delayMs)
    ));

    if (entry.action === 'spell' && entry.style !== 'boss-phase' && entry.style !== 'boss-special') {
      const spell = getBattleSpellFromLogEntry(entry);
      if (spell) {
        if (spellNoticeTimer.current) window.clearTimeout(spellNoticeTimer.current);
        const notice = { id: entry.id, spell, side: entry.side };
        activeSpellNoticeRef.current = notice;
        spellNoticeTimer.current = window.setTimeout(() => {
          setSpellCastNotice(notice);
          const noticeDuration = entry.side === 'enemy' ? ENEMY_BATTLE_PACE.spellNoticeMs : SPELL_NOTICE_MS;
          spellNoticeTimer.current = window.setTimeout(() => setSpellCastNotice(null), noticeDuration);
        }, entry.side === 'enemy' ? 180 : 0);
      }
    }
  }, [battle, battleSpeed, flushQueuedBossSpecialCue, flushQueuedTurnBanner]);

  useEffect(() => {
    const entry = battle ? getRecentPresentationLogEntry(battle, Date.now()) : undefined;
    if (!entry) return;

    const expiresAt = entry.createdAt + getBattleLogPresentationMs(entry, battle ?? undefined);
    const pinTimer = window.setTimeout(() => {
      setPresentationPin({ entry, expiresAt });
    }, 0);

    const remaining = Math.max(0, expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setPresentationPin(current => (current?.entry.id === entry.id ? null : current));
    }, remaining);

    return () => {
      window.clearTimeout(pinTimer);
      window.clearTimeout(timer);
    };
  }, [battle?.log]);

  useEffect(() => {
    if (!battle || battle.status !== 'active') return;
    if (isResolvingAction || bossLastStandCue || bossSpecialCue) return;
    if (battle.recruitOffer && !battle.recruitOffer.declined && !battle.recruitOffer.accepted) return;

    const activeUnit = getActiveUnit(battle);
    if (!activeUnit || activeUnit.side !== 'enemy') return;

    const isEnemyCommander = activeUnit.kind === 'commander';
    const enemyDelayMs = ENEMY_BATTLE_PACE.delayBeforeMs + (isEnemyCommander ? ENEMY_BATTLE_PACE.commanderDelayBonusMs : 0);
    const enemyHoldMs = ENEMY_BATTLE_PACE.actionHoldMs + (isEnemyCommander ? ENEMY_BATTLE_PACE.commanderHoldBonusMs : 0);

    enemyTimer.current = window.setTimeout(() => {
      emitFxEvent({ type: activeUnit.healing > 0 ? 'status' : 'attack', tone: 'red', intensity: 0.55 });
      setIsResolvingAction(true);
      setBattleCue({
        headline: isEnemyCommander ? 'Enemy Spell' : 'Enemy Action',
        detail: '',
        tone: 'enemy',
      });
      setBattle(current => {
        if (!current) return current;

        const next = runEnemyBattleTurn(current);
        const presentationEntry = getRecentPresentationLogEntry(next, Date.now());
        const isCinematicOverlay = presentationEntry?.style === 'boss-phase' || presentationEntry?.style === 'boss-special';
        const holdMs = presentationEntry
          ? getBattleLogPresentationMs(presentationEntry, next)
          : enemyHoldMs;

        if (!isCinematicOverlay) {
          if (enemyActionHoldTimer.current) window.clearTimeout(enemyActionHoldTimer.current);
          enemyActionHoldTimer.current = window.setTimeout(() => {
            enemyActionHoldTimer.current = null;
            setIsResolvingAction(false);
            setBattleCue(null);
          }, holdMs);
        }

        return next;
      });
    }, enemyDelayMs);

    return () => {
      if (enemyTimer.current) window.clearTimeout(enemyTimer.current);
    };
  }, [battle, isResolvingAction, bossLastStandCue, bossSpecialCue]);

  useEffect(() => {
    if (!battle || battle.status !== 'active') return;
    if (battle.recruitOffer && !battle.recruitOffer.declined && !battle.recruitOffer.accepted) return;

    const activeUnit = getActiveUnit(battle);
    if (!activeUnit || activeUnit.side !== 'player') return;
    const remaining = getTurnTimeRemaining(battle, Date.now());

    const timeout = window.setTimeout(() => {
      setPendingMoveUndo(null);
      setBattle(current => {
        const currentActiveUnit = current ? getActiveUnit(current) : undefined;
        if (!current || !currentActiveUnit || currentActiveUnit.side !== 'player') return current;
        setSelectedSpellId(null);
        setIsSpellMenuOpen(false);
        if (isBonusMovePending(current, currentActiveUnit)) {
          return skipBonusBattleMove(current, currentActiveUnit.id);
        }
        return waitBattleUnit(current, currentActiveUnit.id, `${currentActiveUnit.name}'s turn timed out.`);
      });
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [battle]);

  useEffect(() => {
    if (!battle || rewardClaimed.current) return;

    if (battle.status === 'victory') {
      if (!resultSoundEmitted.current) {
        playGameSound('combat.victory', { throttleMs: 800 });
        resultSoundEmitted.current = true;
      }
      const casualtyReport = persistentResults ? applyBattleCasualties(battle) : undefined;
      if (persistentResults) {
        markWorldEnemyDefeated(battle.enemy);
      }
      const reward = persistentResults
        ? applyVictoryReward(battle.enemy) || getVictoryReward(battle.enemy)
        : getVictoryReward(battle.enemy);
      window.setTimeout(() => {
        setResultReport({
          status: 'victory',
          reward,
          casualtyReport,
          completedAt: Date.now(),
        });
      }, 0);
      if (!battleEndNotified.current) {
        battleEndNotified.current = true;
        if (onBattleEnd) {
          const notifyDelayMs = getBattleVictoryHandoffDelayMs(battle);
          battleEndNotifyTimer.current = window.setTimeout(() => {
            battleEndNotifyTimer.current = null;
            onBattleEnd({ status: 'victory', battle, reward });
          }, notifyDelayMs);
        }
      }
      rewardClaimed.current = true;
    } else if (battle.status === 'defeat') {
      if (!resultSoundEmitted.current) {
        playGameSound('combat.defeat', { throttleMs: 800 });
        resultSoundEmitted.current = true;
      }
      const casualtyReport = persistentResults ? applyBattleCasualties(battle) : undefined;
      const healthLost = persistentResults ? applyDefeatPenalty(battle.enemy) : 0;
      const retreated = battle.log.some(entry => entry.id.startsWith('log-retreat-') || entry.message.toLowerCase().includes('retreat'));
      const defeatReport: BattleResultReportData = {
        status: 'defeat',
        healthLost,
        casualtyReport,
        completedAt: Date.now(),
      };
      window.setTimeout(() => {
        setResultReport(defeatReport);
      }, 0);
      if (!battleEndNotified.current) {
        onBattleEnd?.({ status: 'defeat', battle, healthLost, retreated });
        battleEndNotified.current = true;
      }
      if (!onBattleEnd) {
        defeatExitTimer.current = window.setTimeout(() => {
          defeatExitTimer.current = null;
          if (!completionNoticeEmitted.current) {
            emitBattleCompletionNotice(battle, defeatReport);
            completionNoticeEmitted.current = true;
          }
          if (!closeRequested.current) {
            closeRequested.current = true;
            onClose();
          }
        }, 900);
      }
      rewardClaimed.current = true;
    }
  }, [battle, onBattleEnd, onClose, persistentResults]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

      if (event.key === 'Escape') {
        setSelectedSpellId(null);
        setIsSpellMenuOpen(false);
        return;
      }

      if (!battle || battle.status !== 'active' || isResolvingAction) return;
      const keyboardActiveUnit = getActiveUnit(battle);
      if (!keyboardActiveUnit || keyboardActiveUnit.side !== 'player') return;
      const keyboardTutorialSpell = availableSpells.find(spell => spell.id === 'ember-dart')
        || availableSpells.find(spell => spell.target === 'enemy')
        || availableSpells[0];
      const keyboardMustCastTutorialSpell = Boolean(
        isCombatTutorialStep &&
        combatTutorialIntroDismissed &&
        keyboardActiveUnit.kind === 'commander' &&
        keyboardTutorialSpell &&
        !combatTutorialCommanderSpellCast
      );
      const keyboardNeedsMana = Boolean(
        keyboardMustCastTutorialSpell &&
        keyboardTutorialSpell &&
        getBattleMana(battle, 'player') < keyboardTutorialSpell.cost
      );
      const blockCommanderTutorialShortcut = (action: 'focus' | 'wait') => {
        if (!keyboardMustCastTutorialSpell) return false;
        if (action === 'focus' && keyboardNeedsMana) return false;
        setSelectedSpellId(null);
        setIsSpellMenuOpen(true);
        setCombatTutorialNudge(`Cast ${keyboardTutorialSpell?.name || 'a commander spell'} before ending the commander lesson.`);
        playGameSound('ui.clickSoft', { throttleMs: 120 });
        emitFxEvent({ type: 'status', tone: 'red', intensity: 0.42 });
        return true;
      };

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (blockCommanderTutorialShortcut('wait')) return;
        setSelectedSpellId(null);
        setIsSpellMenuOpen(false);
        setPendingMoveUndo(null);
        if (isBonusMovePending(battle, keyboardActiveUnit)) {
          setBattle(skipBonusBattleMove(battle, keyboardActiveUnit.id));
          return;
        }
        const supportAbility = getMinionSupportAbility(keyboardActiveUnit);
        setBattle(supportAbility
          ? applyMinionSupportAbility(battle, keyboardActiveUnit.id)
          : waitBattleUnit(battle, keyboardActiveUnit.id));
      }

      if (event.key.toLowerCase() === 'f' && keyboardActiveUnit.kind === 'commander') {
        event.preventDefault();
        if (blockCommanderTutorialShortcut('focus')) return;
        setSelectedSpellId(null);
        setIsSpellMenuOpen(false);
        setPendingMoveUndo(null);
        setBattle(focusCommanderMana(battle, keyboardActiveUnit.id));
      }

      if (event.key.toLowerCase() === 's' && keyboardActiveUnit.kind === 'commander') {
        event.preventDefault();
        playGameSound('ui.modalOpen', { throttleMs: 140 });
        setSelectedSpellId(null);
        setIsSpellMenuOpen(open => !open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [availableSpells, battle, combatTutorialCommanderSpellCast, combatTutorialIntroDismissed, isCombatTutorialStep, isResolvingAction]);

  const recruitOfferPending = Boolean(battle?.recruitOffer && !battle.recruitOffer.declined && !battle.recruitOffer.accepted);
  const activeUnit = battle ? getActiveUnit(battle) : undefined;
  const isPlayerTurn = !recruitOfferPending && activeUnit?.side === 'player' && battle?.status === 'active';
  const playerActionTargetIds = useMemo(() => {
    const healIds = new Set<string>();
    const strikeIds = new Set<string>();

    if (!battle || !activeUnit || !isPlayerTurn) {
      return { healIds, strikeIds };
    }

    battle.units.forEach(unit => {
      if (canHeal(activeUnit, unit)) healIds.add(unit.id);
      if (canAttack(activeUnit, unit)) strikeIds.add(unit.id);
    });

    return { healIds, strikeIds };
  }, [battle, activeUnit, isPlayerTurn]);
  const isCommanderTurn = isPlayerTurn && activeUnit?.kind === 'commander';
  const selectedSpell = isCommanderTurn ? availableSpells.find(spell => spell.id === selectedSpellId) : undefined;
  const canUndoMove = Boolean(
    confirmMoveEnabled &&
    pendingMoveUndo &&
    battle?.status === 'active' &&
    pendingMoveUndo.activeUnitId === battle.activeUnitId &&
    activeUnit?.side === 'player'
  );

  if (!battle) return null;

  const presentationEntry = getPresentationEntry(battle, presentationPin, now);
  const unitMoveTransit = getUnitMoveTransit(battle, presentationEntry, now);
  const isMoveAnimating = Boolean(unitMoveTransit);
  const tutorialSpell = availableSpells.find(spell => spell.id === 'ember-dart')
    || availableSpells.find(spell => spell.target === 'enemy')
    || availableSpells[0];
  const combatTutorialActive = Boolean(isCombatTutorialStep && combatTutorialIntroDismissed && battle.status === 'active');
  const combatTutorialStage = getCombatTutorialStage({
    active: combatTutorialActive,
    activeUnit,
    isPlayerTurn,
    isResolvingAction,
    selectedSpell,
    isSpellMenuOpen,
    battleMana: getBattleMana(battle, 'player'),
    tutorialSpell,
    unitWaitSeen: combatTutorialUnitWaitSeen,
    healerBlessingSeen: combatTutorialHealerBlessingSeen,
    commanderSpellCast: combatTutorialCommanderSpellCast,
  });
  const mustCastCommanderTutorialSpell = Boolean(
    combatTutorialActive &&
    isCommanderTurn &&
    tutorialSpell &&
    !combatTutorialCommanderSpellCast
  );
  const commanderTutorialNeedsMana = Boolean(
    mustCastCommanderTutorialSpell &&
    tutorialSpell &&
    getBattleMana(battle, 'player') < tutorialSpell.cost
  );
  const combatTutorialOrbFocus = combatTutorialStage?.orbFocus;

  const showCombatTutorialNudge = (message: string) => {
    setCombatTutorialNudge(message);
    playGameSound('ui.clickSoft', { throttleMs: 120 });
    emitFxEvent({ type: 'status', tone: 'red', intensity: 0.42 });
  };

  const shouldBlockCommanderTutorialNonSpell = (action: 'focus' | 'wait' | 'move' | 'strike' | 'heal') => {
    if (!mustCastCommanderTutorialSpell) return false;
    if (action === 'focus' && commanderTutorialNeedsMana) return false;

    const spellName = tutorialSpell?.name || 'a commander spell';
    setSelectedSpellId(null);
    setIsSpellMenuOpen(true);
    showCombatTutorialNudge(`Cast ${spellName} before ending the commander lesson.`);
    return true;
  };

  const completeCombatCommanderSpellTutorial = () => {
    if (!isCombatTutorialStep || combatTutorialCompletedRef.current) return;
    combatTutorialCompletedRef.current = true;
    setCombatTutorialCommanderSpellCast(true);
    combatTutorialCompleteTimerRef.current = window.setTimeout(() => {
      combatTutorialCompleteTimerRef.current = null;
      onTutorialContinue?.('combat');
    }, 900);
  };

  const queuePlayerAction = (nextBattle: BattleState, cue: BattleCue) => {
    if (playerActionTimer.current) window.clearTimeout(playerActionTimer.current);
    setPendingMoveUndo(null);
    setIsResolvingAction(true);
    setBattleCue(cue);
    setIsSpellMenuOpen(false);
    emitFxEvent({
      type: getBattleCueFxType(cue),
      tone: cue.tone === 'danger' ? 'red' : cue.tone === 'player' ? 'blue' : cue.tone === 'victory' ? 'gold' : 'bone',
      intensity: cue.tone === 'danger' ? 0.76 : 0.62,
    });

    const preferredPresentationEntry = getRecentPresentationLogEntry(nextBattle);
    const preferredPresentationEntryId = preferredPresentationEntry?.id;
    const isSpellAction = preferredPresentationEntry?.action === 'spell';
    const applyDelayMs = speedConfig.playerDelayMs;

    const finishPlayerAction = (appliedBattle: BattleState) => {
      const stampedBattle = refreshPresentationLogTimestamp(appliedBattle, preferredPresentationEntryId);
      const entry = preferredPresentationEntryId
        ? stampedBattle.log.find(item => item.id === preferredPresentationEntryId)
        : getRecentPresentationLogEntry(stampedBattle, Date.now());
      const holdMs = entry ? getRemainingPresentationMs(entry, stampedBattle) : 0;
      if (entry) {
        setPresentationPin({ entry, expiresAt: entry.createdAt + getBattleLogPresentationMs(entry, stampedBattle) });

        if (entry.action === 'spell') {
          const spell = getBattleSpellFromLogEntry(entry);
          if (spell) {
            if (spellNoticeTimer.current) window.clearTimeout(spellNoticeTimer.current);
            const notice = { id: entry.id, spell, side: entry.side };
            activeSpellNoticeRef.current = notice;
            setSpellCastNotice(notice);
            spellNoticeTimer.current = window.setTimeout(() => {
              spellNoticeTimer.current = null;
              activeSpellNoticeRef.current = null;
              setSpellCastNotice(current => current?.id === notice.id ? null : current);
              flushQueuedTurnBanner();
            }, entry.side === 'enemy' ? ENEMY_BATTLE_PACE.spellNoticeMs : SPELL_NOTICE_MS);
          }
        }
      }
      setBattle(stampedBattle);

      if (getPendingCinematicEntry(stampedBattle)) {
        return;
      }

      if (holdMs <= 0) {
        setIsResolvingAction(false);
        setBattleCue(null);
        return;
      }
      playerActionTimer.current = window.setTimeout(() => {
        setIsResolvingAction(false);
        setBattleCue(null);
      }, holdMs);
    };

    if (isSpellAction) {
      const spellApplyDelayMs = 0;
      playerActionTimer.current = window.setTimeout(() => {
        finishPlayerAction(nextBattle);
      }, spellApplyDelayMs);
      return;
    }

    if (applyDelayMs <= 0) {
      finishPlayerAction(nextBattle);
      return;
    }

    playerActionTimer.current = window.setTimeout(() => {
      finishPlayerAction(nextBattle);
    }, applyDelayMs);
  };

  const handleCellClick = (x: number, y: number) => {
    if (!battle || !activeUnit || !isPlayerTurn || isResolvingAction || bossLastStandCue || bossSpecialCue) return;

    const unitAtCell = getUnitAt(battle, x, y);
    const bonusMoveActive = isBonusMovePending(battle, activeUnit);
    if (bonusMoveActive) {
      if (!unitAtCell && canBonusMoveTo(battle, activeUnit, x, y)) {
        queuePlayerAction(moveBonusBattleUnit(battle, activeUnit.id, x, y), {
          headline: 'Step Away',
          detail: '',
          tone: 'player',
        });
      }
      return;
    }

    if (selectedSpell) {
      if (selectedSpell.target === 'none') return;
      if (!unitAtCell) return;

      const validTarget =
        (selectedSpell.target === 'enemy' && unitAtCell.side !== activeUnit.side) ||
        (selectedSpell.target === 'ally' && unitAtCell.side === activeUnit.side);

      if (validTarget) {
        setSelectedSpellId(null);
        const nextBattle = castBattleSpell(battle, selectedSpell.id, unitAtCell.id);
        if (mustCastCommanderTutorialSpell && selectedSpell.id === tutorialSpell?.id) {
          completeCombatCommanderSpellTutorial();
        }
        queuePlayerAction(nextBattle, {
          headline: selectedSpell.name,
          detail: '',
          tone: selectedSpell.target === 'ally' ? 'player' : 'danger',
        });
      }

      return;
    }

    if (isCommanderTurn && unitAtCell?.id === activeUnit.id) {
      emitFxEvent({ type: 'spell', tone: 'violet', intensity: 0.5 });
      playGameSound('ui.modalOpen', { throttleMs: 140 });
      setIsSpellMenuOpen(open => !open);
      return;
    }

    if (mustCastCommanderTutorialSpell) {
      if (shouldBlockCommanderTutorialNonSpell(unitAtCell ? 'strike' : 'move')) return;
    }

    if (unitAtCell && canHeal(activeUnit, unitAtCell)) {
      queuePlayerAction(advanceBattleTurn(healBattleUnit(battle, activeUnit.id, unitAtCell.id)), {
        headline: 'Healing',
        detail: '',
        tone: 'player',
      });
      return;
    }

    if (unitAtCell && canAttack(activeUnit, unitAtCell)) {
      const attackedBattle = attackBattleUnit(battle, activeUnit.id, unitAtCell.id);
      const attackerAfterAttack = attackedBattle.units.find(unit => unit.id === activeUnit.id && unit.currentHealth > 0);
      queuePlayerAction(
        attackerAfterAttack && isBonusMovePending(attackedBattle, attackerAfterAttack)
          ? attackedBattle
          : advanceBattleTurn(attackedBattle),
        {
        headline: 'Strike',
        detail: '',
        tone: 'danger',
        }
      );
      return;
    }

    if (!unitAtCell && !canUndoMove && canMoveTo(battle, activeUnit, x, y)) {
      const movedBattle = moveBattleUnit(battle, activeUnit.id, x, y);
      if (!confirmMoveEnabled) {
        setBattle(movedBattle);
        queuePlayerAction(advanceBattleTurn(movedBattle), {
          headline: 'Move',
          detail: '',
          tone: 'player',
        });
        return;
      }

      setPendingMoveUndo(battle);
      setBattle(movedBattle);
      setBattleCue({
        headline: 'Move',
        detail: '',
        tone: 'player',
      });
      emitFxEvent({ type: 'status', tone: 'blue', intensity: 0.45 });
    }
  };

  const handleUndoMove = () => {
    if (!pendingMoveUndo || isResolvingAction) return;
    setSelectedSpellId(null);
    setIsSpellMenuOpen(false);
    setBattle(pendingMoveUndo);
    setPendingMoveUndo(null);
    setBattleCue({
      headline: 'Move Undone',
      detail: '',
      tone: 'neutral',
    });
    emitFxEvent({ type: 'status', tone: 'bone', intensity: 0.36 });
  };

  const handleCommitMove = () => {
    if (!battle || !activeUnit || !isPlayerTurn || !canUndoMove || isResolvingAction) return;
    if (shouldBlockCommanderTutorialNonSpell('wait')) return;
    setSelectedSpellId(null);
    queuePlayerAction(waitBattleUnit(battle, activeUnit.id, `${activeUnit.name} holds position.`), {
      headline: 'Hold',
      detail: '',
      tone: 'neutral',
    });
  };

  const handleEndTurn = () => {
    if (!battle || !isPlayerTurn || isResolvingAction) return;
    if (shouldBlockCommanderTutorialNonSpell('wait')) return;
    setSelectedSpellId(null);
    if (activeUnit && isBonusMovePending(battle, activeUnit)) {
      queuePlayerAction(skipBonusBattleMove(battle, activeUnit.id), {
        headline: 'Hold',
        detail: '',
        tone: 'neutral',
      });
      return;
    }
    const supportAbility = getMinionSupportAbility(activeUnit);
    const priestCharge = Boolean(activeUnit && activeUnit.kind === 'minion' && activeUnit.healing > 0);
    queuePlayerAction(supportAbility && activeUnit
      ? applyMinionSupportAbility(battle, activeUnit.id)
      : waitBattleUnit(battle, activeUnit?.id || ''), {
      headline: supportAbility ? supportAbility.name : priestCharge ? 'Blessing Charged' : 'Hold',
      detail: '',
      tone: supportAbility || priestCharge ? 'player' : 'neutral',
    });
  };

  const handleFocusMana = () => {
    if (!battle || !isCommanderTurn || !activeUnit || isResolvingAction) return;
    if (shouldBlockCommanderTutorialNonSpell('focus')) return;
    setSelectedSpellId(null);
    queuePlayerAction(focusCommanderMana(battle, activeUnit.id), {
      headline: 'Focus Mana',
      detail: '',
      tone: 'player',
    });
  };

  const handleSpellClick = (spell: BattleSpell) => {
    if (!battle || !isCommanderTurn || isResolvingAction) return;

    if (mustCastCommanderTutorialSpell && tutorialSpell && spell.id !== tutorialSpell.id && !commanderTutorialNeedsMana) {
      showCombatTutorialNudge(`Use ${tutorialSpell.name} for this first spell lesson.`);
      return;
    }

    if (getBattleMana(battle, 'player') < spell.cost) {
      setSelectedSpellId(null);
      setIsSpellMenuOpen(true);
      playGameSound('ui.clickSoft', { throttleMs: 120 });
      emitFxEvent({ type: 'status', tone: 'red', intensity: 0.4 });
      return;
    }

    if (spell.target === 'none') {
      setSelectedSpellId(null);
      setIsSpellMenuOpen(false);
      const nextBattle = castBattleSpell(battle, spell.id);
      if (mustCastCommanderTutorialSpell && spell.id === tutorialSpell?.id) {
        completeCombatCommanderSpellTutorial();
      }
      queuePlayerAction(nextBattle, {
        headline: spell.name,
        detail: '',
        tone: 'player',
      });
      return;
    }

    setSelectedSpellId(selectedSpellId === spell.id ? null : spell.id);
    setIsSpellMenuOpen(false);
    emitFxEvent({ type: spell.target === 'ally' ? 'heal' : 'spell', tone: spell.target === 'ally' ? 'green' : 'violet', intensity: 0.48 });
  };

  const handleCancelSpell = () => {
    setSelectedSpellId(null);
    setIsSpellMenuOpen(false);
  };

  const handleAcceptRecruitOffer = () => {
    if (!battle?.recruitOffer) return;

    const result = recruitMinionsFromOffer(
      battle.recruitOffer.offeredMinions,
      battle.enemy.name,
      `Accepted ${battle.enemy.name}'s surrender`
    );
    if (!result.success) return;

    const recruitedMinions = battle.recruitOffer.offeredMinions
      .map(getMinionStackName)
      .filter(Boolean);

    if (persistentResults) markWorldEnemyDefeated(battle.enemy);

    setResultReport({
      status: 'recruited',
      recruitedMinions,
      completedAt: Date.now(),
    });
    if (!battleEndNotified.current) {
      onBattleEnd?.({ status: 'recruited', battle });
      battleEndNotified.current = true;
    }

    setBattle({
      ...battle,
      status: 'recruited',
      recruitOffer: {
        ...battle.recruitOffer,
        accepted: true,
      },
      log: [{
        id: `log-recruit-${Date.now()}`,
        round: battle.round,
        side: 'player' as const,
        actor: getCurrentUser()?.username || 'Commander',
        action: 'morale' as const,
        style: 'morale' as const,
        message: `${battle.enemy.name}'s followers join your army. No battle reward was taken.`,
        createdAt: Date.now(),
      }, ...battle.log].slice(0, 24),
    });
  };

  const handleForceFight = () => {
    if (!battle?.recruitOffer) return;

    setBattle({
      ...battle,
      recruitOffer: {
        ...battle.recruitOffer,
        declined: true,
      },
      log: [{
        id: `log-force-fight-${Date.now()}`,
        round: battle.round,
        side: 'player' as const,
        actor: getCurrentUser()?.username || 'Commander',
        action: 'morale' as const,
        style: 'morale' as const,
        message: 'You reject the surrender and force the fight.',
        createdAt: Date.now(),
      }, ...battle.log].slice(0, 24),
    });
  };

  const handleRetreat = () => {
    if (!battle || battle.status !== 'active') return;
    setPendingMoveUndo(null);
    setBattle({
      ...battle,
      status: 'defeat',
      log: [{
        id: `log-retreat-${Date.now()}`,
        round: battle.round,
        side: 'player' as const,
        actor: getCurrentUser()?.username || 'Commander',
        action: 'system' as const,
        message: 'Your forces retreat from the field.',
        createdAt: Date.now(),
      }, ...battle.log].slice(0, 24),
    });
  };

  const handleLeaveField = () => {
    if (battleEndNotifyTimer.current) {
      window.clearTimeout(battleEndNotifyTimer.current);
      battleEndNotifyTimer.current = null;
    }
    if (defeatExitTimer.current) {
      window.clearTimeout(defeatExitTimer.current);
      defeatExitTimer.current = null;
    }
    if (battle && battle.status !== 'active') {
      if (!completionNoticeEmitted.current) {
        emitBattleCompletionNotice(battle, resultReport);
        completionNoticeEmitted.current = true;
      }
    }
    if (!closeRequested.current) {
      closeRequested.current = true;
      onClose();
    }
  };

  const defaultCue = getDefaultBattleCue({
    battle,
    activeUnit,
    isPlayerTurn,
    isCommanderTurn,
    selectedSpell,
    recruitOfferPending,
  });
  const controlCue = battle.status === 'active' ? battleCue || defaultCue : defaultCue;
  const hoverPreview = getBattleHoverPreview({
    battle,
    activeUnit,
    hoveredCell,
    isPlayerTurn,
    selectedSpell,
    isResolvingAction,
    movementLocked: canUndoMove,
    movementAnimating: isMoveAnimating,
  });
  const hoverForecast = getBattleHoverForecast({
    battle,
    activeUnit,
    hoveredCell,
    isPlayerTurn,
    selectedSpell,
    isResolvingAction,
    movementLocked: canUndoMove,
    movementAnimating: isMoveAnimating,
  });
  const hasActionForecast = Boolean(
    hoverForecast &&
    (
      (typeof hoverForecast.amount === 'number' && hoverForecast.amount > 0) ||
      hoverForecast.projectedHealth !== hoverForecast.currentHealth
    )
  );
  const hoveredThreatUnit = hoveredCell ? getUnitAt(battle, hoveredCell.x, hoveredCell.y) : undefined;
  const hoveredEnemyUnit = hoveredThreatUnit?.side === 'enemy' && hoveredThreatUnit.currentHealth > 0 ? hoveredThreatUnit : undefined;

  return (
    <div className="battle-modal-layer fixed inset-0 z-[70] overflow-hidden bg-black/78 p-1 backdrop-blur-sm">
      {tutorialStep && onTutorialContinue && onTutorialSkip && (tutorialStep.id !== 'combat' || !combatTutorialIntroDismissed) && (
        <SingleplayerTutorialOverlay
          step={tutorialStep}
          onContinue={() => {
            if (tutorialStep.id === 'combat') {
              setCombatTutorialIntroDismissed(true);
              return;
            }
            onTutorialContinue(tutorialStep.id);
          }}
          onSkip={onTutorialSkip}
        />
      )}
      <div className={`battle-modal-frame command-panel vine-frame mx-auto flex h-[calc(100vh-0.5rem)] max-w-none flex-col overflow-hidden rounded border text-zinc-100 ${indicatorMode === 'colorblind' ? 'battle-indicator-colorblind' : ''}`}>
        <div className="battle-layout grid min-h-0 flex-1 grid-cols-1 gap-2 p-2">
          {recruitOfferPending ? (
            <section className="ui-card col-span-full m-auto w-full max-w-3xl rounded border p-6 text-center">
              <h3 className="fantasy-heading text-2xl">Surrender Offer</h3>
              <p className="ui-muted mx-auto mt-3 max-w-2xl text-sm font-bold">
                {battle.recruitOffer?.reason}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {battle.recruitOffer?.offeredMinions.map((minion) => {
                  const template = getMinionTemplate(minion.templateId);
                  if (!template) return null;

                  return (
                    <div key={minion.id} className="ui-pill rounded border p-3">
                      <span className="ui-icon-frame relative mx-auto block h-16 w-16 overflow-hidden rounded border">
                        <Image
                          src={`/assets/minions/${template.assetName}`}
                          alt={template.name}
                          fill
                          className="sprite-soft-glow scale-125 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </span>
                      <div className="mt-2 text-xs font-black text-zinc-100">{template.name}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <button onClick={handleAcceptRecruitOffer} className="ui-button-primary rounded px-5 py-3 text-sm font-bold">
                  Accept Service
                </button>
                <button onClick={handleForceFight} className="ui-button-danger rounded px-5 py-3 text-sm font-bold">
                  Force Fight
                </button>
              </div>
            </section>
          ) : (
            <>
          <main className="battle-main flex min-h-0 flex-col gap-2">
            {battle.status !== 'active' && battle.status !== 'defeat' && !onBattleEnd && (
              <BattleResultReport battle={battle} report={resultReport} onClose={handleLeaveField} />
            )}

            <div className="battle-combat-grid min-h-0 flex-1">
              <aside className="battle-retreat-rail" aria-label="Battle retreat">
                {battle.status === 'active' ? (
                  <div className="battle-retreat-panel rounded border">
                    <div className="battle-retreat-panel-head">
                      <h3 className="battle-retreat-panel-title fantasy-heading">Retreat</h3>
                      <p className="battle-retreat-panel-copy">Quit this fight and return</p>
                    </div>
                    <button type="button" onClick={handleRetreat} className="battle-retreat-btn">
                      Retreat
                    </button>
                  </div>
                ) : (
                  <div className="battle-retreat-panel rounded border">
                    <div className="battle-retreat-panel-head">
                      <h3 className="battle-retreat-panel-title fantasy-heading">Leave Field</h3>
                      <p className="battle-retreat-panel-copy">Return from the aftermath</p>
                    </div>
                    <button type="button" onClick={handleLeaveField} className="battle-leave-field-btn">
                      Leave Field
                    </button>
                  </div>
                )}
              </aside>

              <div className="battle-board-shell relative min-h-0">
              {turnBanner && !spellCastNotice && <BattleTurnBanner key={turnBanner.id} banner={turnBanner} />}
              {spellCastNotice && <BattleSpellCastNotice key={spellCastNotice.id} notice={spellCastNotice} />}
              {selectedSpell && isPlayerTurn && (
                <button
                  type="button"
                  onClick={handleCancelSpell}
                  disabled={isResolvingAction}
                  className="battle-target-cancel"
                >
                  Cancel Spell
                </button>
              )}
              {battle.status !== 'active' && !bossLastStandCue && !bossSpecialCue && (
                <BattleOutcomeBanner cue={controlCue} />
              )}
              <BattleHoverOverlay
                preview={hoverPreview}
                forecast={hoverForecast}
                visible={Boolean(
                  hoveredCell &&
                  hoverCursor &&
                  !(isCommanderTurn && isSpellMenuOpen && !selectedSpell) &&
                  (!isPlayerTurn || hasActionForecast || hoverForecast)
                )}
                cursor={hoverCursor}
              />
              {combatTutorialStage && onTutorialSkip && (
                <BattleCombatTutorialCoach
                  stage={combatTutorialStage}
                  unit={activeUnit}
                  spell={tutorialSpell}
                  mana={getBattleMana(battle, 'player')}
                  nudge={combatTutorialNudge}
                  onAcknowledge={(acknowledge) => {
                    if (acknowledge === 'unit-wait') setCombatTutorialUnitWaitSeen(true);
                    if (acknowledge === 'healer-blessing') setCombatTutorialHealerBlessingSeen(true);
                  }}
                  onSkip={onTutorialSkip}
                />
              )}
              {isCommanderTurn && isSpellMenuOpen && !selectedSpell && (
                <div className={`battle-spell-popover ${combatTutorialStage?.id === 'commander-select-spell' ? 'battle-spell-popover-tutorial' : ''}`}>
                  <BattleSpellMenu
                    battle={battle}
                    spells={availableSpells}
                    selectedSpellId={selectedSpellId}
                    isResolvingAction={isResolvingAction}
                    tutorialSpellId={combatTutorialStage?.id === 'commander-select-spell' ? tutorialSpell?.id : undefined}
                    onSpellClick={handleSpellClick}
                    onClose={() => setIsSpellMenuOpen(false)}
                  />
                </div>
              )}
              <div
                className={`battlefield-board relative ml-auto grid w-full gap-0 overflow-hidden rounded border border-[rgba(232,217,184,0.34)] p-0 ${selectedSpell ? 'battlefield-board-targeting' : ''}`}
                style={{
                  '--battle-cols': battle.boardWidth,
                  '--battle-rows': battle.boardHeight,
                  '--battle-ratio': battle.boardWidth / battle.boardHeight,
                  '--battle-move-transit-ms': `${BATTLE_MOVE_TRANSIT_MS}ms`,
                  ...(bossLastStandCue ? {
                    '--boss-last-stand-ms': `${BOSS_LAST_STAND_PRESENTATION_MS}ms`,
                    '--boss-respawn-reveal-ms': `${BOSS_LAST_STAND_RESPAWN_REVEAL_MS}ms`,
                  } : {}),
                  ...(bossSpecialCue ? {
                    '--boss-special-ms': `${BOSS_SPECIAL_PRESENTATION_MS}ms`,
                    '--boss-special-summon-reveal-ms': `${BOSS_SPECIAL_SUMMON_REVEAL_MS}ms`,
                    '--boss-last-stand-ms': `${BOSS_SPECIAL_PRESENTATION_MS}ms`,
                    '--boss-respawn-reveal-ms': `${BOSS_SPECIAL_SUMMON_REVEAL_MS}ms`,
                  } : {}),
                  gridTemplateColumns: `repeat(${battle.boardWidth}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${battle.boardHeight}, minmax(0, 1fr))`,
                } as CSSProperties}
              >
              {Array.from({ length: battle.boardWidth * battle.boardHeight }, (_, index) => {
                const x = index % battle.boardWidth;
                const y = Math.floor(index / battle.boardWidth);
                const unit = getUnitAt(battle, x, y);
                const displayUnit = unit && unit.id === unitMoveTransit?.unit.id ? undefined : unit;
                const defeatedPresentation = displayUnit
                  ? undefined
                  : getDefeatedUnitPresentation(battle, x, y, presentationEntry, now);
                const dyingHitUnit = defeatedPresentation?.phase === 'hit' ? defeatedPresentation.unit : undefined;
                const dissolvingUnit = defeatedPresentation?.phase === 'dissolve' ? defeatedPresentation.unit : undefined;
                const pieceUnit = displayUnit ?? dyingHitUnit;
                const obstacle = isObstacle(battle, x, y);
                const terrain = getTerrainAt(battle, x, y);
                const terrainLabel = BATTLE_TERRAIN_LABELS[terrain];
                const cellPreview = getBattleHoverPreview({
                  battle,
                  activeUnit,
                  hoveredCell: { x, y },
                  isPlayerTurn,
                  selectedSpell,
                  isResolvingAction,
                  movementLocked: canUndoMove,
                  movementAnimating: isMoveAnimating,
                });
                const isActiveCell = unit?.id === battle.activeUnitId;
                const bonusMoveActive = Boolean(activeUnit && isBonusMovePending(battle, activeUnit));
                const canMove = Boolean(
                  isPlayerTurn &&
                  activeUnit &&
                  !canUndoMove &&
                  !isMoveAnimating &&
                  !unit &&
                  (bonusMoveActive ? canBonusMoveTo(battle, activeUnit, x, y) : canMoveTo(battle, activeUnit, x, y))
                );
                const canStrike = Boolean(!bonusMoveActive && isPlayerTurn && unit && playerActionTargetIds.strikeIds.has(unit.id));
                const canMend = Boolean(!bonusMoveActive && isPlayerTurn && unit && playerActionTargetIds.healIds.has(unit.id));
                const canSpellTarget = Boolean(
                  !bonusMoveActive &&
                  selectedSpell &&
                  unit &&
                  (
                    (selectedSpell.target === 'enemy' && unit.side !== activeUnit?.side) ||
                    (selectedSpell.target === 'ally' && unit.side === activeUnit?.side)
                  )
                );
                const canDamageSpellTarget = Boolean(canSpellTarget && selectedSpell?.target === 'enemy');
                const canSupportSpellTarget = Boolean(canSpellTarget && selectedSpell?.target === 'ally');
                const enemyMovePreview = Boolean(
                  hoveredEnemyUnit &&
                  !unit &&
                  !obstacle &&
                  canMoveTo(battle, hoveredEnemyUnit, x, y)
                );
                const enemyAttackPreview = Boolean(
                  hoveredEnemyUnit &&
                  !obstacle &&
                  getDistance(hoveredEnemyUnit, { x, y }) <= hoveredEnemyUnit.range &&
                  !(hoveredEnemyUnit.x === x && hoveredEnemyUnit.y === y)
                );
                const actionable = canMove || canStrike || canMend || canSpellTarget;
                const unitTargetGlow = canMend
                  ? 'heal'
                  : canStrike
                    ? 'strike'
                    : canSupportSpellTarget
                      ? 'spell-support'
                      : canDamageSpellTarget
                        ? 'spell-damage'
                        : undefined;
                const cellTargetClass = canMend
                  ? 'battle-cell-target-heal'
                  : canStrike
                    ? 'battle-cell-target-strike'
                    : canSupportSpellTarget
                      ? 'battle-cell-target-spell-support'
                      : canDamageSpellTarget
                        ? 'battle-cell-target-strike'
                        : '';
                const resurrectingUnit = bossLastStandCue?.resurrectedUnits.find(unit => unit.x === x && unit.y === y)
                  ?? bossSpecialCue?.summonedUnits.find(unit => unit.x === x && unit.y === y);
                const isRisingUnit = Boolean(pieceUnit && (
                  bossLastStandCue?.resurrectedUnits.some(unit => unit.id === pieceUnit.id)
                  || bossSpecialCue?.summonedUnits.some(unit => unit.id === pieceUnit.id)
                ));
                const floatingText = getFloatingBattleText(battle, pieceUnit || dissolvingUnit, presentationEntry, now);
                const spellImpact = getBattleSpellImpact(battle, pieceUnit || dissolvingUnit, presentationEntry, now);
                const stanceImpact = getBattleStanceIconImpact(pieceUnit || dissolvingUnit, presentationEntry, now, battle);

                return (
                  <div
                    key={`${x}-${y}`}
                    role="button"
                    tabIndex={0}
                    data-sound-click="off"
                    data-sound-hover="off"
                    onClick={() => handleCellClick(x, y)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      handleCellClick(x, y);
                    }}
                    onMouseEnter={(event) => {
                      setHoveredCell({ x, y });
                      setHoverCursor({ x: event.clientX, y: event.clientY });
                    }}
                    onMouseMove={(event) => {
                      setHoveredCell({ x, y });
                      setHoverCursor({ x: event.clientX, y: event.clientY });
                    }}
                    onMouseLeave={() => {
                      setHoveredCell(null);
                      setHoverCursor(null);
                    }}
                    aria-label={`${cellPreview.title}. ${cellPreview.detail}`}
                    aria-disabled={isResolvingAction || Boolean(bossLastStandCue) || Boolean(bossSpecialCue) || obstacle || (!canMove && !canStrike && !canMend && !canSpellTarget && !isActiveCell)}
                    className={`battle-cell ${getBattleTerrainClassName(terrain)} relative overflow-hidden text-left transition ${
                      obstacle
                        ? 'battle-cell-obstacle'
                        : canMove
                          ? 'battle-cell-move'
                          : ''
                    } ${enemyMovePreview ? 'battle-cell-enemy-move-preview' : ''} ${enemyAttackPreview ? 'battle-cell-enemy-attack-preview' : ''} ${cellTargetClass} ${isActiveCell ? (unit?.side === 'player' ? 'battle-cell-active battle-cell-active-player' : 'battle-cell-active battle-cell-active-enemy') : ''} ${isActiveCell && combatTutorialStage ? 'battle-cell-tutorial-focus' : ''} ${isPlayerTurn && activeUnit && !actionable && !unit && !obstacle ? 'battle-cell-muted' : ''}`}
                  >
                    {terrain !== 'ground' && !unit && !obstacle && (
                      <span className="battle-terrain-chip">{terrainLabel}</span>
                    )}
                    {obstacle && <span className="battle-obstacle-shape" />}
                    {resurrectingUnit && (
                      <BattleBossResurrectionPulse
                        unit={resurrectingUnit}
                        presentationMs={bossSpecialCue ? BOSS_SPECIAL_PRESENTATION_MS : BOSS_LAST_STAND_PRESENTATION_MS}
                        revealMs={bossSpecialCue ? BOSS_SPECIAL_SUMMON_REVEAL_MS : BOSS_LAST_STAND_RESPAWN_REVEAL_MS}
                        tone={bossSpecialCue ? 'raid' : 'holy'}
                      />
                    )}
                    {pieceUnit && (
                      <BattlePiece
                        unit={pieceUnit}
                        active={isActiveCell && !dyingHitUnit}
                        rising={isRisingUnit}
                        animation={
                          dyingHitUnit
                            ? getBattleDeathHitAnimation(presentationEntry)
                            : isRisingUnit
                              ? 'rise'
                              : getBattlePieceAnimation(battle, pieceUnit, presentationEntry, now)
                        }
                        targetGlow={unitTargetGlow}
                        tutorialFocus={isActiveCell && Boolean(combatTutorialStage)}
                      />
                    )}
                    {isActiveCell && isCommanderTurn && !selectedSpell && !canUndoMove && !isMoveAnimating && (
                      <BattleUnitActionOrbs
                        mode="commander"
                        isResolvingAction={isResolvingAction}
                        tutorialFocus={combatTutorialOrbFocus}
                        onFocusMana={handleFocusMana}
                        onToggleSpellMenu={() => {
                          playGameSound('ui.modalOpen', { throttleMs: 140 });
                          setIsSpellMenuOpen(open => !open);
                        }}
                        onWait={handleEndTurn}
                      />
                    )}
                    {isActiveCell && canUndoMove && !isMoveAnimating && (
                      <BattleUnitActionOrbs
                        mode="move"
                        isResolvingAction={isResolvingAction}
                        onUndoMove={handleUndoMove}
                        onCommitMove={handleCommitMove}
                      />
                    )}
                    {isActiveCell && isPlayerTurn && !isCommanderTurn && !selectedSpell && !canUndoMove && !isMoveAnimating && (
                      <BattleUnitActionOrbs
                        mode="wait"
                        isResolvingAction={isResolvingAction}
                        tutorialFocus={combatTutorialOrbFocus}
                        waitLabel={getMinionSupportAbility(activeUnit)?.shortLabel}
                        waitTitle={getMinionSupportAbility(activeUnit)?.description}
                        onWait={handleEndTurn}
                      />
                    )}
                    {dissolvingUnit && <BattleDeathMarker unit={dissolvingUnit} />}
                    {stanceImpact ? (
                      <BattleStanceIconImpact impact={stanceImpact} />
                    ) : spellImpact ? (
                      <BattleSpellIconImpact
                        impact={spellImpact}
                        delayMs={Math.max(0, (presentationEntry?.targetIds?.indexOf((pieceUnit || dissolvingUnit)?.id || '') ?? 0) * 90)}
                      />
                    ) : null}
                    {floatingText && <BattleFloatingText text={floatingText.text} tone={floatingText.tone} />}
                  </div>
                );
              })}
              {unitMoveTransit && (
                <BattleUnitTransit
                  key={`${unitMoveTransit.unit.id}-${unitMoveTransit.startedAt}`}
                  unit={unitMoveTransit.unit}
                  from={unitMoveTransit.from}
                  to={unitMoveTransit.to}
                  active={unitMoveTransit.unit.id === battle.activeUnitId}
                />
              )}
              <CombatThreeFxLayer battle={battle} />
              {bossLastStandCue && (
                <BattleBossLastStandOverlay cue={bossLastStandCue} />
              )}
              {bossSpecialCue && (
                <BattleBossSpecialOverlay cue={bossSpecialCue} />
              )}
              </div>
            </div>

              <aside className="battle-order-rail" aria-label="Turn order">
                <BattleTurnTimeline battle={battle} vertical rail />
              </aside>
            </div>
          </main>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getCombatTutorialStage({
  active,
  activeUnit,
  isPlayerTurn,
  isResolvingAction,
  selectedSpell,
  isSpellMenuOpen,
  battleMana,
  tutorialSpell,
  unitWaitSeen,
  healerBlessingSeen,
  commanderSpellCast,
}: {
  active: boolean;
  activeUnit?: BattleUnit;
  isPlayerTurn: boolean;
  isResolvingAction: boolean;
  selectedSpell?: BattleSpell;
  isSpellMenuOpen: boolean;
  battleMana: number;
  tutorialSpell?: BattleSpell;
  unitWaitSeen: boolean;
  healerBlessingSeen: boolean;
  commanderSpellCast: boolean;
}): CombatTutorialStage | null {
  if (!active || !activeUnit || !isPlayerTurn || isResolvingAction) return null;

  if (activeUnit.kind === 'commander' && !commanderSpellCast) {
    if (selectedSpell) {
      return {
        id: 'commander-pick-target',
        kicker: 'Commander Spell',
        title: 'Pick the target.',
        body: `${selectedSpell.name} is armed. Click a glowing enemy to cast it; the forecast shows the health change before you commit.`,
        hint: 'Other commander actions stay locked until this first spell lands.',
      };
    }

    if (isSpellMenuOpen) {
      return {
        id: 'commander-select-spell',
        kicker: 'Commander Spell',
        title: `Choose ${tutorialSpell?.name || 'the cheap spell'}.`,
        body: 'The first lesson uses a cheap damage spell so the full spell flow is clear: open, choose, then target.',
        hint: 'The highlighted card is the tutorial spell.',
      };
    }

    if (tutorialSpell && battleMana < tutorialSpell.cost) {
      return {
        id: 'commander-focus',
        kicker: 'Commander Mana',
        title: 'Focus mana when power is short.',
        body: `Focus adds mana and ends the commander turn. You need ${tutorialSpell.cost} mana for ${tutorialSpell.name}; use the M orb if you cannot cast yet.`,
        hint: 'Mana builds over commander turns, so saving a turn can unlock stronger spells later.',
        orbFocus: 'mana',
      };
    }

    return {
      id: 'commander-open-spells',
      kicker: 'Commander Spell',
      title: 'Open spells now.',
      body: `Use the S orb to open the spellbook. ${tutorialSpell?.name || 'A one-mana spell'} is available for this first cast.`,
      hint: 'For this tutorial, waiting, moving, and striking are locked until the spell is cast.',
      orbFocus: 'spell',
    };
  }

  if (activeUnit.kind === 'minion' && activeUnit.healing > 0 && !healerBlessingSeen) {
    return {
      id: 'healer-blessing',
      kicker: 'Priest Blessing',
      title: 'Healers can store a blessing.',
      body: 'Priest-line units use Wait to charge a blessing. The next heal from that unit becomes stronger and the blessing icon appears on the sprite.',
      hint: 'If no ally needs healing this turn, blessing now can save a wounded unit later.',
      orbFocus: 'wait',
      acknowledge: 'healer-blessing',
    };
  }

  if (activeUnit.kind === 'minion' && !unitWaitSeen) {
    return {
      id: 'unit-wait',
      kicker: 'Active Unit',
      title: 'The wait orb is a real action.',
      body: 'The glowing sprite is the unit currently taking a turn. The W orb passes or holds position when moving or attacking would be worse.',
      hint: 'Use Wait to preserve position, guard tempo, or set up class mechanics.',
      orbFocus: 'wait',
      acknowledge: 'unit-wait',
    };
  }

  return null;
}

function BattleCombatTutorialCoach({
  stage,
  unit,
  spell,
  mana,
  nudge,
  onAcknowledge,
  onSkip,
}: {
  stage: CombatTutorialStage;
  unit?: BattleUnit;
  spell?: BattleSpell;
  mana: number;
  nudge?: string | null;
  onAcknowledge: (acknowledge: NonNullable<CombatTutorialStage['acknowledge']>) => void;
  onSkip: () => void;
}) {
  return (
    <section className={`battle-combat-tutorial-coach battle-combat-tutorial-coach-${stage.id} command-panel vine-frame rounded border`}>
      <span className="battle-combat-tutorial-guide relative" aria-hidden="true">
        <Image
          src={SINGLEPLAYER_RUN_TUTORIAL_GUIDE_ASSET}
          alt=""
          fill
          sizes="140px"
          className="object-contain object-bottom"
          unoptimized
        />
      </span>
      <span className="battle-combat-tutorial-copy">
        <span className="arcane-label">{stage.kicker}</span>
        <span className="fantasy-heading battle-combat-tutorial-title">{stage.title}</span>
        <span className="battle-combat-tutorial-body">{stage.body}</span>
        <span className="battle-combat-tutorial-hint rounded border">{stage.hint}</span>
        {nudge && <span className="battle-combat-tutorial-nudge rounded border">{nudge}</span>}
        <span className="battle-combat-tutorial-meta">
          {unit ? `${unit.name}${unit.kind === 'commander' ? ` - mana ${mana}` : ''}` : null}
          {spell && stage.id.startsWith('commander') ? ` / ${spell.name} M${spell.cost}` : null}
        </span>
      </span>
      <span className="battle-combat-tutorial-actions">
        {stage.acknowledge && (
          <button
            type="button"
            onClick={() => onAcknowledge(stage.acknowledge!)}
            className="ui-button-primary rounded px-3 py-2 text-xs font-black"
          >
            Got It
          </button>
        )}
        <button type="button" onClick={onSkip} className="ui-button rounded px-3 py-2 text-xs font-black">
          Skip Tutorial
        </button>
      </span>
    </section>
  );
}

function BattleUnitActionOrbs({
  mode,
  isResolvingAction,
  tutorialFocus,
  onFocusMana,
  onToggleSpellMenu,
  onUndoMove,
  onCommitMove,
  onWait,
  waitLabel,
  waitTitle,
}: {
  mode: 'commander' | 'move' | 'wait';
  isResolvingAction: boolean;
  tutorialFocus?: BattleTutorialOrbFocus;
  onFocusMana?: () => void;
  onToggleSpellMenu?: () => void;
  onUndoMove?: () => void;
  onCommitMove?: () => void;
  onWait?: () => void;
  waitLabel?: string;
  waitTitle?: string;
}) {
  const stopCellAction = (event: MouseEvent<HTMLButtonElement>, action?: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action?.();
  };

  if (mode === 'move') {
    return (
      <div className="battle-unit-orbs battle-unit-orbs-move">
        <button
          type="button"
          disabled={isResolvingAction}
          onClick={(event) => stopCellAction(event, onUndoMove)}
          className="battle-unit-orb battle-unit-orb-undo"
          title="Undo move"
        >
          U
        </button>
        <button
          type="button"
          disabled={isResolvingAction}
          onClick={(event) => stopCellAction(event, onCommitMove)}
          className="battle-unit-orb battle-unit-orb-done"
          title="Confirm move"
        >
          OK
        </button>
      </div>
    );
  }

  if (mode === 'wait') {
    return (
      <div className="battle-unit-orbs battle-unit-orbs-wait">
        <button
          type="button"
          disabled={isResolvingAction}
          onClick={(event) => stopCellAction(event, onWait)}
          className={`battle-unit-orb battle-unit-orb-wait ${tutorialFocus === 'wait' ? 'battle-unit-orb-tutorial-focus' : ''}`}
          title={waitTitle || 'Pass turn'}
        >
          {waitLabel || 'W'}
        </button>
      </div>
    );
  }

  return (
    <div className="battle-unit-orbs battle-unit-orbs-commander">
      <button
        type="button"
        disabled={isResolvingAction}
        onClick={(event) => stopCellAction(event, onToggleSpellMenu)}
        className={`battle-unit-orb battle-unit-orb-spell ${tutorialFocus === 'spell' ? 'battle-unit-orb-tutorial-focus' : ''}`}
        title="Open spells"
      >
        S
      </button>
      <button
        type="button"
        disabled={isResolvingAction}
        onClick={(event) => stopCellAction(event, onFocusMana)}
        className={`battle-unit-orb battle-unit-orb-mana ${tutorialFocus === 'mana' ? 'battle-unit-orb-tutorial-focus' : ''}`}
        title="Focus mana"
      >
        M
      </button>
      <button
        type="button"
        disabled={isResolvingAction}
        onClick={(event) => stopCellAction(event, onWait)}
        className={`battle-unit-orb battle-unit-orb-wait ${tutorialFocus === 'wait' ? 'battle-unit-orb-tutorial-focus' : ''}`}
        title="Pass turn"
      >
        W
      </button>
    </div>
  );
}

function BattleTurnBanner({ banner }: { banner: BattleTurnBannerData }) {
  return (
    <div className={`battle-turn-banner battle-turn-banner-${banner.side}`} aria-hidden="true">
      <span className="arcane-label">{banner.side === 'enemy' ? 'Hostile action' : 'Command ready'}</span>
      <span className="fantasy-heading">{banner.title}</span>
      <span>{banner.detail}</span>
    </div>
  );
}

function BattleSpellMenu({
  battle,
  spells,
  selectedSpellId,
  isResolvingAction,
  tutorialSpellId,
  onSpellClick,
  onClose,
}: {
  battle: BattleState;
  spells: BattleSpell[];
  selectedSpellId: string | null;
  isResolvingAction: boolean;
  tutorialSpellId?: string;
  onSpellClick: (spell: BattleSpell) => void;
  onClose: () => void;
}) {
  const mana = getBattleMana(battle, 'player');

  return (
    <section className="battle-spell-menu command-panel vine-frame mt-2 rounded border p-4 text-zinc-100">
      <div className="battle-spell-menu-header mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="arcane-label">King Spells</div>
          <h3 className="fantasy-heading text-2xl">Choose Spell</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="battle-spell-mana rounded border px-3 py-2 text-xs font-black uppercase">
            Mana <strong>{mana}</strong>
          </span>
          <button onClick={onClose} className="ui-button rounded px-4 py-2 text-xs font-bold">
            Close
          </button>
        </div>
      </div>
      <div className="battle-spell-grid">
        {spells.map(spell => {
          const enoughMana = mana >= spell.cost;
          const selected = selectedSpellId === spell.id;
          const targetLabel = getSpellTargetLabel(spell.target);
          const spellVisual = getSpellVisual(spell);
          const tutorialFocus = tutorialSpellId === spell.id;

          return (
            <button
              key={spell.id}
              type="button"
              onClick={() => onSpellClick(spell)}
              disabled={!enoughMana || isResolvingAction}
              title={spell.description}
              className={`battle-spell-option spell-card spell-card-${spell.rarity} rounded border px-4 py-4 text-left transition ${tutorialFocus ? 'battle-spell-option-tutorial-focus' : ''} ${
                selected
                  ? 'rail-button-active'
                  : enoughMana
                    ? ''
                    : 'battle-spell-option-locked'
              }`}
            >
              <span className="battle-spell-card-top flex items-start gap-4">
                <span className={`battle-spell-icon battle-spell-icon-${spellVisual.tone} relative shrink-0 overflow-hidden rounded border`}>
                  <Image
                    src={spellVisual.iconPath}
                    alt=""
                    fill
                    sizes="72px"
                    className="object-contain p-2.5"
                    style={{ imageRendering: 'pixelated' }}
                    unoptimized
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="battle-spell-name block font-black text-zinc-100">{spell.name}</span>
                      <span className="ui-faint mt-1 block text-[11px] font-black uppercase">{targetLabel} - {spellVisual.tierLabel}</span>
                    </span>
                    <span className="battle-spell-cost ui-pill shrink-0 rounded border px-3 py-2 text-[11px] font-black">Mana {spell.cost}</span>
                  </span>
                  <span className="battle-spell-tag mt-2 inline-flex rounded border px-2 py-1 text-[10px] font-black uppercase">
                    {spellVisual.tagline}
                  </span>
                </span>
              </span>
              <span className="battle-spell-description ui-muted mt-4 block font-bold leading-relaxed">{spell.description}</span>
              {!enoughMana && <span className="mt-2 block text-xs font-black text-red-200">Need {spell.cost - mana} mana</span>}
            </button>
          );
        })}
      </div>
      <p className="ui-muted mt-3 text-xs font-bold">
        Targeted spells close this menu after selection. Pick a highlighted unit on the board, or press the round spell button again to cancel.
      </p>
    </section>
  );
}

const ARMY_BUFF_SPELL_IDS = new Set(['royal-command', 'moonlit-veil', 'iron-benediction']);

function getSpellPresentationTone(spell: BattleSpell): 'damage' | 'support' | 'field' {
  const style = getBattleSpellLogStyle(spell.id);
  if (style === 'spell-damage' || style === 'spell-drain') return 'damage';
  if (style === 'spell-control' || style === 'debuff') return spell.target === 'enemy' ? 'damage' : 'field';
  if (style === 'spell-support' || style === 'heal' || style === 'buff' || style === 'morale') return 'support';
  if (spell.target === 'enemy') return 'damage';
  if (spell.target === 'ally') return 'support';
  return 'field';
}

function getSpellTargetLabel(target: BattleSpell['target']): string {
  if (target === 'enemy') return 'Damage';
  if (target === 'ally') return 'Support';
  return 'Field';
}

function getSpellVisual(spell: BattleSpell): { iconPath: string; tierLabel: string; tone: 'damage' | 'support' | 'field'; tagline: string } {
  const tierLabel = spell.rarity === 'legendary' ? 'Tier III' : spell.rarity === 'rare' ? 'Tier II' : 'Tier I';
  const iconPath = getSpellIconPath(spell);
  if (spell.target === 'enemy') {
    return {
      iconPath,
      tierLabel,
      tone: 'damage',
      tagline: spell.rarity === 'legendary' ? 'Finisher' : 'Strike',
    };
  }
  if (spell.target === 'ally') {
    return {
      iconPath,
      tierLabel,
      tone: 'support',
      tagline: spell.description.toLowerCase().includes('heal') ? 'Heal' : 'Buff',
    };
  }
  return {
    iconPath,
    tierLabel,
    tone: 'field',
    tagline: 'Battlefield',
  };
}

function BattleSpellCastNotice({ notice }: { notice: BattleSpellCastNoticeData }) {
  const tone = getSpellPresentationTone(notice.spell);

  return (
    <div className={`battle-spell-cast-notice battle-spell-cast-notice-${tone}`} aria-hidden="true">
      <span className="battle-spell-cast-icon relative overflow-hidden rounded-full border">
        <Image
          src={getSpellIconPath(notice.spell)}
          alt=""
          fill
          sizes="112px"
          className="object-contain p-2"
          unoptimized
        />
      </span>
      <span className="battle-spell-cast-copy">
        <span className="arcane-label">{notice.side === 'enemy' ? 'Enemy Spell' : 'Commander Spell'}</span>
        <span className="fantasy-heading">{notice.spell.name}</span>
      </span>
    </div>
  );
}

function BattleOutcomeBanner({ cue }: { cue: BattleCue }) {
  return (
    <div
      className={`battle-outcome-banner battle-outcome-banner-${cue.tone}`}
      style={{ '--battle-outcome-banner-delay-ms': `${RUN_VICTORY_BANNER_DELAY_MS}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="arcane-label">{cue.tone === 'victory' ? 'Field resolved' : 'Battle resolved'}</span>
      <span className="fantasy-heading">{cue.headline}</span>
      {cue.detail && <span>{cue.detail}</span>}
    </div>
  );
}

function getViewportClampedOverlayStyle(
  cursor: { x: number; y: number },
  size: { width: number; height: number }
): CSSProperties {
  const margin = 8;
  const offset = 16;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = cursor.x + offset;
  let top = cursor.y + offset;

  if (left + size.width > viewportWidth - margin) {
    left = cursor.x - size.width - offset;
  }

  if (top + size.height > viewportHeight - margin) {
    top = cursor.y - size.height - offset;
  }

  left = Math.max(margin, Math.min(left, viewportWidth - size.width - margin));
  top = Math.max(margin, Math.min(top, viewportHeight - size.height - margin));

  return { left, top };
}

function useBattleHoverOverlayPosition(
  cursor: { x: number; y: number } | null,
  visible: boolean,
  contentKey: string
) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties | undefined>();
  const cursorX = cursor?.x ?? null;
  const cursorY = cursor?.y ?? null;

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!visible || cursorX === null || cursorY === null || !overlayRef.current) {
        setPosition(undefined);
        return;
      }

      const rect = overlayRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      setPosition(getViewportClampedOverlayStyle({ x: cursorX, y: cursorY }, {
        width: rect.width,
        height: rect.height,
      }));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [visible, cursorX, cursorY, contentKey]);

  return { overlayRef, position };
}

function getBattleUnitSubtitle(unit: BattleUnit): string {
  if (unit.kind === 'commander') {
    return unit.side === 'player' ? 'Commander' : 'Enemy Commander';
  }

  const template = unit.templateId ? getMinionTemplate(unit.templateId) : undefined;
  if (template) {
    return `${MINION_TIER_LABELS[template.tier]} ${MINION_CLASS_LABELS[template.class]}`;
  }

  return 'Minion';
}

function BattleHoverOverlay({
  preview,
  forecast,
  visible,
  cursor,
}: {
  preview: BattleHoverPreviewData;
  forecast: BattleHoverForecastData | null;
  visible: boolean;
  cursor: { x: number; y: number } | null;
}) {
  const contentKey = forecast
    ? [
      forecast.unit.id,
      forecast.actionLabel,
      forecast.amount,
      forecast.projectedHealth,
      forecast.retaliationDamage,
      forecast.retaliationProjectedHealth,
    ].join(':')
    : `${preview.title}:${preview.detail}`;
  const { overlayRef, position } = useBattleHoverOverlayPosition(cursor, visible, contentKey);
  const overlayStyle: CSSProperties = {
    ...(position || (cursor ? { left: cursor.x + 16, top: cursor.y + 16 } : {})),
    visibility: position ? 'visible' : 'hidden',
  };

  if (!visible) return null;

  if (forecast) {
    const currentPct = getHealthPercent(forecast.currentHealth, forecast.maxHealth);
    const projectedPct = getHealthPercent(forecast.projectedHealth, forecast.maxHealth);
    const delta = forecast.projectedHealth - forecast.currentHealth;
    const retaliationDelta = typeof forecast.retaliationDamage === 'number' && typeof forecast.retaliationCurrentHealth === 'number' && typeof forecast.retaliationProjectedHealth === 'number'
      ? forecast.retaliationProjectedHealth - forecast.retaliationCurrentHealth
      : 0;
    const retaliationCurrentPct = getHealthPercent(forecast.retaliationCurrentHealth || 0, forecast.retaliationMaxHealth || 0);
    const retaliationProjectedPct = getHealthPercent(forecast.retaliationProjectedHealth || 0, forecast.retaliationMaxHealth || 0);
    const damagePct = delta < 0 ? Math.max(0, currentPct - projectedPct) : 0;
    const healPct = delta > 0 ? Math.max(0, projectedPct - currentPct) : 0;
    const retaliationDamagePct = retaliationDelta < 0
      ? Math.max(0, retaliationCurrentPct - retaliationProjectedPct)
      : 0;
    const toneClass = forecast.tone === 'danger'
      ? 'battle-forecast-danger'
      : forecast.tone === 'good'
        ? 'battle-forecast-good'
        : '';

    return (
      <div
        ref={overlayRef}
        className={`battle-hover-overlay battle-forecast-tooltip rounded border p-3 ${toneClass}`}
        style={overlayStyle}
      >
        <div className="flex items-start gap-3">
          <span className="battle-forecast-portrait relative shrink-0 overflow-hidden rounded border">
            <Image
              src={forecast.unit.assetPath}
              alt=""
              fill
              className="object-contain"
              sizes="44px"
              unoptimized
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-black text-zinc-100">{forecast.unit.name}</span>
            <span className="ui-faint block text-[10px] font-black uppercase">
              {getBattleUnitSubtitle(forecast.unit)}
            </span>
            {forecast.actionLabel && (
              <span className={`battle-forecast-action mt-1 inline-flex rounded border px-2 py-0.5 text-[10px] font-black uppercase ${toneClass}`}>
                {forecast.actionLabel}
              </span>
            )}
          </span>
          {typeof forecast.amount === 'number' && forecast.amount > 0 && (
            <span className={`battle-forecast-delta rounded border px-2 py-1 text-xs font-black ${delta < 0 ? 'text-red-200' : 'text-emerald-200'}`}>
              {delta < 0 ? '-' : '+'}{forecast.amount}
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-black uppercase text-[var(--ui-faint)]">
            <span>Health</span>
            <span>{forecast.currentHealth} / {forecast.maxHealth}</span>
          </div>
          <div className="battle-forecast-health-track">
            <span className="battle-forecast-health-current" style={{ width: `${currentPct}%` }} />
            {damagePct > 0 && (
              <span
                className="battle-forecast-health-delta battle-forecast-health-damage"
                style={{ left: `${projectedPct}%`, width: `${damagePct}%` }}
              />
            )}
            {healPct > 0 && (
              <span
                className="battle-forecast-health-delta battle-forecast-health-heal"
                style={{ left: `${currentPct}%`, width: `${healPct}%` }}
              />
            )}
          </div>
          {delta !== 0 && (
            <div className="mt-1 text-[10px] font-black text-[var(--ui-muted)]">
              After action: {forecast.projectedHealth} / {forecast.maxHealth}
            </div>
          )}
        </div>

        {typeof forecast.retaliationDamage === 'number' && forecast.retaliationDamage > 0 && typeof forecast.retaliationCurrentHealth === 'number' && typeof forecast.retaliationProjectedHealth === 'number' && (
          <div className="battle-forecast-retaliation mt-3 rounded border px-2.5 py-2">
            <div className="mb-1 flex justify-between gap-2 text-[10px] font-black uppercase">
              <span>Retaliation</span>
              <span>You take -{forecast.retaliationDamage}</span>
            </div>
            <div className="battle-forecast-health-track">
              <span className="battle-forecast-health-current battle-forecast-health-self" style={{ width: `${retaliationCurrentPct}%` }} />
              {retaliationDamagePct > 0 && (
                <span
                  className="battle-forecast-health-delta battle-forecast-health-retaliation"
                  style={{ left: `${retaliationProjectedPct}%`, width: `${retaliationDamagePct}%` }}
                />
              )}
            </div>
            {retaliationDelta !== 0 && (
              <div className="mt-1 text-[10px] font-black text-[var(--ui-muted)]">
                Your unit after counter: {forecast.retaliationProjectedHealth} / {forecast.retaliationMaxHealth}
              </div>
            )}
          </div>
        )}

        <div className="battle-forecast-stats mt-3 grid grid-cols-5 gap-1 text-center">
          <span><b>{forecast.unit.attack}</b><em>Atk</em></span>
          <span><b>{forecast.unit.defense}</b><em>Def</em></span>
          <span><b>{forecast.unit.magic}</b><em>Mag</em></span>
          <span><b>{forecast.unit.healing}</b><em>Heal</em></span>
          <span><b>{forecast.unit.range}</b><em>Rng</em></span>
        </div>
      </div>
    );
  }

  if (!preview.title && !preview.detail) return null;

  return (
    <div
      ref={overlayRef}
      className={`battle-hover-overlay rounded border px-3 py-2 ${preview.tone === 'danger' ? 'battle-hover-danger' : preview.tone === 'good' ? 'battle-hover-good' : ''}`}
      style={overlayStyle}
    >
      <div className="truncate text-xs font-black text-zinc-100">{preview.title}</div>
      {preview.detail ? (
        <div className="ui-muted truncate text-[10px] font-bold">{preview.detail}</div>
      ) : null}
    </div>
  );
}

function getHealthPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (current / max) * 100));
}

function getUpcomingTurnOrder(battle: BattleState): BattleUnit[] {
  const sortedLiveUnits = getTurnOrder(battle.units);
  const activeUnit = sortedLiveUnits.find(unit => unit.id === battle.activeUnitId);

  if (!activeUnit) return sortedLiveUnits;

  if (Array.isArray(battle.turnQueue)) {
    const liveUnitsById = new Map(sortedLiveUnits.map(unit => [unit.id, unit]));
    const seenIds = new Set([activeUnit.id]);
    const queuedUnits = battle.turnQueue
      .map(unitId => liveUnitsById.get(unitId))
      .filter((unit): unit is BattleUnit => {
        if (!unit || seenIds.has(unit.id)) return false;
        seenIds.add(unit.id);
        return true;
      });
    const nextRoundPreview = sortedLiveUnits.filter(unit => !seenIds.has(unit.id));

    return [activeUnit, ...queuedUnits, ...nextRoundPreview];
  }

  const activeIndex = sortedLiveUnits.findIndex(unit => unit.id === battle.activeUnitId);
  if (activeIndex <= 0) return sortedLiveUnits;
  return [...sortedLiveUnits.slice(activeIndex), ...sortedLiveUnits.slice(0, activeIndex)];
}

function BattleTurnTimeline({
  battle,
  vertical = false,
  rail = false,
}: {
  battle: BattleState;
  vertical?: boolean;
  rail?: boolean;
}) {
  const order = getUpcomingTurnOrder(battle);

  if (rail) {
    return (
      <div className="battle-turn-timeline battle-turn-timeline-rail battle-turn-timeline-vertical rounded border">
        <div className="battle-turn-timeline-rail-head">
          <h3 className="battle-turn-timeline-rail-title fantasy-heading">Turn Order</h3>
          <p className="battle-turn-timeline-rail-copy">Next fighters up the field</p>
        </div>
        <ol className="battle-order-list">
          {order.map((unit, index) => {
            const isActive = unit.id === battle.activeUnitId;
            const isPlayer = unit.side === 'player';

            return (
              <li
                key={unit.id}
                className={`battle-order-entry ${isActive ? 'battle-order-entry-active' : ''} ${isPlayer ? 'battle-order-entry-player' : 'battle-order-entry-enemy'}`}
                title={`${unit.name} · ${isPlayer ? 'Ally' : 'Enemy'}`}
              >
                <span className="battle-order-index" aria-hidden="true">{index + 1}</span>
                <span className="battle-order-portrait">
                  <Image
                    src={unit.assetPath}
                    alt=""
                    width={72}
                    height={72}
                    className="battle-order-portrait-image run-ui-art object-contain"
                    unoptimized
                  />
                </span>
                <span className="battle-order-copy">
                  <span className="battle-order-name">{shortBattleUnitName(unit.name)}</span>
                  <span className="battle-order-meta">
                    {isPlayer ? 'Ally' : 'Enemy'}
                    {unit.kind === 'commander' ? ' · Commander' : ''}
                  </span>
                </span>
                {isActive ? <span className="battle-order-now">Now</span> : null}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className={`battle-turn-timeline rounded border px-3 py-2 ${vertical ? 'battle-turn-timeline-vertical' : ''}`}>
      <span className="arcane-label">Order</span>
      <span className={vertical ? 'battle-turn-token-stack' : 'inline-flex max-w-full gap-1.5 align-middle'}>
        {order.map(unit => (
          <span
            key={unit.id}
            className={`battle-turn-token relative overflow-hidden rounded-full border ${unit.id === battle.activeUnitId ? 'battle-turn-token-active' : ''} ${unit.side === 'player' ? 'battle-turn-token-player' : 'battle-turn-token-enemy'}`}
            title={`${unit.name} - ${unit.side}`}
          >
            <Image
              src={unit.assetPath}
              alt=""
              fill
              className="object-contain p-0.5"
              style={{ imageRendering: 'pixelated' }}
              unoptimized
            />
          </span>
        ))}
      </span>
    </div>
  );
}

function shortBattleUnitName(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

type BattlePieceTargetGlow = 'heal' | 'strike' | 'spell-support' | 'spell-damage';

function BattlePiece({
  unit,
  active,
  animation,
  rising = false,
  targetGlow,
  tutorialFocus,
}: {
  unit: BattleUnit;
  active: boolean;
  animation: BattlePieceAnimation;
  rising?: boolean;
  targetGlow?: BattlePieceTargetGlow;
  tutorialFocus?: boolean;
}) {
  const healthPercent = Math.max(0, Math.min(100, (unit.currentHealth / unit.maxHealth) * 100));
  const animationClass = animation ? `battle-piece-anim-${animation}` : '';
  const isCommander = unit.kind === 'commander';
  const idleClass = animation ? '' : active ? 'battle-piece-body-idle battle-piece-body-idle-alert' : 'battle-piece-body-idle';
  const isBleeding = Boolean((unit.statusEffects?.bleedStacks || 0) > 0);
  const isPoisoned = Boolean((unit.statusEffects?.poisonTurns || 0) > 0);

  return (
    <span
      className={`battle-piece-wrap battle-piece-wrap-${unit.side} ${active ? 'battle-piece-wrap-active' : ''} ${rising ? 'battle-piece-wrap-rising' : ''} ${tutorialFocus ? 'battle-piece-wrap-tutorial-focus' : ''} ${isBleeding ? 'battle-piece-wrap-bleeding' : ''} ${isPoisoned ? 'battle-piece-wrap-poisoned' : ''}`}
      data-battle-target={targetGlow || undefined}
    >
      <span className="battle-piece-health">
        <span className={unit.side === 'player' ? 'bg-emerald-300' : 'bg-red-300'} style={{ width: `${healthPercent}%` }} />
      </span>
      {unit.chargedHeal && (
        <span className="battle-piece-status battle-piece-status-blessing" title="Blessing charged: next heal is stronger">
          +
        </span>
      )}
      {isBleeding && (
        <span className="battle-piece-status battle-piece-status-bleed" title={`Bleeding: ${unit.statusEffects?.bleedStacks || 1} stack${(unit.statusEffects?.bleedStacks || 1) === 1 ? '' : 's'}`}>
          B
        </span>
      )}
      {isPoisoned && (
        <span className="battle-piece-status battle-piece-status-poison" title={`Poisoned: ${unit.statusEffects?.poisonTurns || 1} turn${(unit.statusEffects?.poisonTurns || 1) === 1 ? '' : 's'} left`}>
          P
        </span>
      )}
      {isBleeding && <span className="battle-status-particles battle-status-particles-bleed" aria-hidden="true" />}
      {isPoisoned && <span className="battle-status-particles battle-status-particles-poison" aria-hidden="true" />}
      <span className={`battle-piece-body ${isCommander ? 'battle-piece-body-commander' : 'battle-piece-body-minion'} ${idleClass} ${animationClass}`}>
        <span className={`battle-piece-base ${unit.side === 'player' ? 'battle-piece-base-player' : 'battle-piece-base-enemy'} ${isCommander ? 'battle-piece-base-commander' : ''}`} />
        <Image
          src={unit.assetPath}
          alt={unit.name}
          fill
          sizes="(max-width: 768px) 12vw, 8vw"
          className="battle-piece-image object-contain object-center"
          unoptimized
        />
      </span>
      <span className={`battle-piece-role ${unit.side === 'player' ? 'battle-piece-role-player' : 'battle-piece-role-enemy'}`}>
        {isCommander ? 'K' : 'U'}
      </span>
    </span>
  );
}

function BattleBossResurrectionPulse({
  unit,
  presentationMs = BOSS_LAST_STAND_PRESENTATION_MS,
  revealMs = BOSS_LAST_STAND_RESPAWN_REVEAL_MS,
  tone = 'holy',
}: {
  unit: { assetPath: string; x: number; y: number };
  presentationMs?: number;
  revealMs?: number;
  tone?: 'holy' | 'raid';
}) {
  return (
    <span
      className={`battle-boss-resurrection-pulse ${tone === 'raid' ? 'battle-boss-resurrection-pulse-raid' : ''}`}
      style={{
        '--boss-respawn-reveal-ms': `${revealMs}ms`,
        '--boss-last-stand-ms': `${presentationMs}ms`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <span className="battle-boss-resurrection-ground" />
      <span className="battle-boss-resurrection-beam" />
      <span className="battle-boss-resurrection-sprite">
        <Image
          src={unit.assetPath}
          alt=""
          fill
          sizes="(max-width: 768px) 12vw, 8vw"
          className="battle-boss-resurrection-image object-contain object-center"
          unoptimized
        />
      </span>
      <span className="battle-boss-resurrection-spark battle-boss-resurrection-spark-1" />
      <span className="battle-boss-resurrection-spark battle-boss-resurrection-spark-2" />
    </span>
  );
}

function BattleBossLastStandOverlay({
  cue,
}: {
  cue: {
    id: string;
    commanderName: string;
    assetPath: string;
    subtitle?: string;
    resurrectedUnits: Array<{ id: string; assetPath: string; x: number; y: number }>;
  };
}) {
  return (
    <div
      key={cue.id}
      className="battle-boss-cinematic-overlay battle-boss-last-stand-overlay"
      style={{
        '--boss-last-stand-ms': `${BOSS_LAST_STAND_PRESENTATION_MS}ms`,
        '--boss-respawn-reveal-ms': `${BOSS_LAST_STAND_RESPAWN_REVEAL_MS}ms`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <span className="battle-boss-cinematic-veil battle-boss-last-stand-veil" />
      <span className="battle-boss-cinematic-ring battle-boss-cinematic-ring-1" />
      <span className="battle-boss-cinematic-ring battle-boss-cinematic-ring-2" />
      <span className="battle-boss-cinematic-burst battle-boss-last-stand-burst" />
      <span className="battle-boss-cinematic-sprite-wrap">
        <span className="battle-boss-cinematic-sprite-glow battle-boss-last-stand-sprite-glow" />
        <Image
          src={cue.assetPath}
          alt=""
          width={280}
          height={340}
          className="battle-boss-cinematic-sprite battle-boss-last-stand-sprite object-contain object-center"
          unoptimized
        />
      </span>
      <span className="battle-boss-cinematic-copy">
        <span className="battle-boss-cinematic-phase fantasy-heading">Phase II</span>
        <span className="battle-boss-cinematic-title fantasy-heading">{cue.commanderName}</span>
        {cue.subtitle ? <span className="battle-boss-cinematic-subtitle">{cue.subtitle}</span> : null}
        <span className="battle-boss-cinematic-detail">
          {cue.resurrectedUnits.length > 0
            ? `${cue.resurrectedUnits.length} servant${cue.resurrectedUnits.length === 1 ? '' : 's'} rise from the ash.`
            : 'The oath reignites. The boss endures.'}
        </span>
      </span>
    </div>
  );
}

function BattleBossSpecialOverlay({
  cue,
}: {
  cue: {
    id: string;
    commanderName: string;
    assetPath: string;
    subtitle?: string;
    spellName: string;
    summonedUnits: Array<{ id: string; assetPath: string; x: number; y: number }>;
  };
}) {
  return (
    <div
      key={cue.id}
      className="battle-boss-cinematic-overlay battle-boss-special-overlay"
      style={{
        '--boss-special-ms': `${BOSS_SPECIAL_PRESENTATION_MS}ms`,
        '--boss-special-summon-reveal-ms': `${BOSS_SPECIAL_SUMMON_REVEAL_MS}ms`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <span className="battle-boss-cinematic-veil battle-boss-special-veil" />
      <span className="battle-boss-cinematic-ring battle-boss-cinematic-ring-1 battle-boss-special-ring" />
      <span className="battle-boss-cinematic-ring battle-boss-cinematic-ring-2 battle-boss-special-ring" />
      <span className="battle-boss-cinematic-burst battle-boss-special-burst" />
      <span className="battle-boss-cinematic-sprite-wrap">
        <span className="battle-boss-cinematic-sprite-glow battle-boss-special-sprite-glow" />
        <Image
          src={cue.assetPath}
          alt=""
          width={260}
          height={320}
          className="battle-boss-cinematic-sprite battle-boss-special-sprite object-contain object-center"
          unoptimized
        />
      </span>
      <span className="battle-boss-cinematic-copy">
        <span className="battle-boss-cinematic-phase fantasy-heading">Boss Rite</span>
        <span className="battle-boss-cinematic-title fantasy-heading">{cue.spellName}</span>
        <span className="battle-boss-cinematic-subtitle">{cue.commanderName}</span>
        <span className="battle-boss-cinematic-detail">
          {cue.summonedUnits.length > 0
            ? `${cue.summonedUnits.length} servant${cue.summonedUnits.length === 1 ? '' : 's'} answer the call.`
            : cue.subtitle || 'The boss bends the field to their will.'}
        </span>
      </span>
    </div>
  );
}

function BattleDeathMarker({ unit }: { unit: BattleUnit }) {
  const isCommander = unit.kind === 'commander';

  return (
    <span
      className="battle-death-marker"
      style={{ '--battle-death-dissolve-ms': `${BATTLE_DEATH_DISSOLVE_MS}ms` } as CSSProperties}
    >
      <span className={`battle-piece-body battle-death-body battle-piece-anim-death ${isCommander ? 'battle-piece-body-commander' : 'battle-piece-body-minion'}`}>
        <Image
          src={unit.assetPath}
          alt=""
          fill
          sizes="(max-width: 768px) 12vw, 8vw"
          className="battle-piece-image battle-death-sprite object-contain object-center"
          unoptimized
        />
      </span>
      <span className="battle-death-ash battle-death-ash-core" />
      <span className="battle-death-ash battle-death-ash-puff battle-death-ash-puff-1" />
      <span className="battle-death-ash battle-death-ash-puff battle-death-ash-puff-2" />
      <span className="battle-death-ash battle-death-ash-puff battle-death-ash-puff-3" />
    </span>
  );
}

function BattleUnitTransit({
  unit,
  from,
  to,
  active,
}: {
  unit: BattleUnit;
  from: { x: number; y: number };
  to: { x: number; y: number };
  active: boolean;
}) {
  const isCommander = unit.kind === 'commander';

  return (
    <span
      className={`battle-unit-transit battle-unit-transit-${unit.side}`}
      style={{
        '--transit-from-x': from.x,
        '--transit-from-y': from.y,
        '--transit-to-x': to.x,
        '--transit-to-y': to.y,
      } as CSSProperties}
    >
      <span className={`battle-piece-wrap battle-piece-wrap-${unit.side} ${active ? 'battle-piece-wrap-active' : ''}`}>
        <span className={`battle-piece-body ${isCommander ? 'battle-piece-body-commander' : 'battle-piece-body-minion'} battle-piece-anim-move`}>
          <Image
            src={unit.assetPath}
            alt={unit.name}
            fill
            sizes="(max-width: 768px) 12vw, 8vw"
            className="battle-piece-image object-contain object-center"
            unoptimized
          />
        </span>
      </span>
    </span>
  );
}

function getUnitMoveTransit(
  battle: BattleState,
  entry: BattleLogEntry | undefined,
  now: number,
): { unit: BattleUnit; from: { x: number; y: number }; to: { x: number; y: number }; startedAt: number } | null {
  if (!entry || entry.action !== 'move') return null;
  if (entry.fromX === undefined || entry.fromY === undefined || entry.toX === undefined || entry.toY === undefined) return null;
  if (now - entry.createdAt > BATTLE_MOVE_TRANSIT_MS) return null;

  const unit = battle.units.find(item => item.id === entry.actorId && item.currentHealth > 0);
  if (!unit) return null;

  return {
    unit,
    from: { x: entry.fromX, y: entry.fromY },
    to: { x: entry.toX, y: entry.toY },
    startedAt: entry.createdAt,
  };
}

function BattleStanceIconImpact({ impact }: { impact: BattleStanceIconImpactData }) {
  return (
    <span
      className={`battle-spell-impact battle-spell-impact-${impact.tone} battle-stance-icon-impact battle-stance-icon-impact-${impact.sizeClass}`}
      style={{ '--stance-icon': `url("${impact.iconPath}")` } as CSSProperties}
      aria-hidden="true"
    >
      <Image
        src={impact.iconPath}
        alt=""
        fill
        sizes="96px"
        className="battle-spell-impact-image object-contain"
        unoptimized
      />
    </span>
  );
}

function BattleSpellIconImpact({ impact, delayMs = 0 }: { impact: BattleSpellImpactData; delayMs?: number }) {
  const style = {
    '--spell-icon': `url("${impact.iconPath}")`,
    animationDelay: delayMs > 0 ? `${delayMs}ms` : undefined,
  } as CSSProperties;

  return (
    <span className={`battle-spell-impact battle-spell-impact-${impact.tone}`} style={style} aria-hidden="true">
      <Image
        src={impact.iconPath}
        alt=""
        fill
        sizes="64px"
        className="battle-spell-impact-image object-contain"
        unoptimized
      />
      {impact.tone === 'damage' && (
        <>
          <span className="battle-spell-impact-fragment battle-spell-impact-fragment-1" />
          <span className="battle-spell-impact-fragment battle-spell-impact-fragment-2" />
          <span className="battle-spell-impact-fragment battle-spell-impact-fragment-3" />
        </>
      )}
    </span>
  );
}

function getPresentationEntry(
  battle: BattleState,
  pin: PresentationPin | null,
  now: number,
): BattleLogEntry | undefined {
  if (pin && now < pin.expiresAt) return pin.entry;
  return getRecentPresentationLogEntry(battle, now) ?? battle.log[0];
}

function getBattleActionPresentationMs(entry: BattleLogEntry | undefined, battle?: BattleState): number {
  if (!entry) return BATTLE_DEFAULT_PRESENTATION_MS;
  return getBattleLogPresentationMs(entry, battle);
}

function getPendingCinematicEntry(battle: BattleState, now = Date.now()): BattleLogEntry | undefined {
  return battle.log.slice(0, 2).find(entry => (
    (entry.style === 'boss-phase' || entry.style === 'boss-special')
    && now - entry.createdAt < getBattleLogPresentationMs(entry, battle) + 320
  ));
}

function refreshPresentationLogTimestamp(battle: BattleState, preferredEntryId?: string): BattleState {
  const preferredIndex = preferredEntryId
    ? battle.log.findIndex(entry => entry.id === preferredEntryId)
    : 0;
  const entryIndex = preferredIndex >= 0 ? preferredIndex : 0;
  const entry = battle.log[entryIndex];
  if (
    !entry
    || entry.action === 'round'
    || entry.action === 'system'
    || entry.action === 'move'
  ) {
    return battle;
  }
  const createdAt = Date.now();
  return {
    ...battle,
    log: battle.log.map((item, index) => (
      index === entryIndex ? { ...item, createdAt } : item
    )),
  };
}

function getRemainingPresentationMs(
  entry: BattleLogEntry,
  battle: BattleState,
  now = Date.now(),
): number {
  return Math.max(0, getBattleLogPresentationMs(entry, battle) - (now - entry.createdAt));
}

function getBattleVictoryHandoffDelayMs(battle: BattleState, now = Date.now()): number {
  const entry = getRecentPresentationLogEntry(battle, now)
    ?? battle.log.find(item => item.action === 'attack' || item.action === 'spell')
    ?? battle.log[0];
  const actionMs = entry
    ? Math.max(getBattleLogPresentationMs(entry, battle), BATTLE_DEATH_HIT_MS + BATTLE_DEATH_DISSOLVE_MS)
    : BATTLE_DEFAULT_PRESENTATION_MS;
  const startedAt = entry?.createdAt ?? now;
  const handoffAt = startedAt + actionMs + RUN_VICTORY_AFTER_ANIMATION_HOLD_MS;

  return Math.max(RUN_VICTORY_HANDOFF_FLOOR_MS, handoffAt - now);
}

function getBattleDeathHitAnimation(entry: BattleLogEntry | undefined): BattlePieceAnimation {
  if (!entry) return 'hit-melee';
  if (entry.action === 'spell') return 'spell-hit';
  return entry.style === 'ranged' ? 'hit-ranged' : 'hit-melee';
}

type DefeatedUnitPresentation = { unit: BattleUnit; phase: 'hit' | 'dissolve' };

function getDefeatedUnitPresentation(
  battle: BattleState,
  x: number,
  y: number,
  entry: BattleLogEntry | undefined,
  now: number,
): DefeatedUnitPresentation | undefined {
  if (!entry || (entry.action !== 'attack' && entry.action !== 'spell')) return undefined;
  if (now - entry.createdAt > getBattleActionPresentationMs(entry, battle)) return undefined;

  const unit = battle.units.find(candidate => (
    candidate.currentHealth <= 0 &&
    candidate.x === x &&
    candidate.y === y &&
    Boolean(entry.targetIds?.includes(candidate.id))
  ));
  if (!unit) return undefined;

  const elapsed = now - entry.createdAt;
  if (elapsed < BATTLE_DEATH_HIT_MS) return { unit, phase: 'hit' };
  if (elapsed < BATTLE_DEATH_HIT_MS + BATTLE_DEATH_DISSOLVE_MS) return { unit, phase: 'dissolve' };
  return undefined;
}

function getBattleSpellFromLogEntry(entry: BattleLogEntry): BattleSpell | undefined {
  if (entry.spellId) return BATTLE_SPELLS.find(spell => spell.id === entry.spellId);
  return BATTLE_SPELLS.find(spell => entry.message.toLowerCase().includes(spell.name.toLowerCase()));
}

function getBattleSpellImpact(
  battle: BattleState,
  unit: BattleUnit | undefined,
  entry: BattleLogEntry | undefined,
  now: number
): BattleSpellImpactData | null {
  if (!unit || !entry) return null;
  if (entry.action !== 'spell' || now - entry.createdAt > getBattleActionPresentationMs(entry, battle)) return null;

  const spell = getBattleSpellFromLogEntry(entry);
  if (!spell) return null;

  const isTarget = Boolean(entry.targetIds?.includes(unit.id));
  const isActor = entry.actorId === unit.id;
  if (!isTarget && !(isActor && spell.target === 'none')) return null;

  return {
    spell,
    iconPath: getSpellIconPath(spell),
    tone: getSpellPresentationTone(spell),
  };
}

function getBattleStanceIconImpact(
  unit: BattleUnit | undefined,
  entry: BattleLogEntry | undefined,
  now: number,
  battle?: BattleState,
): BattleStanceIconImpactData | null {
  if (!unit || !entry || entry.actorId !== unit.id) return null;
  if (now - entry.createdAt > getBattleActionPresentationMs(entry, battle)) return null;

  if (entry.action === 'wait') {
    if (entry.style === 'buff' && (unit.templateId === 'bell' || unit.templateId === 'enchanter')) {
      return {
        iconPath: unit.assetPath,
        tone: unit.templateId === 'bell' ? 'field' : 'support',
        sizeClass: 'support',
      };
    }

    return {
      iconPath: BATTLE_WAIT_SHIELD_ICON,
      tone: 'support',
      sizeClass: 'wait',
    };
  }

  if (entry.action === 'mana') {
    return {
      iconPath: BATTLE_MANA_FOCUS_ICON,
      tone: 'field',
      sizeClass: 'mana-focus',
    };
  }

  return null;
}

function getFloatingBattleText(
  battle: BattleState,
  unit: BattleUnit | undefined,
  entry: BattleLogEntry | undefined,
  now: number
): { text: string; tone: 'damage' | 'heal' | 'mana' | 'neutral' } | null {
  if (!unit || !entry) return null;
  if (now - entry.createdAt > getBattleActionPresentationMs(entry, battle)) return null;

  const isTarget = Boolean(entry.targetIds?.includes(unit.id));
  const isActor = entry.actorId === unit.id;
  const actor = entry.actorId ? battle.units.find(item => item.id === entry.actorId) : undefined;
  const numberMatch = entry.message.match(/\b(\d+)\b/);
  const value = numberMatch?.[1];

  if ((entry.action === 'attack' || entry.action === 'spell') && isTarget && value) {
    return { text: `-${value}`, tone: 'damage' };
  }

  if ((entry.action === 'heal' || entry.action === 'morale') && isTarget && value) {
    return { text: `+${value}`, tone: 'heal' };
  }

  if (entry.action === 'mana' && isActor) {
    return { text: '+M', tone: 'mana' };
  }

  if (entry.action === 'wait' && entry.style === 'buff' && isTarget && actor?.templateId === 'bell') {
    return { text: '+Move', tone: 'mana' };
  }

  if (entry.action === 'wait' && entry.style === 'buff' && isTarget && actor?.templateId === 'enchanter') {
    return { text: '+Ward', tone: 'mana' };
  }

  if (entry.action === 'wait' && entry.style === 'buff' && isActor) {
    return { text: 'Blessed', tone: 'mana' };
  }

  return null;
}

function getBattlePieceAnimation(
  battle: BattleState,
  unit: BattleUnit,
  entry: BattleLogEntry | undefined,
  now: number,
): BattlePieceAnimation {
  if (!entry || now - entry.createdAt > getBattleActionPresentationMs(entry, battle)) return null;

  const isActor = entry.actorId === unit.id;
  const isTarget = Boolean(entry.targetIds?.includes(unit.id));
  const actor = entry.actorId ? battle.units.find(item => item.id === entry.actorId) : undefined;
  const style = entry.style || (entry.action === 'attack' && actor?.range && actor.range > 1 ? 'ranged' : undefined);

  if (isActor) {
    if (entry.action === 'move') return 'move';
    if (entry.action === 'attack') return style === 'ranged' ? 'ranged' : 'melee';
    if (entry.action === 'heal') return 'heal';
    if (entry.action === 'spell') return 'commander-spell';
    if (entry.action === 'wait' || entry.action === 'mana') return null;
    if (entry.action === 'morale') return 'morale';
  }

  if (isTarget) {
    if (entry.action === 'attack') return style === 'ranged' ? 'hit-ranged' : 'hit-melee';
    if (entry.action === 'spell') {
      if (style === 'spell-support' || style === 'heal') return 'heal';
      if (style === 'buff') {
        return entry.spellId && ARMY_BUFF_SPELL_IDS.has(entry.spellId) ? 'morale' : 'buff';
      }
      if (style === 'bleed') return 'hit-melee';
      if (style === 'poison') return 'debuff';
      if (style === 'debuff' || style === 'spell-control') return 'debuff';
      if (style === 'morale') return 'morale';
      return 'spell-hit';
    }
    if (entry.action === 'heal') return 'heal';
    if (entry.action === 'morale') return 'morale';
  }

  return null;
}

function getBattleTerrainClassName(terrain: BattleTerrainType): string {
  if (terrain === 'holyGround') return 'battle-terrain-holy-ground';
  return terrain === 'highGround' ? 'battle-terrain-high-ground' : `battle-terrain-${terrain}`;
}

function BattleResultReport({
  battle,
  report,
  onClose,
}: {
  battle: BattleState;
  report: BattleResultReportData | null;
  onClose: () => void;
}) {
  const status = report?.status || (battle.status === 'recruited' ? 'recruited' : battle.status === 'defeat' ? 'defeat' : 'victory');
  const reward: VictoryRewardReport | undefined = report?.reward || (status === 'victory' ? getVictoryReward(battle.enemy) : undefined);
  const fallenMinions = getFallenPlayerMinions(battle);
  const injuredMinions = report?.casualtyReport?.injuredNames || [];
  const deadMinions = report?.casualtyReport?.deadNames || [];
  const recruitedMinions = report?.recruitedMinions || battle.recruitOffer?.offeredMinions.map(getMinionStackName) || [];

  const title = status === 'victory'
    ? 'Field Won'
    : status === 'defeat'
      ? 'Routed'
      : 'Oath Accepted';
  const detail = status === 'victory'
    ? 'Rewards were claimed and the battle report is ready.'
    : status === 'defeat'
      ? 'Your commander fell or the warband was driven from the field.'
      : 'The enemy yielded and joined your army. No battle reward was taken.';

  return (
    <section className={`battle-result-panel rounded border p-4 ${status === 'defeat' ? 'battle-result-defeat' : 'battle-result-victory'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="arcane-label">Battle Report</div>
          <h3 className="fantasy-heading text-2xl">{title}</h3>
          <p className="ui-muted mt-1 text-xs font-bold">{detail}</p>
        </div>
        <button onClick={onClose} className="ui-button-primary rounded px-4 py-2 text-xs font-bold">
          Leave Field
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <BattleResultStat label="Enemy" value={battle.enemy.name} />
        <BattleResultStat label="Rounds" value={String(battle.round)} />
        <BattleResultStat label="Map" value={battle.mapName} />
      </div>

      {status === 'victory' && reward && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            <BattleResultStat label="Gold" value={`+${reward.gold}`} />
            <BattleResultStat label="XP" value={`+${reward.exp}`} />
            <BattleResultStat
              label="Gems"
              value={reward.rareGems ? `+${reward.rareGemsAccepted ?? reward.rareGems}` : 'None'}
              note={reward.inventoryFull ? 'Satchel full' : undefined}
            />
            <BattleResultStat
              label="Equipment"
              value={reward.equipmentNames?.length ? reward.equipmentNames.join(', ') : reward.equipmentRarity || 'None'}
            />
            <BattleResultStat
              label="Items"
              value={reward.itemNames?.length ? reward.itemNames.join(', ') : 'None'}
            />
          </div>

          {reward.questProgress && reward.questProgress.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {reward.questProgress.map(progress => (
                <BattleResultStat
                  key={progress.id}
                  label={progress.complete ? 'Quest Ready' : 'Quest Progress'}
                  value={progress.label}
                  note={progress.value}
                />
              ))}
            </div>
          )}
        </>
      )}

      {status === 'defeat' && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <BattleResultStat label="Health Lost" value={`-${report?.healthLost ?? 0}`} />
          <BattleResultStat label="Reward" value="None" />
        </div>
      )}

      {status === 'recruited' && (
        <div className="mt-3">
          <BattleResultStat
            label="New Recruits"
            value={recruitedMinions.length ? recruitedMinions.join(', ') : 'Warband service accepted'}
          />
        </div>
      )}

      <div className="mt-3 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-[var(--ui-muted)]">
        {injuredMinions.length > 0 || deadMinions.length > 0
          ? [
            injuredMinions.length > 0 ? `Injured: ${injuredMinions.join(', ')}.` : '',
            deadMinions.length > 0 ? `Lost permanently: ${deadMinions.join(', ')}.` : '',
          ].filter(Boolean).join(' ')
          : fallenMinions.length > 0
            ? `Run casualties only: ${fallenMinions.join(', ')}.`
            : 'No permanent minion losses.'}
      </div>
    </section>
  );
}

function BattleResultStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="battle-result-stat rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value mt-0.5 truncate text-sm font-black">{value}</div>
      {note && <div className="mt-0.5 text-[10px] font-black text-red-100">{note}</div>}
    </div>
  );
}

function emitBattleCompletionNotice(battle: BattleState, report: BattleResultReportData | null): void {
  const status = report?.status || (battle.status === 'recruited' ? 'recruited' : battle.status === 'defeat' ? 'defeat' : 'victory');
  const reward: VictoryRewardReport | undefined = report?.reward || (status === 'victory' ? getVictoryReward(battle.enemy) : undefined);
  const rewards: CompletionRewardLine[] = [
    { label: 'Rounds', value: String(battle.round), tone: 'neutral' },
    { label: 'Map', value: battle.mapName, tone: 'neutral' },
  ];

  if (status === 'victory' && reward) {
    rewards.push(
      { label: 'Gold', value: `+${reward.gold}`, tone: 'gold' },
      { label: 'XP', value: `+${reward.exp}`, tone: 'blue' },
      { label: 'Gems', value: reward.rareGems ? `+${reward.rareGemsAccepted ?? reward.rareGems}` : 'None', tone: 'violet' }
    );

    if (reward.equipmentNames?.length) {
      rewards.push({ label: 'Equipment', value: reward.equipmentNames.join(', '), tone: 'green' });
    } else if (reward.equipmentRarity) {
      rewards.push({ label: 'Equipment', value: `${reward.equipmentRarity} gear`, tone: 'green' });
    }

    if (reward.itemNames?.length) {
      rewards.push({ label: 'Items', value: reward.itemNames.join(', '), tone: 'green' });
    }

    reward.questProgress?.forEach(progress => {
      rewards.push({
        label: progress.complete ? 'Quest Ready' : 'Quest',
        value: `${progress.label} ${progress.value}`,
        tone: progress.complete ? 'gold' : 'blue',
      });
    });
  }

  if (status === 'defeat') {
    rewards.push(
      { label: 'Health', value: `-${report?.healthLost ?? 0}`, tone: 'red' },
      { label: 'Reward', value: 'None', tone: 'neutral' }
    );
  }

  if (status === 'recruited') {
    const recruitedMinions = report?.recruitedMinions || battle.recruitOffer?.offeredMinions.map(getMinionStackName) || [];
    rewards.push({ label: 'Recruits', value: recruitedMinions.length ? recruitedMinions.join(', ') : 'Warband service', tone: 'green' });
  }

  const injuredMinions = report?.casualtyReport?.injuredNames || [];
  const deadMinions = report?.casualtyReport?.deadNames || [];
  if (injuredMinions.length > 0) rewards.push({ label: 'Injured', value: injuredMinions.join(', '), tone: 'red' });
  if (deadMinions.length > 0) rewards.push({ label: 'Lost', value: deadMinions.join(', '), tone: 'red' });

  emitCompletionNotice({
    id: `battle-completion-${battle.id}-${status}`,
    kind: status === 'defeat' ? 'defeat' : status === 'recruited' ? 'recruit' : 'victory',
    kicker: 'Battle Report',
    title: status === 'defeat' ? 'Defeat' : status === 'recruited' ? 'Oath Accepted' : 'Victory',
    description: status === 'defeat'
      ? `${battle.enemy.name} held the field.`
      : status === 'recruited'
        ? `${battle.enemy.name} yielded and joined your army.`
        : `${battle.enemy.name} was defeated and the field reward was claimed.`,
    rewards,
    completedAt: report?.completedAt || Date.now(),
  });
}

function BattleFloatingText({ text, tone }: { text: string; tone: 'damage' | 'heal' | 'mana' | 'neutral' }) {
  return (
    <span className={`battle-floating-text battle-floating-${tone}`}>
      {text}
    </span>
  );
}

function getBattleCueFxType(cue: BattleCue): FxEventType {
  const headline = cue.headline.toLowerCase();
  const detail = cue.detail.toLowerCase();
  if (headline.includes('heal')) return 'heal';
  if (detail.includes('casts') && cue.tone === 'player') return 'heal';
  if (detail.includes('casts') || headline.includes('arcane')) return 'spell';
  if (headline.includes('focus') || headline.includes('hold')) return 'defense';
  if (headline.includes('spell') || headline.includes('mana')) return 'spell';
  if (headline.includes('move')) return 'status';
  if (cue.tone === 'danger') return 'attack';
  if (cue.tone === 'victory') return 'victory';
  if (cue.tone === 'player') return 'defense';
  return 'status';
}

type BattleLogSoundPlan = Array<{
  id: GameSoundId;
  delayMs: number;
  throttleMs?: number;
  volumeScale?: number;
}>;

function getEnemyBattleSoundDelay(phase: 'start' | 'impact' | 'death'): number {
  if (phase === 'start') return 80;
  if (phase === 'impact') return 300;
  return 580;
}

function getBattleSoundDelay(speed: CombatSpeed, phase: 'start' | 'impact' | 'death'): number {
  if (speed === 'instant') {
    if (phase === 'start') return 0;
    if (phase === 'impact') return 70;
    return 260;
  }

  if (speed === 'fast') {
    if (phase === 'start') return 45;
    if (phase === 'impact') return 170;
    return 420;
  }

  if (phase === 'start') return 70;
  if (phase === 'impact') return 250;
  return 560;
}

function getBattleLogNumericAmount(entry: BattleLogEntry): number {
  const amountMatch =
    entry.message.match(/\b(?:for|restoring|draining|up to)\s+(\d+)\b/i) ||
    entry.message.match(/\b(\d+)\b/);
  return amountMatch ? Number.parseInt(amountMatch[1], 10) : 0;
}

function getBattleLogPrimaryTarget(battle: BattleState, entry: BattleLogEntry): BattleUnit | undefined {
  return entry.targetIds
    ?.map(targetId => battle.units.find(unit => unit.id === targetId))
    .find((unit): unit is BattleUnit => Boolean(unit));
}

function getAttackImpactSound(battle: BattleState, entry: BattleLogEntry): GameSoundId {
  const actor = entry.actorId ? battle.units.find(unit => unit.id === entry.actorId) : undefined;
  const target = getBattleLogPrimaryTarget(battle, entry);
  const amount = getBattleLogNumericAmount(entry);

  if (actor?.kind === 'commander' || amount >= 12) return 'combat.meleeHeavy';
  return 'combat.armorHit';
}

function getSpellImpactSound(entry: BattleLogEntry): GameSoundId {
  switch (entry.spellId) {
    case 'bleed':
      return 'combat.armorHit';
    case 'poison':
      return 'combat.spellShadow';
    case 'ember-dart':
      return 'combat.spellFlame';
    case 'chain-spark':
      return 'combat.spellLightning';
    case 'sanctified-mend':
    case 'soul-tether':
      return 'combat.blessing';
    case 'judgement':
    case 'rallying-hymn':
    case 'saint-king-aegis':
      return 'combat.spellHoly';
    case 'gravity-snare':
    case 'frost-lance':
    case 'time-crown-edict':
      return 'combat.spellFrost';
    case 'withering-curse':
    case 'blood-star':
    case 'eclipse-nova':
      return 'combat.spellShadow';
    case 'royal-command':
    case 'moonlit-veil':
    case 'iron-benediction':
    case 'ashen-step':
    case 'thorn-ward':
    case 'warding-prayer':
      return 'combat.blessing';
    case 'arcane-bolt':
      return 'combat.spellHit';
  }

  switch (entry.style) {
    case 'spell-support':
    case 'heal':
      return 'combat.blessing';
    case 'buff':
    case 'morale':
      return 'combat.spellBuff';
    case 'spell-drain':
      return 'combat.spellShadow';
    case 'spell-damage':
      return 'combat.spellFire';
    case 'debuff':
    case 'spell-control':
      return 'combat.spellControl';
    default:
      return 'combat.spellHit';
  }
}

function getBattleLogSoundPlan(battle: BattleState, entry: BattleLogEntry, speed: CombatSpeed): BattleLogSoundPlan {
  const enemyAction = entry.side === 'enemy';
  const startDelay = enemyAction ? getEnemyBattleSoundDelay('start') : getBattleSoundDelay(speed, 'start');
  const impactDelay = enemyAction ? getEnemyBattleSoundDelay('impact') : getBattleSoundDelay(speed, 'impact');
  const deathDelay = enemyAction ? getEnemyBattleSoundDelay('death') : getBattleSoundDelay(speed, 'death');
  const plan: BattleLogSoundPlan = [];

  if (entry.action === 'move') {
    return [{ id: 'combat.moveDust', delayMs: startDelay, throttleMs: 120, volumeScale: 0.82 }];
  }

  if (entry.action === 'attack') {
    if (entry.style === 'ranged') {
      plan.push({ id: 'combat.rangedRelease', delayMs: startDelay + 35, throttleMs: 110, volumeScale: 0.82 });
      plan.push({ id: 'combat.rangedImpact', delayMs: impactDelay, throttleMs: 110, volumeScale: 0.78 });
    } else {
      const impactSound = getAttackImpactSound(battle, entry);
      plan.push({ id: 'combat.meleeSlice', delayMs: startDelay + 40, throttleMs: 100, volumeScale: impactSound === 'combat.meleeHeavy' ? 1 : 0.94 });
      plan.push({ id: impactSound, delayMs: impactDelay, throttleMs: 100, volumeScale: 0.9 });
    }
  }

  if (entry.action === 'heal') {
    plan.push({ id: 'combat.spellCast', delayMs: startDelay + 10, throttleMs: 120, volumeScale: 0.28 });
    plan.push({ id: 'combat.blessing', delayMs: startDelay + 85, throttleMs: 120, volumeScale: 0.78 });
  }

  if (entry.action === 'spell' && (entry.style === 'bleed' || entry.style === 'poison')) {
    plan.push({
      id: entry.style === 'bleed' ? 'combat.armorHit' : 'combat.spellShadow',
      delayMs: impactDelay,
      throttleMs: 160,
      volumeScale: 0.58,
    });
  } else if (entry.action === 'spell') {
    plan.push({ id: 'combat.spellCast', delayMs: startDelay, throttleMs: 140, volumeScale: 0.75 });
    const impactSound = getSpellImpactSound(entry);
    const isBlessingImpact = impactSound === 'combat.blessing';
    plan.push({
      id: impactSound,
      delayMs: isBlessingImpact ? startDelay + 90 : impactDelay + 70,
      throttleMs: 140,
      volumeScale: isBlessingImpact ? 0.76 : undefined,
    });
  }

  if (entry.action === 'mana') {
    plan.push({ id: 'combat.manaFocus', delayMs: impactDelay, throttleMs: 160 });
  }

  if (entry.action === 'morale') {
    plan.push({ id: 'combat.spellBuff', delayMs: impactDelay, throttleMs: 180, volumeScale: 0.72 });
  }

  if (entry.action === 'wait' && entry.style === 'buff') {
    plan.push({ id: 'combat.spellCast', delayMs: startDelay + 10, throttleMs: 130, volumeScale: 0.24 });
    plan.push({ id: 'combat.blessing', delayMs: startDelay + 80, throttleMs: 130, volumeScale: 0.72 });
  } else if (entry.action === 'wait') {
    plan.push({ id: 'combat.wait', delayMs: startDelay, throttleMs: 120, volumeScale: 0.68 });
  }

  if ((entry.action === 'attack' || entry.action === 'spell') && hasDefeatedLogTarget(battle, entry)) {
    plan.push({ id: 'combat.unitDeath', delayMs: deathDelay + 80, throttleMs: 220, volumeScale: 0.92 });
  }

  return plan;
}

function getBattleHoverForecast({
  battle,
  activeUnit,
  hoveredCell,
  isPlayerTurn,
  selectedSpell,
  isResolvingAction,
  movementLocked = false,
  movementAnimating = false,
}: {
  battle: BattleState;
  activeUnit?: BattleUnit;
  hoveredCell: { x: number; y: number } | null;
  isPlayerTurn: boolean;
  selectedSpell?: BattleSpell;
  isResolvingAction: boolean;
  movementLocked?: boolean;
  movementAnimating?: boolean;
}): BattleHoverForecastData | null {
  if (!hoveredCell) return null;

  const unitAtCell = getUnitAt(battle, hoveredCell.x, hoveredCell.y);
  if (!unitAtCell) return null;

  const baseForecast: BattleHoverForecastData = {
    unit: unitAtCell,
    tone: unitAtCell.side === 'player' ? 'good' : 'danger',
    currentHealth: unitAtCell.currentHealth,
    projectedHealth: unitAtCell.currentHealth,
    maxHealth: unitAtCell.maxHealth,
  };

  if (battle.status !== 'active' || isResolvingAction || movementAnimating || !isPlayerTurn || !activeUnit) {
    return baseForecast;
  }

  if (selectedSpell) {
    const validTarget =
      (selectedSpell.target === 'enemy' && unitAtCell.side !== activeUnit.side) ||
      (selectedSpell.target === 'ally' && unitAtCell.side === activeUnit.side);

    if (!validTarget) return baseForecast;

    const spellForecast = getSelectedSpellForecast(activeUnit, selectedSpell, unitAtCell);
    return {
      ...baseForecast,
      ...spellForecast,
      actionLabel: spellForecast.actionLabel || selectedSpell.name,
    };
  }

  if (!movementLocked && canAttack(activeUnit, unitAtCell)) {
    const damage = getAttackDamage(activeUnit, unitAtCell, battle);
    const projectedHealth = Math.max(0, unitAtCell.currentHealth - damage);
    const defenderAfterHit = { ...unitAtCell, currentHealth: projectedHealth };
    const retaliationDamage = canRetaliateAfterAttack(battle, activeUnit, defenderAfterHit)
      ? getRetaliationDamage(battle, activeUnit, defenderAfterHit)
      : 0;
    return {
      ...baseForecast,
      actionLabel: activeUnit.range > 1 ? 'Ranged damage' : 'Melee damage',
      amount: Math.min(unitAtCell.currentHealth, damage),
      projectedHealth,
      retaliationDamage: retaliationDamage || undefined,
      retaliationCurrentHealth: retaliationDamage ? activeUnit.currentHealth : undefined,
      retaliationProjectedHealth: retaliationDamage ? Math.max(0, activeUnit.currentHealth - retaliationDamage) : undefined,
      retaliationMaxHealth: retaliationDamage ? activeUnit.maxHealth : undefined,
      tone: 'danger',
    };
  }

  if (canHeal(activeUnit, unitAtCell)) {
    const healing = getHealAmount(activeUnit, unitAtCell, battle);
    return {
      ...baseForecast,
      actionLabel: 'Heal',
      amount: healing,
      projectedHealth: Math.min(unitAtCell.maxHealth, unitAtCell.currentHealth + healing),
      tone: 'good',
    };
  }

  return baseForecast;
}

function getSelectedSpellForecast(
  caster: BattleUnit,
  spell: BattleSpell,
  target: BattleUnit
): Partial<BattleHoverForecastData> {
  const spellPower = caster.magic;
  const damageBySpell: Record<string, number> = {
    'ember-dart': 7 + spellPower * 2,
    'arcane-bolt': 12 + spellPower * 2,
    'withering-curse': 8 + spellPower,
    'gravity-snare': 7 + spellPower,
    judgement: 18 + spellPower * 2,
    'blood-star': 14 + spellPower * 2,
    'frost-lance': 10 + spellPower * 2,
  };
  const healingBySpell: Record<string, number> = {
    'sanctified-mend': 18 + spellPower * 2,
    'thorn-ward': 8 + spellPower,
    'warding-prayer': 7 + spellPower,
    'soul-tether': 20 + spellPower * 2,
  };

  const damage = damageBySpell[spell.id];
  if (typeof damage === 'number') {
    return {
      actionLabel: spell.name,
      amount: Math.min(target.currentHealth, damage),
      projectedHealth: Math.max(0, target.currentHealth - damage),
      tone: 'danger',
    };
  }

  const healing = healingBySpell[spell.id];
  if (typeof healing === 'number') {
    return {
      actionLabel: spell.name,
      amount: Math.min(target.maxHealth - target.currentHealth, healing),
      projectedHealth: Math.min(target.maxHealth, target.currentHealth + healing),
      tone: 'good',
    };
  }

  return {
    actionLabel: spell.name,
    tone: spell.target === 'ally' ? 'good' : 'danger',
  };
}

function getBattleHoverPreview({
  battle,
  activeUnit,
  hoveredCell,
  isPlayerTurn,
  selectedSpell,
  isResolvingAction,
  movementLocked = false,
  movementAnimating = false,
}: {
  battle: BattleState;
  activeUnit?: BattleUnit;
  hoveredCell: { x: number; y: number } | null;
  isPlayerTurn: boolean;
  selectedSpell?: BattleSpell;
  isResolvingAction: boolean;
  movementLocked?: boolean;
  movementAnimating?: boolean;
}): BattleHoverPreviewData {
  if (battle.status !== 'active') {
    return { title: 'Battle Ended', detail: '', tone: 'neutral' };
  }

  if (isResolvingAction || movementAnimating) {
    return { title: 'Resolving', detail: '', tone: 'neutral' };
  }

  if (!activeUnit) {
    return { title: 'No Active Unit', detail: '', tone: 'neutral' };
  }

  if (!hoveredCell) {
    return {
      title: activeUnit.name,
      detail: '',
      tone: activeUnit.side === 'player' ? 'good' : 'danger',
    };
  }

  if (isObstacle(battle, hoveredCell.x, hoveredCell.y)) {
    return { title: 'Blocked', detail: '', tone: 'neutral' };
  }

  const unitAtCell = getUnitAt(battle, hoveredCell.x, hoveredCell.y);
  const bonusMoveActive = isBonusMovePending(battle, activeUnit);
  if (unitAtCell) {
    if (bonusMoveActive) {
      return {
        title: 'Step Away',
        detail: 'Choose an empty retreat cell after the strike, or wait to hold position.',
        tone: 'neutral',
      };
    }

    if (selectedSpell) {
      const validTarget =
        (selectedSpell.target === 'enemy' && unitAtCell.side !== activeUnit.side) ||
        (selectedSpell.target === 'ally' && unitAtCell.side === activeUnit.side);
      return {
        title: validTarget ? selectedSpell.name : 'Wrong Target',
        detail: '',
        tone: validTarget && selectedSpell.target === 'ally' ? 'good' : validTarget ? 'danger' : 'neutral',
      };
    }

    if (isPlayerTurn && activeUnit.kind === 'commander' && unitAtCell.id === activeUnit.id) {
      return {
        title: 'King Spells',
        detail: '',
        tone: 'good',
      };
    }

    if (isPlayerTurn && canHeal(activeUnit, unitAtCell)) {
      return {
        title: 'Healing',
        detail: '',
        tone: 'good',
      };
    }

    if (isPlayerTurn && canAttack(activeUnit, unitAtCell)) {
      return {
        title: 'Strike',
        detail: '',
        tone: 'danger',
      };
    }

    return {
      title: unitAtCell.name,
      detail: '',
      tone: unitAtCell.side === 'player' ? 'good' : 'danger',
    };
  }

  if (bonusMoveActive) {
    return canBonusMoveTo(battle, activeUnit, hoveredCell.x, hoveredCell.y)
      ? { title: 'Step Away', detail: 'Use the retreat move to leave melee pressure.', tone: 'good' }
      : { title: 'No Step', detail: 'Pick a valid empty retreat cell, or wait to hold position.', tone: 'neutral' };
  }

  if (isPlayerTurn && !movementLocked && !movementAnimating && canMoveTo(battle, activeUnit, hoveredCell.x, hoveredCell.y)) {
    return {
      title: 'Move',
      detail: '',
      tone: 'good',
    };
  }

  if (isPlayerTurn && movementLocked && !unitAtCell) {
    return {
      title: 'Move Pending',
      detail: '',
      tone: 'neutral',
    };
  }

  return { title: '', detail: '', tone: 'neutral' };
}

function getDefaultBattleCue({
  battle,
  activeUnit,
  isPlayerTurn,
  isCommanderTurn,
  selectedSpell,
  recruitOfferPending,
}: {
  battle: BattleState;
  activeUnit?: BattleUnit;
  isPlayerTurn: boolean;
  isCommanderTurn: boolean;
  selectedSpell?: BattleSpell;
  recruitOfferPending: boolean;
}): BattleCue {
  if (recruitOfferPending) {
    return {
      headline: 'Surrender Offer',
      detail: '',
      tone: 'victory',
    };
  }

  if (battle.status === 'victory') {
    return { headline: 'Victory', detail: '', tone: 'victory' };
  }

  if (battle.status === 'defeat') {
    return { headline: 'Defeat', detail: '', tone: 'danger' };
  }

  if (battle.status === 'recruited') {
    return { headline: 'Recruited', detail: '', tone: 'victory' };
  }

  if (!activeUnit) {
    return { headline: 'Resolving', detail: '', tone: 'neutral' };
  }

  if (!isPlayerTurn) {
    return { headline: 'Enemy Turn', detail: '', tone: 'enemy' };
  }

  if (selectedSpell) {
    return {
      headline: 'Choose Target',
      detail: '',
      tone: selectedSpell.target === 'ally' ? 'player' : 'danger',
    };
  }

  if (isCommanderTurn) {
    return {
      headline: 'Your Commander',
      detail: '',
      tone: 'player',
    };
  }

  return {
    headline: 'Your Turn',
    detail: '',
    tone: 'player',
  };
}

function applyBattleCasualties(battle: BattleState): MinionCasualtyReport {
  const deadRosterIds = battle.units
    .filter(unit => unit.side === 'player' && unit.kind === 'minion' && unit.currentHealth <= 0 && unit.rosterId)
    .map(unit => unit.rosterId as string)
    .filter(rosterId => !rosterId.startsWith('loaned-'));

  return applyMinionBattleCasualties(deadRosterIds, battle.enemy.name);
}

function getFallenPlayerMinions(battle: BattleState): string[] {
  return battle.units
    .filter(unit => unit.side === 'player' && unit.kind === 'minion' && unit.currentHealth <= 0 && unit.rosterId)
    .filter(unit => !unit.rosterId?.startsWith('loaned-'))
    .map(unit => unit.name);
}

function getMinionStackName(minion: MinionStack): string {
  return getMinionTemplate(minion.templateId)?.name || minion.templateId;
}

function getVictoryReward(enemy: WorldEnemy): { gold: number; exp: number; rareGems?: number; equipmentRarity?: EquipmentRarity } {
  const dungeonReward = enemy.id.startsWith('dungeon-');
  const nearbyReward = enemy.spawnKind === 'nearby';
  const lootMultiplier = enemy.lootMultiplier || 1;
  const baseGold = (dungeonReward ? 45 : nearbyReward ? 34 : 20) + enemy.level * (dungeonReward ? 8 : nearbyReward ? 6 : 4);
  const baseExp = (dungeonReward ? 10 : nearbyReward ? 8 : 5) + enemy.level * (dungeonReward ? 2.5 : nearbyReward ? 2 : 1.5);

  return {
    gold: Math.round(baseGold * lootMultiplier),
    exp: Math.round(baseExp * lootMultiplier),
    rareGems: dungeonReward
      ? Math.max(1, Math.floor(enemy.level / 5))
      : nearbyReward && enemy.level >= 3
        ? 1
        : undefined,
    equipmentRarity: dungeonReward
      ? enemy.level >= 14
        ? 'legendary'
        : enemy.level >= 9
          ? 'epic'
          : 'rare'
      : nearbyReward
        ? enemy.level >= 10
          ? 'rare'
          : 'decent'
      : undefined,
  };
}

function getBattleQuestSnapshots(user: User): QuestProgressLine[] {
  const cityLines = (user.cityQuests || [])
    .filter(progress => !progress.claimed)
    .map(progress => {
      const quest = getCityQuestTemplate(progress.questId);
      if (!quest || quest.requirement.type !== 'win_battles') return null;
      const status = getCityQuestStatus(user, progress.questId);

      return {
        id: `city-${progress.questId}`,
        label: quest.name,
        value: `${status.progress}/${status.required}`,
        complete: status.complete,
      };
    })
    .filter((line): line is QuestProgressLine => Boolean(line));

  const storyLines = STORY_CHAPTERS
    .flatMap(chapter => chapter.quests)
    .filter(quest => quest.requirement.type === 'win_battles' || quest.requirement.type === 'defeat_boss')
    .map(quest => {
      const status = getStoryQuestStatus(user, quest.id);
      if (status.claimed || !status.unlocked) return null;

      return {
        id: `story-${quest.id}`,
        label: quest.name,
        value: `${status.progress}/${status.required}`,
        complete: status.complete,
      };
    })
    .filter((line): line is QuestProgressLine => Boolean(line));

  return [...cityLines, ...storyLines];
}

function getBattleQuestProgressDeltas(before: QuestProgressLine[], after: QuestProgressLine[]): QuestProgressLine[] {
  const beforeById = new Map(before.map(line => [line.id, line]));

  return after.filter(line => {
    const previous = beforeById.get(line.id);
    return !previous || previous.value !== line.value || previous.complete !== line.complete;
  });
}

function applyVictoryReward(enemy: WorldEnemy): VictoryRewardReport | null {
  const user = getCurrentUser();
  if (!user) return null;

  const questProgressBefore = getBattleQuestSnapshots(user);
  const reward = getVictoryReward(enemy);
  const completedAt = Date.now();
  const rewardEquipment = reward.equipmentRarity
    ? [generateEquipment(0, reward.equipmentRarity)].filter(Boolean) as Equipment[]
    : [];
  const rewardItems: InventoryItem[] = [
    ...(reward.rareGems ? [makeInventoryItem('rare-gem', reward.rareGems)] : []),
    ...rollInventoryBonusDrops(
      enemy.level,
      enemy.id.startsWith('dungeon-')
        ? 'dungeon'
        : enemy.spawnKind === 'nearby'
          ? 'nearbyBattle'
          : 'battle'
    ),
  ];
  const inventorySlots = user.inventorySlots || 20;
  const itemAddResult = addInventoryItemsWithLimit(user.inventory || [], rewardItems, inventorySlots);
  const gearAddResult = addEquipmentWithLimit(
    user.equipment || [],
    user.equippedSlots || {},
    rewardEquipment,
    inventorySlots,
  );
  const acceptedItems = itemAddResult.acceptedItems;
  const acceptedEquipment = gearAddResult.acceptedEquipment;
  const acceptedRareGems = acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);

  const battleActivity: ActivityEntry = {
    id: `activity-battle-${enemy.id}-${completedAt}`,
    type: 'battle',
    title: gearAddResult.rejectedEquipment.length > 0 ? `Defeated ${enemy.name} (gear storage full)` : `Defeated ${enemy.name}`,
    source: enemy.id.startsWith('dungeon-') ? 'Dungeon Battle' : 'Battle',
    completedAt,
    battleLevel: enemy.level,
    description: enemy.bossId ? `boss:${enemy.bossId}` : undefined,
    rewards: {
      gold: reward.gold,
      exp: reward.exp,
      rareGems: acceptedRareGems || undefined,
      items: acceptedItems.length > 0 ? acceptedItems : undefined,
      equipment: acceptedEquipment.length > 0 ? acceptedEquipment : undefined,
    },
  };
  const rareGemsAccepted = acceptedRareGems || undefined;

  const nextUser: User = {
    ...user,
    gold: user.gold + reward.gold,
    exp: user.exp + reward.exp,
    inventory: itemAddResult.inventory,
    equipment: gearAddResult.equipment,
    activityLog: [battleActivity, ...(user.activityLog || [])].slice(0, 30),
  };
  const questProgress = getBattleQuestProgressDeltas(questProgressBefore, getBattleQuestSnapshots(nextUser));

  updateCurrentUser(nextUser);

  const pvpOpponent = getPvpOpponentUsername(enemy);
  if (pvpOpponent) {
    recordPvpDuelOutcome(user.username, pvpOpponent);
  }

  return {
    ...reward,
    rareGemsAccepted,
    equipmentNames: acceptedEquipment.map(item => item.name),
    itemNames: acceptedItems.map(item => item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name),
    questProgress,
    inventoryFull: itemAddResult.rejectedItems.length > 0,
  };
}

function applyDefeatPenalty(enemy: WorldEnemy): number {
  const user = getCurrentUser();
  if (!user) return 0;

  const penalty = Math.min(20 + enemy.level * 2, Math.max(0, user.stats.health - 1));

  updateCurrentUser({
    stats: {
      ...user.stats,
      health: Math.max(1, user.stats.health - penalty),
    },
  });

  const pvpOpponent = getPvpOpponentUsername(enemy);
  if (pvpOpponent) {
    recordPvpDuelOutcome(pvpOpponent, user.username);
  }

  return penalty;
}

function getPvpOpponentUsername(enemy: WorldEnemy): string | null {
  if (!enemy.id.startsWith('pvp-')) return null;
  const name = enemy.name?.trim();
  return name || null;
}
