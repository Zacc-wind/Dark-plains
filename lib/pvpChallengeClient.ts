'use client';

import type { ApiEnvelope } from '@/lib/apiResponses';
import type { BattleChallenge } from '@/lib/battle';
import { isSupabaseConfigured } from '@/lib/supabase/config';

interface ChallengeListPayload {
  challenges: BattleChallenge[];
}

interface ChallengePayload {
  challenge: BattleChallenge;
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

export function shouldUseOnlineChallenges(): boolean {
  return isSupabaseConfigured();
}

export async function fetchOnlineBattleChallenges(): Promise<BattleChallenge[]> {
  const response = await fetch('/api/pvp/challenges', { cache: 'no-store' });
  const payload = await readApiEnvelope<ChallengeListPayload>(response);

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to load challenges.');
  }

  return payload.data.challenges;
}

export async function createOnlineBattleChallenge(targetUsername: string): Promise<BattleChallenge> {
  const response = await fetch('/api/pvp/challenges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUsername }),
  });
  const payload = await readApiEnvelope<ChallengePayload>(response);

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to create challenge.');
  }

  return payload.data.challenge;
}

export async function updateOnlineBattleChallenge(
  challengeId: string,
  action: 'confirm' | 'accept' | 'decline' | 'cancel',
): Promise<BattleChallenge> {
  const response = await fetch(`/api/pvp/challenges/${encodeURIComponent(challengeId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const payload = await readApiEnvelope<ChallengePayload>(response);

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Failed to update challenge.');
  }

  return payload.data.challenge;
}
