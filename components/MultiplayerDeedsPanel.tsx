'use client';

import { useState } from 'react';
import {
  claimCurrentMultiplayerDeed,
  claimCurrentMultiplayerReputationTier,
  getMultiplayerDeedsView,
  getMultiplayerReputationView,
  type RewardSummary,
  type User,
} from '@/lib/auth';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import type { ReputationFactionId } from '@/lib/multiplayerReputation';

interface MultiplayerDeedsPanelProps {
  now: number;
  player: User;
  onPlayerRefresh: () => void;
}

function completionRewardLines(rewards?: RewardSummary): CompletionRewardLine[] {
  if (!rewards) return [];
  const lines: CompletionRewardLine[] = [];
  if (rewards.gold) lines.push({ label: 'Gold', value: `+${rewards.gold}`, tone: 'gold' });
  if (rewards.rareGems) lines.push({ label: 'Rare Gems', value: `+${rewards.rareGems}`, tone: 'violet' });
  rewards.items?.forEach(item => lines.push({ label: item.name, value: `+${item.quantity}`, tone: 'neutral' }));
  rewards.spellIds?.forEach(spellId => lines.push({ label: 'Spell', value: spellId, tone: 'blue' }));
  return lines;
}

function formatRewardBits(bits: {
  gold?: number;
  rareGems?: number;
  entitlementLabel?: string;
  spellIds?: string[];
  itemLabel?: string;
}): string {
  const parts: string[] = [];
  if (bits.gold) parts.push(`${bits.gold} gold`);
  if (bits.rareGems) parts.push(`${bits.rareGems} gem${bits.rareGems === 1 ? '' : 's'}`);
  if (bits.itemLabel) parts.push(bits.itemLabel);
  if (bits.spellIds?.length) parts.push(bits.spellIds.join(', '));
  if (bits.entitlementLabel) parts.push(bits.entitlementLabel);
  return parts.join(' · ') || 'Honor reward';
}

export default function MultiplayerDeedsPanel({
  now,
  player,
  onPlayerRefresh,
}: MultiplayerDeedsPanelProps) {
  const [notice, setNotice] = useState('');
  const deedsView = getMultiplayerDeedsView(player, now);
  const reputationView = getMultiplayerReputationView(player, now);

  if (!deedsView || !reputationView) return null;

  const handleDeedClaim = (deedId: string, title: string) => {
    const result = claimCurrentMultiplayerDeed(deedId, now);
    setNotice(result.success ? `${title} claimed.` : result.error || 'Could not claim deed.');
    if (result.success) {
      emitCompletionNotice({
        id: `deed-${deedId}-${now}`,
        kind: 'quest',
        kicker: 'Campaign Deed',
        title,
        description: 'Your banner record was stamped with a permanent honor.',
        rewards: completionRewardLines(result.rewards),
      });
    }
    onPlayerRefresh();
  };

  const handleReputationClaim = (factionId: ReputationFactionId, tier: number, title: string) => {
    const result = claimCurrentMultiplayerReputationTier(factionId, tier, now);
    setNotice(result.success ? `${title} claimed.` : result.error || 'Could not claim reputation tier.');
    if (result.success) {
      emitCompletionNotice({
        id: `reputation-${factionId}-${tier}-${now}`,
        kind: 'quest',
        kicker: 'Faction Reputation',
        title,
        description: 'Standing rewards were added to your commander.',
        rewards: completionRewardLines(result.rewards),
      });
    }
    onPlayerRefresh();
  };

  const honorCount = deedsView.state.entitlements.length + reputationView.state.entitlements.length;

  return (
    <div className="multiplayer-deeds-panel">
      {notice && <div className="ui-notice border-b px-5 py-3 text-sm font-bold sm:px-6">{notice}</div>}

      <section className="border-b px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="arcane-label">Town Boards</p>
            <h3 className="fantasy-heading text-xl">Faction Reputation</h3>
            <p className="ui-muted mt-1 text-xs font-bold sm:text-sm">
              Candle Compact and Blackwater League gain standing from matching city contracts (4/day each).
            </p>
          </div>
          <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">
            {reputationView.claimableCount > 0 ? `${reputationView.claimableCount} ready` : 'Standing tracks'}
          </span>
        </div>

        <div className="multiplayer-reputation-list mt-4">
          {reputationView.factions.map(faction => {
            const next = faction.nextTier;
            const progressTarget = next?.standingRequired || faction.tiers.at(-1)?.standingRequired || 1;
            const progressPercent = Math.min(100, (faction.standing / progressTarget) * 100);
            return (
              <article
                key={faction.id}
                className={`multiplayer-reputation-card ${faction.unlocked ? '' : 'is-locked'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="arcane-label">{faction.unlocked ? 'Open track' : `Unlocks at level ${faction.unlockLevel}`}</p>
                    <h4 className="fantasy-heading text-base">{faction.name}</h4>
                    <p className="ui-muted mt-1 text-xs font-bold">{faction.subtitle}</p>
                  </div>
                  <div className="multiplayer-reputation-standing">
                    <strong>{faction.standing}</strong>
                    <span>Standing</span>
                  </div>
                </div>
                <div className="ui-progress-track mt-3 h-1.5 overflow-hidden rounded border">
                  <div className="ui-progress-fill h-full" style={{ width: `${faction.unlocked ? progressPercent : 0}%` }} />
                </div>
                <div className="ui-faint mt-2 flex flex-wrap justify-between gap-2 text-[10px] font-black uppercase">
                  <span>
                    {next
                      ? `${Math.max(0, next.standingRequired - faction.standing)} to ${next.title}`
                      : 'All tiers claimed'}
                  </span>
                  <span>{faction.claimedTiers.length}/{faction.tiers.length} claimed</span>
                </div>
                <div className="multiplayer-reputation-tiers mt-3">
                  {faction.tiers.map(tier => {
                    const claimed = faction.claimedTiers.includes(tier.tier);
                    const claimable = faction.unlocked && faction.standing >= tier.standingRequired && !claimed;
                    const rewardLabel = formatRewardBits({
                      gold: tier.rewards.reduce((sum, reward) => sum + (reward.gold || 0), 0) || undefined,
                      rareGems: tier.rewards.reduce((sum, reward) => sum + (reward.rareGems || 0), 0) || undefined,
                      spellIds: tier.rewards.flatMap(reward => reward.spellIds || []),
                      entitlementLabel: tier.rewards.find(reward => reward.entitlement)?.entitlement?.label,
                      itemLabel: tier.rewards.find(reward => reward.itemId)
                        ? `${tier.rewards.find(reward => reward.itemId)?.itemQuantity || 1}x item`
                        : undefined,
                    });
                    return (
                      <div key={`${faction.id}-${tier.tier}`} className={`multiplayer-reputation-tier is-${claimed ? 'claimed' : claimable ? 'claimable' : 'locked'}`}>
                        <div className="min-w-0">
                          <strong>{tier.title}</strong>
                          <span>{tier.standingRequired} standing · {rewardLabel}</span>
                        </div>
                        {claimable ? (
                          <button
                            type="button"
                            onClick={() => handleReputationClaim(faction.id, tier.tier, tier.title)}
                            className="ui-button-primary rounded px-3 py-2 text-xs font-black"
                          >
                            Claim
                          </button>
                        ) : (
                          <em>{claimed ? 'Claimed' : faction.unlocked ? 'Locked' : `Lv ${faction.unlockLevel}`}</em>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-b px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="arcane-label">Account Records</p>
            <h3 className="fantasy-heading text-xl">Campaign Deeds</h3>
            <p className="ui-muted mt-1 text-xs font-bold sm:text-sm">
              Permanent multiplayer achievements with cosmetic stamps and modest catch-up pay.
            </p>
          </div>
          <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">
            {deedsView.claimableCount > 0 ? `${deedsView.claimableCount} ready` : `${deedsView.deeds.filter(deed => deed.claimed).length}/${deedsView.deeds.length}`}
          </span>
        </div>

        <div className="multiplayer-deed-list mt-4">
          {deedsView.deeds.map(deed => {
            const percent = deed.required > 0 ? (deed.progress / deed.required) * 100 : 0;
            const status = deed.claimed ? 'claimed' : deed.complete ? 'claimable' : 'locked';
            return (
              <article key={deed.id} className={`multiplayer-deed-row is-${status}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h4 className="fantasy-heading text-sm">{deed.title}</h4>
                    <span className="ui-faint text-[10px] font-black uppercase">{deed.category}</span>
                  </div>
                  <p className="ui-muted mt-1 text-xs font-bold">{deed.description}</p>
                  <div className="ui-progress-track mt-3 h-1.5 overflow-hidden rounded border">
                    <div className="ui-progress-fill h-full" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="ui-faint mt-2 flex flex-wrap justify-between gap-2 text-[10px] font-black uppercase">
                    <span>{deed.progress}/{deed.required}</span>
                    <span>
                      {formatRewardBits({
                        gold: deed.rewards.gold,
                        rareGems: deed.rewards.rareGems,
                        entitlementLabel: deed.rewards.entitlement?.label,
                      })}
                    </span>
                  </div>
                </div>
                {deed.complete && !deed.claimed ? (
                  <button
                    type="button"
                    onClick={() => handleDeedClaim(deed.id, deed.title)}
                    className="ui-button-primary shrink-0 rounded px-3 py-2 text-xs font-black"
                  >
                    Claim
                  </button>
                ) : (
                  <strong className="multiplayer-deed-state shrink-0">
                    {deed.claimed ? 'Claimed' : 'In progress'}
                  </strong>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="arcane-label">Permanent Collection</p>
            <h3 className="fantasy-heading text-xl">Recorded Honors</h3>
          </div>
          <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">{honorCount} acquired</span>
        </div>
        {honorCount > 0 ? (
          <div className="multiplayer-chronicle-entitlements mt-4">
            {[...deedsView.state.entitlements, ...reputationView.state.entitlements].map(item => (
              <article key={item.id}>
                <span>{item.kind}</span>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="ui-empty mt-4 rounded border border-dashed px-5 py-8 text-center">
            <div className="fantasy-heading text-base">No deed honors yet</div>
            <p className="ui-muted mt-2 text-xs font-bold">Finish board work and campaign milestones to stamp your first records.</p>
          </div>
        )}
      </section>
    </div>
  );
}
