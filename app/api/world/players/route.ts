import { apiOk } from '@/lib/apiResponses';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiOk({ players: [] });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ ok: false, error: 'Not authenticated.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('world_map_players')
    .select('user_id, username, selected_model, x, y, level, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const players = (data || [])
    .filter(row => row.user_id !== user.id)
    .map(row => ({
      userId: row.user_id as string,
      username: row.username as string,
      x: row.x as number,
      y: row.y as number,
      selectedModel: row.selected_model as number,
      level: row.level as number,
    }));

  return apiOk({ players }, { status: 200 }, 'database');
}
