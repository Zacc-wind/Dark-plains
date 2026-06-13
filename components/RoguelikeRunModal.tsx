'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import BattleModal from './BattleModal';
import {
  BATTLE_SPELLS,
  BoardCell,
  BattleState,
  EnemyAiPersonality,
  PlayerModelNumber,
  WorldEnemy,
  getPlayerModelAsset,
} from '@/lib/battle';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import { emitFxEvent } from '@/lib/fxEvents';
import {
  ActivityEntry,
  CharacterStats,
  type DailyRunChallenge,
  Equipment,
  EquipmentRarity,
  InventoryItem,
  MAX_FIELD_MINIONS,
  MINION_CLASS_LABELS,
  MINION_TEMPLATES,
  MINION_TIER_LABELS,
  MinionStack,
  MinionTemplate,
  User,
  addInventoryItemsWithLimit,
  generateEquipment,
  getCurrentUser,
  getDailyRunChallenge,
  getDailyRunStatus,
  getNextDailyRunStreak,
  getFieldedMinions,
  getMinionTemplate,
  hasCompletedDailyRunToday,
  levelUp,
  makeInventoryItem,
  recordDailyRunCompletionState,
  rollInventoryBonusDrops,
  updateCurrentUser,
} from '@/lib/auth';
import {
  WorldDungeon,
  formatDungeonTimeRemaining,
  getRegionForTile,
} from '@/lib/worldEvents';
import { readGameJson, removeGameStorageItem, writeGameJson } from '@/lib/gameStore';
import { getBossProfileById } from '@/lib/bosses';

type RunMode = 'daily' | 'dungeon';
export type RunPhase = 'draft' | 'map' | 'formation' | 'battle' | 'reward' | 'shop' | 'event' | 'complete';
type RunOutcome = 'victory' | 'defeat' | 'abandoned' | null;
type RewardDestination = 'daily-next' | 'dungeon-next' | 'complete' | null;
type DungeonNodeType = 'battle' | 'elite' | 'shop' | 'event' | 'boss';

interface RunUnit {
  stack: MinionStack;
  alive: boolean;
  origin: 'draft' | 'roster' | 'reward' | 'loaned';
}

interface RunBattleUnitReport {
  id: string;
  name: string;
  assetPath: string;
  side: 'player' | 'enemy';
  alive: boolean;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
}

interface RunBattleReport {
  id: string;
  enemyName: string;
  enemyAssetPath: string;
  enemyLevel: number;
  enemyPersonality: EnemyAiPersonality;
  status: BattleEndResult['status'];
  round: number;
  durationMs: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  unitReports: RunBattleUnitReport[];
}

interface DungeonNode {
  id: string;
  type: DungeonNodeType;
  label: string;
  description: string;
  iconPath: string;
  level: number;
  completed: boolean;
  row?: number;
  lane?: number;
  nextIds?: string[];
  battleNumber?: number;
}

interface DungeonNodeSpec {
  type: DungeonNodeType;
  label: string;
  description?: string;
}

interface RunSession {
  id: string;
  mode: RunMode;
  title: string;
  phase: RunPhase;
  stats: CharacterStats;
  minions: RunUnit[];
  draftChoices: MinionTemplate[];
  wins: number;
  targetBattles: number;
  runGold: number;
  activeEnemy: WorldEnemy | null;
  formation: Record<string, BoardCell>;
  spellIds: string[];
  rewardChoices: RunRewardChoice[];
  rewardDestination: RewardDestination;
  nodes: DungeonNode[];
  currentNodeIndex: number;
  battleReports: RunBattleReport[];
  outcome: RunOutcome;
  dailyChallenge?: DailyRunChallenge;
  dungeon?: WorldDungeon;
  notice?: string;
  rewardClaimed?: boolean;
}

type StoredRunSession = Omit<RunSession, 'rewardChoices'> & {
  rewardChoiceIds: string[];
  savedAt: number;
  ownerUsername: string;
  dateKey: string;
};

const DUNGEON_NODE_ICONS: Record<DungeonNodeType, string> = {
  battle: '/assets/icons/attack.png',
  elite: '/assets/icons/defense.png',
  shop: '/assets/icons/gold.png',
  event: '/assets/icons/magic.png',
  boss: '/assets/icons/loot-chest.png',
};

const DUNGEON_LAYOUTS: Record<string, DungeonNodeSpec[]> = {
  'ossuary-cellar': [
    { type: 'battle', label: 'Bone Gate', description: 'The cellar mouth is held by candle-fed skeleton guards.' },
    { type: 'event', label: 'Ash Font', description: 'A black font may bless the faithful or bite the careless.' },
    { type: 'shop', label: 'Mourner Trader', description: 'A veiled trader sells quick blessings for run gold.' },
    { type: 'battle', label: 'Candle Hall', description: 'Tight aisles force a close fight under bone chandeliers.' },
    { type: 'elite', label: 'Reliquary Watch', description: 'An elite keeper guards the door to the boss crypt.' },
    { type: 'boss', label: 'Ossuary Candlekeeper' },
  ],
  'moonwell-descent': [
    { type: 'battle', label: 'Well Steps', description: 'Mist defenders wait on slick stone stairs.' },
    { type: 'event', label: 'Silver Pool', description: 'Moon water reflects a possible blessing or wound.' },
    { type: 'battle', label: 'Mirror Landing', description: 'A second guard group blocks the old landing.' },
    { type: 'shop', label: 'Lantern Peddler', description: 'A lantern seller trades run gold for warded charms.' },
    { type: 'elite', label: 'Oath Diver', description: 'A hard guard rises from the waterline.' },
    { type: 'boss', label: 'Moonwell Binder' },
  ],
  'blackroot-shrine': [
    { type: 'battle', label: 'Root Threshold', description: 'Thorn-bound soldiers defend the shrine path.' },
    { type: 'event', label: 'Bell Roots', description: 'Root bells hum with a risky reward.' },
    { type: 'elite', label: 'Saint Mask Guard', description: 'A masked elite blocks the inner grove.' },
    { type: 'shop', label: 'Thorn Hermit', description: 'A hermit offers bitter blessings before the boss.' },
    { type: 'battle', label: 'Buried Chapel', description: 'Another patrol holds the buried nave.' },
    { type: 'boss', label: 'Root-Saint Heretic' },
  ],
  'drowned-reliquary': [
    { type: 'battle', label: 'Flooded Nave', description: 'Waterlogged guards advance through broken pews.' },
    { type: 'event', label: 'Coin Water', description: 'The dark pool may pay out or demand blood.' },
    { type: 'shop', label: 'Wet Relic Broker', description: 'A broker sells dry charms above the black water.' },
    { type: 'elite', label: 'Drowned Warden', description: 'An elite shieldman holds the reliquary chain.' },
    { type: 'battle', label: 'Icon Steps', description: 'A last guard line protects the relic vault.' },
    { type: 'boss', label: 'Drowned Relic Warden' },
  ],
  'blue-flame-vault': [
    { type: 'battle', label: 'Cold Fire Gate', description: 'Blue-lit apprentices test your front line.' },
    { type: 'event', label: 'Spell Ash Bowl', description: 'The bowl can empower spells or scorch a unit.' },
    { type: 'elite', label: 'Vault Sentinel', description: 'A stronger spell guard protects the inner lock.' },
    { type: 'shop', label: 'Inkless Scribe', description: 'The scribe sells temporary spell wards.' },
    { type: 'battle', label: 'Burning Library', description: 'A final skirmish breaks out between book stacks.' },
    { type: 'event', label: 'Arcane Crack', description: 'Raw magic offers one more risky boon.' },
    { type: 'boss', label: 'Blue Flame Magus' },
  ],
  'saintless-tower': [
    { type: 'battle', label: 'Lower Court', description: 'Tower bailiffs try to hold the first floor.' },
    { type: 'event', label: 'Judgment Bell', description: 'The bell grants a sentence, not always a kind one.' },
    { type: 'elite', label: 'Trial Captain', description: 'An elite captain guards the court stair.' },
    { type: 'shop', label: 'Sentence Broker', description: 'A broker sells illegal mercy for run gold.' },
    { type: 'battle', label: 'High Gallery', description: 'Ranged guards fire across a narrow gallery.' },
    { type: 'event', label: 'Empty Jury', description: 'The empty jury may revive, wound, or enrich you.' },
    { type: 'boss', label: 'Saintless Adjudicator' },
  ],
  'iron-choir-pit': [
    { type: 'battle', label: 'Chanting Yard', description: 'Armored chanters push forward in formation.' },
    { type: 'event', label: 'Cracked Bell', description: 'A cracked bell can raise morale or break resolve.' },
    { type: 'elite', label: 'Pit Marshal', description: 'An elite war-chanter blocks the lower pit.' },
    { type: 'shop', label: 'Anvil Friar', description: 'A friar sells iron blessings between fights.' },
    { type: 'battle', label: 'Chain Floor', description: 'A brutal patrol holds the chain floor.' },
    { type: 'event', label: 'Choir Echo', description: 'The echo chooses a reward or a wound.' },
    { type: 'boss', label: 'Iron Choir Marshal' },
  ],
  'warlord-sepulcher': [
    { type: 'battle', label: 'War Tomb Gate', description: 'Champion guards defend the sealed tomb road.' },
    { type: 'event', label: 'Banner Dust', description: 'Old banner dust may empower the army or poison it.' },
    { type: 'elite', label: 'Sepulcher Captain', description: 'A deadly elite protects the command hall.' },
    { type: 'shop', label: 'Grave Quartermaster', description: 'The quartermaster trades last supplies before the end.' },
    { type: 'battle', label: 'Command Crypt', description: 'The last guard line fights under cracked banners.' },
    { type: 'event', label: 'Broken Crown', description: 'A final omen gives one last risk before the warlord.' },
    { type: 'boss', label: 'Sepulcher Warlord' },
  ],
};

interface RunRewardChoice {
  id: string;
  name: string;
  description: string;
  apply: (session: RunSession) => RunSession;
  isAvailable?: (session: RunSession) => boolean;
}

interface BattleEndResult {
  status: 'victory' | 'defeat' | 'recruited';
  battle: BattleState;
}

interface DailyRunModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DungeonRunModalProps {
  dungeon: WorldDungeon;
  currentUser: ReturnType<typeof getCurrentUser>;
  now: number;
  onClose: () => void;
}

const MINION_ICON_BASE = '/assets/minions';
const RUN_EVENT_LABELS = ['Pool', 'Shrine', 'Cache', 'Ambush'];
const DAILY_RUN_SESSION_PREFIX = 'pirate_game_daily_run_session';
const RUN_REWARD_CHOICE_COUNT = 2;
const RUN_SHOP_CHOICE_COUNT = 4;

const RUN_BUFFS: RunRewardChoice[] = [
  makeStatBuff('army-drill', 'Army Drill', '+2 Army Power for this run.', { armyPower: 2 }),
  makeStatBuff('weapon-rites', 'Weapon Rites', '+4 Army Power for this run.', { armyPower: 4 }),
  makeStatBuff('iron-ward', 'Iron Ward', '+2 Defensive Power for this run.', { defensivePower: 2 }),
  makeStatBuff('relic-armor', 'Relic Armor', '+4 Defensive Power for this run.', { defensivePower: 4 }),
  makeStatBuff('candle-liturgy', 'Candle Liturgy', '+2 Spell Power for this run.', { spellPower: 2 }),
  makeStatBuff('moonwell-focus', 'Moonwell Focus', '+4 Spell Power for this run.', { spellPower: 4 }),
  makeStatBuff('banner-song', 'Banner Song', '+2 Morale for this run.', { morale: 2 }),
  makeStatBuff('war-chorus', 'War Chorus', '+4 Morale for this run.', { morale: 4 }),
  makeStatBuff('blooded-constitution', 'Blooded Constitution', '+20 commander health for this run.', { maxHealth: 20, health: 20 }),
  makeStatBuff('saint-bone-vigor', 'Saint-Bone Vigor', '+35 commander health for this run.', { maxHealth: 35, health: 35 }),
  makeStatBuff('balanced-training', 'Balanced Training', '+1 to every run stat.', { armyPower: 1, defensivePower: 1, morale: 1, spellPower: 1, maxHealth: 10, health: 10 }),
  makeStatBuff('oath-captain', 'Oath Captain', '+2 to Army, Ward, Morale, and Spell.', { armyPower: 2, defensivePower: 2, morale: 2, spellPower: 2 }),
  {
    id: 'resurrect-one',
    name: 'Mercy Candle',
    description: 'Resurrect one fallen minion for this run.',
    isAvailable: hasFallenMinions,
    apply: session => resurrectMinions(session, 1),
  },
  {
    id: 'resurrect-two',
    name: 'Twin Bell Mercy',
    description: 'Resurrect up to two fallen minions for this run.',
    isAvailable: hasFallenMinions,
    apply: session => resurrectMinions(session, 2),
  },
  {
    id: 'resurrect-all',
    name: 'Reliquary Reprieve',
    description: 'Resurrect every fallen minion for this run.',
    isAvailable: hasFallenMinions,
    apply: resurrectAllMinions,
  },
  {
    id: 'recruit-tier1',
    name: 'Lost Recruit',
    description: 'A tier I minion joins the run.',
    isAvailable: canAddRunMinion,
    apply: session => addRandomRunMinion(session, 'tier1'),
  },
  {
    id: 'recruit-tier2',
    name: 'Road Veteran',
    description: 'A tier II minion joins the run.',
    isAvailable: canAddRunMinion,
    apply: session => addRandomRunMinion(session, 'tier2'),
  },
  {
    id: 'recruit-tier3',
    name: 'Grim Champion',
    description: 'A tier III minion joins the run.',
    isAvailable: canAddRunMinion,
    apply: session => addRandomRunMinion(session, 'tier3'),
  },
  {
    id: 'upgrade-random',
    name: 'Field Promotion',
    description: 'Upgrade one living minion to the next tier.',
    isAvailable: hasUpgradeableMinion,
    apply: upgradeRandomMinion,
  },
  {
    id: 'run-gold',
    name: 'Black Coin Cache',
    description: '+60 run gold for run shops.',
    apply: session => ({ ...session, runGold: session.runGold + 60, notice: 'Found 60 run gold.' }),
  },
];

export function DailyRunModal({ isOpen, onClose }: DailyRunModalProps) {
  if (!isOpen) return null;

  return <DailyRunModalContent onClose={onClose} />;
}

function DailyRunModalContent({ onClose }: { onClose: () => void }) {
  const [session, setSession] = useState<RunSession | null>(() => {
    const user = getCurrentUser();
    if (user && getDailyRunStatus(user).completedToday) return null;
    if (!user) return null;

    const challenge = getDailyRunChallenge();
    return loadDailyRunSession(user, challenge) || createDailySession(user, challenge);
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;

    if (!session || session.rewardClaimed || getDailyRunStatus(user).completedToday) {
      clearDailyRunSession(user.username, getDailyRunChallenge().date);
      return;
    }

    if (session.mode === 'daily') {
      saveDailyRunSession(user.username, session);
    }
  }, [session]);

  if (!session) {
    return (
      <div className="run-modal-layer fixed inset-0 z-[68] flex items-center justify-center bg-black/76 p-4 text-zinc-100 backdrop-blur-sm">
        <section className="run-modal-panel command-panel vine-frame w-full max-w-md rounded border p-5 text-center">
          <div className="arcane-label">Daily Run</div>
          <h2 className="fantasy-heading text-2xl">Already Claimed Today</h2>
          <p className="ui-muted mt-2 text-sm font-bold">The daily reward is locked until tomorrow.</p>
          <button onClick={onClose} className="ui-button-primary mt-5 rounded px-4 py-2 text-sm font-bold">
            Close
          </button>
        </section>
      </div>
    );
  }

  return (
    <RunController
      session={session}
      setSession={setSession}
      onClose={onClose}
    />
  );
}

export function DungeonRunModal({ dungeon, currentUser, now, onClose }: DungeonRunModalProps) {
  const [session, setSession] = useState<RunSession | null>(() => currentUser ? createDungeonSession(currentUser, dungeon) : null);
  const region = getRegionForTile(dungeon.x, dungeon.y);

  if (!session) return null;

  return (
    <RunController
      session={session}
      setSession={setSession}
      onClose={onClose}
      kicker={`${region.name} - expires in ${formatDungeonTimeRemaining(dungeon.expiresAt, now)}`}
    />
  );
}

function RunController({
  session,
  setSession,
  onClose,
  kicker,
}: {
  session: RunSession;
  setSession: (updater: RunSession | ((current: RunSession | null) => RunSession | null)) => void;
  onClose: () => void;
  kicker?: string;
}) {
  const aliveStacks = getAliveRunStacks(session);
  const previousPhaseRef = useRef<RunPhase | null>(null);
  const completionIntroTimeoutRef = useRef<number | null>(null);
  const [showCompletionIntro, setShowCompletionIntro] = useState(false);
  const [runStatsOpen, setRunStatsOpen] = useState(false);
  const isFormationPhase = session.phase === 'formation';
  const isMapPhase = session.phase === 'map';

  useEffect(() => {
    if (previousPhaseRef.current === session.phase) return;
    previousPhaseRef.current = session.phase;

    if (session.phase === 'draft') {
      emitFxEvent({ type: 'daily', tone: 'blue', intensity: 0.58 });
    } else if (session.phase === 'map') {
      emitFxEvent({ type: session.mode === 'dungeon' ? 'dungeon' : 'daily', tone: session.mode === 'dungeon' ? 'violet' : 'blue', intensity: 0.5 });
    } else if (session.phase === 'formation') {
      emitFxEvent({ type: 'defense', tone: 'blue', intensity: 0.48 });
    } else if (session.phase === 'battle') {
      emitFxEvent({ type: 'attack', tone: 'red', intensity: 0.62 });
    } else if (session.phase === 'reward') {
      emitFxEvent({ type: 'victory', tone: 'gold', intensity: 0.78 });
    } else if (session.phase === 'shop') {
      emitFxEvent({ type: 'city', tone: 'gold', intensity: 0.58 });
    } else if (session.phase === 'event') {
      emitFxEvent({ type: 'status', tone: 'violet', intensity: 0.58 });
    } else if (session.phase === 'complete') {
      emitFxEvent({ type: session.outcome === 'defeat' ? 'defeat' : 'run', tone: session.outcome === 'defeat' ? 'red' : 'gold', intensity: 0.98 });
    }
  }, [session.mode, session.outcome, session.phase]);

  useEffect(() => () => {
    if (completionIntroTimeoutRef.current) window.clearTimeout(completionIntroTimeoutRef.current);
  }, []);

  const triggerCompletionIntro = () => {
    if (completionIntroTimeoutRef.current) window.clearTimeout(completionIntroTimeoutRef.current);
    setShowCompletionIntro(true);
    completionIntroTimeoutRef.current = window.setTimeout(() => {
      setShowCompletionIntro(false);
      completionIntroTimeoutRef.current = null;
    }, 1600);
  };

  const handleBattleEnd = (result: BattleEndResult) => {
    if (result.status !== 'victory') triggerCompletionIntro();

    setSession(current => {
      if (!current || current.activeEnemy?.id !== result.battle.enemy.id) return current;

      const withBattleHealth = persistRunBattleHealth(current, result.battle);
      const withLosses = appendRunBattleReport(
        applyBattleLossesToRun(withBattleHealth, result.battle),
        createRunBattleReport(result.battle, result.status)
      );
      if (result.status !== 'victory') {
        return {
          ...withLosses,
          phase: 'complete',
          activeEnemy: null,
          outcome: 'defeat',
          rewardChoices: [],
          rewardDestination: null,
          notice: 'The run ended in defeat.',
        };
      }

      const nextWins = withLosses.wins + 1;
      const rewardDestination = getRewardDestination(withLosses, nextWins);
      const goldEarned = getRunGoldEarned(withLosses, result.battle);

      return {
        ...withLosses,
        phase: 'reward',
        activeEnemy: null,
        wins: nextWins,
        runGold: withLosses.runGold + goldEarned,
        rewardChoices: pickRunRewardChoices(withLosses),
        rewardDestination,
        notice: `${result.battle.enemy.name} defeated. +${goldEarned} run gold. Choose a run reward.`,
      };
    });
  };

  const handleRewardChoice = (choice: RunRewardChoice) => {
    if (session.rewardDestination === 'complete') triggerCompletionIntro();

    setSession(current => {
      if (!current) return current;
      const applied = choice.apply(current);

      if (applied.rewardDestination === 'complete') {
        const completed = applied.nodes.length > 0
          ? completeDungeonNode({
            ...applied,
            rewardChoices: [],
            rewardDestination: null,
          })
          : applied;

        return {
          ...completed,
          phase: 'complete',
          outcome: 'victory',
          rewardChoices: [],
          rewardDestination: null,
          notice: 'The final reward is ready.',
        };
      }

      if (applied.rewardDestination === 'dungeon-next') {
        return completeDungeonNode({
          ...applied,
          rewardChoices: [],
          rewardDestination: null,
          notice: `${choice.name} claimed.`,
        });
      }

      return {
        ...applied,
        phase: 'map',
        rewardChoices: [],
        rewardDestination: null,
        notice: `${choice.name} claimed.`,
      };
    });
  };

  const handleClaimCompletion = () => {
    if (!session || session.rewardClaimed) return;
    const notice = grantCompletionReward(session);
    const completedAt = Date.now();
    const isDungeon = session.mode === 'dungeon';
    const rewards: CompletionRewardLine[] = [
      { label: 'Wins', value: `${session.wins}/${session.targetBattles}`, tone: 'blue' },
      { label: 'Standing', value: `${getAliveRunStacks(session).length}/${session.minions.length}`, tone: 'green' },
      { label: 'Run Gold', value: String(session.runGold), tone: 'gold' },
    ];

    setSession({ ...session, rewardClaimed: true, notice });

    if (session.outcome === 'victory') {
      emitFxEvent({ type: 'run', tone: 'gold', intensity: 1.25 });
      emitCompletionNotice({
        id: `run-completion-${session.id}-${completedAt}`,
        kind: 'run',
        kicker: isDungeon ? 'Dungeon Cleared' : 'Daily Run Complete',
        title: isDungeon ? `${session.title} Cleared` : 'Run Complete',
        description: notice,
        rewards,
        completedAt,
      });
      window.setTimeout(onClose, 900);
    }
  };

  const handleStartFormation = () => {
    setSession(current => {
      if (!current) return current;
      const aliveUnits = getAliveRunStacks(current);
      const formation = { ...makeDefaultFormation(aliveUnits), ...current.formation };
      const issue = getFormationIssue(formation, aliveUnits);

      if (issue) {
        return {
          ...current,
          formation,
          notice: issue,
        };
      }

      return {
        ...current,
        formation,
        phase: 'battle',
        notice: undefined,
      };
    });
  };

  if (session.phase === 'battle' && session.activeEnemy) {
    return (
      <BattleModal
        key={session.activeEnemy.id}
        enemy={session.activeEnemy}
        playerStacks={aliveStacks}
        playerStats={session.stats}
        playerFormation={session.formation}
        availableSpellIds={session.spellIds}
        persistentResults={false}
        contextLabel={session.mode === 'daily' ? `Daily Run ${session.wins + 1}/${session.targetBattles}` : 'Dungeon Run'}
        onBattleEnd={handleBattleEnd}
        onClose={() => setSession(current => current ? { ...current, phase: 'map', activeEnemy: null } : current)}
      />
    );
  }

  return (
    <div className={`run-modal-layer fixed inset-0 z-[68] flex items-center justify-center bg-black/76 text-zinc-100 backdrop-blur-sm ${isMapPhase ? 'p-1' : 'p-4'}`}>
      <section className={`run-modal-panel command-panel vine-frame flex w-full flex-col overflow-hidden rounded border ${isFormationPhase ? 'run-formation-modal max-h-[94vh] max-w-5xl' : isMapPhase ? 'run-map-modal h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] max-w-none' : 'max-h-[94vh] max-w-6xl'}`}>
        <RunSessionHeader
          session={session}
          kicker={kicker}
          isFormationPhase={isFormationPhase}
          isMapPhase={isMapPhase}
          onClose={onClose}
        />

        {session.notice && session.phase !== 'complete' && (
          <div className={`ui-notice border-b font-bold ${isMapPhase || isFormationPhase ? 'run-map-notice px-3 py-1.5 text-[11px]' : 'px-5 py-3 text-sm'}`}>
            {session.notice}
          </div>
        )}

        <div className={`grid min-h-0 flex-1 ${isFormationPhase ? 'gap-5 overflow-hidden p-3' : session.phase === 'complete' ? 'gap-5 overflow-y-auto p-5' : isMapPhase ? 'run-map-layout gap-3 overflow-hidden p-2 lg:grid-cols-[15rem_minmax(0,1fr)]' : 'gap-5 overflow-y-auto p-5 lg:grid-cols-[18rem_minmax(0,1fr)]'}`}>
          {!isFormationPhase && session.phase !== 'complete' && (
            <RunRoster session={session} onOpenStats={() => setRunStatsOpen(true)} />
          )}

          <main className="min-h-0">
            {session.phase === 'draft' && (
              <DailyDraftPanel
                session={session}
                onPick={(template) => setSession(current => current ? addDraftMinion(current, template) : current)}
              />
            )}

            {session.phase === 'map' && (
              <RunMapPanel
                session={session}
                onStartDaily={() => setSession(current => current ? startDailyBattle(current) : current)}
                onSelectDungeonNode={(node) => setSession(current => current ? startDungeonNode(current, node) : current)}
              />
            )}

            {session.phase === 'formation' && session.activeEnemy && (
              <FormationPanel
                session={session}
                onChangeFormation={(formation) => setSession(current => current ? { ...current, formation } : current)}
                onStart={handleStartFormation}
                onBack={() => setSession(current => current ? { ...current, phase: 'map', activeEnemy: null, notice: undefined } : current)}
                onOpenStats={() => setRunStatsOpen(true)}
              />
            )}

            {session.phase === 'reward' && (
              <RewardPanel
                choices={session.rewardChoices}
                onChoose={handleRewardChoice}
              />
            )}

            {session.phase === 'shop' && (
              <ShopPanel
                session={session}
                onBuy={(choice, cost) => setSession(current => current ? buyShopReward(current, choice, cost) : current)}
                onSkip={() => setSession(current => current ? completeDungeonNode({ ...current, phase: 'map', notice: 'The shop fades behind you.' }) : current)}
              />
            )}

            {session.phase === 'event' && (
              <OmenPanel
                key={`${session.id}:${session.currentNodeIndex}`}
                session={session}
                onComplete={(outcome) => setSession(current => current ? applyDungeonEventOutcome(current, outcome) : current)}
              />
            )}

            {session.phase === 'complete' && (
              showCompletionIntro ? (
                <RunOutcomeBurst session={session} />
              ) : (
                <CompletionPanel
                  session={session}
                  onClaim={handleClaimCompletion}
                  onClose={onClose}
                />
              )
            )}
          </main>
        </div>

        {runStatsOpen && (
          <RunStatsModal session={session} onClose={() => setRunStatsOpen(false)} />
        )}
      </section>
    </div>
  );
}

function DailyDraftPanel({ session, onPick }: { session: RunSession; onPick: (template: MinionTemplate) => void }) {
  return (
    <div className="space-y-5">
      <section className="ui-card flex flex-wrap items-center justify-between gap-3 rounded border p-4">
        <div>
          <div className="arcane-label">Draft</div>
          <h3 className="fantasy-heading text-xl">Choose 7 Units</h3>
        </div>
        <span className="ui-pill rounded border px-3 py-2 text-xs font-black">
          {session.minions.length}/{MAX_FIELD_MINIONS}
        </span>
      </section>

      <div className="run-draft-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {session.draftChoices.map(template => (
          <button
            key={template.templateId}
            onClick={() => onPick(template)}
            className="run-draft-card ui-card rounded border p-3 text-left transition hover:border-[rgba(232,217,184,0.42)]"
          >
            <MinionPortrait template={template} size="large" />
            <div className="mt-2">
              <div className="fantasy-heading text-base">{template.name}</div>
              <div className="ui-muted text-xs font-bold">{MINION_CLASS_LABELS[template.class]} - {MINION_TIER_LABELS[template.tier]}</div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px] font-black">
                <RunStat label="ATK" value={template.stats.attack} />
                <RunStat label="DEF" value={template.stats.defense} />
                <RunStat label="HP" value={template.stats.health} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FormationPanel({
  session,
  onChangeFormation,
  onStart,
  onBack,
  onOpenStats,
}: {
  session: RunSession;
  onChangeFormation: (formation: Record<string, BoardCell>) => void;
  onStart: () => void;
  onBack: () => void;
  onOpenStats: () => void;
}) {
  const aliveUnits = getAliveRunStacks(session);
  const [selectedStackId, setSelectedStackId] = useState(aliveUnits[0]?.id || '');
  const formation = { ...makeDefaultFormation(aliveUnits), ...session.formation };
  const occupiedByCell = new Map<string, MinionStack>();
  const selectedStack = aliveUnits.find(stack => stack.id === selectedStackId);
  const selectedTemplate = selectedStack ? getMinionTemplate(selectedStack.templateId) : undefined;
  const selectedIndex = Math.max(0, aliveUnits.findIndex(unit => unit.id === selectedStackId));
  const formationIssue = getFormationIssue(formation, aliveUnits);

  aliveUnits.forEach(stack => {
    const cell = formation[stack.id];
    if (cell) occupiedByCell.set(`${cell.x}:${cell.y}`, stack);
  });

  const assignSelectedToCell = (cell: BoardCell) => {
    if (!selectedStackId) return;
    const selectedCurrentCell = formation[selectedStackId];
    const occupyingStack = occupiedByCell.get(`${cell.x}:${cell.y}`);
    const nextFormation = { ...formation };
    if (occupyingStack && selectedCurrentCell) {
      nextFormation[occupyingStack.id] = selectedCurrentCell;
    } else if (occupyingStack) {
      delete nextFormation[occupyingStack.id];
    }
    nextFormation[selectedStackId] = cell;
    onChangeFormation(nextFormation);
    setSelectedStackId('');
  };

  return (
    <div className="formation-minimal-shell">
      <section className="formation-minimal-toolbar rounded">
        <div>
          <div className="arcane-label">Place Units</div>
          <h3 className="fantasy-heading text-xl">Formation</h3>
          <div className="formation-guide-row mt-1 flex flex-wrap gap-2">
            <span>I. Pick a unit</span>
            <span>II. Place or swap</span>
            <span>C is fixed</span>
          </div>
        </div>
        <div className="formation-selected-chip">
          {selectedTemplate && <MinionPortrait template={selectedTemplate} size="tiny" />}
          <span className="formation-tier-mark">{selectedTemplate ? getTierRoman(selectedTemplate.tier) : '-'}</span>
          <span className="ui-faint text-[10px] font-black">{selectedIndex + 1}/{aliveUnits.length}</span>
        </div>
        <div className="formation-toolbar-actions">
          <button type="button" onClick={onOpenStats} className="run-formation-stats-button ui-button rounded px-3 py-2 text-xs font-bold">
            Status
          </button>
          <button type="button" onClick={onBack} className="ui-button rounded px-4 py-2 text-xs font-bold">
            Back
          </button>
          <button type="button" onClick={onStart} disabled={Boolean(formationIssue)} className="ui-button-primary rounded px-4 py-2 text-xs font-black disabled:opacity-40">
            Start
          </button>
        </div>
      </section>

      <div className="formation-minimal-stage">
        <div
          className="formation-board formation-board-minimal grid rounded"
          style={{
            gridTemplateColumns: 'repeat(2, var(--formation-cell-size))',
            gridTemplateRows: 'repeat(7, var(--formation-cell-size))',
          }}
        >
          {Array.from({ length: 14 }, (_, index) => {
            const x = index % 2;
            const y = Math.floor(index / 2);
            const isCommanderCell = x === 0 && y === 3;
            const stack = occupiedByCell.get(`${x}:${y}`);
            const template = stack ? getMinionTemplate(stack.templateId) : undefined;

            return (
              <button
                key={`${x}-${y}`}
                type="button"
                disabled={isCommanderCell}
                onClick={() => {
                  if (!stack) {
                    assignSelectedToCell({ x, y });
                    return;
                  }
                  if (!selectedStackId || stack.id === selectedStackId) {
                    setSelectedStackId(stack.id);
                    return;
                  }
                  assignSelectedToCell({ x, y });
                }}
                className={`formation-cell formation-cell-minimal relative rounded ${isCommanderCell ? 'formation-cell-commander' : stack?.id === selectedStackId ? 'formation-cell-selected' : stack && selectedStackId ? 'formation-cell-swappable' : ''}`}
                aria-label={isCommanderCell ? 'Commander fixed slot' : template ? `${template.name} tier ${getTierRoman(template.tier)}` : `Open slot ${index + 1}`}
                title={isCommanderCell ? 'Commander fixed' : template ? `${template.name}${stack?.id !== selectedStackId && selectedStackId ? ' - click to swap' : ''}` : 'Open slot'}
              >
                {isCommanderCell ? (
                  <span className="formation-commander-mark">C</span>
                ) : template ? (
                  <>
                    <MinionPortrait template={template} size="formation" />
                    <span className="formation-tier-badge">{getTierRoman(template.tier)}</span>
                  </>
                ) : (
                  <span className="formation-open-number">{index + 1}</span>
                )}
              </button>
            );
          })}
        </div>

        <aside className="formation-icon-dock">
          <div className="arcane-label text-center">Units</div>
          <div className="formation-icon-grid">
            {aliveUnits.map(stack => {
              const template = getMinionTemplate(stack.templateId);
              if (!template) return null;

              return (
                <button
                  key={stack.id}
                  type="button"
                  onClick={() => setSelectedStackId(stack.id)}
                  className={`formation-unit-icon relative rounded ${selectedStackId === stack.id ? 'formation-unit-selected' : ''}`}
                  aria-label={`Select ${template.name} tier ${getTierRoman(template.tier)}`}
                  title={template.name}
                >
                  <MinionPortrait template={template} size="tiny" />
                  <span className="formation-tier-badge">{getTierRoman(template.tier)}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <div className="formation-footer flex flex-wrap items-center justify-between gap-3">
        <div className={`formation-issue-line text-xs font-black ${formationIssue ? 'text-amber-100' : 'ui-faint'}`}>
          {formationIssue || 'Formation ready.'}
        </div>
      </div>
    </div>
  );
}

function RunMapPanel({
  session,
  onStartDaily,
  onSelectDungeonNode,
}: {
  session: RunSession;
  onStartDaily: () => void;
  onSelectDungeonNode: (node: DungeonNode) => void;
}) {
  if (session.mode === 'daily' && session.nodes.length === 0) {
    const nextBattle = session.wins + 1;
    const complete = session.wins >= session.targetBattles;

    return (
      <div className="space-y-5">
        <section className="ui-card flex flex-wrap items-center justify-between gap-3 rounded border p-4">
          <div>
            <div className="arcane-label">Daily Run</div>
            <h3 className="fantasy-heading text-xl">{complete ? 'Chain Complete' : `Battle ${nextBattle} of ${session.targetBattles}`}</h3>
          </div>
          <button
            onClick={onStartDaily}
            disabled={complete}
            className="ui-button-primary rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            {complete ? 'Complete' : 'Start Next Battle'}
          </button>
        </section>

        <RunProgressPips total={session.targetBattles} completed={session.wins} />
      </div>
    );
  }

  const isDaily = session.mode === 'daily';
  const branchMap = isDaily && hasBranchNodeLayout(session.nodes);
  const reachableIds = getReachableNodeIds(session);
  const mapSummary = {
    label: isDaily ? 'Daily Road' : 'Dungeon Path',
    title: isDaily ? 'Choose the next road stop' : 'Choose the next chamber',
    detail: isDaily
      ? `Battles count. Shops and omens are free stops. Boss: fight ${session.targetBattles}.`
      : 'Battles, shops, and chance pools appear between the entrance and boss. Only the next node can be resolved for now.',
  };

  return (
    <div className={`run-map-panel ${branchMap ? 'run-map-panel-full' : 'space-y-5'}`}>
      {!branchMap && (
        <section className="ui-card rounded border p-4">
          <div className="arcane-label">{mapSummary.label}</div>
          <h3 className="fantasy-heading text-xl">{mapSummary.title}</h3>
          <p className="ui-muted mt-1 text-sm font-bold">{mapSummary.detail}</p>
        </section>
      )}

      {branchMap ? (
        <DailyRouteMap
          session={session}
          reachableIds={reachableIds}
          onSelectDungeonNode={onSelectDungeonNode}
        />
      ) : (
        <div className="run-node-map grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {session.nodes.map((node, index) => {
            const isCurrent = index === session.currentNodeIndex;
            const locked = index > session.currentNodeIndex;
            const battleNumber = ['battle', 'elite', 'boss'].includes(node.type)
              ? session.nodes.slice(0, index + 1).filter(item => ['battle', 'elite', 'boss'].includes(item.type)).length
              : null;

            return (
              <button
                key={node.id}
                onClick={() => onSelectDungeonNode(node)}
                disabled={!isCurrent || node.completed}
                className={`ui-card rounded border p-4 text-left transition ${
                  isCurrent && !node.completed
                    ? 'border-[rgba(232,217,184,0.34)] hover:border-[rgba(232,217,184,0.55)]'
                    : 'opacity-55'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                      <Image
                        src={node.iconPath}
                        alt=""
                        fill
                        className="run-ui-art object-contain"
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="arcane-label">{battleNumber ? `Fight ${battleNumber}` : node.type}</div>
                      <h4 className="fantasy-heading truncate text-base">{node.label}</h4>
                    </div>
                  </div>
                  <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">
                    {node.completed ? 'Done' : locked ? 'Locked' : node.type === 'boss' ? 'Boss' : 'Next'}
                  </span>
                </div>
                <p className="ui-muted mt-2 text-xs font-bold">{node.description}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DailyRouteMap({
  session,
  reachableIds,
  onSelectDungeonNode,
}: {
  session: RunSession;
  reachableIds: Set<string>;
  onSelectDungeonNode: (node: DungeonNode) => void;
}) {
  const rows = getDailyNodeRows(session.nodes);
  const mapHeightRem = getRunMapHeightRem(rows.length);
  const connections = getDailyMapConnections(rows, mapHeightRem);

  return (
    <div className="run-route-shell run-route-shell-full">
      <div className="run-route-map-frame run-route-map-frame-full">
        <div className="run-route-map" style={{ minHeight: `${mapHeightRem}rem` }}>
          <svg className="run-route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {connections.map(connection => {
              const state = getRunConnectionState(connection.from, connection.to, reachableIds);
              const path = getRunConnectionPath(connection);
              return (
                <path
                  key={`${connection.from.id}-${connection.to.id}`}
                  d={path}
                  className={`run-route-line run-route-line-${state}`}
                />
              );
            })}
          </svg>

          {rows.map((row, rowIndex) => (
            row.nodes.map(node => {
                const state = getRunNodeState(session, node, reachableIds);
                const battleNumber = node.battleNumber || null;
                const x = getRunMapLaneX(row.nodes.length, node.lane ?? 0);
                const y = getRunMapRowTopRem(rowIndex);
                const reachable = state === 'reachable';
                const tooltipPosition = rowIndex < 2 ? 'below' : 'above';

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      if (reachable) onSelectDungeonNode(node);
                    }}
                    className={`run-route-node run-route-node-${node.type} run-route-node-${state} rounded transition ${reachable ? 'run-route-node-clickable' : ''}`}
                    style={{ left: `${x}%`, top: `${y}rem` }}
                    aria-label={`${getRunNodeStateLabel(node, state)} ${battleNumber ? `fight ${battleNumber}` : node.type}: ${node.label}`}
                    title={state === 'reachable' ? `${getRunNodeActionLabel(node)}: ${node.label}` : node.label}
                  >
                    <span className="run-route-node-icon relative overflow-hidden rounded">
                      <Image
                        src={node.iconPath}
                        alt=""
                        fill
                        sizes="120px"
                        className="run-ui-art object-contain"
                      />
                    </span>
                    <span className="run-route-node-title">
                      {node.type === 'boss' ? 'Boss' : battleNumber ? String(battleNumber) : node.type === 'shop' ? 'Shop' : 'Omen'}
                    </span>
                    <span className={`run-route-tooltip run-route-tooltip-${tooltipPosition} run-route-tooltip-${node.type} rounded border p-3`}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="arcane-label">{battleNumber ? `Fight ${battleNumber}` : node.type}</span>
                          <span className="fantasy-heading mt-1 block truncate text-lg">{node.label}</span>
                        </span>
                        <span className="ui-pill shrink-0 rounded border px-2 py-1 text-[10px] font-black uppercase">
                          {getRunNodeStateLabel(node, state)}
                        </span>
                      </span>
                      <span className="ui-muted mt-2 block text-xs font-bold leading-relaxed">{node.description}</span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        {reachable && <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase">{getRunNodeActionLabel(node)}</span>}
                        {node.type === 'elite' && <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase text-red-100">Hard route</span>}
                      </span>
                    </span>
                  </button>
                );
              })
          ))}
        </div>
      </div>
    </div>
  );
}

type RunNodeState = 'completed' | 'reachable' | 'skipped' | 'locked';

function hasBranchNodeLayout(nodes: DungeonNode[]): boolean {
  return nodes.some(node => typeof node.row === 'number');
}

function getDailyNodeRows(nodes: DungeonNode[]): Array<{ row: number; nodes: DungeonNode[] }> {
  const grouped = nodes.reduce<Map<number, DungeonNode[]>>((rows, node, index) => {
    const row = typeof node.row === 'number' ? node.row : index;
    rows.set(row, [...(rows.get(row) || []), node]);
    return rows;
  }, new Map());

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([row, rowNodes]) => ({
      row,
      nodes: rowNodes.sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0)),
    }));
}

function getLatestCompletedBranchNode(session: RunSession): DungeonNode | undefined {
  if (!hasBranchNodeLayout(session.nodes)) return undefined;

  return session.nodes
    .filter(node => node.completed && typeof node.row === 'number')
    .sort((a, b) => (b.row ?? 0) - (a.row ?? 0))[0];
}

function getReachableNodeIds(session: RunSession): Set<string> {
  if (!hasBranchNodeLayout(session.nodes)) {
    const current = session.nodes[session.currentNodeIndex];
    return new Set(current && !current.completed ? [current.id] : []);
  }

  const latestCompleted = getLatestCompletedBranchNode(session);
  if (!latestCompleted) {
    const firstRow = Math.min(...session.nodes.map(node => node.row ?? 0));
    return new Set(
      session.nodes
        .filter(node => (node.row ?? 0) === firstRow && !node.completed)
        .map(node => node.id)
    );
  }

  return new Set(
    (latestCompleted.nextIds || [])
      .filter(nextId => !session.nodes.find(node => node.id === nextId)?.completed)
  );
}

function getRunNodeState(session: RunSession, node: DungeonNode, reachableIds: Set<string>): RunNodeState {
  if (node.completed) return 'completed';
  if (reachableIds.has(node.id)) return 'reachable';

  const latestCompleted = getLatestCompletedBranchNode(session);
  if (latestCompleted && (node.row ?? 0) < (latestCompleted.row ?? 0)) return 'skipped';

  return 'locked';
}

function getRunNodeStateLabel(node: DungeonNode, state: RunNodeState): string {
  if (state === 'completed') return 'Done';
  if (state === 'skipped') return 'Passed';
  if (state === 'locked') return 'Locked';
  if (node.type === 'boss') return 'Boss';
  if (node.type === 'elite') return 'Hard';
  if (node.type === 'shop') return 'Shop';
  if (node.type === 'event') return 'Omen';
  return 'Next';
}

function getRunNodeActionLabel(node: DungeonNode): string {
  if (node.type === 'shop') return 'Open Shop';
  if (node.type === 'event') return 'Resolve Omen';
  if (node.type === 'boss') return 'Face Boss';
  if (node.type === 'elite') return 'Fight Elite';
  return 'Start Fight';
}

const RUN_MAP_ROW_START_REM = 6.5;
const RUN_MAP_ROW_GAP_REM = 10.25;
const RUN_MAP_BOTTOM_PAD_REM = 8.5;

function getRunMapHeightRem(rowCount: number): number {
  if (rowCount <= 0) return 56;
  if (rowCount === 1) return RUN_MAP_ROW_START_REM + RUN_MAP_BOTTOM_PAD_REM;
  return RUN_MAP_ROW_START_REM + (rowCount - 1) * RUN_MAP_ROW_GAP_REM + RUN_MAP_BOTTOM_PAD_REM;
}

function getRunMapRowTopRem(rowIndex: number): number {
  return RUN_MAP_ROW_START_REM + rowIndex * RUN_MAP_ROW_GAP_REM;
}

function getRunMapRowYViewBox(rowIndex: number, mapHeightRem: number): number {
  return (getRunMapRowTopRem(rowIndex) / mapHeightRem) * 100;
}

function getRunMapLaneX(rowSize: number, lane: number): number {
  if (rowSize <= 1) return 50;
  if (rowSize === 2) return lane === 0 ? 28 : 72;
  return [20, 50, 80][clamp(lane, 0, 2)] || 50;
}

function getDailyMapConnections(rows: Array<{ row: number; nodes: DungeonNode[] }>, mapHeightRem: number): Array<{
  from: DungeonNode;
  to: DungeonNode;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}> {
  const nodeById = new Map(rows.flatMap(row => row.nodes.map(node => [node.id, node] as const)));
  const rowIndexByNodeId = new Map<string, number>();
  rows.forEach((row, rowIndex) => row.nodes.forEach(node => rowIndexByNodeId.set(node.id, rowIndex)));

  return rows.flatMap((row, rowIndex) => (
    row.nodes.flatMap(node => (
      (node.nextIds || [])
        .map(nextId => nodeById.get(nextId))
        .filter((nextNode): nextNode is DungeonNode => Boolean(nextNode))
        .map(nextNode => {
          const nextRowIndex = rowIndexByNodeId.get(nextNode.id) ?? rowIndex + 1;
          const nextRow = rows[nextRowIndex] || rows[rowIndex + 1] || row;
          return {
            from: node,
            to: nextNode,
            x1: getRunMapLaneX(row.nodes.length, node.lane ?? 0),
            y1: getRunMapRowYViewBox(rowIndex, mapHeightRem),
            x2: getRunMapLaneX(nextRow.nodes.length, nextNode.lane ?? 0),
            y2: getRunMapRowYViewBox(nextRowIndex, mapHeightRem),
          };
        })
    ))
  ));
}

function getRunConnectionPath(connection: { x1: number; y1: number; x2: number; y2: number }): string {
  const midY = (connection.y1 + connection.y2) / 2;
  return `M ${connection.x1} ${connection.y1} C ${connection.x1} ${midY} ${connection.x2} ${midY} ${connection.x2} ${connection.y2}`;
}

function getRunConnectionState(from: DungeonNode, to: DungeonNode, reachableIds: Set<string>): 'completed' | 'active' | 'locked' {
  if (from.completed && to.completed) return 'completed';
  if (from.completed && reachableIds.has(to.id)) return 'active';
  return 'locked';
}

function RewardPanel({ choices, onChoose }: { choices: RunRewardChoice[]; onChoose: (choice: RunRewardChoice) => void }) {
  return (
    <div className="space-y-5">
      <section className="run-reward-hero rounded border p-4">
        <div className="arcane-label">Run Reward</div>
        <h3 className="fantasy-heading text-2xl">Choose a Blessing</h3>
        <p className="ui-muted mt-1 text-sm font-bold">Pick one upgrade for this run. Higher tiers hit harder, but the best choice depends on your surviving army.</p>
      </section>

      <div className="run-reward-grid">
        {choices.map(choice => (
          <RunRewardCard key={choice.id} choice={choice} onChoose={() => onChoose(choice)} />
        ))}
      </div>
    </div>
  );
}

function RunRewardCard({
  choice,
  onChoose,
  disabled = false,
  cost,
}: {
  choice: RunRewardChoice;
  onChoose: () => void;
  disabled?: boolean;
  cost?: number;
}) {
  const visual = getRunRewardVisual(choice);

  return (
    <button
      onClick={onChoose}
      disabled={disabled}
      className={`run-reward-card run-reward-card-${visual.tone} rounded border p-4 text-left transition disabled:opacity-40`}
    >
      <span className="flex items-start gap-3">
        <span className={`run-reward-icon run-reward-icon-${visual.tone} relative shrink-0 overflow-hidden rounded border`}>
          <Image
            src={visual.iconPath}
            alt=""
            fill
            sizes="48px"
            className="run-ui-art object-contain p-2"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="fantasy-heading block truncate text-lg">{choice.name}</span>
              <span className="ui-faint mt-1 block text-[10px] font-black uppercase">{visual.kindLabel}</span>
            </span>
            <span className="run-reward-tier rounded border px-2 py-1 text-[10px] font-black uppercase">
              {cost ? `${cost}g` : visual.tierLabel}
            </span>
          </span>
          <span className="ui-muted mt-3 block text-sm font-bold">{choice.description}</span>
          <span className="run-reward-impact mt-3 inline-flex rounded border px-2 py-1 text-[10px] font-black uppercase">
            {visual.impactLabel}
          </span>
        </span>
      </span>
    </button>
  );
}

function getRunRewardVisual(choice: RunRewardChoice): {
  iconPath: string;
  tierLabel: string;
  kindLabel: string;
  impactLabel: string;
  tone: 'attack' | 'defense' | 'magic' | 'morale' | 'health' | 'unit' | 'gold';
} {
  const normalized = `${choice.id} ${choice.name} ${choice.description}`.toLowerCase();
  const tierLabel = normalized.includes('all') || normalized.includes('tier iii') || normalized.includes('+35') || normalized.includes('+4')
    ? 'Tier III'
    : normalized.includes('tier ii') || normalized.includes('+20') || normalized.includes('+2') || normalized.includes('up to two')
      ? 'Tier II'
      : 'Tier I';

  if (normalized.includes('army') || normalized.includes('weapon')) {
    return { iconPath: '/assets/icons/attack.png', tierLabel, kindLabel: 'Offense', impactLabel: 'More damage', tone: 'attack' };
  }
  if (normalized.includes('ward') || normalized.includes('armor') || normalized.includes('defensive')) {
    return { iconPath: '/assets/icons/defense.png', tierLabel, kindLabel: 'Defense', impactLabel: 'More survival', tone: 'defense' };
  }
  if (normalized.includes('spell') || normalized.includes('focus') || normalized.includes('liturgy')) {
    return { iconPath: '/assets/icons/magic.png', tierLabel, kindLabel: 'Magic', impactLabel: 'Better spells', tone: 'magic' };
  }
  if (normalized.includes('morale') || normalized.includes('banner') || normalized.includes('chorus')) {
    return { iconPath: '/assets/icons/speed.png', tierLabel, kindLabel: 'Tempo', impactLabel: 'Faster turns', tone: 'morale' };
  }
  if (normalized.includes('health') || normalized.includes('resurrect') || normalized.includes('mercy') || normalized.includes('vigor')) {
    return { iconPath: '/assets/icons/health.png', tierLabel, kindLabel: 'Recovery', impactLabel: 'Stay alive', tone: 'health' };
  }
  if (normalized.includes('recruit') || normalized.includes('promotion') || normalized.includes('minion')) {
    return { iconPath: '/assets/icons/attack.png', tierLabel, kindLabel: 'Army', impactLabel: 'More units', tone: 'unit' };
  }
  return { iconPath: '/assets/icons/gold.png', tierLabel, kindLabel: 'Treasure', impactLabel: 'Shop power', tone: 'gold' };
}

function ShopPanel({
  session,
  onBuy,
  onSkip,
}: {
  session: RunSession;
  onBuy: (choice: RunRewardChoice, cost: number) => void;
  onSkip: () => void;
}) {
  const choices = pickRunRewardChoices(session, RUN_SHOP_CHOICE_COUNT);

  return (
    <div className="space-y-5">
      <section className="ui-card rounded border p-4">
        <div className="arcane-label">{session.mode === 'daily' ? 'Road Shop' : 'Dungeon Shop'}</div>
        <h3 className="fantasy-heading text-xl">{session.mode === 'daily' ? 'Roadside Quartermaster' : 'Black-Coin Merchant'}</h3>
        <p className="ui-muted mt-1 text-sm font-bold">Spend run gold on a temporary blessing, or leave this stop.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice, index) => {
          const cost = 35 + index * 20;
          const canAfford = session.runGold >= cost;

          return (
            <RunRewardCard
              key={choice.id}
              choice={choice}
              onChoose={() => onBuy(choice, cost)}
              disabled={!canAfford}
              cost={cost}
            />
          );
        })}
      </div>
      <button onClick={onSkip} className="ui-button rounded px-4 py-2 text-sm font-bold">
        Leave Shop
      </button>
    </div>
  );
}

type OmenTone = 'curse' | 'blessing' | 'gold' | 'recruit' | 'ward';

interface OmenOutcome {
  id: string;
  title: string;
  detail: string;
  flavor: string;
  tone: OmenTone;
  apply: (session: RunSession) => RunSession;
}

const OMEN_CHANNEL_MS = 2400;

function OmenPanel({
  session,
  onComplete,
}: {
  session: RunSession;
  onComplete: (outcome: OmenOutcome) => void;
}) {
  const node = session.nodes[session.currentNodeIndex];
  const revealKey = `${session.id}:${session.currentNodeIndex}`;
  const [outcome] = useState(() => rollDungeonEventOutcome(session));
  const [revealState, setRevealState] = useState<{ key: string; stage: 'channeling' | 'revealed' }>({
    key: revealKey,
    stage: 'channeling',
  });
  const stage = revealState.key === revealKey ? revealState.stage : 'channeling';

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = prefersReducedMotion ? 0 : OMEN_CHANNEL_MS;
    const timer = window.setTimeout(() => {
      setRevealState({ key: revealKey, stage: 'revealed' });
      emitFxEvent({
        type: 'status',
        tone: outcome.tone === 'curse' ? 'red' : outcome.tone === 'gold' ? 'gold' : 'violet',
        intensity: 0.72,
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [outcome.tone, revealKey]);

  if (stage === 'channeling') {
    return (
      <div className="run-omen-stage flex min-h-[28rem] items-center justify-center p-4">
        <section className="run-omen-panel run-omen-channeling w-full max-w-xl rounded border p-8 text-center">
          <div className="run-omen-sigil-wrap mx-auto mb-5">
            <span className="run-omen-sigil-ring run-omen-sigil-ring-outer" aria-hidden="true" />
            <span className="run-omen-sigil-ring run-omen-sigil-ring-inner" aria-hidden="true" />
            <span className="run-omen-sigil-icon relative mx-auto block h-20 w-20 overflow-hidden rounded-full border">
              <Image
                src={node?.iconPath || DUNGEON_NODE_ICONS.event}
                alt=""
                fill
                sizes="80px"
                className="run-ui-art object-contain p-3"
              />
            </span>
          </div>
          <div className="arcane-label">Omen</div>
          <h3 className="fantasy-heading mt-1 text-3xl">{node?.label || 'Dark Pool'}</h3>
          <p className="run-omen-channel-copy ui-muted mx-auto mt-3 max-w-md text-sm font-bold leading-relaxed">
            {node?.description || 'The chamber hums as fate gathers around your warband.'}
          </p>
          <p className="run-omen-channel-status mt-6 text-xs font-black uppercase tracking-[0.24em] text-violet-100/80">
            Reading the omen
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="run-omen-stage flex min-h-[28rem] items-center justify-center p-4">
      <section className={`run-omen-panel run-omen-reveal run-omen-${outcome.tone} w-full max-w-xl rounded border p-8 text-center`}>
        <div className="run-omen-result-icon relative mx-auto mb-4 h-16 w-16 overflow-hidden rounded-full border">
          <Image
            src={DUNGEON_NODE_ICONS.event}
            alt=""
            fill
            sizes="64px"
            className="run-ui-art object-contain p-2.5"
          />
        </div>
        <div className="arcane-label">Omen Resolved</div>
        <h3 className="fantasy-heading mt-1 text-3xl">{outcome.title}</h3>
        <p className="ui-muted mx-auto mt-3 max-w-md text-sm font-bold leading-relaxed">{outcome.flavor}</p>
        <p className="run-omen-result-detail mx-auto mt-4 max-w-md rounded border px-4 py-3 text-sm font-black leading-relaxed text-zinc-100">
          {outcome.detail}
        </p>
        <button
          type="button"
          onClick={() => onComplete(outcome)}
          className="ui-button-primary mt-6 rounded px-6 py-3 text-sm font-black"
        >
          Continue Road
        </button>
      </section>
    </div>
  );
}

function RunOutcomeBurst({ session }: { session: RunSession }) {
  const victory = session.outcome === 'victory';

  return (
    <section className={`run-outcome-burst rounded border p-8 text-center ${victory ? 'run-outcome-victory' : 'run-outcome-defeat'}`}>
      <div className="arcane-label">{session.mode === 'dungeon' ? 'Dungeon Run' : 'Daily Run'}</div>
      <h3 className="fantasy-heading text-4xl">{victory ? 'Victory' : 'Defeat'}</h3>
      <div className="mx-auto mt-5 grid max-w-xl gap-2 sm:grid-cols-3">
        <RunResultPill label="Wins" value={`${session.wins}/${session.targetBattles}`} />
        <RunResultPill label="Standing" value={`${getAliveRunStacks(session).length}/${session.minions.length}`} />
        <RunResultPill label="Run Gold" value={String(session.runGold)} />
      </div>
    </section>
  );
}

function CompletionPanel({
  session,
  onClaim,
  onClose,
}: {
  session: RunSession;
  onClaim: () => void;
  onClose: () => void;
}) {
  const victory = session.outcome === 'victory';
  const [showDetails, setShowDetails] = useState(false);
  const aliveCount = getAliveRunStacks(session).length;
  const totalDamageDealt = session.battleReports.reduce((total, report) => total + report.damageDealt, 0);
  const totalDamageTaken = session.battleReports.reduce((total, report) => total + report.damageTaken, 0);
  const totalHealing = session.battleReports.reduce((total, report) => total + report.healingDone, 0);
  const totalDurationMs = session.battleReports.reduce((total, report) => total + report.durationMs, 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <section className={`run-completion-panel rounded border p-5 ${victory ? 'battle-result-victory' : 'battle-result-defeat'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="arcane-label">{session.mode === 'dungeon' ? 'Dungeon Report' : 'Daily Report'}</div>
            <h3 className="fantasy-heading text-3xl">{victory ? 'Run Cleared' : 'Run Failed'}</h3>
            <p className="ui-muted mt-1 text-sm font-bold">
              {victory ? 'Claim the reward and return to the world map.' : 'No completion reward. Your main roster was not changed.'}
            </p>
          </div>
          <div className={`run-result-sigil ${victory ? 'run-result-sigil-victory' : 'run-result-sigil-defeat'}`}>
            {victory ? 'V' : 'X'}
          </div>
        </div>

        <div className="mt-5">
          <RunProgressPips total={session.targetBattles} completed={session.wins} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <RunResultPill label="Wins" value={`${session.wins}/${session.targetBattles}`} />
          <RunResultPill label="Standing" value={`${aliveCount}/${session.minions.length}`} />
          <RunResultPill label="Run Gold" value={String(session.runGold)} />
        </div>

        {session.battleReports.length > 0 && (
          <RunBattleHistoryStrip reports={session.battleReports} />
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {victory && (
            <button
              onClick={onClaim}
              disabled={session.rewardClaimed}
              className="ui-button-primary rounded px-5 py-3 text-sm font-black disabled:opacity-40"
            >
              {session.rewardClaimed ? 'Reward Claimed' : 'Claim Reward'}
            </button>
          )}
          <button onClick={() => setShowDetails(open => !open)} className="ui-button rounded px-5 py-3 text-sm font-bold">
            {showDetails ? 'Hide Details' : 'Details'}
          </button>
          <button onClick={onClose} className="ui-button rounded px-5 py-3 text-sm font-bold">
            Return
          </button>
        </div>
      </section>

      {showDetails && (
        <section className="run-detail-drawer rounded border p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <RunResultPill label="Time" value={formatRunDuration(totalDurationMs)} />
            <RunResultPill label="Damage" value={String(totalDamageDealt)} />
            <RunResultPill label="Taken" value={String(totalDamageTaken)} />
            <RunResultPill label="Healed" value={String(totalHealing)} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <RunRoster session={session} onOpenStats={() => setShowDetails(true)} />
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-[rgba(232,217,184,0.14)] pb-2">
                <h3 className="fantasy-heading font-black">Combat Data</h3>
                <span className="ui-faint text-xs font-bold">{session.battleReports.length} fights</span>
              </div>
              {session.battleReports.length === 0 ? (
                <div className="ui-empty rounded border border-dashed px-4 py-6 text-center text-sm font-bold">
                  No battle data recorded.
                </div>
              ) : (
                <div className="space-y-2">
                  {session.battleReports.map(report => (
                    <RunBattleReportCard key={report.id} report={report} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function RunBattleHistoryStrip({ reports }: { reports: RunBattleReport[] }) {
  const visibleReports = reports.slice(-8);

  return (
    <div className="run-history-strip mt-5 rounded border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="arcane-label">Road History</div>
          <h4 className="fantasy-heading text-lg">Enemy Commanders Defeated</h4>
        </div>
        <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{reports.length} fights</span>
      </div>
      <div className="run-history-commanders">
        {visibleReports.map((report, index) => {
          const boss = report.enemyPersonality === 'boss' || index === visibleReports.length - 1;

          return (
            <div key={report.id} className={`run-history-commander rounded border p-2 ${boss ? 'run-history-commander-boss' : ''}`}>
              <span className="run-history-portrait relative mx-auto block overflow-hidden rounded">
                <Image
                  src={report.enemyAssetPath || '/assets/playermodel1.png'}
                  alt={report.enemyName}
                  fill
                  className="object-contain"
                  sizes="72px"
                  unoptimized
                />
              </span>
              <div className="mt-2 truncate text-center text-xs font-black text-zinc-100">{report.enemyName}</div>
              <div className="ui-faint text-center text-[10px] font-black uppercase">
                {boss ? 'Boss' : `Lv ${report.enemyLevel || 1}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunBattleReportCard({ report }: { report: RunBattleReport }) {
  return (
    <div className="run-battle-report rounded border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="arcane-label">{report.status === 'victory' ? 'Won' : 'Lost'} - Round {report.round}</div>
          <div className="fantasy-heading text-base">{report.enemyName}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{formatRunDuration(report.durationMs)}</span>
          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{report.damageDealt} dmg</span>
          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{report.healingDone} heal</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {report.unitReports.map(unit => (
          <div key={unit.id} className={`run-unit-report flex items-center gap-2 rounded px-2 py-1.5 ${unit.alive ? '' : 'opacity-45'}`}>
            <span className="ui-icon-frame relative block h-9 w-9 shrink-0 overflow-hidden rounded border">
              <Image
                src={unit.assetPath}
                alt={unit.name}
                fill
                className="run-minion-portrait-image run-ui-art object-contain"
                sizes="36px"
                unoptimized
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-black text-zinc-100">{unit.name}</div>
              <div className="ui-faint truncate text-[10px] font-bold">
                {unit.damageDealt} dealt - {unit.damageTaken} taken - {unit.healingDone} healed
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunRoster({ session, onOpenStats }: { session: RunSession; onOpenStats: () => void }) {
  return (
    <aside className="run-roster-aside flex min-h-0 flex-col gap-3">
      <section className="run-roster-list min-h-0 flex-1 overflow-y-auto">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-[rgba(232,217,184,0.16)] pb-2">
          <h3 className="fantasy-heading font-black">Run Roster</h3>
          <span className="ui-faint text-xs font-bold">{getAliveRunStacks(session).length}/{session.minions.length}</span>
        </div>
        <div className="space-y-2">
          {session.minions.length === 0 ? (
            <div className="ui-empty rounded border border-dashed px-4 py-6 text-center text-sm font-bold">
              No units drafted.
            </div>
          ) : (
            session.minions.map(unit => {
              const template = getMinionTemplate(unit.stack.templateId);
              if (!template) return null;

              return (
                <div key={unit.stack.id} className={`ui-card flex items-center gap-3 rounded border p-2 ${unit.alive ? '' : 'opacity-40'}`}>
                  <MinionPortrait template={template} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-zinc-100">{template.name}</div>
                    <div className="ui-muted text-xs font-bold">{unit.alive ? MINION_TIER_LABELS[template.tier] : 'Fallen'}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <RunStatsLaunch session={session} onOpen={onOpenStats} />
    </aside>
  );
}

function getTierRoman(tier: MinionTemplate['tier']): string {
  if (tier === 'tier3') return 'III';
  if (tier === 'tier2') return 'II';
  return 'I';
}

function MinionPortrait({ template, size = 'small' }: { template: MinionTemplate; size?: 'tiny' | 'formation' | 'small' | 'large' }) {
  const dimensions = size === 'large'
    ? 'h-28 w-28'
    : size === 'formation'
      ? 'h-full w-full'
      : size === 'tiny'
        ? 'h-12 w-12'
        : 'h-14 w-14';

  return (
    <span className={`run-minion-portrait ui-icon-frame relative mx-auto block shrink-0 overflow-hidden rounded border ${dimensions}`}>
      <Image
        src={`${MINION_ICON_BASE}/${template.assetName}`}
        alt={template.name}
        fill
        className="run-minion-portrait-image run-ui-art object-contain"
        sizes={size === 'large' ? '112px' : size === 'formation' ? '84px' : size === 'tiny' ? '48px' : '56px'}
        unoptimized
      />
    </span>
  );
}

function RunStat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="ui-pill rounded border px-2 py-1">
      <span className="ui-faint block">{label}</span>
      <span className="ui-value block">{value}</span>
    </span>
  );
}

const RUN_HEADER_ICONS = {
  battles: '/assets/icons/attack.png',
  roster: '/assets/icons/health.png',
  gold: '/assets/icons/gold.png',
  challenge: '/assets/icons/rare-gem.png',
} as const;

const COMMANDER_STAT_ICONS = {
  Army: '/assets/icons/attack.png',
  Ward: '/assets/icons/defense.png',
  Morale: '/assets/icons/speed.png',
  Spell: '/assets/icons/magic.png',
} as const;

function RunHeaderChip({
  icon,
  value,
  title,
  tone,
}: {
  icon: string;
  value: string;
  title: string;
  tone?: 'gold';
}) {
  return (
    <span
      className={`run-header-chip ${tone === 'gold' ? 'run-header-chip-gold' : ''}`}
      title={title}
    >
      <Image
        src={icon}
        alt=""
        width={16}
        height={16}
        className="run-header-chip-icon"
        unoptimized
      />
      <span className="run-header-chip-value">{value}</span>
    </span>
  );
}

function RunStatsChipRow({ session }: { session: RunSession }) {
  const aliveCount = getAliveRunStacks(session).length;
  const challengeHint = session.dailyChallenge
    ? `${session.dailyChallenge.subtitle} — ${session.dailyChallenge.weeklyRewardName}`
    : undefined;

  return (
    <>
      <RunHeaderChip
        icon={RUN_HEADER_ICONS.battles}
        value={`${session.wins}/${session.targetBattles}`}
        title="Battles won"
      />
      <RunHeaderChip
        icon={RUN_HEADER_ICONS.roster}
        value={`${aliveCount}/${session.minions.length}`}
        title="Units standing"
      />
      <RunHeaderChip
        icon={RUN_HEADER_ICONS.gold}
        value={String(session.runGold)}
        title="Run gold"
        tone="gold"
      />
      {challengeHint && (
        <span className="run-header-chip run-header-chip-challenge" title={challengeHint}>
          <Image
            src={RUN_HEADER_ICONS.challenge}
            alt=""
            width={16}
            height={16}
            className="run-header-chip-icon"
            unoptimized
          />
        </span>
      )}
    </>
  );
}

function RunStatsLaunch({ session, onOpen }: { session: RunSession; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="run-roster-stats-launch ui-card w-full shrink-0 rounded border px-3 py-2.5 text-left transition"
      aria-label="Open run status"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="arcane-label text-[9px]">Run Status</span>
        <span className="ui-faint text-[10px] font-black uppercase tracking-[0.12em]">Details</span>
      </span>
      <span className="run-header-stats mt-2 flex flex-wrap gap-1">
        <RunStatsChipRow session={session} />
      </span>
    </button>
  );
}

function RunCommanderStat({
  label,
  value,
  icon,
}: {
  label: keyof typeof COMMANDER_STAT_ICONS;
  value: number;
  icon: string;
}) {
  return (
    <div className="run-commander-stat ui-card flex items-center gap-3 rounded border p-3">
      <span className="run-commander-stat-icon ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
        <Image src={icon} alt="" fill sizes="40px" className="object-contain p-1.5" unoptimized />
      </span>
      <div className="min-w-0">
        <div className="ui-faint text-[10px] font-black uppercase">{label}</div>
        <div className="ui-value text-xl font-black leading-none">{value}</div>
      </div>
    </div>
  );
}

function RunStatsModal({ session, onClose }: { session: RunSession; onClose: () => void }) {
  const challenge = session.dailyChallenge;

  return (
    <div
      className="run-stats-modal-layer fixed inset-0 z-[69] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="run-stats-modal command-panel vine-frame w-full max-w-md rounded border p-4 text-zinc-100"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="arcane-label">Run Status</div>
            <h3 className="fantasy-heading truncate text-xl">{session.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="ui-button shrink-0 rounded px-2 py-1 text-[10px] font-bold">
            Close
          </button>
        </div>

        <div className="run-header-stats mt-4 flex flex-wrap gap-1.5">
          <RunStatsChipRow session={session} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <RunCommanderStat label="Army" value={session.stats.armyPower} icon={COMMANDER_STAT_ICONS.Army} />
          <RunCommanderStat label="Ward" value={session.stats.defensivePower} icon={COMMANDER_STAT_ICONS.Ward} />
          <RunCommanderStat label="Morale" value={session.stats.morale} icon={COMMANDER_STAT_ICONS.Morale} />
          <RunCommanderStat label="Spell" value={session.stats.spellPower} icon={COMMANDER_STAT_ICONS.Spell} />
        </div>

        {challenge && (
          <div className="ui-card mt-4 rounded border p-3">
            <div className="arcane-label">Weekly Challenge</div>
            <p className="ui-muted mt-1 text-xs font-bold">{challenge.subtitle}</p>
            <p className="ui-faint mt-1 text-[11px] font-bold">{challenge.weeklyRewardName}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function RunSessionHeader({
  session,
  kicker,
  isFormationPhase,
  isMapPhase,
  onClose,
}: {
  session: RunSession;
  kicker?: string;
  isFormationPhase: boolean;
  isMapPhase: boolean;
  onClose: () => void;
}) {
  const aliveCount = getAliveRunStacks(session).length;
  const headerLabel = isFormationPhase
    ? 'Formation'
    : kicker || (session.mode === 'daily' ? 'Daily run' : 'Dungeon path');
  const useCompactHeader = isMapPhase || isFormationPhase;

  if (useCompactHeader) {
    return (
      <header className="run-map-header panel-header flex items-center gap-2 border-b px-3 py-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="run-map-header-kicker arcane-label shrink-0 text-[9px]">{headerLabel}</span>
          <h2 className="fantasy-heading min-w-0 truncate text-base leading-none sm:text-lg">{session.title}</h2>
        </div>

        <button onClick={onClose} className="ui-button shrink-0 rounded px-2 py-1 text-[10px] font-bold sm:px-3 sm:text-xs">
          Close
        </button>
      </header>
    );
  }

  return (
    <header className="panel-header flex items-start justify-between gap-4 border-b px-5 py-4">
      <div>
        <div className="arcane-label">{headerLabel}</div>
        <h2 className="fantasy-heading text-2xl">{session.title}</h2>
        <p className="ui-muted mt-1 text-xs font-bold">
          {`${session.wins}/${session.targetBattles} battles won · ${aliveCount}/${session.minions.length} units · ${session.runGold} run gold`}
        </p>
        {session.dailyChallenge && (
          <p className="ui-faint mt-1 text-xs font-bold">
            {session.dailyChallenge.subtitle} — {session.dailyChallenge.weeklyRewardName}
          </p>
        )}
      </div>
      <button onClick={onClose} className="ui-button rounded px-3 py-2 text-xs font-bold">
        Close
      </button>
    </header>
  );
}

function RunProgressPips({ total, completed }: { total: number; completed: number }) {
  return (
    <div className="ui-card rounded border p-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-3 rounded border ${index < completed ? 'border-emerald-200/60 bg-emerald-300/70' : 'border-[rgba(232,217,184,0.18)] bg-black/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

function RunResultPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="battle-result-stat rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value mt-0.5 text-sm font-black">{value}</div>
    </div>
  );
}

function getDailyRunSessionKey(username: string, dateKey: string): string {
  return `${DAILY_RUN_SESSION_PREFIX}_${username}_${dateKey}`;
}

function serializeRunSession(username: string, session: RunSession): StoredRunSession {
  const { rewardChoices, ...storedSession } = session;
  return {
    ...storedSession,
    rewardChoiceIds: rewardChoices.map(choice => choice.id),
    savedAt: Date.now(),
    ownerUsername: username,
    dateKey: session.dailyChallenge?.date || getDailyRunChallenge().date,
  };
}

function hydrateRunSession(storedSession: StoredRunSession | null, challenge: DailyRunChallenge): RunSession | null {
  if (!storedSession || storedSession.mode !== 'daily') return null;
  if (storedSession.dateKey !== challenge.date) return null;
  const { rewardChoiceIds, savedAt, ownerUsername, dateKey, ...session } = storedSession;
  void savedAt;
  void ownerUsername;
  void dateKey;

  const freshNodes = createDailyRunNodes(challenge, storedSession.stats?.level || 1);
  const storedNodes = storedSession.nodes?.length ? normalizeDailyRunNodes(storedSession.nodes) : [];
  const refreshStoredRoad = storedSession.wins === 0 && (
    !storedNodes.length ||
    !hasBranchNodeLayout(storedNodes) ||
    storedSession.targetBattles < challenge.targetBattles
  );
  const nodes = refreshStoredRoad ? freshNodes : storedNodes.length ? storedNodes : freshNodes;

  return {
    ...session,
    targetBattles: refreshStoredRoad ? challenge.targetBattles : session.targetBattles,
    dailyChallenge: challenge,
    formation: storedSession.formation || makeDefaultFormation(storedSession.minions.filter(unit => unit.alive).map(unit => unit.stack)),
    spellIds: storedSession.spellIds?.length ? storedSession.spellIds.slice(0, 4) : pickRunSpellLoadout(challenge.date),
    nodes,
    battleReports: storedSession.battleReports || [],
    rewardChoices: rewardChoiceIds
      .map(choiceId => RUN_BUFFS.find(choice => choice.id === choiceId))
      .filter((choice): choice is RunRewardChoice => Boolean(choice)),
  };
}

function loadDailyRunSession(user: User, challenge: DailyRunChallenge): RunSession | null {
  const key = getDailyRunSessionKey(user.username, challenge.date);
  return hydrateRunSession(readGameJson<StoredRunSession | null>(key, null), challenge);
}

export interface SavedDailyRunSummary {
  title: string;
  phase: RunPhase;
  phaseLabel: string;
  wins: number;
  targetBattles: number;
  unitsStanding: number;
  totalUnits: number;
  runGold: number;
}

function getRunPhaseLabel(phase: RunPhase): string {
  switch (phase) {
    case 'draft': return 'Draft';
    case 'map': return 'Path';
    case 'formation': return 'Formation';
    case 'battle': return 'Battle';
    case 'reward': return 'Reward';
    case 'shop': return 'Shop';
    case 'event': return 'Event';
    case 'complete': return 'Report';
    default: return 'Run';
  }
}

export function getSavedDailyRunSummary(
  user: User | null | undefined,
  challenge: DailyRunChallenge = getDailyRunChallenge()
): SavedDailyRunSummary | null {
  if (!user || getDailyRunStatus(user).completedToday) return null;

  const session = loadDailyRunSession(user, challenge);
  if (!session || session.rewardClaimed) return null;

  return {
    title: session.title,
    phase: session.phase,
    phaseLabel: getRunPhaseLabel(session.phase),
    wins: session.wins,
    targetBattles: session.targetBattles,
    unitsStanding: getAliveRunStacks(session).length,
    totalUnits: session.minions.length,
    runGold: session.runGold,
  };
}

function saveDailyRunSession(username: string, session: RunSession): void {
  const dateKey = session.dailyChallenge?.date || getDailyRunChallenge().date;
  writeGameJson(getDailyRunSessionKey(username, dateKey), serializeRunSession(username, session));
}

function clearDailyRunSession(username: string, dateKey: string): void {
  removeGameStorageItem(getDailyRunSessionKey(username, dateKey));
}

function createDailySession(user: User, dailyChallenge = getDailyRunChallenge()): RunSession {
  const nodes = createDailyRunNodes(dailyChallenge, user.stats.level || 1);

  return {
    id: `daily-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mode: 'daily',
    title: dailyChallenge.name,
    phase: 'draft',
    stats: applyDailyChallengeStats(cloneRunStats(user.stats), dailyChallenge),
    minions: [],
    draftChoices: getDraftChoices(0),
    wins: 0,
    targetBattles: clamp(dailyChallenge.targetBattles, 12, 18),
    runGold: 0,
    activeEnemy: null,
    formation: {},
    spellIds: pickRunSpellLoadout(dailyChallenge.date),
    rewardChoices: [],
    rewardDestination: null,
    nodes,
    currentNodeIndex: 0,
    battleReports: [],
    outcome: null,
    dailyChallenge,
  };
}

function createDungeonSession(user: User, dungeon: WorldDungeon): RunSession {
  const rosterMinions = getFieldedMinions(user).slice(0, MAX_FIELD_MINIONS);
  const startingStacks = rosterMinions.length > 0
    ? rosterMinions.map((stack, index) => ({
      stack: cloneRunStack(stack.templateId, `loaned-dungeon-${dungeon.id}-${index}`),
      alive: true,
      origin: 'roster' as const,
    }))
    : ['knight-squire', 'priest-acolyte', 'wizard-apprentice'].map((templateId, index) => ({
      stack: cloneRunStack(templateId, `loaned-dungeon-${dungeon.id}-${index}`),
      alive: true,
      origin: 'loaned' as const,
    }));

  const nodes = createDungeonNodes(dungeon);

  return {
    id: `dungeon-run-${dungeon.id}-${Date.now()}`,
    mode: 'dungeon',
    title: dungeon.name,
    phase: 'map',
    stats: cloneRunStats(user.stats),
    minions: startingStacks,
    draftChoices: [],
    wins: 0,
    targetBattles: nodes.filter(node => ['battle', 'elite', 'boss'].includes(node.type)).length,
    runGold: 40,
    activeEnemy: null,
    formation: makeDefaultFormation(startingStacks.map(unit => unit.stack)),
    spellIds: (user.equippedSpellIds || ['arcane-bolt', 'sanctified-mend', 'ember-dart', 'warding-prayer']).slice(0, 4),
    rewardChoices: [],
    rewardDestination: null,
    nodes,
    currentNodeIndex: 0,
    battleReports: [],
    outcome: null,
    dungeon,
  };
}

function cloneRunStats(stats: CharacterStats): CharacterStats {
  return {
    ...stats,
    health: stats.maxHealth,
  };
}

function applyDailyChallengeStats(stats: CharacterStats, challenge: DailyRunChallenge): CharacterStats {
  const bonus = challenge.modifiers.reduce((totals, modifier) => {
    const statBonus = modifier.statBonus || {};
    return {
      armyPower: totals.armyPower + (statBonus.armyPower || 0),
      defensivePower: totals.defensivePower + (statBonus.defensivePower || 0),
      morale: totals.morale + (statBonus.morale || 0),
      spellPower: totals.spellPower + (statBonus.spellPower || 0),
      maxHealth: totals.maxHealth + (statBonus.maxHealth || 0),
      health: totals.health + (statBonus.health || 0),
    };
  }, { armyPower: 0, defensivePower: 0, morale: 0, spellPower: 0, maxHealth: 0, health: 0 });
  const maxHealth = stats.maxHealth + bonus.maxHealth;

  return {
    ...stats,
    armyPower: stats.armyPower + bonus.armyPower,
    defensivePower: stats.defensivePower + bonus.defensivePower,
    morale: stats.morale + bonus.morale,
    spellPower: stats.spellPower + bonus.spellPower,
    maxHealth,
    health: Math.min(maxHealth, stats.health + bonus.maxHealth + bonus.health),
  };
}

function getDraftChoices(picksMade: number): MinionTemplate[] {
  const allowedTiers = picksMade < 3
    ? ['tier1']
    : picksMade < 6
      ? ['tier1', 'tier2']
      : ['tier2', 'tier3'];
  const candidates = MINION_TEMPLATES.filter(template => allowedTiers.includes(template.tier));
  return shuffle(candidates).slice(0, 4);
}

function addDraftMinion(session: RunSession, template: MinionTemplate): RunSession {
  const minions = [
    ...session.minions,
    {
      stack: cloneRunStack(template.templateId, `loaned-run-${session.id}-${session.minions.length}`),
      alive: true,
      origin: 'draft' as const,
    },
  ].slice(0, MAX_FIELD_MINIONS);
  const complete = minions.length >= MAX_FIELD_MINIONS;

  return {
    ...session,
    minions,
    formation: complete ? makeDefaultFormation(minions.map(unit => unit.stack)) : session.formation,
    phase: complete ? 'map' : 'draft',
    draftChoices: complete ? [] : getDraftChoices(minions.length),
    notice: complete ? 'Warband drafted. Start the first fight when ready.' : undefined,
  };
}

function makeDefaultFormation(stacks: MinionStack[]): Record<string, BoardCell> {
  const cells: BoardCell[] = [
    { x: 1, y: 3 },
    { x: 1, y: 2 },
    { x: 1, y: 4 },
    { x: 0, y: 2 },
    { x: 0, y: 4 },
    { x: 1, y: 1 },
    { x: 1, y: 5 },
  ];

  return stacks.reduce<Record<string, BoardCell>>((formation, stack, index) => {
    formation[stack.id] = cells[index] || { x: 1, y: Math.min(6, index) };
    return formation;
  }, {});
}

function isFormationCellAllowed(cell?: BoardCell): cell is BoardCell {
  if (!cell) return false;
  return Number.isInteger(cell.x)
    && Number.isInteger(cell.y)
    && cell.x >= 0
    && cell.x <= 1
    && cell.y >= 0
    && cell.y <= 6
    && !(cell.x === 0 && cell.y === 3);
}

function getFormationIssue(formation: Record<string, BoardCell>, stacks: MinionStack[]): string | null {
  const occupied = new Set<string>();

  for (const stack of stacks) {
    const cell = formation[stack.id];
    if (!isFormationCellAllowed(cell)) return 'Place every unit in an open left-side slot.';

    const cellKey = `${cell.x}:${cell.y}`;
    if (occupied.has(cellKey)) return 'Two units are using the same slot.';
    occupied.add(cellKey);
  }

  return null;
}

function pickRunSpellLoadout(seedLabel: string): string[] {
  const common = BATTLE_SPELLS.filter(spell => spell.rarity === 'common');
  const rare = BATTLE_SPELLS.filter(spell => spell.rarity === 'rare');
  const legendary = BATTLE_SPELLS.filter(spell => spell.rarity === 'legendary');
  const seed = seedLabel.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);

  return [
    common[seed % common.length],
    common[(seed + 3) % common.length],
    rare[(seed + 5) % rare.length],
    (seed % 5 === 0 ? legendary[seed % legendary.length] : rare[(seed + 9) % rare.length]),
  ].filter(Boolean).map(spell => spell.id).slice(0, 4);
}

function startDailyBattle(session: RunSession): RunSession {
  const nextBattle = session.wins + 1;
  const user = getCurrentUser();
  const userLevel = user?.stats.level || session.stats.level || 1;
  const enemyLevelOffset = session.dailyChallenge?.enemyLevelOffset || 0;
  const enemy = makeRunEnemy({
    session,
    index: nextBattle,
    level: clamp(userLevel + nextBattle - 2 + enemyLevelOffset, 1, 15),
    boss: nextBattle >= session.targetBattles,
  });

  return {
    ...session,
    phase: 'formation',
    formation: Object.keys(session.formation).length > 0
      ? session.formation
      : makeDefaultFormation(getAliveRunStacks(session)),
    activeEnemy: enemy,
    notice: undefined,
  };
}

function startDungeonNode(session: RunSession, node: DungeonNode): RunSession {
  const nodeIndex = session.nodes.findIndex(item => item.id === node.id);
  const reachableIds = getReachableNodeIds(session);
  const branchMap = hasBranchNodeLayout(session.nodes);
  const currentNode = session.nodes[session.currentNodeIndex];
  const canResolveNode = branchMap
    ? reachableIds.has(node.id)
    : Boolean(currentNode && node.id === currentNode.id);

  if (nodeIndex < 0 || !canResolveNode || node.completed) return session;

  if (node.type === 'shop') {
    return { ...session, currentNodeIndex: nodeIndex, phase: 'shop', notice: 'A merchant waits behind a black curtain.' };
  }

  if (node.type === 'event') {
    return { ...session, currentNodeIndex: nodeIndex, phase: 'event', notice: undefined };
  }

  return {
    ...session,
    currentNodeIndex: nodeIndex,
    phase: 'formation',
    formation: Object.keys(session.formation).length > 0
      ? session.formation
      : makeDefaultFormation(getAliveRunStacks(session)),
    activeEnemy: makeRunEnemy({
      session,
      index: node.battleNumber || getRunBattleNodeNumber(session, nodeIndex),
      level: node.level,
      boss: node.type === 'boss',
      elite: node.type === 'elite',
    }),
    notice: undefined,
  };
}

function makeRunEnemy({
  session,
  index,
  level,
  boss,
  elite = false,
}: {
  session: RunSession;
  index: number;
  level: number;
  boss: boolean;
  elite?: boolean;
}): WorldEnemy {
  const modelNumbers: PlayerModelNumber[] = [1, 2, 4, 5, 6];
  const personalities: EnemyAiPersonality[] = ['balanced', 'aggressive', 'defensive', 'arcane'];
  const dailyBossSolo = session.mode === 'daily' && boss;
  const effectiveLevel = dailyBossSolo ? level + 3 : level;
  const minionCount = dailyBossSolo
    ? 0
    : clamp(2 + Math.floor(level / 4) + (boss ? 2 : elite ? 1 : 0), 2, boss ? 7 : 6);
  const bossProfile = boss ? getBossProfileById(session.dailyChallenge?.bossId || session.dungeon?.bossId) : undefined;
  const runBoss = boss
    ? {
      id: bossProfile?.id || session.dailyChallenge?.bossId || session.dungeon?.bossId,
      name: bossProfile?.name || session.dailyChallenge?.bossName || session.dungeon?.bossName,
      subtitle: bossProfile?.subtitle || session.dailyChallenge?.bossSubtitle || session.dungeon?.bossSubtitle,
      story: bossProfile?.story || session.dailyChallenge?.bossStory || session.dungeon?.bossStory,
      intro: bossProfile?.intro || session.dailyChallenge?.bossIntro || session.dungeon?.bossIntro,
      artworkPath: bossProfile?.assetPath || session.dailyChallenge?.bossArtworkPath || session.dungeon?.bossArtworkPath,
      modelNumber: bossProfile?.modelNumber || session.dailyChallenge?.bossModelNumber || session.dungeon?.bossModelNumber,
      minionTemplates: bossProfile?.minionTemplates || session.dungeon?.bossMinionTemplates || [],
    }
    : undefined;
  const minions = Array.from({ length: minionCount }, (_, slot) => {
    const templateId = boss && runBoss?.minionTemplates.length
      ? runBoss.minionTemplates[slot % runBoss.minionTemplates.length]
      : pickEnemyTemplate(level, slot, boss || elite).templateId;
    return cloneRunStack(templateId, `enemy-${session.id}-${index}-${slot}`);
  });

  return {
    id: `${session.mode}-run-enemy-${session.id}-${index}`,
    bossId: runBoss?.id,
    name: runBoss?.name || (boss ? 'Run Warden' : elite ? 'Oathbound Captain' : `Road Adversary ${index}`),
    subtitle: runBoss?.subtitle || (boss ? 'Final commander' : elite ? 'Elite chamber guard' : 'Run encounter'),
    story: runBoss?.story,
    intro: runBoss?.intro,
    artworkPath: runBoss?.artworkPath,
    x: 0,
    y: 0,
    level: effectiveLevel,
    modelNumber: (runBoss?.modelNumber as PlayerModelNumber | undefined) || modelNumbers[index % modelNumbers.length],
    personality: boss ? 'boss' : personalities[index % personalities.length],
    minions,
    lootMultiplier: runBoss ? 2.2 : boss ? 1.7 : elite ? 1.35 : 1,
  };
}

function getRunBattleNodeNumber(session: RunSession, nodeIndex: number): number {
  const node = session.nodes[nodeIndex];
  if (node?.battleNumber) return node.battleNumber;

  return Math.max(
    1,
    session.nodes.slice(0, nodeIndex + 1).filter(node => ['battle', 'elite', 'boss'].includes(node.type)).length
  );
}

function pickEnemyTemplate(level: number, slot: number, elite: boolean): MinionTemplate {
  const targetTier = elite && level >= 10 && slot % 3 === 0
    ? 'tier3'
    : level >= 6 && slot % 2 === 0
      ? 'tier2'
      : 'tier1';
  const candidates = MINION_TEMPLATES.filter(template => template.tier === targetTier);
  return candidates[(level + slot) % candidates.length] || MINION_TEMPLATES[0];
}

function createDailyRunNodes(challenge: DailyRunChallenge, playerLevel: number): DungeonNode[] {
  const battleCount = clamp(challenge.targetBattles, 12, 18);
  const roadLabels = ['Road Watch', 'Bell Patrol', 'Ash Crossing', 'Moonlit Ambush', 'Candle Guard', 'Iron Vow', 'Root Camp', 'Saint Gate', 'Black Causeway', 'Pilgrim Cut'];
  const alternateLabels = ['Mire Flank', 'Ruined Toll', 'Old Causeway', 'Cinder Turn', 'Moon Ditch', 'Broken Mile'];
  const eliteLabels = ['Oath Captain', 'Relic Duelist', 'Black Banner Guard', 'Moonwell Marshal'];
  const shopLabels = ['Roadside Peddler', 'Black-Coin Cart', 'Pilgrim Quartermaster'];
  const eventLabels = ['Broken Shrine', 'Candle Pool', 'Ash Cache', 'Moon Omen'];
  const nodes: DungeonNode[] = [];
  let row = 0;

  const addRow = (specs: Array<{
    type: DungeonNodeType;
    label: string;
    description: string;
    level: number;
    battleNumber?: number;
  }>) => {
    const rowNodes = specs.map((spec, lane) => ({
      id: `daily-${challenge.date}-r${row}-l${lane}-${spec.type}-${spec.battleNumber || 'stop'}`,
      type: spec.type,
      label: spec.label,
      description: spec.description,
      iconPath: DUNGEON_NODE_ICONS[spec.type],
      level: spec.level,
      completed: false,
      row,
      lane,
      nextIds: [],
      battleNumber: spec.battleNumber,
    }));
    const previousRow = Math.max(-1, row - 1);
    const previousRowNodes = nodes.filter(node => node.row === previousRow);

    previousRowNodes
      .forEach(node => {
        node.nextIds = getAdjacentBranchNodeIds(node, previousRowNodes.length, rowNodes);
      });

    nodes.push(...rowNodes);
    row += 1;
  };

  for (let battleNumber = 1; battleNumber < battleCount; battleNumber += 1) {
    const battleIndex = battleNumber - 1;
    const baseLevel = clamp(playerLevel + battleIndex + (challenge.enemyLevelOffset || 0), 1, 24);
    const roadLabel = roadLabels[battleIndex % roadLabels.length];
    const alternateLabel = alternateLabels[battleIndex % alternateLabels.length];
    const eliteLabel = eliteLabels[battleIndex % eliteLabels.length];

    if (battleNumber === 1) {
      addRow([{
        type: 'battle',
        label: roadLabel,
        description: 'Opening fight. Clear it to reveal the first road split.',
        level: baseLevel,
        battleNumber,
      }]);
    } else if (battleNumber % 3 === 0) {
      addRow([
        {
          type: 'battle',
          label: roadLabel,
          description: 'Safer fight. Lower pressure, lower payout.',
          level: baseLevel,
          battleNumber,
        },
        {
          type: 'elite',
          label: eliteLabel,
          description: 'Elite fight. Harder enemy, better run-gold pressure.',
          level: clamp(baseLevel + 2, 1, 24),
          battleNumber,
        },
        {
          type: 'battle',
          label: alternateLabel,
          description: 'Alternate route. Similar danger with different enemy tempo.',
          level: clamp(baseLevel + 1, 1, 24),
          battleNumber,
        },
      ]);
    } else if (battleNumber % 4 === 0) {
      addRow([
        {
          type: 'battle',
          label: roadLabel,
          description: 'Standard fight toward the boss road.',
          level: baseLevel,
          battleNumber,
        },
        {
          type: 'elite',
          label: eliteLabel,
          description: 'Hard route. More danger now, more gold for shops.',
          level: clamp(baseLevel + 2, 1, 24),
          battleNumber,
        },
      ]);
    } else {
      addRow([{
        type: 'battle',
        label: roadLabel,
        description: 'A tactical road fight. Defeated enemies pay run gold.',
        level: baseLevel,
        battleNumber,
      }]);
    }

    if (battleNumber < battleCount - 1 && battleNumber % 2 === 0) {
      const shopIndex = Math.floor(battleNumber / 2) - 1;
      const eventIndex = Math.floor(battleNumber / 2) - 1;

      addRow([
        {
          type: 'shop',
          label: shopLabels[shopIndex % shopLabels.length],
          description: 'Spend only run gold on temporary upgrades. This stop does not count as a fight.',
          level: baseLevel,
        },
        {
          type: 'event',
          label: eventLabels[eventIndex % eventLabels.length],
          description: 'Risk a blessing, recruit, revive, wound, or coin payout. This stop does not count as a fight.',
          level: baseLevel,
        },
      ]);
    }
  }

  addRow([{
    type: 'boss',
    label: challenge.bossName,
    description: `${challenge.bossSubtitle}. A stronger lone commander ends the road.`,
    level: clamp(playerLevel + battleCount + 4 + (challenge.enemyLevelOffset || 0), 1, 24),
    battleNumber: battleCount,
  }]);

  return normalizeDailyRunNodes(nodes);
}

function normalizeDailyRunNodes(nodes: DungeonNode[]): DungeonNode[] {
  if (!hasBranchNodeLayout(nodes)) return nodes;

  const rows = getDailyNodeRows(nodes);
  const nextIdsByNodeId = new Map<string, string[]>();

  rows.forEach((row, rowIndex) => {
    const nextRow = rows[rowIndex + 1];
    if (!nextRow) {
      row.nodes.forEach(node => nextIdsByNodeId.set(node.id, []));
      return;
    }

    row.nodes.forEach(node => {
      nextIdsByNodeId.set(node.id, getAdjacentBranchNodeIds(node, row.nodes.length, nextRow.nodes));
    });
  });

  return nodes.map(node => ({
    ...node,
    nextIds: nextIdsByNodeId.get(node.id) || node.nextIds || [],
  }));
}

function getAdjacentBranchNodeIds(sourceNode: DungeonNode, sourceRowSize: number, nextRowNodes: DungeonNode[]): string[] {
  if (nextRowNodes.length <= 1 || sourceRowSize <= 1) return nextRowNodes.map(node => node.id);

  const sourceLane = sourceNode.lane ?? 0;
  if (sourceRowSize === nextRowNodes.length) {
    return nextRowNodes
      .filter(node => (node.lane ?? 0) === sourceLane)
      .map(node => node.id);
  }

  if (sourceRowSize === 2 && nextRowNodes.length === 3) {
    const targetLane = sourceLane === 0 ? 0 : 2;
    return nextRowNodes
      .filter(node => (node.lane ?? 0) === targetLane)
      .map(node => node.id);
  }

  if (sourceRowSize === 3 && nextRowNodes.length === 2) {
    const targetLanes = sourceLane === 0 ? [0] : sourceLane === 2 ? [1] : [0, 1];
    return nextRowNodes
      .filter(node => targetLanes.includes(node.lane ?? 0))
      .map(node => node.id);
  }

  const sourceCenter = sourceLane / Math.max(1, sourceRowSize - 1);
  return [
    nextRowNodes
      .map(node => ({
        node,
        distance: Math.abs((node.lane ?? 0) / Math.max(1, nextRowNodes.length - 1) - sourceCenter),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.node,
  ].filter((node): node is DungeonNode => Boolean(node)).map(node => node.id);
}

function createDungeonNodes(dungeon: WorldDungeon): DungeonNode[] {
  const labels: Record<DungeonNodeType, string[]> = {
    battle: ['Outer Guard', 'Candle Hall', 'Broken Nave'],
    elite: ['Iron Door', 'Vow Captain', 'Reliquary Watch'],
    shop: ['Black-Coin Merchant', 'Bone Market', 'Hidden Peddler'],
    event: RUN_EVENT_LABELS,
    boss: [dungeon.bossName],
  };
  const defaultTypes: DungeonNodeType[] = dungeon.level >= 10
    ? ['battle', 'event', 'elite', 'shop', 'battle', 'event', 'boss']
    : ['battle', 'event', 'shop', 'battle', 'elite', 'boss'];
  const authoredLayout = DUNGEON_LAYOUTS[dungeon.templateId];
  const nodeSpecs = authoredLayout || defaultTypes.map((type, index) => ({
    type,
    label: labels[type][index % labels[type].length],
  }));

  return nodeSpecs.map((spec, index) => ({
    id: `${dungeon.id}-node-${index}`,
    type: spec.type,
    label: spec.type === 'boss' ? dungeon.bossName : spec.label,
    description: spec.description || getNodeDescription(spec.type, dungeon),
    iconPath: DUNGEON_NODE_ICONS[spec.type],
    level: clamp(dungeon.level + (spec.type === 'boss' ? 2 : spec.type === 'elite' ? 1 : 0), 1, 20),
    completed: false,
  }));
}

function getNodeDescription(type: DungeonNodeType, dungeon: WorldDungeon): string {
  switch (type) {
    case 'shop':
      return 'Spend run gold on temporary blessings before the next chamber.';
    case 'event':
      return 'A chance pool can wound, bless, revive, or reward the warband.';
    case 'elite':
      return 'A stronger guard blocks a better reward choice.';
    case 'boss':
      return `${dungeon.bossSubtitle}. Win here to claim the dungeon reward.`;
    default:
      return 'A tactical fight against dungeon defenders.';
  }
}

function getRewardDestination(session: RunSession, nextWins: number): RewardDestination {
  if (session.mode === 'daily') {
    if (session.nodes.length > 0) {
      const node = session.nodes[session.currentNodeIndex];
      return node?.type === 'boss' || nextWins >= session.targetBattles ? 'complete' : 'dungeon-next';
    }
    return nextWins >= session.targetBattles ? 'complete' : 'daily-next';
  }
  return session.currentNodeIndex >= session.nodes.length - 1 ? 'complete' : 'dungeon-next';
}

function completeDungeonNode(session: RunSession): RunSession {
  const currentNode = session.nodes[session.currentNodeIndex];
  const nodes = session.nodes.map((node, index) => (
    index === session.currentNodeIndex ? { ...node, completed: true } : node
  ));
  const branchMap = hasBranchNodeLayout(nodes);
  const nextIndex = branchMap && currentNode?.nextIds?.length
    ? nodes.findIndex(node => currentNode.nextIds?.includes(node.id) && !node.completed)
    : session.currentNodeIndex + 1;

  if (currentNode?.type === 'boss' || nextIndex < 0 || nextIndex >= nodes.length) {
    return {
      ...session,
      nodes,
      currentNodeIndex: nextIndex,
      phase: 'complete',
      outcome: 'victory',
      notice: session.mode === 'daily' ? 'The daily road is complete.' : 'The dungeon path is complete.',
    };
  }

  return {
    ...session,
    nodes,
    currentNodeIndex: nextIndex,
    phase: 'map',
  };
}

function getRunGoldEarned(session: RunSession, battle: BattleState): number {
  const defeatedEnemies = battle.units.filter(unit => unit.side === 'enemy' && unit.currentHealth <= 0);
  const commanderDefeated = defeatedEnemies.some(unit => unit.kind === 'commander');
  const node = session.nodes[session.currentNodeIndex];
  const nodeBonus = node?.type === 'boss' ? 75 : node?.type === 'elite' ? 24 : 0;
  const perUnit = 8 + Math.floor(battle.enemy.level / 4);
  const base = defeatedEnemies.length * perUnit + (commanderDefeated ? 20 : 0) + nodeBonus;

  return Math.max(12, Math.round(base * (battle.enemy.lootMultiplier || 1)));
}

function applyBattleLossesToRun(session: RunSession, battle: BattleState): RunSession {
  const fallenIds = new Set(
    battle.units
      .filter(unit => unit.side === 'player' && unit.kind === 'minion' && unit.currentHealth <= 0 && unit.rosterId)
      .map(unit => unit.rosterId as string)
  );

  if (fallenIds.size === 0) return session;

  return {
    ...session,
    minions: session.minions.map(unit => fallenIds.has(unit.stack.id) ? { ...unit, alive: false } : unit),
  };
}

function persistRunBattleHealth(session: RunSession, battle: BattleState): RunSession {
  const healthByRosterId = new Map<string, number>();

  battle.units.forEach(unit => {
    if (unit.side !== 'player' || unit.kind !== 'minion' || !unit.rosterId) return;
    healthByRosterId.set(unit.rosterId, Math.max(0, Math.round(unit.currentHealth)));
  });

  if (healthByRosterId.size === 0) return session;

  return {
    ...session,
    minions: session.minions.map(unit => {
      const carriedHealth = healthByRosterId.get(unit.stack.id);
      if (carriedHealth === undefined) return unit;

      return {
        ...unit,
        stack: {
          ...unit.stack,
          runCurrentHealth: carriedHealth,
        },
      };
    }),
  };
}

function appendRunBattleReport(session: RunSession, report: RunBattleReport): RunSession {
  return {
    ...session,
    battleReports: [...(session.battleReports || []), report].slice(-12),
  };
}

function createRunBattleReport(battle: BattleState, status: BattleEndResult['status']): RunBattleReport {
  const unitReports = battle.units
    .filter(unit => unit.side === 'player')
    .map(unit => {
      const damageDealt = battle.log
        .filter(entry => entry.actorId === unit.id && (entry.action === 'attack' || entry.action === 'spell'))
        .reduce((total, entry) => total + getBattleLogAmount(entry.message), 0);
      const damageTaken = battle.log
        .filter(entry => entry.targetIds?.includes(unit.id) && entry.side === 'enemy' && (entry.action === 'attack' || entry.action === 'spell'))
        .reduce((total, entry) => total + getBattleLogAmount(entry.message), 0);
      const healingDone = battle.log
        .filter(entry => entry.actorId === unit.id && (entry.action === 'heal' || entry.action === 'morale'))
        .reduce((total, entry) => total + getBattleLogAmount(entry.message), 0);

      return {
        id: unit.id,
        name: unit.name,
        assetPath: unit.assetPath,
        side: unit.side,
        alive: unit.currentHealth > 0,
        damageDealt,
        damageTaken,
        healingDone,
      };
    });

  return {
    id: `${battle.id}-${status}-${Date.now()}`,
    enemyName: battle.enemy.name,
    enemyAssetPath: battle.enemy.artworkPath || getPlayerModelAsset(battle.enemy.modelNumber),
    enemyLevel: battle.enemy.level,
    enemyPersonality: battle.enemy.personality,
    status,
    round: battle.round,
    durationMs: Math.max(0, Date.now() - battle.createdAt),
    damageDealt: unitReports.reduce((total, unit) => total + unit.damageDealt, 0),
    damageTaken: unitReports.reduce((total, unit) => total + unit.damageTaken, 0),
    healingDone: unitReports.reduce((total, unit) => total + unit.healingDone, 0),
    unitReports,
  };
}

function getBattleLogAmount(message: string): number {
  const match = message.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : 0;
}

function formatRunDuration(durationMs: number): string {
  if (durationMs <= 0) return '0s';
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function pickRunRewardChoices(session: RunSession, count = RUN_REWARD_CHOICE_COUNT): RunRewardChoice[] {
  const available = RUN_BUFFS.filter(choice => !choice.isAvailable || choice.isAvailable(session));
  const pool = available.length >= count ? available : RUN_BUFFS.filter(choice => !choice.isAvailable);
  return shuffle(pool).slice(0, count);
}

function buyShopReward(session: RunSession, choice: RunRewardChoice, cost: number): RunSession {
  if (session.runGold < cost) return session;
  return completeDungeonNode({
    ...choice.apply({ ...session, runGold: session.runGold - cost }),
    notice: `${choice.name} purchased for ${cost} run gold.`,
  });
}

function rollDungeonEventOutcome(session: RunSession): OmenOutcome {
  const roll = Math.random();

  if (roll < 0.2) {
    const alive = session.minions
      .map((unit, index) => ({ unit, index }))
      .filter(item => item.unit.alive);
    const chosen = shuffle(alive)[0];

    if (!chosen) {
      return {
        id: 'curse-gold',
        title: 'Hollow Tithe',
        flavor: 'The omen finds no living target and takes coin instead.',
        detail: '30 run gold is pulled from your purse.',
        tone: 'curse',
        apply: current => ({ ...current, runGold: Math.max(0, current.runGold - 30) }),
      };
    }

    const name = getMinionTemplate(chosen.unit.stack.templateId)?.name || 'A minion';
    return {
      id: 'curse',
      title: 'Black Sigil',
      flavor: 'A curse bites the chamber and the warband recoils.',
      detail: `${name} is struck down by the omen.`,
      tone: 'curse',
      apply: current => woundSpecificMinion(current, chosen.index),
    };
  }

  if (roll < 0.4) {
    const template = shuffle(MINION_TEMPLATES.filter(item => item.tier === 'tier1'))[0] || MINION_TEMPLATES[0];
    return {
      id: 'recruit',
      title: 'Lost Pilgrim',
      flavor: 'A wanderer steps out of the smoke and kneels at your banner.',
      detail: `${template.name} joins the run.`,
      tone: 'recruit',
      apply: current => addRunMinionFromTemplate(current, template, `${template.name} joins the run.`),
    };
  }

  if (roll < 0.6) {
    return {
      id: 'ward',
      title: 'Event Ward',
      flavor: 'Moonlit water clings to your armor like a blessing.',
      detail: '+2 Defensive Power for the rest of this run.',
      tone: 'ward',
      apply: current => makeStatBuff('event-ward', 'Event Ward', '+2 Defensive Power from the pool.', { defensivePower: 2 }).apply(current),
    };
  }

  if (roll < 0.8) {
    if (!hasFallenMinions(session)) {
      return {
        id: 'gold-fallback',
        title: 'Quiet Echo',
        flavor: 'No fallen soul answers the bell, so the omen leaves coin instead.',
        detail: 'You gain 40 run gold.',
        tone: 'gold',
        apply: current => ({ ...current, runGold: current.runGold + 40 }),
      };
    }

    return {
      id: 'revive',
      title: 'Pool Revival',
      flavor: 'Cold water surges and drags a fallen fighter back to their feet.',
      detail: 'One fallen minion returns to the run.',
      tone: 'blessing',
      apply: current => resurrectMinions(current, 1),
    };
  }

  return {
    id: 'gold',
    title: 'Black Coin Spill',
    flavor: 'The pool coughs up treasure before sinking back into silence.',
    detail: 'You gain 70 run gold.',
    tone: 'gold',
    apply: current => ({ ...current, runGold: current.runGold + 70 }),
  };
}

function applyDungeonEventOutcome(session: RunSession, outcome: OmenOutcome): RunSession {
  return completeDungeonNode({ ...outcome.apply(session), notice: outcome.detail });
}

function grantCompletionReward(session: RunSession): string {
  const user = getCurrentUser();
  if (!user || session.outcome !== 'victory') return 'No reward was claimed.';

  const completedAt = Date.now();
  const isDungeon = session.mode === 'dungeon';
  if (!isDungeon && hasCompletedDailyRunToday(user)) {
    return 'Daily run reward already claimed today.';
  }

  const nextDailyStreak = isDungeon ? 0 : getNextDailyRunStreak(user, completedAt);
  const streakGoldBonus = isDungeon ? 0 : Math.min(nextDailyStreak, 7) * 15;
  const streakExpBonus = isDungeon ? 0 : Math.min(nextDailyStreak, 7) * 2;
  const challenge = isDungeon ? undefined : session.dailyChallenge || getDailyRunChallenge(completedAt);
  const runGoldConversion = isDungeon ? Math.floor(session.runGold * 0.35) : session.runGold;
  const baseGold = (isDungeon ? 110 : 80) + session.wins * (isDungeon ? 45 : 32) + runGoldConversion + streakGoldBonus;
  const baseExp = (isDungeon ? 45 : 25) + session.wins * (isDungeon ? 12 : 7) + streakExpBonus;
  const gold = Math.round(baseGold * (challenge?.rewardGoldMultiplier || 1));
  const exp = Math.round(baseExp * (challenge?.rewardExpMultiplier || 1));
  const rareGems = isDungeon ? Math.max(1, Math.floor(session.wins / 2)) : 1;
  const rarity: EquipmentRarity = isDungeon
    ? session.wins >= 5 ? 'epic' : 'rare'
    : session.wins >= 6 ? 'rare' : 'decent';
  const equipment = [generateEquipment(0, rarity)].filter(Boolean) as Equipment[];
  const slots = user.inventorySlots || 20;
  const weeklyRewardItems = !isDungeon && challenge?.weeklyRewardItemId
    ? [makeInventoryItem(challenge.weeklyRewardItemId)]
    : [];
  const rewardItems: InventoryItem[] = [
    makeInventoryItem('rare-gem', rareGems),
    ...weeklyRewardItems,
    ...rollInventoryBonusDrops(user.stats.level || 1, isDungeon ? 'dungeonRun' : 'dailyRun'),
  ];
  const itemResult = addInventoryItemsWithLimit(user.inventory || [], rewardItems, slots);
  const acceptedGems = itemResult.acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);
  const clearedNodes = session.nodes
    .filter(node => node.completed)
    .map(node => node.label);
  const rewardSummary = [
    `${gold} gold`,
    `${exp} XP`,
    acceptedGems > 0 ? `${acceptedGems} gem${acceptedGems === 1 ? '' : 's'}` : '',
    ...itemResult.acceptedItems
      .filter(item => item.id !== 'rare-gem')
      .map(item => item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name),
    ...equipment.map(item => item.name),
  ].filter(Boolean);

  const activity: ActivityEntry = {
    id: `activity-run-${session.id}-${completedAt}`,
    type: isDungeon ? 'battle' : 'quest',
    title: isDungeon ? `${session.title} Cleared` : `${challenge?.name || 'Daily Run'} Cleared`,
    source: isDungeon ? 'Dungeon Run' : 'Daily Run',
    completedAt,
    rewards: {
      gold,
      exp,
      rareGems: acceptedGems || undefined,
      items: itemResult.acceptedItems.length > 0 ? itemResult.acceptedItems : undefined,
      equipment: equipment.length > 0 ? equipment : undefined,
    },
    description: isDungeon
      ? `${session.wins} battles won with ${getAliveRunStacks(session).length} units standing. Route: ${clearedNodes.join(' -> ')}. Rewards: ${rewardSummary.join(', ')}.`
      : `${session.wins} battles won with ${getAliveRunStacks(session).length} units standing${challenge ? ` during ${challenge.weeklyRewardName}.` : '.'}`,
  };
  const dailyRun = isDungeon
    ? user.dailyRun
    : recordDailyRunCompletionState(user, {
      completedAt,
      wins: session.wins,
      targetBattles: session.targetBattles,
      unitsStanding: getAliveRunStacks(session).length,
      gold,
      exp,
      rareGems: acceptedGems || undefined,
      itemNames: itemResult.acceptedItems.map(item => item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name),
      equipmentNames: equipment.map(item => item.name),
      challengeName: challenge?.name,
      weeklyRewardName: challenge?.weeklyRewardName,
    });

  updateCurrentUser({
    gold: user.gold + gold,
    exp: user.exp + exp,
    inventory: itemResult.inventory,
    equipment: [...(user.equipment || []), ...equipment],
    dailyRun,
    activityLog: [activity, ...(user.activityLog || [])].slice(0, 30),
  });
  levelUp();

  return itemResult.rejectedItems.length > 0
    ? `Claimed ${gold} gold and ${exp} XP. Satchel was full for some items.`
    : `Claimed ${gold} gold, ${exp} XP, ${acceptedGems} gem, bonus items, and ${rarity} gear${isDungeon ? '' : ` (streak ${nextDailyStreak}, ${challenge?.weeklyRewardName})`}.`;
}

function makeStatBuff(
  id: string,
  name: string,
  description: string,
  bonus: Partial<Pick<CharacterStats, 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth' | 'health'>>
): RunRewardChoice {
  return {
    id,
    name,
    description,
    apply: session => ({
      ...session,
      stats: {
        ...session.stats,
        armyPower: session.stats.armyPower + (bonus.armyPower || 0),
        defensivePower: session.stats.defensivePower + (bonus.defensivePower || 0),
        morale: session.stats.morale + (bonus.morale || 0),
        spellPower: session.stats.spellPower + (bonus.spellPower || 0),
        maxHealth: session.stats.maxHealth + (bonus.maxHealth || 0),
        health: Math.min(
          session.stats.maxHealth + (bonus.maxHealth || 0),
          session.stats.health + (bonus.health || 0)
        ),
      },
      notice: `${name} claimed.`,
    }),
  };
}

function hasFallenMinions(session: RunSession): boolean {
  return session.minions.some(unit => !unit.alive);
}

function canAddRunMinion(session: RunSession): boolean {
  return session.minions.length < MAX_FIELD_MINIONS || hasFallenMinions(session);
}

function hasUpgradeableMinion(session: RunSession): boolean {
  return session.minions.some(unit => unit.alive && Boolean(getNextTierTemplate(unit.stack.templateId)));
}

function resurrectMinions(session: RunSession, count: number): RunSession {
  let remaining = count;

  return {
    ...session,
    minions: session.minions.map(unit => {
      if (unit.alive || remaining <= 0) return unit;
      remaining -= 1;
      return { ...unit, alive: true, stack: { ...unit.stack, runCurrentHealth: undefined } };
    }),
    notice: count > 1 ? 'Fallen minions return to the run.' : 'One fallen minion returns to the run.',
  };
}

function resurrectAllMinions(session: RunSession): RunSession {
  return {
    ...session,
    minions: session.minions.map(unit => ({ ...unit, alive: true, stack: { ...unit.stack, runCurrentHealth: undefined } })),
    notice: 'All fallen minions return to the run.',
  };
}

function addRandomRunMinion(session: RunSession, tier: MinionTemplate['tier'], notice?: string): RunSession {
  const template = shuffle(MINION_TEMPLATES.filter(item => item.tier === tier))[0] || MINION_TEMPLATES[0];
  const replacementIndex = session.minions.findIndex(unit => !unit.alive);
  const newUnit: RunUnit = {
    stack: cloneRunStack(template.templateId, `loaned-reward-${session.id}-${Date.now()}`),
    alive: true,
    origin: 'reward',
  };

  if (replacementIndex >= 0) {
    return {
      ...session,
      minions: session.minions.map((unit, index) => index === replacementIndex ? newUnit : unit),
      notice: notice || `${template.name} replaces a fallen slot for this run.`,
    };
  }

  if (session.minions.length >= MAX_FIELD_MINIONS) return session;

  return {
    ...session,
    minions: [...session.minions, newUnit],
    notice: notice || `${template.name} joins the run.`,
  };
}

function upgradeRandomMinion(session: RunSession): RunSession {
  const candidates = session.minions
    .map((unit, index) => ({ unit, index, nextTemplate: unit.alive ? getNextTierTemplate(unit.stack.templateId) : undefined }))
    .filter(item => item.nextTemplate);
  const chosen = shuffle(candidates)[0];

  if (!chosen?.nextTemplate) return session;

  return {
    ...session,
    minions: session.minions.map((unit, index) => (
      index === chosen.index
        ? { ...unit, stack: { ...unit.stack, templateId: chosen.nextTemplate?.templateId || unit.stack.templateId, runCurrentHealth: undefined } }
        : unit
    )),
    notice: `${chosen.nextTemplate.name} joins the front line.`,
  };
}

function getNextTierTemplate(templateId: string): MinionTemplate | undefined {
  const template = getMinionTemplate(templateId);
  if (!template || template.tier === 'tier3') return undefined;

  const nextTier = template.tier === 'tier1' ? 'tier2' : 'tier3';
  return MINION_TEMPLATES.find(item => item.class === template.class && item.tier === nextTier);
}

function woundSpecificMinion(session: RunSession, index: number): RunSession {
  const target = session.minions[index];
  if (!target?.alive) return session;

  return {
    ...session,
    minions: session.minions.map((unit, unitIndex) => (
      unitIndex === index
        ? { ...unit, alive: false, stack: { ...unit.stack, runCurrentHealth: 0 } }
        : unit
    )),
  };
}

function addRunMinionFromTemplate(session: RunSession, template: MinionTemplate, notice: string): RunSession {
  const replacementIndex = session.minions.findIndex(unit => !unit.alive);
  const newUnit: RunUnit = {
    stack: cloneRunStack(template.templateId, `loaned-reward-${session.id}-${Date.now()}`),
    alive: true,
    origin: 'reward',
  };

  if (replacementIndex >= 0) {
    return {
      ...session,
      minions: session.minions.map((unit, index) => index === replacementIndex ? newUnit : unit),
      notice,
    };
  }

  if (session.minions.length >= MAX_FIELD_MINIONS) return { ...session, notice };

  return {
    ...session,
    minions: [...session.minions, newUnit],
    notice,
  };
}

function getAliveRunStacks(session: RunSession): MinionStack[] {
  return session.minions.filter(unit => unit.alive).map(unit => unit.stack).slice(0, MAX_FIELD_MINIONS);
}

function cloneRunStack(templateId: string, prefix: string): MinionStack {
  return {
    id: `${prefix}-${templateId}-${Math.random().toString(16).slice(2)}`,
    templateId,
    quantity: 1,
    acquiredAt: Date.now(),
    fielded: true,
  };
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
