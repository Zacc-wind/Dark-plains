import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import { createTradeSession } from '@/lib/tradeSessions';
import { multiplayerUnlockForbiddenResponse } from '@/lib/multiplayerUnlockGate';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthenticatedUserId } from '@/lib/supabase/requireAuth';
import { createClient } from '@/lib/supabase/server';
import {
  getTradeSessionAdminClient,
  shouldUseOnlineTradeSessions,
  tradeSessionFromDbRow,
  tradeSessionToDbPayload,
  type TradeSessionDbRow,
} from '@/lib/tradeSessionDb';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface ProfileRow {
  id: string;
  username: string;
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

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiNotConfigured('Trade session API');
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('trade_sessions')
    .select('*')
    .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ ok: false, error: error.message, deploymentMode: 'database' }, { status: 500 });
  }

  const rows = (data || []) as TradeSessionDbRow[];
  const profileIds = Array.from(new Set(rows.flatMap(row => [row.initiator_id, row.recipient_id])));
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', profileIds.length > 0 ? profileIds : ['00000000-0000-0000-0000-000000000000']);

  if (profileError) {
    return Response.json({ ok: false, error: profileError.message, deploymentMode: 'database' }, { status: 500 });
  }

  const usernameById = new Map((profiles as ProfileRow[] | null || []).map(profile => [profile.id, profile.username]));
  const sessions = rows
    .map(row => {
      const initiatorUsername = usernameById.get(row.initiator_id);
      const receiverUsername = usernameById.get(row.recipient_id);
      if (!initiatorUsername || !receiverUsername) return null;
      return tradeSessionFromDbRow(row, initiatorUsername, receiverUsername);
    })
    .filter((session): session is NonNullable<typeof session> => Boolean(session));

  return apiOk({ sessions, online: shouldUseOnlineTradeSessions() }, undefined, 'database');
}

export async function POST(request: Request) {
  if (!shouldUseOnlineTradeSessions()) {
    return apiNotConfigured('Trade session API');
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
  const admin = getTradeSessionAdminClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId || !admin) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    const [initiatorProfile, targetProfile] = await Promise.all([
      getProfileById(supabase, userId),
      getProfileByUsername(supabase, targetUsername),
    ]);

    if (!initiatorProfile) {
      return Response.json({ ok: false, error: 'Your profile is missing.', deploymentMode: 'database' }, { status: 404 });
    }
    if (!targetProfile) {
      return Response.json({ ok: false, error: 'Target player was not found.', deploymentMode: 'database' }, { status: 404 });
    }
    if (targetProfile.id === userId) {
      return Response.json({ ok: false, error: 'You cannot trade with yourself.', deploymentMode: 'database' }, { status: 400 });
    }

    const [initiatorLevel, targetLevel] = await Promise.all([
      getPlayerLevel(supabase, userId),
      getPlayerLevel(supabase, targetProfile.id),
    ]);
    const initiatorUnlock = requireMultiplayerUnlock('trading', initiatorLevel);
    if (!initiatorUnlock.allowed) {
      return multiplayerUnlockForbiddenResponse(initiatorUnlock.error);
    }
    const targetUnlock = requireMultiplayerUnlock('trading', targetLevel);
    if (!targetUnlock.allowed) {
      return multiplayerUnlockForbiddenResponse(
        `${targetProfile.username} must unlock trade before accepting offers.`,
      );
    }

    const { data: openRows, error: openError } = await admin
      .from('trade_sessions')
      .select('id, initiator_id, recipient_id, status, expires_at')
      .or(`initiator_id.eq.${userId},recipient_id.eq.${userId},initiator_id.eq.${targetProfile.id},recipient_id.eq.${targetProfile.id}`)
      .in('status', ['offered', 'negotiating', 'locked'])
      .limit(20);
    if (openError) throw openError;

    const nowMs = Date.now();
    const blocking = (openRows || []).find(candidate => {
      const expiresAt = new Date(candidate.expires_at).getTime();
      if (Number.isFinite(expiresAt) && expiresAt <= nowMs) return false;
      return true;
    });
    if (blocking) {
      const involvesSelf = blocking.initiator_id === userId || blocking.recipient_id === userId;
      return Response.json({
        ok: false,
        error: involvesSelf
          ? 'Finish or cancel your current trade first.'
          : `${targetProfile.username} is already handling another trade.`,
        deploymentMode: 'database',
      }, { status: 409 });
    }

    const session = createTradeSession(initiatorProfile.username, targetProfile.username);
    const payload = {
      ...tradeSessionToDbPayload(session, initiatorProfile.id, targetProfile.id),
      created_at: new Date(session.createdAt).toISOString(),
      updated_at: new Date(session.updatedAt).toISOString(),
    };

    const { data: inserted, error: insertError } = await admin
      .from('trade_sessions')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) throw insertError;

    const created = tradeSessionFromDbRow(
      inserted as TradeSessionDbRow,
      initiatorProfile.username,
      targetProfile.username,
    );
    return apiOk({ session: created }, { status: 201 }, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create trade session.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
