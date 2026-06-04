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
    description: '+60 run gold for dungeon shops.',
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
  const isFormationPhase = session.phase === 'formation';

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

      const withLosses = appendRunBattleReport(
        applyBattleLossesToRun(current, result.battle),
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

      return {
        ...withLosses,
        phase: 'reward',
        activeEnemy: null,
        wins: nextWins,
        runGold: withLosses.runGold + 25 + result.battle.enemy.level * 3,
        rewardChoices: pickRunRewardChoices(withLosses),
        rewardDestination,
        notice: `${result.battle.enemy.name} defeated. Choose a run reward.`,
      };
    });
  };

  const handleRewardChoice = (choice: RunRewardChoice) => {
    if (session.rewardDestination === 'complete') triggerCompletionIntro();

    setSession(current => {
      if (!current) return current;
      const applied = choice.apply(current);

      if (applied.rewardDestination === 'complete') {
        return {
          ...applied,
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
    <div className="run-modal-layer fixed inset-0 z-[68] flex items-center justify-center bg-black/76 p-4 text-zinc-100 backdrop-blur-sm">
      <section className={`run-modal-panel command-panel vine-frame flex max-h-[94vh] w-full flex-col overflow-hidden rounded border ${isFormationPhase ? 'run-formation-modal max-w-5xl' : 'max-w-6xl'}`}>
        <header className="panel-header flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <div className="arcane-label">{isFormationPhase ? 'Formation' : kicker || (session.mode === 'daily' ? 'Daily roguelike chain' : 'Dungeon path')}</div>
            <h2 className="fantasy-heading text-2xl">{session.title}</h2>
            <p className="ui-muted mt-1 text-xs font-bold">
              {isFormationPhase
                ? `${getAliveRunStacks(session).length}/${session.minions.length} units ready`
                : `${session.wins}/${session.targetBattles} battles won - ${getAliveRunStacks(session).length}/${session.minions.length} units standing - ${session.runGold} run gold`}
            </p>
            {!isFormationPhase && session.dailyChallenge && (
              <p className="ui-faint mt-1 text-xs font-bold">
                {session.dailyChallenge.subtitle} - {session.dailyChallenge.weeklyRewardName}
              </p>
            )}
          </div>
          <button onClick={onClose} className="ui-button rounded px-3 py-2 text-xs font-bold">
            Close
          </button>
        </header>

        {session.notice && session.phase !== 'complete' && (
          <div className="ui-notice border-b px-5 py-3 text-sm font-bold">
            {session.notice}
          </div>
        )}

        <div className={`grid min-h-0 flex-1 gap-5 ${isFormationPhase ? 'overflow-hidden p-3' : session.phase === 'complete' ? 'overflow-y-auto p-5' : 'overflow-y-auto p-5 lg:grid-cols-[18rem_minmax(0,1fr)]'}`}>
          {!isFormationPhase && session.phase !== 'complete' && <RunRoster session={session} />}

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
              <EventPanel
                session={session}
                onResolve={() => setSession(current => current ? resolveDungeonEvent(current) : current)}
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
}: {
  session: RunSession;
  onChangeFormation: (formation: Record<string, BoardCell>) => void;
  onStart: () => void;
  onBack: () => void;
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
  };

  return (
    <div className="formation-minimal-shell">
      <section className="formation-minimal-toolbar rounded">
        <div>
          <div className="arcane-label">Place Units</div>
          <h3 className="fantasy-heading text-xl">Formation</h3>
          <div className="formation-guide-row mt-1 flex flex-wrap gap-2">
            <span>I. Pick a unit</span>
            <span>II. Click a slot</span>
            <span>C is fixed</span>
          </div>
        </div>
        <div className="formation-selected-chip">
          {selectedTemplate && <MinionPortrait template={selectedTemplate} size="tiny" />}
          <span className="formation-tier-mark">{selectedTemplate ? getTierRoman(selectedTemplate.tier) : '-'}</span>
          <span className="ui-faint text-[10px] font-black">{selectedIndex + 1}/{aliveUnits.length}</span>
        </div>
        <div className="formation-toolbar-actions">
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
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
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
                onClick={() => stack ? setSelectedStackId(stack.id) : assignSelectedToCell({ x, y })}
                className={`formation-cell formation-cell-minimal relative rounded ${isCommanderCell ? 'formation-cell-commander' : stack?.id === selectedStackId ? 'formation-cell-selected' : ''}`}
                aria-label={isCommanderCell ? 'Commander fixed slot' : template ? `${template.name} tier ${getTierRoman(template.tier)}` : `Open slot ${index + 1}`}
                title={isCommanderCell ? 'Commander fixed' : template?.name || 'Open slot'}
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
  if (session.mode === 'daily') {
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

  return (
    <div className="space-y-5">
      <section className="ui-card rounded border p-4">
        <div className="arcane-label">Dungeon Path</div>
        <h3 className="fantasy-heading text-xl">Choose the next chamber</h3>
        <p className="ui-muted mt-1 text-sm font-bold">
          Battles, shops, and chance pools appear between the entrance and boss. Only the next node can be resolved for now.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {session.nodes.map((node, index) => {
          const isCurrent = index === session.currentNodeIndex;
          const locked = index > session.currentNodeIndex;

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
                      className="object-contain p-1.5"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </span>
                  <div className="min-w-0">
                    <div className="arcane-label">{node.type}</div>
                    <h4 className="fantasy-heading truncate text-base">{node.label}</h4>
                  </div>
                </div>
                <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">
                  {node.completed ? 'Done' : locked ? 'Locked' : 'Next'}
                </span>
              </div>
              <p className="ui-muted mt-2 text-xs font-bold">{node.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RewardPanel({ choices, onChoose }: { choices: RunRewardChoice[]; onChoose: (choice: RunRewardChoice) => void }) {
  return (
    <div className="space-y-5">
      <section className="ui-card rounded border p-4">
        <div className="arcane-label">Run Reward</div>
        <h3 className="fantasy-heading text-xl">Choose One</h3>
        <p className="ui-muted mt-1 text-sm font-bold">These bonuses last only inside the current run.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map(choice => (
          <button
            key={choice.id}
            onClick={() => onChoose(choice)}
            className="ui-card rounded border p-4 text-left transition hover:border-[rgba(232,217,184,0.46)]"
          >
            <div className="fantasy-heading text-base">{choice.name}</div>
            <p className="ui-muted mt-1 text-sm font-bold">{choice.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
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
  const choices = pickRunRewardChoices(session).slice(0, 4);

  return (
    <div className="space-y-5">
      <section className="ui-card rounded border p-4">
        <div className="arcane-label">Dungeon Shop</div>
        <h3 className="fantasy-heading text-xl">Black-Coin Merchant</h3>
        <p className="ui-muted mt-1 text-sm font-bold">Spend run gold on a temporary blessing, or leave the chamber.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((choice, index) => {
          const cost = 35 + index * 20;
          const canAfford = session.runGold >= cost;

          return (
            <button
              key={choice.id}
              onClick={() => onBuy(choice, cost)}
              disabled={!canAfford}
              className="ui-card rounded border p-4 text-left transition hover:border-[rgba(232,217,184,0.46)] disabled:opacity-40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="fantasy-heading text-base">{choice.name}</div>
                <span className="ui-value text-xs font-black">{cost}g</span>
              </div>
              <p className="ui-muted mt-1 text-sm font-bold">{choice.description}</p>
            </button>
          );
        })}
      </div>
      <button onClick={onSkip} className="ui-button rounded px-4 py-2 text-sm font-bold">
        Leave Shop
      </button>
    </div>
  );
}

function EventPanel({ session, onResolve }: { session: RunSession; onResolve: () => void }) {
  const node = session.nodes[session.currentNodeIndex];

  return (
    <div className="space-y-5">
      <section className="ui-card rounded border p-5 text-center">
        <div className="arcane-label">{node?.label || 'Chance Pool'}</div>
        <h3 className="fantasy-heading text-2xl">Touch the Dark Pool</h3>
        <p className="ui-muted mx-auto mt-2 max-w-lg text-sm font-bold">
          The chamber can bless the warband, call a recruit, steal coin, or wound a unit.
        </p>
        <button onClick={onResolve} className="ui-button-primary mt-5 rounded px-5 py-3 text-sm font-black">
          Resolve Event
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
            <RunRoster session={session} />
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
                className="run-minion-portrait-image sprite-soft-glow object-contain"
                style={{ imageRendering: 'auto' }}
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

function RunRoster({ session }: { session: RunSession }) {
  return (
    <aside className="space-y-4">
      <section className="ui-card rounded border p-4">
        <div className="arcane-label">Commander</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[10px] font-black">
          <RunStat label="Army" value={session.stats.armyPower} />
          <RunStat label="Ward" value={session.stats.defensivePower} />
          <RunStat label="Morale" value={session.stats.morale} />
          <RunStat label="Spell" value={session.stats.spellPower} />
        </div>
      </section>

      <section>
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
        className="run-minion-portrait-image sprite-soft-glow object-contain"
        style={{ imageRendering: 'auto' }}
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

  return {
    ...session,
    dailyChallenge: challenge,
    formation: storedSession.formation || makeDefaultFormation(storedSession.minions.filter(unit => unit.alive).map(unit => unit.stack)),
    spellIds: storedSession.spellIds?.length ? storedSession.spellIds.slice(0, 4) : pickRunSpellLoadout(challenge.date),
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

  return {
    id: `daily-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    mode: 'daily',
    title: dailyChallenge.name,
    phase: 'draft',
    stats: applyDailyChallengeStats(cloneRunStats(user.stats), dailyChallenge),
    minions: [],
    draftChoices: getDraftChoices(0),
    wins: 0,
    targetBattles: dailyChallenge.targetBattles,
    runGold: 0,
    activeEnemy: null,
    formation: {},
    spellIds: pickRunSpellLoadout(dailyChallenge.date),
    rewardChoices: [],
    rewardDestination: null,
    nodes: [],
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
  const currentNode = session.nodes[session.currentNodeIndex];
  if (!currentNode || node.id !== currentNode.id || node.completed) return session;

  if (node.type === 'shop') {
    return { ...session, phase: 'shop', notice: 'A merchant waits behind a black curtain.' };
  }

  if (node.type === 'event') {
    return { ...session, phase: 'event', notice: 'The chamber hums with a random omen.' };
  }

  return {
    ...session,
    phase: 'formation',
    formation: Object.keys(session.formation).length > 0
      ? session.formation
      : makeDefaultFormation(getAliveRunStacks(session)),
    activeEnemy: makeRunEnemy({
      session,
      index: session.currentNodeIndex + 1,
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
  const minionCount = clamp(2 + Math.floor(level / 4) + (boss ? 2 : elite ? 1 : 0), 2, boss ? 7 : 6);
  const dailyBoss = session.mode === 'daily' && boss ? session.dailyChallenge : undefined;
  const minions = Array.from({ length: minionCount }, (_, slot) => {
    const template = pickEnemyTemplate(level, slot, boss || elite);
    return cloneRunStack(template.templateId, `enemy-${session.id}-${index}-${slot}`);
  });

  return {
    id: `${session.mode}-run-enemy-${session.id}-${index}`,
    name: dailyBoss?.bossName || (boss ? 'Run Warden' : elite ? 'Oathbound Captain' : `Road Adversary ${index}`),
    subtitle: dailyBoss?.bossSubtitle || (boss ? 'Final commander' : elite ? 'Elite chamber guard' : 'Run encounter'),
    x: 0,
    y: 0,
    level,
    modelNumber: (dailyBoss?.bossModelNumber as PlayerModelNumber | undefined) || modelNumbers[index % modelNumbers.length],
    personality: boss ? 'boss' : personalities[index % personalities.length],
    minions,
    lootMultiplier: dailyBoss ? 1.85 : boss ? 1.7 : elite ? 1.35 : 1,
  };
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
  if (session.mode === 'daily') return nextWins >= session.targetBattles ? 'complete' : 'daily-next';
  return session.currentNodeIndex >= session.nodes.length - 1 ? 'complete' : 'dungeon-next';
}

function completeDungeonNode(session: RunSession): RunSession {
  const nodes = session.nodes.map((node, index) => (
    index === session.currentNodeIndex ? { ...node, completed: true } : node
  ));
  const nextIndex = session.currentNodeIndex + 1;

  if (nextIndex >= nodes.length) {
    return {
      ...session,
      nodes,
      currentNodeIndex: nextIndex,
      phase: 'complete',
      outcome: 'victory',
      notice: 'The dungeon path is complete.',
    };
  }

  return {
    ...session,
    nodes,
    currentNodeIndex: nextIndex,
    phase: 'map',
  };
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

function pickRunRewardChoices(session: RunSession): RunRewardChoice[] {
  const available = RUN_BUFFS.filter(choice => !choice.isAvailable || choice.isAvailable(session));
  const pool = available.length >= 4 ? available : RUN_BUFFS.filter(choice => !choice.isAvailable);
  return shuffle(pool).slice(0, 4);
}

function buyShopReward(session: RunSession, choice: RunRewardChoice, cost: number): RunSession {
  if (session.runGold < cost) return session;
  return completeDungeonNode({
    ...choice.apply({ ...session, runGold: session.runGold - cost }),
    notice: `${choice.name} purchased for ${cost} run gold.`,
  });
}

function resolveDungeonEvent(session: RunSession): RunSession {
  const roll = Math.random();

  if (roll < 0.2) {
    const wounded = woundRandomMinion(session);
    return completeDungeonNode({ ...wounded, notice: 'A curse bites the chamber. One minion falls for the run.' });
  }

  if (roll < 0.4) {
    return completeDungeonNode(addRandomRunMinion(session, 'tier1', 'A lost pilgrim joins the run.'));
  }

  if (roll < 0.6) {
    return completeDungeonNode(makeStatBuff('event-ward', 'Event Ward', '+2 Defensive Power from the pool.', { defensivePower: 2 }).apply(session));
  }

  if (roll < 0.8) {
    return completeDungeonNode(resurrectMinions({ ...session, notice: 'The pool restores one fallen minion.' }, 1));
  }

  return completeDungeonNode({ ...session, runGold: session.runGold + 70, notice: 'The pool leaves 70 black coins in your palm.' });
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
  const baseGold = (isDungeon ? 110 : 80) + session.wins * (isDungeon ? 45 : 32) + Math.floor(session.runGold * 0.35) + streakGoldBonus;
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
      return { ...unit, alive: true };
    }),
    notice: count > 1 ? 'Fallen minions return to the run.' : 'One fallen minion returns to the run.',
  };
}

function resurrectAllMinions(session: RunSession): RunSession {
  return {
    ...session,
    minions: session.minions.map(unit => ({ ...unit, alive: true })),
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
        ? { ...unit, stack: { ...unit.stack, templateId: chosen.nextTemplate?.templateId || unit.stack.templateId } }
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

function woundRandomMinion(session: RunSession): RunSession {
  const alive = session.minions.map((unit, index) => ({ unit, index })).filter(item => item.unit.alive);
  const chosen = shuffle(alive)[0];
  if (!chosen) return { ...session, runGold: Math.max(0, session.runGold - 30) };

  return {
    ...session,
    minions: session.minions.map((unit, index) => index === chosen.index ? { ...unit, alive: false } : unit),
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
