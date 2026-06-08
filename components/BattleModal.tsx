'use client';

import Image from 'next/image';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  BATTLE_SPELLS,
  BATTLE_TERRAIN_DESCRIPTIONS,
  BATTLE_TERRAIN_LABELS,
  BattleState,
  BattleSpell,
  BattleTerrainType,
  BattleUnit,
  WorldEnemy,
  advanceBattleTurn,
  attackBattleUnit,
  canAttack,
  canHeal,
  canMoveTo,
  castBattleSpell,
  createNpcBattleState,
  focusCommanderMana,
  getActiveUnit,
  getAttackDamage,
  getBattleMana,
  getHealAmount,
  getTerrainAt,
  getTerrainMoveCost,
  getTurnTimeRemaining,
  getTurnOrder,
  getUnitAt,
  healBattleUnit,
  isObstacle,
  markWorldEnemyDefeated,
  moveBattleUnit,
  runEnemyBattleTurn,
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
  addInventoryItemsWithLimit,
  generateEquipment,
  getCurrentUser,
  getCityQuestStatus,
  getCityQuestTemplate,
  getMinionTemplate,
  getStoryQuestStatus,
  makeInventoryItem,
  recruitMinionsFromOffer,
  rollInventoryBonusDrops,
  STORY_CHAPTERS,
  updateCurrentUser,
} from '@/lib/auth';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import { emitFxEvent, type FxEventType } from '@/lib/fxEvents';
import { readGameJson, writeGameJson } from '@/lib/gameStore';
import CombatThreeFxLayer from './CombatThreeFxLayer';

interface BattleModalProps {
  enemy: WorldEnemy;
  onClose: () => void;
  playerStacks?: MinionStack[];
  playerStats?: CharacterStats;
  playerFormation?: Record<string, { x: number; y: number }>;
  availableSpellIds?: string[];
  persistentResults?: boolean;
  onBattleEnd?: (result: { status: BattleResultReportData['status']; battle: BattleState; reward?: VictoryRewardReport; healthLost?: number }) => void;
  contextLabel?: string;
}

type BattleCueTone = 'player' | 'enemy' | 'neutral' | 'danger' | 'victory';

interface BattleCue {
  headline: string;
  detail: string;
  tone: BattleCueTone;
}

interface BattleHoverPreviewData {
  title: string;
  detail: string;
  tone: 'neutral' | 'good' | 'danger';
}

type BattleSpeed = 'normal' | 'fast' | 'instant';
type BattlePieceAnimation =
  | 'move'
  | 'melee'
  | 'ranged'
  | 'hit-melee'
  | 'hit-ranged'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'morale'
  | 'commander-spell'
  | 'spell-hit'
  | null;

interface BattleSpeedConfig {
  label: string;
  playerDelayMs: number;
  enemyDelayMs: number;
}

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

const BATTLE_SPEEDS: Record<BattleSpeed, BattleSpeedConfig> = {
  normal: { label: 'Normal', playerDelayMs: 950, enemyDelayMs: 1550 },
  fast: { label: 'Fast', playerDelayMs: 760, enemyDelayMs: 1050 },
  instant: { label: 'Instant', playerDelayMs: 420, enemyDelayMs: 620 },
};

const BATTLE_SPEED_ORDER: BattleSpeed[] = ['normal', 'fast', 'instant'];
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
  contextLabel,
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
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeed>('normal');
  const [resultReport, setResultReport] = useState<BattleResultReportData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isResolvingAction, setIsResolvingAction] = useState(false);
  const [battleCue, setBattleCue] = useState<BattleCue | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [pendingMoveUndo, setPendingMoveUndo] = useState<BattleState | null>(null);
  const [confirmMoveEnabled, setConfirmMoveEnabled] = useState(() => readGameJson(CONFIRM_MOVE_SETTING_KEY, false));
  const enemyTimer = useRef<number | null>(null);
  const playerActionTimer = useRef<number | null>(null);
  const rewardClaimed = useRef(false);
  const battleEndNotified = useRef(false);
  const speedConfig = BATTLE_SPEEDS[battleSpeed];
  const activeSpellIds = availableSpellIds || getCurrentUser()?.equippedSpellIds || DEFAULT_EQUIPPED_SPELL_IDS;
  const availableSpells = BATTLE_SPELLS.filter(spell => activeSpellIds.includes(spell.id)).slice(0, 4);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (enemyTimer.current) window.clearTimeout(enemyTimer.current);
    if (playerActionTimer.current) window.clearTimeout(playerActionTimer.current);
  }, []);

  useEffect(() => {
    if (!battle || battle.status !== 'active') return;
    if (battle.recruitOffer && !battle.recruitOffer.declined && !battle.recruitOffer.accepted) return;

    const activeUnit = getActiveUnit(battle);
    if (!activeUnit || activeUnit.side !== 'enemy') return;

    enemyTimer.current = window.setTimeout(() => {
      emitFxEvent({ type: activeUnit.healing > 0 ? 'status' : 'attack', tone: 'red', intensity: 0.55 });
      setBattle(current => current ? runEnemyBattleTurn(current) : current);
    }, speedConfig.enemyDelayMs);

    return () => {
      if (enemyTimer.current) window.clearTimeout(enemyTimer.current);
    };
  }, [battle, speedConfig.enemyDelayMs]);

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
        return waitBattleUnit(current, currentActiveUnit.id, `${currentActiveUnit.name}'s turn timed out.`);
      });
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [battle]);

  useEffect(() => {
    if (!battle || rewardClaimed.current) return;

    if (battle.status === 'victory') {
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
        onBattleEnd?.({ status: 'victory', battle, reward });
        battleEndNotified.current = true;
      }
      rewardClaimed.current = true;
    } else if (battle.status === 'defeat') {
      const casualtyReport = persistentResults ? applyBattleCasualties(battle) : undefined;
      const healthLost = persistentResults ? applyDefeatPenalty(battle.enemy) : 0;
      window.setTimeout(() => {
        setResultReport({
          status: 'defeat',
          healthLost,
          casualtyReport,
          completedAt: Date.now(),
        });
      }, 0);
      if (!battleEndNotified.current) {
        onBattleEnd?.({ status: 'defeat', battle, healthLost });
        battleEndNotified.current = true;
      }
      rewardClaimed.current = true;
    }
  }, [battle, onBattleEnd, persistentResults]);

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

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setSelectedSpellId(null);
        setIsSpellMenuOpen(false);
        setPendingMoveUndo(null);
        setBattle(waitBattleUnit(battle, keyboardActiveUnit.id));
      }

      if (event.key.toLowerCase() === 'f' && keyboardActiveUnit.kind === 'commander') {
        event.preventDefault();
        setSelectedSpellId(null);
        setIsSpellMenuOpen(false);
        setPendingMoveUndo(null);
        setBattle(focusCommanderMana(battle, keyboardActiveUnit.id));
      }

      if (event.key.toLowerCase() === 's' && keyboardActiveUnit.kind === 'commander') {
        event.preventDefault();
        setSelectedSpellId(null);
        setIsSpellMenuOpen(open => !open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [battle, isResolvingAction]);

  const recruitOfferPending = Boolean(battle?.recruitOffer && !battle.recruitOffer.declined && !battle.recruitOffer.accepted);
  const activeUnit = battle ? getActiveUnit(battle) : undefined;
  const isPlayerTurn = !recruitOfferPending && activeUnit?.side === 'player' && battle?.status === 'active';
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

    if (speedConfig.playerDelayMs <= 0) {
      setBattle(nextBattle);
      setIsResolvingAction(false);
      setBattleCue(null);
      return;
    }

    playerActionTimer.current = window.setTimeout(() => {
      setBattle(nextBattle);
      setIsResolvingAction(false);
      setBattleCue(null);
    }, speedConfig.playerDelayMs);
  };

  const handleCellClick = (x: number, y: number) => {
    if (!battle || !activeUnit || !isPlayerTurn || isResolvingAction) return;

    const unitAtCell = getUnitAt(battle, x, y);
    if (selectedSpell) {
      if (selectedSpell.target === 'none') return;
      if (!unitAtCell) return;

      const validTarget =
        (selectedSpell.target === 'enemy' && unitAtCell.side !== activeUnit.side) ||
        (selectedSpell.target === 'ally' && unitAtCell.side === activeUnit.side);

      if (validTarget) {
        setSelectedSpellId(null);
        queuePlayerAction(castBattleSpell(battle, selectedSpell.id, unitAtCell.id), {
          headline: selectedSpell.name,
          detail: `${activeUnit.name} casts on ${unitAtCell.name}.`,
          tone: selectedSpell.target === 'ally' ? 'player' : 'danger',
        });
      }

      return;
    }

    if (isCommanderTurn && unitAtCell?.id === activeUnit.id) {
      emitFxEvent({ type: 'spell', tone: 'violet', intensity: 0.5 });
      setIsSpellMenuOpen(open => !open);
      return;
    }

    if (unitAtCell && canHeal(activeUnit, unitAtCell)) {
      queuePlayerAction(advanceBattleTurn(healBattleUnit(battle, activeUnit.id, unitAtCell.id)), {
        headline: 'Healing',
        detail: `${activeUnit.name} tends to ${unitAtCell.name}.`,
        tone: 'player',
      });
      return;
    }

    if (unitAtCell && canAttack(activeUnit, unitAtCell)) {
      queuePlayerAction(advanceBattleTurn(attackBattleUnit(battle, activeUnit.id, unitAtCell.id)), {
        headline: 'Strike',
        detail: `${activeUnit.name} attacks ${unitAtCell.name}.`,
        tone: 'danger',
      });
      return;
    }

    if (!unitAtCell && !canUndoMove && canMoveTo(battle, activeUnit, x, y)) {
      const movedBattle = moveBattleUnit(battle, activeUnit.id, x, y);
      if (!confirmMoveEnabled) {
        queuePlayerAction(advanceBattleTurn(movedBattle), {
          headline: 'Move',
          detail: `${activeUnit.name} advances to ${x}:${y}.`,
          tone: 'player',
        });
        return;
      }

      setPendingMoveUndo(battle);
      setBattle(movedBattle);
      setBattleCue({
        headline: 'Move',
        detail: `${activeUnit.name} moved. Strike, heal, cast, wait, or undo.`,
        tone: 'player',
      });
      emitFxEvent({ type: 'status', tone: 'blue', intensity: 0.45 });
    }
  };

  const handleToggleConfirmMove = () => {
    if (canUndoMove) return;
    setConfirmMoveEnabled(current => {
      const next = !current;
      writeGameJson(CONFIRM_MOVE_SETTING_KEY, next);
      return next;
    });
  };

  const handleUndoMove = () => {
    if (!pendingMoveUndo || isResolvingAction) return;
    setSelectedSpellId(null);
    setIsSpellMenuOpen(false);
    setBattle(pendingMoveUndo);
    setPendingMoveUndo(null);
    setBattleCue({
      headline: 'Move Undone',
      detail: 'Choose a different tile or action.',
      tone: 'neutral',
    });
    emitFxEvent({ type: 'status', tone: 'bone', intensity: 0.36 });
  };

  const handleCommitMove = () => {
    if (!battle || !activeUnit || !isPlayerTurn || !canUndoMove || isResolvingAction) return;
    setSelectedSpellId(null);
    queuePlayerAction(waitBattleUnit(battle, activeUnit.id, `${activeUnit.name} holds position.`), {
      headline: 'Hold',
      detail: `${activeUnit.name} holds after moving.`,
      tone: 'neutral',
    });
  };

  const handleEndTurn = () => {
    if (!battle || !isPlayerTurn || isResolvingAction) return;
    setSelectedSpellId(null);
    queuePlayerAction(waitBattleUnit(battle, activeUnit?.id || ''), {
      headline: 'Hold',
      detail: `${activeUnit?.name || 'Unit'} waits for a better opening.`,
      tone: 'neutral',
    });
  };

  const handleFocusMana = () => {
    if (!battle || !isCommanderTurn || !activeUnit || isResolvingAction) return;
    setSelectedSpellId(null);
    queuePlayerAction(focusCommanderMana(battle, activeUnit.id), {
      headline: 'Focus Mana',
      detail: `${activeUnit.name} gathers power for a later spell.`,
      tone: 'player',
    });
  };

  const handleSpellClick = (spell: BattleSpell) => {
    if (!battle || !isCommanderTurn || isResolvingAction) return;

    if (getBattleMana(battle, 'player') < spell.cost) {
      setSelectedSpellId(null);
      setIsSpellMenuOpen(true);
      emitFxEvent({ type: 'status', tone: 'red', intensity: 0.4 });
      return;
    }

    if (spell.target === 'none') {
      setSelectedSpellId(null);
      setIsSpellMenuOpen(false);
      queuePlayerAction(castBattleSpell(battle, spell.id), {
        headline: spell.name,
        detail: 'The commander bends the whole field with a strategic spell.',
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
    if (battle && battle.status !== 'active') {
      emitBattleCompletionNotice(battle, resultReport);
    }
    onClose();
  };

  const defaultCue = getDefaultBattleCue({
    battle,
    activeUnit,
    isPlayerTurn,
    isCommanderTurn,
    selectedSpell,
    recruitOfferPending,
  });
  const visibleCue = battleCue || defaultCue;
  const hoverPreview = getBattleHoverPreview({
    battle,
    activeUnit,
    hoveredCell,
    isPlayerTurn,
    selectedSpell,
    isResolvingAction,
    movementLocked: canUndoMove,
  });
  const showCenterCue = isResolvingAction || battle.status !== 'active' || (battle.status === 'active' && now - battle.turnStartedAt < 950);

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-black/78 p-1 backdrop-blur-sm">
      <div className="battle-modal-frame command-panel vine-frame mx-auto flex h-[calc(100vh-0.5rem)] max-w-none flex-col overflow-hidden rounded border text-zinc-100">
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
            {battle.status !== 'active' && (
              <BattleResultReport battle={battle} report={resultReport} onClose={handleLeaveField} />
            )}

            <div className="battle-combat-grid min-h-0 flex-1">
              <aside className="battle-side-panel battle-side-panel-left">
                <div className="battle-title-card panel-header rounded border px-3 py-2">
                  <h2 className="fantasy-heading truncate text-xl">Battle: {enemy.name}</h2>
                  <p className="arcane-label truncate">{contextLabel ? `${contextLabel} - ` : ''}{battle.mapName} - Round {battle.round}</p>
                </div>
                <BattleHeaderStatus
                  battle={battle}
                  activeUnit={activeUnit}
                  visibleCue={visibleCue}
                  now={now}
                  isPlayerTurn={isPlayerTurn}
                  selectedSpell={selectedSpell}
                />
                <BattleHeaderActions
                  isPlayerTurn={isPlayerTurn}
                  isResolvingAction={isResolvingAction}
                  selectedSpell={selectedSpell}
                  canUndoMove={canUndoMove}
                  confirmMoveEnabled={confirmMoveEnabled}
                  onEndTurn={handleEndTurn}
                  onCommitMove={handleCommitMove}
                  onToggleConfirmMove={handleToggleConfirmMove}
                  onCancelSpell={handleCancelSpell}
                />
                <div className="battle-side-block battle-order-card rounded border p-2">
                  <BattleTurnTimeline battle={battle} vertical />
                </div>
              </aside>

              <div className="battle-board-shell relative min-h-0">
              <BattleCenterBanner cue={visibleCue} active={showCenterCue} />
              <BattleHoverOverlay preview={hoverPreview} visible={Boolean(hoveredCell)} />
              {isCommanderTurn && isSpellMenuOpen && !selectedSpell && (
                <div className="battle-spell-popover">
                  <BattleSpellMenu
                    battle={battle}
                    spells={availableSpells}
                    selectedSpellId={selectedSpellId}
                    isResolvingAction={isResolvingAction}
                    onSpellClick={handleSpellClick}
                    onClose={() => setIsSpellMenuOpen(false)}
                  />
                </div>
              )}
              <div
                className={`battlefield-board relative mx-auto grid w-full gap-0 overflow-hidden rounded border border-[rgba(232,217,184,0.34)] p-0 ${selectedSpell ? 'battlefield-board-targeting' : ''}`}
                style={{
                  '--battle-cols': battle.boardWidth,
                  '--battle-rows': battle.boardHeight,
                  '--battle-ratio': battle.boardWidth / battle.boardHeight,
                  gridTemplateColumns: `repeat(${battle.boardWidth}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${battle.boardHeight}, minmax(0, 1fr))`,
                } as CSSProperties}
              >
              {Array.from({ length: battle.boardWidth * battle.boardHeight }, (_, index) => {
                const x = index % battle.boardWidth;
                const y = Math.floor(index / battle.boardWidth);
                const unit = getUnitAt(battle, x, y);
                const defeatedUnit = unit ? undefined : getRecentlyDefeatedUnitAt(battle, x, y, now);
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
                });
                const isActiveCell = unit?.id === battle.activeUnitId;
                const canMove = Boolean(isPlayerTurn && activeUnit && !canUndoMove && !unit && canMoveTo(battle, activeUnit, x, y));
                const canStrike = Boolean(isPlayerTurn && activeUnit && unit && canAttack(activeUnit, unit));
                const canMend = Boolean(isPlayerTurn && activeUnit && unit && canHeal(activeUnit, unit));
                const canSpellTarget = Boolean(
                  selectedSpell &&
                  unit &&
                  (
                    (selectedSpell.target === 'enemy' && unit.side !== activeUnit?.side) ||
                    (selectedSpell.target === 'ally' && unit.side === activeUnit?.side)
                  )
                );
                const canDamageSpellTarget = Boolean(canSpellTarget && selectedSpell?.target === 'enemy');
                const canSupportSpellTarget = Boolean(canSpellTarget && selectedSpell?.target === 'ally');
                const actionable = canMove || canStrike || canMend || canSpellTarget;
                const floatingText = getFloatingBattleText(battle, unit || defeatedUnit, now);

                return (
                  <div
                    key={`${x}-${y}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCellClick(x, y)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      handleCellClick(x, y);
                    }}
                    onMouseEnter={() => setHoveredCell({ x, y })}
                    onMouseLeave={() => setHoveredCell(null)}
                    title={`${cellPreview.title}\n${cellPreview.detail}`}
                    aria-disabled={isResolvingAction || obstacle || (!canMove && !canStrike && !canMend && !canSpellTarget && !isActiveCell)}
                    className={`battle-cell ${getBattleTerrainClassName(terrain)} relative overflow-hidden text-left transition ${
                      obstacle
                        ? 'battle-cell-obstacle'
                        : canDamageSpellTarget || canStrike
                          ? 'battle-cell-danger'
                          : canSupportSpellTarget || canMend
                            ? 'battle-cell-support'
                          : canMove
                            ? 'battle-cell-move'
                            : ''
                    } ${isActiveCell ? (unit?.side === 'player' ? 'battle-cell-active battle-cell-active-player' : 'battle-cell-active battle-cell-active-enemy') : ''} ${isPlayerTurn && activeUnit && !actionable && !unit && !obstacle ? 'battle-cell-muted' : ''}`}
                  >
                    {terrain !== 'ground' && !unit && !obstacle && (
                      <span className="battle-terrain-chip">{terrainLabel}</span>
                    )}
                    {obstacle && <span className="battle-obstacle-shape" />}
                    {unit && <BattlePiece unit={unit} active={isActiveCell} animation={getBattlePieceAnimation(battle, unit, now)} />}
                    {isActiveCell && isCommanderTurn && !selectedSpell && !canUndoMove && (
                      <BattleUnitActionOrbs
                        mode="commander"
                        isResolvingAction={isResolvingAction}
                        onFocusMana={handleFocusMana}
                        onToggleSpellMenu={() => setIsSpellMenuOpen(open => !open)}
                      />
                    )}
                    {isActiveCell && canUndoMove && (
                      <BattleUnitActionOrbs
                        mode="move"
                        isResolvingAction={isResolvingAction}
                        onUndoMove={handleUndoMove}
                        onCommitMove={handleCommitMove}
                      />
                    )}
                    {defeatedUnit && <BattleDeathMarker unit={defeatedUnit} />}
                    {floatingText && <BattleFloatingText text={floatingText.text} tone={floatingText.tone} />}
                  </div>
                );
              })}
              <CombatThreeFxLayer battle={battle} />
              </div>
            </div>
              <aside className="battle-side-panel battle-side-panel-right">
                <BattleSpeedControl value={battleSpeed} onChange={setBattleSpeed} />
                <div className="battle-header-controls flex items-start justify-end gap-2">
                  {battle.status === 'active' && (
                    <button onClick={handleRetreat} className="ui-button-danger rounded px-3 py-2 text-xs font-bold">
                      Retreat
                    </button>
                  )}
                  {battle.status !== 'active' && (
                    <button onClick={handleLeaveField} className="ui-button rounded px-3 py-2 text-xs font-bold">
                      Leave Field
                    </button>
                  )}
                </div>
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

function BattleUnitActionOrbs({
  mode,
  isResolvingAction,
  onFocusMana,
  onToggleSpellMenu,
  onUndoMove,
  onCommitMove,
}: {
  mode: 'commander' | 'move';
  isResolvingAction: boolean;
  onFocusMana?: () => void;
  onToggleSpellMenu?: () => void;
  onUndoMove?: () => void;
  onCommitMove?: () => void;
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

  return (
    <div className="battle-unit-orbs battle-unit-orbs-commander">
      <button
        type="button"
        disabled={isResolvingAction}
        onClick={(event) => stopCellAction(event, onToggleSpellMenu)}
        className="battle-unit-orb battle-unit-orb-spell"
        title="Open spells"
      >
        S
      </button>
      <button
        type="button"
        disabled={isResolvingAction}
        onClick={(event) => stopCellAction(event, onFocusMana)}
        className="battle-unit-orb battle-unit-orb-mana"
        title="Focus mana"
      >
        M
      </button>
    </div>
  );
}

function BattleHeaderStatus({
  battle,
  activeUnit,
  visibleCue,
  now,
  isPlayerTurn,
  selectedSpell,
}: {
  battle: BattleState;
  activeUnit?: BattleUnit;
  visibleCue: BattleCue;
  now: number;
  isPlayerTurn: boolean;
  selectedSpell?: BattleSpell;
}) {
  const turnLabel = battle.status === 'active'
    ? isPlayerTurn ? 'Your Turn' : 'Enemy Turn'
    : battle.status;
  const secondsRemaining = Math.ceil(getTurnTimeRemaining(battle, now) / 1000);

  return (
    <div className={`battle-header-status relative rounded border px-3 py-2 ${isPlayerTurn ? 'battle-header-status-player' : 'battle-header-status-enemy'}`}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="fantasy-heading truncate text-base">{turnLabel}</span>
          <span className="ui-faint truncate text-[10px] font-black uppercase">{activeUnit?.name || visibleCue.headline}</span>
        </div>
        <div className="ui-muted truncate text-[11px] font-bold">{visibleCue.detail}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{secondsRemaining}s</span>
        <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">M {getBattleMana(battle, 'player')}</span>
        {selectedSpell && (
          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black text-red-200">Targeting</span>
        )}
      </div>
    </div>
  );
}

function BattleHeaderActions({
  isPlayerTurn,
  isResolvingAction,
  selectedSpell,
  canUndoMove,
  confirmMoveEnabled,
  onEndTurn,
  onCommitMove,
  onToggleConfirmMove,
  onCancelSpell,
}: {
  isPlayerTurn: boolean;
  isResolvingAction: boolean;
  selectedSpell?: BattleSpell;
  canUndoMove: boolean;
  confirmMoveEnabled: boolean;
  onEndTurn: () => void;
  onCommitMove: () => void;
  onToggleConfirmMove: () => void;
  onCancelSpell: () => void;
}) {
  if (!isPlayerTurn) {
    return <div className="battle-header-actions" aria-hidden="true" />;
  }

  return (
    <div className="battle-header-actions">
      <button
        type="button"
        onClick={onToggleConfirmMove}
        disabled={isResolvingAction || canUndoMove}
        className={`battle-header-action battle-header-action-toggle ${confirmMoveEnabled ? 'battle-header-action-toggle-on' : ''}`}
        title="Toggle movement confirmation. Off means moves commit immediately."
      >
        {confirmMoveEnabled ? 'Move Check' : 'Move Auto'}
      </button>
      {selectedSpell && (
        <button
          type="button"
          onClick={onCancelSpell}
          disabled={isResolvingAction}
          className="battle-header-action battle-header-action-cancel"
          title="Cancel spell target mode"
        >
          Cancel
        </button>
      )}
      <button
        type="button"
        onClick={canUndoMove ? onCommitMove : onEndTurn}
        disabled={isResolvingAction}
        className={`battle-header-action ${canUndoMove ? 'battle-header-action-done' : 'battle-header-action-wait'}`}
        title={canUndoMove ? 'Commit movement and pass turn' : 'Pass turn'}
      >
        {canUndoMove ? 'Done' : 'Wait'}
      </button>
    </div>
  );
}

function BattleSpellMenu({
  battle,
  spells,
  selectedSpellId,
  isResolvingAction,
  onSpellClick,
  onClose,
}: {
  battle: BattleState;
  spells: BattleSpell[];
  selectedSpellId: string | null;
  isResolvingAction: boolean;
  onSpellClick: (spell: BattleSpell) => void;
  onClose: () => void;
}) {
  const mana = getBattleMana(battle, 'player');

  return (
    <section className="battle-spell-menu command-panel vine-frame mt-2 rounded border p-3 text-zinc-100">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="arcane-label">King Spells</div>
          <h3 className="fantasy-heading text-xl">Choose Spell</h3>
        </div>
        <button onClick={onClose} className="ui-button rounded px-3 py-2 text-xs font-bold">
          Close
        </button>
      </div>
      <div className="battle-spell-grid">
        {spells.map(spell => {
          const enoughMana = mana >= spell.cost;
          const selected = selectedSpellId === spell.id;
          const targetLabel = getSpellTargetLabel(spell.target);
          const spellVisual = getSpellVisual(spell);

          return (
            <button
              key={spell.id}
              type="button"
              onClick={() => onSpellClick(spell)}
              disabled={!enoughMana || isResolvingAction}
              title={spell.description}
              className={`battle-spell-option spell-card spell-card-${spell.rarity} rounded border px-4 py-4 text-left transition ${
                selected
                  ? 'rail-button-active'
                  : enoughMana
                    ? ''
                    : 'ui-empty opacity-45'
              }`}
            >
              <span className="flex items-start gap-3">
                <span className={`battle-spell-icon battle-spell-icon-${spellVisual.tone} relative shrink-0 overflow-hidden rounded border`}>
                  <Image
                    src={spellVisual.iconPath}
                    alt=""
                    fill
                    sizes="42px"
                    className="object-contain p-2"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-zinc-100">{spell.name}</span>
                      <span className="ui-faint mt-1 block text-[11px] font-black uppercase">{targetLabel} - {spellVisual.tierLabel}</span>
                    </span>
                    <span className="ui-pill shrink-0 rounded border px-2.5 py-1.5 text-[11px] font-black">M {spell.cost}</span>
                  </span>
                  <span className="battle-spell-tag mt-2 inline-flex rounded border px-2 py-1 text-[10px] font-black uppercase">
                    {spellVisual.tagline}
                  </span>
                </span>
              </span>
              <span className="ui-muted mt-3 block text-xs font-bold leading-relaxed">{spell.description}</span>
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

function getSpellTargetLabel(target: BattleSpell['target']): string {
  if (target === 'enemy') return 'Damage';
  if (target === 'ally') return 'Support';
  return 'Field';
}

function getSpellVisual(spell: BattleSpell): { iconPath: string; tierLabel: string; tone: 'damage' | 'support' | 'field'; tagline: string } {
  const tierLabel = spell.rarity === 'legendary' ? 'Tier III' : spell.rarity === 'rare' ? 'Tier II' : 'Tier I';
  if (spell.target === 'enemy') {
    return {
      iconPath: '/assets/icons/attack.png',
      tierLabel,
      tone: 'damage',
      tagline: spell.rarity === 'legendary' ? 'Finisher' : 'Strike',
    };
  }
  if (spell.target === 'ally') {
    return {
      iconPath: '/assets/icons/health.png',
      tierLabel,
      tone: 'support',
      tagline: spell.description.toLowerCase().includes('heal') ? 'Heal' : 'Buff',
    };
  }
  return {
    iconPath: '/assets/icons/magic.png',
    tierLabel,
    tone: 'field',
    tagline: 'Battlefield',
  };
}

function BattleHoverOverlay({ preview, visible }: { preview: BattleHoverPreviewData; visible: boolean }) {
  if (!visible) return null;

  return (
    <div className={`battle-hover-overlay rounded border px-3 py-2 ${preview.tone === 'danger' ? 'battle-hover-danger' : preview.tone === 'good' ? 'battle-hover-good' : ''}`}>
      <div className="truncate text-xs font-black text-zinc-100">{preview.title}</div>
      <div className="ui-muted truncate text-[10px] font-bold">{preview.detail}</div>
    </div>
  );
}

function BattleTurnTimeline({ battle, vertical = false }: { battle: BattleState; vertical?: boolean }) {
  const order = getTurnOrder(battle.units);

  return (
    <div className={`battle-turn-timeline rounded border px-3 py-2 ${vertical ? 'battle-turn-timeline-vertical' : ''}`}>
      <span className="arcane-label mr-2 align-middle">Order</span>
      <span className={`${vertical ? 'mt-2 grid grid-cols-5 gap-1.5' : 'inline-flex max-w-full gap-1.5 align-middle'}`}>
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
            />
          </span>
        ))}
      </span>
    </div>
  );
}

function BattlePiece({ unit, active, animation }: { unit: BattleUnit; active: boolean; animation: BattlePieceAnimation }) {
  const healthPercent = Math.max(0, Math.min(100, (unit.currentHealth / unit.maxHealth) * 100));
  const animationClass = animation ? `battle-piece-anim-${animation}` : '';
  const isCommander = unit.kind === 'commander';

  return (
    <span className={`battle-piece-wrap battle-piece-wrap-${unit.side} ${active ? 'battle-piece-wrap-active' : ''}`}>
      <span className="battle-piece-health">
        <span className={unit.side === 'player' ? 'bg-emerald-300' : 'bg-red-300'} style={{ width: `${healthPercent}%` }} />
      </span>
      <span className={`battle-piece-body ${isCommander ? 'battle-piece-body-commander' : 'battle-piece-body-minion'} ${animationClass}`}>
        <span className={`battle-piece-base ${unit.side === 'player' ? 'battle-piece-base-player' : 'battle-piece-base-enemy'} ${isCommander ? 'battle-piece-base-commander' : ''}`} />
        <Image
          src={unit.assetPath}
          alt={unit.name}
          fill
          sizes="(max-width: 768px) 12vw, 8vw"
          className="battle-piece-image object-contain object-center"
        />
      </span>
      <span className={`battle-piece-role ${unit.side === 'player' ? 'battle-piece-role-player' : 'battle-piece-role-enemy'}`}>
        {isCommander ? 'K' : 'U'}
      </span>
    </span>
  );
}

function BattleDeathMarker({ unit }: { unit: BattleUnit }) {
  const isCommander = unit.kind === 'commander';

  return (
    <span className="battle-death-marker">
      <span className={`battle-piece-body battle-death-body ${isCommander ? 'battle-piece-body-commander' : 'battle-piece-body-minion'}`}>
        <Image
          src={unit.assetPath}
          alt=""
          fill
          sizes="(max-width: 768px) 12vw, 8vw"
          className="battle-piece-image object-contain object-center opacity-45 grayscale"
        />
      </span>
      <span className="battle-death-ash" />
    </span>
  );
}

function getFloatingBattleText(
  battle: BattleState,
  unit: BattleUnit | undefined,
  now: number
): { text: string; tone: 'damage' | 'heal' | 'mana' | 'neutral' } | null {
  if (!unit) return null;
  const entry = battle.log[0];
  if (!entry || now - entry.createdAt > 1500) return null;

  const isTarget = Boolean(entry.targetIds?.includes(unit.id));
  const isActor = entry.actorId === unit.id;
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

  return null;
}

function getBattlePieceAnimation(battle: BattleState, unit: BattleUnit, now: number): BattlePieceAnimation {
  const entry = battle.log[0];
  if (!entry || now - entry.createdAt > 1500) return null;

  const isActor = entry.actorId === unit.id;
  const isTarget = Boolean(entry.targetIds?.includes(unit.id));
  const actor = entry.actorId ? battle.units.find(item => item.id === entry.actorId) : undefined;
  const style = entry.style || (entry.action === 'attack' && actor?.range && actor.range > 1 ? 'ranged' : undefined);

  if (isActor) {
    if (entry.action === 'move') return 'move';
    if (entry.action === 'attack') return style === 'ranged' ? 'ranged' : 'melee';
    if (entry.action === 'heal') return 'heal';
    if (entry.action === 'spell') return 'commander-spell';
    if (entry.action === 'morale' || entry.action === 'mana') return 'morale';
  }

  if (isTarget) {
    if (entry.action === 'attack') return style === 'ranged' ? 'hit-ranged' : 'hit-melee';
    if (entry.action === 'spell') {
      if (style === 'spell-support' || style === 'heal') return 'heal';
      if (style === 'buff') return 'buff';
      if (style === 'debuff' || style === 'spell-control') return 'debuff';
      if (style === 'morale') return 'morale';
      return 'spell-hit';
    }
    if (entry.action === 'heal') return 'heal';
    if (entry.action === 'morale') return 'morale';
  }

  return null;
}

function getRecentlyDefeatedUnitAt(battle: BattleState, x: number, y: number, now: number): BattleUnit | undefined {
  const entry = battle.log[0];
  if (!entry || now - entry.createdAt > 1500) return undefined;
  if (entry.action !== 'attack' && entry.action !== 'spell') return undefined;

  return battle.units.find(unit => (
    unit.currentHealth <= 0 &&
    unit.x === x &&
    unit.y === y &&
    Boolean(entry.targetIds?.includes(unit.id))
  ));
}

function getBattleTerrainClassName(terrain: BattleTerrainType): string {
  if (terrain === 'holyGround') return 'battle-terrain-holy-ground';
  return terrain === 'highGround' ? 'battle-terrain-high-ground' : `battle-terrain-${terrain}`;
}

function BattleSpeedControl({ value, onChange }: { value: BattleSpeed; onChange: (speed: BattleSpeed) => void }) {
  return (
    <div className="battle-speed-control rounded border px-2 py-1.5">
      <span className="arcane-label mr-2 align-middle">Speed</span>
      <span className="inline-flex gap-1 align-middle">
        {BATTLE_SPEED_ORDER.map(speed => (
          <button
            key={speed}
            type="button"
            onClick={() => onChange(speed)}
            className={`rounded px-2 py-1 text-[11px] font-black transition ${
              value === speed ? 'battle-speed-active' : 'text-[var(--ui-muted)] hover:text-zinc-100'
            }`}
          >
            {BATTLE_SPEEDS[speed].label}
          </button>
        ))}
      </span>
    </div>
  );
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

function BattleCenterBanner({ cue, active }: { cue: BattleCue; active: boolean }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
      <div className={`battle-center-banner max-w-sm rounded border px-5 py-3 text-center ${cueToneClasses(cue.tone)}`}>
        <div className="fantasy-heading text-2xl">{cue.headline}</div>
        <p className="mt-1 text-xs font-bold text-[var(--ui-muted)]">{cue.detail}</p>
      </div>
    </div>
  );
}

function cueToneClasses(tone: BattleCueTone): string {
  switch (tone) {
    case 'player':
      return 'border-[rgba(244,221,176,0.34)] bg-black/48 shadow-[0_0_18px_rgba(244,221,176,0.1)]';
    case 'enemy':
      return 'border-[rgba(248,113,113,0.34)] bg-red-950/34 shadow-[0_0_18px_rgba(248,113,113,0.12)]';
    case 'danger':
      return 'border-[rgba(255,180,180,0.38)] bg-red-950/44 shadow-[0_0_20px_rgba(248,113,113,0.14)]';
    case 'victory':
      return 'border-[rgba(250,204,21,0.42)] bg-amber-950/32 shadow-[0_0_20px_rgba(250,204,21,0.13)]';
    default:
      return 'border-[rgba(232,217,184,0.24)] bg-black/46 shadow-[0_0_16px_rgba(232,217,184,0.08)]';
  }
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

function getBattleHoverPreview({
  battle,
  activeUnit,
  hoveredCell,
  isPlayerTurn,
  selectedSpell,
  isResolvingAction,
  movementLocked = false,
}: {
  battle: BattleState;
  activeUnit?: BattleUnit;
  hoveredCell: { x: number; y: number } | null;
  isPlayerTurn: boolean;
  selectedSpell?: BattleSpell;
  isResolvingAction: boolean;
  movementLocked?: boolean;
}): BattleHoverPreviewData {
  if (battle.status !== 'active') {
    return { title: 'Battle Ended', detail: 'Leave the field when you are ready.', tone: 'neutral' };
  }

  if (isResolvingAction) {
    return { title: 'Resolving', detail: 'The current action is playing out.', tone: 'neutral' };
  }

  if (!activeUnit) {
    return { title: 'No Active Unit', detail: 'Waiting for the next unit in the turn order.', tone: 'neutral' };
  }

  if (!hoveredCell) {
    const terrain = getTerrainAt(battle, activeUnit.x, activeUnit.y);
    return {
      title: activeUnit.name,
      detail: `${BATTLE_TERRAIN_LABELS[terrain]}: ${BATTLE_TERRAIN_DESCRIPTIONS[terrain]}`,
      tone: activeUnit.side === 'player' ? 'good' : 'danger',
    };
  }

  const terrain = getTerrainAt(battle, hoveredCell.x, hoveredCell.y);
  const terrainLabel = BATTLE_TERRAIN_LABELS[terrain];
  const terrainDescription = BATTLE_TERRAIN_DESCRIPTIONS[terrain];
  const terrainCost = getTerrainMoveCost(terrain);

  if (isObstacle(battle, hoveredCell.x, hoveredCell.y)) {
    return { title: 'Blocked', detail: `${terrainLabel}. This cell is blocked by terrain.`, tone: 'neutral' };
  }

  const unitAtCell = getUnitAt(battle, hoveredCell.x, hoveredCell.y);
  if (unitAtCell) {
    if (selectedSpell) {
      const validTarget =
        (selectedSpell.target === 'enemy' && unitAtCell.side !== activeUnit.side) ||
        (selectedSpell.target === 'ally' && unitAtCell.side === activeUnit.side);
      return {
        title: validTarget ? selectedSpell.name : 'Wrong Target',
        detail: validTarget
          ? `Cast on ${unitAtCell.name}. Mana cost ${selectedSpell.cost}.`
          : `${selectedSpell.name} cannot target ${unitAtCell.name}.`,
        tone: validTarget && selectedSpell.target === 'ally' ? 'good' : validTarget ? 'danger' : 'neutral',
      };
    }

    if (isPlayerTurn && activeUnit.kind === 'commander' && unitAtCell.id === activeUnit.id) {
      return {
        title: 'King Spells',
        detail: 'Click your commander or use the Spells button to open the spell book.',
        tone: 'good',
      };
    }

    if (isPlayerTurn && canHeal(activeUnit, unitAtCell)) {
      return {
        title: `Heal ${unitAtCell.name}`,
        detail: `Restores about ${getHealAmount(activeUnit, unitAtCell, battle)} health.`,
        tone: 'good',
      };
    }

    if (isPlayerTurn && canAttack(activeUnit, unitAtCell)) {
      const damage = getAttackDamage(activeUnit, unitAtCell, battle);
      const defeatText = damage >= unitAtCell.currentHealth ? ' Likely defeat.' : '';
      return {
        title: `Strike ${unitAtCell.name}`,
        detail: `Deals about ${damage} damage.${defeatText}`,
        tone: 'danger',
      };
    }

    return {
      title: unitAtCell.name,
      detail: `${unitAtCell.currentHealth}/${unitAtCell.maxHealth} HP on ${terrainLabel}.`,
      tone: unitAtCell.side === 'player' ? 'good' : 'danger',
    };
  }

  if (isPlayerTurn && !movementLocked && canMoveTo(battle, activeUnit, hoveredCell.x, hoveredCell.y)) {
    return {
      title: `Move to ${hoveredCell.x}:${hoveredCell.y}`,
      detail: `${terrainLabel}. Movement cost ${terrainCost}. ${terrainDescription}`,
      tone: 'good',
    };
  }

  if (isPlayerTurn && movementLocked && !unitAtCell) {
    return {
      title: terrainLabel,
      detail: `Movement is pending. Attack, heal, cast, wait, or undo before moving again. ${terrainDescription}`,
      tone: 'neutral',
    };
  }

  return {
    title: terrainLabel,
    detail: isPlayerTurn
      ? `Out of range for ${activeUnit.name}. ${terrainDescription}`
      : terrainDescription,
    tone: 'neutral',
  };
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
      detail: 'This enemy is afraid enough to offer service instead of battle rewards.',
      tone: 'victory',
    };
  }

  if (battle.status === 'victory') {
    return { headline: 'Victory', detail: 'The field is yours. Claim the spoils and leave the battle.', tone: 'victory' };
  }

  if (battle.status === 'defeat') {
    return { headline: 'Defeat', detail: 'Protect the commander. If the king falls, the battle is lost.', tone: 'danger' };
  }

  if (battle.status === 'recruited') {
    return { headline: 'Recruited', detail: 'The enemy warband has joined you. No battle reward was taken.', tone: 'victory' };
  }

  if (!activeUnit) {
    return { headline: 'Resolving', detail: 'The field is settling.', tone: 'neutral' };
  }

  if (!isPlayerTurn) {
    return { headline: 'Enemy Turn', detail: `${activeUnit.name} is preparing an action.`, tone: 'enemy' };
  }

  if (selectedSpell) {
    return {
      headline: 'Choose Target',
      detail: selectedSpell.target === 'enemy'
        ? `Pick a highlighted enemy for ${selectedSpell.name}.`
        : `Pick a highlighted ally for ${selectedSpell.name}.`,
      tone: selectedSpell.target === 'ally' ? 'player' : 'danger',
    };
  }

  if (isCommanderTurn) {
    return {
      headline: 'Your Commander',
      detail: 'Cast a spell, move, strike, or Focus Mana to save power for later.',
      tone: 'player',
    };
  }

  if (activeUnit.healing > 0) {
    return {
      headline: 'Your Turn',
      detail: `${activeUnit.name} can move, strike, or heal a wounded ally in range.`,
      tone: 'player',
    };
  }

  return {
    headline: 'Your Turn',
    detail: `${activeUnit.name} can move to gold-lit tiles or strike red-lit enemies.`,
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
  const acceptedItems = itemAddResult.acceptedItems;
  const acceptedRareGems = acceptedItems
    .filter(item => item.id === 'rare-gem')
    .reduce((total, item) => total + item.quantity, 0);

  const battleActivity: ActivityEntry = {
    id: `activity-battle-${enemy.id}-${completedAt}`,
    type: 'battle',
    title: itemAddResult.rejectedItems.length > 0 ? `Defeated ${enemy.name} (satchel full)` : `Defeated ${enemy.name}`,
    source: enemy.id.startsWith('dungeon-') ? 'Dungeon Battle' : 'Battle',
    completedAt,
    rewards: {
      gold: reward.gold,
      exp: reward.exp,
      rareGems: acceptedRareGems || undefined,
      items: acceptedItems.length > 0 ? acceptedItems : undefined,
      equipment: rewardEquipment.length > 0 ? rewardEquipment : undefined,
    },
  };
  const rareGemsAccepted = acceptedRareGems || undefined;

  const nextUser: User = {
    ...user,
    gold: user.gold + reward.gold,
    exp: user.exp + reward.exp,
    inventory: itemAddResult.inventory,
    equipment: [...(user.equipment || []), ...rewardEquipment],
    activityLog: [battleActivity, ...(user.activityLog || [])].slice(0, 30),
  };
  const questProgress = getBattleQuestProgressDeltas(questProgressBefore, getBattleQuestSnapshots(nextUser));

  updateCurrentUser(nextUser);

  return {
    ...reward,
    rareGemsAccepted,
    equipmentNames: rewardEquipment.map(item => item.name),
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

  return penalty;
}
