'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, register } from '@/lib/auth';
import { authorizeBackgroundMusic } from '@/lib/backgroundMusic';
import { emitFxEvent } from '@/lib/fxEvents';
import {
  isManagedAuthUnavailable,
  isSupabaseAuthEnabled,
  loginWithSupabase,
  registerWithSupabase,
  requestPasswordReset,
} from '@/lib/supabase/auth';
import { MANAGED_AUTH_UNAVAILABLE_MESSAGE } from '@/lib/supabase/config';
import ThreeFxOverlay from '@/components/ThreeFxOverlay';

function AuthPageContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const onlineAuth = isSupabaseAuthEnabled();
  const authUnavailable = isManagedAuthUnavailable();

  useEffect(() => {
    if (searchParams.get('forgot') === '1' && onlineAuth && !authUnavailable) {
      setShowForgot(true);
      setIsLogin(true);
    }
  }, [searchParams, onlineAuth, authUnavailable]);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const trimmed = username.trim();
      const identifier = trimmed.includes('@')
        ? { email: trimmed }
        : { username: trimmed };
      const result = await requestPasswordReset(identifier);
      if (result.success) {
        setSuccess(result.message || 'If an account matches, a reset email was sent.');
        emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
      } else {
        setError(result.error || 'Password reset failed');
        emitFxEvent({ type: 'status', tone: 'red', intensity: 0.42 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (isLogin) {
        const result = onlineAuth
          ? await loginWithSupabase(username, password)
          : login(username, password);

        if (result.success) {
          authorizeBackgroundMusic();
          emitFxEvent({ type: 'spell', tone: 'violet', intensity: 0.7 });
          router.push('/mode');
        } else {
          setError(result.error || 'Login failed');
          emitFxEvent({ type: 'status', tone: 'red', intensity: 0.42 });
        }
      } else {
        const result = onlineAuth
          ? await registerWithSupabase(username, password)
          : register(username, password);

        if (result.success) {
          emitFxEvent({ type: 'recruit', tone: 'green', intensity: 0.72 });

          if (onlineAuth && 'needsEmailConfirmation' in result && result.needsEmailConfirmation) {
            setIsLogin(true);
            setPassword('');
            setSuccess('Account created. Check your email to confirm, then log in.');
            return;
          }

          if (onlineAuth) {
            authorizeBackgroundMusic();
            router.push('/mode');
            return;
          }

          setError('');
          setIsLogin(true);
          setPassword('');
          setSuccess('Account created. Please log in.');
        } else {
          setError(result.error || 'Registration failed');
          emitFxEvent({ type: 'status', tone: 'red', intensity: 0.42 });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-shell fantasy-ui flex min-h-screen items-center justify-center bg-[#05080a] p-4">
      <ThreeFxOverlay />
      <div className="auth-card command-panel vine-frame relative z-[100] w-full max-w-md rounded border p-8">
        <div className="mb-8 text-center">
          <p className="arcane-label mb-2">Helo</p>
          <h1 className="auth-title fantasy-heading text-center">Dark Plains</h1>
        </div>

        {authUnavailable ? (
          <div className="space-y-4 text-center">
            <p className="arcane-label">Auth unavailable</p>
            <p className="ui-faint text-[12px] font-bold leading-relaxed">
              {MANAGED_AUTH_UNAVAILABLE_MESSAGE}
            </p>
            <p className="ui-faint text-[11px] font-bold leading-relaxed">
              Local prototype login is disabled on this production host so browser passwords cannot be mistaken for live accounts.
            </p>
          </div>
        ) : (
          <>
            {!isLogin && !showForgot ? (
              <p className="arcane-label mb-6 text-center">Create your account</p>
            ) : null}
            {showForgot ? (
              <p className="arcane-label mb-6 text-center">Forgot password</p>
            ) : null}
            {onlineAuth ? (
              <p className="ui-faint mb-6 text-center text-[11px] font-bold">
                Online account — Supabase Auth session.
              </p>
            ) : (
              <p className="ui-faint mb-6 text-center text-[11px] font-bold">
                Local prototype — saves stay in this browser only.
              </p>
            )}

            {showForgot && onlineAuth ? (
              <form onSubmit={handleForgotSubmit} className="space-y-6">
                <div>
                  <label className="arcane-label mb-2 block">Username or email</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="ui-card w-full rounded-lg border px-4 py-3 font-semibold text-[var(--ui-text)] outline-none transition-all focus:border-[var(--ui-border-strong)]"
                    style={{ imageRendering: 'pixelated' }}
                    placeholder="Enter username or email"
                    required
                    disabled={submitting}
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-semibold text-red-300">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-200">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="ui-button-primary w-full rounded-lg px-6 py-4 font-semibold transition-all disabled:opacity-60"
                >
                  {submitting ? 'Please wait…' : 'Send reset email'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="arcane-label mb-2 block">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="ui-card w-full rounded-lg border px-4 py-3 font-semibold text-[var(--ui-text)] outline-none transition-all focus:border-[var(--ui-border-strong)]"
                    style={{ imageRendering: 'pixelated' }}
                    placeholder="Enter username"
                    required
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="arcane-label mb-2 block">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="ui-card w-full rounded-lg border px-4 py-3 font-semibold text-[var(--ui-text)] outline-none transition-all focus:border-[var(--ui-border-strong)]"
                    style={{ imageRendering: 'pixelated' }}
                    placeholder="Enter password"
                    required
                    disabled={submitting}
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-semibold text-red-300">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-200">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="ui-button-primary w-full rounded-lg px-6 py-4 font-semibold transition-all disabled:opacity-60"
                >
                  {submitting ? 'Please wait…' : isLogin ? 'Login' : 'Register'}
                </button>
              </form>
            )}

            <div className="mt-6 space-y-3 text-center">
              {onlineAuth && isLogin && !showForgot ? (
                <button
                  type="button"
                  onClick={() => {
                    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
                    setShowForgot(true);
                    setError('');
                    setSuccess('');
                    setPassword('');
                  }}
                  className="block w-full font-bold text-[var(--ui-accent)] underline hover:text-white"
                >
                  Forgot password?
                </button>
              ) : null}

              {showForgot ? (
                <button
                  type="button"
                  onClick={() => {
                    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
                    setShowForgot(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="font-bold text-[var(--ui-accent)] underline hover:text-white"
                >
                  Back to login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
                    setIsLogin(!isLogin);
                    setShowForgot(false);
                    setError('');
                    setSuccess('');
                    setPassword('');
                  }}
                  className="font-bold text-[var(--ui-accent)] underline hover:text-white"
                >
                  {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
                </button>
              )}
            </div>
          </>
        )}

        <section className="auth-feedback mt-8 border-t border-[rgba(250,239,211,0.14)] pt-6 text-center "
        style={{ position: "absolute", bottom: "20vh", left: "60vh", width: "16vh" }}
        >
          <p className="arcane-label mb-1">Share your feedback</p>
          <p className="ui-faint mb-4 text-[11px] font-bold">
            Just gimme feedback on discord.
          </p>
          <div className="auth-feedback-qr mx-auto w-fit rounded-lg border border-[rgba(250,239,211,0.22)] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <Image
              src="/assets/qrcode.png"
              alt="QR code to submit feedback"
              width={152}
              height={152}
              className="h-auto w-[152px]"
              unoptimized
            />
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="auth-page-shell fantasy-ui flex min-h-screen items-center justify-center bg-[#05080a] p-4">
        <p className="ui-faint text-[12px] font-bold">Loading…</p>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
