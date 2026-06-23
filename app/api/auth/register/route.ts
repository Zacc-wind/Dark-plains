import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isValidGameUsername, usernameToAuthEmail } from '@/lib/supabase/username';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!isValidGameUsername(username)) {
    return Response.json(
      { ok: false, error: 'Username must be 3-20 characters (letters, numbers, underscore).' },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return Response.json(
      { ok: false, error: 'Password must be at least 6 characters for online accounts.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json(
      {
        ok: false,
        error: 'Server registration is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the deployment.',
      },
      { status: 503 },
    );
  }

  const email = usernameToAuthEmail(username);

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle();

  if (existingProfile) {
    return Response.json({ ok: false, error: 'Username already taken.' }, { status: 409 });
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (createError) {
    const message = createError.message.toLowerCase();
    if (message.includes('already') || message.includes('exists') || message.includes('registered')) {
      return Response.json({ ok: false, error: 'Username already taken.' }, { status: 409 });
    }

    return Response.json({ ok: false, error: createError.message }, { status: 400 });
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return Response.json(
      { ok: false, error: 'Account created, but sign-in failed. Try logging in.' },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
