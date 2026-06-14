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
  mergeFormation,
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

export default function FormationPanel({
  enemyName,
  enemySubtitle,
  commanderName,
  commanderModel,
  stacks,
  formation: formationInput,
  spellIds,
  knownSpellIds,
  onChangeFormation,
  onChangeSpellIds,
  onStart,
  onBack,
}: FormationPanelProps) {
  const formation = useMemo(() => mergeFormation(stacks, formationInput), [stacks, formationInput]);
  const [selectedToken, setSelectedToken] = useState<SelectedToken>(stacks[0]?.id || COMMANDER_FORMATION_KEY);
  const [selectedSpellSlot, setSelectedSpellSlot] = useState(0);
  const formationIssue = getFormationIssue(formation, stacks);
  const equippedSpellIds = spellIds.length === 4 ? spellIds : [...spellIds, 'arcane-bolt', 'sanctified-mend', 'ember-dart'].slice(0, 4);

  const occupiedByCell = useMemo(() => {
    const map = new Map<string, { token: SelectedToken; stack?: MinionStack }>();
    const commanderCell = formation[COMMANDER_FORMATION_KEY];
    if (commanderCell) {
      map.set(`${commanderCell.x}:${commanderCell.y}`, { token: COMMANDER_FORMATION_KEY });
    }
    stacks.forEach(stack => {
      const cell = formation[stack.id];
      if (cell) map.set(`${cell.x}:${cell.y}`, { token: stack.id, stack });
    });
    return map;
  }, [formation, stacks]);

  const assignSelectedToCell = (cell: BoardCell) => {
    const occupying = occupiedByCell.get(`${cell.x}:${cell.y}`);
    const selectedCurrentCell = selectedToken === COMMANDER_FORMATION_KEY
      ? formation[COMMANDER_FORMATION_KEY]
      : formation[selectedToken];
    const nextFormation = { ...formation };

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
          <div className="arcane-label text-center">Warband</div>
          <div className="formation-warband-list">
            <FormationHoverTip side="right" popover={<CommanderTooltipContent commanderName={commanderName} />}>
              <button
                type="button"
                onClick={() => setSelectedToken(COMMANDER_FORMATION_KEY)}
                className={`formation-warband-card rounded border ${selectedToken === COMMANDER_FORMATION_KEY ? 'formation-unit-selected' : ''}`}
              >
                <FormationUnitPortrait
                  imageSrc={getPlayerModelPath(commanderModel)}
                  variant="commander"
                  size="dock"
                />
                <span className="formation-warband-label">{shortWarbandLabel(commanderName)}</span>
                <span className="formation-tier-badge formation-tier-badge-commander">C</span>
              </button>
            </FormationHoverTip>
            {stacks.map(stack => {
              const template = getMinionTemplate(stack.templateId);
              if (!template) return null;
              return (
                <FormationHoverTip key={stack.id} side="right" popover={<MinionTooltipContent template={template} />}>
                  <button
                    type="button"
                    onClick={() => setSelectedToken(stack.id)}
                    className={`formation-warband-card rounded border ${selectedToken === stack.id ? 'formation-unit-selected' : ''}`}
                  >
                    <FormationUnitPortrait
                      imageSrc={`/assets/minions/${template.templateId}.png`}
                      variant="minion"
                      size="dock"
                    />
                    <span className="formation-warband-label">{shortWarbandLabel(template.name)}</span>
                    <span className="formation-tier-badge">{getTierRoman(template.tier)}</span>
                  </button>
                </FormationHoverTip>
              );
            })}
          </div>
        </aside>

        <section className="formation-board-panel ui-card rounded border">
          <div className="formation-board-head">
            <h3 className="fantasy-heading text-lg leading-tight">
              vs <span className="ui-value">{enemyName}</span>
            </h3>
            {enemySubtitle ? <p className="formation-board-subtitle ui-faint text-[11px] font-bold">{enemySubtitle}</p> : null}
          </div>
          <p className="formation-board-hint ui-faint text-[10px] font-bold">
            Select a unit, then tap a slot to place or swap.
          </p>
          <div className="formation-battle-board-shell">
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
                          setSelectedToken(occupant.token);
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
                      ) : template ? (
                        <span className={`formation-unit-piece ${tokenHighlightClass}`}>
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
        </section>

        <aside className="formation-spells-dock ui-card rounded border">
          <div className="flex items-center justify-between gap-2">
            <div className="arcane-label">Spells</div>
            <span className="formation-spell-slot-indicator ui-faint text-[10px] font-black">Slot {selectedSpellSlot + 1}</span>
          </div>
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
                    className={`formation-spell-slot rounded border ${selectedSpellSlot === index ? 'formation-spell-slot-selected' : ''}`}
                  >
                    <span className="formation-spell-slot-index" aria-hidden="true">{index + 1}</span>
                    <Image src={getSpellIconPath(spell)} alt="" width={64} height={64} className="formation-spell-slot-icon object-contain" unoptimized />
                    <span className="formation-spell-slot-label">M{spell.cost}</span>
                  </button>
                </FormationHoverTip>
              );
            })}
          </div>
          <p className="formation-spell-hint ui-faint text-[10px] font-bold">
            Tap a slot, then pick a spell below to swap.
          </p>
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
                  className="formation-known-spell rounded border"
                >
                  <Image src={getSpellIconPath(spell)} alt="" width={56} height={56} className="formation-known-spell-icon object-contain" unoptimized />
                </button>
              </FormationHoverTip>
            )) : (
              <p className="formation-spell-pool-empty ui-faint col-span-full text-center text-[10px] font-bold">
                All known spells are equipped.
              </p>
            )}
          </div>

          <div className="formation-spells-actions">
            {formationIssue ? (
              <p className="formation-spells-issue text-[10px] font-bold text-amber-100">{formationIssue}</p>
            ) : (
              <p className="formation-spells-issue ui-faint text-[10px] font-black">Formation ready</p>
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
    </>
  );
}

function SpellTooltipContent({ spell, equippedSlot }: { spell: BattleSpell; equippedSlot?: number }) {
  const rarityClass = spell.rarity === 'legendary'
    ? 'formation-spell-tip-tag-legendary'
    : spell.rarity === 'rare'
      ? 'formation-spell-tip-tag-rare'
      : 'formation-spell-tip-tag-common';
  const targetLabel = spell.target === 'enemy' ? 'Enemy' : spell.target === 'ally' ? 'Ally' : 'Field';

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
      <p className="formation-tip-copy">Select a unit, then click here to place or swap.</p>
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
  const dimension = size === 'formation' ? 80 : 56;
  const boxClass = size === 'formation' ? 'formation-portrait-formation' : 'formation-portrait-dock';

  return (
    <span
      className={`run-minion-portrait formation-unit-portrait inline-flex overflow-hidden rounded-full border border-[rgba(232,217,184,0.24)] ${variant === 'commander' ? 'formation-commander-frame' : ''} ${boxClass}`}
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
