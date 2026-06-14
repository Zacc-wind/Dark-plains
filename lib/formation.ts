import type { MinionStack } from './auth';
import type { BoardCell } from './battle';

export const COMMANDER_FORMATION_KEY = '__commander__';

export const DEFAULT_COMMANDER_CELL: BoardCell = { x: 0, y: 3 };

export const FORMATION_COLUMNS = 2;
export const FORMATION_ROWS = 7;

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

export function makeDefaultFormation(stacks: MinionStack[]): Record<string, BoardCell> {
  const minionCells: BoardCell[] = [
    { x: 1, y: 3 },
    { x: 1, y: 2 },
    { x: 1, y: 4 },
    { x: 0, y: 2 },
    { x: 0, y: 4 },
    { x: 1, y: 1 },
    { x: 1, y: 5 },
  ];

  const formation: Record<string, BoardCell> = {
    [COMMANDER_FORMATION_KEY]: DEFAULT_COMMANDER_CELL,
  };

  stacks.forEach((stack, index) => {
    formation[stack.id] = minionCells[index] || { x: 1, y: Math.min(6, index) };
  });

  return formation;
}

export function mergeFormation(
  stacks: MinionStack[],
  formation: Record<string, BoardCell>,
): Record<string, BoardCell> {
  return { ...makeDefaultFormation(stacks), ...formation };
}

export function getFormationIssue(formation: Record<string, BoardCell>, stacks: MinionStack[]): string | null {
  const commanderCell = formation[COMMANDER_FORMATION_KEY];
  if (!isFormationCellAllowed(commanderCell)) {
    return 'Place your commander on the formation grid.';
  }

  const occupied = new Set<string>([`${commanderCell.x}:${commanderCell.y}`]);

  for (const stack of stacks) {
    const cell = formation[stack.id];
    if (!isFormationCellAllowed(cell)) return 'Place every unit on the formation grid.';

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
