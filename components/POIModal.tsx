'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getCurrentUser, getJobRewardPreview, getJobTravelDurationMs, JOB_DURATION_LABELS, startJob } from '@/lib/auth';
import { ASSET_PATHS } from '@/lib/assetLoader';
import { emitFxEvent } from '@/lib/fxEvents';
import { POI, POIType } from '@/lib/mapData';
import { buildJobRewardChips } from '@/lib/rewardDisplay';
import RewardIconStrip from '@/components/RewardIconStrip';

interface POIModalProps {
  poi: POI | null;
  onClose: () => void;
  onSelectJob: (poiId: string, job: string) => void;
  onTravel: () => void;
}

const POI_ART: Partial<Record<POIType, string>> = {
  [POIType.CAMPFIRE]: ASSET_PATHS.pois.campfire,
  [POIType.FOREST]: ASSET_PATHS.pois.forest,
  [POIType.MOUNTAIN]: ASSET_PATHS.pois.mountain,
  [POIType.FARM]: ASSET_PATHS.pois.farm,
  [POIType.HUNTING_LODGE]: ASSET_PATHS.pois.hunting_lodge,
  [POIType.WINDMILL]: ASSET_PATHS.pois.windmill,
  [POIType.CRAB_TRAP]: ASSET_PATHS.pois.crab_trap,
  [POIType.FISHING_DOCK]: ASSET_PATHS.pois.fishing_dock,
  [POIType.GRANITE_QUARRY]: ASSET_PATHS.pois.granite_quarry,
  [POIType.COFFEE_PLANTATION]: ASSET_PATHS.pois.coffee_plantation,
};

export default function POIModal({ poi, onClose, onSelectJob, onTravel }: POIModalProps) {
  const [user, setUser] = useState(getCurrentUser());
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
      setUser(getCurrentUser());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!poi) return undefined;
    document.body.classList.add('poi-view-open');
    return () => document.body.classList.remove('poi-view-open');
  }, [poi]);

  if (!poi) return null;

  const jobDurations = JOB_DURATION_LABELS;
  const isCampfire = poi.type === POIType.CAMPFIRE;
  const poiWidth = isCampfire ? 2 : 4;
  const poiHeight = isCampfire ? 2 : 4;
  const poiTargetX = poi.x + Math.floor(poiWidth / 2);
  const poiTargetY = poi.y + Math.floor(poiHeight / 2);
  const queuedJobs = user?.jobQueue.length || 0;
  const atLocation = Boolean(
    user &&
    user.x >= poi.x &&
    user.x < poi.x + poiWidth &&
    user.y >= poi.y &&
    user.y < poi.y + poiHeight
  );
  const lastQueuedJob = user?.jobQueue?.[queuedJobs - 1];
  const routeStartX = lastQueuedJob?.targetX ?? user?.traveling?.targetX ?? user?.x ?? 0;
  const routeStartY = lastQueuedJob?.targetY ?? user?.traveling?.targetY ?? user?.y ?? 0;
  const directTravelRemainingMs = user?.traveling && !lastQueuedJob
    ? Math.max(0, user.traveling.duration - (now - user.traveling.startTime))
    : 0;
  const distanceX = !user || atLocation ? 0 : routeStartX < poi.x ? poi.x - routeStartX : Math.max(0, routeStartX - (poi.x + poiWidth - 1));
  const distanceY = !user || atLocation ? 0 : routeStartY < poi.y ? poi.y - routeStartY : Math.max(0, routeStartY - (poi.y + poiHeight - 1));
  const distance = distanceX + distanceY;
  const travelEtaMs = directTravelRemainingMs + (user ? getJobTravelDurationMs(user, distance) : 0);
  const travelEtaLabel = formatPoiTravelEta(travelEtaMs);
  const poiArt = POI_ART[poi.type as POIType];
  const siteLabel = isCampfire ? 'Campfire' : poi.type.replace(/_/g, ' ');

  const handleStartJob = (jobName: string, jobIndex: number) => {
    const result = startJob(poi.id, poi.name, jobName, jobIndex, poiTargetX, poiTargetY, poi.type);
    if (result.success) {
      setError('');
      emitFxEvent({ type: isCampfire ? 'heal' : 'job', tone: isCampfire ? 'green' : 'bone', intensity: 0.48 });
      onSelectJob(poi.id, jobName);
      return;
    }

    setError(result.error || 'Failed to start job.');
  };

  return (
    <div
      className={`poi-site-modal-root ${isCampfire ? 'poi-site-modal-root--campfire' : 'poi-site-modal-root--field'}`}
      onClick={onClose}
    >
      <div className="poi-site-scrim" aria-hidden="true" />

      <div
        className="poi-site-panel command-panel vine-frame rounded border text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={`poi-site-head ${isCampfire ? 'poi-site-head--campfire' : 'poi-site-head--field'}`}>
          <div className="poi-site-head-shade" aria-hidden="true" />
          <div className="poi-site-head-grid" aria-hidden="true" />
          <div className="poi-site-head-row">
            {poiArt && (
              <div className="poi-site-art rounded border">
                <Image
                  src={poiArt}
                  alt=""
                  width={72}
                  height={72}
                  className="object-contain p-1.5"
                  style={{ imageRendering: 'pixelated' }}
                  unoptimized
                />
              </div>
            )}

            <div className="poi-site-head-copy min-w-0">
              <div className="poi-site-head-title-row">
                <p className="arcane-label">{siteLabel}</p>
                <span className="poi-site-queue-badge">Queue {queuedJobs}/4</span>
              </div>
              <h1 className="fantasy-heading poi-site-title">{poi.name}</h1>
            </div>

            <div className="poi-site-head-actions">
              {!atLocation && (
                <button
                  type="button"
                  onClick={onTravel}
                  disabled={!user || Boolean(user.traveling)}
                  className="ui-button-primary poi-site-walkbutton"
                >
                  {user?.traveling ? 'Walking…' : `Walk · ${travelEtaLabel}`}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="ui-button poi-site-close"
                aria-label="Close"
              >
                Close
              </button>
            </div>
          </div>

          {error && (
            <div className="poi-site-error">
              {error}
            </div>
          )}
        </header>

        <div className={`poi-site-body ${isCampfire ? 'poi-site-body--campfire' : 'poi-site-body--field'}`}>
          <div className="poi-site-body-shade" aria-hidden="true" />
          <div className="poi-site-job-grid">
          {poi.jobs.map((job, index) => {
            const reward = getJobRewardPreview(index, poi.type);
            const levelLocked = Boolean(user && (user.stats.level || 1) < (reward.levelRequirement || 1));
            const rewardChips = buildJobRewardChips(reward);

            return (
              <article
                key={job}
                className={`poi-site-job-card rounded border ${isCampfire ? 'poi-site-job-card--campfire' : 'poi-site-job-card--field'} ${levelLocked ? 'poi-site-job-card--locked' : ''}`}
              >
                <div className="poi-site-job-card-head">
                  <h3 className="fantasy-heading poi-site-job-title">{job}</h3>
                  <div className="poi-site-job-meta">
                    {reward.levelRequirement && reward.levelRequirement > 1 && (
                      <span className="ui-pill poi-site-level-pill rounded border px-2 py-0.5 text-[11px] font-black">
                        Lv {reward.levelRequirement}
                      </span>
                    )}
                    <span className="poi-site-job-duration">{jobDurations[index]}</span>
                  </div>
                </div>

                <div className="poi-site-job-rewards poi-site-job-rewards-strip">
                  <RewardIconStrip chips={rewardChips} size="poi" emptyLabel="—" />
                </div>

                <footer className="poi-site-job-card-footer">
                  <button
                    type="button"
                    onClick={() => handleStartJob(job, index)}
                    disabled={queuedJobs >= 4 || levelLocked}
                    className="ui-button-primary poi-site-job-action"
                  >
                    {levelLocked
                      ? `Lv ${reward.levelRequirement}`
                      : queuedJobs >= 4
                        ? 'Queue Full'
                        : atLocation
                          ? 'Start'
                          : user?.traveling
                            ? 'Queue After Walk'
                            : 'Travel & Queue'}
                  </button>
                </footer>
              </article>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatPoiTravelEta(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}
