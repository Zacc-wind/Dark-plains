import type { ApiEnvelope } from '@/lib/apiResponses';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export interface PartyInviteActionPayload {
  partyId: string;
  inviteId?: string;
  memberIds?: string[];
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

/** Client-side gate: live Supabase project is configured. Server still requires admin for writes. */
export function shouldUseOnlinePartyClient(): boolean {
  return isSupabaseConfigured() && process.env.VITEST !== 'true';
}

export async function createOnlinePartyInvite(targetUsername: string): Promise<PartyInviteActionPayload> {
  const response = await fetch('/api/party/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUsername }),
  });
  const payload = await readApiEnvelope<PartyInviteActionPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to send party invite.');
  }
  return payload.data;
}

export async function acceptOnlinePartyInvite(requestId?: string): Promise<PartyInviteActionPayload> {
  const response = await fetch('/api/party/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestId ? { requestId } : {}),
  });
  const payload = await readApiEnvelope<PartyInviteActionPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to accept party invite.');
  }
  return payload.data;
}

export async function declineOnlinePartyInvite(requestId?: string): Promise<PartyInviteActionPayload> {
  const response = await fetch('/api/party/decline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestId ? { requestId } : {}),
  });
  const payload = await readApiEnvelope<PartyInviteActionPayload>(response);
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to decline party invite.');
  }
  return payload.data;
}
