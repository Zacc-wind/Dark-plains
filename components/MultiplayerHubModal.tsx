'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  BattleChallenge,
  cancelBattleChallenge,
  canChallengePlayer,
  confirmBattleChallenge,
  createBattleChallenge,
  declineBattleChallenge,
  getBattleChallengeTimeRemaining,
  getBattleChallenges,
} from '@/lib/battle';
import { getCurrentUser, getPvpRating, getUsers } from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';
import { emitFxEvent } from '@/lib/fxEvents';
import {
  PVP_RATING_MAX,
  PVP_RATING_MIN,
  formatPvpRating,
} from '@/lib/pvpRating';
import {
  createOnlineBattleChallenge,
  fetchOnlineBattleChallenges,
  shouldUseOnlineChallenges,
  updateOnlineBattleChallenge,
} from '@/lib/pvpChallengeClient';

interface PvpHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatChallengeTime(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function getChallengeForPlayer(
  challenges: BattleChallenge[],
  currentUsername: string,
  targetUsername: string,
): BattleChallenge | undefined {
  return challenges.find(challenge => {
    const participants = [challenge.challengerUsername, challenge.targetUsername];
    return (
      participants.includes(currentUsername)
      && participants.includes(targetUsername)
      && (challenge.status === 'pending' || challenge.status === 'ready')
    );
  });
}

export default function MultiplayerHubModal({ isOpen, onClose }: PvpHubModalProps) {
  const [challenges, setChallenges] = useState<BattleChallenge[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const onlineEnabled = shouldUseOnlineChallenges();
  const username = getCurrentUser()?.username ?? null;
  const currentUser = username ? getCurrentUser() : null;
  const myRating = getPvpRating(currentUser);

  const players = useMemo(() => {
    if (!username) return [];
    return getUsers()
      .filter(player => player.username.toLowerCase() !== username.toLowerCase())
      .sort((left, right) => left.username.localeCompare(right.username));
  }, [username, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;

      if (!onlineEnabled) {
        setChallenges(getBattleChallenges());
        return;
      }

      try {
        const onlineChallenges = await fetchOnlineBattleChallenges();
        if (!cancelled) setChallenges(onlineChallenges);
      } catch (error) {
        if (!cancelled) {
          setChallenges(getBattleChallenges());
          setNotice(error instanceof Error ? error.message : 'Online PVP challenges failed to load.');
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
  }, [isOpen, onlineEnabled]);

  if (!isOpen) return null;

  const refreshChallenges = async () => {
    if (!onlineEnabled) {
      setChallenges(getBattleChallenges());
      return;
    }

    try {
      setChallenges(await fetchOnlineBattleChallenges());
    } catch (error) {
      setChallenges(getBattleChallenges());
      setNotice(error instanceof Error ? error.message : 'Online PVP challenges failed to load.');
    }
  };

  const handleChallenge = async (targetUsername: string) => {
    const targetPlayer = players.find(player => player.username === targetUsername) || null;
    const challengeRule = canChallengePlayer(currentUser, targetPlayer);
    if (!challengeRule.allowed) {
      setNotice(challengeRule.reason || 'Challenge blocked.');
      return;
    }

    try {
      if (onlineEnabled) {
        await createOnlineBattleChallenge(targetUsername);
      } else {
        createBattleChallenge(targetUsername);
      }
      setNotice(challengeRule.warning || `Challenge sent to ${targetUsername}.`);
      await refreshChallenges();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Challenge could not be created.');
    }
  };

  const handleConfirm = async (challengeId: string) => {
    try {
      if (onlineEnabled) {
        await updateOnlineBattleChallenge(challengeId, 'confirm');
      } else {
        confirmBattleChallenge(challengeId);
      }
      await refreshChallenges();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Challenge could not be confirmed.');
    }
  };

  const handleDecline = async (challengeId: string) => {
    try {
      if (onlineEnabled) {
        await updateOnlineBattleChallenge(challengeId, 'decline');
      } else {
        declineBattleChallenge(challengeId);
      }
      await refreshChallenges();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Challenge could not be declined.');
    }
  };

  const handleCancel = async (challengeId: string) => {
    try {
      if (onlineEnabled) {
        await updateOnlineBattleChallenge(challengeId, 'cancel');
      } else {
        cancelBattleChallenge(challengeId);
      }
      await refreshChallenges();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Challenge could not be cancelled.');
    }
  };

  const ratingProgress = ((myRating.rating - PVP_RATING_MIN) / (PVP_RATING_MAX - PVP_RATING_MIN)) * 100;

  return (
    <div
      className="pvp-hub-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="pvp-hub-shell command-panel vine-frame flex max-h-[min(44rem,calc(100dvh-2rem))] w-[min(52rem,calc(100vw-2rem))] flex-col overflow-hidden rounded border text-zinc-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="arcane-label">Ranked Duels</p>
            <h3 className="fantasy-heading text-2xl">PVP</h3>
            <p className="ui-muted mt-1 text-sm font-bold">
              Challenge commanders and climb from {PVP_RATING_MIN} to {PVP_RATING_MAX} rating.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-button shrink-0 rounded px-3 py-2 text-xs font-black"
          >
            Close
          </button>
        </div>

        <div className="pvp-hub-rating-bar shrink-0 px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="arcane-label">Your Rating</div>
              <div className="fantasy-heading text-3xl">{formatPvpRating(myRating.rating)}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black">
              <span className="ui-pill rounded border px-3 py-1.5">{myRating.wins}W / {myRating.losses}L</span>
              {myRating.winStreak > 1 && (
                <span className="ui-pill rounded border px-3 py-1.5 text-emerald-200">{myRating.winStreak} win streak</span>
              )}
              {myRating.lossStreak > 1 && (
                <span className="ui-pill rounded border px-3 py-1.5 text-red-200">{myRating.lossStreak} loss streak</span>
              )}
            </div>
          </div>
          <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
            <div className="ui-progress-fill h-full" style={{ width: `${Math.max(4, ratingProgress)}%` }} />
          </div>
          <p className="ui-faint mt-2 text-[11px] font-bold">
            Wins swing 4–10 rating. Win streaks add bonus points; loss streaks increase penalties.
          </p>
        </div>

        <div className="pvp-hub-body no-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
          <p className="ui-muted mb-4 text-sm font-bold">
            Challenge a commander. They receive a duel popup to accept or decline.
          </p>

          {players.length === 0 && (
            <div className="ui-empty rounded border border-dashed px-4 py-8 text-center text-sm font-bold">
              No other commanders online locally.
            </div>
          )}

          <div className="pvp-hub-player-list space-y-3">
            {players.map(player => {
              const challenge = currentUser
                ? getChallengeForPlayer(challenges, currentUser.username, player.username)
                : undefined;
              const isIncoming = Boolean(challenge && challenge.targetUsername === currentUser?.username);
              const currentConfirmed = Boolean(challenge?.confirmedBy.includes(currentUser?.username || ''));
              const remaining = challenge ? getBattleChallengeTimeRemaining(challenge, now) : 0;
              const challengeRule = canChallengePlayer(currentUser, player);
              const opponentRating = getPvpRating(player);

              return (
                <div key={player.username} className="pvp-hub-player-card ui-card rounded border p-4">
                  <div className="flex items-center gap-3">
                    <div className="ui-icon-frame relative h-14 w-14 shrink-0 overflow-hidden rounded border">
                      <Image
                        src={getPlayerModelPath(player.selectedModel || 3)}
                        alt={player.username}
                        fill
                        className="player-model-art object-contain"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black">{player.username}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                        <span className="ui-muted">Lv {player.stats?.level || 1}</span>
                        <span className="ui-accent">{formatPvpRating(opponentRating.rating)} rating</span>
                        <span className="ui-faint">{opponentRating.wins}W / {opponentRating.losses}L</span>
                      </div>
                    </div>
                    {!challenge && (
                      <button
                        type="button"
                        disabled={!challengeRule.allowed}
                        onClick={() => {
                          emitFxEvent({ type: 'attack', tone: 'gold', intensity: 0.85 });
                          void handleChallenge(player.username);
                        }}
                        className="ui-button-primary shrink-0 rounded px-4 py-2.5 text-xs font-black disabled:opacity-40"
                      >
                        Challenge
                      </button>
                    )}
                  </div>

                  {challenge?.status === 'pending' && isIncoming && !currentConfirmed && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleConfirm(challenge.id)}
                        className="ui-button-primary flex-1 rounded px-3 py-2 text-xs font-black"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecline(challenge.id)}
                        className="ui-button-danger flex-1 rounded px-3 py-2 text-xs font-black"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {challenge?.status === 'pending' && !isIncoming && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="ui-pill rounded border px-3 py-2 text-xs font-black">
                        Waiting {formatChallengeTime(remaining)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCancel(challenge.id)}
                        className="ui-button rounded px-3 py-2 text-xs font-black"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {challenge?.status === 'ready' && (
                    <div className="ui-rarity-rare mt-3 rounded border px-3 py-2 text-xs font-black">
                      Duel Ready — launch from the world map when both sides are set.
                    </div>
                  )}

                  {(challengeRule.reason || challengeRule.warning) && !challenge && (
                    <p className="ui-muted mt-2 text-xs font-bold">{challengeRule.reason || challengeRule.warning}</p>
                  )}
                </div>
              );
            })}
          </div>

          {notice && (
            <div className="ui-notice mt-4 rounded border px-3 py-2 text-xs font-bold">
              {notice}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
