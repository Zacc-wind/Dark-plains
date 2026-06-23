import { apiOk } from '@/lib/apiResponses';
import { playerStateRowToUser } from '@/lib/supabase/playerRepository';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({
      ok: false,
      error: 'Supabase is not configured on this deployment.',
      deploymentMode: 'local-prototype',
    }, { status: 501 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
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

export async function PATCH() {
  return Response.json({
    ok: false,
    error: 'Server-side player PATCH is not enabled yet. The client syncs through Supabase directly.',
    deploymentMode: 'database',
  }, { status: 501 });
}
