'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, getJobRewardPreview, getTravelTimeModifier, startJob } from '@/lib/auth';
import { emitFxEvent } from '@/lib/fxEvents';
import { POI } from '@/lib/mapData';

interface POIModalProps {
  poi: POI | null;
  onClose: () => void;
  onSelectJob: (poiId: string, job: string) => void;
}

export default function POIModal({ poi, onClose, onSelectJob }: POIModalProps) {
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

  if (!poi) return null;

  const jobDurations = ['5 min', '15 min', '30 min', '1 hour'];
  const isCampfire = poi.type === 'campfire';
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
  const speedModifier = user ? getTravelTimeModifier(user) : 1;
  const travelMinutes = Math.ceil((directTravelRemainingMs / 60000) + distance * 0.75 * speedModifier);

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
    <div className="world-popup-layer pointer-events-none fixed inset-0 flex items-center justify-center px-4">
      <div
        className="world-popup-panel poi-job-panel command-panel vine-frame pointer-events-auto relative w-full max-w-xl overflow-hidden rounded border text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="fantasy-heading text-xl">{poi.name}</h2>
            <p className="arcane-label">{poi.type.replace('_', ' ')}</p>
          </div>
          <button
            onClick={onClose}
            className="ui-button rounded px-3 py-1 text-xs font-bold"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="poi-job-summary rounded border p-3">
            <div className="arcane-label">{isCampfire ? 'Safe Rest' : 'Field Work'}</div>
            <p className="ui-muted mt-1 text-sm font-bold">
              {poi.description || (isCampfire
                ? 'A dry traveler camp for healing, rumors, and short rests before the next road.'
                : 'Queue work here or preview the route while your commander is already walking.')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <InfoPill label="Queue" value={`${queuedJobs}/4`} />
            <InfoPill label="Route" value={atLocation ? 'Here' : `${travelMinutes} min`} />
            <InfoPill label="Board" value={isCampfire ? 'Rest' : 'Jobs'} />
          </div>

          {error && (
            <div className="rounded border border-red-700 bg-red-950/70 px-4 py-3 text-sm font-bold text-red-200">
              {error}
            </div>
          )}

          <div className="poi-job-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
            {poi.jobs.map((job, index) => {
              const reward = getJobRewardPreview(index, poi.type);
              const levelLocked = Boolean(user && (user.stats.level || 1) < (reward.levelRequirement || 1));
              const rewardLines = formatJobRewardLines(reward);

              return (
                <div
                  key={job}
                  className={`poi-job-card rounded border p-3 ${levelLocked ? 'opacity-60' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-black text-zinc-100">{job}</h3>
                      {reward.levelRequirement && reward.levelRequirement > 1 && (
                        <span className="ui-pill shrink-0 rounded border px-2 py-1 text-[10px] font-black">Lv {reward.levelRequirement}</span>
                      )}
                    </div>
                    <div className="poi-job-rewards mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-bold">
                      <span className="text-zinc-400">{jobDurations[index]}</span>
                      {rewardLines.map(line => (
                        <span key={line} className={getJobRewardLineClass(line)}>{line}</span>
                      ))}
                      {!atLocation && <span className="ui-accent">route +{travelMinutes} min</span>}
                    </div>
                    {reward.rewardNote && <p className="ui-faint mt-2 text-[10px] font-bold">{reward.rewardNote}</p>}
                  </div>
                  <button
                    onClick={() => handleStartJob(job, index)}
                    disabled={queuedJobs >= 4 || levelLocked}
                    className="ui-button-primary mt-4 w-full rounded px-3 py-2 text-xs font-black transition disabled:opacity-40"
                  >
                    {levelLocked
                      ? `Requires Level ${reward.levelRequirement}`
                      : queuedJobs >= 4
                        ? 'Queue Full'
                        : atLocation ? 'Start Job' : user?.traveling ? 'Queue After Walk' : 'Travel & Queue'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatJobRewardLines(reward: ReturnType<typeof getJobRewardPreview>): string[] {
  const lines: string[] = [];
  if (reward.gold > 0) lines.push(`+${reward.gold} gold`);
  if (reward.healthRestore) lines.push(`+${reward.healthRestore} HP`);
  lines.push(`+${reward.exp} XP`);
  if (reward.rareGems) lines.push(`+${reward.rareGems} gems`);
  reward.items?.forEach(item => lines.push(item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name));
  if (reward.equipmentRarity) lines.push(`${reward.equipmentRarity} gear`);
  if (reward.minionTier) {
    const tierName = reward.minionTier === 'tier3' ? 'Tier III' : reward.minionTier === 'tier2' ? 'Tier II' : 'Tier I';
    lines.push(`${tierName} recruit`);
  }
  if (lines.length === 0) lines.push('No reward');
  return lines;
}

function getJobRewardLineClass(line: string): string {
  const normalized = line.toLowerCase();
  if (normalized.includes('gold')) return 'ui-gold';
  if (normalized.includes('xp')) return 'text-sky-300';
  if (normalized.includes('hp')) return 'text-emerald-300';
  if (normalized.includes('gem') || normalized.includes('cache') || normalized.includes('spell')) return 'text-fuchsia-300';
  if (normalized.includes('gear') || normalized.includes('unit') || normalized.includes('recruit')) return 'ui-accent';
  return 'ui-muted';
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="poi-info-pill rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value text-sm font-black">{value}</div>
    </div>
  );
}
