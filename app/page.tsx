'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { login, register } from '@/lib/auth';
import { authorizeBackgroundMusic } from '@/lib/backgroundMusic';
import { emitFxEvent } from '@/lib/fxEvents';
import {
  isSupabaseAuthEnabled,
  loginWithSupabase,
  registerWithSupabase,
} from '@/lib/supabase/auth';
import ThreeFxOverlay from '@/components/ThreeFxOverlay';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const onlineAuth = isSupabaseAuthEnabled();

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
          <p className="arcane-label mb-2">Enter the road</p>
          <h1 className="auth-title fantasy-heading text-center">Dark Plains</h1>
        </div>
        {!isLogin ? (
          <p className="arcane-label mb-6 text-center">Create your account</p>
        ) : null}
        {!onlineAuth ? (
          <p className="ui-faint mb-6 text-center text-[11px] font-bold">
            Local prototype — saves stay in this browser only.
          </p>
        ) : null}

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

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
              setPassword('');
            }}
            className="font-bold text-[var(--ui-accent)] underline hover:text-white"
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </button>
        </div>

        <section className="auth-feedback mt-8 border-t border-[rgba(250,239,211,0.14)] pt-6 text-center style={{position: 'absolute',bottom: '20vh',left: '60vh',width: '16vh'}}">
          <p className="arcane-label mb-1">Share your feedback</p>
          <p className="ui-faint mb-4 text-[11px] font-bold">
            Scan the code and tell us what you think while you play.
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
