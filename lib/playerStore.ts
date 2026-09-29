// Owns the localStorage session-user slot. Must not import gameplay modules (lib/auth imports this).
import { readGameJson, removeGameStorageItem, writeGameJson } from './gameStore';
import type { User } from './playerTypes';

export const CURRENT_USER_KEY = 'pirate_game_current_user';

type CurrentUserReader = () => User | null;

let currentUserReader: CurrentUserReader | null = null;

/** lib/auth registers its migrating `getCurrentUser` here so lower layers can read it without importing lib/auth. */
export function registerCurrentUserReader(reader: CurrentUserReader): void {
  currentUserReader = reader;
}

export function readStoredSessionUser(): User | null {
  if (typeof window === 'undefined') return null;
  return readGameJson<User | null>(CURRENT_USER_KEY, null);
}

export function readCurrentUser(): User | null {
  return currentUserReader ? currentUserReader() : readStoredSessionUser();
}

export function writeStoredSessionUser(user: User): void {
  writeGameJson(CURRENT_USER_KEY, user);
}

export function clearStoredSessionUser(): void {
  removeGameStorageItem(CURRENT_USER_KEY);
}
