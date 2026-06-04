export interface GameStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryStorage = new Map<string, string>();

export const localGameStorage: GameStorageAdapter = {
  getItem(key) {
    if (typeof window === 'undefined') return memoryStorage.get(key) || null;
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === 'undefined') {
      memoryStorage.set(key, value);
      return;
    }

    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === 'undefined') {
      memoryStorage.delete(key);
      return;
    }

    window.localStorage.removeItem(key);
  },
};

export function getGameStorageAdapter(): GameStorageAdapter {
  return localGameStorage;
}

export function readGameJson<T>(key: string, fallback: T): T {
  const value = getGameStorageAdapter().getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    getGameStorageAdapter().removeItem(key);
    return fallback;
  }
}

export function writeGameJson<T>(key: string, value: T): void {
  getGameStorageAdapter().setItem(key, JSON.stringify(value));
}

export function removeGameStorageItem(key: string): void {
  getGameStorageAdapter().removeItem(key);
}
