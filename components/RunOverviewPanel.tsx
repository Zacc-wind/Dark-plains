'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  getCurrentUser,
  getDailyRunState,
  getDailyRunStatus,
  getRandomRunExpNeeded,
  RANDOM_RUN_BALANCE,
  spendRunUpgradePoint,
  updateCurrentUser,
  type RandomRunUpgradeStat,
} from '@/lib/auth';
import {
  getRunMilestoneViews,
  getRunMilestoneCategorySummaries,
  getRunMilestoneUnlockCounts,
  isRunMilestoneRewardClaimed,
} from '@/lib/runMilestones';

const RUN_STAT_ICONS = {
  score: '/assets/icons/xp.png',
  xp: '/assets/icons/xp.png',
  wins: '/assets/icons/attack.png',
  time: '/assets/icons/speed.png',
  magic: '/assets/icons/magic.png',
  gold: '/assets/icons/gold.png',
  chest: '/assets/icons/loot-chest.png',
};

const LOBBY_UPGRADE_ICONS: Record<RandomRunUpgradeStat, string> = {
  armyPower: RUN_STAT_ICONS.wins,
  defensivePower: '/assets/icons/defense.png',
  morale: RUN_STAT_ICONS.time,
  spellPower: RUN_STAT_ICONS.magic,
  maxHealth: '/assets/icons/health.png',
  unitPower: RUN_STAT_ICONS.wins,
  unitWard: '/assets/icons/defense.png',
};

interface UpgradeRow {
  label: string;
  value: string;
  hint: string;
  stat: RandomRunUpgradeStat;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
        title={`${hint} - click to spend 1 upgrade point`}
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
  const permanent = runState.permanentStats;
  const categorySummaries = getRunMilestoneCategorySummaries(runState);
  const milestoneCounts = getRunMilestoneUnlockCounts(runState);
  const milestoneViews = getRunMilestoneViews(runState);
  const claimableMilestones = milestoneViews.filter(view =>
    view.unlocked && !isRunMilestoneRewardClaimed(runState, view.id)
  ).length;
  const milestonePercent = clamp((milestoneCounts.unlocked / Math.max(1, milestoneCounts.total)) * 100, 0, 100);
  const canSpendUpgradePoints = runState.runUpgradePoints > 0;
  const upgradeRows: UpgradeRow[] = [
    { label: 'Army Damage', value: `+${permanent.armyPower}`, hint: 'Extra damage for the whole warband', stat: 'armyPower' },
    { label: 'Army Ward', value: `+${permanent.defensivePower}`, hint: 'Extra protection for the whole warband', stat: 'defensivePower' },
    { label: 'Morale', value: `+${permanent.morale}`, hint: 'Run-start morale and tempo bonus', stat: 'morale' },
    { label: 'Spell Power', value: `+${permanent.spellPower}`, hint: 'Stronger commander spells', stat: 'spellPower' },
    { label: 'Commander HP', value: `+${permanent.maxHealth}`, hint: 'Extra commander health each run', stat: 'maxHealth' },
    { label: 'Unit Attack', value: `+${permanent.unitPower}`, hint: 'Extra attack for drafted units', stat: 'unitPower' },
    { label: 'Unit Ward', value: `+${permanent.unitWard}`, hint: 'Extra defense for drafted units', stat: 'unitWard' },
  ];

  const handleSpendUpgrade = (stat: RandomRunUpgradeStat) => {
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
                : 'These bonuses apply at the start of every run.'}
            </p>
            {upgradeNotice ? <p className="sp-hub-section-hint ui-value mt-1">{upgradeNotice}</p> : null}
          </div>
          <div className="sp-hub-bonus-grid">
            {upgradeRows.map(row => (
              <RunBonusTile
                key={row.label}
                icon={LOBBY_UPGRADE_ICONS[row.stat] || RUN_STAT_ICONS.wins}
                label={row.label}
                value={row.value}
                hint={row.hint}
                canSpend={canSpendUpgradePoints}
                onSpend={() => handleSpendUpgrade(row.stat)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="sp-hub-card sp-hub-card-milestones">
        <div className="sp-hub-card-head">
          <div>
            <span className="arcane-label sp-hub-arcane-label">Achievements</span>
            <h2 className="fantasy-heading sp-hub-card-title">Trophies & Unlocks</h2>
            <p className="sp-hub-section-hint">Hidden away until you want the full list.</p>
          </div>
          <span className="sp-hub-pill ui-pill rounded border px-3 py-1.5 text-xs font-black uppercase">
            {milestoneCounts.unlocked}/{milestoneCounts.total}
          </span>
        </div>

        <div className="sp-hub-achievement-summary">
          <div className="sp-hub-achievement-meter" aria-hidden>
            <div className="sp-hub-achievement-meter-head">
              <span>{milestonePercent.toFixed(0)}%</span>
              <span>{claimableMilestones > 0 ? `${claimableMilestones} claim` : 'No claims'}</span>
            </div>
            <div className="sp-hub-achievement-track">
              <div className="sp-hub-achievement-fill" style={{ width: `${milestonePercent}%` }} />
            </div>
          </div>

          <div className="sp-hub-achievement-category-grid">
            {categorySummaries.map(summary => (
              <div key={summary.category} className="sp-hub-achievement-category">
                <Image src={summary.iconPath} alt="" width={34} height={34} className="sp-hub-achievement-category-icon" unoptimized />
                <div className="min-w-0">
                  <span className="sp-hub-achievement-category-title">{summary.label}</span>
                  <span className="sp-hub-achievement-category-count">{summary.unlocked}/{summary.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {onOpenMilestones ? (
          <button
            type="button"
            onClick={onOpenMilestones}
            className="sp-hub-milestones-btn ui-button w-full rounded px-5 py-3.5 text-sm font-black"
          >
            Open Achievements
          </button>
        ) : null}
      </section>
    </div>
  );
}
