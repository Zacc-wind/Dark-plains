import { createAdminClient } from '@/lib/supabase/admin';
import {
  assertManagedAuthAvailable,
  isSupabaseConfigured,
} from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { isValidGameUsername, usernameToAuthEmail } from '@/lib/supabase/username';

export const dynamic = 'force-dynamic';

const GENERIC_SUCCESS =
  'If an account matches, a password reset email was sent. Check your inbox and spam folder.';

function getRecoveryRedirectUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  const origin = configured || new URL(request.url).origin;
  return `${origin}/reset-password`;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Resolve the Auth email for resetPasswordForEmail.
 * profiles has no email column today — username accounts use synthetic emails
 * (`usernameToAuthEmail`). Prefer an explicit email when provided.
 */
async function resolveAuthEmail(input: {
  email?: string;
  username?: string;
}): Promise<{ email: string } | { error: string; status: number }> {
  const email = String(input.email || '').trim();
  const username = String(input.username || '').trim();

  if (email) {
    if (!looksLikeEmail(email)) {
      return { error: 'Enter a valid email address.', status: 400 };
    }
    return { email: email.toLowerCase() };
  }

  if (!username) {
    return { error: 'Provide an email or username.', status: 400 };
  }

  if (!isValidGameUsername(username)) {
    return {
      error: 'Username must be 3-20 characters (letters, numbers, underscore).',
      status: 400,
    };
  }

  const admin = createAdminClient();
  if (admin) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (profile?.id) {
      const { data: authUser, error } = await admin.auth.admin.getUserById(profile.id);
      if (!error && authUser.user?.email) {
        return { email: authUser.user.email };
      }
    }
  }

  // No profiles.email column; map username → synthetic Auth email (same as login/register).
  return { email: usernameToAuthEmail(username) };
}

export async function POST(request: Request) {
  const productionBlock = assertManagedAuthAvailable();
  if (productionBlock) return productionBlock;

  if (!isSupabaseConfigured()) {
    return Response.json(
      {
        ok: false,
        error: 'Password recovery requires Supabase Auth. Configure online keys first.',
        deploymentMode: 'local-prototype',
      },
      { status: 501 },
    );
  }

  let body: { email?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const resolved = await resolveAuthEmail(body);
  if ('error' in resolved) {
    return Response.json({ ok: false, error: resolved.error }, { status: resolved.status });
  }

  const supabase = await createClient();
  const redirectTo = getRecoveryRedirectUrl(request);
  const { error } = await supabase.auth.resetPasswordForEmail(resolved.email, { redirectTo });

  if (error) {
    // Avoid leaking whether the account exists; still surface hard config failures.
    const message = error.message.toLowerCase();
    if (message.includes('redirect') || message.includes('url')) {
      return Response.json(
        {
          ok: false,
          error: `Password reset redirect is not allowed. Add ${redirectTo} to Supabase Auth redirect URLs.`,
        },
        { status: 400 },
      );
    }

    return Response.json({ ok: true, message: GENERIC_SUCCESS, deploymentMode: 'database' });
  }

  return Response.json({ ok: true, message: GENERIC_SUCCESS, deploymentMode: 'database' });
}
