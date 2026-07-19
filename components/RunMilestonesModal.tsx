'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  claimRunMilestoneReward,
  getCurrentUser,
  getDailyRunState,
  updateCurrentUser,
  type DailyRunState,
} from '@/lib/auth';
import {
  getRunMilestoneRewardExp,
  getRunMilestoneUnlockCounts,
  getRunMilestoneViews,
  isRunMilestoneRewardClaimed,
  RUN_MILESTONE_CATEGORY_LABELS,
  type RunMilestoneCategory,
  type RunMilestoneView,
} from '@/lib/runMilestones';

type MilestoneTab = 'milestones' | 'bosses' | 'unlocks' | 'recent';

const MILESTONE_TABS: Array<{ id: MilestoneTab; label: string }> = [
  { id: 'milestones', label: 'Milestones' },
  { id: 'bosses', label: 'Bosses' },
  { id: 'unlocks', label: 'Unlocks' },
  { id: 'recent', label: 'Recent' },
];

const TAB_CATEGORIES: Record<Exclude<MilestoneTab, 'recent'>, RunMilestoneCategory[]> = {
  milestones: ['road', 'meta', 'economy'],
  bosses: ['boss'],
  unlocks: ['army', 'spell'],
};

function formatMilestoneUnlockTime(unlockedAt: number | undefined): string | null {
  if (!unlockedAt) return null;
  if (unlockedAt <= 1) return 'Legacy unlock';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(unlockedAt));
}

interface RunMilestonesModalProps {
  isOpen: boolean;
  runState: DailyRunState;
  onClose: () => void;
  onClaim?: () => void;
}

export function MilestoneIconTile({
  milestone,
  size = 'md',
  showTitle = true,
}: {
  milestone: Pick<RunMilestoneView, 'title' | 'iconPath' | 'unlocked' | 'progressLabel'>;
  size?: 'sm' | 'md' | 'lg';
  showTitle?: boolean;
}) {
  const dimension = size === 'lg' ? 64 : size === 'md' ? 52 : 44;

  return (
    <div
      className={`sp-milestone-tile${milestone.unlocked ? ' sp-milestone-tile-unlocked' : ' sp-milestone-tile-locked'}`}
      title={milestone.title}
    >
      <div className="sp-milestone-icon-frame" style={{ width: dimension, height: dimension }}>
        <Image
          src={milestone.iconPath}
          alt=""
          width={dimension}
          height={dimension}
          className="sp-milestone-icon"
          unoptimized
        />
        {!milestone.unlocked ? <span className="sp-milestone-lock" aria-hidden>Locked</span> : null}
      </div>
      {showTitle ? (
        <span className="sp-milestone-tile-title">{milestone.title}</span>
      ) : null}
      {milestone.progressLabel ? (
        <span className="sp-milestone-progress ui-faint">{milestone.progressLabel}</span>
      ) : null}
    </div>
  );
}

export default function RunMilestonesModal({ isOpen, runState, onClose, onClaim }: RunMilestonesModalProps) {
  const [, setRefreshKey] = useState(0);
  const [claimNotice, setClaimNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MilestoneTab>('milestones');
  const currentRunState = getDailyRunState(getCurrentUser() || { dailyRun: runState });
  const views = getRunMilestoneViews(currentRunState);
  const counts = getRunMilestoneUnlockCounts(currentRunState);

  if (!isOpen) return null;

  const handleClaim = (milestone: RunMilestoneView) => {
    const latestPlayer = getCurrentUser();
    if (!latestPlayer) {
      setClaimNotice('Sign in again before claiming this reward.');
      return;
    }
    const latestRunState = getDailyRunState(latestPlayer);
    const latestMilestone = getRunMilestoneViews(latestRunState).find(view => view.id === milestone.id);
    if (!latestMilestone?.unlocked) {
      setClaimNotice('That milestone is not unlocked yet.');
      return;
    }
    if (isRunMilestoneRewardClaimed(latestRunState, milestone.id)) {
      setClaimNotice('Milestone reward already claimed.');
      setRefreshKey(value => value + 1);
      return;
    }

    const result = claimRunMilestoneReward(
      latestPlayer,
      milestone.id,
      getRunMilestoneRewardExp(milestone.id),
      latestMilestone.unlocked,
      latestMilestone.claimReward,
    );

    setClaimNotice(result.message);
    if (!result.ok) return;

    updateCurrentUser({ dailyRun: result.dailyRun });
    onClaim?.();
    setRefreshKey(value => value + 1);
  };

  const sections = activeTab === 'recent'
    ? [{
        id: 'recent',
        label: 'Latest Unlocks',
        milestones: views
          .filter(view => view.unlocked && view.unlockedAt)
          .sort((left, right) => (right.unlockedAt || 0) - (left.unlockedAt || 0)),
      }]
    : TAB_CATEGORIES[activeTab].map(category => ({
        id: category,
        label: RUN_MILESTONE_CATEGORY_LABELS[category],
        milestones: views.filter(view => view.category === category),
      }));

  return (
    <div
      className="sp-milestones-layer fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="command-panel vine-frame sp-milestones-panel max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-hidden rounded border"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-milestones-title"
      >
        <div className="panel-header flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="arcane-label">Singleplayer Campaign</p>
            <h2 id="sp-milestones-title" className="fantasy-heading text-2xl">Run Milestones</h2>
            <p className="ui-muted mt-1 text-sm font-bold">
              {counts.unlocked} of {counts.total} unlocked - select a completed milestone to claim run XP.
            </p>
            {claimNotice ? <p className="ui-value mt-1 text-xs font-bold">{claimNotice}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="ui-button rounded px-3 py-1 text-xs font-bold">
            Close
          </button>
        </div>

        <nav className="sp-milestones-tabs" aria-label="Milestone categories">
          {MILESTONE_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`sp-milestones-tab${activeTab === tab.id ? ' sp-milestones-tab-active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sp-milestones-scroll max-h-[calc(100vh-11rem)] overflow-y-auto p-5">
          {sections.map(section => {
            const inCategory = section.milestones;
            if (inCategory.length === 0) {
              return (
                <div key={section.id} className="sp-milestones-empty ui-muted">
                  Complete a run milestone to add it here.
                </div>
              );
            }
            const unlocked = inCategory.filter(view => view.unlocked).length;

            return (
              <section key={section.id} className="sp-milestones-section">
                <div className="sp-milestones-section-head">
                  <h3 className="fantasy-heading text-lg">{section.label}</h3>
                  <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase">
                    {unlocked}/{inCategory.length}
                  </span>
                </div>

                <div className="sp-milestones-grid">
                  {inCategory.map(milestone => {
                    const claimed = isRunMilestoneRewardClaimed(currentRunState, milestone.id);
                    const rewardExp = getRunMilestoneRewardExp(milestone.id);
                    const claimable = milestone.unlocked && !claimed;

                    return (
                      <article
                        key={milestone.id}
                        className={`sp-milestone-card${milestone.unlocked ? ' sp-milestone-card-unlocked' : ' sp-milestone-card-locked'}${claimable ? ' sp-milestone-card-claimable' : ''}${claimed ? ' sp-milestone-card-claimed' : ''}`}
                        onClick={claimable ? () => handleClaim(milestone) : undefined}
                        onKeyDown={claimable ? event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleClaim(milestone);
                          }
                        } : undefined}
                        role={claimable ? 'button' : undefined}
                        tabIndex={claimable ? 0 : undefined}
                      >
                        <MilestoneIconTile milestone={milestone} size="lg" showTitle={false} />
                        <div className="sp-milestone-card-copy min-w-0">
                          <h4 className="sp-milestone-card-title">{milestone.title}</h4>
                          <p className="sp-milestone-card-desc ui-muted">{milestone.description}</p>
                          {milestone.rewardHint ? (
                            <p className="sp-milestone-card-reward ui-faint">{milestone.rewardHint}</p>
                          ) : null}
                          {milestone.claimReward ? (
                            <p className="sp-milestone-card-reward ui-value">
                              Unlock: {milestone.claimReward}
                            </p>
                          ) : null}
                          {milestone.progressLabel ? (
                            <p className="sp-milestone-card-progress ui-value">{milestone.progressLabel}</p>
                          ) : null}
                          {milestone.unlocked ? (
                            <p className={`sp-milestone-record sp-milestone-tier-${milestone.tier}`}>
                              {milestone.tier} - {formatMilestoneUnlockTime(milestone.unlockedAt) || 'Recorded this run'}
                            </p>
                          ) : null}
                          {milestone.unlocked ? (
                            <p className="sp-milestone-card-reward ui-faint">
                              {claimed ? 'Reward claimed and active' : `Reward: +${rewardExp} run XP`}
                            </p>
                          ) : null}
                        </div>
                        <span className={`sp-milestone-status ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase${milestone.unlocked ? ' sp-milestone-status-unlocked' : ''}`}>
                          {claimed ? 'Claimed' : milestone.unlocked ? 'Claim XP' : 'Locked'}
                        </span>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
