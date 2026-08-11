import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import { shouldUseOnlinePartySessions } from '@/lib/partyApi';
import {
  declinePartyInviteRow,
  getPartySessionAdminClient,
  loadPartyInvite,
} from '@/lib/partySessionDb';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function getAuthenticatedUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
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
    return apiNotConfigured('Party decline API');
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

  if (!shouldUseOnlinePartySessions()) {
    return apiNotConfigured('Online party invite persistence');
  }

  const admin = getPartySessionAdminClient();
  if (!admin) {
    return apiNotConfigured('Online party invite persistence');
  }

  try {
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

    const result = await declinePartyInviteRow(admin, invite, userId);
    return apiOk({
      partyId: result.partyId,
      inviteId: invite.id,
      ...(result.duplicate ? { duplicate: true } : {}),
    }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Party decline failed.';
    const status = /expired|withdrawn|already|Only the invited/i.test(message) ? 409 : 500;
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status });
  }
}
