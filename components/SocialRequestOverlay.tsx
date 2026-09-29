'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acceptPlayerTradeRequest,
  acceptPartyInvite,
  declinePlayerTradeRequest,
  declinePartyInvite,
  getCurrentUser,
  getIncomingSocialRequests,
  getUsers,
  recordCurrentMultiplayerEngagementEvent,
} from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';
import { getSocialRequestTimeRemaining } from '@/lib/socialRequests';
import { emitFxEvent } from '@/lib/fxEvents';
import { playGameSound, preloadGameSounds } from '@/lib/sound';
import { usePolling } from '@/lib/hooks/usePolling';
import { expireSocialRequestsShared } from '@/lib/socialRequestTicker';
import { TRADE_SESSION_OPEN_EVENT } from '@/lib/tradeSessions';
import CinematicScrollShell from './CinematicScrollShell';

const IDLE_REQUEST_POLL_MS = 3_000;
const ACTIVE_REQUEST_POLL_MS = 1_000;

export default function SocialRequestOverlay() {
  const [now, setNow] = useState(() => Date.now());
  const [, setRevision] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const shellRef = useRef<HTMLDivElement>(null);
  const user = getCurrentUser();
  const incoming = user
    ? getIncomingSocialRequests(user, now).find(request => !dismissedIds.includes(request.id))
    : undefined;
  const requestId = incoming?.id;

  const refresh = useCallback(() => {
    const tickAt = Date.now();
    expireSocialRequestsShared(tickAt);
    setNow(tickAt);
    setRevision(value => value + 1);
  }, []);
  usePolling(refresh, requestId ? ACTIVE_REQUEST_POLL_MS : IDLE_REQUEST_POLL_MS, { immediate: false });

  useEffect(() => {
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [refresh]);

  useEffect(() => {
    if (!requestId) return undefined;
    preloadGameSounds(['ui.modalOpen', incoming?.kind === 'trade' ? 'social.tradeReceived' : 'social.partyInvite']);
    playGameSound('ui.modalOpen', { throttleMs: 250 });
    playGameSound(incoming?.kind === 'trade' ? 'social.tradeReceived' : 'social.partyInvite', { throttleMs: 500 });
    emitFxEvent({ type: 'interface', tone: 'gold', intensity: 0.8 });

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      shellRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedIds(ids => ids.includes(requestId) ? ids : [...ids, requestId]);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(shellRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') || []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [incoming?.kind, requestId]);

  if (!user || !incoming) return null;

  const sender = getUsers().find(candidate => candidate.username.toLowerCase() === incoming.senderUsername.toLowerCase());
  const remaining = getSocialRequestTimeRemaining(incoming, now);
  const remainingPercent = Math.min(100, (remaining / Math.max(1, incoming.expiresAt - incoming.createdAt)) * 100);
  const dismiss = () => setDismissedIds(ids => ids.includes(incoming.id) ? ids : [...ids, incoming.id]);

  const handleResponse = async (response: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const result = incoming.kind === 'party'
        ? response === 'accept' ? await acceptPartyInvite(incoming.id) : await declinePartyInvite(incoming.id)
        : response === 'accept'
          ? await acceptPlayerTradeRequest(incoming.id)
          : await declinePlayerTradeRequest(incoming.id);
      if (result.success) {
        if (incoming.kind === 'party') {
          recordCurrentMultiplayerEngagementEvent({
            id: `party-action:${incoming.id}:${response}`,
            kind: 'party-action',
            contextId: 'social-request',
            targetId: incoming.senderUsername,
          });
        }
        playGameSound(response === 'accept' ? 'social.accept' : 'social.decline', { throttleMs: 120 });
        setDismissedIds(ids => ids.includes(incoming.id) ? ids : [...ids, incoming.id]);
        setRevision(value => value + 1);
        if (incoming.kind === 'trade' && response === 'accept') {
          window.dispatchEvent(new Event(TRADE_SESSION_OPEN_EVENT));
        }
      } else {
        setNotice(result.error || 'Could not answer request.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="cinematic-scroll-overlay fixed inset-0 z-[89] flex items-center justify-center p-3 max-sm:p-0 sm:p-5"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div ref={shellRef} className="w-full max-w-lg">
        <CinematicScrollShell
          variant="compact"
          className="w-full text-zinc-100 max-sm:min-h-[100dvh] max-sm:max-w-none"
          contentClassName="overflow-hidden max-sm:min-h-[100dvh]"
        >
          <section role="dialog" aria-modal="true" aria-label={incoming.kind === 'party' ? 'Party invitation' : 'Trade request'}>
            <header className="panel-header flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <p className="arcane-label">Incoming Request</p>
                <h2 className="fantasy-heading mt-1 text-2xl">
                  {incoming.kind === 'party' ? 'Company Standard Raised' : 'Licensed Exchange'}
                </h2>
              </div>
              <button type="button" onClick={dismiss} className="ui-button rounded px-3 py-2 text-xs font-black">
                Later
              </button>
            </header>

            <div className="px-5 py-6 text-center">
              <span className="ui-avatar-frame relative mx-auto block h-32 w-32 overflow-hidden rounded border">
                <Image
                  src={getPlayerModelPath(sender?.selectedModel || 3)}
                  alt={incoming.senderUsername}
                  fill
                  sizes="128px"
                  className="player-model-art object-contain p-2"
                  unoptimized
                />
              </span>
              <p className="mt-4 text-lg font-black text-zinc-100">{incoming.senderUsername}</p>
              <p className="ui-muted mx-auto mt-2 max-w-sm text-sm font-bold">
                {incoming.kind === 'party'
                  ? `invites you to join a ${incoming.payload?.partyMemberCount || 1}/${4} commander company led by ${incoming.payload?.partyLeaderUsername || incoming.senderUsername}.`
                  : 'asks to open a protected player exchange.'}
              </p>
              <p className="ui-accent mt-4 text-xs font-black uppercase">
                {Math.max(0, Math.ceil(remaining / 1000))}s remaining
              </p>
              <div className="ui-progress-track mx-auto mt-3 h-2 max-w-sm overflow-hidden rounded border" aria-hidden="true">
                <div className="ui-progress-fill h-full" style={{ width: `${remainingPercent}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t px-5 py-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResponse('decline')}
                className="ui-button-danger rounded px-4 py-3 text-sm font-black disabled:opacity-40"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResponse('accept')}
                className="ui-button-primary rounded px-4 py-3 text-sm font-black disabled:opacity-40"
              >
                {incoming.kind === 'party' ? 'Join Party' : 'Open Trade'}
              </button>
            </div>
            {notice && <div className="ui-notice border-t px-5 py-3 text-center text-xs font-bold">{notice}</div>}
          </section>
        </CinematicScrollShell>
      </div>
    </div>
  );
}
