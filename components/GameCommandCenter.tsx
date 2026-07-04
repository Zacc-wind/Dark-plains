'use client';

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getActiveGearSetSummaries } from '@/lib/gearSets';
import { getPlayerModelPath } from '@/lib/assetLoader';
import { BATTLE_SPELLS, type BattleSpell } from '@/lib/battle';
import { DailyRunModal, getSavedDailyRunSummary, MpDailyDungeonModal } from './RoguelikeRunModal';
import MultiplayerHubModal from './MultiplayerHubModal';
import PveHubModal from './PveHubModal';
import ChatLiveFeed from './ChatLiveFeed';
import GameSettingsPanel from './GameSettingsPanel';
import {
  ActivityEntry,
  AllocatableStat,
  acceptPartyInvite,
  acceptFriendRequest,
  declineFriendRequest,
  DEFAULT_EQUIPPED_SPELL_IDS,
  Equipment,
  EquipmentSlot,
  InventoryItem,
  type LeaderboardBoard,
  MAX_PARTY_SIZE,
  MAX_FIELD_MINIONS,
  MinionStack,
  MinionTier,
  RewardSummary,
  SocialChatChannel,
  TravelState,
  assignMinionToBattleSlot,
  allocateStatPoint,
  cancelJob,
  cancelTravel,
  claimQuestReward,
  equipItem,
  equipBattleSpellSet,
  getBalancedQuestExp,
  getCurrentUser,
  getDailyRunLeaderboard,
  getDailyRunState,
  getDailyRunStatus,
  getRandomRunExpNeeded,
  getExpNeeded,
  getEquipmentSocketBonusValue,
  getFieldedMinions,
  getGearUsedSlots,
  getInventoryUpgradeQuote,
  getInventoryItemDefinition,
  getJobProgress,
  getJobTimeRemaining,
  getLeaderboardBoards,
  getMinionTemplate,
  getOrderedMinions,
  getPartyMembers,
  getRareGemCount,
  getSocialChatMessages,
  getSocialState,
  getUsers,
  formatMinionInjuryTime,
  invitePlayerToParty,
  isMinionInjured,
  leaveParty,
  logout,
  MINION_CLASS_LABELS,
  MINION_TIER_LABELS,
  QUEST_NPCS,
  STORY_CHAPTERS,
  getAllStoryQuestsSorted,
  claimCityQuestReward,
  claimStoryQuestReward,
  getCityQuestStatus,
  getCityQuestTemplate,
  getStoryQuestStatus,
  reorderMinionRoster,
  promotePartyMember,
  removeFriend,
  removePlayerFromParty,
  sendFriendRequest,
  sendSocialChatMessage,
  toggleMinionFielded,
  unequipItem,
  upgradeInventoryCapacity,
  activateInventoryItem,
} from '@/lib/auth';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import { emitFxEvent } from '@/lib/fxEvents';
import {
  getMpDailyDungeonChallenge,
  hasCompletedMpDailyDungeonToday,
} from '@/lib/mpDailyDungeon';
import { getActivePveSpawnCount } from '@/lib/worldPveIntel';
import {
  getMusicVolumePercent,
  isMusicMuted,
} from '@/lib/backgroundMusic';
import {
  isGameSoundId,
  playGameSound,
  preloadGameSounds,
} from '@/lib/sound';
import { getSpellIconPath } from '@/lib/spellAssets';

type PanelId = 'overview' | 'character' | 'inventory' | 'minions' | 'spells' | 'jobs' | 'quests' | 'social' | 'settings' | 'runs' | 'leaderboards' | 'history';
type PanelIconName = 'overview' | 'character' | 'inventory' | 'minions' | 'spells' | 'jobs' | 'quests' | 'social' | 'settings' | 'runs' | 'leaderboards' | 'history';
type PanelButtonConfig = {
  id: PanelId;
  label: string;
  icon: PanelIconName;
};

interface GameCommandCenterProps {
  onOpenAvatar: () => void;
  showRandomRun?: boolean;
}

const panelButtons: PanelButtonConfig[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'character', label: 'Commander', icon: 'character' },
  { id: 'inventory', label: 'Gear', icon: 'inventory' },
  { id: 'minions', label: 'Army', icon: 'minions' },
  { id: 'spells', label: 'Spells', icon: 'spells' },
  { id: 'jobs', label: 'Jobs', icon: 'jobs' },
  { id: 'quests', label: 'Quests', icon: 'quests' },
  { id: 'social', label: 'Social', icon: 'social' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];
const primaryPanelButtons = panelButtons.slice(0, 5);
const secondaryPanelButtons = panelButtons.slice(5);

function isPanelId(value: unknown): value is PanelId {
  return typeof value === 'string' && panelButtons.some(button => button.id === value);
}

const equipmentSlots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'armor-pants', 'boots', 'gloves', 'helmet'];

const EQUIPMENT_ICON_BASE = '/assets/equipment';
const MINION_ICON_BASE = '/assets/minions';

const statIconPaths: Record<string, string> = {
  Army: '/assets/icons/attack.png',
  Ward: '/assets/icons/defense.png',
  Morale: '/assets/icons/speed.png',
  Spell: '/assets/icons/magic.png',
  Health: '/assets/icons/health.png',
  Gold: '/assets/icons/gold.png',
  Gems: '/assets/icons/rare-gem.png',
  Resources: '/assets/icons/gold.png',
  Minions: '/assets/icons/attack.png',
  XP: '/assets/icons/xp.png',
};

function getEquipmentIconPath(item: Pick<Equipment, 'slot' | 'rarity'>): string {
  return `${EQUIPMENT_ICON_BASE}/${item.slot}-${item.rarity}.png`;
}

function getInventoryIconPath(item: InventoryItem): string {
  return item.imagePath || getInventoryItemDefinition(item.id)?.imagePath || statIconPaths[item.name] || '/assets/icons/loot-chest.png';
}

type EquipmentStatKey = 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth';

const EQUIPMENT_STAT_LABELS: Record<EquipmentStatKey, string> = {
  armyPower: 'ATK',
  defensivePower: 'DEF',
  morale: 'SPD',
  spellPower: 'MAG',
  maxHealth: 'HP',
};

const EQUIPMENT_STAT_KEYS: EquipmentStatKey[] = [
  'armyPower',
  'defensivePower',
  'morale',
  'spellPower',
  'maxHealth',
];

function finiteStat(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function getEquipmentStat(item: Equipment, stat: EquipmentStatKey): number {
  const socketValue = finiteStat((item.socketBonuses || [])
    .filter(bonus => bonus.stat === stat)
    .reduce((total, bonus) => total + getEquipmentSocketBonusValue(bonus), 0));

  if (stat === 'armyPower') return finiteStat((item.stats.armyPower ?? item.stats.attack ?? 0) + socketValue);
  if (stat === 'defensivePower') return finiteStat((item.stats.defensivePower ?? item.stats.defense ?? 0) + socketValue);
  if (stat === 'morale') return finiteStat((item.stats.morale ?? item.stats.speed ?? 0) + socketValue);
  if (stat === 'spellPower') return finiteStat((item.stats.spellPower ?? 0) + socketValue);
  return finiteStat((item.stats.maxHealth ?? 0) + socketValue);
}

function getEquipmentStatRows(item: Equipment, compareEquipped?: Equipment) {
  return EQUIPMENT_STAT_KEYS.map(key => {
    const value = getEquipmentStat(item, key);
    const equippedValue = compareEquipped ? getEquipmentStat(compareEquipped, key) : 0;
    return {
      key,
      label: EQUIPMENT_STAT_LABELS[key],
      value,
      delta: compareEquipped ? value - equippedValue : 0,
    };
  }).filter(row => row.value > 0 || (compareEquipped && row.delta !== 0));
}

function EquipmentGearPopover({
  item,
  compareEquipped,
  actionHint = 'Click to equip this piece.',
}: {
  item: Equipment;
  compareEquipped?: Equipment;
  actionHint?: string;
}) {
  const statRows = getEquipmentStatRows(item, compareEquipped);

  return (
    <div className="run-gear-tip">
      <div className={`run-gear-tip-title ${rarityClasses(item.rarity)}`}>{item.name}</div>
      <div className="run-gear-tip-meta">
        {item.slot.replace('-', ' ')} · {item.rarity}
      </div>

      {statRows.length > 0 ? (
        <div className="run-gear-tip-stats" role="list">
          {statRows.map(row => (
            <div key={row.key} className="run-gear-tip-stat" role="listitem">
              <span className="run-gear-tip-stat-label">{row.label}</span>
              <span className="run-gear-tip-stat-value">+{row.value}</span>
              {compareEquipped && row.delta !== 0 && (
                <span className={`run-gear-tip-stat-delta ${row.delta > 0 ? 'run-gear-tip-stat-delta-up' : 'run-gear-tip-stat-delta-down'}`}>
                  {row.delta > 0 ? `+${row.delta}` : row.delta}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="run-gear-tip-copy">No stat bonuses.</div>
      )}

      {compareEquipped && (
        <div className="run-gear-tip-compare">
          <span className="run-gear-tip-compare-label">Compared to equipped</span>
          <span className={`run-gear-tip-compare-name ${rarityClasses(compareEquipped.rarity)}`}>
            {compareEquipped.name}
          </span>
        </div>
      )}

      {actionHint && <div className="run-gear-tip-hint">{actionHint}</div>}
    </div>
  );
}

function CommandGearHoverTip({
  children,
  popover,
}: {
  children: ReactNode;
  popover: ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const clearHideTimer = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const gap = 12;
    const popoverWidth = 296;
    const roomRight = window.innerWidth - rect.right;
    const roomLeft = rect.left;
    const nextSide: 'left' | 'right' = roomRight >= popoverWidth + gap || roomRight >= roomLeft
      ? 'right'
      : 'left';

    setSide(nextSide);
    setCoords({
      top: rect.top + rect.height / 2,
      left: nextSide === 'right' ? rect.right + gap : rect.left - gap,
    });
  }, []);

  const show = () => {
    clearHideTimer();
    updatePosition();
    setOpen(true);
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => setOpen(false), 80);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, updatePosition]);

  useEffect(() => () => clearHideTimer(), []);

  return (
    <div
      ref={anchorRef}
      className="command-gear-hover-anchor"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
    >
      {children}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className={`run-roster-hover-popover run-roster-hover-popover-${side} run-gear-hover-popover command-gear-hover-popover rounded border`}
          role="tooltip"
          style={{ top: coords.top, left: coords.left }}
        >
          {popover}
        </div>,
        document.body,
      )}
    </div>
  );
}

function MinionArmyHoverPopover({
  template,
  minion,
  rosterIndex,
  now,
}: {
  template: NonNullable<ReturnType<typeof getMinionTemplate>>;
  minion: MinionStack;
  rosterIndex: number;
  now: number;
}) {
  const fielded = Boolean(minion.fielded);
  const injured = isMinionInjured(minion, now);
  const injuryTime = injured ? formatMinionInjuryTime(minion, now) : '';

  return (
    <div className="run-gear-tip">
      <div className="run-gear-tip-title">{template.name}</div>
      <div className="run-gear-tip-meta">
        {MINION_TIER_LABELS[template.tier]} · {MINION_CLASS_LABELS[template.class]}
      </div>
      <div className="run-gear-tip-copy ui-muted">{template.role}</div>
      <div className="command-icon-tooltip-stats mt-2">
        {[
          ['Attack', template.stats.attack],
          ['Defense', template.stats.defense],
          ['Health', template.stats.health],
          ['Range', template.stats.range],
          ['Magic', template.stats.magic],
          ['Healing', template.stats.healing],
        ].map(([label, value]) => (
          <span key={label} className="command-icon-tooltip-stat">
            <span className="command-icon-tooltip-stat-label">{label}</span>
            <span className="command-icon-tooltip-stat-value">{value}</span>
          </span>
        ))}
      </div>
      <div className="run-gear-tip-hint mt-2">
        {injured
          ? `Injured · recovers in ${injuryTime}`
          : fielded
            ? `Battle slot ${rosterIndex + 1}`
            : `Reserve · roster #${rosterIndex + 1}`}
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(value);
}

function rarityClasses(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'ui-rarity-legendary';
    case 'epic': return 'ui-rarity-epic';
    case 'rare': return 'ui-rarity-rare';
    case 'decent': return 'ui-rarity-decent';
    default: return 'ui-rarity-decent';
  }
}

function minionTierClasses(tier: MinionTier): string {
  switch (tier) {
    case 'tier3': return 'ui-rarity-legendary';
    case 'tier2': return 'ui-rarity-rare';
    case 'tier1': return 'ui-rarity-decent';
    default: return 'ui-rarity-decent';
  }
}

function activityRewardLabels(activity: ActivityEntry): string[] {
  const labels: string[] = [];
  const rewards = activity.rewards;

  if (rewards.gold) labels.push(`${rewards.gold} gold`);
  if (rewards.goldLoss) labels.push(`-${rewards.goldLoss} gold`);
  if (rewards.exp) labels.push(`${rewards.exp} XP`);
  if (rewards.healthRestore) labels.push(`${rewards.healthRestore} HP`);
  if (rewards.healthLoss) labels.push(`-${rewards.healthLoss} HP`);
  if (rewards.rareGems && !rewards.items?.some(item => item.id === 'rare-gem')) labels.push(`${rewards.rareGems} gems`);
  rewards.items?.forEach(item => labels.push(`${item.quantity} ${item.name}`));
  rewards.equipment?.forEach(item => labels.push(item.name));
  rewards.minions?.forEach(minion => {
    const template = getMinionTemplate(minion.templateId);
    labels.push(template?.name || 'Minion');
  });
  rewards.spellIds?.forEach(spellId => {
    const spell = BATTLE_SPELLS.find(item => item.id === spellId);
    labels.push(spell ? `${spell.name} spell` : 'Spell');
  });

  return labels;
}

function rewardSummaryToCompletionRewards(rewards?: RewardSummary): CompletionRewardLine[] {
  if (!rewards) return [];

  const lines: CompletionRewardLine[] = [];
  if (rewards.gold) lines.push({ label: 'Gold', value: `+${rewards.gold}`, tone: 'gold' });
  if (rewards.goldLoss) lines.push({ label: 'Gold', value: `-${rewards.goldLoss}`, tone: 'red' });
  if (rewards.exp) lines.push({ label: 'XP', value: `+${rewards.exp}`, tone: 'blue' });
  if (rewards.healthRestore) lines.push({ label: 'Health', value: `+${rewards.healthRestore}`, tone: 'green' });
  if (rewards.healthLoss) lines.push({ label: 'Health', value: `-${rewards.healthLoss}`, tone: 'red' });
  if (rewards.rareGems) lines.push({ label: 'Gems', value: `+${rewards.rareGems}`, tone: 'violet' });

  rewards.items?.forEach(item => {
    lines.push({ label: 'Item', value: item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name, tone: 'green' });
  });
  rewards.equipment?.forEach(item => {
    lines.push({ label: 'Equipment', value: item.name, tone: 'green' });
  });
  rewards.minions?.forEach(minion => {
    lines.push({ label: 'Minion', value: getMinionTemplate(minion.templateId)?.name || 'Minion', tone: 'green' });
  });
  rewards.spellIds?.forEach(spellId => {
    lines.push({ label: 'Spell', value: BATTLE_SPELLS.find(spell => spell.id === spellId)?.name || 'Spell', tone: 'violet' });
  });

  return lines;
}

function activityToCompletionRewards(activity: ActivityEntry): CompletionRewardLine[] {
  const rewards = rewardSummaryToCompletionRewards(activity.rewards);
  return rewards.length > 0 ? rewards : [{ label: 'Result', value: 'Recorded', tone: 'neutral' }];
}

export default function GameCommandCenter({ onOpenAvatar, showRandomRun = false }: GameCommandCenterProps) {
  const [user, setUser] = useState(getCurrentUser());
  const [activePanel, setActivePanel] = useState<PanelId>('overview');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [hoveredSpellId, setHoveredSpellId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState('');
  const [armySwapSourceId, setArmySwapSourceId] = useState<string | null>(null);
  const [selectedSpellSlot, setSelectedSpellSlot] = useState(0);
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
  const [showDailyRun, setShowDailyRun] = useState(false);
  const [isSecondaryNavOpen, setIsSecondaryNavOpen] = useState(true);
  const [friendSearch, setFriendSearch] = useState('');
  const [chatChannel, setChatChannel] = useState<SocialChatChannel>('global');
  const [chatDraft, setChatDraft] = useState('');
  const [isChatDockOpen, setIsChatDockOpen] = useState(false);
  const [showMultiplayerHub, setShowMultiplayerHub] = useState(false);
  const [showPveHub, setShowPveHub] = useState(false);
  const [showMpDailyRun, setShowMpDailyRun] = useState(false);
  const [isMapActionRailCompact, setIsMapActionRailCompact] = useState(true);
  const [isPartyDetailsOpen, setIsPartyDetailsOpen] = useState(false);
  const [partyInviteDraft, setPartyInviteDraft] = useState('');
  const lastActivityNoticeId = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    preloadGameSounds();

    const getInteractiveTarget = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>('button, [role="button"], a[href], input[type="button"], input[type="submit"]');
    };

    const isDisabled = (target: HTMLElement): boolean =>
      target.getAttribute('aria-disabled') === 'true' ||
      (target instanceof HTMLButtonElement && target.disabled) ||
      (target instanceof HTMLInputElement && target.disabled);

    let lastHoverTarget: HTMLElement | null = null;

    const handlePointerOver = (event: PointerEvent) => {
      const target = getInteractiveTarget(event.target);
      if (!target || isDisabled(target) || target === lastHoverTarget || target.dataset.soundHover === 'off') return;
      lastHoverTarget = target;
      playGameSound('ui.hover', { throttleMs: 90 });
    };

    const handlePointerOut = (event: PointerEvent) => {
      const target = getInteractiveTarget(event.target);
      const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (target && relatedTarget && target.contains(relatedTarget)) return;
      lastHoverTarget = null;
    };

    const handleClick = (event: MouseEvent) => {
      const target = getInteractiveTarget(event.target);
      if (!target || isDisabled(target) || target.dataset.soundClick === 'off') return;

      const explicitSound = target.dataset.sound;
      if (explicitSound && isGameSoundId(explicitSound)) {
        playGameSound(explicitSound);
        return;
      }

      const className = String(target.className || '');
      const label = target.textContent?.trim().toLowerCase() || '';
      if (label.includes('claim')) {
        playGameSound('quest.claim');
        return;
      }
      if (label.includes('buy') || label.includes('sell')) {
        playGameSound('inventory.coins');
        return;
      }
      if (label.includes('start') || label.includes('open')) {
        playGameSound('ui.modalOpen');
        return;
      }
      const isSoftAction =
        className.includes('ui-button-danger') ||
        label.includes('close') ||
        label.includes('cancel') ||
        label.includes('leave') ||
        label.includes('retreat') ||
        label.includes('logout');
      const isTabAction =
        className.includes('rail-button') ||
        className.includes('spell-icon-card') ||
        className.includes('command-center-tab');

      playGameSound(isSoftAction ? 'ui.clickSoft' : isTabAction ? 'ui.tab' : 'ui.click');
    };

    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerout', handlePointerOut, true);
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('pointerover', handlePointerOver, true);
      document.removeEventListener('pointerout', handlePointerOut, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
      setUser(getCurrentUser());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleForceMainScreen = () => {
      setIsCommandOpen(false);
      setShowDailyRun(false);
      setActivePanel('overview');
      setArmySwapSourceId(null);
      setNotice('');
    };

    window.addEventListener('wizardy:force-main-screen', handleForceMainScreen);
    return () => window.removeEventListener('wizardy:force-main-screen', handleForceMainScreen);
  }, []);

  useEffect(() => {
    const handleOpenCommandPanel = (event: Event) => {
      const panel = (event as CustomEvent<{ panel?: unknown }>).detail?.panel;
      setActivePanel(isPanelId(panel) ? panel : 'overview');
      setShowDailyRun(false);
      setIsCommandOpen(true);
      emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
    };

    window.addEventListener('wizardy:open-command-panel', handleOpenCommandPanel);
    return () => window.removeEventListener('wizardy:open-command-panel', handleOpenCommandPanel);
  }, []);

  useEffect(() => {
    if (!showRandomRun) return;
    document.body.classList.toggle('daily-run-open', showDailyRun);
    return () => document.body.classList.remove('daily-run-open');
  }, [showDailyRun, showRandomRun]);

  useEffect(() => {
    document.body.classList.toggle('command-center-open', isCommandOpen);
    return () => document.body.classList.remove('command-center-open');
  }, [isCommandOpen]);

  useEffect(() => {
    const latestActivity = user?.activityLog?.[0];
    if (!latestActivity) return;

    if (lastActivityNoticeId.current === null) {
      lastActivityNoticeId.current = latestActivity.id;
      return;
    }

    if (latestActivity.id === lastActivityNoticeId.current) return;
    lastActivityNoticeId.current = latestActivity.id;

    if (latestActivity.type === 'job') {
      emitCompletionNotice({
        id: `activity-completion-${latestActivity.id}`,
        kind: 'job',
        kicker: 'Job Complete',
        title: latestActivity.title,
        description: `${latestActivity.source} work finished.`,
        rewards: activityToCompletionRewards(latestActivity),
        completedAt: latestActivity.completedAt,
      });
    }
  }, [user?.activityLog]);

  useEffect(() => {
    if (activePanel !== 'minions') {
      setArmySwapSourceId(null);
    }
  }, [activePanel]);

  useEffect(() => {
    if (!getSocialState(getCurrentUser()).party) {
      setIsPartyDetailsOpen(false);
    }
  }, [user?.social?.party]);

  if (!user) return null;

  const player = user;
  const currentModel = player.selectedModel || 3;
  const expNeeded = getExpNeeded(player.stats.level);
  const expProgress = Math.min(100, (player.exp / expNeeded) * 100);
  const inventory = player.inventory || [];
  const equipment = player.equipment || [];
  const equippedSlots = player.equippedSlots || {};
  const minions = player.minions || [];
  const fieldedMinions = getFieldedMinions(player);
  const activityLog = player.activityLog || [];
  const quests = player.dailyQuests?.quests || [];
  const activeJobs = player.jobQueue || [];
  const inventorySlots = player.inventorySlots || 20;
  const gearUsed = getGearUsedSlots(player);
  const inventoryUpgradeQuote = getInventoryUpgradeQuote(player);
  const rareGemCount = getRareGemCount(player);
  const hudRunState = getDailyRunState(player);
  const savedDailyRun = getSavedDailyRunSummary(player);
  const socialState = getSocialState(player);
  const acceptedFriends = socialState.friends.filter(friend => friend.status === 'accepted');
  const incomingFriendRequests = socialState.friends.filter(
    friend => friend.status === 'pending' && friend.requestedBy.toLowerCase() !== player.username.toLowerCase()
  );
  const outgoingFriendRequests = socialState.friends.filter(
    friend => friend.status === 'pending' && friend.requestedBy.toLowerCase() === player.username.toLowerCase()
  );
  const partyMembers = getPartyMembers(player);
  const partyInvites = socialState.party?.invitedUsernames || [];
  const chatMessages = getSocialChatMessages(chatChannel, player).slice(-12);
  const socialCandidates = getUsers()
    .filter(candidate => candidate.username.toLowerCase() !== player.username.toLowerCase())
    .sort((left, right) => left.username.localeCompare(right.username));
  const activePveSpawns = getActivePveSpawnCount(player);
  const gearSetSummaries = getActiveGearSetSummaries(player);

  const getEquippedItem = (slot: EquipmentSlot) => {
    const equipmentId = equippedSlots[slot];
    return equipment.find(item => item.id === equipmentId);
  };

  const unequippedItems = equipment.filter(item => !Object.values(equippedSlots).includes(item.id));

  const totalEquipmentStats = equipmentSlots.reduce(
    (totals, slot) => {
      const item = getEquippedItem(slot);
      if (!item) return totals;

      return {
        armyPower: totals.armyPower + getEquipmentStat(item, 'armyPower'),
        defensivePower: totals.defensivePower + getEquipmentStat(item, 'defensivePower'),
        morale: totals.morale + getEquipmentStat(item, 'morale'),
        spellPower: totals.spellPower + getEquipmentStat(item, 'spellPower'),
        maxHealth: totals.maxHealth + getEquipmentStat(item, 'maxHealth'),
      };
    },
    { armyPower: 0, defensivePower: 0, morale: 0, spellPower: 0, maxHealth: 0 }
  );

  const setTemporaryNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };

  const applySocialResult = (result: { success: boolean; message?: string; error?: string }) => {
    playGameSound(result.success ? 'social.accept' : 'social.decline', { throttleMs: 120 });
    setTemporaryNotice(result.message || result.error || (result.success ? 'Social action complete.' : 'Social action failed.'));
    setUser(getCurrentUser());
  };

  const handleAddFriend = () => {
    const result = sendFriendRequest(friendSearch);
    if (result.success) setFriendSearch('');
    applySocialResult(result);
  };

  const handleSendChat = () => {
    const result = sendSocialChatMessage(chatChannel, chatDraft);
    if (result.success) {
      setChatDraft('');
      setUser(getCurrentUser());
      return;
    }

    applySocialResult(result);
  };

  const handleInvitePartyPlayer = () => {
    const result = invitePlayerToParty(partyInviteDraft);
    if (result.success) setPartyInviteDraft('');
    applySocialResult(result);
  };

  const openPartyChat = () => {
    setChatChannel('party');
    setIsChatDockOpen(true);
    setIsPartyDetailsOpen(false);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleEquip = (equipmentId: string) => {
    const result = equipItem(equipmentId);
    if (result.success) setUser(getCurrentUser());
    else setTemporaryNotice(result.error || 'Could not equip item.');
  };

  const handleUnequip = (slot: EquipmentSlot) => {
    const result = unequipItem(slot);
    if (result.success) setUser(getCurrentUser());
    else setTemporaryNotice(result.error || 'Could not unequip item.');
  };

  const handleAllocate = (stat: AllocatableStat) => {
    const result = allocateStatPoint(stat);
    if (result.success) setUser(getCurrentUser());
    else setTemporaryNotice(result.error || 'Could not spend stat point.');
  };

  const handleCancelJob = (jobId: string) => {
    const result = cancelJob(jobId);
    setUser(getCurrentUser());
    setTemporaryNotice(result.message || (result.success ? 'Job canceled.' : 'Could not cancel job.'));
  };

  const handleCancelTravel = () => {
    const result = cancelTravel();
    setUser(getCurrentUser());
    setTemporaryNotice(result.message || (result.success ? 'Travel canceled.' : 'Could not cancel travel.'));
    if (result.success) emitFxEvent({ type: 'travel', tone: 'bone', intensity: 0.4 });
  };

  const handleClaimQuest = (questId: string) => {
    const result = claimQuestReward(questId);
    if (!result.success) {
      setTemporaryNotice(result.error || 'Could not claim quest.');
      return;
    }

    const rewardNames = [
      ...(result.rewards || []).map(item => item.name),
      ...(result.minions || []).map(minion => {
        const template = getMinionTemplate(minion.templateId);
        return template?.name || 'Minion';
      }),
    ];

    setTemporaryNotice(rewardNames.length > 0 ? `Claimed ${rewardNames.join(', ')}` : 'Quest claimed.');
    emitCompletionNotice({
      id: `daily-quest-completion-${questId}-${Date.now()}`,
      kind: 'quest',
      kicker: 'Quest Complete',
      title: 'Daily Reward Claimed',
      description: rewardNames.length > 0 ? rewardNames.join(', ') : 'Quest reward was added to your character.',
      rewards: [
        ...(result.rewards || []).map(item => ({ label: 'Equipment', value: item.name, tone: 'green' as const })),
        ...(result.minions || []).map(minion => ({ label: 'Minion', value: getMinionTemplate(minion.templateId)?.name || 'Minion', tone: 'green' as const })),
      ],
      completedAt: Date.now(),
    });
    setIsCommandOpen(false);
    setUser(getCurrentUser());
  };

  const handleClaimCityQuest = (questId: string) => {
    const result = claimCityQuestReward(questId);
    if (!result.success) {
      setTemporaryNotice(result.error || 'Could not claim city contract.');
      return;
    }

    setTemporaryNotice('City contract claimed.');
    emitCompletionNotice({
      id: `city-quest-completion-${questId}-${Date.now()}`,
      kind: 'quest',
      kicker: 'City Contract',
      title: getCityQuestTemplate(questId)?.name || 'Contract Complete',
      description: 'The city board reward was claimed.',
      rewards: rewardSummaryToCompletionRewards(result.rewards),
      completedAt: Date.now(),
    });
    setIsCommandOpen(false);
    setUser(getCurrentUser());
  };

  const handleClaimStoryQuest = (questId: string) => {
    const result = claimStoryQuestReward(questId);
    if (!result.success) {
      setTemporaryNotice(result.error || 'Could not claim story reward.');
      return;
    }

    const spellNames = (result.rewards?.spellIds || [])
      .map(spellId => BATTLE_SPELLS.find(spell => spell.id === spellId)?.name)
      .filter(Boolean);
    setTemporaryNotice(spellNames.length > 0 ? `Unlocked ${spellNames.join(', ')}` : 'Story reward claimed.');
    emitCompletionNotice({
      id: `story-quest-completion-${questId}-${Date.now()}`,
      kind: 'quest',
      kicker: 'Story Quest',
      title: 'Chapter Step Complete',
      description: spellNames.length > 0 ? `Unlocked ${spellNames.join(', ')}.` : 'The story reward was claimed.',
      rewards: rewardSummaryToCompletionRewards(result.rewards),
      completedAt: Date.now(),
    });
    setIsCommandOpen(false);
    setUser(getCurrentUser());
  };

  const handleInventoryUpgrade = () => {
    const result = upgradeInventoryCapacity();
    if (!result.success) {
      setTemporaryNotice(result.error || 'Could not upgrade inventory.');
      return;
    }

    setTemporaryNotice(result.upgraded ? 'Inventory expanded.' : 'Upgrade failed. Materials were consumed.');
    setUser(getCurrentUser());
  };

  const handleUseInventoryItem = (itemId: string) => {
    const result = activateInventoryItem(itemId);
    if (!result.success) {
      setTemporaryNotice(result.error || 'Could not use item.');
      return;
    }

    setTemporaryNotice(result.message || 'Item used.');
    setUser(getCurrentUser());
  };

  const handleEquipSpellToSelectedSlot = (spellId: string) => {
    const equippedSpellIds = player.equippedSpellIds?.length === 4
      ? [...player.equippedSpellIds]
      : [...DEFAULT_EQUIPPED_SPELL_IDS];
    const targetIndex = Math.min(Math.max(selectedSpellSlot, 0), 3);
    const duplicateIndex = equippedSpellIds.findIndex(id => id === spellId);

    if (duplicateIndex !== -1 && duplicateIndex !== targetIndex) {
      equippedSpellIds[duplicateIndex] = equippedSpellIds[targetIndex];
    }
    equippedSpellIds[targetIndex] = spellId;

    const result = equipBattleSpellSet(equippedSpellIds);
    if (!result.success) {
      setTemporaryNotice(result.error || 'Choose exactly 4 equipped spells.');
      return;
    }

    emitFxEvent({ type: 'spell', tone: 'violet', intensity: 0.46 });
    setTemporaryNotice('Spell loadout updated.');
    setUser(getCurrentUser());
  };

  const handleArmyMinionClick = (minionId: string) => {
    if (!armySwapSourceId) {
      setArmySwapSourceId(minionId);
      return;
    }

    if (armySwapSourceId === minionId) {
      setArmySwapSourceId(null);
      return;
    }

    const result = reorderMinionRoster(armySwapSourceId, minionId);
    setArmySwapSourceId(null);
    if (!result.success) {
      setTemporaryNotice(result.error || 'Could not swap units.');
      return;
    }

    setUser(getCurrentUser());
  };

  const handleAssignMinionBattleSlot = (minionId: string, slotIndex: number) => {
    const result = assignMinionToBattleSlot(minionId, slotIndex);
    setArmySwapSourceId(null);
    if (!result.success) {
      setTemporaryNotice(result.error || 'Could not update battle lineup.');
      return;
    }

    setUser(getCurrentUser());
  };

  const handleToggleArmyFielded = (minionId: string) => {
    const result = toggleMinionFielded(minionId);
    setArmySwapSourceId(null);
    if (!result.success) {
      setTemporaryNotice(result.error || 'Could not update battle lineup.');
      return;
    }

    setUser(getCurrentUser());
  };

  const panelTitle = panelButtons.find(button => button.id === activePanel)?.label || 'Overview';

  const openPanel = (panelId: PanelId) => {
    setActivePanel(panelId);
    if (secondaryPanelButtons.some(button => button.id === panelId)) setIsSecondaryNavOpen(true);
    setIsCommandOpen(true);
  };

  const getPanelSubtitle = (panelId: PanelId): string => {
    switch (panelId) {
      case 'overview': return '';
      case 'character': return `Lv ${player.stats.level}`;
      case 'inventory': return `${gearUsed}/${inventorySlots}`;
      case 'minions': return `${fieldedMinions.length}/${minions.length}`;
      case 'spells': return '';
      case 'jobs': return `${activeJobs.length}/4`;
      case 'quests': return '';
      case 'social': return String(acceptedFriends.length);
      case 'settings': return isMusicMuted() ? 'Muted' : `${getMusicVolumePercent()}%`;
      case 'runs': return savedDailyRun ? 'Resume' : 'Open';
      case 'leaderboards': return '';
      case 'history': return `${activityLog.length}`;
      default: return '';
    }
  };

  return (
    <>
      <header className="game-hud fixed left-0 right-0 top-0 z-30 min-h-[5.35rem] text-zinc-100">
        <div className="flex h-full items-center justify-between gap-3 px-4 py-2">
          <button
            onClick={onOpenAvatar}
            className="hud-avatar-button hud-commander-chip flex min-w-0 items-center gap-3 px-1 py-1 transition"
          >
            <Image
              src={getPlayerModelPath(currentModel)}
              alt="Player Avatar"
              width={128}
              height={128}
              className="hud-commander-sprite shrink-0 object-contain"
              unoptimized
            />
            <span className="min-w-0 text-left">
              <span className="fantasy-heading block truncate text-base leading-tight">{player.username}</span>
              <span className="arcane-label mt-0.5 block text-[0.68rem]">Level {player.stats.level}</span>
              <span className="hud-xp-row">
                <span className="hud-xp-icon relative block shrink-0 overflow-hidden">
                  <Image
                    src="/assets/icons/xp.png"
                    alt=""
                    width={20}
                    height={20}
                    className="object-contain"
                    style={{ imageRendering: 'pixelated' }}
                    unoptimized
                  />
                </span>
                <span className="hud-xp-track block overflow-hidden rounded-full">
                  <span className="hud-xp-fill block h-full" style={{ width: `${expProgress}%` }} />
                </span>
                <span className="hud-xp-value">{player.exp}/{expNeeded}</span>
              </span>
            </span>
          </button>

          <div className="hidden md:flex flex-1 items-center justify-end gap-2 max-w-3xl ml-auto">
            <HudMetric
              label="Health"
              value={`${player.stats.health}/${player.stats.maxHealth}`}
              tone="red"
              progress={Math.round((player.stats.health / Math.max(1, player.stats.maxHealth)) * 100)}
            />
            <HudMetric label="Gold" value={String(player.gold)} tone="gold" />
            <HudMetric label="Gems" value={String(rareGemCount)} tone="violet" />
            <HudMetric label="Minions" value={`${fieldedMinions.length}/${MAX_FIELD_MINIONS}`} tone="teal" />
          </div>
        </div>
      </header>

      {!isCommandOpen && (!showRandomRun || !showDailyRun) && !showMultiplayerHub && !showPveHub && renderMapActionRail()}
      {!isCommandOpen && (!showRandomRun || !showDailyRun) && !showMultiplayerHub && !showPveHub && renderPartyStrip()}
      {!isCommandOpen && (!showRandomRun || !showDailyRun) && !showMultiplayerHub && !showPveHub && renderPartyDetailsPopover()}
      {!isCommandOpen && (!showRandomRun || !showDailyRun) && !showMultiplayerHub && !showPveHub && renderChatDock()}
      {!isCommandOpen && (!showRandomRun || !showDailyRun) && !showMultiplayerHub && !showPveHub && (
        <ChatLiveFeed enabled />
      )}

      {renderActionChips()}

      {isCommandOpen && (
      <aside className="command-panel command-center-shell vine-frame fixed bottom-4 left-4 right-4 top-20 z-50 overflow-hidden rounded border text-zinc-100">
        <div className="grid h-full min-h-0 grid-cols-[14rem_minmax(0,1fr)]">
          <nav className="command-center-nav border-r border-[rgba(232,217,184,0.14)] p-3">
            <div className="mb-4 px-2">
              <div className="flex items-center justify-between gap-2">
                <div className="fantasy-heading min-w-0 truncate text-2xl">{player.username}</div>
                <button
                  onClick={handleLogout}
                  className="ui-button-danger shrink-0 rounded px-2 py-1 text-[10px] font-black"
                >
                  Logout
                </button>
              </div>
            </div>
            <div className="command-center-nav-groups">
              <CommandNavGroup buttons={primaryPanelButtons} activePanel={activePanel} onOpen={openPanel} getSubtitle={getPanelSubtitle} />
              <CommandNavGroup
                buttons={secondaryPanelButtons}
                activePanel={activePanel}
                onOpen={openPanel}
                getSubtitle={getPanelSubtitle}
                secondary
                isOpen={isSecondaryNavOpen}
                onToggle={() => setIsSecondaryNavOpen(open => !open)}
              />
            </div>
          </nav>

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="panel-header flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="fantasy-heading text-2xl">{panelTitle}</h2>
              </div>
            <button
              onClick={() => setIsCommandOpen(false)}
              className="ui-button rounded px-3 py-1 text-xs font-bold"
              aria-label="Close command panel"
              title="Close command panel"
            >
              X
            </button>
          </div>

          {notice && (
            <div className="ui-notice border-b px-6 py-3 text-sm font-bold">
              {notice}
            </div>
          )}

          <div
            className={`command-center-content no-scrollbar flex-1 px-6 ${
              activePanel === 'spells' ? 'command-center-content-spells py-3' : 'overflow-y-auto py-6'
            }`}
          >
            <div
              key={activePanel}
              className={activePanel === 'spells' ? 'command-center-panel-stage command-center-panel-spells' : 'command-center-panel-stage'}
            >
              {activePanel === 'overview' && renderOverview()}
              {activePanel === 'character' && renderCharacter()}
              {activePanel === 'inventory' && renderInventory()}
              {activePanel === 'minions' && renderMinions()}
              {activePanel === 'spells' && renderSpells()}
              {activePanel === 'jobs' && renderJobs()}
              {activePanel === 'quests' && renderQuests()}
              {activePanel === 'social' && renderSocial()}
              {activePanel === 'settings' && renderSettings()}
              {activePanel === 'runs' && renderRuns()}
              {activePanel === 'leaderboards' && renderLeaderboards()}
              {activePanel === 'history' && renderHistory(activityLog)}
            </div>
          </div>
          </div>
        </div>
      </aside>
      )}


      {showRandomRun && (
        <DailyRunModal isOpen={showDailyRun} onClose={() => setShowDailyRun(false)} />
      )}
      {!showRandomRun && (
        <>
          <MultiplayerHubModal
            isOpen={showMultiplayerHub}
            onClose={() => setShowMultiplayerHub(false)}
          />
          <PveHubModal
            isOpen={showPveHub}
            onClose={() => setShowPveHub(false)}
          />
          <MpDailyDungeonModal
            isOpen={showMpDailyRun}
            onClose={() => setShowMpDailyRun(false)}
          />
        </>
      )}
    </>
  );

  function renderActionChips() {
    const chips: Array<{
      id: string;
      label: string;
      title: string;
      time: string;
      progress: number;
      icon: string;
      tone: 'travel' | 'job';
    }> = [];

    if (player.traveling) {
      const elapsed = now - player.traveling.startTime;
      const progress = Math.min(100, (elapsed / player.traveling.duration) * 100);
      const timeRemaining = Math.max(0, player.traveling.duration - elapsed);
      chips.push({
        id: 'direct-travel',
        label: 'Walk',
        title: 'Walking the road',
        time: formatTime(timeRemaining),
        progress,
        icon: '/assets/icons/speed.png',
        tone: 'travel',
      });
    }

    activeJobs.slice(0, 4).forEach(job => {
      const progress = getJobProgress(job, now);
      const timeRemaining = getJobTimeRemaining(job, now);
      const hasStarted = now >= job.startTime;
      const phase = !hasStarted ? 'Queued' : job.travelComplete ? 'Job' : 'Walk';

      chips.push({
        id: job.id,
        label: phase,
        title: `${job.jobName} - ${job.poiName}`,
        time: formatTime(timeRemaining),
        progress,
        icon: job.travelComplete ? '/assets/icons/gold.png' : '/assets/icons/speed.png',
        tone: 'job',
      });
    });

    if (chips.length === 0) return null;

    return (
      <div className="world-action-chips fixed bottom-4 left-4 z-30 flex flex-wrap gap-2">
        {chips.map(chip => (
          <button
            key={chip.id}
            type="button"
            onClick={() => openPanel('jobs')}
            className={`world-action-chip command-panel vine-frame rounded-full border px-2 py-2 text-left text-zinc-100 ${chip.tone === 'travel' ? 'world-action-chip-travel' : ''}`}
            style={{
              background: `conic-gradient(rgba(232, 217, 184, 0.42) ${chip.progress * 3.6}deg, rgba(5, 8, 10, 0.9) 0deg)`,
            }}
            title={chip.title}
          >
            <span className="world-action-chip-inner flex items-center gap-2 rounded-full px-2 py-1">
              <span className="ui-icon-frame relative h-8 w-8 shrink-0 overflow-hidden rounded-full border">
                <Image
                  src={chip.icon}
                  alt=""
                  fill
                  className="object-contain p-1"
                  style={{ imageRendering: 'pixelated' }}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-black uppercase text-[var(--ui-accent)]">{chip.label}</span>
                <span className="block text-xs font-black text-zinc-100">{chip.time}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  function renderMapActionRail() {
    const dailyLabel = savedDailyRun ? 'Resume Run' : 'Start Run';
    const dailyDetail = savedDailyRun
      ? `${savedDailyRun.phaseLabel} ${savedDailyRun.wins}/${savedDailyRun.targetBattles}`
      : `Random road - level ${hudRunState.runLevel}`;

    return (
      <nav
        className={`map-action-rail ${showRandomRun ? 'map-action-rail-runs' : ''} command-panel vine-frame fixed right-4 bottom-4 z-40 rounded border text-zinc-100 ${isMapActionRailCompact ? 'map-action-rail-compact' : 'map-action-rail-expanded'}`}
        aria-label="World actions"
      >
        <button
          type="button"
          onClick={() => setIsMapActionRailCompact(compact => !compact)}
          className="map-action-rail-toggle"
          aria-label={isMapActionRailCompact ? 'Expand world action menu' : 'Collapse world action menu'}
          title={isMapActionRailCompact ? 'Expand world action menu' : 'Collapse world action menu'}
        >
          {isMapActionRailCompact ? '+' : '-'}
        </button>
        {showRandomRun && (
          <button
            type="button"
            onClick={() => {
              emitFxEvent({ type: 'daily', tone: 'blue', intensity: 0.72 });
              setShowDailyRun(true);
            }}
            className={`map-action-button map-action-button-primary map-action-button-run-primary ${savedDailyRun ? 'map-action-button-resume' : ''}`}
            title={savedDailyRun ? `Resume ${savedDailyRun.title}` : 'Start random roguelike run'}
          >
            <span className="map-action-icon map-action-icon-daily relative overflow-hidden">
              <Image
                src="/assets/icons/xp.png"
                alt=""
                fill
                className="object-contain p-1"
                style={{ imageRendering: 'pixelated' }}
              />
            </span>
            <span className="map-action-copy">
              <span className="map-action-label">{dailyLabel}</span>
              <span className="map-action-detail">{dailyDetail}</span>
            </span>
            <span className="map-action-badge">{savedDailyRun ? 'Run' : `Lv ${hudRunState.runLevel}`}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.42 });
            setIsCommandOpen(true);
          }}
          className="map-action-button"
          title="Open menu"
        >
          <span className="map-action-icon">
            <PanelIcon icon="overview" />
          </span>
          <span className="map-action-copy">
            <span className="map-action-label">Menu</span>
            <span className="map-action-detail">Gear, army, quests</span>
          </span>
          <span className="map-action-badge">{gearUsed}/{inventorySlots}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsChatDockOpen(open => !open)}
          className={`map-action-button ${isChatDockOpen ? 'map-action-button-active' : ''}`}
          title={isChatDockOpen ? 'Close chat' : 'Open chat'}
          aria-expanded={isChatDockOpen}
        >
          <span className="map-action-icon">
            <PanelIcon icon="social" />
          </span>
          <span className="map-action-copy">
            <span className="map-action-label">Chat</span>
            <span className="map-action-detail">{chatChannel === 'party' ? 'Party channel' : 'Global channel'}</span>
          </span>
          <span className="map-action-badge">{chatMessages.length}</span>
        </button>

        {!showRandomRun && (
          <>
            <button
              type="button"
              onClick={() => {
                emitFxEvent({ type: 'attack', tone: 'gold', intensity: 0.62 });
                setShowMultiplayerHub(true);
              }}
              className="map-action-button map-action-button-primary"
              title="Open PVP hub"
            >
              <span className="map-action-icon">⚔</span>
              <span className="map-action-copy">
                <span className="map-action-label">PVP</span>
                <span className="map-action-detail">Ranked duels</span>
              </span>
              <span className="map-action-badge">Live</span>
            </button>

            <button
              type="button"
              onClick={() => {
                emitFxEvent({ type: 'daily', tone: 'violet', intensity: 0.58 });
                setShowPveHub(true);
              }}
              className="map-action-button"
              title="Open PVE intel"
            >
              <span className="map-action-icon relative overflow-hidden">
                <Image
                  src="/assets/icons/loot-chest.png"
                  alt=""
                  fill
                  className="object-contain p-1"
                  style={{ imageRendering: 'pixelated' }}
                />
              </span>
              <span className="map-action-copy">
                <span className="map-action-label">PVE</span>
                <span className="map-action-detail">Dungeons & bosses</span>
              </span>
              <span className="map-action-badge">{activePveSpawns}</span>
            </button>
          </>
        )}
      </nav>
    );
  }

  function renderChatDock() {
    if (!isChatDockOpen) {
      return null;
    }

    return (
      <aside className="social-chat-dock social-chat-panel fixed right-4 top-[18.5rem] z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border text-zinc-100">
        <div className="social-chat-header flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5">
            {(['global', 'party'] as SocialChatChannel[]).map(channel => (
              <button
                key={channel}
                type="button"
                onClick={() => setChatChannel(channel)}
                disabled={channel === 'party' && !socialState.party}
                className={`rounded px-2.5 py-1 text-[10px] font-black uppercase ${chatChannel === channel ? 'social-chat-tab-active' : 'social-chat-tab'} disabled:opacity-35`}
              >
                {channel}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsChatDockOpen(false)}
            className="social-chat-close rounded px-2 py-1 text-[10px] font-black"
          >
            X
          </button>
        </div>
        <div className="social-chat-messages no-scrollbar max-h-56 space-y-1.5 overflow-y-auto px-3 py-2 text-sm font-bold">
          {chatMessages.length === 0 ? (
            <div className="social-chat-empty rounded px-3 py-4 text-center text-xs">
              No messages yet.
            </div>
          ) : (
            chatMessages.map(message => (
              <div key={message.id} className="chat-line-modern">
                <span className="chat-line-author">{message.author}</span>
                <span className="chat-line-text">{message.text}</span>
              </div>
            ))
          )}
        </div>
        <form
          className="social-chat-compose flex gap-2 px-3 py-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSendChat();
          }}
        >
          <input
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            maxLength={180}
            className="social-chat-input min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-bold"
            placeholder={chatChannel === 'party' ? 'Party message' : 'Global message'}
          />
          <button type="submit" className="social-chat-send rounded-lg px-3 py-2 text-xs font-black">
            Send
          </button>
        </form>
      </aside>
    );
  }

  function renderPartyStrip() {
    if (!socialState.party) return null;

    const currentIsInvited = partyInvites.some(username => username.toLowerCase() === player.username.toLowerCase());
    const leaderUsername = socialState.party.leaderUsername;
    const memberCount = socialState.party.memberUsernames.length;
    const visibleMembers = partyMembers.slice(0, MAX_PARTY_SIZE);
    const membersHere = partyMembers.filter(member => member.x === player.x && member.y === player.y).length;

    return (
      <aside className="party-map-strip command-panel vine-frame pointer-events-auto fixed z-40 rounded border text-zinc-100">
        <div className="party-map-strip-head">
          <div className="min-w-0">
            <div className="arcane-label">Party</div>
            <div className="party-map-strip-title">
              {currentIsInvited ? 'Invite Pending' : `${memberCount}/${MAX_PARTY_SIZE} Commanders`}
            </div>
          </div>
          <span className="party-map-strip-status">{membersHere}/{memberCount} here</span>
          {partyInvites.length > 0 && <span className="party-map-strip-status">{partyInvites.length} invited</span>}
        </div>

        <div className="party-map-strip-members">
          {visibleMembers.map(member => {
            const isLeader = member.username.toLowerCase() === leaderUsername.toLowerCase();
            const locationLabel = member.x === player.x && member.y === player.y ? 'same tile' : `${member.x}, ${member.y}`;
            return (
              <span
                key={member.username}
                className={`party-map-member ${isLeader ? 'party-map-member-leader' : ''}`}
                title={`${member.username}${isLeader ? ' - leader' : ''} - Lv ${member.stats?.level || 1} - HP ${member.stats?.health || 0}/${member.stats?.maxHealth || 0} - ${locationLabel}`}
              >
                <Image
                  src={getPlayerModelPath(member.selectedModel || 3)}
                  alt=""
                  width={44}
                  height={44}
                  className="player-model-art"
                  unoptimized
                />
              </span>
            );
          })}
        </div>

        <div className="party-map-strip-actions">
          {currentIsInvited && (
            <button
              type="button"
              onClick={() => applySocialResult(acceptPartyInvite())}
              className="party-map-strip-button party-map-strip-button-primary"
            >
              Join
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsPartyDetailsOpen(open => !open)}
            className={`party-map-strip-button ${isPartyDetailsOpen ? 'party-map-strip-button-active' : ''}`}
            aria-expanded={isPartyDetailsOpen}
          >
            Details
          </button>
          <button
            type="button"
            onClick={openPartyChat}
            disabled={currentIsInvited}
            className="party-map-strip-button disabled:opacity-40"
          >
            Chat
          </button>
        </div>
      </aside>
    );
  }

  function renderPartyDetailsPopover() {
    const party = socialState.party;
    if (!party || !isPartyDetailsOpen) return null;

    const currentUsername = player.username.toLowerCase();
    const isLeader = party.leaderUsername.toLowerCase() === currentUsername;
    const isInvited = party.invitedUsernames.some(username => username.toLowerCase() === currentUsername);
    const memberNames = new Set(party.memberUsernames.map(username => username.toLowerCase()));
    const inviteNames = new Set(party.invitedUsernames.map(username => username.toLowerCase()));
    const inviteCandidates = socialCandidates
      .filter(candidate => !memberNames.has(candidate.username.toLowerCase()) && !inviteNames.has(candidate.username.toLowerCase()))
      .slice(0, 4);

    return (
      <aside className="party-details-popover command-panel vine-frame pointer-events-auto fixed z-50 rounded border text-zinc-100">
        <div className="party-details-head">
          <div>
            <div className="arcane-label">Party Detail</div>
            <h3 className="fantasy-heading party-details-title">
              {isInvited ? 'Invitation Waiting' : `${party.memberUsernames.length}/${MAX_PARTY_SIZE} Commanders`}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsPartyDetailsOpen(false)}
            className="party-details-close"
            aria-label="Close party details"
          >
            X
          </button>
        </div>

        {isInvited ? (
          <div className="party-details-invite-card">
            <p className="text-sm font-bold text-zinc-200">
              {party.leaderUsername} invited you to their party.
            </p>
            <button
              type="button"
              onClick={() => applySocialResult(acceptPartyInvite())}
              className="party-details-action party-details-action-primary"
            >
              Join Party
            </button>
          </div>
        ) : (
          <>
            <div className="party-details-member-list">
              {partyMembers.map(member => {
                const memberIsLeader = member.username.toLowerCase() === party.leaderUsername.toLowerCase();
                const memberIsCurrentUser = member.username.toLowerCase() === currentUsername;
                const locationLabel = member.x === player.x && member.y === player.y ? 'Same tile' : `Tile ${member.x}, ${member.y}`;
                return (
                  <div key={member.username} className={`party-details-member ${memberIsLeader ? 'party-details-member-leader' : ''}`}>
                    <span className="party-details-member-avatar">
                      <Image
                        src={getPlayerModelPath(member.selectedModel || 3)}
                        alt=""
                        width={58}
                        height={58}
                        className="player-model-art"
                        unoptimized
                      />
                    </span>
                    <span className="party-details-member-copy">
                      <span className="party-details-member-name">{member.username}</span>
                      <span className="party-details-member-meta">
                        {memberIsLeader ? 'Leader' : 'Member'} - Lv {member.stats?.level || 1} - {locationLabel}
                      </span>
                    </span>
                    {isLeader && !memberIsCurrentUser && (
                      <span className="party-details-member-actions">
                        <button
                          type="button"
                          onClick={() => applySocialResult(promotePartyMember(member.username))}
                          className="party-details-mini-action"
                        >
                          Lead
                        </button>
                        <button
                          type="button"
                          onClick={() => applySocialResult(removePlayerFromParty(member.username))}
                          className="party-details-mini-action party-details-mini-danger"
                        >
                          Kick
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {party.invitedUsernames.length > 0 && (
              <div className="party-details-pending">
                <div className="arcane-label">Pending Invites</div>
                <div className="party-details-pending-list">
                  {party.invitedUsernames.map(username => (
                    <span key={username} className="party-details-pending-chip">
                      {username}
                      {isLeader && (
                        <button
                          type="button"
                          onClick={() => applySocialResult(removePlayerFromParty(username))}
                          aria-label={`Cancel invite to ${username}`}
                        >
                          X
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isLeader && (
              <form
                className="party-details-invite-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleInvitePartyPlayer();
                }}
              >
                <input
                  value={partyInviteDraft}
                  onChange={(event) => setPartyInviteDraft(event.target.value)}
                  className="party-details-input"
                  placeholder="Invite player name"
                  list="party-invite-candidates"
                />
                <datalist id="party-invite-candidates">
                  {inviteCandidates.map(candidate => (
                    <option key={candidate.username} value={candidate.username} />
                  ))}
                </datalist>
                <button type="submit" className="party-details-action party-details-action-primary">
                  Invite
                </button>
              </form>
            )}

            <div className="party-details-actions">
              <button type="button" onClick={openPartyChat} className="party-details-action">
                Party Chat
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPartyDetailsOpen(false);
                  openPanel('social');
                }}
                className="party-details-action"
              >
                Social Panel
              </button>
              <button
                type="button"
                onClick={() => applySocialResult(leaveParty())}
                className="party-details-action party-details-action-danger"
              >
                Leave Party
              </button>
            </div>
          </>
        )}
      </aside>
    );
  }

  function renderSocial() {
    const isInvitedToParty = partyInvites.some(username => username.toLowerCase() === player.username.toLowerCase());
    const visibleCandidates = socialCandidates.slice(0, 8);

    return (
      <div className="social-panel-grid">
        <section className="ui-card rounded border p-4">
          <SectionTitle
            title="Party"
            action={socialState.party ? `${partyMembers.length}/${MAX_PARTY_SIZE}` : 'Solo'}
          />
          {socialState.party ? (
            <div className="space-y-3">
              <div className="grid gap-2">
                {partyMembers.map(member => (
                  <div key={member.username} className="social-row flex items-center gap-3 rounded px-2 py-2">
                    <span className="ui-avatar-frame relative h-12 w-12 shrink-0 overflow-hidden rounded border">
                      <Image
                        src={getPlayerModelPath(member.selectedModel || 3)}
                        alt=""
                        fill
                        className="player-model-art object-contain"
                        sizes="48px"
                        unoptimized
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-zinc-100">{member.username}</div>
                      <div className="ui-faint text-[10px] font-black uppercase">
                        {socialState.party?.leaderUsername.toLowerCase() === member.username.toLowerCase() ? 'Leader' : 'Member'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {partyInvites.length > 0 && (
                <div className="ui-pill rounded border px-3 py-2 text-xs font-bold text-[var(--ui-muted)]">
                  Invited: {partyInvites.join(', ')}
                </div>
              )}

              {isInvitedToParty ? (
                <button
                  type="button"
                  onClick={() => applySocialResult(acceptPartyInvite())}
                  className="ui-button-primary w-full rounded px-3 py-2 text-xs font-black"
                >
                  Join Party
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => applySocialResult(leaveParty())}
                  className="ui-button w-full rounded px-3 py-2 text-xs font-black"
                >
                  Leave Party
                </button>
              )}
            </div>
          ) : (
            <EmptyState text="No party. Invite a nearby player or friend." />
          )}
        </section>

        <section className="ui-card rounded border p-4">
          <SectionTitle title="Friends" action={`${acceptedFriends.length} linked`} />
          <form
            className="mb-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleAddFriend();
            }}
          >
            <input
              value={friendSearch}
              onChange={(event) => setFriendSearch(event.target.value)}
              className="ui-input min-w-0 flex-1 rounded px-3 py-2 text-xs font-bold"
              placeholder="Player name"
            />
            <button type="submit" className="ui-button-primary rounded px-3 py-2 text-xs font-black">
              Add
            </button>
          </form>

          <div className="space-y-2">
            {incomingFriendRequests.map(request => (
              <div key={`incoming-${request.username}`} className="social-row rounded px-3 py-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-black text-zinc-100">{request.username}</span>
                  <span className="arcane-label">Request</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => applySocialResult(acceptFriendRequest(request.username))}
                    className="ui-button-primary rounded px-2 py-2 text-xs font-black"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => applySocialResult(declineFriendRequest(request.username))}
                    className="ui-button rounded px-2 py-2 text-xs font-black"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}

            {acceptedFriends.length === 0 && incomingFriendRequests.length === 0 ? (
              <EmptyState text="No friends yet." />
            ) : (
              acceptedFriends.map(friend => (
                <div key={friend.username} className="social-row flex items-center justify-between gap-3 rounded px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-zinc-100">{friend.username}</div>
                    <div className="ui-faint text-[10px] font-black uppercase">Friend</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => applySocialResult(invitePlayerToParty(friend.username))}
                      className="ui-button rounded px-2 py-2 text-[10px] font-black"
                    >
                      Invite
                    </button>
                    <button
                      type="button"
                      onClick={() => applySocialResult(removeFriend(friend.username))}
                      className="ui-button rounded px-2 py-2 text-[10px] font-black"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}

            {outgoingFriendRequests.length > 0 && (
              <div className="ui-pill rounded border px-3 py-2 text-xs font-bold text-[var(--ui-muted)]">
                Pending: {outgoingFriendRequests.map(request => request.username).join(', ')}
              </div>
            )}
          </div>
        </section>

        <section className="ui-card rounded border p-4">
          <SectionTitle title="Players" action="Local roster" />
          {visibleCandidates.length === 0 ? (
            <EmptyState text="Create another local account to test social actions." />
          ) : (
            <div className="grid gap-2">
              {visibleCandidates.map(candidate => {
                const friend = socialState.friends.find(record => record.username.toLowerCase() === candidate.username.toLowerCase());
                return (
                  <div key={candidate.username} className="social-row flex items-center gap-3 rounded px-2 py-2">
                    <span className="ui-avatar-frame relative h-11 w-11 shrink-0 overflow-hidden rounded border">
                      <Image
                        src={getPlayerModelPath(candidate.selectedModel || 3)}
                        alt=""
                        fill
                        className="player-model-art object-contain"
                        sizes="44px"
                        unoptimized
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-zinc-100">{candidate.username}</div>
                      <div className="ui-faint text-[10px] font-black uppercase">Lv {candidate.stats?.level || 1}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => applySocialResult(sendFriendRequest(candidate.username))}
                        disabled={Boolean(friend)}
                        className="ui-button rounded px-2 py-2 text-[10px] font-black disabled:opacity-35"
                      >
                        {friend?.status === 'accepted' ? 'Friend' : friend?.status === 'pending' ? 'Pending' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => applySocialResult(invitePlayerToParty(candidate.username))}
                        className="ui-button rounded px-2 py-2 text-[10px] font-black"
                      >
                        Party
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="ui-card rounded border p-4">
          <SectionTitle title="Chat" action={chatChannel} />
          <div className="mb-3 flex gap-2">
            {(['global', 'party'] as SocialChatChannel[]).map(channel => (
              <button
                key={channel}
                type="button"
                onClick={() => setChatChannel(channel)}
                disabled={channel === 'party' && !socialState.party}
                className={`rounded px-3 py-2 text-xs font-black uppercase ${chatChannel === channel ? 'ui-button-primary' : 'ui-button'} disabled:opacity-35`}
              >
                {channel}
              </button>
            ))}
          </div>
          <div className="min-h-56 space-y-2 rounded bg-black/16 p-3 text-xs font-bold">
            {chatMessages.length === 0 ? (
              <EmptyState text="No messages." />
            ) : (
              chatMessages.map(message => (
                <div key={`panel-${message.id}`} className="chat-line">
                  <span className="ui-accent font-black">{message.author}</span>
                  <span className="ml-2 text-zinc-100">{message.text}</span>
                </div>
              ))
            )}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleSendChat();
            }}
          >
            <input
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              maxLength={180}
              className="ui-input min-w-0 flex-1 rounded px-3 py-2 text-xs font-bold"
              placeholder="Message"
            />
            <button type="submit" className="ui-button-primary rounded px-3 py-2 text-xs font-black">
              Send
            </button>
          </form>
        </section>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="settings-panel-stack">
        <GameSettingsPanel compact showRunTutorial={showRandomRun} />
        <section className="ui-card settings-mode-card rounded border p-4">
          <SectionTitle title="Game Mode" action="World Map" />
          <p className="ui-muted text-sm font-bold leading-relaxed">
            Switch between the shared world map and the singleplayer run hall.
          </p>
          <button
            type="button"
            onClick={() => router.push('/mode')}
            className="ui-button mt-3 rounded px-4 py-2.5 text-sm font-black"
          >
            Change Mode
          </button>
        </section>
      </div>
    );
  }

  function renderOverview() {
    const mpDailyChallenge = getMpDailyDungeonChallenge(Date.now());
    const completedMpDailyToday = hasCompletedMpDailyDungeonToday(player, Date.now());
    const trackedCityQuest = (player.cityQuests || [])
      .map(progress => {
        const template = getCityQuestTemplate(progress.questId);
        if (!template) return null;
        return { template, status: getCityQuestStatus(player, progress.questId) };
      })
      .find(item => item && !item.status.claimed) || null;
    const openDailyQuests = quests.filter(quest => !quest.claimed);

    return (
      <div className="overview-dashboard-grid overview-dashboard-modern">
        <section className="ui-card rounded border p-4">
          <SectionTitle title="Daily Gauntlet" action={completedMpDailyToday ? 'Done' : 'PVE'} />
          <div className="fantasy-heading truncate text-xl">{mpDailyChallenge.name}</div>
          <p className="ui-muted mt-1 text-sm font-bold">{mpDailyChallenge.subtitle}</p>
          <div className="ui-faint mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
            <span>{mpDailyChallenge.battleCount} fights</span>
            <span>Boss: {mpDailyChallenge.bossName}</span>
            <span>{mpDailyChallenge.rewardGold} gold</span>
            <span>{mpDailyChallenge.rewardRareGems} gems</span>
          </div>
          <button
            type="button"
            disabled={completedMpDailyToday}
            onClick={() => {
              emitFxEvent({ type: 'daily', tone: 'violet', intensity: 0.85 });
              setShowMpDailyRun(true);
            }}
            className="ui-button-primary mt-4 w-full rounded px-3 py-2.5 text-sm font-black disabled:opacity-40"
          >
            {completedMpDailyToday ? 'Completed Today' : 'Enter Daily Gauntlet'}
          </button>
        </section>

        <section className="ui-card rounded border p-4">
          <SectionTitle title="Work" action={`${activeJobs.length}/4`} />
          {!player.traveling && activeJobs.length === 0 ? (
            <EmptyState text="No active jobs." />
          ) : (
            <div className="space-y-2">
              {player.traveling && renderTravelCard(player.traveling, true)}
              {activeJobs.slice(0, 3).map(job => renderJobCard(job.id, true))}
            </div>
          )}
        </section>

        <section className="ui-card overview-quests-panel rounded border p-4">
          <SectionTitle title="Quests" action={`${openDailyQuests.length + (trackedCityQuest ? 1 : 0)} open`} />
          <div className="space-y-3">
            {trackedCityQuest ? (
              <button
                type="button"
                onClick={() => setActivePanel('quests')}
                className="quest-card ui-card w-full rounded border p-3 text-left transition hover:border-[rgba(232,217,184,0.34)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="arcane-label">{trackedCityQuest.template.town}</div>
                    <div className="fantasy-heading truncate text-base">{trackedCityQuest.template.name}</div>
                    <p className="ui-muted mt-1 line-clamp-2 text-sm font-bold">{trackedCityQuest.template.description}</p>
                  </div>
                  <span className={`rounded px-2 py-1 text-[10px] font-black ${trackedCityQuest.status.complete ? 'bg-amber-900 text-amber-200' : 'bg-zinc-800 text-zinc-300'}`}>
                    {trackedCityQuest.status.complete ? 'Ready' : 'Open'}
                  </span>
                </div>
                <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
                  <div className="ui-progress-fill h-full" style={{ width: `${Math.min(100, (trackedCityQuest.status.progress / trackedCityQuest.status.required) * 100)}%` }} />
                </div>
              </button>
            ) : (
              <EmptyState text="No city contract tracked. Visit a town board." />
            )}

            {openDailyQuests.length > 0 && (
              <div className="space-y-2">
                {openDailyQuests.slice(0, 4).map(quest => {
                  const complete = quest.progress >= quest.requirement.count;
                  return (
                  <button
                    key={quest.id}
                    type="button"
                    onClick={() => setActivePanel('quests')}
                    className="overview-daily-quest ui-card w-full rounded border px-3 py-2.5 text-left transition hover:border-[rgba(232,217,184,0.34)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-zinc-100">{quest.name}</div>
                        <div className="ui-muted text-xs font-bold">{quest.progress}/{quest.requirement.count}</div>
                      </div>
                      <span className="ui-pill shrink-0 rounded border px-2 py-1 text-[10px] font-black">
                        {complete ? 'Claim' : 'Daily'}
                      </span>
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderCharacter() {
    const statButtons: Array<{ id: AllocatableStat; label: string; shortLabel: string; value: number | string }> = [
      { id: 'armyPower', label: 'Army Power', shortLabel: 'Army', value: player.stats.armyPower },
      { id: 'defensivePower', label: 'Defensive Power', shortLabel: 'Ward', value: player.stats.defensivePower },
      { id: 'morale', label: 'Morale', shortLabel: 'Morale', value: player.stats.morale },
      { id: 'spellPower', label: 'Spell Power', shortLabel: 'Spell', value: player.stats.spellPower },
      { id: 'health', label: 'Health', shortLabel: 'Health', value: `${player.stats.health}/${player.stats.maxHealth}` },
    ];

    return (
      <div className="character-layout-grid character-layout-modern character-commander-panel">
        <section className="ui-card character-hero-card rounded border p-5">
          <div className="character-hero-banner">
            <span className="ui-avatar-frame character-hero-avatar relative block overflow-hidden rounded-full border">
              <Image
                src={getPlayerModelPath(currentModel)}
                alt={player.username}
                fill
                className="player-model-art object-contain p-2"
                sizes="128px"
                unoptimized
              />
            </span>
            <div className="arcane-label mt-3">Commander</div>
            <h3 className="fantasy-heading text-3xl">{player.username}</h3>
            <div className="character-xp-bar ui-progress-track mt-3 h-2 overflow-hidden rounded border">
              <div className="ui-progress-fill h-full" style={{ width: `${expProgress}%` }} />
            </div>
            <div className="ui-faint mt-1 text-[11px] font-bold">{player.exp} / {expNeeded} XP</div>
          </div>

          <div className="character-quick-stats mt-4">
            <div className="character-quick-stat">
              <span className="character-quick-stat-label">Level</span>
              <span className="character-quick-stat-value">{player.stats.level}</span>
            </div>
            <div className="character-quick-stat">
              <span className="character-quick-stat-label">Points</span>
              <span className="character-quick-stat-value">{player.stats.unallocatedPoints}</span>
            </div>
            <div className="character-quick-stat">
              <span className="character-quick-stat-label">Health</span>
              <span className="character-quick-stat-value">{player.stats.health}/{player.stats.maxHealth}</span>
            </div>
            <div className="character-quick-stat">
              <span className="character-quick-stat-label">Gold</span>
              <span className="character-quick-stat-value">{player.gold}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              onClick={onOpenAvatar}
              className="ui-button-primary rounded px-4 py-2 text-sm font-black"
            >
              Change Avatar
            </button>
            <button
              type="button"
              onClick={() => setActivePanel('inventory')}
              className="ui-button rounded px-4 py-2 text-sm font-bold"
            >
              Equipment
            </button>
          </div>
        </section>

        <section className="ui-card character-stats-card rounded border p-5">
          <SectionTitle title="Stats" action={`${player.stats.unallocatedPoints} points`} />
          <div className="character-stat-grid character-stat-grid-modern">
            {statButtons.map(stat => (
              <div key={stat.id} className="character-stat-row rounded border">
                <div className="character-stat-copy">
                  <span className="character-stat-label">{stat.label}</span>
                  <span className="character-stat-value">{stat.value}</span>
                </div>
                <button
                  onClick={() => handleAllocate(stat.id)}
                  disabled={player.stats.unallocatedPoints === 0}
                  className="character-stat-add ui-button-primary rounded disabled:opacity-30"
                  aria-label={`Increase ${stat.label}`}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="ui-card character-gear-card rounded border p-5">
          <SectionTitle title="Gear Bonuses" action={`${Object.keys(equippedSlots).length}/${equipmentSlots.length}`} />
          <div className="character-gear-grid character-gear-grid-modern">
            <div className="character-gear-chip rounded border">
              <span className="character-gear-chip-label">Army</span>
              <span className="character-gear-chip-value">+{totalEquipmentStats.armyPower}</span>
            </div>
            <div className="character-gear-chip rounded border">
              <span className="character-gear-chip-label">Ward</span>
              <span className="character-gear-chip-value">+{totalEquipmentStats.defensivePower}</span>
            </div>
            <div className="character-gear-chip rounded border">
              <span className="character-gear-chip-label">Morale</span>
              <span className="character-gear-chip-value">+{totalEquipmentStats.morale}</span>
            </div>
            <div className="character-gear-chip rounded border">
              <span className="character-gear-chip-label">Spell</span>
              <span className="character-gear-chip-value">+{totalEquipmentStats.spellPower}</span>
            </div>
            <div className="character-gear-chip character-gear-chip-wide rounded border">
              <span className="character-gear-chip-label">Max HP</span>
              <span className="character-gear-chip-value">+{totalEquipmentStats.maxHealth}</span>
            </div>
          </div>
        </section>

        {gearSetSummaries.length > 0 && (
          <section className="ui-card character-sets-card rounded border p-5">
            <SectionTitle title="Active Gear Sets" action={`${gearSetSummaries.length} active`} />
            <div className="character-sets-list space-y-2">
              {gearSetSummaries.map(summary => (
                <div key={summary.setId} className="character-set-row rounded border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black text-zinc-100">{summary.name}</div>
                    <span className="ui-accent text-xs font-black">{summary.pieces}/6 pieces</span>
                  </div>
                  <div className="ui-muted mt-2 space-y-1 text-xs font-bold">
                    {summary.activeBonuses.map(bonus => (
                      <div key={`${summary.setId}-${bonus.pieces}`}>
                        {bonus.pieces}-piece: {bonus.effect}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  function renderInventory() {
    return (
      <div className="inventory-layout-grid">
        <section>
          <SectionTitle title="Equipped Gear" action={`${Object.keys(equippedSlots).length}/${equipmentSlots.length}`} />
          <div className="equipment-paperdoll-grid">
            {equipmentSlots.map(slot => {
              const item = getEquippedItem(slot);

              return (
                <div key={slot} className={`equipment-paperdoll-slot equipment-slot-${slot} ui-card rounded p-2`}>
                  <div className="ui-faint text-[10px] font-bold uppercase">{slot.replace('-', ' ')}</div>
                  {item ? (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="ui-icon-frame relative h-12 w-12 shrink-0 overflow-hidden rounded">
                        <Image
                          src={getEquipmentIconPath(item)}
                          alt={item.name}
                          fill
                          sizes="48px"
                          className="object-contain p-1"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </span>
                      <div className="min-w-0">
                        <div className={`rounded px-2 py-1 text-xs font-bold ${rarityClasses(item.rarity)}`}>{item.name}</div>
                        <button onClick={() => handleUnequip(slot)} className="mt-2 text-xs font-bold text-red-300 hover:text-red-100">Unequip</button>
                      </div>
                    </div>
                  ) : (
                    <div className="ui-faint mt-5 text-center text-xs font-bold uppercase">Empty</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle title="Items" action="Unlimited carry" />
          {inventory.length === 0 ? (
            <EmptyState text="No carried items." />
          ) : (
            <div className="command-icon-grid inventory-item-grid">
              {inventory.map(item => {
                const definition = getInventoryItemDefinition(item.id);
                const kind = definition?.kind || item.kind || 'material';
                const rarity = definition?.rarity || item.rarity || 'common';
                const canUse = kind === 'consumable' || kind === 'container';

                return (
                  <div
                    key={item.id}
                    tabIndex={0}
                    className={`command-icon-tile rounded border ${canUse ? 'command-icon-tile-has-action' : ''} ${rarityClasses(rarity)}`}
                  >
                    <span className="command-icon-image overflow-hidden rounded">
                      <Image
                        src={getInventoryIconPath(item)}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-contain p-1.5"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </span>
                    <span className="command-icon-quantity">x{item.quantity}</span>
                    {canUse && (
                      <button
                        type="button"
                        onClick={() => handleUseInventoryItem(item.id)}
                        className="command-icon-action rounded"
                      >
                        {definition?.useLabel || 'Use'}
                      </button>
                    )}
                    <span className="command-icon-tooltip rounded border">
                      <span className="command-icon-tooltip-title block font-black text-zinc-100">{definition?.name || item.name}</span>
                      <span className="command-icon-tooltip-meta ui-faint block font-black uppercase">{kind} - {rarity}</span>
                      <span className="command-icon-tooltip-copy ui-muted block font-bold">
                        {definition?.description || item.description || 'Carried inventory item.'}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionTitle title="Available Gear" action={`${gearUsed}/${inventorySlots} gear slots`} />
          {unequippedItems.length === 0 ? (
            <EmptyState text="No unequipped gear." />
          ) : (
            <div className="command-icon-grid gear-available-grid">
              {unequippedItems.map(item => (
                <CommandGearHoverTip
                  key={item.id}
                  popover={(
                    <EquipmentGearPopover
                      item={item}
                      compareEquipped={getEquippedItem(item.slot)}
                    />
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleEquip(item.id)}
                    className={`command-icon-tile command-icon-tile-external-tip rounded border ${rarityClasses(item.rarity)}`}
                    aria-label={`Equip ${item.name}`}
                  >
                    <span className="command-icon-image overflow-hidden rounded">
                      <Image
                        src={getEquipmentIconPath(item)}
                        alt=""
                        fill
                        sizes="88px"
                        className="object-contain p-1.5"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </span>
                  </button>
                </CommandGearHoverTip>
              ))}
            </div>
          )}
        </section>

        {!inventoryUpgradeQuote.maxed && (
          <section className="ui-card rounded border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="fantasy-heading text-base">Gear Storage Upgrade</h3>
                <p className="ui-muted text-xs font-bold">
                  Level {inventoryUpgradeQuote.nextLevel}/10 - {inventoryUpgradeQuote.successChance}% chance
                </p>
              </div>
              <button
                onClick={handleInventoryUpgrade}
                disabled={player.gold < inventoryUpgradeQuote.goldCost || rareGemCount < inventoryUpgradeQuote.gemCost}
                className="ui-button-primary rounded px-3 py-2 text-xs font-bold disabled:opacity-40"
              >
                Upgrade
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <StatusPill label="Gold" value={`${inventoryUpgradeQuote.goldCost}`} />
              <StatusPill label="Gems" value={`${inventoryUpgradeQuote.gemCost}/${rareGemCount}`} />
              <StatusPill label="Next" value={`${inventorySlots + 1} slots`} />
            </div>
          </section>
        )}
      </div>
    );
  }


  function renderMinions() {
    const rosterMinions = getOrderedMinions(player);
    const reserveCount = rosterMinions.filter(minion => !minion.fielded).length;

    return (
      <div className="minions-layout-grid minions-layout-modern">
        <section className="ui-card minion-field-strip rounded border p-4">
          <SectionTitle title="Battle Lineup" action={`${fieldedMinions.length}/${MAX_FIELD_MINIONS} fielded`} />
          <p className="ui-muted mb-3 text-xs font-bold">
            Drag units from the roster into seven active slots. Reserves stay available for multiplayer formation screens.
          </p>
          <div className="army-lineup-strip">
            {Array.from({ length: MAX_FIELD_MINIONS }, (_, index) => {
              const minion = fieldedMinions[index];
              const template = minion ? getMinionTemplate(minion.templateId) : undefined;

              return (
                <button
                  type="button"
                  key={index}
                  draggable={Boolean(minion)}
                  onClick={() => {
                    if (armySwapSourceId) {
                      handleAssignMinionBattleSlot(armySwapSourceId, index);
                    } else if (minion) {
                      setArmySwapSourceId(minion.id);
                    }
                  }}
                  onDragStart={(event) => {
                    if (!minion) return;
                    event.dataTransfer.setData('text/army-minion', minion.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const minionId = event.dataTransfer.getData('text/army-minion');
                    if (minionId) handleAssignMinionBattleSlot(minionId, index);
                  }}
                  className={`army-lineup-slot ui-icon-frame relative aspect-square overflow-hidden rounded ${minion ? 'army-lineup-slot-filled' : ''} ${minion && armySwapSourceId === minion.id ? 'army-lineup-slot-selected' : ''}`}
                  title={template?.name || `Battle slot ${index + 1}`}
                >
                  {template ? (
                    <Image
                      src={`${MINION_ICON_BASE}/${template.assetName}`}
                      alt={template.name}
                      fill
                      className="sprite-soft-glow minion-menu-image object-contain p-2"
                      sizes="64px"
                      unoptimized
                    />
                  ) : (
                    <span className="ui-faint text-xs font-black">{index + 1}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="ui-faint mt-3 text-[11px] font-bold">
            {reserveCount} reserve unit{reserveCount === 1 ? '' : 's'} outside the active line.
          </div>
        </section>

        <section className="ui-card rounded border p-4">
          <SectionTitle title="Army Roster" action={`${rosterMinions.length} recruited`} />
          <p className="ui-muted mb-3 text-xs font-bold">
            {armySwapSourceId
              ? 'Drop or click a battle slot, another unit, or press Bench to change lineup.'
              : 'Drag a unit to the battle lineup, or click two units to reorder reserves.'}
          </p>
          {rosterMinions.length === 0 ? (
            <EmptyState text="No recruited minions." />
          ) : (
            <div className="army-roster-grid">
              {rosterMinions.map((minion, index) => {
                const template = getMinionTemplate(minion.templateId);
                if (!template) return null;

                const injured = isMinionInjured(minion, now);
                const fielded = Boolean(minion.fielded);
                const selected = armySwapSourceId === minion.id;
                const isBattleSlot = index < MAX_FIELD_MINIONS;

                return (
                  <CommandGearHoverTip
                    key={minion.id}
                    popover={(
                      <MinionArmyHoverPopover
                        template={template}
                        minion={minion}
                        rosterIndex={index}
                        now={now}
                      />
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleArmyMinionClick(minion.id)}
                      onDoubleClick={(event) => {
                        event.preventDefault();
                        handleToggleArmyFielded(minion.id);
                      }}
                      draggable={!injured}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/army-minion', minion.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceId = event.dataTransfer.getData('text/army-minion');
                        if (!sourceId || sourceId === minion.id) return;
                        const result = reorderMinionRoster(sourceId, minion.id);
                        setArmySwapSourceId(null);
                        if (!result.success) {
                          setTemporaryNotice(result.error || 'Could not swap units.');
                          return;
                        }
                        setUser(getCurrentUser());
                      }}
                      className={`army-roster-tile command-icon-tile command-icon-tile-external-tip rounded border ${minionTierClasses(template.tier)} ${selected ? 'army-roster-tile-selected' : ''} ${fielded ? 'army-roster-tile-fielded' : ''} ${injured ? 'army-roster-tile-injured' : ''} ${isBattleSlot ? 'army-roster-tile-battle-slot' : ''}`}
                      aria-label={`${template.name}, roster position ${index + 1}`}
                      aria-pressed={selected}
                    >
                      <span className="command-icon-image overflow-hidden rounded">
                        <Image
                          src={`${MINION_ICON_BASE}/${template.assetName}`}
                          alt={template.name}
                          fill
                          sizes="80px"
                          className="sprite-soft-glow minion-menu-image object-contain p-1.5"
                          unoptimized
                        />
                      </span>
                      <span className="army-roster-tier">{MINION_TIER_LABELS[template.tier]}</span>
                      <span className="army-roster-slot">{index + 1}</span>
                      {!injured && <span className="army-roster-fielded">{fielded ? 'Active' : 'Reserve'}</span>}
                      {injured && <span className="army-roster-status">Injured</span>}
                    </button>
                  </CommandGearHoverTip>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderSpells() {
    const knownSpellIds = new Set(player.knownSpellIds || DEFAULT_EQUIPPED_SPELL_IDS);
    const equippedSpellIds = player.equippedSpellIds?.length === 4 ? player.equippedSpellIds : DEFAULT_EQUIPPED_SPELL_IDS;
    const equippedSpells = equippedSpellIds
      .map(spellId => BATTLE_SPELLS.find(spell => spell.id === spellId))
      .filter((spell): spell is (typeof BATTLE_SPELLS)[number] => Boolean(spell));
    const selectedSlotSpell = equippedSpells[selectedSpellSlot];
    const inspectedSpell =
      BATTLE_SPELLS.find(spell => spell.id === (hoveredSpellId || selectedSlotSpell?.id)) ||
      selectedSlotSpell ||
      BATTLE_SPELLS[0];
    const inspectedEquippedIndex = equippedSpellIds.findIndex(spellId => spellId === inspectedSpell.id);
    const inspectedKnown = knownSpellIds.has(inspectedSpell.id);
    const spellTargetLabel =
      inspectedSpell.target === 'enemy' ? 'Enemy' : inspectedSpell.target === 'ally' ? 'Ally' : 'Field';

    return (
      <div className="spells-panel spells-panel-modern">
        <section className={`spells-spotlight spells-spotlight-modern ui-card spell-card spell-card-${inspectedSpell.rarity} rounded border p-4`}>
          <div className="spells-spotlight-art">
            <SpellArt spell={inspectedSpell} variant="hero" dimmed={!inspectedKnown} />
          </div>
          <div className="spells-spotlight-copy min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ui-pill rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]">
                {inspectedSpell.rarity}
              </span>
              <span className="ui-pill rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]">
                {spellTargetLabel}
              </span>
              <span className="ui-pill rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]">
                M {inspectedSpell.cost}
              </span>
              {inspectedEquippedIndex !== -1 && (
                <span className="spells-equipped-pill rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]">
                  Slot {inspectedEquippedIndex + 1}
                </span>
              )}
              {!inspectedKnown && (
                <span className="rounded border border-zinc-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                  Locked
                </span>
              )}
            </div>
            <h3 className="fantasy-heading mt-2 text-3xl leading-tight">{inspectedSpell.name}</h3>
            <p className="ui-muted mt-2 text-base font-bold leading-relaxed">{inspectedSpell.description}</p>
          </div>
        </section>

        <section className="spells-loadout-section ui-card rounded border p-4">
          <SectionTitle title="Loadout" action={`Slot ${selectedSpellSlot + 1}`} compact />
          <div className="spells-loadout-slots">
            {equippedSpells.map((spell, index) => (
              <button
                key={`${spell.id}-${index}`}
                type="button"
                onClick={() => {
                  setSelectedSpellSlot(index);
                  setHoveredSpellId(spell.id);
                }}
                onMouseEnter={() => setHoveredSpellId(spell.id)}
                onFocus={() => setHoveredSpellId(spell.id)}
                className={`spells-loadout-slot transition ${selectedSpellSlot === index ? 'spell-loadout-slot-selected' : ''}`}
                aria-pressed={selectedSpellSlot === index}
              >
                <SpellArt spell={spell} variant="loadout" />
                <span className="spells-loadout-slot-label">Slot {index + 1}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="spells-archive-section ui-card rounded border p-4">
          <SectionTitle title="Archive" action={`${knownSpellIds.size} / ${BATTLE_SPELLS.length}`} compact />
          <div className="spells-archive-grid">
            {BATTLE_SPELLS.map(spell => {
              const known = knownSpellIds.has(spell.id);
              const equippedIndex = equippedSpellIds.findIndex(id => id === spell.id);
              const equipped = equippedIndex !== -1;

              return (
                <button
                  key={spell.id}
                  type="button"
                  onClick={() => {
                    setHoveredSpellId(spell.id);
                    if (known) handleEquipSpellToSelectedSlot(spell.id);
                  }}
                  onMouseEnter={() => setHoveredSpellId(spell.id)}
                  onFocus={() => setHoveredSpellId(spell.id)}
                  aria-disabled={!known}
                  className={`spells-archive-tile transition ${!known ? 'spells-archive-tile-locked' : ''} ${equipped ? 'spells-archive-tile-equipped' : ''} ${hoveredSpellId === spell.id ? 'spells-archive-tile-active' : ''}`}
                >
                  <span className="spells-archive-tile-art">
                    <SpellArt spell={spell} variant="archive" dimmed={!known} />
                    {equipped && <span className="spells-archive-slot-badge">{equippedIndex + 1}</span>}
                  </span>
                  <span className="spells-archive-tile-name">{spell.name}</span>
                  <span className="spells-archive-tile-meta">
                    {!known ? 'Locked' : equipped ? 'Equipped' : `M ${spell.cost}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderRuns() {
    const dailyStatus = getDailyRunStatus(player);
    const runState = getDailyRunState(player);
    const runExpNeeded = getRandomRunExpNeeded(runState.runLevel);
    const leaderboard = getDailyRunLeaderboard();
    const lastRun = dailyStatus.history[0];
    const permanent = runState.permanentStats;

    return (
      <div className="command-content-grid">
        <section className="ui-card rounded border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="arcane-label">Run</div>
              <h3 className="fantasy-heading text-xl">Roguelike Road</h3>
            </div>
            <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase">
              Level {runState.runLevel}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <StatusPill label="Clears" value={String(runState.completions)} />
            <StatusPill label="Run XP" value={`${runState.runExp}/${runExpNeeded}`} />
            <StatusPill label="Best" value={`${dailyStatus.bestWins} wins`} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="ui-pill rounded border px-3 py-1 text-xs font-black text-zinc-100">Army +{permanent.armyPower}</span>
            <span className="ui-pill rounded border px-3 py-1 text-xs font-black text-zinc-100">Ward +{permanent.defensivePower}</span>
            <span className="ui-pill rounded border px-3 py-1 text-xs font-black text-zinc-100">Spell +{permanent.spellPower}</span>
            <span className="ui-pill rounded border px-3 py-1 text-xs font-black text-zinc-100">Unit +{permanent.unitPower}/{permanent.unitWard}</span>
          </div>
          <button
            onClick={() => setShowDailyRun(true)}
            className="ui-button-primary mt-4 rounded px-4 py-3 text-sm font-black"
          >
            {savedDailyRun ? 'Resume Run' : 'Start Run'}
          </button>
          {lastRun && (
            <div className="ui-pill mt-3 rounded border px-3 py-2 text-xs font-bold text-[var(--ui-muted)]">
              Last clear: {lastRun.challengeName || 'Run'} - {lastRun.wins}/{lastRun.targetBattles} wins, {lastRun.score || 0} score, {lastRun.exp} run XP.
            </div>
          )}
        </section>

        <section className="ui-card rounded border p-4">
          <SectionTitle title="Run Ledger" action={leaderboard.length > 0 ? 'Local top' : 'No clears'} />
          {leaderboard.length === 0 ? (
            <EmptyState text="No run clears recorded yet." />
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div key={entry.username} className="ui-card flex items-center justify-between gap-3 rounded border px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-zinc-100">#{index + 1} {entry.username}</div>
                    <div className="ui-faint text-xs font-bold">{entry.completions} clears - best {entry.bestWins} wins</div>
                  </div>
                  <span className="ui-value shrink-0 text-sm font-black">{entry.streak} chain</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderLeaderboards() {
    const boards = getLeaderboardBoards();
    const populatedBoards = boards.filter(board => board.entries.length > 0);

    return (
      <div className="command-content-grid">
        <section className="ui-card rounded border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="arcane-label">Leaderboards</div>
              <h3 className="fantasy-heading text-xl">Local Halls</h3>
              <p className="ui-muted mt-1 text-sm font-bold">
                These boards rank commanders stored in this browser. The same board shape is ready for a live database.
              </p>
            </div>
            <span className="ui-pill shrink-0 rounded border px-3 py-2 text-xs font-black">
              Local
            </span>
          </div>
        </section>

        {populatedBoards.length === 0 ? (
          <EmptyState text="No ranked commanders yet." />
        ) : (
          populatedBoards.map(board => renderLeaderboardBoard(board))
        )}

        <section className="ui-card rounded border p-4">
          <div className="arcane-label">Live Database</div>
          <h3 className="fantasy-heading text-lg">Deployment Target</h3>
          <p className="ui-muted mt-1 text-sm font-bold">
            Move accounts, player state, reports, PVP challenges, and leaderboard views from localStorage into Postgres before public deployment.
          </p>
        </section>
      </div>
    );
  }

  function renderLeaderboardBoard(board: LeaderboardBoard) {
    return (
      <section key={board.id}>
        <SectionTitle title={board.title} action={board.subtitle} />
        <div className="space-y-2">
          {board.entries.map(entry => (
            <div key={`${board.id}-${entry.username}`} className="ui-card flex items-center gap-3 rounded border px-3 py-3">
              <div className="ui-value w-7 shrink-0 text-center text-sm font-black">#{entry.rank}</div>
              <span className="ui-avatar-frame relative h-11 w-11 shrink-0 overflow-hidden rounded border">
                <Image
                  src={getPlayerModelPath(entry.selectedModel)}
                  alt=""
                  fill
                  className="player-model-art object-contain"
                  sizes="44px"
                  unoptimized
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-zinc-100">{entry.username}</div>
                <div className="ui-faint truncate text-xs font-bold">{entry.detail}</div>
              </div>
              <div className="text-right">
                <div className="ui-value text-sm font-black">{entry.label}</div>
                <div className="ui-faint text-[10px] font-bold">Lv {entry.level}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderJobs() {
    return (
      <div className="command-content-grid">
        <section>
          <SectionTitle title="Road Travel" action="Queue free" />
          {player.traveling ? (
            renderTravelCard(player.traveling)
          ) : (
            <EmptyState text="No direct travel in progress." />
          )}
        </section>

        <section>
          <SectionTitle title="Active Queue" action={`${activeJobs.length}/4`} />
          {activeJobs.length === 0 ? (
            <EmptyState text="No jobs queued." />
          ) : (
            <div className="space-y-3">
              {activeJobs.map(job => renderJobCard(job.id))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle title="Recent Jobs" action="Last 8" />
          {renderHistory(activityLog.filter(activity => activity.type === 'job').slice(0, 8))}
        </section>
      </div>
    );
  }

  function toggleQuestDetails(questId: string) {
    setExpandedQuestId(current => current === questId ? null : questId);
  }

  function getQuestGuideNpc(requiredLevel: number, town?: string) {
    const candidates = town ? QUEST_NPCS.filter(npc => npc.town === town) : QUEST_NPCS;
    return [...(candidates.length > 0 ? candidates : QUEST_NPCS)]
      .sort((left, right) => getNpcLevelDistance(left.levelRange, requiredLevel) - getNpcLevelDistance(right.levelRange, requiredLevel))[0];
  }

  function getNpcLevelDistance(levelRange: string, targetLevel: number) {
    const [min, max] = levelRange.split('-').map(value => Number(value) || 1);
    if (targetLevel >= min && targetLevel <= max) return 0;
    return Math.min(Math.abs(targetLevel - min), Math.abs(targetLevel - max));
  }

  function renderQuestGuidePanel(questId: string, npc: (typeof QUEST_NPCS)[number], lore: string, instruction: string) {
    if (expandedQuestId !== questId) return null;

    return (
      <div className="mt-3 rounded border border-[rgba(232,217,184,0.18)] bg-black/24 p-3 text-left">
        <div className="arcane-label">Go To</div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="font-black text-zinc-100">{npc.name}</div>
          <div className="ui-pill rounded border px-2 py-1 text-[10px] font-black text-[var(--ui-accent)]">
            {npc.town}
          </div>
        </div>
        <p className="ui-muted mt-2 text-xs font-bold">{instruction}</p>
        <p className="mt-2 text-xs font-bold text-zinc-200">&ldquo;{lore}&rdquo;</p>
      </div>
    );
  }

  function renderQuests() {
    const acceptedCityQuests = (player.cityQuests || [])
      .map(progress => {
        const template = getCityQuestTemplate(progress.questId);
        if (!template) return null;
        return { progress, template, status: getCityQuestStatus(player, progress.questId) };
      })
      .filter(Boolean) as Array<{
        progress: NonNullable<typeof player.cityQuests>[number];
        template: NonNullable<ReturnType<typeof getCityQuestTemplate>>;
        status: ReturnType<typeof getCityQuestStatus>;
      }>;
    const storyPreview = getAllStoryQuestsSorted();
    const visibleStoryQuests = storyPreview.filter(story => {
      const status = getStoryQuestStatus(player, story.id);
      return status.unlocked && !status.claimed;
    });
    const storyChapter = STORY_CHAPTERS.find(chapter => (
      visibleStoryQuests.some(story => story.chapter === chapter.id)
    )) || STORY_CHAPTERS[STORY_CHAPTERS.length - 1];
    const hiddenStoryCount = storyPreview.length - visibleStoryQuests.length;
    const visibleCityQuests = acceptedCityQuests.filter(item => !item.status.claimed);
    const visibleDailyQuests = quests.filter(quest => !quest.claimed);

    return (
      <div className="command-content-grid">
        <section>
          <SectionTitle title="Main Story" action={hiddenStoryCount > 0 ? `${hiddenStoryCount} hidden` : storyChapter?.title || 'Chapter I'} />
          <div className="space-y-2">
            {visibleStoryQuests.length === 0 && <EmptyState text="No active story step. Level up or claim ready rewards." />}
            {visibleStoryQuests.map(story => {
              const status = getStoryQuestStatus(player, story.id);
              const unlocked = status.unlocked;
              const questKey = `story-${story.id}`;
              const guideNpc = getQuestGuideNpc(story.requiredLevel);
              const spellRewards = (story.rewards.spellIds || [])
                .map(spellId => BATTLE_SPELLS.find(spell => spell.id === spellId)?.name)
                .filter(Boolean);
              return (
                <div
                  key={story.id}
                  onClick={() => toggleQuestDetails(questKey)}
                  className={`quest-card ui-card w-full cursor-pointer rounded border p-3 text-left transition ${unlocked ? 'hover:border-[rgba(232,217,184,0.34)]' : 'opacity-55'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="fantasy-heading text-sm">{story.order}. {story.name}</div>
                      <p className="ui-muted text-xs font-bold">{story.lore}</p>
                      <div className="ui-muted mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                        <span>{status.progress}/{status.required}</span>
                        {story.rewards.exp ? <span>{getBalancedQuestExp(story.rewards.exp)} XP</span> : null}
                        {spellRewards.length > 0 ? <span>{spellRewards.join(', ')}</span> : null}
                      </div>
                    </div>
                    <span className={`ui-pill shrink-0 rounded border px-2 py-1 text-[10px] font-black ${status.claimed ? 'text-emerald-200' : status.complete ? 'text-amber-200' : 'text-[var(--ui-accent)]'}`}>
                      {status.claimed ? 'Claimed' : status.complete ? 'Ready' : `Lv ${story.requiredLevel}`}
                    </span>
                  </div>
                  <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
                    <div className="ui-progress-fill h-full" style={{ width: `${Math.min(100, (status.progress / status.required) * 100)}%` }} />
                  </div>
                  {renderQuestGuidePanel(
                    questKey,
                    guideNpc,
                    story.lore,
                    unlocked ? 'Follow this story step through the named contact, then complete the requirement shown on the card.' : 'Gain the required level before this contact will move the story forward.'
                  )}
                  {!status.claimed && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleClaimStoryQuest(story.id);
                      }}
                      disabled={!status.complete}
                      className="ui-button-primary mt-3 w-full rounded px-3 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      Claim Story Reward
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle title="City Contracts" action={`${visibleCityQuests.length} active`} />
          {visibleCityQuests.length === 0 ? (
            <EmptyState text="No city contracts accepted. Visit a town quest board." />
          ) : (
            <div className="space-y-2">
              {visibleCityQuests.map(({ template, status }) => {
                const progress = Math.min(100, (status.progress / status.required) * 100);
                const questKey = `city-${template.id}`;
                const guideNpc = getQuestGuideNpc(player.stats.level, template.town);
                return (
                  <div
                    key={template.id}
                    onClick={() => toggleQuestDetails(questKey)}
                    className="quest-card ui-card cursor-pointer rounded border p-4 transition hover:border-[rgba(232,217,184,0.34)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="fantasy-heading font-black">{template.name}</h3>
                        <p className="ui-accent text-xs font-bold">{template.town} - {template.faction}</p>
                        <p className="ui-muted mt-1 text-sm font-bold">{template.description}</p>
                      </div>
                      <span className={`rounded px-2 py-1 text-xs font-black ${status.claimed ? 'bg-emerald-900 text-emerald-200' : status.complete ? 'bg-amber-900 text-amber-200' : 'bg-zinc-800 text-zinc-300'}`}>
                        {status.claimed ? 'Claimed' : status.complete ? 'Ready' : 'Open'}
                      </span>
                    </div>
                    <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
                      <div className="ui-progress-fill h-full" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="ui-muted mt-2 flex items-center justify-between text-xs font-bold">
                      <span>{status.progress} / {status.required}</span>
                        <span>{template.rewards.exp ? `${getBalancedQuestExp(template.rewards.exp)} XP` : template.rewards.equipmentRarity ? `${template.rewards.equipmentRarity} gear` : template.rewards.minionTier ? 'Recruit reward' : 'Gold reward'}</span>
                      </div>
                    {renderQuestGuidePanel(
                      questKey,
                      guideNpc,
                      template.description,
                      `Go to ${template.town} and speak with ${guideNpc.name} for the contract lead.`
                    )}
                    {!status.claimed && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleClaimCityQuest(template.id);
                        }}
                        disabled={!status.complete}
                        className="ui-button-primary mt-4 w-full rounded px-4 py-2 text-sm font-bold disabled:opacity-40"
                      >
                        Claim Contract
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionTitle title="Daily Oaths" action={`${visibleDailyQuests.length} open`} />
          <div className="space-y-3">
            {visibleDailyQuests.length === 0 && <EmptyState text="No open daily oaths." />}
            {visibleDailyQuests.map(quest => {
              const complete = quest.progress >= quest.requirement.count;
              const progress = Math.min(100, (quest.progress / quest.requirement.count) * 100);
              const questKey = `daily-${quest.id}`;
              const guideNpc = getQuestGuideNpc(player.stats.level);

              return (
                <div
                  key={quest.id}
                  onClick={() => toggleQuestDetails(questKey)}
                  className="quest-card ui-card cursor-pointer rounded border p-4 transition hover:border-[rgba(232,217,184,0.34)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="fantasy-heading font-black">{quest.name}</h3>
                      <p className="ui-muted text-sm font-bold">{quest.description}</p>
                    </div>
                    <span className={`rounded px-2 py-1 text-xs font-black ${quest.claimed ? 'bg-emerald-900 text-emerald-200' : complete ? 'bg-amber-900 text-amber-200' : 'bg-zinc-800 text-zinc-300'}`}>
                      {quest.claimed ? 'Claimed' : complete ? 'Ready' : 'Open'}
                    </span>
                  </div>
                  <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
                    <div className="ui-progress-fill h-full" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="ui-muted mt-2 flex items-center justify-between text-xs font-bold">
                    <span>{quest.progress} / {quest.requirement.count}</span>
                    <span>{quest.rewards.minionChance ? `${MINION_TIER_LABELS[quest.rewards.minionChance.tier]} recruit chance` : 'Equipment reward'}</span>
                  </div>
                  {renderQuestGuidePanel(
                    questKey,
                    guideNpc,
                    quest.description,
                    `Ask ${guideNpc.name} for a field blessing, then finish the oath requirement anywhere in the world.`
                  )}
                  {!quest.claimed && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleClaimQuest(quest.id);
                      }}
                      disabled={!complete}
                      className="ui-button-primary mt-4 w-full rounded px-4 py-2 text-sm font-bold disabled:opacity-40"
                    >
                      Claim Reward
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderHistory(entries: ActivityEntry[]) {
    if (entries.length === 0) return <EmptyState text="No history yet." />;

    return (
      <div className="space-y-2">
        {entries.map(activity => renderActivityRow(activity))}
      </div>
    );
  }

  function renderTravelCard(travel: TravelState, compact = false) {
    const elapsed = now - travel.startTime;
    const progress = Math.min(100, (elapsed / travel.duration) * 100);
    const timeRemaining = Math.max(0, travel.duration - elapsed);

    return (
      <div className="ui-card rounded border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-zinc-100">Walking the road</div>
            <div className="ui-accent truncate text-xs font-bold">
              Direct travel - does not use job queue
            </div>
          </div>
          {!compact && (
            <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase text-[var(--ui-accent)]">
              Travel
            </span>
          )}
        </div>
        <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
          <div className="ui-progress-fill h-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="ui-muted mt-2 flex justify-between text-xs font-bold">
          <span>{Math.floor(progress)}%</span>
          <span>{formatTime(timeRemaining)}</span>
        </div>
        {!compact && (
          <button
            type="button"
            onClick={handleCancelTravel}
            className="ui-button-danger mt-3 w-full rounded px-3 py-2 text-xs font-black"
          >
            Stop Here
          </button>
        )}
      </div>
    );
  }

  function renderJobCard(jobId: string, compact = false) {
    const job = activeJobs.find(item => item.id === jobId);
    if (!job) return null;

    const progress = getJobProgress(job, now);
    const timeRemaining = getJobTimeRemaining(job, now);
    const hasStarted = now >= job.startTime;
    const phase = !hasStarted ? 'Queued' : job.travelComplete ? 'Working' : 'Traveling';

    return (
      <div key={job.id} className="ui-card rounded border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-zinc-100">{job.jobName}</div>
            <div className="ui-accent truncate text-xs font-bold">{job.poiName} - {phase}</div>
          </div>
          {!compact && (
            <button onClick={() => handleCancelJob(job.id)} className="text-xs font-bold text-red-300 hover:text-red-200">
              Cancel
            </button>
          )}
        </div>
        <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
          <div className="ui-progress-fill h-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="ui-muted mt-2 flex justify-between text-xs font-bold">
          <span>{Math.floor(progress)}%</span>
          <span>{formatTime(timeRemaining)}</span>
        </div>
      </div>
    );
  }

  function renderActivityRow(activity: ActivityEntry) {
    const labels = activityRewardLabels(activity);

    return (
      <div key={activity.id} className="ui-card rounded border px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-zinc-100">{activity.title}</div>
            <div className="ui-faint truncate text-xs font-bold">{activity.source} - {formatDate(activity.completedAt)}</div>
          </div>
          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase text-[var(--ui-accent)]">{activity.type}</span>
        </div>
        {activity.description && (
          <p className="ui-muted mt-2 text-xs font-bold">{activity.description}</p>
        )}
        {labels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {labels.slice(0, 5).map(label => (
              <span key={label} className="ui-pill rounded border px-2 py-1 text-[10px] font-bold text-[var(--ui-accent)]">{label}</span>
            ))}
          </div>
        )}
      </div>
    );
  }
}

function HudMetric({ label, value, tone, progress }: { label: string; value: string; tone: 'red' | 'gold' | 'blue' | 'teal' | 'violet'; progress?: number }) {
  const toneClasses = {
    red: 'hud-stat-tone-red',
    gold: 'hud-stat-tone-gold',
    blue: 'hud-stat-tone-blue',
    teal: 'hud-stat-tone-teal',
    violet: 'hud-stat-tone-violet',
  };
  const iconPath = statIconPaths[label] || statIconPaths.Resources;

  return (
    <div className={`hud-stat-chip hud-stat-chip-${tone}`} title={label}>
      <span className="hud-stat-chip-icon-wrap">
        <Image
          src={iconPath}
          alt=""
          width={22}
          height={22}
          className="hud-stat-chip-icon object-contain"
          style={{ imageRendering: 'pixelated' }}
          unoptimized
        />
      </span>
      <span className="hud-stat-chip-copy min-w-0">
        <span className="hud-stat-chip-label">{label}</span>
        <span className={`hud-stat-chip-value ${toneClasses[tone]}`}>{value}</span>
      </span>
      {progress !== undefined ? (
        <span className="hud-stat-chip-bar" aria-hidden>
          <span className="hud-stat-chip-bar-fill" style={{ width: `${progress}%` }} />
        </span>
      ) : null}
    </div>
  );
}

function SpellArt({
  spell,
  variant = 'archive',
  dimmed = false,
}: {
  spell: BattleSpell;
  variant?: 'hero' | 'loadout' | 'archive';
  dimmed?: boolean;
}) {
  const sizeMap = {
    hero: 84,
    loadout: 62,
    archive: 54,
  } as const;
  const size = sizeMap[variant];

  return (
    <span className={`spell-art spell-art-${variant} ${dimmed ? 'spell-art-dimmed' : ''}`}>
      <Image
        src={getSpellIconPath(spell)}
        alt=""
        width={size}
        height={size}
        className="spell-art-image object-contain"
        unoptimized
      />
    </span>
  );
}

function SectionTitle({ title, action, compact = false }: { title: string; action?: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-[rgba(232,217,184,0.16)] pb-2 ${compact ? 'mb-2' : 'mb-3'}`}>
      <h3 className="fantasy-heading font-black">{title}</h3>
      {action && <span className="ui-faint text-xs font-bold">{action}</span>}
    </div>
  );
}

function CommandNavGroup({
  buttons,
  activePanel,
  onOpen,
  getSubtitle,
  secondary = false,
  isOpen = true,
  onToggle,
}: {
  buttons: PanelButtonConfig[];
  activePanel: PanelId;
  onOpen: (panel: PanelId) => void;
  getSubtitle: (panel: PanelId) => string;
  secondary?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const navButtons = (
    <div className="command-center-nav-collapse-inner">
      {buttons.map(button => {
        const subtitle = getSubtitle(button.id);
        return (
        <button
          key={button.id}
          onClick={() => onOpen(button.id)}
          className={`command-center-tab flex items-center gap-3 rounded border px-3 py-3 text-left transition ${
            activePanel === button.id
              ? 'rail-button-active'
              : 'rail-button'
          }`}
          title={button.label}
          aria-label={button.label}
          tabIndex={secondary && !isOpen ? -1 : 0}
        >
          <span className="command-center-tab-icon flex h-8 w-8 shrink-0 items-center justify-center">
            <PanelIcon icon={button.icon} />
          </span>
          <span className="command-center-tab-copy flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="command-center-tab-action block truncate text-sm font-black text-zinc-100">{button.label}</span>
            {subtitle && <span className="command-center-tab-count shrink-0">{subtitle}</span>}
          </span>
        </button>
        );
      })}
    </div>
  );

  return (
    <div className={`command-center-nav-group ${secondary ? 'command-center-nav-secondary' : 'command-center-nav-primary'}`}>
      {secondary && (
        <button
          type="button"
          onClick={onToggle}
          className="command-center-nav-toggle rounded border px-3 py-2 text-left"
          aria-expanded={isOpen}
        >
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase text-zinc-100">More</span>
          </span>
          <span className={`command-center-nav-chevron ${isOpen ? 'command-center-nav-chevron-open' : ''}`} aria-hidden="true">v</span>
        </button>
      )}
      {secondary ? (
        <div className={`command-center-nav-collapse ${isOpen ? 'command-center-nav-collapse-open' : 'command-center-nav-collapse-closed'}`}>
          {navButtons}
        </div>
      ) : navButtons}
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-pill rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value text-sm font-black">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="ui-empty rounded border border-dashed px-4 py-6 text-center text-sm font-bold">
      {text}
    </div>
  );
}

function PanelIcon({ icon }: { icon: PanelIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      {icon === 'overview' && (
        <>
          <path {...common} d="M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z" />
        </>
      )}
      {icon === 'character' && (
        <>
          <path {...common} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path {...common} d="M5 20c1.4-3.2 3.7-4.8 7-4.8s5.6 1.6 7 4.8" />
        </>
      )}
      {icon === 'inventory' && (
        <>
          <path {...common} d="M5 7h14l-1.2 13H6.2L5 7Z" />
          <path {...common} d="M9 7a3 3 0 0 1 6 0" />
          <path {...common} d="M8 12h8" />
        </>
      )}
      {icon === 'minions' && (
        <>
          <path {...common} d="M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path {...common} d="M3.5 20c.8-4 2.3-6 4.5-6s3.7 2 4.5 6M11.5 20c.8-4 2.3-6 4.5-6s3.7 2 4.5 6" />
        </>
      )}
      {icon === 'spells' && (
        <>
          <path {...common} d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8L12 3Z" />
          <path {...common} d="M5 4v3M3.5 5.5h3M19 16v3M17.5 17.5h3" />
        </>
      )}
      {icon === 'jobs' && (
        <>
          <path {...common} d="M4 7h16v12H4z" />
          <path {...common} d="M9 7V5h6v2M8 12h8M8 16h5" />
        </>
      )}
      {icon === 'quests' && (
        <>
          <path {...common} d="M7 4h9l2 2v14H7z" />
          <path {...common} d="M15 4v4h3M10 11h5M10 15h4" />
        </>
      )}
      {icon === 'social' && (
        <>
          <path {...common} d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <path {...common} d="M3.5 20c.9-4 2.4-6 4.5-6s3.6 2 4.5 6M13 18.5c.8-2.9 2-4.3 3.7-4.3 1.5 0 2.7 1 3.8 3" />
          <path {...common} d="M18.5 9.5h2M19.5 8.5v2" />
        </>
      )}
      {icon === 'settings' && (
        <>
          <path {...common} d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          <path {...common} d="M19 12a7.4 7.4 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7.2 7.2 0 0 0-1.9-1.1L14.3 3h-4.6l-.3 2.9A7.2 7.2 0 0 0 7.5 7l-2.4-1-2 3.4 2 1.5A7.4 7.4 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.4 2.4-1a7.2 7.2 0 0 0 1.9 1.1l.3 2.9h4.6l.3-2.9a7.2 7.2 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1.1Z" />
        </>
      )}
      {icon === 'runs' && (
        <>
          <path {...common} d="M4 16c2.3-1.4 4.7-1.4 7 0s4.7 1.4 7 0" />
          <path {...common} d="M6 7h12M7 7l2 11M17 7l-2 11" />
          <path {...common} d="M9 4h6l1 3H8zM11 11h2" />
        </>
      )}
      {icon === 'leaderboards' && (
        <>
          <path {...common} d="M7 20V9h4v11M13 20V5h4v15M3 20v-6h4v6M4 20h16" />
          <path {...common} d="M18 8l2-2-2-2" />
        </>
      )}
      {icon === 'history' && (
        <>
          <path {...common} d="M4 12a8 8 0 1 0 2.3-5.7" />
          <path {...common} d="M4 5v5h5M12 8v5l3 2" />
        </>
      )}
    </svg>
  );
}
