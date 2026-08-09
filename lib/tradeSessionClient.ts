import type { ApiEnvelope } from '@/lib/apiResponses';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { TradeOffer, TradeSession } from '@/lib/tradeSessions';
import type { Equipment, InventoryItem } from '@/lib/auth';

export type TradeSessionPatchAction =
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'update_offer'
  | 'set_lock'
  | 'confirm';

export interface TradeParticipantStatePayload {
  username: string;
  gold: number;
  inventory: InventoryItem[];
  equipment: Equipment[];
}

interface TradeSessionListPayload {
  sessions: TradeSession[];
  online: boolean;
}

interface TradeSessionPayload {
  session: TradeSession;
  completed?: boolean;
  duplicate?: boolean;
  participants?: TradeParticipantStatePayload[];
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

/** Client-side gate: live Supabase project is configured. Server still requires admin for writes. */
export function shouldUseOnlineTradeClient(): boolean {
  return isSupabaseConfigured() && process.env.VITEST !== 'true';
}

export async function fetchOnlineTradeSessions(): Promise<TradeSession[]> {
  const response = await fetch('/api/trade/sessions', { cache: 'no-store' });
  const payload = await readApiEnvelope<TradeSessionListPayload>(response);

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to load trade sessions.');
  }

  return payload.data.sessions;
}

export async function createOnlineTradeSession(targetUsername: string): Promise<TradeSession> {
  const response = await fetch('/api/trade/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUsername }),
  });
  const payload = await readApiEnvelope<TradeSessionPayload>(response);

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to create trade session.');
  }

  return payload.data.session;
}

export async function updateOnlineTradeSession(
  sessionId: string,
  body: {
    action: TradeSessionPatchAction;
    expectedVersion: number;
    offer?: Partial<TradeOffer>;
    locked?: boolean;
  },
): Promise<TradeSessionPayload> {
  const response = await fetch(`/api/trade/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await readApiEnvelope<TradeSessionPayload>(response);

  if (response.status === 409 && payload.data?.session) {
    const error = new Error(payload.error || 'Trade changed. Review the latest offers.') as Error & {
      session?: TradeSession;
      conflict?: boolean;
    };
    error.session = payload.data.session;
    error.conflict = true;
    throw error;
  }

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to update trade session.');
  }

  return payload.data;
}
