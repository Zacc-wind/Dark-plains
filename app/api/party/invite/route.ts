import { apiNotConfigured } from '@/lib/apiResponses';
import {
  evaluatePartyInviteUnlock,
  shouldUseOnlinePartySessions,
} from '@/lib/partyApi';
import { multiplayerUnlockForbiddenResponse } from '@/lib/multiplayerUnlockGate';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface ProfileRow {
  id: string;
  username: string;
}

async function getAuthenticatedUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

async function getProfileById(supabase: SupabaseServerClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

async function getProfileByUsername(supabase: SupabaseServerClient, username: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', username)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
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
    return apiNotConfigured('Party invite API');
  }

  let body: { targetUsername?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const targetUsername = String(body.targetUsername || '').trim();
  if (!targetUsername) {
    return Response.json({ ok: false, error: 'Target username is required.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    const [actorProfile, targetProfile] = await Promise.all([
      getProfileById(supabase, userId),
      getProfileByUsername(supabase, targetUsername),
    ]);

    if (!actorProfile) {
      return Response.json({ ok: false, error: 'Your profile is missing.', deploymentMode: 'database' }, { status: 404 });
    }
    if (!targetProfile) {
      return Response.json({ ok: false, error: 'Target player was not found.', deploymentMode: 'database' }, { status: 404 });
    }
    if (targetProfile.id === userId) {
      return Response.json({ ok: false, error: 'You cannot invite yourself.', deploymentMode: 'database' }, { status: 400 });
    }

    const [actorLevel, targetLevel] = await Promise.all([
      getPlayerLevel(supabase, userId),
      getPlayerLevel(supabase, targetProfile.id),
    ]);
    const unlock = evaluatePartyInviteUnlock(actorLevel, targetLevel, targetProfile.username);
    if (!unlock.allowed) {
      return multiplayerUnlockForbiddenResponse(unlock.error);
    }

    if (!shouldUseOnlinePartySessions()) {
      return apiNotConfigured('Online party invite persistence');
    }

    // Parties / party_members tables exist, but invite request rows and client sync are not wired yet.
    return apiNotConfigured('Online party invite persistence');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Party invite failed.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
