'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
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
import LoadingScreen from '@/components/ui/LoadingScreen';

const ThreeFxOverlay = dynamic(() => import('@/components/ThreeFxOverlay'), { ssr: false });

const HERO_POINTS = [
  'Command a warband on a shared, living coast',
  'Solo roguelike roads with lasting upgrades',
  'Formation combat where the commander must stand',
];

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

  const switchTab = (toLogin: boolean) => {
    if (toLogin === isLogin && !showForgot) return;
    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
    setIsLogin(toLogin);
    setShowForgot(false);
    setError('');
    setSuccess('');
    setPassword('');
  };

  const openForgot = () => {
    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
    setShowForgot(true);
    setError('');
    setSuccess('');
    setPassword('');
  };

  const closeForgot = () => {
    emitFxEvent({ type: 'interface', tone: 'bone', intensity: 0.36 });
    setShowForgot(false);
    setError('');
    setSuccess('');
  };

  const feedback = (
    <>
      {error && <div className="dp-alert dp-alert-danger" role="alert">{error}</div>}
      {success && <div className="dp-alert dp-alert-success" role="status">{success}</div>}
    </>
  );

  return (
    <div className="dp-screen dp-auth fantasy-ui">
      <Image
        src="/assets/loginscreenbackgorund.png"
        alt=""
        fill
        priority
        className="dp-screen-bg object-cover object-center"
        sizes="100vw"
        quality={70}
      />
      <div className="dp-screen-vignette" aria-hidden="true" />
      <ThreeFxOverlay />

      <main className="dp-auth-layout">
        <section className="dp-auth-hero">
          <p className="arcane-label">A dark fantasy strategy RPG</p>
          <h1 className="fantasy-heading dp-auth-title">Dark Plains</h1>
          <ul className="dp-auth-points">
            {HERO_POINTS.map(point => <li key={point}>{point}</li>)}
          </ul>
        </section>

        <section className="dp-panel dp-auth-card" aria-label="Account">
          {authUnavailable ? (
            <div className="dp-stack">
              <p className="arcane-label">Sign-in unavailable</p>
              <p className="dp-body">{MANAGED_AUTH_UNAVAILABLE_MESSAGE}</p>
              <p className="dp-caption">
                Local prototype login is disabled on this production host so browser passwords cannot be mistaken for live accounts.
              </p>
            </div>
          ) : showForgot && onlineAuth ? (
            <form onSubmit={handleForgotSubmit} className="dp-stack">
              <div>
                <p className="arcane-label">Recover your account</p>
                <h2 className="fantasy-heading dp-auth-card-title">Forgot password</h2>
              </div>
              <label className="dp-field">
                <span className="dp-field-label">Username or email</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="dp-input"
                  placeholder="Enter username or email"
                  autoComplete="username"
                  required
                  disabled={submitting}
                />
              </label>
              {feedback}
              <button type="submit" disabled={submitting} className="ui-button-primary dp-button-block">
                {submitting ? 'Please wait…' : 'Send reset email'}
              </button>
              <button type="button" onClick={closeForgot} className="dp-link">Back to login</button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="dp-stack">
              <div className="dp-tabs" role="tablist" aria-label="Account mode">
                <button type="button" role="tab" aria-selected={isLogin} className="dp-tab" onClick={() => switchTab(true)}>
                  Log in
                </button>
                <button type="button" role="tab" aria-selected={!isLogin} className="dp-tab" onClick={() => switchTab(false)}>
                  Register
                </button>
              </div>

              <label className="dp-field">
                <span className="dp-field-label">Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="dp-input"
                  placeholder="Your commander name"
                  autoComplete="username"
                  required
                  disabled={submitting}
                />
              </label>

              <label className="dp-field">
                <span className="dp-field-label">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="dp-input"
                  placeholder="Password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  disabled={submitting}
                />
              </label>

              {feedback}

              <button type="submit" disabled={submitting} className="ui-button-primary dp-button-block">
                {submitting ? 'Please wait…' : isLogin ? 'Enter the Plains' : 'Create commander'}
              </button>

              <div className="dp-auth-meta">
                <span className="dp-caption">
                  {onlineAuth ? 'Online account' : 'Local prototype: saves stay in this browser'}
                </span>
                {onlineAuth && isLogin && (
                  <button type="button" onClick={openForgot} className="dp-link">Forgot password?</button>
                )}
              </div>
            </form>
          )}
        </section>
      </main>

      <aside className="dp-panel dp-auth-feedback">
        <Image
          src="/assets/qrcode.png"
          alt="QR code to share feedback on Discord"
          width={72}
          height={72}
          className="dp-auth-feedback-qr"
        />
        <span>
          <span className="arcane-label">Share feedback</span>
          <span className="dp-caption">Scan to reach us on Discord.</span>
        </span>
      </aside>

      <footer className="dp-screen-footer">v2.0</footer>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Opening the gates" />}>
      <AuthPageContent />
    </Suspense>
  );
}
