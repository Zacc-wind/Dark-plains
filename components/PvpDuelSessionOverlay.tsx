'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentUser,
} from '@/lib/auth';
import {
  getBattleChallenges,
  type PlayerModelNumber,
  type SynchronizedBattleAction,
} from '@/lib/battle';
import {
  applyLocalCurrentPvpDuelAction,
  cancelCurrentPvpDuelSession,
  confirmCurrentPvpDuelFormation,
  ensurePvpDuelSession,
  forfeitCurrentPvpDuelSession,
  getCurrentPvpDuelSession,
  getPvpDuelSessions,
  PVP_DUEL_SESSION_UPDATED_EVENT,
  savePvpDuelSession,
  settleCurrentPvpDuelSession,
  syncOnlinePvpDuelSessions,
} from '@/lib/pvpDuelClient';
import {
  postOnlinePvpDuelAction,
  shouldUseOnlinePvpDuelClient,
} from '@/lib/pvpDuelOnlineClient';
import {
  getPvpDuelSide,
  type PvpDuelSession,
} from '@/lib/pvpDuelSessions';
import BattleModal, {
  type BattleModalActionRequest,
  type BattleModalActionResponse,
} from './BattleModal';
import CinematicScrollShell from './CinematicScrollShell';
import FormationPanel from './FormationPanel';

async function findOrCreateCurrentSession(username: string, now = Date.now()): Promise<PvpDuelSession | undefined> {
  await syncOnlinePvpDuelSessions(now);
  const current = getCurrentPvpDuelSession(username, now);
  if (current) return current;

  const storedChallengeIds = new Set(getPvpDuelSessions(now).map(session => session.challengeId));
  const readyChallenge = getBattleChallenges().find(challenge => (
    challenge.status === 'ready'
    && !storedChallengeIds.has(challenge.id)
    && [challenge.challengerUsername, challenge.targetUsername]
      .some(participant => participant.toLowerCase() === username.toLowerCase())
  ));
  if (!readyChallenge) return undefined;
  return (await ensurePvpDuelSession(readyChallenge, now)).session;
}

export default function PvpDuelSessionOverlay() {
  const [session, setSession] = useState<PvpDuelSession | null>(null);
  const [formation, setFormation] = useState<Record<string, { x: number; y: number }> | null>(null);
  const [spellIds, setSpellIds] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const user = getCurrentUser();
  const username = user?.username || '';

  const refresh = useCallback(() => {
    if (!username) {
      setSession(null);
      return;
    }
    void findOrCreateCurrentSession(username).then(next => {
      setSession(current => (
        current?.id === next?.id && current?.version === next?.version ? current : next || null
      ));
    });
  }, [username]);

  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 1_000);
    window.addEventListener(PVP_DUEL_SESSION_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener(PVP_DUEL_SESSION_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const side = session ? getPvpDuelSide(session, username) : null;
  const snapshot = session && side
    ? side === 'challenger' ? session.challengerSnapshot : session.defenderSnapshot
    : null;
  const savedFormation = session && side
    ? side === 'challenger' ? session.challengerFormation : session.defenderFormation
    : null;
  const opponentName = session && side
    ? side === 'challenger' ? session.defenderUsername : session.challengerUsername
    : '';
  const currentFormation = formation || savedFormation?.placements || {};
  const currentSpellIds = spellIds || savedFormation?.equippedSpellIds || [];

  const handleBattleAction = useCallback((request: BattleModalActionRequest): BattleModalActionResponse => {
    if (!session?.combatSnapshot || !username) {
      return { success: false, error: 'Duel session is not ready.' };
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
    const result = applyLocalCurrentPvpDuelAction(session.id, action, session.version, now);
    if (!result.success || !result.session?.combatSnapshot) {
      return { success: false, error: result.error || 'Duel command failed.' };
    }
    setSession(result.session);
    setNotice(null);

    if (shouldUseOnlinePvpDuelClient()) {
      void postOnlinePvpDuelAction(session.id, action, session.version)
        .then(payload => {
          savePvpDuelSession(payload.session, now);
          setSession(payload.session);
        })
        .catch(error => {
          setNotice(error instanceof Error ? error.message : 'Duel action failed to sync.');
          void syncOnlinePvpDuelSessions().then(refresh);
        });
    }

    return { success: true, battle: result.session.combatSnapshot };
  }, [refresh, session, username]);

  if (!session || !side || !snapshot || !savedFormation) return null;
  if (session.phase === 'cancelled' || session.phase === 'expired') return null;

  if (session.phase === 'formation' && !savedFormation.confirmedAt) {
    return (
      <div className="fixed inset-0 z-[88] overflow-auto bg-black/88 p-2">
        <FormationPanel
          enemyName={opponentName}
          enemySubtitle="Commander duel"
          commanderName={username}
          commanderModel={snapshot.selectedModel as PlayerModelNumber}
          stacks={snapshot.minions}
          formation={currentFormation}
          spellIds={currentSpellIds}
          knownSpellIds={snapshot.knownSpellIds}
          organizedRoster
          onChangeFormation={setFormation}
          onChangeSpellIds={setSpellIds}
          onStart={() => {
            if (busy) return;
            setBusy(true);
            void confirmCurrentPvpDuelFormation(
              session.id,
              username,
              currentFormation,
              currentSpellIds,
              session.version,
            ).then(result => {
              if (!result.success || !result.session) {
                setNotice(result.error || 'Could not confirm duel formation.');
                return;
              }
              setSession(result.session);
              setNotice('Formation confirmed.');
            }).finally(() => setBusy(false));
          }}
          onBack={() => {
            if (busy) return;
            setBusy(true);
            void cancelCurrentPvpDuelSession(session.id, username, session.version).then(result => {
              if (result.success) setSession(null);
              else setNotice(result.error || 'Could not leave the duel.');
            }).finally(() => setBusy(false));
          }}
        />
        {notice && (
          <div className="fixed bottom-4 left-1/2 z-[95] -translate-x-1/2 rounded border border-[rgba(226,190,103,0.48)] bg-black/90 px-4 py-3 text-sm font-black text-[var(--ui-accent)]">
            {notice}
          </div>
        )}
      </div>
    );
  }

  if (session.phase === 'formation') {
    return (
      <div className="cinematic-scroll-overlay fixed inset-0 z-[88] flex items-center justify-center p-4">
        <CinematicScrollShell variant="compact" className="w-full max-w-xl text-zinc-100">
          <div className="px-6 py-8 text-center">
            <div className="arcane-label">Duel Formation Locked</div>
            <h2 className="fantasy-heading mt-2 text-3xl">Awaiting {opponentName}</h2>
            <p className="ui-muted mx-auto mt-4 max-w-md text-sm font-bold leading-relaxed">
              Your captured warband and spell loadout are sealed. Combat opens when the opposing commander confirms.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (busy) return;
                setBusy(true);
                void cancelCurrentPvpDuelSession(session.id, username, session.version).then(result => {
                  if (result.success) setSession(null);
                  else setNotice(result.error || 'Could not cancel the duel.');
                }).finally(() => setBusy(false));
              }}
              className="ui-button mt-6 rounded px-5 py-3 text-sm font-black disabled:opacity-40"
            >
              Cancel Duel
            </button>
            {notice && <p className="mt-4 text-xs font-bold text-red-200">{notice}</p>}
          </div>
        </CinematicScrollShell>
      </div>
    );
  }

  if (session.phase === 'active' && session.combatSnapshot) {
    return (
      <BattleModal
        enemy={session.combatSnapshot.enemy}
        battleState={session.combatSnapshot}
        localUsername={username}
        availableSpellIds={savedFormation.equippedSpellIds}
        persistentResults={false}
        onBattleAction={handleBattleAction}
        onRetreatRequest={() => {
          if (busy) return;
          setBusy(true);
          void forfeitCurrentPvpDuelSession(session.id, username, session.version).then(result => {
            if (result.success && result.session) setSession(result.session);
            else setNotice(result.error || 'Could not forfeit the duel.');
          }).finally(() => setBusy(false));
        }}
        onClose={() => undefined}
      />
    );
  }

  const result = session.result;
  const won = result?.winnerUsername.toLowerCase() === username.toLowerCase();
  return (
    <div className="cinematic-scroll-overlay fixed inset-0 z-[92] flex items-center justify-center p-4">
      <CinematicScrollShell variant="compact" className="w-full max-w-xl text-zinc-100">
        <div className="px-6 py-8 text-center">
          <div className="arcane-label">Commander Duel Complete</div>
          <h2 className="fantasy-heading mt-2 text-4xl">{won ? 'Banner Triumphant' : 'Banner Lowered'}</h2>
          <p className="ui-muted mx-auto mt-4 max-w-md text-sm font-bold leading-relaxed">
            {result?.winnerUsername} defeated {result?.loserUsername}. No campaign loot or commander health was changed.
          </p>
          <button
            type="button"
            data-multiplayer-tutorial-anchor="battle-result-claim"
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              void settleCurrentPvpDuelSession(session.id).then(settled => {
                if (!settled.success) {
                  setNotice(settled.error || 'Could not claim the duel result.');
                  return;
                }
                setSession(null);
              }).finally(() => setBusy(false));
            }}
            className="ui-button-primary mt-6 rounded px-6 py-3 text-sm font-black disabled:opacity-40"
          >
            Claim Duel Result
          </button>
          {notice && <p className="mt-4 text-xs font-bold text-red-200">{notice}</p>}
        </div>
      </CinematicScrollShell>
    </div>
  );
}
