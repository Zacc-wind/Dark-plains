import type { ApiEnvelope } from '@/lib/apiResponses';
import type { SynchronizedBattleAction } from '@/lib/battle';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { CoopRaidSession } from '@/lib/coopRaidSessions';

export type CoopRaidPatchAction = 'confirm_formation' | 'abandon' | 'settle';

interface RaidListPayload {
  sessions: CoopRaidSession[];
  online: boolean;
}

interface RaidPayload {
  session: CoopRaidSession;
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

export function shouldUseOnlineCoopRaidClient(): boolean {
  return isSupabaseConfigured() && process.env.VITEST !== 'true';
}

export async function fetchOnlineCoopRaidSessions(): Promise<CoopRaidSession[]> {
  const response = await fetch('/api/coop/raids', { cache: 'no-store' });
  const payload = await readApiEnvelope<RaidListPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to load raid sessions.');
  }
  return payload.data.sessions;
}

export async function createOnlineCoopRaidSession(
  bossId: string,
  allyUsername: string,
): Promise<RaidPayload> {
  const response = await fetch('/api/coop/raids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bossId, allyUsername }),
  });
  const payload = await readApiEnvelope<RaidPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to create raid session.');
  }
  return payload.data;
}

export async function updateOnlineCoopRaidSession(
  sessionId: string,
  body: {
    action: CoopRaidPatchAction;
    expectedVersion: number;
    placements?: Record<string, { x: number; y: number }>;
    equippedSpellIds?: string[];
    equipmentName?: string;
  },
): Promise<RaidPayload> {
  const response = await fetch(`/api/coop/raids/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await readApiEnvelope<RaidPayload>(response);

  if (response.status === 409 && payload.data?.session) {
    const error = new Error(payload.error || 'Raid session changed. Refresh before continuing.') as Error & {
      session?: CoopRaidSession;
      conflict?: boolean;
    };
    error.session = payload.data.session;
    error.conflict = true;
    throw error;
  }

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to update raid session.');
  }

  return payload.data;
}

export async function postOnlineCoopRaidAction(
  sessionId: string,
  action: SynchronizedBattleAction,
  expectedVersion: number,
): Promise<RaidPayload> {
  const response = await fetch(`/api/coop/raids/${encodeURIComponent(sessionId)}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, expectedVersion }),
  });
  const payload = await readApiEnvelope<RaidPayload>(response);

  if (response.status === 409 && payload.data?.session) {
    const error = new Error(payload.error || 'Raid session changed. Refresh before acting.') as Error & {
      session?: CoopRaidSession;
      conflict?: boolean;
    };
    error.session = payload.data.session;
    error.conflict = true;
    throw error;
  }

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to stream raid action.');
  }

  return payload.data;
}
