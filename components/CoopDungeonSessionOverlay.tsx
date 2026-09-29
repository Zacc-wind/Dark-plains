'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, type User } from '@/lib/auth';
import type { SynchronizedBattleAction } from '@/lib/battle';
import {
  abandonCurrentCoopDungeonSession,
  applyLocalCurrentCoopDungeonAction,
  COOP_DUNGEON_SESSION_UPDATED_EVENT,
  dismissCompletedCoopDungeonSession,
  getCurrentCoopDungeonSession,
  saveCoopDungeonSession,
  startCurrentCoopDungeonChamber,
  syncOnlineCoopDungeonSessions,
} from '@/lib/coopDungeonClient';
import {
  postOnlineCoopDungeonAction,
  shouldUseOnlineCoopDungeonClient,
} from '@/lib/coopDungeonOnlineClient';
import {
  getCurrentCoopDungeonChamber,
  type CoopDungeonSession,
} from '@/lib/coopDungeonSessions';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import BattleModal, {
  type BattleModalActionRequest,
  type BattleModalActionResponse,
} from './BattleModal';
import CinematicScrollShell from './CinematicScrollShell';
import { usePolling } from '@/lib/hooks/usePolling';
import { keepIfUnchanged } from '@/lib/hooks/userSnapshot';

const IDLE_SESSION_POLL_MS = 3_000;
const ACTIVE_SESSION_POLL_MS = 1_000;

export default function CoopDungeonSessionOverlay() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [session, setSession] = useState<CoopDungeonSession | null>(() => {
    const user = getCurrentUser();
    return user ? getCurrentCoopDungeonSession(user.username) || null : null;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    const user = getCurrentUser();
    setCurrentUser(previous => keepIfUnchanged(previous, user));
    if (!user) {
      setSession(null);
      return;
    }
    return syncOnlineCoopDungeonSessions().then(() => {
      const next = getCurrentCoopDungeonSession(user.username);
      setSession(current => (
        current?.id === next?.id && current?.version === next?.version ? current : next || null
      ));
    });
  }, []);

  usePolling(refresh, session ? ACTIVE_SESSION_POLL_MS : IDLE_SESSION_POLL_MS);

  useEffect(() => {
    window.addEventListener(COOP_DUNGEON_SESSION_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(COOP_DUNGEON_SESSION_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!session?.id || !isSupabaseConfigured() || !shouldUseOnlineCoopDungeonClient()) return undefined;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void import('@/lib/supabase/client').then(({ createClient }) => {
      if (cancelled) return;
      try {
        const supabase = createClient();
        const channel = supabase
          .channel(`coop-dungeon-session-${session.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'coop_dungeon_sessions',
              filter: `id=eq.${session.id}`,
            },
            () => {
              refresh();
            },
          )
          .subscribe();
        cleanup = () => {
          void supabase.removeChannel(channel);
        };
      } catch {
        // Keep 1s poll when browser Supabase client is unavailable.
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [refresh, session?.id]);

  const username = currentUser?.username || '';

  const handleBattleAction = useCallback((request: BattleModalActionRequest): BattleModalActionResponse => {
    if (!session?.combatSnapshot || !username) {
      return { success: false, error: 'Dungeon chamber is not ready.' };
    }
    const now = Date.now();
    const action: SynchronizedBattleAction = {
      ...request,
      id: `${session.id}-${session.version}-${session.combatSnapshot.revision || 0}-${request.type}-${now}`,
      actorUsername: username,
      expectedRevision: session.combatSnapshot.revision || 0,
      createdAt: now,
    };
    // Hybrid: BattleModal is sync, so apply locally for snappy UI, then stream online in background.
    const result = applyLocalCurrentCoopDungeonAction(session.id, action, session.version, now);
    if (!result.success || !result.session) {
      return { success: false, error: result.error || 'Chamber command failed.' };
    }
    setSession(result.session);
    setNotice(null);

    if (shouldUseOnlineCoopDungeonClient()) {
      void postOnlineCoopDungeonAction(session.id, action, session.version)
        .then(payload => {
          saveCoopDungeonSession(payload.session, now);
          setSession(payload.session);
        })
        .catch(error => {
          setNotice(error instanceof Error ? error.message : 'Dungeon action failed to sync.');
          void syncOnlineCoopDungeonSessions().then(refresh);
        });
    }

    if (result.session.combatSnapshot) {
      return { success: true, battle: result.session.combatSnapshot };
    }
    return { success: true, battle: session.combatSnapshot };
  }, [refresh, session, username]);

  const abandon = () => {
    if (!session || !username || busy) return;
    setBusy(true);
    void abandonCurrentCoopDungeonSession(session.id, username, session.version).then(result => {
      if (!result.success) {
        setNotice(result.error || 'Could not abandon the dungeon route.');
        setConfirmAbandon(false);
        return;
      }
      setSession(null);
      setConfirmAbandon(false);
    }).finally(() => setBusy(false));
  };

  if (!session || session.phase === 'abandoned' || !username) {
    return null;
  }

  if (session.phase === 'chamber' && session.combatSnapshot && session.chamberEnemy) {
    return (
      <>
        <BattleModal
          enemy={session.chamberEnemy}
          battleState={session.combatSnapshot}
          localUsername={username}
          availableSpellIds={currentUser?.equippedSpellIds}
          persistentResults={false}
          contextLabel="Duo Dungeon"
          onBattleAction={handleBattleAction}
          onRetreatRequest={() => setConfirmAbandon(true)}
          onClose={() => undefined}
        />
        {confirmAbandon && (
          <AbandonDungeonConfirmation onStay={() => setConfirmAbandon(false)} onAbandon={abandon} />
        )}
      </>
    );
  }

  if (session.phase === 'complete') {
    return (
      <div className="cinematic-scroll-overlay fixed inset-0 z-[95] flex items-center justify-center p-4">
        <CinematicScrollShell variant="compact" className="w-full max-w-xl text-zinc-100">
          <div className="px-6 py-8 text-center">
            <div className="arcane-label">Duo Dungeon Route</div>
            <h2 className="fantasy-heading mt-2 text-3xl">Route Cleared</h2>
            <p className="ui-muted mx-auto mt-3 max-w-md text-sm font-bold leading-relaxed">
              {session.hostUsername} and {session.allyUsername} cleared all three chambers of{' '}
              {session.dungeonSnapshot.name}. Full route loot settlement ships with the longer co-op dungeon pass.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (busy) return;
                setBusy(true);
                const result = dismissCompletedCoopDungeonSession(session.id, username);
                if (!result.success) {
                  setNotice(result.error || 'Could not close the route report.');
                  setBusy(false);
                  return;
                }
                setSession(null);
                setBusy(false);
              }}
              className="ui-button-primary mt-6 rounded px-6 py-3 text-sm font-black disabled:opacity-40"
            >
              Close Route
            </button>
            {notice && <p className="mt-4 text-xs font-bold text-red-200">{notice}</p>}
          </div>
        </CinematicScrollShell>
      </div>
    );
  }

  const chamber = getCurrentCoopDungeonChamber(session);

  return (
    <div className="cinematic-scroll-overlay fixed inset-0 z-[95] flex items-center justify-center p-4">
      <CinematicScrollShell variant="compact" className="w-full max-w-xl text-zinc-100">
        <div className="px-6 py-7">
          <div className="arcane-label">Duo Dungeon Route</div>
          <h2 className="fantasy-heading mt-2 text-3xl">{session.dungeonSnapshot.name}</h2>
          <p className="ui-muted mt-2 text-sm font-bold leading-relaxed">
            Shared seed route · Lv {session.dungeonSnapshot.level} · {session.hostUsername} &amp; {session.allyUsername}
          </p>

          <ol className="mt-5 space-y-2">
            {session.chambers.map((entry, index) => {
              const active = index === session.currentChamberIndex && !entry.cleared;
              return (
                <li
                  key={entry.id}
                  className={`flex items-center gap-3 rounded border px-3 py-3 ${
                    entry.cleared
                      ? 'border-emerald-400/30 bg-emerald-950/25'
                      : active
                        ? 'border-[rgba(226,190,103,0.45)] bg-black/40'
                        : 'border-white/10 bg-black/25'
                  }`}
                >
                  <span className="ui-faint w-6 text-center text-xs font-black">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-zinc-100">{entry.label}</strong>
                    <span className="ui-muted block text-[11px] font-bold">
                      {entry.cleared ? 'Cleared' : active ? 'Current chamber' : 'Locked'}
                    </span>
                  </span>
                  {entry.cleared ? (
                    <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase text-emerald-200">
                      Done
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmAbandon(true)}
              className="ui-button rounded px-4 py-2.5 text-xs font-black"
            >
              Abandon Route
            </button>
            <button
              type="button"
              disabled={busy || !chamber || chamber.cleared}
              onClick={() => {
                if (busy || !chamber) return;
                setBusy(true);
                void startCurrentCoopDungeonChamber(session.id, session.version).then(result => {
                  if (!result.success || !result.session) {
                    setNotice(result.error || 'Could not start this chamber.');
                    return;
                  }
                  setSession(result.session);
                  setNotice(null);
                }).finally(() => setBusy(false));
              }}
              className="ui-button-primary rounded px-4 py-2.5 text-xs font-black disabled:opacity-40"
            >
              Start Chamber
            </button>
          </div>
          {notice && <p className="mt-3 text-xs font-bold text-amber-200">{notice}</p>}
        </div>
      </CinematicScrollShell>
      {confirmAbandon && (
        <AbandonDungeonConfirmation onStay={() => setConfirmAbandon(false)} onAbandon={abandon} />
      )}
    </div>
  );
}

function AbandonDungeonConfirmation({
  onStay,
  onAbandon,
}: {
  onStay: () => void;
  onAbandon: () => void;
}) {
  return (
    <div className="cinematic-scroll-overlay fixed inset-0 z-[160] flex items-center justify-center p-4">
      <CinematicScrollShell variant="compact" className="w-full max-w-lg text-zinc-100">
        <div className="px-6 py-7 text-center">
          <div className="arcane-label">Party Decision</div>
          <h2 className="fantasy-heading mt-2 text-3xl">Abandon Route?</h2>
          <p className="ui-muted mx-auto mt-3 max-w-md text-sm font-bold leading-relaxed">
            Withdrawing ends this shared three-chamber stub. Duo raids are unaffected.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button type="button" onClick={onStay} className="ui-button rounded px-4 py-2.5 text-xs font-black">
              Stay
            </button>
            <button type="button" onClick={onAbandon} className="ui-button-primary rounded px-4 py-2.5 text-xs font-black">
              Abandon
            </button>
          </div>
        </div>
      </CinematicScrollShell>
    </div>
  );
}
