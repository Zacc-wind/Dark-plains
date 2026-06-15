import type { MinionStack } from './auth';
import type { BoardCell } from './battle';

export const COMMANDER_FORMATION_KEY = '__commander__';

export const DEFAULT_COMMANDER_CELL: BoardCell = { x: 0, y: 3 };

export const FORMATION_COLUMNS = 2;
export const FORMATION_ROWS = 7;

const DEFAULT_MINION_CELLS: BoardCell[] = [
  { x: 1, y: 3 },
  { x: 1, y: 2 },
  { x: 1, y: 4 },
  { x: 0, y: 2 },
  { x: 0, y: 4 },
  { x: 1, y: 1 },
  { x: 1, y: 5 },
];

export function getFormationCells(): BoardCell[] {
  return Array.from({ length: FORMATION_COLUMNS * FORMATION_ROWS }, (_, index) => ({
    x: index % FORMATION_COLUMNS,
    y: Math.floor(index / FORMATION_COLUMNS),
  }));
}

export function isFormationCellAllowed(cell?: BoardCell): cell is BoardCell {
  if (!cell) return false;
  return Number.isInteger(cell.x)
    && Number.isInteger(cell.y)
    && cell.x >= 0
    && cell.x < FORMATION_COLUMNS
    && cell.y >= 0
    && cell.y < FORMATION_ROWS;
}

export function getPlacedFormationStacks(
  stacks: MinionStack[],
  formation: Record<string, BoardCell>,
): MinionStack[] {
  return stacks.filter(stack => isFormationCellAllowed(formation[stack.id]));
}

export function getBenchedFormationStacks(
  stacks: MinionStack[],
  formation: Record<string, BoardCell>,
): MinionStack[] {
  return stacks.filter(stack => !isFormationCellAllowed(formation[stack.id]));
}

export function removeStackFromFormation(
  formation: Record<string, BoardCell>,
  stackId: string,
): Record<string, BoardCell> {
  if (stackId === COMMANDER_FORMATION_KEY) return formation;
  const next = { ...formation };
  delete next[stackId];
  return next;
}

export function makeDefaultFormation(stacks: MinionStack[]): Record<string, BoardCell> {
  const formation: Record<string, BoardCell> = {
    [COMMANDER_FORMATION_KEY]: DEFAULT_COMMANDER_CELL,
  };

  stacks.forEach((stack, index) => {
    const cell = DEFAULT_MINION_CELLS[index];
    if (cell) formation[stack.id] = cell;
  });

  return formation;
}

export function mergeFormation(
  stacks: MinionStack[],
  formation: Record<string, BoardCell>,
  maxFielded = 7,
): Record<string, BoardCell> {
  const commanderCell = formation[COMMANDER_FORMATION_KEY];
  const merged: Record<string, BoardCell> = {
    [COMMANDER_FORMATION_KEY]: isFormationCellAllowed(commanderCell)
      ? commanderCell
      : DEFAULT_COMMANDER_CELL,
  };

  const explicitPlacements = stacks
    .map(stack => ({ stack, cell: formation[stack.id] }))
    .filter((item): item is { stack: MinionStack; cell: BoardCell } => isFormationCellAllowed(item.cell));

  if (explicitPlacements.length > 0) {
    explicitPlacements.forEach(({ stack, cell }) => {
      merged[stack.id] = cell;
    });
    return merged;
  }

  const defaults = makeDefaultFormation(stacks.slice(0, maxFielded));
  stacks.slice(0, maxFielded).forEach(stack => {
    const cell = defaults[stack.id];
    if (isFormationCellAllowed(cell)) merged[stack.id] = cell;
  });

  return merged;
}

export function getFormationIssue(formation: Record<string, BoardCell>, stacks: MinionStack[]): string | null {
  const commanderCell = formation[COMMANDER_FORMATION_KEY];
  if (!isFormationCellAllowed(commanderCell)) {
    return 'Place your commander on the formation grid.';
  }

  const occupied = new Set<string>([`${commanderCell.x}:${commanderCell.y}`]);

  for (const stack of stacks) {
    const cell = formation[stack.id];
    if (!isFormationCellAllowed(cell)) continue;

    const cellKey = `${cell.x}:${cell.y}`;
    if (occupied.has(cellKey)) return 'Two units are using the same slot.';
    occupied.add(cellKey);
  }

  return null;
}

export function equipSpellLoadout(spellIds: string[], slotIndex: number, spellId: string): string[] {
  const next = spellIds.length === 4 ? [...spellIds] : [...spellIds, ...Array(4 - spellIds.length).fill(spellIds[0] || 'arcane-bolt')].slice(0, 4);
  const targetIndex = Math.min(Math.max(slotIndex, 0), 3);
  const duplicateIndex = next.findIndex((id, index) => id === spellId && index !== targetIndex);
  if (duplicateIndex !== -1) {
    next[duplicateIndex] = next[targetIndex];
  }
  next[targetIndex] = spellId;
  return next;
}
