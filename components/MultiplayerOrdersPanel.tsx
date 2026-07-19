'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  claimCurrentMultiplayerDailyContract,
  claimCurrentMultiplayerFirstCompletionBonus,
  claimCurrentMultiplayerRegionalThreat,
  claimCurrentMultiplayerWeeklyOath,
  dismissCurrentMultiplayerReturningBriefing,
  getAllStoryQuestsSorted,
  getCurrentUser,
  getMultiplayerEngagementView,
  getSocialState,
  getStoryQuestStatus,
  rerollCurrentMultiplayerDailyContract,
  type RewardSummary,
} from '@/lib/auth';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import { getActivePveSpawnCount } from '@/lib/worldPveIntel';

interface MultiplayerOrdersPanelProps {
  now: number;
  onPlayerRefresh: () => void;
  onOpenPve?: () => void;
}

function rewardLines(rewards?: RewardSummary): CompletionRewardLine[] {
  if (!rewards) return [];
  const lines: CompletionRewardLine[] = [];
  if (rewards.gold) lines.push({ label: 'Gold', value: `+${rewards.gold}`, tone: 'gold' });
  if (rewards.exp) lines.push({ label: 'XP', value: `+${rewards.exp}`, tone: 'blue' });
  if (rewards.rareGems) lines.push({ label: 'Rare Gems', value: `+${rewards.rareGems}`, tone: 'violet' });
  return lines;
}

function formatTrackDay(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${month}/${day}`;
}

function formatThreatTime(expiresAt: number, now: number): string {
  const totalHours = Math.max(0, Math.ceil((expiresAt - now) / (60 * 60 * 1000)));
  if (totalHours >= 48) return `${Math.ceil(totalHours / 24)} days left`;
  return `${totalHours}h left`;
}

export default function MultiplayerOrdersPanel({ now, onPlayerRefresh, onOpenPve }: MultiplayerOrdersPanelProps) {
  const [, forceRender] = useState(0);
  const [notice, setNotice] = useState('');
  const user = getCurrentUser();
  const view = user ? getMultiplayerEngagementView(user, now) : null;
  const activeStory = user ? getAllStoryQuestsSorted().find(story => {
    const status = getStoryQuestStatus(user, story.id);
    return status.unlocked && !status.claimed;
  }) || null : null;

  if (!user || !view) return null;

  const refresh = () => {
    forceRender(current => current + 1);
    onPlayerRefresh();
  };

  const handleDailyClaim = (contractId: string, title: string) => {
    const result = claimCurrentMultiplayerDailyContract(contractId);
    setNotice(result.success ? 'Daily order claimed.' : result.error || 'Could not claim daily order.');
    if (result.success) {
      emitCompletionNotice({
        id: `daily-order-${contractId}-${now}`,
        kind: 'quest',
        kicker: 'Daily Order',
        title,
        description: 'The multiplayer order reward was added to your commander.',
        rewards: rewardLines(result.rewards),
      });
    }
    refresh();
  };

  const handleReroll = (contractId: string) => {
    const result = rerollCurrentMultiplayerDailyContract(contractId);
    setNotice(result.success ? 'Daily order rerolled.' : result.error || 'Could not reroll daily order.');
    refresh();
  };

  const handleWeeklyClaim = () => {
    const result = claimCurrentMultiplayerWeeklyOath();
    setNotice(result.success ? 'Weekly oath claimed.' : result.error || 'Could not claim weekly oath.');
    if (result.success) {
      emitCompletionNotice({
        id: `weekly-oath-${view.weeklyOath.id}-${now}`,
        kind: 'quest',
        kicker: 'Faction Oath',
        title: view.weeklyOath.title,
        description: 'Your weekly contribution reward was recorded.',
        rewards: rewardLines(result.rewards),
      });
    }
    refresh();
  };

  const handleFirstCompletionClaim = (bonus: typeof view.firstCompletionBonuses[number]) => {
    const result = claimCurrentMultiplayerFirstCompletionBonus(bonus.bonusId, now);
    setNotice(result.success ? `${bonus.title} claimed.` : result.error || `Could not claim ${bonus.title}.`);
    if (result.success) {
      emitCompletionNotice({
        id: `first-completion-${bonus.id}-${now}`,
        kind: 'quest',
        kicker: 'Daily Momentum',
        title: bonus.title,
        description: 'The first-completion reward was added to your commander.',
        rewards: rewardLines(result.rewards),
      });
    }
    refresh();
  };

  const handleThreatClaim = () => {
    const result = claimCurrentMultiplayerRegionalThreat(now);
    setNotice(result.success ? 'Regional threat reward claimed.' : result.error || 'Could not claim regional threat.');
    if (result.success) {
      emitCompletionNotice({
        id: `regional-threat-${view.regionalThreat.instanceId}-${now}`,
        kind: 'quest',
        kicker: 'Regional Threat',
        title: view.regionalThreat.title,
        description: `${view.regionalThreat.regionName} is secure for this rotation.`,
        rewards: rewardLines(result.rewards),
      });
    }
    refresh();
  };

  const handleDismissBriefing = () => {
    dismissCurrentMultiplayerReturningBriefing();
    refresh();
  };

  const party = getSocialState(user).party;
  const briefing = view.state.pendingBriefing;

  return (
    <div className="multiplayer-orders-panel">
      {notice && <div className="ui-notice border-b px-5 py-3 text-sm font-bold">{notice}</div>}

      {briefing && (
        <section className="multiplayer-returning-briefing border-b px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="arcane-label">Returning Commander</p>
              <h3 className="fantasy-heading text-xl">The road moved while you were away</h3>
              <p className="ui-muted mt-1 text-sm font-bold">{briefing.daysAway} inactive days. Start with one daily order to rebuild momentum.</p>
            </div>
            <button type="button" onClick={handleDismissBriefing} className="ui-button rounded px-3 py-2 text-xs font-black">Dismiss</button>
          </div>
          <div className="multiplayer-briefing-grid mt-4">
            <div><span>Current story</span><strong>{activeStory?.name || 'No active chapter'}</strong></div>
            <div><span>Regional threats</span><strong>{getActivePveSpawnCount(user)} active</strong></div>
            <div><span>Party status</span><strong>{party ? `${party.memberUsernames.length} members` : 'Traveling solo'}</strong></div>
            <div><span>Catch-up order</span><strong>{view.dailyContracts[1]?.title || 'Open the daily board'}</strong></div>
            <div><span>Rested command</span><strong>{view.state.restedJobCharges} job bonus{view.state.restedJobCharges === 1 ? '' : 'es'}</strong></div>
          </div>
        </section>
      )}

      {view.state.restedJobCharges > 0 && (
        <section className="border-b px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="arcane-label">Rested Command</p>
              <p className="ui-muted mt-1 text-xs font-bold">Your next {view.state.restedJobCharges} completed job{view.state.restedJobCharges === 1 ? '' : 's'} grant 25% bonus XP, capped at 50 XP each.</p>
            </div>
            <span className="ui-pill rounded border px-3 py-2 text-xs font-black">{view.state.restedJobCharges} remaining</span>
          </div>
        </section>
      )}

      <section className="px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="arcane-label">Resets Daily</p>
            <h3 className="fantasy-heading text-xl">Today&apos;s Orders</h3>
          </div>
          <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">
            {view.state.rerollUsed ? 'Reroll used' : '1 reroll ready'}
          </span>
        </div>

        <div className="multiplayer-contract-grid mt-4">
          {view.dailyContracts.map(contract => {
            const percent = Math.min(100, (contract.progress / contract.target) * 100);
            return (
              <article key={contract.id} className="multiplayer-contract-card ui-card rounded border">
                <div className="multiplayer-contract-card-head">
                  <span className="ui-icon-frame relative h-11 w-11 shrink-0 overflow-hidden rounded border">
                    <Image src={contract.iconPath} alt="" fill className="object-contain p-1.5" unoptimized />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="arcane-label">{contract.category}</p>
                    <h4 className="fantasy-heading multiplayer-contract-title">{contract.title}</h4>
                  </div>
                  <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{contract.progress}/{contract.target}</span>
                </div>
                <p className="ui-muted multiplayer-contract-description">{contract.description}</p>
                <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
                  <div className="ui-progress-fill h-full" style={{ width: `${percent}%` }} />
                </div>
                <div className="multiplayer-contract-rewards">
                  <span>{contract.rewardGold} gold</span>
                  <span>{contract.rewardExp} XP</span>
                </div>
                <div className="multiplayer-contract-actions">
                  <button
                    type="button"
                    onClick={() => handleReroll(contract.id)}
                    disabled={view.state.rerollUsed || contract.complete || contract.claimed}
                    className="ui-button rounded px-3 py-2 text-xs font-black disabled:opacity-35"
                  >
                    Reroll
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDailyClaim(contract.id, contract.title)}
                    disabled={!contract.complete || contract.claimed}
                    className="ui-button-primary rounded px-3 py-2 text-xs font-black disabled:opacity-35"
                  >
                    {contract.claimed ? 'Claimed' : contract.complete ? 'Claim' : 'In Progress'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="arcane-label">Daily Momentum</p>
            <h3 className="fantasy-heading text-xl">First Completions</h3>
          </div>
          <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">Resets daily</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {view.firstCompletionBonuses.map(bonus => (
            <article key={bonus.id} className="ui-card flex min-w-0 flex-col rounded border p-4">
              <div className="flex items-start gap-3">
                <span className="ui-icon-frame relative h-11 w-11 shrink-0 overflow-hidden rounded border">
                  <Image src={bonus.iconPath} alt="" fill sizes="44px" className="object-contain p-1.5" unoptimized />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="fantasy-heading text-base">{bonus.title}</h4>
                  <p className="ui-muted mt-1 text-xs font-bold">{bonus.description}</p>
                </div>
                <span className="ui-pill shrink-0 rounded border px-2 py-1 text-[10px] font-black uppercase">
                  {!bonus.unlocked ? `Lv ${bonus.minLevel}` : bonus.claimed ? 'Claimed' : bonus.complete ? 'Ready' : 'Open'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="ui-accent text-xs font-black">{bonus.rewardGold} gold + {bonus.rewardExp} XP</p>
                <button
                  type="button"
                  disabled={!bonus.complete || bonus.claimed}
                  onClick={() => handleFirstCompletionClaim(bonus)}
                  className="ui-button-primary rounded px-4 py-2 text-xs font-black disabled:opacity-35"
                >
                  {bonus.claimed ? 'Claimed' : bonus.complete ? 'Claim Bonus' : bonus.unlocked ? 'In Progress' : `Reach Level ${bonus.minLevel}`}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="arcane-label">Regional Threat - {view.regionalThreat.faction}</p>
            <h3 className="fantasy-heading text-xl">{view.regionalThreat.title}</h3>
            <p className="ui-muted mt-1 text-sm font-bold">{view.regionalThreat.description}</p>
          </div>
          <span className="ui-pill rounded border px-3 py-2 text-[10px] font-black uppercase">
            {view.regionalThreat.unlocked
              ? `${view.regionalThreat.regionName} - ${formatThreatTime(view.regionalThreat.expiresAt, now)}`
              : `Unlocks Lv ${view.regionalThreat.minLevel}`}
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="ui-card rounded border p-3">
            <span className="arcane-label">Threat Patrols</span>
            <strong className="mt-1 block text-lg">{view.regionalThreat.patrolProgress}/{view.regionalThreat.targetPatrolWins}</strong>
          </div>
          <div className="ui-card rounded border p-3">
            <span className="arcane-label">Named Commander</span>
            <strong className="mt-1 block text-sm">{view.regionalThreat.bossName}</strong>
            <span className="ui-faint mt-1 block text-[10px] font-black uppercase">{view.regionalThreat.bossDefeated ? 'Defeated' : 'Still active'}</span>
          </div>
          <div className="ui-card rounded border p-3">
            <span className="arcane-label">Threat Reward</span>
            <strong className="mt-1 block text-sm">{view.regionalThreat.rewardGold} gold / {view.regionalThreat.rewardExp} XP / {view.regionalThreat.rewardRareGems} gem</strong>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="ui-faint text-xs font-bold">Win patrols in {view.regionalThreat.regionName}, then defeat the marked threat boss.</p>
          {view.regionalThreat.complete ? (
            <button
              type="button"
              onClick={handleThreatClaim}
              disabled={view.regionalThreat.claimed}
              className="ui-button-primary rounded px-4 py-2 text-xs font-black disabled:opacity-35"
            >
              {view.regionalThreat.claimed ? 'Threat Claimed' : 'Claim Threat'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPve}
              disabled={!view.regionalThreat.unlocked || !onOpenPve}
              className="ui-button rounded px-4 py-2 text-xs font-black disabled:opacity-35"
            >
              {view.regionalThreat.unlocked ? 'Open PVE Intel' : `Reach Level ${view.regionalThreat.minLevel}`}
            </button>
          )}
        </div>
      </section>

      <section className="multiplayer-weekly-oath border-t px-5 py-5">
        <div className="multiplayer-weekly-oath-main">
          <div>
            <p className="arcane-label">Weekly Faction Oath</p>
            <h3 className="fantasy-heading text-xl">{view.weeklyOath.title}</h3>
            <p className="ui-muted mt-1 text-sm font-bold">{view.weeklyOath.description}</p>
          </div>
          <div className="multiplayer-oath-progress">
            <strong>{view.weeklyOath.progress}/{view.weeklyOath.target}</strong>
            <span>{view.weeklyOath.rewardGold} gold + {view.weeklyOath.rewardExp} XP</span>
          </div>
        </div>
        <div className="multiplayer-oath-paths mt-4">
          <span>Combat <strong>{view.weeklyOath.contributions.combat}</strong></span>
          <span>World <strong>{view.weeklyOath.contributions.world}</strong></span>
          <span>Social <strong>{view.weeklyOath.contributions.social}</strong></span>
          <button
            type="button"
            onClick={handleWeeklyClaim}
            disabled={!view.weeklyOath.complete || view.weeklyOath.claimed}
            className="ui-button-primary rounded px-4 py-2 text-xs font-black disabled:opacity-35"
          >
            {view.weeklyOath.claimed ? 'Claimed' : view.weeklyOath.complete ? 'Claim Oath' : 'Oath in Progress'}
          </button>
        </div>
      </section>

      <section className="multiplayer-return-track border-t px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="arcane-label">Return Track</p>
            <h3 className="fantasy-heading text-xl">Seven visits in eight days</h3>
          </div>
          <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">
            {view.returnTrack.completedDays}/{view.returnTrack.targetDays} days
          </span>
        </div>
        <div className="multiplayer-return-days mt-4">
          {view.returnTrack.days.map(day => (
            <span key={day.dateKey} className={day.visited ? 'multiplayer-return-day multiplayer-return-day-visited' : 'multiplayer-return-day'}>
              <small>{day.dateKey === view.state.dateKey ? 'Today' : formatTrackDay(day.dateKey)}</small>
              <strong>{day.visited ? 'Done' : view.returnTrack.bufferAvailable ? 'Buffer' : '-'}</strong>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
