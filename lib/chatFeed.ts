'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { SocialChatMessage } from './auth';
import { fetchSharedChatHistory, MAX_VISIBLE_CHAT_HISTORY } from './socialChatClient';

/** Chat dock / social panel visible. */
export const CHAT_FEED_ACTIVE_INTERVAL_MS = 2_500;
/** Live toast feed on the map (chat closed). */
export const CHAT_FEED_TOAST_INTERVAL_MS = 5_000;
/** Only the unread badge needs data. */
export const CHAT_FEED_IDLE_INTERVAL_MS = 10_000;

export interface GlobalChatSnapshot {
  messages: SocialChatMessage[];
  loaded: boolean;
}

const EMPTY_SNAPSHOT: GlobalChatSnapshot = { messages: [], loaded: false };

let snapshot: GlobalChatSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();
const demands = new Map<number, number>();
let nextDemandId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight: Promise<void> | null = null;
let lastFetchAt = 0;
let visibilityBound = false;

function emit(): void {
  listeners.forEach(listener => listener());
}

function sameMessages(left: SocialChatMessage[], right: SocialChatMessage[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index].id !== right[index].id || left[index].text !== right[index].text) return false;
  }
  return true;
}

function applyMessages(messages: SocialChatMessage[]): void {
  const next = messages.slice(-MAX_VISIBLE_CHAT_HISTORY);
  if (snapshot.loaded && sameMessages(snapshot.messages, next)) return;
  snapshot = { messages: next, loaded: true };
  emit();
}

function getRequestedInterval(): number | null {
  if (demands.size === 0) return null;
  return Math.min(...demands.values());
}

function clearTimer(): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function reschedule(): void {
  clearTimer();
  const interval = getRequestedInterval();
  if (interval === null || typeof document === 'undefined' || document.hidden) return;
  const wait = Math.max(0, lastFetchAt + interval - Date.now());
  timer = setTimeout(() => {
    timer = undefined;
    void refreshGlobalChat().then(reschedule);
  }, wait);
}

function handleVisibilityChange(): void {
  reschedule();
}

function bindVisibility(bound: boolean): void {
  if (typeof document === 'undefined' || visibilityBound === bound) return;
  visibilityBound = bound;
  if (bound) document.addEventListener('visibilitychange', handleVisibilityChange);
  else document.removeEventListener('visibilitychange', handleVisibilityChange);
}

/** Fetches `/api/chat` once; concurrent callers share the same request. */
export function refreshGlobalChat(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      applyMessages(await fetchSharedChatHistory('global'));
    } catch {
      // fetchSharedChatHistory already falls back to local messages.
    } finally {
      lastFetchAt = Date.now();
      inFlight = null;
    }
  })();
  return inFlight;
}

export function getGlobalChatSnapshot(): GlobalChatSnapshot {
  return snapshot;
}

function getServerSnapshot(): GlobalChatSnapshot {
  return EMPTY_SNAPSHOT;
}

export function subscribeGlobalChat(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Registers a consumer that wants fresh global chat at least every `intervalMs`. */
export function registerChatFeedDemand(intervalMs: number): () => void {
  const id = nextDemandId;
  nextDemandId += 1;
  demands.set(id, intervalMs);
  bindVisibility(true);
  reschedule();
  return () => {
    demands.delete(id);
    if (demands.size === 0) {
      clearTimer();
      bindVisibility(false);
    } else {
      reschedule();
    }
  };
}

/** Inserts a message the current player just sent without waiting for the next poll. */
export function pushGlobalChatMessage(message: SocialChatMessage): void {
  applyMessages([
    ...snapshot.messages.filter(existing => existing.id !== message.id),
    message,
  ]);
}

export function useGlobalChatFeed(intervalMs: number | null): GlobalChatSnapshot {
  const value = useSyncExternalStore(subscribeGlobalChat, getGlobalChatSnapshot, getServerSnapshot);

  useEffect(() => {
    if (intervalMs === null) return undefined;
    return registerChatFeedDemand(intervalMs);
  }, [intervalMs]);

  return value;
}
