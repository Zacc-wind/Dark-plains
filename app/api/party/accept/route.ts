import { apiNotConfigured } from '@/lib/apiResponses';
import {
  evaluatePartyAcceptUnlock,
  shouldUseOnlinePartySessions,
} from '@/lib/partyApi';
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

    void body.requestId;
    // Parties / party_members tables exist, but invite acceptance sync is not wired yet.
    return apiNotConfigured('Online party invite persistence');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Party accept failed.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
