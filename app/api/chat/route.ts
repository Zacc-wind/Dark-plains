import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_CHAT_HISTORY = 50;
const MAX_CHAT_LENGTH = 180;

interface ChatMessageRow {
  id: string;
  channel: string;
  user_id: string;
  body: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string;
}

function toClientMessage(row: ChatMessageRow, usernames: Map<string, string>) {
  return {
    id: row.id,
    channel: 'global' as const,
    author: usernames.get(row.user_id) || 'Unknown commander',
    text: row.body,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ ok: false, error: 'Shared chat is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ ok: false, error: 'Not authenticated.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, channel, user_id, body, created_at')
    .eq('channel', 'global')
    .is('party_id', null)
    .order('created_at', { ascending: false })
    .limit(MAX_CHAT_HISTORY);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data || []) as ChatMessageRow[];
  const userIds = Array.from(new Set(rows.map(row => row.user_id)));
  const usernames = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);

    if (profileError) {
      return Response.json({ ok: false, error: profileError.message }, { status: 500 });
    }

    ((profiles || []) as ProfileRow[]).forEach(profile => usernames.set(profile.id, profile.username));
  }

  return Response.json({
    ok: true,
    messages: rows.reverse().map(row => toClientMessage(row, usernames)),
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json({ ok: false, error: 'Shared chat is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ ok: false, error: 'Not authenticated.' }, { status: 401 });
  }

  let payload: { text?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, MAX_CHAT_LENGTH) : '';
  if (!text) {
    return Response.json({ ok: false, error: 'Enter a message.' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return Response.json({ ok: false, error: profileError?.message || 'Profile not found.' }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('chat_messages')
    .insert({ channel: 'global', party_id: null, user_id: user.id, body: text })
    .select('id, channel, user_id, body, created_at')
    .single();

  if (insertError || !inserted) {
    return Response.json({ ok: false, error: insertError?.message || 'Message failed.' }, { status: 500 });
  }

  const row = inserted as ChatMessageRow;
  return Response.json({
    ok: true,
    message: {
      ...toClientMessage(row, new Map([[user.id, String(profile.username || 'Commander')]])),
    },
  }, { status: 201 });
}
