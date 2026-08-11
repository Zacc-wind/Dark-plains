import type { ApiEnvelope } from '@/lib/apiResponses';
import type { SynchronizedBattleAction } from '@/lib/battle';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { PvpDuelSession } from '@/lib/pvpDuelSessions';

export type PvpDuelPatchAction = 'confirm_formation' | 'cancel' | 'forfeit' | 'settle';

interface DuelListPayload {
  sessions: PvpDuelSession[];
  online: boolean;
}

interface DuelPayload {
  session: PvpDuelSession;
  duplicate?: boolean;
}

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return await response.json() as ApiEnvelope<T>;
  } catch {
    return {
      ok: false,
      error: 'Server returned an invalid response.',
      deploymentMode: 'database',
    };
  }
}

export function shouldUseOnlinePvpDuelClient(): boolean {
  return isSupabaseConfigured() && process.env.VITEST !== 'true';
}

export async function fetchOnlinePvpDuelSessions(): Promise<PvpDuelSession[]> {
  const response = await fetch('/api/pvp/duels', { cache: 'no-store' });
  const payload = await readApiEnvelope<DuelListPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to load duel sessions.');
  }
  return payload.data.sessions;
}

export async function createOnlinePvpDuelSession(challengeId: string): Promise<DuelPayload> {
  const response = await fetch('/api/pvp/duels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId }),
  });
  const payload = await readApiEnvelope<DuelPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to create duel session.');
  }
  return payload.data;
}

export async function updateOnlinePvpDuelSession(
  sessionId: string,
  body: {
    action: PvpDuelPatchAction;
    expectedVersion: number;
    placements?: Record<string, { x: number; y: number }>;
    equippedSpellIds?: string[];
  },
): Promise<DuelPayload> {
  const response = await fetch(`/api/pvp/duels/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await readApiEnvelope<DuelPayload>(response);

  if (response.status === 409 && payload.data?.session) {
    const error = new Error(payload.error || 'Duel session changed. Refresh before continuing.') as Error & {
      session?: PvpDuelSession;
      conflict?: boolean;
    };
    error.session = payload.data.session;
    error.conflict = true;
    throw error;
  }

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to update duel session.');
  }

  return payload.data;
}

export async function postOnlinePvpDuelAction(
  sessionId: string,
  action: SynchronizedBattleAction,
  expectedVersion: number,
): Promise<DuelPayload> {
  const response = await fetch(`/api/pvp/duels/${encodeURIComponent(sessionId)}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, expectedVersion }),
  });
  const payload = await readApiEnvelope<DuelPayload>(response);

  if (response.status === 409 && payload.data?.session) {
    const error = new Error(payload.error || 'Duel session changed. Refresh before acting.') as Error & {
      session?: PvpDuelSession;
      conflict?: boolean;
    };
    error.session = payload.data.session;
    error.conflict = true;
    throw error;
  }

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to stream duel action.');
  }

  return payload.data;
}
