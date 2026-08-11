'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
  acceptFriendRequest,
  getCurrentUser,
  getFriendRecord,
  getPlayersAtLocation,
  getSocialState,
  invitePlayerToParty,
  sendFriendRequest,
  type User,
} from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';

interface PlayerListModalProps {
  isOpen: boolean;
  location: { x: number; y: number } | null;
  players?: User[];
  onClose: () => void;
}

export default function PlayerListModal({ isOpen, location, players: visiblePlayers, onClose }: PlayerListModalProps) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState<string | null>(null);
  const currentUser = getCurrentUser();
  const socialState = getSocialState(currentUser);
  const players = useMemo(() => {
    if (!isOpen || !location) return [];
    const sourcePlayers = visiblePlayers || getPlayersAtLocation(location.x, location.y);
    return sourcePlayers.filter(player => player.x === location.x && player.y === location.y);
  }, [isOpen, location, visiblePlayers]);

  if (!isOpen || !location) return null;

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
    action: () => Promise<{ success: boolean; message?: string; error?: string }> | { success: boolean; message?: string; error?: string },
  ) => {
    void Promise.resolve(action()).then(result => {
      setExpandedPlayer(username);
      setSocialNotice(result.message || result.error || (result.success ? 'Social action complete.' : 'Social action failed.'));
    });
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
                        sizes="48px"
                        className="player-model-art object-contain"
                        unoptimized
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
