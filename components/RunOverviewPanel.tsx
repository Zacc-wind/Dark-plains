'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  getCurrentUser,
  getDailyRunLeaderboard,
  getDailyRunState,
  getDailyRunStatus,
  getRandomRunExpNeeded,
  RANDOM_RUN_BALANCE,
  spendRunUpgradePoint,
  updateCurrentUser,
  type RandomRunUpgradeStat,
} from '@/lib/auth';
import {
  getMilestonesByCategory,
  getRunMilestoneCategorySummaries,
  getRunMilestoneUnlockCounts,
} from '@/lib/runMilestones';
import { getSavedDailyRunSummary } from './RoguelikeRunModal';
import { MilestoneIconTile } from './RunMilestonesModal';

const RUN_STAT_ICONS = {
  score: '/assets/icons/xp.png',
  xp: '/assets/icons/xp.png',
  wins: '/assets/icons/attack.png',
  time: '/assets/icons/speed.png',
  magic: '/assets/icons/magic.png',
  gold: '/assets/icons/gold.png',
  chest: '/assets/icons/loot-chest.png',
};

const LOBBY_UPGRADE_ICONS: Record<string, string> = {
  Army: RUN_STAT_ICONS.wins,
  Ward: '/assets/icons/defense.png',
  Morale: RUN_STAT_ICONS.time,
  Spell: RUN_STAT_ICONS.magic,
  Health: '/assets/icons/health.png',
  'Unit Hit': RUN_STAT_ICONS.wins,
  'Unit Ward': '/assets/icons/defense.png',
};

const UPGRADE_STAT_BY_LABEL: Record<string, RandomRunUpgradeStat> = {
  Army: 'armyPower',
  Ward: 'defensivePower',
  Morale: 'morale',
  Spell: 'spellPower',
  Health: 'maxHealth',
  'Unit Hit': 'unitPower',
  'Unit Ward': 'unitWard',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatRunDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function RunStatTile({ icon, label, value, hint }: { icon: string; label: string; value: string; hint: string }) {
  return (
    <div className="sp-hub-stat-tile" title={hint}>
      <Image src={icon} alt="" width={32} height={32} className="sp-hub-stat-tile-icon" unoptimized />
      <div className="sp-hub-stat-tile-copy">
        <span className="sp-hub-stat-tile-value">{value}</span>
        <span className="sp-hub-stat-tile-label">{label}</span>
      </div>
    </div>
  );
}

function RunBonusTile({
  icon,
  label,
  value,
  hint,
  canSpend,
  onSpend,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
  canSpend?: boolean;
  onSpend?: () => void;
}) {
  if (canSpend && onSpend) {
    return (
      <button
        type="button"
        className="sp-hub-bonus-tile sp-hub-bonus-tile-spendable"
        title={`${hint} — click to spend 1 upgrade point`}
        onClick={onSpend}
      >
        <Image src={icon} alt="" width={28} height={28} className="sp-hub-bonus-tile-icon" unoptimized />
        <span className="sp-hub-bonus-tile-value">{value}</span>
        <span className="sp-hub-bonus-tile-label">{label}</span>
        <span className="sp-hub-bonus-tile-action">+1</span>
      </button>
    );
  }

  return (
    <div className="sp-hub-bonus-tile" title={hint}>
      <Image src={icon} alt="" width={28} height={28} className="sp-hub-bonus-tile-icon" unoptimized />
      <span className="sp-hub-bonus-tile-value">{value}</span>
      <span className="sp-hub-bonus-tile-label">{label}</span>
    </div>
  );
}

interface RunOverviewPanelProps {
  onOpenMilestones?: () => void;
}

export default function RunOverviewPanel({ onOpenMilestones }: RunOverviewPanelProps) {
  const [tick, setTick] = useState(0);
  const [upgradeNotice, setUpgradeNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const player = getCurrentUser();
  if (!player) return null;

  void tick;

  const dailyStatus = getDailyRunStatus(player);
  const runState = getDailyRunState(player);
  const runExpNeeded = getRandomRunExpNeeded(runState.runLevel);
  const runLevelCapped = runState.runLevel >= RANDOM_RUN_BALANCE.levelCap;
  const expPercent = runLevelCapped ? 100 : clamp((runState.runExp / Math.max(1, runExpNeeded)) * 100, 0, 100);
  const leaderboard = getDailyRunLeaderboard();
  const lastRun = dailyStatus.history[0];
  const permanent = runState.permanentStats;
  const savedDailyRun = getSavedDailyRunSummary(player);
  const lastRunCleared = Boolean(lastRun && lastRun.wins >= lastRun.targetBattles);
  const categorySummaries = getRunMilestoneCategorySummaries(runState);
  const milestoneCounts = getRunMilestoneUnlockCounts(runState);
  const canSpendUpgradePoints = runState.runUpgradePoints > 0;
  const upgradeRows = [
    { label: 'Army', value: `+${permanent.armyPower}`, hint: 'Bonus damage for your warband' },
    { label: 'Ward', value: `+${permanent.defensivePower}`, hint: 'Extra protection across runs' },
    { label: 'Morale', value: `+${permanent.morale}`, hint: 'Morale boost at run start' },
    { label: 'Spell', value: `+${permanent.spellPower}`, hint: 'Stronger spell effects' },
    { label: 'Health', value: `+${permanent.maxHealth}`, hint: 'Extra hero health' },
    { label: 'Unit Hit', value: `+${permanent.unitPower}`, hint: 'Minion attack bonus' },
    { label: 'Unit Ward', value: `+${permanent.unitWard}`, hint: 'Minion defense bonus' },
  ];

  const handleSpendUpgrade = (label: string) => {
    const stat = UPGRADE_STAT_BY_LABEL[label];
    if (!stat) return;

    const result = spendRunUpgradePoint(player, stat);
    if (!result.ok) {
      setUpgradeNotice(result.message);
      return;
    }

    updateCurrentUser({ dailyRun: result.dailyRun });
    setUpgradeNotice(result.message);
    setTick(value => value + 1);
  };

  return (
    <div className="sp-hub-dashboard">
      <section className="sp-hub-card sp-hub-card-progression">
        <div className="sp-hub-card-head">
          <div className="sp-hub-level-block">
            <div className="sp-hub-level-badge">
              <Image src={RUN_STAT_ICONS.xp} alt="" width={36} height={36} className="sp-hub-level-badge-icon" unoptimized />
              <span className="sp-hub-level-badge-value">{runState.runLevel}</span>
            </div>
            <div>
              <span className="arcane-label sp-hub-arcane-label">Run Progression</span>
              <h2 className="fantasy-heading sp-hub-card-title">Level {runState.runLevel}</h2>
              <p className="sp-hub-section-hint">Permanent meta — carries over every run.</p>
            </div>
          </div>
          {runState.runUpgradePoints > 0 ? (
            <span className="sp-hub-pill ui-pill rounded border px-3 py-1.5 text-xs font-black uppercase">
              {runState.runUpgradePoints} upgrade pts
            </span>
          ) : null}
        </div>

        <div className="sp-hub-xp-block">
          <div className="sp-hub-xp-head">
            <span className="sp-hub-xp-title">Run XP</span>
            <span className="sp-hub-xp-label">
              {runLevelCapped ? 'Max level reached' : `${runState.runExp} / ${runExpNeeded}`}
            </span>
          </div>
          <div className="random-run-xp-track sp-hub-xp-track" aria-hidden>
            <div className="random-run-xp-fill" style={{ width: `${expPercent}%` }} />
          </div>
          <p className="sp-hub-section-hint">Earn XP by winning battles and clearing roads.</p>
        </div>

        <div className="sp-hub-stat-grid">
          <RunStatTile icon={RUN_STAT_ICONS.chest} label="Roads cleared" value={String(runState.completions)} hint="Lifetime full road clears" />
          <RunStatTile icon={RUN_STAT_ICONS.wins} label="Best battle wins" value={String(dailyStatus.bestWins)} hint="Most wins in a single run" />
          <RunStatTile icon={RUN_STAT_ICONS.time} label="Clear streak" value={String(runState.streak)} hint="Consecutive cleared runs" />
          <RunStatTile icon={RUN_STAT_ICONS.gold} label="Upgrade points" value={String(runState.runUpgradePoints)} hint="Spend on permanent bonuses after runs" />
        </div>

        <div className="sp-hub-bonus-section">
          <div>
            <span className="arcane-label sp-hub-arcane-label">Permanent Bonuses</span>
            <p className="sp-hub-section-hint">
              {canSpendUpgradePoints
                ? 'Click a bonus tile to spend 1 upgrade point.'
                : 'Stack forever — applied at the start of each run.'}
            </p>
            {upgradeNotice ? <p className="sp-hub-section-hint ui-value mt-1">{upgradeNotice}</p> : null}
          </div>
          <div className="sp-hub-bonus-grid">
            {upgradeRows.map(row => (
              <RunBonusTile
                key={row.label}
                icon={LOBBY_UPGRADE_ICONS[row.label] || RUN_STAT_ICONS.wins}
                label={row.label}
                value={row.value}
                hint={row.hint}
                canSpend={canSpendUpgradePoints}
                onSpend={() => handleSpendUpgrade(row.label)}
              />
            ))}
          </div>
        </div>

        {savedDailyRun ? (
          <p className="sp-hub-footnote">
            Active run: {savedDailyRun.unitsStanding}/{savedDailyRun.totalUnits || 7} units alive — {savedDailyRun.phaseLabel}
          </p>
        ) : null}
      </section>

      <div className="sp-hub-right-stack">
        <section className="sp-hub-card sp-hub-card-milestones">
          <div className="sp-hub-card-head">
            <div>
              <span className="arcane-label sp-hub-arcane-label">Achievements & Unlocks</span>
              <h2 className="fantasy-heading sp-hub-card-title">Run Milestones</h2>
              <p className="sp-hub-section-hint">Boss trophies, spells, and feats — unlock by playing runs.</p>
            </div>
            <span className="sp-hub-pill ui-pill rounded border px-3 py-1.5 text-xs font-black uppercase">
              {milestoneCounts.unlocked}/{milestoneCounts.total}
            </span>
          </div>

          <div className="sp-hub-milestone-grid">
            {categorySummaries.map(summary => {
              const previews = getMilestonesByCategory(runState, summary.category);

              return (
                <div
                  key={summary.category}
                  className={`sp-hub-milestone-card${summary.unlocked > 0 ? ' sp-hub-milestone-card-active' : ''}`}
                >
                  <div className="sp-hub-milestone-card-head">
                    <span className="sp-hub-milestone-card-title">{summary.label}</span>
                    <span className="sp-hub-milestone-card-count">{summary.unlocked}/{summary.total}</span>
                  </div>
                  <div className="sp-hub-milestone-preview-row">
                    {previews.map(milestone => (
                      <MilestoneIconTile key={milestone.id} milestone={milestone} size="sm" showTitle={false} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {onOpenMilestones ? (
            <button
              type="button"
              onClick={onOpenMilestones}
              className="sp-hub-milestones-btn ui-button w-full rounded px-5 py-3.5 text-sm font-black"
            >
              View All Milestones
            </button>
          ) : null}
        </section>

        <section className="sp-hub-card sp-hub-card-ledger">
          <div className="sp-hub-card-head">
            <div className="min-w-0">
              <span className="arcane-label sp-hub-arcane-label">Run Ledger</span>
              <h2 className="fantasy-heading sp-hub-card-title truncate">
                {lastRun?.challengeName || 'No run yet'}
              </h2>
              {!lastRun ? (
                <p className="sp-hub-section-hint">Your last road result and leaderboard ranks appear here.</p>
              ) : null}
            </div>
            {lastRun ? (
              <span className={`sp-hub-pill ui-pill rounded border px-3 py-1.5 text-xs font-black uppercase${lastRunCleared ? ' sp-hub-outcome-cleared' : ''}`}>
                {lastRunCleared ? 'Cleared' : 'Ended'}
              </span>
            ) : null}
          </div>

          {lastRun ? (
            <>
              <div className="sp-hub-chip-row">
                <span className="run-header-chip sp-hub-ledger-chip" title="Battles won">
                  <Image src={RUN_STAT_ICONS.wins} alt="" width={20} height={20} className="run-header-chip-icon" unoptimized />
                  <span className="run-header-chip-value">{lastRun.wins}/{lastRun.targetBattles} wins</span>
                </span>
                <span className="run-header-chip sp-hub-ledger-chip" title="Run duration">
                  <Image src={RUN_STAT_ICONS.time} alt="" width={20} height={20} className="run-header-chip-icon" unoptimized />
                  <span className="run-header-chip-value">{formatRunDuration(lastRun.durationMs || 0)}</span>
                </span>
                <span className="run-header-chip sp-hub-ledger-chip" title="XP earned">
                  <Image src={RUN_STAT_ICONS.xp} alt="" width={20} height={20} className="run-header-chip-icon" unoptimized />
                  <span className="run-header-chip-value">{lastRun.exp} XP</span>
                </span>
                <span className="run-header-chip sp-hub-ledger-chip run-header-chip-gold" title="Run score">
                  <Image src={RUN_STAT_ICONS.score} alt="" width={20} height={20} className="run-header-chip-icon" unoptimized />
                  <span className="run-header-chip-value">{lastRun.score || 0} pts</span>
                </span>
              </div>

              {leaderboard.length > 0 ? (
                <div className="sp-hub-leaderboard">
                  <span className="arcane-label sp-hub-arcane-label">Top Runners</span>
                  {leaderboard.slice(0, 3).map((entry, index) => (
                    <div key={entry.username} className="sp-hub-leaderboard-row">
                      <span className="sp-hub-leaderboard-name">#{index + 1} {entry.username}</span>
                      <span className="sp-hub-leaderboard-meta">{entry.completions} clears</span>
                      <span className="sp-hub-leaderboard-streak">{entry.streak} streak</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="sp-hub-footnote sp-hub-ledger-empty">No history yet — your first clear will appear here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
