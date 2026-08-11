import {
  gateMultiplayerUnlock,
  gatePartyInviteUnlocks,
  type MultiplayerUnlockGateResult,
} from '@/lib/multiplayerUnlockGate';
import { shouldUseOnlinePartySessions as shouldUseOnlinePartySessionsDb } from '@/lib/partySessionDb';

/** Online party invite/accept when Supabase admin is configured for server writes. */
export function shouldUseOnlinePartySessions(): boolean {
  return shouldUseOnlinePartySessionsDb();
}

export function evaluatePartyInviteUnlock(
  actorLevel: number,
  targetLevel: number,
  targetUsername: string,
): MultiplayerUnlockGateResult {
  return gatePartyInviteUnlocks(actorLevel, targetLevel, targetUsername);
}

export function evaluatePartyAcceptUnlock(actorLevel: number): MultiplayerUnlockGateResult {
  return gateMultiplayerUnlock('party', actorLevel);
}
