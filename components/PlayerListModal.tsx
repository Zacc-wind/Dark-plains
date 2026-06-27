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
import {
  acceptFriendRequest,
  getCurrentUser,
  getFriendRecord,
  getPlayersAtLocation,
  getSocialState,
  invitePlayerToParty,
  sendFriendRequest,
} from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';
import {
  createOnlineBattleChallenge,
  fetchOnlineBattleChallenges,
  shouldUseOnlineChallenges,
  updateOnlineBattleChallenge,
} from '@/lib/pvpChallengeClient';

interface PlayerListModalProps {
  isOpen: boolean;
  location: { x: number; y: number } | null;
  onClose: () => void;
}

function formatChallengeTime(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

function getChallengeForPlayer(
  challenges: BattleChallenge[],
  currentUsername: string,
  targetUsername: string
): BattleChallenge | undefined {
  return challenges.find(challenge => {
    const participants = [challenge.challengerUsername, challenge.targetUsername];
    return (
      participants.includes(currentUsername) &&
      participants.includes(targetUsername) &&
      (challenge.status === 'pending' || challenge.status === 'ready')
    );
  });
}

export default function PlayerListModal({ isOpen, location, onClose }: PlayerListModalProps) {
  const [challenges, setChallenges] = useState<BattleChallenge[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState<string | null>(null);
  const currentUser = getCurrentUser();
  const socialState = getSocialState(currentUser);
  const onlineChallengesEnabled = shouldUseOnlineChallenges();
  const players = useMemo(() => {
    if (!isOpen || !location) return [];
    return getPlayersAtLocation(location.x, location.y);
  }, [isOpen, location]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const refresh = async () => {
      setNow(Date.now());
      if (!onlineChallengesEnabled) {
        setChallenges(getBattleChallenges());
        return;
      }

      try {
        const onlineChallenges = await fetchOnlineBattleChallenges();
        if (!cancelled) setChallenges(onlineChallenges);
      } catch (error) {
        if (!cancelled) {
          setChallenges(getBattleChallenges());
          setSocialNotice(error instanceof Error ? error.message : 'Online challenges failed to load.');
        }
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, onlineChallengesEnabled]);

  if (!isOpen || !location) return null;

  const refreshChallenges = async () => {
    if (!onlineChallengesEnabled) {
      setChallenges(getBattleChallenges());
      return;
    }

    try {
      setChallenges(await fetchOnlineBattleChallenges());
    } catch (error) {
      setChallenges(getBattleChallenges());
      setSocialNotice(error instanceof Error ? error.message : 'Online challenges failed to load.');
    }
  };

  const handleChallenge = async (targetUsername: string) => {
    const targetPlayer = players.find(player => player.username === targetUsername) || null;
    const challengeRule = canChallengePlayer(currentUser, targetPlayer);
    if (!challengeRule.allowed) {
      setExpandedPlayer(targetUsername);
      setSocialNotice(challengeRule.reason || 'Challenge blocked.');
      return;
    }

    try {
      const challenge = onlineChallengesEnabled
        ? await createOnlineBattleChallenge(targetUsername)
        : createBattleChallenge(targetUsername);

      if (challengeRule.warning) {
        setExpandedPlayer(targetUsername);
        setSocialNotice(challengeRule.warning);
      } else {
        setSocialNotice(challenge ? null : 'Challenge could not be created.');
      }
      await refreshChallenges();
    } catch (error) {
      setExpandedPlayer(targetUsername);
      setSocialNotice(error instanceof Error ? error.message : 'Challenge could not be created.');
    }
  };

  const handleConfirm = async (challengeId: string) => {
    try {
      if (onlineChallengesEnabled) {
        await updateOnlineBattleChallenge(challengeId, 'confirm');
      } else {
        confirmBattleChallenge(challengeId);
      }
      await refreshChallenges();
    } catch (error) {
      setSocialNotice(error instanceof Error ? error.message : 'Challenge could not be confirmed.');
    }
  };

  const handleDecline = async (challengeId: string) => {
    try {
      if (onlineChallengesEnabled) {
        await updateOnlineBattleChallenge(challengeId, 'decline');
      } else {
        declineBattleChallenge(challengeId);
      }
      await refreshChallenges();
    } catch (error) {
      setSocialNotice(error instanceof Error ? error.message : 'Challenge could not be declined.');
    }
  };

  const handleCancel = async (challengeId: string) => {
    try {
      if (onlineChallengesEnabled) {
        await updateOnlineBattleChallenge(challengeId, 'cancel');
      } else {
        cancelBattleChallenge(challengeId);
      }
      await refreshChallenges();
    } catch (error) {
      setSocialNotice(error instanceof Error ? error.message : 'Challenge could not be cancelled.');
    }
  };

  const handleInspect = (username: string) => {
    setExpandedPlayer(current => current === username ? null : username);
    setSocialNotice(null);
  };

  const handleDeferredAction = (label: string, username: string) => {
    setExpandedPlayer(username);
    setSocialNotice(`${label} writ prepared for ${username}.`);
  };

  const handleSocialAction = (
    username: string,
    action: () => { success: boolean; message?: string; error?: string }
  ) => {
    const result = action();
    setExpandedPlayer(username);
    setSocialNotice(result.message || result.error || (result.success ? 'Social action complete.' : 'Social action failed.'));
  };

  const otherPlayers = currentUser
    ? players.filter(player => player.username !== currentUser.username)
    : players;

  return (
    <aside className="command-panel vine-frame pointer-events-auto fixed bottom-5 left-5 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded border text-zinc-100">
      <div className="panel-header flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="fantasy-heading text-base">Players Here</h3>
          <p className="arcane-label text-[10px]">
            Same map tile
          </p>
        </div>
        <button
          onClick={onClose}
          className="ui-button rounded px-2 py-1 text-xs font-bold"
        >
          Close
        </button>
      </div>

      <div className="p-4">
        {otherPlayers.length === 0 ? (
          <div className="ui-empty rounded border border-dashed px-4 py-5 text-center text-sm font-bold">
            No other players at this location.
          </div>
        ) : (
          <div className="space-y-2">
            {otherPlayers.map((player) => {
              const challenge = currentUser
                ? getChallengeForPlayer(challenges, currentUser.username, player.username)
                : undefined;
              const isIncoming = Boolean(challenge && challenge.targetUsername === currentUser?.username);
              const currentConfirmed = Boolean(challenge?.confirmedBy.includes(currentUser?.username || ''));
              const remaining = challenge ? getBattleChallengeTimeRemaining(challenge, now) : 0;
              const challengeRule = canChallengePlayer(currentUser, player);
              const friendRecord = getFriendRecord(currentUser, player.username);
              const isFriend = friendRecord?.status === 'accepted';
              const incomingFriendRequest = Boolean(
                friendRecord?.status === 'pending' &&
                currentUser &&
                friendRecord.requestedBy.toLowerCase() !== currentUser.username.toLowerCase()
              );
              const isPartyMember = Boolean(
                socialState.party?.memberUsernames.some(username => username.toLowerCase() === player.username.toLowerCase())
              );

              return (
                <div
                  key={player.username}
                  className="ui-card rounded border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="ui-icon-frame relative h-12 w-12 shrink-0 overflow-hidden rounded border">
                      <Image
                        src={getPlayerModelPath(player.selectedModel || 3)}
                        alt={player.username}
                        fill
                        className="player-model-art object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-zinc-100">{player.username}</p>
                      <div className="ui-faint mt-1 flex gap-3 text-xs font-bold">
                        <span>Lv {player.stats?.level || 1}</span>
                        <span>{player.minions?.length || 0} units</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {!challenge && (
                      <button
                        onClick={() => handleChallenge(player.username)}
                        disabled={!challengeRule.allowed}
                        className="ui-button-primary rounded px-3 py-2 text-xs font-bold disabled:opacity-40"
                      >
                        Challenge
                      </button>
                    )}

                    <button
                      onClick={() => handleInspect(player.username)}
                      className="ui-button rounded px-3 py-2 text-xs font-bold"
                    >
                      Inspect
                    </button>
                    <button
                      onClick={() => handleDeferredAction('Trade', player.username)}
                      className="ui-button rounded px-3 py-2 text-xs font-bold"
                    >
                      Trade
                    </button>
                    <button
                      onClick={() => handleDeferredAction('Message', player.username)}
                      className="ui-button rounded px-3 py-2 text-xs font-bold"
                    >
                      Message
                    </button>
                    <button
                      onClick={() => handleSocialAction(
                        player.username,
                        () => incomingFriendRequest
                          ? acceptFriendRequest(player.username)
                          : sendFriendRequest(player.username)
                      )}
                      disabled={isFriend || (friendRecord?.status === 'pending' && !incomingFriendRequest)}
                      className="ui-button rounded px-3 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      {isFriend ? 'Friend' : incomingFriendRequest ? 'Accept' : friendRecord?.status === 'pending' ? 'Pending' : 'Add Friend'}
                    </button>
                    <button
                      onClick={() => handleSocialAction(player.username, () => invitePlayerToParty(player.username))}
                      disabled={isPartyMember}
                      className="ui-button rounded px-3 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      {isPartyMember ? 'In Party' : 'Invite Party'}
                    </button>
                  </div>

                  {(challengeRule.reason || challengeRule.warning) && (
                    <div className={`mt-3 rounded border px-3 py-2 text-xs font-bold ${
                      challengeRule.allowed
                        ? 'border-amber-300/30 bg-amber-950/24 text-amber-100'
                        : 'border-sky-300/30 bg-sky-950/24 text-sky-100'
                    }`}>
                      {challengeRule.reason || challengeRule.warning}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">

                    {challenge?.status === 'pending' && isIncoming && !currentConfirmed && (
                      <>
                        <button
                          onClick={() => handleConfirm(challenge.id)}
                          className="ui-button-primary rounded px-3 py-2 text-xs font-bold"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleDecline(challenge.id)}
                          className="ui-button-danger rounded px-3 py-2 text-xs font-bold"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {challenge?.status === 'pending' && !isIncoming && (
                      <>
                        <span className="ui-pill rounded border px-3 py-2 text-xs font-black text-[var(--ui-accent)]">
                          Waiting {formatChallengeTime(remaining)}
                        </span>
                        <button
                          onClick={() => handleCancel(challenge.id)}
                          className="ui-button rounded px-3 py-2 text-xs font-bold"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {challenge?.status === 'pending' && isIncoming && currentConfirmed && (
                      <span className="ui-pill rounded border px-3 py-2 text-xs font-black text-[var(--ui-accent)]">
                        Waiting {formatChallengeTime(remaining)}
                      </span>
                    )}

                    {challenge?.status === 'ready' && (
                      <span className="ui-rarity-rare rounded border px-3 py-2 text-xs font-black">
                        Duel Ready
                      </span>
                    )}
                  </div>

                  {expandedPlayer === player.username && (
                    <div className="ui-pill mt-3 rounded border p-3 text-xs font-bold text-[var(--ui-muted)]">
                      <div className="grid grid-cols-2 gap-2">
                        <span>Army {player.stats?.armyPower ?? player.stats?.attack ?? 5}</span>
                        <span>Ward {player.stats?.defensivePower ?? player.stats?.defense ?? 5}</span>
                        <span>Morale {player.stats?.morale ?? player.stats?.speed ?? 5}</span>
                        <span>Spell {player.stats?.spellPower ?? 3}</span>
                      </div>
                      {socialNotice && (
                        <div className="mt-2 border-t border-white/10 pt-2 text-[var(--ui-accent)]">
                          {socialNotice}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
