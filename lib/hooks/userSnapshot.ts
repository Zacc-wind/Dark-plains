/**
 * State updater helper for periodic `getCurrentUser()` polls: returns `previous` when the freshly
 * read value is structurally identical, so React bails out of the re-render.
 * Usage: `setUser(previous => keepIfUnchanged(previous, getCurrentUser()))`.
 */
export function keepIfUnchanged<T>(previous: T, next: T): T {
  if (Object.is(previous, next)) return previous;
  if (previous === null || next === null || typeof previous !== 'object' || typeof next !== 'object') {
    return next;
  }
  try {
    return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
  } catch {
    return next;
  }
}
