'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  isManagedAuthUnavailable,
  isSupabaseAuthEnabled,
  updatePasswordWithRecoverySession,
} from '@/lib/supabase/auth';
import { MANAGED_AUTH_UNAVAILABLE_MESSAGE } from '@/lib/supabase/config';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const unavailable = isManagedAuthUnavailable();
  const onlineAuth = isSupabaseAuthEnabled();

  useEffect(() => {
    if (!onlineAuth || unavailable) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const markReady = () => {
      if (!cancelled) {
        setReady(true);
        setChecking(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
      else if (!cancelled) setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        markReady();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [onlineAuth, unavailable]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await updatePasswordWithRecoverySession(password);
      if (!result.success) {
        setError(result.error || 'Could not update password.');
        return;
      }
      setSuccess('Password updated. You can log in with your new password.');
      setTimeout(() => router.push('/'), 1200);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-shell fantasy-ui flex min-h-screen items-center justify-center bg-[#05080a] p-4">
      <div className="auth-card command-panel vine-frame relative z-[100] w-full max-w-md rounded border p-8">
        <div className="mb-8 text-center">
          <p className="arcane-label mb-2">Account</p>
          <h1 className="auth-title fantasy-heading text-center">Reset password</h1>
        </div>

        {unavailable ? (
          <p className="ui-faint text-center text-[12px] font-bold leading-relaxed">
            {MANAGED_AUTH_UNAVAILABLE_MESSAGE}
          </p>
        ) : !onlineAuth ? (
          <p className="ui-faint text-center text-[12px] font-bold leading-relaxed">
            Password recovery is only available with Supabase Auth configured.
          </p>
        ) : checking ? (
          <p className="ui-faint text-center text-[12px] font-bold">Checking recovery session…</p>
        ) : !ready ? (
          <div className="space-y-4 text-center">
            <p className="ui-faint text-[12px] font-bold leading-relaxed">
              Open the link from your password reset email to continue. If the link expired, request a new one from the login page.
            </p>
            <Link href="/?forgot=1" className="font-bold text-[var(--ui-accent)] underline hover:text-white">
              Request a new reset email
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="arcane-label mb-2 block">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ui-card w-full rounded-lg border px-4 py-3 font-semibold text-[var(--ui-text)] outline-none transition-all focus:border-[var(--ui-border-strong)]"
                placeholder="At least 6 characters"
                required
                minLength={6}
                disabled={submitting}
              />
            </div>
            <div>
              <label className="arcane-label mb-2 block">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="ui-card w-full rounded-lg border px-4 py-3 font-semibold text-[var(--ui-text)] outline-none transition-all focus:border-[var(--ui-border-strong)]"
                placeholder="Confirm new password"
                required
                minLength={6}
                disabled={submitting}
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-semibold text-red-300">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-200">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="ui-button-primary w-full rounded-lg px-6 py-4 font-semibold transition-all disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="font-bold text-[var(--ui-accent)] underline hover:text-white">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
