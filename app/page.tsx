'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register, login } from '@/lib/auth';
import { emitFxEvent } from '@/lib/fxEvents';
import ThreeFxOverlay from '@/components/ThreeFxOverlay';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isLogin) {
      const result = login(username, password);
      if (result.success) {
        emitFxEvent({ type: 'spell', tone: 'violet', intensity: 0.7 });
        router.push('/game');
      } else {
        setError(result.error || 'Login failed');
        emitFxEvent({ type: 'status', tone: 'red', intensity: 0.42 });
      }
    } else {
      const result = register(username, password);
      if (result.success) {
        emitFxEvent({ type: 'recruit', tone: 'green', intensity: 0.72 });
        setError('');
        setIsLogin(true);
        setPassword('');
        setSuccess('Account created. Please log in.');
      } else {
        setError(result.error || 'Registration failed');
        emitFxEvent({ type: 'status', tone: 'red', intensity: 0.42 });
      }
    }
  };

  return (
    <div className="fantasy-ui flex min-h-screen items-center justify-center bg-[#05080a] p-4">
      <ThreeFxOverlay />
      <div className="command-panel vine-frame relative z-[100] w-full max-w-md rounded border p-8">
        <h1 className="fantasy-heading mb-2 text-center text-4xl">Pirate Game</h1>
        <p className="arcane-label mb-8 text-center">
          {isLogin ? 'Login to continue' : 'Create your account'}
        </p>

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
            className="ui-button-primary w-full rounded-lg px-6 py-4 font-semibold transition-all"
          >
            {isLogin ? 'Login' : 'Register'}
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
      </div>
    </div>
  );
}
