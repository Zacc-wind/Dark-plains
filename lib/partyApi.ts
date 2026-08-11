import {
  gateMultiplayerUnlock,
  gatePartyInviteUnlocks,
  type MultiplayerUnlockGateResult,
} from '@/lib/multiplayerUnlockGate';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';

/** Online party invite/accept persistence is not fully wired yet; unlock gates still run first. */
export function shouldUseOnlinePartySessions(): boolean {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
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
