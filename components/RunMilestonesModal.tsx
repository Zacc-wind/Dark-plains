'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import type { DailyRunState } from '@/lib/auth';
import {
  getRunMilestoneUnlockCounts,
  getRunMilestoneViews,
  RUN_MILESTONE_CATEGORY_LABELS,
  type RunMilestoneCategory,
  type RunMilestoneView,
} from '@/lib/runMilestones';

const CATEGORY_ORDER: RunMilestoneCategory[] = ['boss', 'road', 'army', 'spell', 'meta', 'economy'];

interface RunMilestonesModalProps {
  isOpen: boolean;
  runState: DailyRunState;
  onClose: () => void;
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
        {!milestone.unlocked ? <span className="sp-milestone-lock" aria-hidden>🔒</span> : null}
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

export default function RunMilestonesModal({ isOpen, runState, onClose }: RunMilestonesModalProps) {
  const views = useMemo(() => getRunMilestoneViews(runState), [runState]);
  const counts = useMemo(() => getRunMilestoneUnlockCounts(runState), [runState]);

  if (!isOpen) return null;

  return (
    <div
      className="sp-milestones-layer fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
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
              {counts.unlocked} of {counts.total} unlocked — spell rewards will tie into milestones later.
            </p>
          </div>
          <button type="button" onClick={onClose} className="ui-button rounded px-3 py-1 text-xs font-bold">
            Close
          </button>
        </div>

        <div className="sp-milestones-scroll max-h-[calc(100vh-8rem)] overflow-y-auto p-5">
          {CATEGORY_ORDER.map(category => {
            const inCategory = views.filter(view => view.category === category);
            if (inCategory.length === 0) return null;
            const unlocked = inCategory.filter(view => view.unlocked).length;

            return (
              <section key={category} className="sp-milestones-section">
                <div className="sp-milestones-section-head">
                  <h3 className="fantasy-heading text-lg">{RUN_MILESTONE_CATEGORY_LABELS[category]}</h3>
                  <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase">
                    {unlocked}/{inCategory.length}
                  </span>
                </div>

                <div className="sp-milestones-grid">
                  {inCategory.map(milestone => (
                    <article
                      key={milestone.id}
                      className={`sp-milestone-card${milestone.unlocked ? ' sp-milestone-card-unlocked' : ' sp-milestone-card-locked'}`}
                    >
                      <MilestoneIconTile milestone={milestone} size="lg" showTitle={false} />
                      <div className="sp-milestone-card-copy min-w-0">
                        <h4 className="sp-milestone-card-title">{milestone.title}</h4>
                        <p className="sp-milestone-card-desc ui-muted">{milestone.description}</p>
                        {milestone.rewardHint ? (
                          <p className="sp-milestone-card-reward ui-faint">{milestone.rewardHint}</p>
                        ) : null}
                        {milestone.progressLabel ? (
                          <p className="sp-milestone-card-progress ui-value">{milestone.progressLabel}</p>
                        ) : null}
                      </div>
                      <span className={`sp-milestone-status ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase${milestone.unlocked ? ' sp-milestone-status-unlocked' : ''}`}>
                        {milestone.unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
