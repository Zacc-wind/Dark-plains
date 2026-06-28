'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  acceptBattleChallenge,
  BattleChallenge,
  confirmBattleChallenge,
  declineBattleChallenge,
  getBattleChallengeTimeRemaining,
  getBattleChallenges,
} from '@/lib/battle';
import { getCurrentUser, getUsers } from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';
import { emitFxEvent } from '@/lib/fxEvents';
import {
  fetchOnlineBattleChallenges,
  shouldUseOnlineChallenges,
  updateOnlineBattleChallenge,
} from '@/lib/pvpChallengeClient';
import {
  getCachedWorldPlayers,
  refreshWorldPlayers,
} from '@/lib/worldPlayers';

function getIncomingChallenge(
  challenges: BattleChallenge[],
  username: string,
): BattleChallenge | undefined {
  return challenges.find(challenge => (
    challenge.targetUsername.toLowerCase() === username.toLowerCase()
    && challenge.status === 'pending'
    && !challenge.confirmedBy.some(name => name.toLowerCase() === username.toLowerCase())
  ));
}

export default function PvpChallengeOverlay() {
  const [challenges, setChallenges] = useState<BattleChallenge[]>([]);
  const [worldPlayers, setWorldPlayers] = useState(() => getCachedWorldPlayers());
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const onlineEnabled = shouldUseOnlineChallenges();
  const username = getCurrentUser()?.username ?? null;
  const incoming = username
    ? getIncomingChallenge(challenges, username)
    : undefined;

  useEffect(() => {
    if (!username) {
      setChallenges([]);
      return undefined;
    }

    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;

      if (!onlineEnabled) {
        setChallenges(getBattleChallenges());
        return;
      }

      try {
        const [onlineChallenges, latestWorldPlayers] = await Promise.all([
          fetchOnlineBattleChallenges(),
          refreshWorldPlayers(),
        ]);
        if (!cancelled) {
          setChallenges(onlineChallenges);
          setWorldPlayers(latestWorldPlayers);
        }
      } catch {
        if (!cancelled) {
          setChallenges(getBattleChallenges());
          setWorldPlayers(getCachedWorldPlayers());
        }
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 3000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearInterval(clock);
    };
  }, [username, onlineEnabled]);

  if (!incoming || !username) return null;

  const remaining = getBattleChallengeTimeRemaining(incoming, now);
  const challenger = getUsers().find(player => player.username.toLowerCase() === incoming.challengerUsername.toLowerCase());
  const onlineChallenger = worldPlayers.find(player => player.username.toLowerCase() === incoming.challengerUsername.toLowerCase());
  const challengerModel = challenger?.selectedModel || onlineChallenger?.selectedModel || 3;

  const refreshChallenges = async () => {
    if (!onlineEnabled) {
      setChallenges(getBattleChallenges());
      return;
    }

    try {
      setChallenges(await fetchOnlineBattleChallenges());
    } catch {
      setChallenges(getBattleChallenges());
    }
  };

  const handleAccept = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    emitFxEvent({ type: 'attack', tone: 'gold', intensity: 1.1 });

    try {
      if (onlineEnabled) {
        await updateOnlineBattleChallenge(incoming.id, 'accept');
      } else {
        acceptBattleChallenge(incoming.id);
        confirmBattleChallenge(incoming.id);
      }
      await refreshChallenges();
      setNotice('Duel accepted. Prepare your warband.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not accept challenge.');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);

    try {
      if (onlineEnabled) {
        await updateOnlineBattleChallenge(incoming.id, 'decline');
      } else {
        declineBattleChallenge(incoming.id);
      }
      await refreshChallenges();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not decline challenge.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pvp-challenge-overlay fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="pvp-challenge-card command-panel vine-frame w-full max-w-lg overflow-hidden rounded border text-zinc-100 shadow-2xl">
        <div className="panel-header border-b px-5 py-4 text-center">
          <div className="arcane-label">Duel Challenge</div>
          <h2 className="fantasy-heading mt-1 text-2xl">Crossed Blades</h2>
        </div>

        <div className="px-5 py-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-amber-300/35 bg-amber-950/30 text-4xl">
            ⚔
          </div>

          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border">
            <Image
              src={getPlayerModelPath(challengerModel)}
              alt={incoming.challengerUsername}
              width={96}
              height={96}
              className="player-model-art object-contain"
              unoptimized
            />
          </div>

          <p className="text-lg font-black text-zinc-100">{incoming.challengerUsername}</p>
          <p className="ui-muted mt-2 text-sm font-bold">
            challenges you to a commander duel on the world map.
          </p>
          <p className="ui-accent mt-3 text-xs font-black uppercase tracking-[0.18em]">
            {Math.max(0, Math.ceil(remaining / 1000))}s to respond
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDecline()}
            className="ui-button-danger rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAccept()}
            className="ui-button-primary rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            Accept Duel
          </button>
        </div>

        {notice && (
          <div className="border-t px-5 py-3 text-center text-xs font-bold text-[var(--ui-accent)]">
            {notice}
          </div>
        )}
      </section>
    </div>
  );
}
