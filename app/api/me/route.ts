import { apiOk } from '@/lib/apiResponses';
import {
  assertManagedAuthAvailable,
  isSupabaseConfigured,
} from '@/lib/supabase/config';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  playerStateRowToUser,
  userToPlayerStateRow,
} from '@/lib/supabase/playerRepository';
import { validatePlayerSyncPayload } from '@/lib/supabase/playerStateSync';
import { getAuthenticatedUser } from '@/lib/supabase/requireAuth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const productionBlock = assertManagedAuthAvailable();
  if (productionBlock) return productionBlock;

  if (!isSupabaseConfigured()) {
    return Response.json({
      ok: false,
      error: 'Supabase is not configured on this deployment.',
      deploymentMode: 'local-prototype',
    }, { status: 501 });
  }

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return Response.json({
      ok: false,
      error: 'Not authenticated.',
      deploymentMode: 'database',
    }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: state, error: stateError }] = await Promise.all([
    supabase.from('profiles').select('id, username, selected_model').eq('id', user.id).maybeSingle(),
    supabase.from('player_states').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  if (profileError || stateError) {
    return Response.json({
      ok: false,
      error: profileError?.message || stateError?.message || 'Failed to load player state.',
      deploymentMode: 'database',
    }, { status: 500 });
  }

  if (!profile || !state) {
    return Response.json({
      ok: false,
      error: 'Player profile or save row is missing. Run the Supabase schema migration.',
      deploymentMode: 'database',
    }, { status: 404 });
  }

  return apiOk({
    userId: user.id,
    username: profile.username,
    player: playerStateRowToUser(state, profile),
  }, undefined, 'database');
}

/**
 * First server-authority slice for player_states writes.
 * Clients still fall back to direct Supabase upsert when this returns 501/503.
 * Do not revoke authenticated UPDATE/INSERT on player_states until this path is trusted.
 */
export async function PATCH(request: Request) {
  const productionBlock = assertManagedAuthAvailable();
  if (productionBlock) return productionBlock;

  if (!isSupabaseConfigured()) {
    return Response.json({
      ok: false,
      error: 'Supabase is not configured on this deployment.',
      deploymentMode: 'local-prototype',
    }, { status: 501 });
  }

  const supabase = await createClient();
  const authUser = await getAuthenticatedUser(supabase);

  if (!authUser) {
    return Response.json({
      ok: false,
      error: 'Not authenticated.',
      deploymentMode: 'database',
    }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const { data: profile, error: profileReadError } = await supabase
    .from('profiles')
    .select('id, username, selected_model')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileReadError) {
    return Response.json({
      ok: false,
      error: profileReadError.message || 'Failed to load profile.',
      deploymentMode: 'database',
    }, { status: 500 });
  }

  if (!profile) {
    return Response.json({
      ok: false,
      error: 'Player profile is missing. Run the Supabase schema migration.',
      deploymentMode: 'database',
    }, { status: 404 });
  }

  const validated = validatePlayerSyncPayload(body, {
    authUserId: authUser.id,
    profileUsername: profile.username,
  });

  if (!validated.ok) {
    return Response.json({
      ok: false,
      error: validated.error,
      deploymentMode: 'database',
    }, { status: 400 });
  }

  const writer = createAdminClient() ?? supabase;
  const row = userToPlayerStateRow(validated.player, authUser.id);

  const { data: existingState, error: existingError } = await writer
    .from('player_states')
    .select('game_sessions')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (existingError) {
    return Response.json({
      ok: false,
      error: existingError.message || 'Failed to read existing player state.',
      deploymentMode: 'database',
    }, { status: 500 });
  }

  row.game_sessions = {
    ...((existingState?.game_sessions as Record<string, unknown> | null) || {}),
    ...row.game_sessions,
  };

  const selectedModel = Number.isFinite(validated.player.selectedModel)
    ? Math.floor(validated.player.selectedModel)
    : profile.selected_model;

  const { error: profileError } = await writer
    .from('profiles')
    .update({
      selected_model: selectedModel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', authUser.id);

  if (profileError) {
    return Response.json({
      ok: false,
      error: profileError.message || 'Failed to update profile.',
      deploymentMode: 'database',
    }, { status: 500 });
  }

  const { error: stateError } = await writer
    .from('player_states')
    .upsert(row, { onConflict: 'user_id' });

  if (stateError) {
    return Response.json({
      ok: false,
      error: stateError.message || 'Failed to save player state.',
      deploymentMode: 'database',
    }, { status: 500 });
  }

  return apiOk({
    userId: authUser.id,
    username: profile.username,
    updatedAt: row.updated_at,
  }, undefined, 'database');
}
