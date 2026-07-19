export const PVP_RATING_MIN = 100;
export const PVP_RATING_MAX = 300;
export const PVP_RATING_START = 100;

export interface PvpRatingState {
  rating: number;
  winStreak: number;
  lossStreak: number;
  wins: number;
  losses: number;
  processedDuelIds?: string[];
}

export interface PvpRatingDelta {
  winnerDelta: number;
  loserDelta: number;
  winnerRating: number;
  loserRating: number;
}

export function createDefaultPvpRatingState(): PvpRatingState {
  return {
    rating: PVP_RATING_START,
    winStreak: 0,
    lossStreak: 0,
    wins: 0,
    losses: 0,
    processedDuelIds: [],
  };
}

export function normalizePvpRatingState(state?: Partial<PvpRatingState> | null): PvpRatingState {
  const base = createDefaultPvpRatingState();
  if (!state) return base;

  return {
    rating: clampRating(state.rating ?? base.rating),
    winStreak: Math.max(0, Math.floor(state.winStreak ?? base.winStreak)),
    lossStreak: Math.max(0, Math.floor(state.lossStreak ?? base.lossStreak)),
    wins: Math.max(0, Math.floor(state.wins ?? base.wins)),
    losses: Math.max(0, Math.floor(state.losses ?? base.losses)),
    processedDuelIds: Array.from(new Set((state.processedDuelIds || [])
      .filter(id => typeof id === 'string')
      .map(id => id.trim().slice(0, 180))
      .filter(Boolean)))
      .slice(0, 200),
  };
}

export function clampRating(value: number): number {
  return Math.max(PVP_RATING_MIN, Math.min(PVP_RATING_MAX, Math.round(value)));
}

/** Base swing is 4–10; closer ratings swing more. */
export function getBaseRatingSwing(winnerRating: number, loserRating: number): number {
  const gap = Math.abs(winnerRating - loserRating);
  const closeness = 1 - Math.min(1, gap / 120);
  return 4 + Math.round(closeness * 6);
}

export function getWinStreakBonus(winStreak: number): number {
  if (winStreak >= 5) return 3;
  if (winStreak >= 3) return 2;
  if (winStreak >= 2) return 1;
  return 0;
}

export function getLossStreakPenalty(lossStreak: number): number {
  if (lossStreak >= 5) return 3;
  if (lossStreak >= 3) return 2;
  if (lossStreak >= 2) return 1;
  return 0;
}

export function calculatePvpRatingDelta(
  winner: PvpRatingState,
  loser: PvpRatingState,
): PvpRatingDelta {
  const baseSwing = getBaseRatingSwing(winner.rating, loser.rating);
  const nextWinnerStreak = winner.winStreak + 1;
  const nextLoserStreak = loser.lossStreak + 1;
  const winnerDelta = baseSwing + getWinStreakBonus(nextWinnerStreak);
  const loserDelta = baseSwing + getLossStreakPenalty(nextLoserStreak);

  return {
    winnerDelta,
    loserDelta,
    winnerRating: clampRating(winner.rating + winnerDelta),
    loserRating: clampRating(loser.rating - loserDelta),
  };
}

export function applyPvpRatingWin(state: PvpRatingState, delta: PvpRatingDelta): PvpRatingState {
  return {
    rating: delta.winnerRating,
    winStreak: state.winStreak + 1,
    lossStreak: 0,
    wins: state.wins + 1,
    losses: state.losses,
    processedDuelIds: [...(state.processedDuelIds || [])],
  };
}

export function applyPvpRatingLoss(state: PvpRatingState, delta: PvpRatingDelta): PvpRatingState {
  return {
    rating: delta.loserRating,
    winStreak: 0,
    lossStreak: state.lossStreak + 1,
    wins: state.wins,
    losses: state.losses + 1,
    processedDuelIds: [...(state.processedDuelIds || [])],
  };
}

export function formatPvpRating(value: number): string {
  return String(clampRating(value));
}
