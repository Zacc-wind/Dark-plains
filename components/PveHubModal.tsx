'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser, getPartyMembers, getSocialState } from '@/lib/auth';
import {
  ensureCurrentCoopRaidSession,
  getCoopRaidSessions,
  getCurrentCoopRaidSession,
} from '@/lib/coopRaidClient';
import { getWorldPveIntel, type PveIntelEntry, type PveRewardLine } from '@/lib/worldPveIntel';
import { getMultiplayerUnlockStatus } from '@/lib/multiplayerUnlocks';
import { formatDungeonTier } from '@/lib/worldEvents';
import MultiplayerFeatureLock from '@/components/MultiplayerFeatureLock';
import CinematicScrollShell from '@/components/CinematicScrollShell';

interface PveHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PveRaidAction {
  label: string;
  detail: string;
  disabled: boolean;
  onClick: () => void;
}

function PveRewardRow({ reward }: { reward: PveRewardLine }) {
  return (
    <div className="pve-hub-reward-row rounded border px-3 py-2.5">
      <span className="pve-hub-reward-icon relative h-10 w-10 shrink-0 overflow-hidden rounded border">
        <Image
          src={reward.iconPath}
          alt=""
          fill
          className="object-contain p-1"
          style={{ imageRendering: 'pixelated' }}
          unoptimized
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-black text-zinc-100">{reward.label}</span>
          <span className="ui-accent text-xs font-black">
            {reward.minLabel} – {reward.maxLabel}
          </span>
        </div>
        {reward.detail && (
          <p className="ui-muted mt-0.5 text-[11px] font-bold leading-snug">{reward.detail}</p>
        )}
      </div>
    </div>
  );
}

function PveIntelCard({ entry, raidAction }: { entry: PveIntelEntry; raidAction?: PveRaidAction }) {
  const isCoopBoss = entry.kind === 'coop-boss';
  return (
    <article className="pve-hub-card ui-card overflow-hidden rounded border">
      <div className="pve-hub-card-hero">
        {entry.bossArtworkPath ? (
          <div className="pve-hub-card-art relative">
            <Image
              src={entry.bossArtworkPath}
              alt={entry.bossName}
              fill
              className="pve-hub-boss-sprite object-contain object-bottom"
              unoptimized
              priority
            />
          </div>
        ) : null}

        <div className="pve-hub-card-copy min-w-0 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`ui-pill rounded border px-2 py-0.5 text-[10px] font-black uppercase ${entry.kind === 'world-boss' ? 'text-amber-200' : entry.kind === 'regional-threat' ? 'text-fuchsia-200' : isCoopBoss ? 'text-rose-200' : 'text-sky-200'}`}>
              {entry.kind === 'world-boss' ? 'World Boss' : entry.kind === 'regional-threat' ? 'Regional Threat' : isCoopBoss ? 'Duo Raid' : 'Dungeon'}
            </span>
            <span className="ui-faint text-[10px] font-black uppercase">Lv {entry.level}</span>
            {entry.kind === 'dungeon' && entry.dungeonTier && (
              <span className="ui-faint text-[10px] font-black uppercase">
                Tier {formatDungeonTier(entry.dungeonTier)}{entry.requiredPlayerLevel ? ` - Entry Lv ${entry.requiredPlayerLevel}` : ''}
              </span>
            )}
            <span className="ui-faint text-[10px] font-black uppercase">{entry.expiresLabel} left</span>
          </div>
          <h4 className="fantasy-heading mt-2 text-xl leading-tight">{entry.name}</h4>
          <p className="ui-muted mt-1 text-sm font-bold leading-relaxed">{entry.description}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
            <div className="ui-pill rounded border px-3 py-2">
              <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">Region</div>
              <div className="ui-value mt-0.5 text-sm font-black">{entry.regionName}</div>
              <div className="ui-faint mt-0.5 text-[10px]">Levels {entry.regionLevels}</div>
            </div>
            <div className="ui-pill rounded border px-3 py-2">
              <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">Search Here</div>
              <div className="ui-value mt-0.5 text-sm font-black">{entry.directionHint}</div>
              <div className="ui-faint mt-0.5 text-[10px]">Explore the region — no exact pin</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-black text-zinc-100">{entry.bossName}</div>
            <div className="ui-muted text-xs font-bold">{entry.bossSubtitle}</div>
            {isCoopBoss && (
              <div className="ui-accent mt-2 text-[11px] font-black uppercase">
                {entry.requiredPlayers} commanders - {entry.phaseCount} phases - 15 sec turns
              </div>
            )}
            {entry.minUnitsRequired > 0 && (
              <div className="ui-faint mt-2 text-[11px] font-bold">
                {isCoopBoss
                  ? `Each commander fields up to ${entry.minUnitsRequired} units.`
                  : `Requires ${entry.minUnitsRequired} fielded units to enter once found.`}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[rgba(232,217,184,0.12)] p-4">
        <div className="arcane-label mb-2">Possible Rewards</div>
        <div className="space-y-2">
          {entry.rewards.map(reward => (
            <PveRewardRow key={`${entry.id}-${reward.id}`} reward={reward} />
          ))}
        </div>
        {raidAction && (
          <div className="mt-4 flex flex-col gap-2 border-t border-[rgba(232,217,184,0.1)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="ui-muted min-w-0 text-xs font-bold">{raidAction.detail}</p>
            <button
              type="button"
              disabled={raidAction.disabled}
              onClick={raidAction.onClick}
              className="ui-button-primary shrink-0 rounded px-4 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              {raidAction.label}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function PveHubModal({ isOpen, onClose }: PveHubModalProps) {
  const [now, setNow] = useState(() => Date.now());
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());
  const [notice, setNotice] = useState<string | null>(null);

  const pveIntel = useMemo(
    () => (isOpen ? getWorldPveIntel(currentUser, now) : []),
    [currentUser, isOpen, now],
  );
  const currentRaid = useMemo(
    () => (currentUser ? getCurrentCoopRaidSession(currentUser.username, now) : undefined),
    [currentUser, now],
  );
  const participantRaids = useMemo(() => {
    if (!currentUser) return [];
    const username = currentUser.username.toLowerCase();
    return getCoopRaidSessions(now).filter(session => (
      session.hostUsername.toLowerCase() === username
      || session.allyUsername.toLowerCase() === username
    ));
  }, [currentUser, now]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const refresh = () => {
      setNow(Date.now());
      setCurrentUser(getCurrentUser());
    };
    const openRefresh = window.setTimeout(refresh, 0);
    const clock = window.setInterval(refresh, 1000);
    return () => {
      window.clearTimeout(openRefresh);
      window.clearInterval(clock);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const pveUnlock = getMultiplayerUnlockStatus('dungeon-preview', currentUser);
  if (!pveUnlock.unlocked) {
    return (
      <div className="pve-hub-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/72 p-4" onClick={onClose}>
        <CinematicScrollShell
          variant="surface"
          className="pve-hub-shell w-[min(40rem,calc(100vw-2rem))] overflow-hidden text-zinc-100"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="panel-header flex items-center justify-between gap-4 border-b px-5 py-4">
            <div>
              <p className="arcane-label">World Map Threats</p>
              <h2 className="fantasy-heading text-2xl">PVE Preview</h2>
            </div>
            <button type="button" onClick={onClose} className="ui-button rounded px-3 py-2 text-xs font-black">Close</button>
          </div>
          <div className="p-5"><MultiplayerFeatureLock status={pveUnlock} /></div>
        </CinematicScrollShell>
      </div>
    );
  }

  const coopUnlock = getMultiplayerUnlockStatus('coop-dungeons', currentUser);
  const party = getSocialState(currentUser).party;
  const partyMembers = getPartyMembers(currentUser);
  const isPartyLeader = Boolean(
    currentUser
    && party
    && party.leaderUsername.toLowerCase() === currentUser.username.toLowerCase()
  );

  const getRaidAction = (entry: PveIntelEntry): PveRaidAction | undefined => {
    if (entry.kind !== 'coop-boss') return undefined;

    const raidForBoss = participantRaids.find(session => session.bossId === entry.id);
    const currentUsername = currentUser?.username.toLowerCase() || '';
    const currentClaimed = Boolean(raidForBoss?.result?.claimReceipts.some(receipt => (
      receipt.username.toLowerCase() === currentUsername
    )));
    const allReportsClosed = Boolean(raidForBoss?.result && raidForBoss.result.claimReceipts.length >= 2);
    let label = 'Prepare Raid';
    let detail = 'Two level 5 commanders, each with a fielded unit.';
    let disabled = false;

    if (raidForBoss?.result?.outcome === 'victory' && currentClaimed) {
      label = 'Raid Cleared';
      detail = 'Your loot from this incursion has already been claimed.';
      disabled = true;
    } else if (
      raidForBoss?.phase === 'completed'
      && raidForBoss.result?.outcome !== 'victory'
      && currentClaimed
      && !allReportsClosed
    ) {
      label = 'Awaiting Party';
      detail = 'Your ally must close the shared raid report before the duo can retry.';
      disabled = true;
    } else if (currentRaid?.bossId === entry.id) {
      label = currentRaid.phase === 'completed' ? 'View Raid Report' : 'Resume Raid';
      detail = currentRaid.phase === 'formation'
        ? 'Return to formation and readiness.'
        : currentRaid.phase === 'active'
          ? 'Return to the synchronized battle.'
          : 'Review and claim your raid result.';
    } else if (currentRaid) {
      label = 'Raid In Progress';
      detail = `Finish ${currentRaid.bossSnapshot.name} before preparing another incursion.`;
      disabled = true;
    } else if (!coopUnlock.unlocked) {
      label = `Unlocks Lv ${coopUnlock.minLevel}`;
      detail = coopUnlock.description;
      disabled = true;
    } else if (!party) {
      label = 'Party Required';
      detail = 'Create a party and invite one commander from Chat.';
      disabled = true;
    } else if (partyMembers.length !== 2) {
      label = 'Duo Required';
      detail = 'This raid requires exactly two accepted party members.';
      disabled = true;
    } else if (!isPartyLeader) {
      label = 'Leader Prepares';
      detail = `${party.leaderUsername} must open the raid session.`;
      disabled = true;
    }

    return {
      label,
      detail,
      disabled,
      onClick: () => {
        if (disabled) return;
        const result = ensureCurrentCoopRaidSession(entry.id);
        if (!result.success) {
          setNotice(result.error || 'Could not prepare this raid.');
          return;
        }
        setNotice(null);
        onClose();
      },
    };
  };

  return (
    <div
      className="pve-hub-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/72 p-4"
      onClick={onClose}
    >
      <CinematicScrollShell
        variant="surface"
        className="pve-hub-shell flex max-h-[min(48rem,calc(100dvh-1rem))] w-[min(58rem,calc(100vw-1rem))] flex-col overflow-hidden text-zinc-100"
        contentClassName="flex min-h-0 flex-1 flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="arcane-label">World Map Threats</p>
            <h3 className="fantasy-heading text-2xl">PVE</h3>
            <p className="ui-muted mt-1 text-sm font-bold">
              Live dungeons and roaming bosses — hunt by region and direction.
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

        <div className="pve-hub-body no-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
          <p className="ui-muted mb-4 text-sm font-bold">
            Active threats by region. Duo raids rotate every five hours and require two prepared commanders.
          </p>

          {notice && (
            <div className="mb-4 rounded border border-red-400/35 bg-red-950/35 px-4 py-3 text-sm font-bold text-red-100">
              {notice}
            </div>
          )}

          {pveIntel.length === 0 ? (
            <div className="ui-empty rounded border border-dashed px-4 py-8 text-center text-sm font-bold">
              No active dungeons or world bosses right now.
            </div>
          ) : (
            <div className="pve-hub-list space-y-4">
              {pveIntel.map(entry => (
                <PveIntelCard key={entry.id} entry={entry} raidAction={getRaidAction(entry)} />
              ))}
            </div>
          )}
        </div>
      </CinematicScrollShell>
    </div>
  );
}
