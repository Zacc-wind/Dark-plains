import type { ApiEnvelope } from '@/lib/apiResponses';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { CoopDungeonSession } from '@/lib/coopDungeonSessions';

export type CoopDungeonPatchAction = 'advance' | 'abandon' | 'start_chamber';

interface DungeonListPayload {
  sessions: CoopDungeonSession[];
  online: boolean;
}

interface DungeonPayload {
  session: CoopDungeonSession;
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

export function shouldUseOnlineCoopDungeonClient(): boolean {
  return isSupabaseConfigured() && process.env.VITEST !== 'true';
}

export async function fetchOnlineCoopDungeonSessions(): Promise<CoopDungeonSession[]> {
  const response = await fetch('/api/coop/dungeons', { cache: 'no-store' });
  const payload = await readApiEnvelope<DungeonListPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to load dungeon sessions.');
  }
  return payload.data.sessions;
}

export async function createOnlineCoopDungeonSession(
  dungeonId: string | undefined,
  allyUsername: string,
): Promise<DungeonPayload> {
  const response = await fetch('/api/coop/dungeons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(dungeonId ? { dungeonId } : {}),
      allyUsername,
    }),
  });
  const payload = await readApiEnvelope<DungeonPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to create dungeon session.');
  }
  return payload.data;
}

export async function updateOnlineCoopDungeonSession(
  sessionId: string,
  body: {
    action: CoopDungeonPatchAction;
    expectedVersion: number;
  },
): Promise<DungeonPayload> {
  const response = await fetch(`/api/coop/dungeons/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await readApiEnvelope<DungeonPayload>(response);

  if (response.status === 409 && payload.data?.session) {
    const error = new Error(payload.error || 'Dungeon session changed. Refresh before continuing.') as Error & {
      session?: CoopDungeonSession;
      conflict?: boolean;
    };
    error.session = payload.data.session;
    error.conflict = true;
    throw error;
  }

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to update dungeon session.');
  }

  return payload.data;
}
