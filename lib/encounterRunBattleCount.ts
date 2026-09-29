export function getEncounterRunBattleCount(enemyLevel: number): number {
  if (enemyLevel <= 1) return 2;
  if (enemyLevel <= 3) return 3;
  return Math.min(10, Math.max(3, 3 + Math.ceil((enemyLevel - 3) / 2)));
}
