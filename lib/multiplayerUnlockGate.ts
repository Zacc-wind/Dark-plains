import {
  requireMultiplayerUnlock,
  type MultiplayerFeatureId,
  type MultiplayerLevelSubject,
} from '@/lib/multiplayerUnlocks';

export type MultiplayerUnlockGateResult =
  | { allowed: true }
  | { allowed: false; error: string };

/** Shared unlock check for client mutators and API routes. */
export function gateMultiplayerUnlock(
  featureId: MultiplayerFeatureId,
  subject: MultiplayerLevelSubject,
): MultiplayerUnlockGateResult {
  return requireMultiplayerUnlock(featureId, subject);
}

/** Client-style early return when a feature is still locked. */
export function multiplayerUnlockActionDenied(
  featureId: MultiplayerFeatureId,
  subject: MultiplayerLevelSubject,
): { success: false; error: string } | null {
  const unlock = gateMultiplayerUnlock(featureId, subject);
  if (unlock.allowed) return null;
  return { success: false, error: unlock.error };
}

/** Dual unlock check for party invites (actor + target). */
export function gatePartyInviteUnlocks(
  actor: MultiplayerLevelSubject,
  target: MultiplayerLevelSubject,
  targetUsername: string,
): MultiplayerUnlockGateResult {
  const actorUnlock = gateMultiplayerUnlock('party', actor);
  if (!actorUnlock.allowed) return actorUnlock;

  const targetUnlock = gateMultiplayerUnlock('party', target);
  if (!targetUnlock.allowed) {
    return {
      allowed: false,
      error: `${targetUsername} must reach level 5 before joining a party.`,
    };
  }

  return { allowed: true };
}

/** Standard API 403 envelope when an unlock gate fails. */
export function multiplayerUnlockForbiddenResponse(
  error: string,
  deploymentMode: 'database' | 'local-prototype' = 'database',
): Response {
  return Response.json(
    { ok: false, error, deploymentMode },
    { status: 403 },
  );
}
