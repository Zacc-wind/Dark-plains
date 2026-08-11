import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import {
  evaluatePartyAcceptUnlock,
  shouldUseOnlinePartySessions,
} from '@/lib/partyApi';
import {
  acceptPartyInviteRow,
  getPartySessionAdminClient,
  loadPartyInvite,
} from '@/lib/partySessionDb';
import { multiplayerUnlockForbiddenResponse } from '@/lib/multiplayerUnlockGate';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function getAuthenticatedUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

async function getPlayerLevel(supabase: SupabaseServerClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('player_states')
    .select('level')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.level) || 1;
}

async function resolveInviteId(
  admin: NonNullable<ReturnType<typeof getPartySessionAdminClient>>,
  userId: string,
  requestId?: string,
): Promise<string | null> {
  if (requestId) return requestId;
  const { data, error } = await admin
    .from('party_invites')
    .select('id')
    .eq('invitee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return apiNotConfigured('Party accept API');
  }

  let body: { requestId?: string } = {};
  try {
    const raw = await request.text();
    if (raw.trim()) {
      body = JSON.parse(raw) as { requestId?: string };
    }
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    const unlock = evaluatePartyAcceptUnlock(await getPlayerLevel(supabase, userId));
    if (!unlock.allowed) {
      return multiplayerUnlockForbiddenResponse(unlock.error);
    }

    if (!shouldUseOnlinePartySessions()) {
      return apiNotConfigured('Online party invite persistence');
    }

    const admin = getPartySessionAdminClient();
    if (!admin) {
      return apiNotConfigured('Online party invite persistence');
    }

    const inviteId = await resolveInviteId(admin, userId, body.requestId?.trim() || undefined);
    if (!inviteId) {
      return Response.json({ ok: false, error: 'No party invite pending.', deploymentMode: 'database' }, { status: 404 });
    }

    const invite = await loadPartyInvite(admin, inviteId);
    if (!invite) {
      return Response.json({
        ok: false,
        error: 'Party invitation expired or was withdrawn.',
        deploymentMode: 'database',
      }, { status: 404 });
    }

    const result = await acceptPartyInviteRow(admin, invite, userId);
    return apiOk({
      partyId: result.partyId,
      inviteId: invite.id,
      memberIds: result.memberIds,
      ...(result.duplicate ? { duplicate: true } : {}),
    }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Party accept failed.';
    const status = /expired|withdrawn|full|already|Only the invited|Leave your current/i.test(message) ? 409 : 500;
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status });
  }
}
