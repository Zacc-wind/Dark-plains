'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { getWorldPveIntel, type PveIntelEntry, type PveRewardLine } from '@/lib/worldPveIntel';
import { getMultiplayerUnlockStatus } from '@/lib/multiplayerUnlocks';
import MultiplayerFeatureLock from '@/components/MultiplayerFeatureLock';

interface PveHubModalProps {
  isOpen: boolean;
  onClose: () => void;
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

function PveIntelCard({ entry }: { entry: PveIntelEntry }) {
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
            <span className={`ui-pill rounded border px-2 py-0.5 text-[10px] font-black uppercase ${entry.kind === 'world-boss' ? 'text-amber-200' : entry.kind === 'regional-threat' ? 'text-fuchsia-200' : 'text-sky-200'}`}>
              {entry.kind === 'world-boss' ? 'World Boss' : entry.kind === 'regional-threat' ? 'Regional Threat' : 'Dungeon'}
            </span>
            <span className="ui-faint text-[10px] font-black uppercase">Lv {entry.level}</span>
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
            {entry.minUnitsRequired > 0 && (
              <div className="ui-faint mt-2 text-[11px] font-bold">
                Requires {entry.minUnitsRequired} fielded units to enter once found.
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
      </div>
    </article>
  );
}

export default function PveHubModal({ isOpen, onClose }: PveHubModalProps) {
  const [now, setNow] = useState(() => Date.now());
  const username = getCurrentUser()?.username ?? null;
  const currentUser = username ? getCurrentUser() : null;

  const pveIntel = useMemo(
    () => (isOpen ? getWorldPveIntel(currentUser, now) : []),
    [currentUser, isOpen, now],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, [isOpen]);

  if (!isOpen) return null;

  const pveUnlock = getMultiplayerUnlockStatus('dungeon-preview', currentUser);
  if (!pveUnlock.unlocked) {
    return (
      <div className="pve-hub-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/72 p-4" onClick={onClose}>
        <section
          className="pve-hub-shell command-panel vine-frame w-[min(40rem,calc(100vw-2rem))] overflow-hidden rounded border text-zinc-100 shadow-2xl"
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
        </section>
      </div>
    );
  }

  return (
    <div
      className="pve-hub-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="pve-hub-shell command-panel vine-frame flex max-h-[min(44rem,calc(100dvh-2rem))] w-[min(52rem,calc(100vw-2rem))] flex-col overflow-hidden rounded border text-zinc-100 shadow-2xl"
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
            Active spawns on the shared map. Rewards show lowest and highest likely payouts.
          </p>

          {pveIntel.length === 0 ? (
            <div className="ui-empty rounded border border-dashed px-4 py-8 text-center text-sm font-bold">
              No active dungeons or world bosses right now.
            </div>
          ) : (
            <div className="pve-hub-list space-y-4">
              {pveIntel.map(entry => (
                <PveIntelCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
