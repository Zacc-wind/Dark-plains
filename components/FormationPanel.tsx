'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BATTLE_SPELLS, type BattleSpell, type BoardCell, type PlayerModelNumber } from '@/lib/battle';
import { getPlayerModelPath } from '@/lib/assetLoader';
import {
  COMMANDER_FORMATION_KEY,
  equipSpellLoadout,
  getFormationCells,
  getFormationIssue,
  getPlacedFormationStacks,
  isFormationCellAllowed,
  mergeFormation,
  removeStackFromFormation,
} from '@/lib/formation';
import {
  getMinionTemplate,
  MINION_CLASS_LABELS,
  MINION_TIER_LABELS,
  type MinionStack,
  type MinionTemplate,
} from '@/lib/auth';
import { getSpellIconPath } from '@/lib/spellAssets';

type FormationPanelProps = {
  enemyName: string;
  enemySubtitle?: string;
  commanderName: string;
  commanderModel: PlayerModelNumber;
  stacks: MinionStack[];
  stackHealth?: Record<string, { current: number; max: number }>;
  maxFielded?: number;
  formation: Record<string, BoardCell>;
  spellIds: string[];
  knownSpellIds: string[];
  onChangeFormation: (formation: Record<string, BoardCell>) => void;
  onChangeSpellIds: (spellIds: string[]) => void;
  onStart: () => void;
  onBack: () => void;
};

type SelectedToken = typeof COMMANDER_FORMATION_KEY | string;

function getTierRoman(tier: string): string {
  if (tier === 'tier3') return 'III';
  if (tier === 'tier2') return 'II';
  return 'I';
}

function getFormationSelectionIssue(
  formation: Record<string, BoardCell>,
  placedStacks: MinionStack[],
  maxFielded: number,
): string | null {
  if (placedStacks.length > maxFielded) {
    return `Field only ${maxFielded} units. Keep extras on the bench.`;
  }

  return getFormationIssue(formation, placedStacks);
}

export default function FormationPanel({
  enemyName,
  enemySubtitle,
  commanderName,
  commanderModel,
  stacks,
  stackHealth,
  maxFielded = 7,
  formation: formationInput,
  spellIds,
  knownSpellIds,
  onChangeFormation,
  onChangeSpellIds,
  onStart,
  onBack,
}: FormationPanelProps) {
  const formation = useMemo(() => mergeFormation(stacks, formationInput, maxFielded), [stacks, formationInput, maxFielded]);
  const [selectedToken, setSelectedToken] = useState<SelectedToken>(stacks[0]?.id || COMMANDER_FORMATION_KEY);
  const [selectedSpellSlot, setSelectedSpellSlot] = useState(0);
  const [benchDragActive, setBenchDragActive] = useState(false);
  const placedStacks = useMemo(() => getPlacedFormationStacks(stacks, formation), [formation, stacks]);
  const benchedStacks = useMemo(
    () => stacks.filter(stack => !isFormationCellAllowed(formation[stack.id])),
    [formation, stacks],
  );
  const formationIssue = getFormationSelectionIssue(formation, placedStacks, maxFielded);
  const equippedSpellIds = spellIds.length === 4 ? spellIds : [...spellIds, 'arcane-bolt', 'sanctified-mend', 'ember-dart'].slice(0, 4);
  const commanderPlaced = isFormationCellAllowed(formation[COMMANDER_FORMATION_KEY]);
  const selectedStack = selectedToken && selectedToken !== COMMANDER_FORMATION_KEY
    ? stacks.find(stack => stack.id === selectedToken)
    : undefined;
  const selectedTemplate = selectedStack ? getMinionTemplate(selectedStack.templateId) : undefined;
  const selectedLabel = selectedToken === COMMANDER_FORMATION_KEY
    ? commanderName
    : selectedTemplate?.name || 'No unit selected';
  const selectedMeta = selectedToken === COMMANDER_FORMATION_KEY
    ? 'Commander'
    : selectedTemplate
      ? `${MINION_CLASS_LABELS[selectedTemplate.class]} - Tier ${getTierRoman(selectedTemplate.tier)}`
      : 'Pick from warband';
  const selectedAction = !selectedToken
    ? 'Select a unit on the left, then choose a deployment slot.'
    : selectedToken === COMMANDER_FORMATION_KEY
      ? 'Click a slot to reposition the commander.'
      : isFormationCellAllowed(formation[selectedToken])
        ? 'Click another slot to swap, or send this unit to bench.'
        : 'Click an open slot to field this unit.';

  const occupiedByCell = useMemo(() => {
    const map = new Map<string, { token: SelectedToken; stack?: MinionStack }>();
    const commanderCell = formation[COMMANDER_FORMATION_KEY];
    if (commanderCell) {
      map.set(`${commanderCell.x}:${commanderCell.y}`, { token: COMMANDER_FORMATION_KEY });
    }
    placedStacks.forEach(stack => {
      const cell = formation[stack.id];
      if (cell) map.set(`${cell.x}:${cell.y}`, { token: stack.id, stack });
    });
    return map;
  }, [formation, placedStacks]);

  const assignSelectedToCell = (cell: BoardCell) => {
    const occupying = occupiedByCell.get(`${cell.x}:${cell.y}`);
    const selectedCurrentCell = selectedToken === COMMANDER_FORMATION_KEY
      ? formation[COMMANDER_FORMATION_KEY]
      : formation[selectedToken];
    const nextFormation = { ...formation };

    if (!occupying && selectedToken !== COMMANDER_FORMATION_KEY && !selectedCurrentCell && placedStacks.length >= maxFielded) {
      return;
    }

    if (occupying) {
      if (occupying.token === selectedToken) {
        setSelectedToken(selectedToken);
        return;
      }
      if (selectedCurrentCell) {
        if (occupying.token === COMMANDER_FORMATION_KEY) {
          nextFormation[COMMANDER_FORMATION_KEY] = selectedCurrentCell;
        } else {
          nextFormation[occupying.token] = selectedCurrentCell;
        }
      } else if (occupying.token === COMMANDER_FORMATION_KEY) {
        delete nextFormation[COMMANDER_FORMATION_KEY];
      } else {
        delete nextFormation[occupying.token];
      }
    }

    if (selectedToken === COMMANDER_FORMATION_KEY) {
      nextFormation[COMMANDER_FORMATION_KEY] = cell;
    } else {
      nextFormation[selectedToken] = cell;
    }

    onChangeFormation(nextFormation);
    setSelectedToken('');
  };

  const benchStack = (stackId: string) => {
    if (stackId === COMMANDER_FORMATION_KEY) return;
    onChangeFormation(removeStackFromFormation(formation, stackId));
    if (selectedToken === stackId) setSelectedToken('');
  };

  const handleBenchDrop = (stackId: string) => {
    if (!stackId || stackId === COMMANDER_FORMATION_KEY) return;
    benchStack(stackId);
    setBenchDragActive(false);
  };

  const handleWarbandStackClick = (stackId: string) => {
    if (selectedToken === stackId && isFormationCellAllowed(formation[stackId])) {
      benchStack(stackId);
      return;
    }
    setSelectedToken(stackId);
  };

  const knownSpells = knownSpellIds
    .map(spellId => BATTLE_SPELLS.find(spell => spell.id === spellId))
    .filter((spell): spell is BattleSpell => Boolean(spell));
  const unequippedKnownSpells = useMemo(
    () => knownSpells.filter(spell => !equippedSpellIds.includes(spell.id)),
    [knownSpells, equippedSpellIds],
  );

  return (
    <div className="formation-screen-shell">
      <div className="formation-screen-stage">
        <aside className="formation-warband-dock ui-card rounded border">
          <div className="formation-warband-dock-head">
            <div>
              <div className="arcane-label">Warband</div>
              <div className="formation-warband-subcopy ui-faint text-[10px] font-bold">
                Field {placedStacks.length}/{maxFielded} · Bench {benchedStacks.length}
              </div>
            </div>
            <span className="ui-pill rounded border px-2 py-0.5 text-[10px] font-black">
              {stacks.length} total
            </span>
          </div>
          <div className="formation-warband-list">
            <FormationHoverTip side="right" popover={<CommanderTooltipContent commanderName={commanderName} />}>
              <button
                type="button"
                onClick={() => setSelectedToken(COMMANDER_FORMATION_KEY)}
                className={`formation-warband-card formation-warband-card-fielded rounded border ${selectedToken === COMMANDER_FORMATION_KEY ? 'formation-unit-selected' : ''}`}
              >
                <FormationUnitPortrait
                  imageSrc={getPlayerModelPath(commanderModel)}
                  variant="commander"
                  size="dock"
                />
                <span className="formation-warband-copy">
                  <span className="formation-warband-label">{shortWarbandLabel(commanderName, 18)}</span>
                  <span className="formation-warband-meta">
                    <span className="formation-warband-role ui-faint">Commander</span>
                    <span className="formation-warband-status formation-warband-status-field">On field</span>
                  </span>
                </span>
                <span className="formation-tier-badge formation-tier-badge-commander">C</span>
              </button>
            </FormationHoverTip>

            {placedStacks.length > 0 && (
              <div className="formation-warband-section">
                <div className="formation-warband-section-label">On field</div>
                {placedStacks.map(stack => (
                  <WarbandStackCard
                    key={stack.id}
                    stack={stack}
                    selected={selectedToken === stack.id}
                    fielded
                    health={stackHealth?.[stack.id]}
                    onClick={() => handleWarbandStackClick(stack.id)}
                    onBench={() => benchStack(stack.id)}
                  />
                ))}
              </div>
            )}

            {benchedStacks.length > 0 && (
              <div className="formation-warband-section">
                <div className="formation-warband-section-label">Bench</div>
                {benchedStacks.map(stack => (
                  <WarbandStackCard
                    key={stack.id}
                    stack={stack}
                    selected={selectedToken === stack.id}
                    fielded={false}
                    health={stackHealth?.[stack.id]}
                    onClick={() => handleWarbandStackClick(stack.id)}
                    onBench={() => benchStack(stack.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="formation-board-panel">
          <div className="formation-board-head">
            <p className="formation-board-eyebrow arcane-label">Deployment</p>
            <h3 className="fantasy-heading formation-board-title text-lg leading-tight">
              vs <span className="ui-value">{enemyName}</span>
            </h3>
            {enemySubtitle ? <p className="formation-board-subtitle ui-faint text-[11px] font-bold">{enemySubtitle}</p> : null}
          </div>
          <div className="formation-deploy-command rounded border">
            <div className="formation-deploy-selected">
              <span className="formation-deploy-selected-kicker arcane-label">Selected</span>
              <strong className="formation-deploy-selected-name">{selectedLabel}</strong>
              <span className="formation-deploy-selected-meta">{selectedMeta}</span>
            </div>
            <div className="formation-deploy-rule">
              <span className="formation-deploy-rule-main">{selectedAction}</span>
              <span className="formation-deploy-rule-sub">Front line holds pressure. Rear line keeps safer support angles.</span>
            </div>
            <div className="formation-deploy-counts" aria-label="Formation status">
              <span>
                <strong>{placedStacks.length}</strong>
                <small>fielded</small>
              </span>
              <span>
                <strong>{benchedStacks.length}</strong>
                <small>bench</small>
              </span>
              <span className={commanderPlaced ? 'formation-count-good' : 'formation-count-warning'}>
                <strong>{commanderPlaced ? 'Set' : 'Need'}</strong>
                <small>king</small>
              </span>
            </div>
          </div>
          <div className="formation-battle-board-shell formation-battle-board-shell-with-bench">
            <div className="formation-deploy-backdrop" aria-hidden="true" />
            <button
              type="button"
              className={`formation-bench-zone rounded border ${benchDragActive ? 'formation-bench-zone-active' : ''}`}
              onClick={() => {
                if (selectedToken && selectedToken !== COMMANDER_FORMATION_KEY) {
                  benchStack(selectedToken);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setBenchDragActive(true);
              }}
              onDragLeave={() => setBenchDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                handleBenchDrop(event.dataTransfer.getData('text/formation-stack'));
              }}
              aria-label="Send selected unit back to bench"
            >
              <span className="formation-bench-zone-arrow" aria-hidden="true">←</span>
              <span className="formation-bench-zone-copy">
                <span className="formation-bench-zone-title">Bench</span>
                <span className="formation-bench-zone-hint ui-faint">Drag or drop unit here</span>
              </span>
            </button>
            <div className="formation-deploy-stage">
            <div className="formation-deploy-frame">
              <div className="formation-lane-labels" aria-hidden="true">
                <span>
                  <strong>Front</strong>
                  <small>Guard</small>
                </span>
                <span>
                  <strong>Rear</strong>
                  <small>Support</small>
                </span>
              </div>
              <div className="formation-battle-board grid">
              {getFormationCells().map((cell, index) => {
                const occupant = occupiedByCell.get(`${cell.x}:${cell.y}`);
                const isCommander = occupant?.token === COMMANDER_FORMATION_KEY;
                const stack = occupant?.stack;
                const template = stack ? getMinionTemplate(stack.templateId) : undefined;
                const isSelected = occupant?.token === selectedToken;
                const popover = isCommander
                  ? <CommanderTooltipContent commanderName={commanderName} />
                  : template
                    ? <MinionTooltipContent template={template} />
                    : <EmptySlotTooltipContent slotNumber={index + 1} />;

                const isSwappable = Boolean(occupant && selectedToken && occupant.token !== selectedToken);
                const tokenHighlightClass = isSelected
                  ? 'formation-token-selected'
                  : isSwappable
                    ? 'formation-token-swappable'
                    : '';

                return (
                  <FormationHoverTip key={`${cell.x}-${cell.y}`} side="top" popover={popover}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedToken) {
                          if (occupant) setSelectedToken(occupant.token);
                          return;
                        }
                        if (occupant?.token === selectedToken) {
                          if (selectedToken !== COMMANDER_FORMATION_KEY) {
                            benchStack(selectedToken);
                          }
                          return;
                        }
                        assignSelectedToCell(cell);
                      }}
                      className="battle-cell battle-terrain-ground formation-battle-cell"
                      aria-label={
                        isCommander
                          ? `${commanderName} commander`
                          : template
                            ? `${template.name} tier ${getTierRoman(template.tier)}`
                            : `Open slot ${index + 1}`
                      }
                    >
                      {isCommander ? (
                        <span className={`formation-unit-piece ${tokenHighlightClass}`}>
                          <FormationUnitPortrait
                            imageSrc={getPlayerModelPath(commanderModel)}
                            variant="commander"
                            size="formation"
                          />
                          <span className="formation-tier-badge formation-tier-badge-commander">C</span>
                        </span>
                      ) : template && stack ? (
                        <span
                          className={`formation-unit-piece ${tokenHighlightClass}`}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/formation-stack', stack.id);
                            event.dataTransfer.effectAllowed = 'move';
                            setBenchDragActive(true);
                          }}
                          onDragEnd={() => setBenchDragActive(false)}
                        >
                          <FormationUnitPortrait
                            imageSrc={`/assets/minions/${template.templateId}.png`}
                            variant="minion"
                            size="formation"
                          />
                          <span className="formation-tier-badge">{getTierRoman(template.tier)}</span>
                        </span>
                      ) : (
                        <span className={`formation-slot-marker ${selectedToken ? 'formation-token-ready' : ''}`}>
                          <span className="formation-open-number">{index + 1}</span>
                        </span>
                      )}
                    </button>
                  </FormationHoverTip>
                );
              })}
              </div>
            </div>
            </div>
          </div>
        </section>

        <aside className="formation-spells-dock">
          <div className="formation-spells-head">
            <p className="formation-spells-eyebrow arcane-label">King Spells</p>
            <div className="formation-spells-head-row">
              <h4 className="formation-spells-title fantasy-heading">Loadout</h4>
              <span className="formation-spell-slot-indicator">Slot {selectedSpellSlot + 1}</span>
            </div>
          </div>

          <div className="formation-spells-stage">
            <div className="formation-spells-backdrop" aria-hidden="true" />
            <div className="formation-spells-frame">
              <p className="formation-spells-section-label">Equipped</p>
              <div className="formation-spell-slots">
                {equippedSpellIds.map((spellId, index) => {
                  const spell = BATTLE_SPELLS.find(item => item.id === spellId);
                  if (!spell) return null;
                  return (
                    <FormationHoverTip
                      key={`${spellId}-${index}`}
                      side="left"
                      popoverClassName="formation-hover-popover-spell"
                      popover={<SpellTooltipContent spell={spell} equippedSlot={index + 1} />}
                    >
                      <button
                        type="button"
                        aria-pressed={selectedSpellSlot === index}
                        onClick={() => setSelectedSpellSlot(index)}
                        className={`formation-spell-slot ${getFormationSpellRarityClass(spell.rarity)} ${selectedSpellSlot === index ? 'formation-spell-slot-selected' : ''}`}
                      >
                        <span className="formation-spell-slot-index" aria-hidden="true">{index + 1}</span>
                        <span className="formation-spell-slot-art">
                          <Image src={getSpellIconPath(spell)} alt="" width={80} height={80} className="formation-spell-slot-icon object-contain" unoptimized />
                        </span>
                        <span className="formation-spell-slot-copy">
                          <span className="formation-spell-slot-name">{spell.name}</span>
                          <span className="formation-spell-slot-meta">
                            <span className="formation-spell-slot-label">M{spell.cost}</span>
                            <span className="formation-spell-slot-target">{getSpellTargetLabel(spell.target)}</span>
                          </span>
                        </span>
                      </button>
                    </FormationHoverTip>
                  );
                })}
              </div>

              <p className="formation-spell-hint ui-faint font-bold">
                Tap a slot, then pick a spell below to swap.
              </p>

              <p className="formation-spells-section-label formation-spells-section-label-book">Spellbook</p>
              <div className="formation-known-spells">
                {unequippedKnownSpells.length > 0 ? unequippedKnownSpells.map(spell => (
                  <FormationHoverTip
                    key={spell.id}
                    side="left"
                    popoverClassName="formation-hover-popover-spell"
                    popover={<SpellTooltipContent spell={spell} />}
                  >
                    <button
                      type="button"
                      onClick={() => onChangeSpellIds(equipSpellLoadout(equippedSpellIds, selectedSpellSlot, spell.id))}
                      className={`formation-known-spell ${getFormationSpellRarityClass(spell.rarity)}`}
                    >
                      <span className="formation-known-spell-art">
                        <Image src={getSpellIconPath(spell)} alt="" width={72} height={72} className="formation-known-spell-icon object-contain" unoptimized />
                      </span>
                      <span className="formation-known-spell-copy">
                        <span className="formation-known-spell-name">{spell.name}</span>
                        <span className="formation-known-spell-meta">M{spell.cost} · {getSpellTargetLabel(spell.target)}</span>
                      </span>
                    </button>
                  </FormationHoverTip>
                )) : (
                  <p className="formation-spell-pool-empty ui-faint col-span-full text-center text-[10px] font-bold">
                    All known spells are equipped.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="formation-spells-actions">
            {formationIssue ? (
              <p className="formation-spells-issue font-bold text-amber-100">{formationIssue}</p>
            ) : (
              <p className="formation-spells-issue ui-faint font-black">Formation ready</p>
            )}
            <div className="formation-spells-action-buttons">
              <button type="button" onClick={onBack} className="ui-button rounded px-4 py-2.5 text-xs font-bold">
                Back
              </button>
              <button
                type="button"
                onClick={onStart}
                disabled={Boolean(formationIssue)}
                className="ui-button-primary formation-start-battle-btn rounded px-4 py-2.5 text-xs font-black disabled:opacity-40"
              >
                Start Battle
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WarbandStackCard({
  stack,
  selected,
  fielded,
  health,
  onClick,
  onBench,
}: {
  stack: MinionStack;
  selected: boolean;
  fielded: boolean;
  health?: { current: number; max: number };
  onClick: () => void;
  onBench: () => void;
}) {
  const template = getMinionTemplate(stack.templateId);
  if (!template) return null;
  const healthMax = Math.max(1, health?.max ?? template.stats.health, typeof stack.runCurrentHealth === 'number' ? stack.runCurrentHealth : 0);
  const healthCurrent = typeof health?.current === 'number'
    ? Math.max(0, Math.min(healthMax, Math.round(health.current)))
    : typeof stack.runCurrentHealth === 'number'
      ? Math.max(0, Math.min(healthMax, Math.round(stack.runCurrentHealth)))
    : healthMax;
  const healthPercent = healthMax > 0 ? Math.max(0, Math.min(100, (healthCurrent / healthMax) * 100)) : 0;

  return (
    <FormationHoverTip side="right" popover={<MinionTooltipContent template={template} />}>
      <button
        type="button"
        draggable={fielded}
        onClick={onClick}
        onDragStart={(event) => {
          if (!fielded) return;
          event.dataTransfer.setData('text/formation-stack', stack.id);
          event.dataTransfer.effectAllowed = 'move';
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          if (fielded) onBench();
        }}
        className={`formation-warband-card rounded border ${selected ? 'formation-unit-selected' : ''} ${fielded ? 'formation-warband-card-fielded' : 'formation-warband-card-bench'}`}
      >
        <FormationUnitPortrait
          imageSrc={`/assets/minions/${template.templateId}.png`}
          variant="minion"
          size="dock"
        />
        <span className="formation-warband-copy">
          <span className="formation-warband-label">{shortWarbandLabel(template.name, 18)}</span>
          <span className="formation-warband-meta">
            <span className="formation-warband-role ui-faint">
              {MINION_CLASS_LABELS[template.class]} · Tier {getTierRoman(template.tier)}
            </span>
            <span className={`formation-warband-status ${fielded ? 'formation-warband-status-field' : 'formation-warband-status-bench'}`}>
              {fielded ? 'On field' : 'Bench'}
            </span>
          </span>
          <span className="formation-warband-health" aria-label={`Health ${healthCurrent} of ${healthMax}`}>
            <span className="formation-warband-health-track">
              <span className="formation-warband-health-fill" style={{ width: `${healthPercent}%` }} />
            </span>
            <span className="formation-warband-health-text">{healthCurrent}/{healthMax}</span>
          </span>
        </span>
        <span className="formation-tier-badge">{getTierRoman(template.tier)}</span>
      </button>
    </FormationHoverTip>
  );
}

function FormationHoverTip({
  children,
  popover,
  side = 'right',
  popoverClassName = '',
}: {
  children: ReactNode;
  popover: ReactNode;
  side?: 'right' | 'left' | 'top';
  popoverClassName?: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 10;

    if (side === 'left') {
      setCoords({ top: rect.top + rect.height / 2, left: rect.left - gap });
      return;
    }
    if (side === 'top') {
      setCoords({ top: rect.top - gap, left: rect.left + rect.width / 2 });
      return;
    }
    setCoords({ top: rect.top + rect.height / 2, left: rect.right + gap });
  }, [side]);

  const show = () => {
    updatePosition();
    setOpen(true);
  };

  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handle = () => updatePosition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, updatePosition]);

  return (
    <div
      ref={anchorRef}
      className="formation-hover-tip-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className={`formation-hover-popover formation-hover-popover-floating formation-hover-popover-${side} ${popoverClassName} rounded border`}
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

function CommanderTooltipContent({ commanderName }: { commanderName: string }) {
  return (
    <>
      <div className="formation-tip-title">{commanderName}</div>
      <div className="formation-tip-meta">Commander</div>
      <p className="formation-tip-copy">Your commander. Place on any open deployment slot.</p>
    </>
  );
}

function MinionTooltipContent({ template }: { template: MinionTemplate }) {
  return (
    <>
      <div className="formation-tip-title">{template.name}</div>
      <div className="formation-tip-meta">
        {MINION_CLASS_LABELS[template.class]} · {MINION_TIER_LABELS[template.tier]}
      </div>
      <div className="formation-tip-stats">
        <span>ATK {template.stats.attack}</span>
        <span>DEF {template.stats.defense}</span>
        <span>HP {template.stats.health}</span>
        <span>MOV {template.stats.movement}</span>
        <span>MAG {template.stats.magic}</span>
        <span>RNG {template.stats.range}</span>
      </div>
      <p className="formation-tip-copy">{template.role}</p>
      <p className="formation-tip-copy ui-faint">Double-click or drag to the bench to remove from field.</p>
    </>
  );
}

function getSpellTargetLabel(target: BattleSpell['target']): string {
  if (target === 'enemy') return 'Enemy';
  if (target === 'ally') return 'Ally';
  return 'Field';
}

function getFormationSpellRarityClass(rarity: BattleSpell['rarity']): string {
  return `formation-spell-rarity-${rarity}`;
}

function SpellTooltipContent({ spell, equippedSlot }: { spell: BattleSpell; equippedSlot?: number }) {
  const rarityClass = spell.rarity === 'legendary'
    ? 'formation-spell-tip-tag-legendary'
    : spell.rarity === 'rare'
      ? 'formation-spell-tip-tag-rare'
      : 'formation-spell-tip-tag-common';
  const targetLabel = getSpellTargetLabel(spell.target);

  return (
    <div className="formation-spell-tip">
      <div className="formation-spell-tip-hero">
        <span className="formation-spell-tip-icon">
          <Image
            src={getSpellIconPath(spell)}
            alt=""
            width={80}
            height={80}
            className="formation-spell-tip-icon-image object-contain"
            unoptimized
          />
        </span>
        <div className="formation-spell-tip-heading">
          <div className="formation-spell-tip-title fantasy-heading">{spell.name}</div>
          <div className="formation-spell-tip-tags">
            <span className={`formation-spell-tip-tag ${rarityClass}`}>{spell.rarity}</span>
            <span className="formation-spell-tip-tag">{targetLabel}</span>
            <span className="formation-spell-tip-tag formation-spell-tip-mana">Mana {spell.cost}</span>
            {equippedSlot ? (
              <span className="formation-spell-tip-tag formation-spell-tip-slot">Slot {equippedSlot}</span>
            ) : null}
          </div>
        </div>
      </div>
      <p className="formation-spell-tip-description">{spell.description}</p>
    </div>
  );
}

function EmptySlotTooltipContent({ slotNumber }: { slotNumber: number }) {
  return (
    <>
      <div className="formation-tip-title">Slot {slotNumber}</div>
      <div className="formation-tip-meta">Open deployment cell</div>
      <p className="formation-tip-copy">Select a unit, then click here to place or swap. Drag a fielded unit to the bench to remove it.</p>
    </>
  );
}

function shortWarbandLabel(label: string, max = 12): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function FormationUnitPortrait({
  imageSrc,
  variant = 'minion',
  size = 'dock',
}: {
  imageSrc: string;
  variant?: 'minion' | 'commander';
  size?: 'dock' | 'formation';
}) {
  const dimension = size === 'formation' ? 80 : 44;
  const boxClass = size === 'formation' ? 'formation-portrait-formation' : 'formation-portrait-dock';

  return (
    <span
      className={`run-minion-portrait formation-unit-portrait inline-flex overflow-hidden rounded border border-[rgba(232,217,184,0.24)] ${variant === 'commander' ? 'formation-commander-frame' : ''} ${boxClass}`}
    >
      <Image
        src={imageSrc}
        alt=""
        width={dimension}
        height={dimension}
        className="run-minion-portrait-image run-ui-art object-contain"
        unoptimized
      />
    </span>
  );
}
