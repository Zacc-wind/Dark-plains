'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  claimCurrentMultiplayerChronicleRank,
  getInventoryItemDefinition,
  getMultiplayerChronicleView,
  type RewardSummary,
  type User,
} from '@/lib/auth';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import type { ChronicleRankReward } from '@/lib/multiplayerChronicle';
import { getPlayerModelPath } from '@/lib/assetLoader';

interface MultiplayerChroniclePanelProps {
  now: number;
  player: User;
  onPlayerRefresh: () => void;
}

const RENOWN_SOURCES = [
  { source: 'Daily order claim', value: '+18', limit: 'Every claimed order' },
  { source: 'Weekly faction oath', value: '+60', limit: 'Every claimed oath' },
  { source: 'Authored story quest', value: '+28', limit: 'Every completed quest' },
  { source: 'Regional threat', value: '+55', limit: 'Every claimed rotation' },
  { source: 'City contract', value: '+12', limit: 'First 3 each day' },
  { source: 'First weekly battle win', value: '+20', limit: 'Once each week' },
  { source: 'First weekly dungeon', value: '+35', limit: 'Once each week' },
  { source: 'Road jobs and social play', value: '+4 to +22', limit: 'Daily or weekly caps' },
];

function rewardPresentation(reward: ChronicleRankReward): { iconPath: string; label: string } {
  if (reward.gold) return { iconPath: '/assets/icons/gold.png', label: `${reward.gold} gold` };
  if (reward.rareGems) return { iconPath: '/assets/icons/rare-gem.png', label: `${reward.rareGems} rare gem${reward.rareGems === 1 ? '' : 's'}` };
  if (reward.itemId) {
    const definition = getInventoryItemDefinition(reward.itemId);
    return {
      iconPath: definition?.imagePath || '/assets/icons/loot-chest.png',
      label: `${reward.itemQuantity || 1}x ${definition?.name || reward.itemId}`,
    };
  }
  if (reward.entitlement) {
    const iconPath = reward.entitlement.kind === 'frame'
      ? '/assets/icons/defense.png'
      : reward.entitlement.kind === 'lore'
        ? '/assets/icons/magic.png'
        : '/assets/icons/attack.png';
    return { iconPath, label: reward.entitlement.label };
  }
  return { iconPath: '/assets/icons/magic.png', label: 'Chronicle reward' };
}

function completionRewardLines(rewards?: RewardSummary): CompletionRewardLine[] {
  if (!rewards) return [];
  const lines: CompletionRewardLine[] = [];
  if (rewards.gold) lines.push({ label: 'Gold', value: `+${rewards.gold}`, tone: 'gold' });
  if (rewards.rareGems) lines.push({ label: 'Rare Gems', value: `+${rewards.rareGems}`, tone: 'violet' });
  rewards.items?.forEach(item => lines.push({ label: item.name, value: `+${item.quantity}`, tone: 'neutral' }));
  return lines;
}

export default function MultiplayerChroniclePanel({
  now,
  player,
  onPlayerRefresh,
}: MultiplayerChroniclePanelProps) {
  const [notice, setNotice] = useState('');
  const view = getMultiplayerChronicleView(player, now);

  if (!view) return null;

  const progressPercent = view.currentRank >= view.ranks.length
    ? 100
    : Math.min(100, (view.progressIntoRank / view.progressTarget) * 100);

  const handleClaim = (rankNumber: number, title: string) => {
    const result = claimCurrentMultiplayerChronicleRank(rankNumber, now);
    setNotice(result.success ? `Rank ${rankNumber} reward claimed.` : result.error || 'Could not claim Chronicle reward.');
    if (result.success) {
      emitCompletionNotice({
        id: `chronicle-rank-${rankNumber}-${now}`,
        kind: 'quest',
        kicker: 'Banner Chronicle',
        title: `Rank ${rankNumber}: ${title}`,
        description: 'Marshal Orren recorded the reward in the Black Pike Ledger.',
        rewards: completionRewardLines(result.rewards),
      });
    }
    onPlayerRefresh();
  };

  return (
    <div className="multiplayer-chronicle-panel">
      {notice && <div className="ui-notice border-b px-5 py-3 text-sm font-bold sm:px-6">{notice}</div>}

      <section className="multiplayer-chronicle-summary border-b px-5 py-5 sm:px-6">
        <div className="multiplayer-chronicle-guide" aria-hidden="true">
          <Image
            src={getPlayerModelPath(1)}
            alt=""
            fill
            sizes="96px"
            className="object-contain object-bottom"
            unoptimized
          />
        </div>
        <div className="min-w-0">
          <p className="arcane-label">Season Zero - {view.guideName}</p>
          <h3 className="fantasy-heading text-xl sm:text-2xl">{view.title}</h3>
          <p className="ui-muted mt-1 text-xs font-bold sm:text-sm">{view.subtitle}. Earn Renown from real shared-world actions and claim each unlocked entry.</p>
          <div className="ui-progress-track mt-4 h-2 overflow-hidden rounded border" aria-label={`${view.state.renown} Renown`}>
            <div className="ui-progress-fill h-full" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="ui-faint mt-2 flex flex-wrap justify-between gap-2 text-[10px] font-black uppercase">
            <span>{view.state.renown} total Renown</span>
            <span>{view.currentRank >= view.ranks.length ? 'Ledger complete' : `${view.nextRankRenown - view.state.renown} to rank ${view.currentRank + 1}`}</span>
          </div>
        </div>
        <div className="multiplayer-chronicle-rank-summary">
          <strong>{view.currentRank}/20</strong>
          <span>Ranks open</span>
          {view.claimableCount > 0 && <em>{view.claimableCount} ready</em>}
        </div>
      </section>

      <section className="border-b px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="arcane-label">Permanent Free Track</p>
            <h3 className="fantasy-heading text-xl">Ledger Entries</h3>
          </div>
          <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">50 Renown per rank</span>
        </div>
        <div className="multiplayer-chronicle-ranks mt-4">
          {view.ranks.map(rank => {
            const milestone = rank.rank % 5 === 0;
            const status = rank.claimed ? 'claimed' : rank.unlocked ? 'claimable' : 'locked';
            return (
              <article key={rank.id} className={`multiplayer-chronicle-rank is-${status} ${milestone ? 'is-milestone' : ''}`}>
                <div className="multiplayer-chronicle-rank-head">
                  <span className="multiplayer-chronicle-rank-number">{rank.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="arcane-label">{milestone ? 'Milestone' : `${rank.renownRequired} Renown`}</p>
                    <h4 className="fantasy-heading text-sm">{rank.title}</h4>
                  </div>
                  <span className="multiplayer-chronicle-rank-state">{rank.claimed ? 'Claimed' : rank.unlocked ? 'Ready' : 'Locked'}</span>
                </div>
                <div className="multiplayer-chronicle-rewards">
                  {rank.rewards.map((reward, index) => {
                    const presentation = rewardPresentation(reward);
                    return (
                      <div key={`${rank.id}-reward-${index}`} className="multiplayer-chronicle-reward">
                        <span className="relative h-8 w-8 shrink-0">
                          <Image src={presentation.iconPath} alt="" fill sizes="32px" className="object-contain p-1" unoptimized />
                        </span>
                        <span>{presentation.label}</span>
                      </div>
                    );
                  })}
                </div>
                {rank.unlocked && !rank.claimed ? (
                  <button type="button" onClick={() => handleClaim(rank.rank, rank.title)} className="ui-button-primary mt-auto rounded px-3 py-2 text-xs font-black">
                    Claim Rank {rank.rank}
                  </button>
                ) : (
                  <p className="ui-faint mt-auto pt-3 text-[10px] font-black uppercase">
                    {rank.claimed ? 'Recorded in your ledger' : `${view.state.renown}/${rank.renownRequired} Renown`}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="multiplayer-chronicle-sources border-b px-5 py-5 sm:px-6">
        <p className="arcane-label">Renown Rules</p>
        <h3 className="fantasy-heading text-xl">What Advances The Ledger</h3>
        <div className="multiplayer-chronicle-source-list mt-4">
          {RENOWN_SOURCES.map(entry => (
            <div key={entry.source}>
              <strong>{entry.source}</strong>
              <span>{entry.limit}</span>
              <em>{entry.value}</em>
            </div>
          ))}
        </div>
        <p className="ui-faint mt-3 text-xs font-bold">Chat messages never grant Renown. Repeated jobs, social actions, battles, and dungeons are capped to keep the track tied to varied play.</p>
      </section>

      <section className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="arcane-label">Permanent Collection</p>
            <h3 className="fantasy-heading text-xl">Recorded Honors</h3>
          </div>
          <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">{view.state.entitlements.length} acquired</span>
        </div>
        {view.state.entitlements.length > 0 ? (
          <div className="multiplayer-chronicle-entitlements mt-4">
            {view.state.entitlements.map(item => (
              <article key={item.id}>
                <span>{item.kind}</span>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="ui-empty mt-4 rounded border border-dashed px-5 py-8 text-center">
            <div className="fantasy-heading text-base">No honors recorded</div>
            <p className="ui-muted mt-2 text-xs font-bold">Lore begins at rank 3. The first banner pattern opens at rank 5.</p>
          </div>
        )}
      </section>
    </div>
  );
}
