'use client';

import { type WheelEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { getStaticPOIs, MAP_CONFIG, POI, POIType } from '@/lib/mapData';
import { AssetLoader, ASSET_PATHS, getPlayerModelPath, preloadAllAssets } from '@/lib/assetLoader';
import {
  areFriends as areSocialFriends,
  claimReadyQuestRewards,
  claimQuestNpcReward,
  checkJobsComplete,
  checkTravelComplete,
  claimStoryQuestReward,
  getFieldedMinions,
  getCurrentUser,
  getDirectTravelDurationMs,
  getMinionTemplate,
  getQuestNpcStatus,
  getUsers,
  getCityQuestTemplate,
  getCityQuestStatus,
  levelUp,
  RewardSummary,
  startTravel,
  STORY_CHAPTERS,
  getStoryQuestStatus,
  getPendingStoryDialogQuest,
  markStoryQuestIntroSeen,
  recordQuestNpcVisit,
  updateJobTravelProgress,
  isPartyMember as isSocialPartyMember,
} from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCachedWorldPlayers, refreshWorldPlayers, worldMapPlayerToUser } from '@/lib/worldPlayers';
import { BATTLE_SPELLS, WorldEnemy, getBattleRatingPreview, getNpcEnemiesForUser, getPlayerModelAsset } from '@/lib/battle';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import { emitFxEvent } from '@/lib/fxEvents';
import { emitMapFogState } from '@/lib/mapFogEvents';
import { QUEST_NPCS, getAllStoryQuestsSorted, type QuestNpc } from '@/lib/questData';
import { getStoryDialogSequence, type StoryDialogSequence } from '@/lib/storyDialogue';
import { isDungeonQuestObjective, isPoiQuestObjective, isQuestNpcObjective } from '@/lib/questMarkers';
import StoryDialogOverlay from './StoryDialogOverlay';
import { WorldDungeon, formatDungeonTimeRemaining, getActiveDungeons, getRegionForTile } from '@/lib/worldEvents';
import POIModal from './POIModal';
import TownModal from './TownModal';
import PlayerListModal from './PlayerListModal';
import { DungeonRunModal, EncounterRunModal, getEncounterRunBattleCount } from './RoguelikeRunModal';
import CinematicScrollShell from './CinematicScrollShell';
import {
  clearMultiplayerTutorialDialogue,
  completeMultiplayerTutorialCallout,
  getMultiplayerTutorialDialogueLine,
  MULTIPLAYER_FIND_WORK_EVENT,
  saveMultiplayerTutorialDialogueLine,
} from '@/lib/multiplayerTutorial';

// POI image mapping
const POI_IMAGE_PATHS: Record<POIType, string> = {
  [POIType.FOREST]: ASSET_PATHS.pois.forest,
  [POIType.MOUNTAIN]: ASSET_PATHS.pois.mountain,
  [POIType.FARM]: ASSET_PATHS.pois.farm,
  [POIType.HUNTING_LODGE]: ASSET_PATHS.pois.hunting_lodge,
  [POIType.WINDMILL]: ASSET_PATHS.pois.windmill,
  [POIType.CRAB_TRAP]: ASSET_PATHS.pois.crab_trap,
  [POIType.FISHING_DOCK]: ASSET_PATHS.pois.fishing_dock,
  [POIType.GRANITE_QUARRY]: ASSET_PATHS.pois.granite_quarry,
  [POIType.COFFEE_PLANTATION]: ASSET_PATHS.pois.coffee_plantation,
  [POIType.CAMPFIRE]: ASSET_PATHS.pois.campfire,
  [POIType.TOWN]: ASSET_PATHS.pois.harborview,
};

interface MarkerTone {
  fill: string;
  ring: string;
  ringHover: string;
  glow: string;
  glowHover: string;
  label: string;
}

const MAP_MARKER_TONES = {
  poi: {
    fill: 'rgba(12, 10, 12, 0.78)',
    ring: 'rgba(244, 229, 196, 0.74)',
    ringHover: 'rgba(255, 250, 235, 0.95)',
    glow: 'rgba(244, 229, 196, 0.36)',
    glowHover: 'rgba(255, 250, 235, 0.72)',
    label: '#fff4dc',
  },
  town: {
    fill: 'rgba(22, 13, 16, 0.82)',
    ring: 'rgba(234, 220, 154, 0.82)',
    ringHover: 'rgba(255, 245, 194, 0.98)',
    glow: 'rgba(234, 220, 154, 0.46)',
    glowHover: 'rgba(255, 245, 194, 0.82)',
    label: '#fff1bd',
  },
} satisfies Record<string, MarkerTone>;

const JOB_POI_GLOW_TONES: Partial<Record<POIType, { inner: string; outer: string; ring: string; shadow: string }>> = {
  [POIType.FOREST]: { inner: '164, 198, 122', outer: '48, 72, 38', ring: 'rgba(148, 178, 108, 0.34)', shadow: 'rgba(148, 178, 108, 0.58)' },
  [POIType.MOUNTAIN]: { inner: '196, 188, 176', outer: '72, 68, 76', ring: 'rgba(176, 168, 156, 0.34)', shadow: 'rgba(176, 168, 156, 0.55)' },
  [POIType.FARM]: { inner: '232, 196, 118', outer: '118, 84, 36', ring: 'rgba(214, 178, 108, 0.36)', shadow: 'rgba(214, 178, 108, 0.58)' },
  [POIType.HUNTING_LODGE]: { inner: '214, 168, 108', outer: '102, 68, 38', ring: 'rgba(196, 154, 102, 0.36)', shadow: 'rgba(196, 154, 102, 0.56)' },
  [POIType.WINDMILL]: { inner: '236, 210, 138', outer: '124, 96, 44', ring: 'rgba(220, 194, 128, 0.36)', shadow: 'rgba(220, 194, 128, 0.58)' },
  [POIType.CRAB_TRAP]: { inner: '132, 188, 204', outer: '38, 84, 98', ring: 'rgba(118, 176, 194, 0.34)', shadow: 'rgba(118, 176, 194, 0.55)' },
  [POIType.FISHING_DOCK]: { inner: '128, 176, 210', outer: '36, 72, 98', ring: 'rgba(112, 162, 196, 0.34)', shadow: 'rgba(112, 162, 196, 0.56)' },
  [POIType.GRANITE_QUARRY]: { inner: '206, 198, 186', outer: '82, 76, 84', ring: 'rgba(186, 178, 168, 0.34)', shadow: 'rgba(186, 178, 168, 0.55)' },
  [POIType.COFFEE_PLANTATION]: { inner: '206, 154, 96', outer: '98, 62, 28', ring: 'rgba(188, 142, 88, 0.36)', shadow: 'rgba(188, 142, 88, 0.56)' },
};

const JOB_POI_DISK = {
  border: 'rgba(122, 112, 98, 0.64)',
  borderHover: 'rgba(188, 172, 142, 0.8)',
};

const JOB_POI_SKY_TONES: Partial<Record<POIType, { top: string; mid: string; bottom: string }>> = {
  [POIType.FOREST]: { top: 'rgba(104, 122, 132, 0.96)', mid: 'rgba(78, 92, 82, 0.92)', bottom: 'rgba(50, 46, 40, 0.94)' },
  [POIType.MOUNTAIN]: { top: 'rgba(118, 128, 142, 0.96)', mid: 'rgba(88, 86, 94, 0.92)', bottom: 'rgba(58, 54, 60, 0.94)' },
  [POIType.FARM]: { top: 'rgba(124, 138, 154, 0.96)', mid: 'rgba(102, 92, 74, 0.92)', bottom: 'rgba(74, 58, 42, 0.94)' },
  [POIType.HUNTING_LODGE]: { top: 'rgba(118, 132, 146, 0.96)', mid: 'rgba(94, 82, 68, 0.92)', bottom: 'rgba(66, 52, 40, 0.94)' },
  [POIType.WINDMILL]: { top: 'rgba(128, 140, 156, 0.96)', mid: 'rgba(104, 94, 76, 0.92)', bottom: 'rgba(76, 62, 46, 0.94)' },
  [POIType.CRAB_TRAP]: { top: 'rgba(108, 132, 148, 0.96)', mid: 'rgba(78, 92, 98, 0.92)', bottom: 'rgba(48, 58, 62, 0.94)' },
  [POIType.FISHING_DOCK]: { top: 'rgba(102, 128, 152, 0.96)', mid: 'rgba(74, 88, 100, 0.92)', bottom: 'rgba(46, 56, 66, 0.94)' },
  [POIType.GRANITE_QUARRY]: { top: 'rgba(116, 126, 138, 0.96)', mid: 'rgba(90, 86, 88, 0.92)', bottom: 'rgba(60, 56, 58, 0.94)' },
  [POIType.COFFEE_PLANTATION]: { top: 'rgba(120, 134, 148, 0.96)', mid: 'rgba(98, 84, 66, 0.92)', bottom: 'rgba(70, 54, 38, 0.94)' },
};

const DEFAULT_JOB_POI_SKY = {
  top: 'rgba(118, 132, 146, 0.96)',
  mid: 'rgba(94, 88, 78, 0.92)',
  bottom: 'rgba(64, 56, 48, 0.94)',
};

const DEFAULT_JOB_POI_GLOW = {
  inner: '214, 188, 132',
  outer: '92, 72, 44',
  ring: 'rgba(196, 168, 118, 0.34)',
  shadow: 'rgba(196, 168, 118, 0.55)',
};

const CAMPFIRE_MARKER_TILES = 1.5;

function campfireSeed(value: number): number {
  const seeded = Math.sin(value) * 10000;
  return seeded - Math.floor(seeded);
}

function drawCampfireGroundGlow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  alpha: number
): void {
  const radius = size * 0.38;
  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  glow.addColorStop(0, `rgba(255, 142, 58, ${alpha})`);
  glow.addColorStop(0.55, `rgba(220, 88, 32, ${alpha * 0.35})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawCampfireEmberParticles(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  now: number,
  pulse: number
): void {
  const seedBase = centerX * 0.17 + centerY * 0.23;
  const particleCount = 4;

  for (let index = 0; index < particleCount; index += 1) {
    const particleSeed = seedBase + index * 17.17;
    const phase = (now / 2400 + index * 0.21 + campfireSeed(particleSeed)) % 1;
    const drift = (campfireSeed(particleSeed + 3) - 0.5) * size * 0.26;
    const x = centerX + drift;
    const y = centerY + size * 0.03 - phase * size * 0.34;
    const sparkWidth = 1;
    const sparkHeight = 1.2 + campfireSeed(particleSeed + 5) * 2.2;
    const alpha = (1 - phase) * (0.07 + pulse * 0.09);
    const green = 128 + Math.floor(campfireSeed(particleSeed + 7) * 48);
    const blue = 34 + Math.floor(campfireSeed(particleSeed + 9) * 24);
    const angle = campfireSeed(particleSeed + 11) * Math.PI * 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(255, ${green}, ${blue}, ${alpha})`;
    ctx.fillRect(-sparkWidth / 2, -sparkHeight / 2, sparkWidth, sparkHeight);
    ctx.restore();
  }
}

const DEFAULT_MAP_ZOOM = 1.75;
const MAX_MAP_ZOOM = 2.75;
const MIN_PLAYABLE_MAP_ZOOM = 1.62;
const MAP_ZOOM_OUT_RANGE_FACTOR = 0.5;
const ZOOM_STEP = 0.14;
const DIRECT_TRAVEL_RENDER_INTERVAL_MS = 1000 / 15;
const MAP_REVEAL_RADIUS = 105;
const MAP_PLAYER_REVEAL_RADIUS = 70;
const MAIN_QUEST_TRACKER_HIDDEN_KEY = 'wizardy_main_quest_tracker_hidden';

type TravelIntentKind = 'enemy' | 'player' | 'poi' | 'town' | 'dungeon' | 'quest' | 'tile';

interface PendingTravelIntent {
  targetX: number;
  targetY: number;
  label: string;
  kind: TravelIntentKind;
}

function getRenderedUserPosition(user: ReturnType<typeof getCurrentUser>, now: number): { x: number; y: number } | null {
  if (!user) return null;
  const travel = user.traveling;
  if (!travel) {
    const activeJob = user.jobQueue?.[0];
    const activeJobTravelDuration = activeJob ? Math.max(0, activeJob.duration - activeJob.workDuration) : 0;
    if (activeJob && now >= activeJob.startTime && !activeJob.travelComplete && activeJobTravelDuration > 0) {
      const distanceX = Math.abs(activeJob.targetX - activeJob.startX);
      const distanceY = Math.abs(activeJob.targetY - activeJob.startY);
      const totalDistance = distanceX + distanceY;
      if (totalDistance <= 0) return { x: activeJob.targetX, y: activeJob.targetY };

      const progress = Math.max(0, Math.min(1, (now - activeJob.startTime) / activeJobTravelDuration));
      const coveredDistance = totalDistance * progress;
      const xDirection = activeJob.targetX >= activeJob.startX ? 1 : -1;
      const yDirection = activeJob.targetY >= activeJob.startY ? 1 : -1;
      const xDistance = Math.min(distanceX, coveredDistance);
      const yDistance = Math.max(0, coveredDistance - distanceX);

      return {
        x: activeJob.startX + xDistance * xDirection,
        y: activeJob.startY + Math.min(distanceY, yDistance) * yDirection,
      };
    }

    return { x: user.x, y: user.y };
  }

  const startX = travel.startX ?? user.x;
  const startY = travel.startY ?? user.y;
  const distanceX = Math.abs(travel.targetX - startX);
  const distanceY = Math.abs(travel.targetY - startY);
  const totalDistance = distanceX + distanceY;

  if (totalDistance <= 0 || travel.duration <= 0) {
    return { x: travel.targetX, y: travel.targetY };
  }

  const progress = Math.max(0, Math.min(1, (now - travel.startTime) / travel.duration));
  const coveredDistance = totalDistance * progress;
  const xDirection = travel.targetX >= startX ? 1 : -1;
  const yDirection = travel.targetY >= startY ? 1 : -1;
  const xDistance = Math.min(distanceX, coveredDistance);
  const yDistance = Math.max(0, coveredDistance - distanceX);

  return {
    x: startX + xDistance * xDirection,
    y: startY + Math.min(distanceY, yDistance) * yDirection,
  };
}

function getMinMapZoom(viewportWidth: number, viewportHeight: number): number {
  const fitToScreenZoom = Math.max(
    viewportWidth / (MAP_CONFIG.width * MAP_CONFIG.tileSize),
    viewportHeight / (MAP_CONFIG.height * MAP_CONFIG.tileSize),
    0.5,
  );
  const zoomOutRange = Math.max(0, DEFAULT_MAP_ZOOM - fitToScreenZoom);
  const limitedMin = DEFAULT_MAP_ZOOM - zoomOutRange * MAP_ZOOM_OUT_RANGE_FACTOR;

  return Math.min(
    MAX_MAP_ZOOM,
    Math.max(MIN_PLAYABLE_MAP_ZOOM, limitedMin),
  );
}

function getFogRevealZoomScale(zoom: number): number {
  return Math.max(0.78, Math.min(1.48, zoom / DEFAULT_MAP_ZOOM));
}

function isScreenPointRevealed(
  point: { x: number; y: number },
  cursor: { x: number; y: number } | null,
  player: { x: number; y: number } | null,
  zoom: number
): boolean {
  const revealScale = getFogRevealZoomScale(zoom);
  const nearCursor = cursor
    ? Math.hypot(point.x - cursor.x, point.y - cursor.y) <= MAP_REVEAL_RADIUS * revealScale
    : false;
  const nearPlayer = player
    ? Math.hypot(point.x - player.x, point.y - player.y) <= MAP_PLAYER_REVEAL_RADIUS * revealScale
    : false;
  return nearCursor || nearPlayer;
}

function getSpriteZoomBoost(zoom: number): number {
  return 1 + Math.max(0, zoom - 1) * 0.18;
}

function getCharacterSpriteSize(tileSize: number, zoom: number, baseScale: number, minimumSize: number): number {
  return Math.max(minimumSize, tileSize * baseScale * getSpriteZoomBoost(zoom));
}

function formatTravelEta(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function findEnemyAtScreenPoint(
  enemies: WorldEnemy[],
  screenX: number,
  screenY: number,
  cameraX: number,
  cameraY: number,
  tileSize: number,
  zoom: number
): WorldEnemy | null {
  const hitRadius = Math.max(tileSize * 0.62, getCharacterSpriteSize(tileSize, zoom, 0.88, 25) * 0.54);
  const hits = enemies
    .map(enemy => {
      const centerX = enemy.x * tileSize - cameraX + tileSize / 2;
      const centerY = enemy.y * tileSize - cameraY + tileSize / 2;
      return {
        enemy,
        distance: Math.hypot(centerX - screenX, centerY - screenY),
      };
    })
    .filter(hit => hit.distance <= hitRadius)
    .sort((a, b) => a.distance - b.distance);

  return hits[0]?.enemy || null;
}

function getPoiFootprint(poi: POI): { width: number; height: number } {
  if (poi.type === POIType.TOWN) return { width: 8, height: 8 };
  if (poi.type === POIType.CAMPFIRE) return { width: 2, height: 2 };
  return { width: 4, height: 4 };
}

function isTileInsideFootprint(
  tileX: number,
  tileY: number,
  targetX: number,
  targetY: number,
  width: number,
  height: number
): boolean {
  return tileX >= targetX && tileX < targetX + width && tileY >= targetY && tileY < targetY + height;
}

function getFootprintCenterTile(targetX: number, targetY: number, width: number, height: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(MAP_CONFIG.width - 1, targetX + Math.floor(width / 2))),
    y: Math.max(0, Math.min(MAP_CONFIG.height - 1, targetY + Math.floor(height / 2))),
  };
}

function getPoiTravelTarget(poi: POI): { x: number; y: number } {
  const { width, height } = getPoiFootprint(poi);
  return getFootprintCenterTile(poi.x, poi.y, width, height);
}

function getNpcLevelDistance(levelRange: string, targetLevel: number): number {
  const [min, max] = levelRange.split('-').map(value => Number(value) || 1);
  if (targetLevel >= min && targetLevel <= max) return 0;
  return Math.min(Math.abs(targetLevel - min), Math.abs(targetLevel - max));
}

function isLevelInsideNpcRange(levelRange: string, targetLevel: number): boolean {
  return getNpcLevelDistance(levelRange, targetLevel) === 0;
}

function getQuestGuideNpc(requiredLevel: number, town?: string): QuestNpc | undefined {
  const candidates = town ? QUEST_NPCS.filter(npc => npc.town === town) : QUEST_NPCS;
  return [...(candidates.length > 0 ? candidates : QUEST_NPCS)]
    .sort((left, right) => getNpcLevelDistance(left.levelRange, requiredLevel) - getNpcLevelDistance(right.levelRange, requiredLevel))[0];
}

function isQuestNpcRequestedByActiveQuest(currentUser: ReturnType<typeof getCurrentUser>, npc: QuestNpc): boolean {
  if (!currentUser) return false;
  const activeStoryNpc = STORY_CHAPTERS
    .flatMap(chapter => chapter.quests)
    .sort((left, right) => left.order - right.order)
    .find(story => {
      const status = getStoryQuestStatus(currentUser, story.id);
      if (!status.unlocked || status.claimed || status.complete) return false;
      return getQuestGuideNpc(story.requiredLevel)?.id === npc.id;
    });
  if (activeStoryNpc) return true;

  return (currentUser.cityQuests || []).some(progress => {
    if (progress.claimed) return false;
    const template = getCityQuestTemplate(progress.questId);
    if (!template) return false;
    const status = getCityQuestStatus(currentUser, progress.questId);
    if (status.complete) return false;
    return getQuestGuideNpc(currentUser.stats.level, template.town)?.id === npc.id;
  });
}

function shouldShowQuestNpcMarker(currentUser: ReturnType<typeof getCurrentUser>, npc: QuestNpc): boolean {
  if (!currentUser) return false;
  if (isQuestNpcObjective(currentUser, npc.id)) return true;
  if (isQuestNpcRequestedByActiveQuest(currentUser, npc)) return true;
  return false;
}

function getEnemyScreenCenter(
  enemy: WorldEnemy,
  cameraX: number,
  cameraY: number,
  tileSize: number
): { x: number; y: number } {
  return {
    x: enemy.x * tileSize - cameraX + tileSize / 2,
    y: enemy.y * tileSize - cameraY + tileSize / 2,
  };
}

function isEnemyRevealedOnScreen(
  enemy: WorldEnemy,
  cameraX: number,
  cameraY: number,
  tileSize: number,
  cursor: { x: number; y: number } | null,
  playerRevealPoint: { x: number; y: number } | null,
  zoom: number
): boolean {
  return isScreenPointRevealed(getEnemyScreenCenter(enemy, cameraX, cameraY, tileSize), cursor, playerRevealPoint, zoom);
}

function drawMapLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = 'bold 10px serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawJobPoiSkyBackdrop(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  sky: { top: string; mid: string; bottom: string },
  hovered: boolean
): void {
  const skyTop = centerY - radius;
  const skyGradient = ctx.createLinearGradient(centerX, skyTop, centerX, centerY + radius);
  skyGradient.addColorStop(0, sky.top);
  skyGradient.addColorStop(0.52, sky.mid);
  skyGradient.addColorStop(1, sky.bottom);
  ctx.fillStyle = skyGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  const haze = ctx.createRadialGradient(
    centerX,
    centerY + radius * 0.12,
    0,
    centerX,
    centerY,
    radius
  );
  haze.addColorStop(0, hovered ? 'rgba(214, 198, 168, 0.16)' : 'rgba(196, 184, 164, 0.12)');
  haze.addColorStop(0.72, 'rgba(120, 108, 92, 0.06)');
  haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawJobPoiDisk(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  hovered: boolean,
  sky: { top: string; mid: string; bottom: string },
  accentRing?: string
): void {
  drawJobPoiSkyBackdrop(ctx, centerX, centerY, radius, sky, hovered);

  ctx.save();
  ctx.lineWidth = hovered ? 1.35 : 1.1;
  ctx.strokeStyle = hovered ? JOB_POI_DISK.borderHover : JOB_POI_DISK.border;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (accentRing) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = hovered
      ? accentRing.replace(/[\d.]+\)$/, '0.34)')
      : accentRing.replace(/[\d.]+\)$/, '0.18)');
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 1.8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMapGlowPool(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    innerRgb: string;
    outerRgb: string;
    alpha: number;
  }
): void {
  const { centerX, centerY, radiusX, radiusY, innerRgb, outerRgb, alpha } = options;
  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(radiusX, radiusY));
  glow.addColorStop(0, `rgba(${innerRgb}, ${alpha})`);
  glow.addColorStop(0.55, `rgba(${outerRgb}, ${alpha * 0.48})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMapPulseRing(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
  pulse: number,
  dashed = true
): void {
  ctx.save();
  ctx.strokeStyle = color.replace(/[\d.]+\)$/, `${0.16 + pulse * 0.14})`);
  ctx.lineWidth = 1;
  if (dashed) ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  if (dashed) ctx.setLineDash([]);
  ctx.restore();
}

function drawCircularLandmarkMarker(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    footprint: number;
    radiusRatio: number;
    hoveredRadiusRatio?: number;
    image?: HTMLImageElement | null;
    hovered?: boolean;
    fallbackLabel?: string;
    label?: string;
    showLabel?: boolean;
    ringColor: string;
    ringHoverColor: string;
    backingColor: string;
    labelColor: string;
    ringWidth?: number;
    ringHoverWidth?: number;
    accentColor?: string;
    idleImageFilter?: string;
  }
): void {
  const {
    centerX,
    centerY,
    footprint,
    radiusRatio,
    hoveredRadiusRatio = radiusRatio * 1.08,
    image,
    hovered = false,
    fallbackLabel = '?',
    label,
    showLabel = false,
    ringColor,
    ringHoverColor,
    backingColor,
    labelColor,
    ringWidth = 1,
    ringHoverWidth = 1.5,
    accentColor,
    idleImageFilter,
  } = options;
  const radius = footprint * (hovered ? hoveredRadiusRatio : radiusRatio);

  drawGroundShadow(ctx, centerX, centerY + radius * 0.72, radius * 0.72, radius * 0.22);

  ctx.save();
  ctx.fillStyle = backingColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = hovered ? ringHoverWidth : ringWidth;
  ctx.strokeStyle = hovered ? ringHoverColor : ringColor;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.86, 0, Math.PI * 2);
  ctx.clip();
  if (image) {
    const imageSize = radius * 2.05;
    ctx.save();
    if (!hovered && idleImageFilter) {
      ctx.filter = idleImageFilter;
    }
    ctx.drawImage(image, centerX - imageSize / 2, centerY - imageSize / 2, imageSize, imageSize);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.fillStyle = labelColor;
    ctx.font = `bold ${Math.max(8, radius * 0.55)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackLabel, centerX, centerY);
  }
  ctx.restore();

  if (accentColor) {
    ctx.save();
    ctx.strokeStyle = hovered ? accentColor : accentColor.replace(/[\d.]+\)$/, '0.52)');
    ctx.lineWidth = hovered ? 1.35 : 1.1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 0.6, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    ctx.restore();
  }

  if (label && (showLabel || hovered)) {
    ctx.save();
    ctx.fillStyle = labelColor;
    ctx.font = `bold ${hovered ? 10 : 9}px serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 3;
    ctx.fillText(label, centerX, centerY + radius + 9);
    ctx.restore();
  }
}

function drawTownMarker(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    footprint: number;
    image?: HTMLImageElement | null;
    hovered?: boolean;
    fallbackLabel?: string;
    label: string;
  }
): void {
  const { centerX, centerY, footprint, image, hovered = false, fallbackLabel = '?', label } = options;

  drawCircularLandmarkMarker(ctx, {
    centerX,
    centerY,
    footprint,
    radiusRatio: 0.13,
    hoveredRadiusRatio: 0.15,
    image,
    hovered,
    fallbackLabel,
    label,
    showLabel: true,
    ringColor: 'rgba(234, 220, 154, 0.72)',
    ringHoverColor: 'rgba(255, 236, 170, 0.95)',
    backingColor: 'rgba(8, 7, 9, 0.55)',
    labelColor: MAP_MARKER_TONES.town.label,
    ringWidth: 1.25,
    ringHoverWidth: 2,
  });
}

function drawCampfireMarker(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    footprint: number;
    image?: HTMLImageElement | null;
    hovered?: boolean;
    label?: string;
    now?: number;
  }
): void {
  const { centerX, centerY, footprint, image, hovered = false, label, now = 0 } = options;
  const pulse = 0.5 + 0.5 * Math.sin(now / 1400);
  const flicker = 0.5 + 0.5 * Math.sin(now / 760 + 0.8);
  const size = footprint * (hovered ? 1.06 : 1);
  const poolAlpha = (0.16 + pulse * 0.1) * (0.94 + flicker * 0.06);
  const fogHaloAlpha = (0.045 + pulse * 0.028) * (0.9 + flicker * 0.08);

  drawMapGlowPool(ctx, {
    centerX,
    centerY,
    radiusX: size * 1.9,
    radiusY: size * 1.55,
    innerRgb: '255, 108, 42',
    outerRgb: '214, 68, 22',
    alpha: fogHaloAlpha,
  });
  drawCampfireGroundGlow(ctx, centerX, centerY, size, poolAlpha);
  drawCampfireGroundGlow(ctx, centerX, centerY, size, poolAlpha * 0.28);

  if (image) {
    ctx.drawImage(
      image,
      centerX - size / 2,
      centerY - size / 2,
      size,
      size
    );
  }

  drawCampfireEmberParticles(ctx, centerX, centerY, size, now, pulse);

  if (hovered && label) {
    drawMapLabel(ctx, label, centerX, centerY + size * 0.56, '#ffd7a8');
  }
}

function drawJobPoiMarker(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    footprint: number;
    poiType: POIType;
    image?: HTMLImageElement | null;
    hovered?: boolean;
    fallbackLabel?: string;
    label?: string;
    now?: number;
  }
): void {
  const { centerX, centerY, footprint, poiType, image, hovered = false, fallbackLabel = '?', label, now = 0 } = options;
  const pulse = 0.5 + 0.5 * Math.sin(now / 520);
  const radius = footprint * (hovered ? 0.22 : 0.2);
  const diskRadius = radius * 0.88;
  const glow = JOB_POI_GLOW_TONES[poiType] ?? DEFAULT_JOB_POI_GLOW;
  const sky = JOB_POI_SKY_TONES[poiType] ?? DEFAULT_JOB_POI_SKY;
  const poolAlpha = hovered ? 0.2 : 0.08 + pulse * 0.06;
  const glowStrength = hovered ? 0.62 : 0.26 + pulse * 0.14;

  drawGroundShadow(ctx, centerX, centerY + diskRadius * 0.66, diskRadius * 0.72, diskRadius * 0.2);

  ctx.save();
  drawMapGlowPool(ctx, {
    centerX,
    centerY: centerY + radius * 0.02,
    radiusX: diskRadius * 1.08,
    radiusY: diskRadius * 0.96,
    innerRgb: glow.inner,
    outerRgb: glow.outer,
    alpha: poolAlpha,
  });
  ctx.restore();

  drawJobPoiDisk(ctx, centerX, centerY, diskRadius, hovered, sky, glow.ring);

  const clipRadius = diskRadius - 1.2;
  const imageZoom = hovered ? 1.82 : 1.74;
  const imageOffsetY = clipRadius * 0.04;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, clipRadius, 0, Math.PI * 2);
  ctx.clip();

  drawJobPoiSkyBackdrop(ctx, centerX, centerY, clipRadius, sky, hovered);

  if (image) {
    const imageSize = clipRadius * 2 * imageZoom;
    ctx.save();
    ctx.shadowColor = glow.shadow.replace(/[\d.]+\)$/, `${glowStrength})`);
    ctx.shadowBlur = hovered ? 10 : 4 + pulse * 4;
    ctx.globalAlpha = hovered ? 0.99 : 0.97;
    ctx.filter = hovered
      ? 'brightness(1.06) saturate(1.05)'
      : `brightness(${0.99 + pulse * 0.02}) saturate(${0.96 + pulse * 0.03})`;
    ctx.drawImage(
      image,
      centerX - imageSize / 2,
      centerY - imageSize / 2 - imageOffsetY,
      imageSize,
      imageSize
    );
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(centerX - clipRadius, centerY - clipRadius, clipRadius * 2, clipRadius * 2);
    ctx.fillStyle = MAP_MARKER_TONES.poi.label;
    ctx.font = `bold ${Math.max(8, clipRadius * 0.48)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackLabel, centerX, centerY);
  }
  ctx.restore();

  if (hovered && label) {
    drawMapLabel(ctx, label, centerX, centerY + diskRadius + 8, MAP_MARKER_TONES.poi.label);
  }
}

function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  options: {
    image?: HTMLImageElement | null;
    x: number;
    y: number;
    size: number;
    fallbackColor: string;
    label?: string;
    labelColor: string;
    topText?: string;
    topTextColor?: string;
    hovered?: boolean;
  }
): void {
  const {
    image,
    x,
    y,
    size,
    fallbackColor,
    label,
    labelColor,
    topText,
    topTextColor = labelColor,
    hovered = false,
  } = options;
  const drawX = x;
  const drawY = y;
  const drawSize = Math.max(1, size);

  if (image) {
    const shadowX = drawX + drawSize / 2;
    const shadowY = drawY + drawSize * 0.9;
    drawGroundShadow(ctx, shadowX, shadowY, drawSize * 0.26, drawSize * 0.09);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (hovered) {
      ctx.filter = 'brightness(1.06) contrast(1.04)';
    }
    ctx.drawImage(image, drawX, drawY, drawSize, drawSize);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(drawX + drawSize * 0.2, drawY + drawSize * 0.2, drawSize * 0.6, drawSize * 0.6);
    ctx.restore();
  }

  if (topText) {
    drawMapLabel(ctx, topText, x + size / 2, y - 4, topTextColor);
  }

  if (label) {
    drawMapLabel(ctx, label, x + size / 2, y + size + 10, labelColor);
  }
}

function drawTravelPathPreview(
  ctx: CanvasRenderingContext2D,
  options: {
    start: { x: number; y: number };
    target: { x: number; y: number };
    tileSize: number;
    cameraX: number;
    cameraY: number;
    active: boolean;
    now: number;
  }
): void {
  const { start, target, tileSize, cameraX, cameraY, active, now } = options;
  if (Math.abs(start.x - target.x) < 0.02 && Math.abs(start.y - target.y) < 0.02) return;

  const toScreen = (point: { x: number; y: number }) => ({
    x: point.x * tileSize - cameraX + tileSize / 2,
    y: point.y * tileSize - cameraY + tileSize / 2,
  });

  const worldPoints = [
    start,
    { x: target.x, y: start.y },
    target,
  ].filter((point, index, points) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return Math.abs(point.x - previous.x) > 0.02 || Math.abs(point.y - previous.y) > 0.02;
  });
  const points = worldPoints.map(toScreen);
  const targetScreen = points[points.length - 1];
  const primary = active ? 'rgba(125, 211, 252, 0.88)' : 'rgba(244, 221, 176, 0.88)';
  const glow = active ? 'rgba(56, 189, 248, 0.26)' : 'rgba(244, 221, 176, 0.24)';
  const shadow = active ? 'rgba(14, 116, 144, 0.3)' : 'rgba(91, 18, 34, 0.22)';
  const dash = Math.max(7, tileSize * 0.22);
  const gap = Math.max(5, tileSize * 0.16);

  const strokePath = () => {
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = shadow;
  ctx.shadowBlur = Math.max(8, tileSize * 0.22);
  strokePath();
  ctx.strokeStyle = glow;
  ctx.lineWidth = Math.max(6, tileSize * 0.12);
  ctx.stroke();

  ctx.setLineDash([dash, gap]);
  ctx.lineDashOffset = active ? -(now / 64) % (dash + gap) : 0;
  strokePath();
  ctx.strokeStyle = primary;
  ctx.lineWidth = Math.max(2, tileSize * 0.04);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.shadowBlur = Math.max(10, tileSize * 0.18);
  ctx.strokeStyle = primary;
  ctx.lineWidth = Math.max(1.5, tileSize * 0.035);
  ctx.beginPath();
  ctx.arc(targetScreen.x, targetScreen.y, Math.max(8, tileSize * 0.2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(targetScreen.x, targetScreen.y, Math.max(3, tileSize * 0.07), 0, Math.PI * 2);
  ctx.fillStyle = primary;
  ctx.fill();
  ctx.restore();
}

interface MapRendererProps {
  viewportWidth?: number;
  viewportHeight?: number;
}

export default function MapRenderer({ 
  viewportWidth, 
  viewportHeight 
}: MapRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraX, setCameraX] = useState(0);
  const [cameraY, setCameraY] = useState(0);
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [selectedTown, setSelectedTown] = useState<POI | null>(null);
  const [selectedEnemy, setSelectedEnemy] = useState<WorldEnemy | null>(null);
  const [activeBattleEnemy, setActiveBattleEnemy] = useState<WorldEnemy | null>(null);
  const [selectedDungeon, setSelectedDungeon] = useState<WorldDungeon | null>(null);
  const [selectedDungeonRun, setSelectedDungeonRun] = useState<WorldDungeon | null>(null);
  const [selectedQuestNpc, setSelectedQuestNpc] = useState<QuestNpc | null>(null);
  const [hoveredPOI, setHoveredPOI] = useState<POI | null>(null);
  const [hoveredEnemy, setHoveredEnemy] = useState<WorldEnemy | null>(null);
  const [hoveredDungeon, setHoveredDungeon] = useState<WorldDungeon | null>(null);
  const [hoveredQuestNpc, setHoveredQuestNpc] = useState<QuestNpc | null>(null);
  const [cursorScreen, setCursorScreen] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [dimensionsReady, setDimensionsReady] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showPlayerList, setShowPlayerList] = useState(false);
  const [playerListLocation, setPlayerListLocation] = useState<{ x: number; y: number } | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [worldPlayersTick, setWorldPlayersTick] = useState(0);
  const [worldNow, setWorldNow] = useState(() => Date.now());
  const [mapAnimNow, setMapAnimNow] = useState(() => Date.now());
  const [pendingTravel, setPendingTravel] = useState<PendingTravelIntent | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [mainQuestTrackerHidden, setMainQuestTrackerHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(MAIN_QUEST_TRACKER_HIDDEN_KEY) === 'true';
  });
  const [storyDialogQuestId, setStoryDialogQuestId] = useState<string | null>(null);
  const cameraInitialized = useRef(false);
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const worldEnemySignatureRef = useRef('');
  const activeBattleEnemyRef = useRef<WorldEnemy | null>(null);
  const selectedDungeonRunRef = useRef<WorldDungeon | null>(null);
  const poisData = useMemo(() => getStaticPOIs(), []);

  useEffect(() => {
    const openNearestWorkSite = () => {
      const user = getCurrentUser();
      if (!user) return;
      const nearest = poisData
        .filter(poi => poi.type !== POIType.TOWN && poi.jobs.length > 0)
        .sort((left, right) => {
          const leftOffset = left.type === POIType.CAMPFIRE ? 1 : 2;
          const rightOffset = right.type === POIType.CAMPFIRE ? 1 : 2;
          const leftDistance = Math.abs(user.x - (left.x + leftOffset)) + Math.abs(user.y - (left.y + leftOffset));
          const rightDistance = Math.abs(user.x - (right.x + rightOffset)) + Math.abs(user.y - (right.y + rightOffset));
          return leftDistance - rightDistance;
        })[0];
      if (!nearest) return;

      setSelectedPOI(nearest);
      setSelectedTown(null);
      setSelectedEnemy(null);
      setSelectedDungeon(null);
      setSelectedQuestNpc(null);
      setShowPlayerList(false);
      setPendingTravel(null);
    };

    window.addEventListener(MULTIPLAYER_FIND_WORK_EVENT, openNearestWorkSite);
    return () => window.removeEventListener(MULTIPLAYER_FIND_WORK_EVENT, openNearestWorkSite);
  }, [poisData]);

  useEffect(() => {
    activeBattleEnemyRef.current = activeBattleEnemy;
  }, [activeBattleEnemy]);

  useEffect(() => {
    selectedDungeonRunRef.current = selectedDungeonRun;
  }, [selectedDungeonRun]);

  useEffect(() => {
    const pending = getPendingStoryDialogQuest(currentUser);
    if (!pending || storyDialogQuestId) return;

    if (!getStoryDialogSequence(pending.dialogId)) {
      markStoryQuestIntroSeen(pending.id);
      const refreshFrame = window.requestAnimationFrame(() => setCurrentUser(getCurrentUser()));
      return () => window.cancelAnimationFrame(refreshFrame);
    }

    const openFrame = window.requestAnimationFrame(() => setStoryDialogQuestId(pending.id));
    return () => window.cancelAnimationFrame(openFrame);
  }, [currentUser, storyDialogQuestId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsMounted(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    preloadAllAssets().then(() => {
      setAssetsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser) return;

    let cancelled = false;
    const syncWorldPlayers = async () => {
      await refreshWorldPlayers();
      if (!cancelled) setWorldPlayersTick(tick => tick + 1);
    };

    void syncWorldPlayers();
    const interval = window.setInterval(() => {
      void syncWorldPlayers();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.username]);

  // Update current user periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setWorldNow(Date.now());
      updateJobTravelProgress(); // Update player position during job travel
      checkJobsComplete(); // Check and complete any finished jobs
      checkTravelComplete(); // Check and complete travel
      levelUp(); // Check if player should level up

      const canAutoClaimRewards = !activeBattleEnemyRef.current
        && !selectedDungeonRunRef.current
        && !document.body.classList.contains('daily-run-open');

      if (canAutoClaimRewards) {
        const result = claimReadyQuestRewards({ includeDaily: true });
        if (result.claimed.length > 0) {
          setSelectedEnemy(null);
          setSelectedPOI(null);
          setSelectedTown(null);
          setSelectedDungeon(null);
          setSelectedQuestNpc(null);
          setShowPlayerList(false);
          setPendingTravel(null);
          window.dispatchEvent(new Event('wizardy:force-main-screen'));

          result.claimed.forEach(claim => {
            emitCompletionNotice({
              id: claim.id,
              kind: 'quest',
              kicker: claim.kicker,
              title: claim.title,
              description: claim.description || 'Reward claimed automatically.',
              rewards: rewardSummaryToCompletionRewards(claim.rewards),
              completedAt: Date.now(),
            });
          });
          levelUp();
        }
      }

      setCurrentUser(getCurrentUser());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const latestUser = getCurrentUser();
      if (!latestUser) return;
      const activeJob = latestUser.jobQueue?.[0];
      const activeJobTraveling = Boolean(
        activeJob &&
        Date.now() >= activeJob.startTime &&
        !activeJob.travelComplete
      );
      if (!latestUser.traveling && !activeJobTraveling) return;

      setWorldNow(Date.now());
      if (activeJobTraveling) updateJobTravelProgress();
      checkTravelComplete();
      setCurrentUser(getCurrentUser());
    }, DIRECT_TRAVEL_RENDER_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!assetsLoaded) return;

    let frameId = 0;
    let lastTick = 0;
    const loop = (timestamp: number) => {
      if (timestamp - lastTick >= 33) {
        lastTick = timestamp;
        setMapAnimNow(Date.now());
      }
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [assetsLoaded]);

  // Handle window resize for fullscreen
  useEffect(() => {
    const handleResize = () => {
      const viewport = window.visualViewport;
      setDimensions({
        width: Math.ceil(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 800),
        height: Math.ceil(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 600),
      });
      setDimensionsReady(true);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  const actualWidth = viewportWidth || dimensions.width;
  const actualHeight = viewportHeight || dimensions.height;
  const viewportReady = Boolean(viewportWidth && viewportHeight) || dimensionsReady;
  const worldEnemies = useMemo(() => getNpcEnemiesForUser(currentUser, worldNow), [currentUser, worldNow]);
  const worldDungeons = useMemo(
    () => getActiveDungeons(worldNow, currentUser?.stats.level || 1),
    [currentUser?.stats.level, worldNow]
  );
  const visibleQuestNpcs = useMemo(
    () => QUEST_NPCS.filter(npc => shouldShowQuestNpcMarker(currentUser, npc)),
    [currentUser]
  );
  const otherPlayers = useMemo(() => {
    if (!currentUser) return [];

    if (isSupabaseConfigured()) {
      return getCachedWorldPlayers()
        .filter(player => player.username.toLowerCase() !== currentUser.username.toLowerCase())
        .map(worldMapPlayerToUser);
    }

    return getUsers().filter(player => player.username !== currentUser.username);
  }, [currentUser, worldPlayersTick]);
  const renderedUserPosition = useMemo(
    () => getRenderedUserPosition(currentUser, worldNow),
    [currentUser, worldNow]
  );

  const worldPanelOpen = Boolean(
    selectedPOI ||
    selectedTown ||
    selectedEnemy ||
    activeBattleEnemy ||
    selectedDungeon ||
    selectedDungeonRun ||
    selectedQuestNpc ||
    pendingTravel
  );
  const priorityStoryReady = Boolean(selectedTown && currentUser && STORY_CHAPTERS
    .flatMap(chapter => chapter.quests)
    .some(story => {
      const status = getStoryQuestStatus(currentUser, story.id);
      return status.unlocked && status.complete && !status.claimed;
    }));

  useEffect(() => {
    if (selectedTown) emitFxEvent({ type: 'city', tone: 'gold', intensity: 0.72 });
  }, [selectedTown]);

  useEffect(() => {
    if (selectedDungeon || selectedDungeonRun) emitFxEvent({ type: 'dungeon', tone: 'violet', intensity: 0.72 });
  }, [selectedDungeon, selectedDungeonRun]);

  useEffect(() => {
    if (activeBattleEnemy) emitFxEvent({ type: 'attack', tone: 'red', intensity: 0.65 });
  }, [activeBattleEnemy]);

  useEffect(() => {
    document.body.classList.toggle('world-panel-open', worldPanelOpen);
    return () => document.body.classList.remove('world-panel-open');
  }, [worldPanelOpen]);

  useEffect(() => {
    document.body.classList.toggle('battle-open', Boolean(activeBattleEnemy));
    return () => document.body.classList.remove('battle-open');
  }, [activeBattleEnemy]);

  useEffect(() => {
    const signature = worldEnemies.map(enemy => enemy.id).join('|');
    if (!signature) return;
    if (!worldEnemySignatureRef.current) {
      worldEnemySignatureRef.current = signature;
      return;
    }
    if (worldEnemySignatureRef.current !== signature) {
      worldEnemySignatureRef.current = signature;
      emitFxEvent({ type: 'spawn', tone: 'red', intensity: 0.75 });
    }
  }, [worldEnemies]);

  const minMapZoom = getMinMapZoom(actualWidth, actualHeight);
  const effectiveZoom = Math.max(minMapZoom, Math.min(MAX_MAP_ZOOM, zoom));
  const scaledTileSize = MAP_CONFIG.tileSize * effectiveZoom;
  const maxCameraX = Math.max(0, MAP_CONFIG.width * scaledTileSize - actualWidth);
  const maxCameraY = Math.max(0, MAP_CONFIG.height * scaledTileSize - actualHeight);

  useEffect(() => {
    const playerPoint = renderedUserPosition
      ? {
          x: renderedUserPosition.x * scaledTileSize - cameraX + scaledTileSize / 2,
          y: renderedUserPosition.y * scaledTileSize - cameraY + scaledTileSize / 2,
        }
      : null;

    const campfires = poisData
      .filter(poi => poi.type === POIType.CAMPFIRE)
      .map(poi => {
        const footprint = getPoiFootprint(poi);
        return {
          x: poi.x * scaledTileSize - cameraX + (footprint.width * scaledTileSize) / 2,
          y: poi.y * scaledTileSize - cameraY + (footprint.height * scaledTileSize) / 2,
        };
      });

    emitMapFogState({
      pointer: cursorScreen,
      player: playerPoint,
      campfires,
      width: actualWidth,
      height: actualHeight,
      zoom: effectiveZoom,
    });
  }, [actualHeight, actualWidth, cameraX, cameraY, cursorScreen, effectiveZoom, poisData, renderedUserPosition, scaledTileSize]);

  const clampZoom = (value: number) => Math.max(minMapZoom, Math.min(MAX_MAP_ZOOM, Number(value.toFixed(2))));

  const zoomAroundBasePoint = (
    nextZoomValue: number,
    anchorBaseX: number,
    anchorBaseY: number,
    anchorScreenX: number,
    anchorScreenY: number
  ) => {
    const nextZoom = clampZoom(nextZoomValue);
    if (nextZoom === effectiveZoom) return;

    const nextMaxCameraX = Math.max(0, MAP_CONFIG.width * MAP_CONFIG.tileSize * nextZoom - actualWidth);
    const nextMaxCameraY = Math.max(0, MAP_CONFIG.height * MAP_CONFIG.tileSize * nextZoom - actualHeight);

    setZoom(nextZoom);
    setCameraX(Math.max(0, Math.min(nextMaxCameraX, anchorBaseX * nextZoom - anchorScreenX)));
    setCameraY(Math.max(0, Math.min(nextMaxCameraY, anchorBaseY * nextZoom - anchorScreenY)));
  };

  const isCurrentUserAt = (targetX: number, targetY: number, width = 1, height = 1) => (
    Boolean(currentUser && isTileInsideFootprint(currentUser.x, currentUser.y, targetX, targetY, width, height))
  );

  const requestTravelIntent = (targetX: number, targetY: number, label: string, kind: TravelIntentKind) => {
    if (!currentUser || currentUser.traveling) return;
    if (targetX < 0 || targetX >= MAP_CONFIG.width || targetY < 0 || targetY >= MAP_CONFIG.height) return;
    if (currentUser.x === targetX && currentUser.y === targetY) return;

    setPendingTravel({ targetX, targetY, label, kind });
  };

  const beginTravel = (targetX: number, targetY: number) => {
    if (!currentUser || currentUser.traveling) return;
    if (targetX < 0 || targetX >= MAP_CONFIG.width || targetY < 0 || targetY >= MAP_CONFIG.height) return;
    if (currentUser.x === targetX && currentUser.y === targetY) return;

    emitFxEvent({ type: 'travel', tone: 'blue', intensity: 0.52 });
    startTravel(targetX, targetY);
    setPendingTravel(null);
    setCurrentUser(getCurrentUser());
  };

  const setMainQuestTrackerVisibility = (hidden: boolean) => {
    setMainQuestTrackerHidden(hidden);
    window.localStorage.setItem(MAIN_QUEST_TRACKER_HIDDEN_KEY, String(hidden));
  };

  // Center camera on player initially only once
  useEffect(() => {
    if (currentUser && viewportReady && actualWidth > 0 && actualHeight > 0 && !cameraInitialized.current) {
      const targetX = Math.max(0, Math.min(
        maxCameraX,
        currentUser.x * scaledTileSize - actualWidth / 2 + scaledTileSize / 2
      ));
      const targetY = Math.max(0, Math.min(
        maxCameraY,
        currentUser.y * scaledTileSize - actualHeight / 2 + scaledTileSize / 2
      ));
      cameraInitialized.current = true;
      const frameId = window.requestAnimationFrame(() => {
        setCameraX(targetX);
        setCameraY(targetY);
      });
      return () => window.cancelAnimationFrame(frameId);
    }
  }, [currentUser, viewportReady, actualWidth, actualHeight, maxCameraX, maxCameraY, scaledTileSize]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setCameraX(current => Math.max(0, Math.min(maxCameraX, current)));
      setCameraY(current => Math.max(0, Math.min(maxCameraY, current)));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [maxCameraX, maxCameraY]);

  // Render the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !assetsLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, actualWidth, actualHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const tileSize = scaledTileSize;
    const mapWidth = MAP_CONFIG.width * tileSize;
    const mapHeight = MAP_CONFIG.height * tileSize;
    const playerRevealPoint = renderedUserPosition
      ? {
          x: renderedUserPosition.x * tileSize - cameraX + tileSize / 2,
          y: renderedUserPosition.y * tileSize - cameraY + tileSize / 2,
        }
      : null;

    const worldMap = AssetLoader.getImage(ASSET_PATHS.map.world);
    if (worldMap) {
      ctx.drawImage(worldMap, -cameraX, -cameraY, mapWidth, mapHeight);
    } else {
      ctx.fillStyle = '#182216';
      ctx.fillRect(-cameraX, -cameraY, mapWidth, mapHeight);
    }

    const activeTravel = currentUser?.traveling;
    const activeJob = currentUser?.jobQueue?.[0];
    const activeJobTraveling = Boolean(
      activeJob &&
      worldNow >= activeJob.startTime &&
      !activeJob.travelComplete
    );
    const travelPathTarget = pendingTravel
      ? { x: pendingTravel.targetX, y: pendingTravel.targetY, active: false }
      : activeTravel
        ? { x: activeTravel.targetX, y: activeTravel.targetY, active: true }
        : activeJob && activeJobTraveling
          ? { x: activeJob.targetX, y: activeJob.targetY, active: true }
        : null;

    if (renderedUserPosition && travelPathTarget) {
      drawTravelPathPreview(ctx, {
        start: renderedUserPosition,
        target: travelPathTarget,
        tileSize,
        cameraX,
        cameraY,
        active: travelPathTarget.active,
        now: worldNow,
      });
    }

    const drawPoiMarker = (poi: POI) => {
      const screenX = poi.x * tileSize - cameraX;
      const screenY = poi.y * tileSize - cameraY;
      const footprint = getPoiFootprint(poi);
      const footprintWidth = footprint.width * tileSize;
      const footprintHeight = footprint.height * tileSize;
      const poiSize = poi.type === POIType.TOWN ? footprintWidth :
                      poi.type === POIType.CAMPFIRE ? tileSize * CAMPFIRE_MARKER_TILES : footprintWidth;
      const boundsSize = poi.type === POIType.CAMPFIRE ? footprintWidth : poiSize;

      if (screenX < -boundsSize || screenX >= actualWidth || screenY < -boundsSize || screenY >= actualHeight) {
        return;
      }

      let imagePath = POI_IMAGE_PATHS[poi.type];

      if (poi.type === POIType.TOWN) {
        imagePath = ["Harborview", "Blackwater Gate", "Eclipse Hold"].includes(poi.name)
          ? ASSET_PATHS.pois.harborview
          : ASSET_PATHS.pois.riverside;
      }

      const poiImage = AssetLoader.getImage(imagePath);
      const markerCenterX = screenX + footprintWidth / 2;
      const markerCenterY = screenY + footprintHeight / 2;
      const hovered = hoveredPOI?.id === poi.id;

      if (poi.type === POIType.TOWN) {
        drawTownMarker(ctx, {
          centerX: markerCenterX,
          centerY: markerCenterY,
          footprint: poiSize,
          image: poiImage,
          hovered,
          fallbackLabel: poi.name.slice(0, 2).toUpperCase(),
          label: poi.name,
        });
        if (isPoiQuestObjective(currentUser, poi.name)) {
          drawMapLabel(ctx, '!', markerCenterX, screenY - 6, '#fef08a');
        }
        return;
      }

      if (poi.type === POIType.CAMPFIRE) {
        drawCampfireMarker(ctx, {
          centerX: markerCenterX,
          centerY: markerCenterY,
          footprint: poiSize,
          image: poiImage,
          hovered,
          label: poi.name,
          now: mapAnimNow,
        });
        if (isPoiQuestObjective(currentUser, poi.name)) {
          drawMapLabel(ctx, '!', markerCenterX, screenY - 6, '#fef08a');
        }
        return;
      }

      drawJobPoiMarker(ctx, {
        centerX: markerCenterX,
        centerY: markerCenterY,
        footprint: poiSize,
        poiType: poi.type,
        image: poiImage,
        hovered,
        fallbackLabel: poi.name.slice(0, 2).toUpperCase(),
        label: poi.name,
        now: worldNow,
      });
      if (isPoiQuestObjective(currentUser, poi.name)) {
        drawMapLabel(ctx, '!', markerCenterX, screenY - 6, '#fef08a');
      }
    };

    poisData
      .filter(poi => poi.type === POIType.TOWN || poi.type === POIType.CAMPFIRE)
      .forEach(drawPoiMarker);

    worldDungeons.forEach(dungeon => {
      const dungeonSize = tileSize * 1.45;
      const dungeonScreenX = dungeon.x * tileSize - cameraX + (tileSize * 3 - dungeonSize) / 2;
      const dungeonScreenY = dungeon.y * tileSize - cameraY + (tileSize * 3 - dungeonSize) / 2;
      const dungeonImage = AssetLoader.getImage(ASSET_PATHS.icons.xp);

      if (
        dungeonScreenX >= -dungeonSize &&
        dungeonScreenX < actualWidth &&
        dungeonScreenY >= -dungeonSize &&
        dungeonScreenY < actualHeight
      ) {
        ctx.save();
        ctx.shadowColor = hoveredDungeon?.id === dungeon.id ? 'rgba(216, 180, 254, 0.95)' : 'rgba(168, 85, 247, 0.65)';
        ctx.shadowBlur = hoveredDungeon?.id === dungeon.id ? 16 : 9;

        if (dungeonImage) {
          ctx.filter = 'hue-rotate(70deg) saturate(1.5) brightness(1.1)';
          ctx.drawImage(dungeonImage, dungeonScreenX, dungeonScreenY, dungeonSize, dungeonSize);
          ctx.filter = 'none';
        } else {
          const centerX = dungeonScreenX + dungeonSize / 2;
          const centerY = dungeonScreenY + dungeonSize / 2;
          ctx.fillStyle = '#6d28d9';
          ctx.beginPath();
          ctx.moveTo(centerX, centerY - dungeonSize * 0.32);
          ctx.lineTo(centerX + dungeonSize * 0.28, centerY);
          ctx.lineTo(centerX, centerY + dungeonSize * 0.32);
          ctx.lineTo(centerX - dungeonSize * 0.28, centerY);
          ctx.closePath();
          ctx.fill();
        }

        ctx.shadowBlur = 0;
        const labelPoint = { x: dungeonScreenX + dungeonSize / 2, y: dungeonScreenY + dungeonSize / 2 };
        if (hoveredDungeon?.id === dungeon.id || isScreenPointRevealed(labelPoint, cursorScreen, playerRevealPoint, effectiveZoom)) {
          ctx.fillStyle = '#f5d0fe';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`Lv ${dungeon.level}`, dungeonScreenX + dungeonSize / 2, dungeonScreenY - 5);
        }
        if (isDungeonQuestObjective(currentUser)) {
          drawMapLabel(ctx, '!', dungeonScreenX + dungeonSize / 2, dungeonScreenY - 16, '#fef08a');
        }
        ctx.restore();
      }
    });

    poisData
      .filter(poi => poi.type !== POIType.TOWN && poi.type !== POIType.CAMPFIRE)
      .forEach(drawPoiMarker);

    visibleQuestNpcs.forEach(npc => {
      const npcScreenX = npc.x * tileSize - cameraX;
      const npcScreenY = npc.y * tileSize - cameraY;
      const npcSize = getCharacterSpriteSize(tileSize, effectiveZoom, 0.9, 26);
      const npcImage = AssetLoader.getImage(getPlayerModelPath(npc.modelNumber));
      const hasQuestMarker = shouldShowQuestNpcMarker(currentUser, npc);

      if (
        npcScreenX >= -npcSize &&
        npcScreenX < actualWidth &&
        npcScreenY >= -npcSize &&
        npcScreenY < actualHeight
      ) {
        drawCharacterSprite(ctx, {
          image: npcImage,
          x: npcScreenX + (tileSize - npcSize) / 2,
          y: npcScreenY + (tileSize - npcSize) / 2 - tileSize * 0.08,
          size: npcSize,
          fallbackColor: '#854d0e',
          label: npc.name,
          labelColor: '#fef08a',
          topText: hasQuestMarker ? '!' : undefined,
          topTextColor: '#fef08a',
          hovered: hoveredQuestNpc?.id === npc.id,
        });
      }
    });

    // Draw current player with model image
    if (currentUser && renderedUserPosition) {
      const playerScreenX = renderedUserPosition.x * tileSize - cameraX;
      const playerScreenY = renderedUserPosition.y * tileSize - cameraY;
      
      // Only draw if in viewport
      if (playerScreenX >= -tileSize && playerScreenX < actualWidth && 
          playerScreenY >= -tileSize && playerScreenY < actualHeight) {
        
        // Draw player model image scaled to read clearly without overwhelming the map.
        const selectedModelNumber = currentUser?.selectedModel || 3;
        const modelPath = getPlayerModelPath(selectedModelNumber);
        const playerImg = AssetLoader.getImage(modelPath as string);
        const playerSize = getCharacterSpriteSize(tileSize, effectiveZoom, 0.98, 28);
        const offsetX = (tileSize - playerSize) / 2;
        const offsetY = (tileSize - playerSize) / 2;

        drawCharacterSprite(ctx, {
          image: playerImg,
          x: playerScreenX + offsetX,
          y: playerScreenY + offsetY,
          size: playerSize,
          fallbackColor: '#ffd700',
          label: currentUser.username,
          labelColor: '#ffffff',
        });
      }
    }

    otherPlayers.forEach((player, index) => {
      const sameTileAsCurrentUser = currentUser && player.x === currentUser.x && player.y === currentUser.y;
      const playerScreenX = player.x * tileSize - cameraX + (sameTileAsCurrentUser ? tileSize * 0.22 : 0);
      const playerScreenY = player.y * tileSize - cameraY + (sameTileAsCurrentUser ? tileSize * 0.1 : 0);
      const playerSize = getCharacterSpriteSize(tileSize, effectiveZoom, 0.88, 25);
      const playerImage = AssetLoader.getImage(getPlayerModelPath(player.selectedModel || ((index % 6) + 1)));
      const partyMember = isSocialPartyMember(currentUser, player.username);
      const friend = areSocialFriends(currentUser, player.username);

      if (
        playerScreenX >= -playerSize &&
        playerScreenX < actualWidth &&
        playerScreenY >= -playerSize &&
        playerScreenY < actualHeight
      ) {
        drawCharacterSprite(ctx, {
          image: playerImage,
          x: playerScreenX + (tileSize - playerSize) / 2,
          y: playerScreenY + (tileSize - playerSize) / 2 - tileSize * 0.08,
          size: playerSize,
          fallbackColor: '#0e7490',
          label: player.username,
          labelColor: partyMember ? '#a7f3d0' : friend ? '#bfdbfe' : '#ffffff',
        });
      }
    });

    worldEnemies.forEach(enemy => {
      const enemyScreenX = enemy.x * tileSize - cameraX;
      const enemyScreenY = enemy.y * tileSize - cameraY;
      const isWorldBoss = enemy.spawnKind === 'world-boss';
      const enemySize = getCharacterSpriteSize(tileSize, effectiveZoom, isWorldBoss ? 1.22 : 0.88, isWorldBoss ? 36 : 25);
      const enemyImage = AssetLoader.getImage(enemy.artworkPath || getPlayerModelAsset(enemy.modelNumber));
      const enemyRevealed = isEnemyRevealedOnScreen(
        enemy,
        cameraX,
        cameraY,
        tileSize,
        cursorScreen,
        playerRevealPoint,
        effectiveZoom
      );

      if (
        enemyRevealed &&
        enemyScreenX >= -enemySize &&
        enemyScreenX < actualWidth &&
        enemyScreenY >= -enemySize &&
        enemyScreenY < actualHeight
      ) {
        drawCharacterSprite(ctx, {
          image: enemyImage,
          x: enemyScreenX + (tileSize - enemySize) / 2,
          y: enemyScreenY + (tileSize - enemySize) / 2 - tileSize * 0.08,
          size: enemySize,
          fallbackColor: '#7f1d1d',
          topText: isWorldBoss ? 'Boss' : `Lv ${enemy.level}`,
          topTextColor: isWorldBoss ? '#fca5a5' : '#fecaca',
          label: isWorldBoss || hoveredEnemy?.id === enemy.id ? enemy.name : undefined,
          labelColor: '#fecaca',
          hovered: hoveredEnemy?.id === enemy.id,
        });
      }
    });

    ctx.shadowBlur = 0;
  }, [cameraX, cameraY, actualWidth, actualHeight, hoveredPOI, hoveredEnemy, hoveredDungeon, hoveredQuestNpc, cursorScreen, currentUser, renderedUserPosition, pendingTravel, otherPlayers, assetsLoaded, worldEnemies, worldDungeons, visibleQuestNpcs, poisData, scaledTileSize, effectiveZoom, worldNow, mapAnimNow]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX + cameraX, y: e.clientY + cameraY });
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    setCursorScreen({ x: screenX, y: screenY });
    const mouseX = screenX + cameraX;
    const mouseY = screenY + cameraY;
    const tileSize = scaledTileSize;
    const tileX = Math.floor(mouseX / tileSize);
    const tileY = Math.floor(mouseY / tileSize);
    const playerRevealPoint = renderedUserPosition
      ? {
          x: renderedUserPosition.x * tileSize - cameraX + tileSize / 2,
          y: renderedUserPosition.y * tileSize - cameraY + tileSize / 2,
        }
      : null;
    const revealedEnemies = worldEnemies.filter(enemy => isEnemyRevealedOnScreen(
      enemy,
      cameraX,
      cameraY,
      tileSize,
      { x: screenX, y: screenY },
      playerRevealPoint,
      effectiveZoom
    ));

    const hoveredEnemy = findEnemyAtScreenPoint(revealedEnemies, screenX, screenY, cameraX, cameraY, tileSize, effectiveZoom)
      || revealedEnemies.find(enemy => tileX === enemy.x && tileY === enemy.y);
    const hoveredDungeon = worldDungeons.find(dungeon => (
      tileX >= dungeon.x &&
      tileX < dungeon.x + 3 &&
      tileY >= dungeon.y &&
      tileY < dungeon.y + 3
    ));
    const hoveredQuestNpc = visibleQuestNpcs.find(npc => (
      tileX >= npc.x &&
      tileX < npc.x + 2 &&
      tileY >= npc.y &&
      tileY < npc.y + 2
    ));

    if (hoveredEnemy) {
      setHoveredEnemy(hoveredEnemy);
      setHoveredDungeon(null);
      setHoveredQuestNpc(null);
      setHoveredPOI(null);
      canvas.style.cursor = currentUser?.x === hoveredEnemy.x && currentUser?.y === hoveredEnemy.y ? 'crosshair' : 'pointer';
    } else if (hoveredDungeon) {
      setHoveredEnemy(null);
      setHoveredDungeon(hoveredDungeon);
      setHoveredQuestNpc(null);
      setHoveredPOI(null);
      canvas.style.cursor = 'pointer';
    } else if (hoveredQuestNpc) {
      setHoveredEnemy(null);
      setHoveredDungeon(null);
      setHoveredQuestNpc(hoveredQuestNpc);
      setHoveredPOI(null);
      canvas.style.cursor = 'pointer';
    } else {
      setHoveredEnemy(null);
      setHoveredDungeon(null);
      setHoveredQuestNpc(null);
    }

    // Check if hovering over a POI (2x2 for campfire, 4x4 tiles or 8x8 for towns)
    const hoveredPOI = poisData.find(
      poi => {
        const { width, height } = getPoiFootprint(poi);
        return isTileInsideFootprint(tileX, tileY, poi.x, poi.y, width, height);
      }
    );
    if (!hoveredEnemy && !hoveredDungeon && !hoveredQuestNpc) setHoveredPOI(hoveredPOI || null);

    // Update cursor
    if (!hoveredEnemy && !hoveredDungeon && !hoveredQuestNpc) {
      canvas.style.cursor = hoveredPOI ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
    }

    if (!isDragging) return;

    const dragDistance = Math.abs(e.clientX - dragOriginRef.current.x) + Math.abs(e.clientY - dragOriginRef.current.y);
    if (dragDistance > 4) {
      hasDraggedRef.current = true;
    }
    
    const newCameraX = Math.max(0, Math.min(
      maxCameraX,
      dragStart.x - e.clientX
    ));
    const newCameraY = Math.max(0, Math.min(
      maxCameraY,
      dragStart.y - e.clientY
    ));
    
    setCameraX(newCameraX);
    setCameraY(newCameraY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoveredPOI(null);
    setHoveredEnemy(null);
    setHoveredDungeon(null);
    setHoveredQuestNpc(null);
    setCursorScreen(null);
    hasDraggedRef.current = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left + cameraX;
    const mouseY = e.clientY - rect.top + cameraY;
    const tileSize = scaledTileSize;
    const tileX = Math.floor(mouseX / tileSize);
    const tileY = Math.floor(mouseY / tileSize);

    const closeWorldPanels = () => {
      setSelectedEnemy(null);
      setActiveBattleEnemy(null);
      setSelectedPOI(null);
      setSelectedTown(null);
      setSelectedDungeon(null);
      setSelectedDungeonRun(null);
      setSelectedQuestNpc(null);
      setShowPlayerList(false);
      setPendingTravel(null);
    };

    const clickScreenX = e.clientX - rect.left;
    const clickScreenY = e.clientY - rect.top;
    const playerRevealPoint = renderedUserPosition
      ? {
          x: renderedUserPosition.x * tileSize - cameraX + tileSize / 2,
          y: renderedUserPosition.y * tileSize - cameraY + tileSize / 2,
        }
      : null;
    const revealedEnemies = worldEnemies.filter(enemy => isEnemyRevealedOnScreen(
      enemy,
      cameraX,
      cameraY,
      tileSize,
      { x: clickScreenX, y: clickScreenY },
      playerRevealPoint,
      effectiveZoom
    ));
    const clickedEnemy = findEnemyAtScreenPoint(revealedEnemies, clickScreenX, clickScreenY, cameraX, cameraY, tileSize, effectiveZoom)
      || revealedEnemies.find(enemy => tileX === enemy.x && tileY === enemy.y);
    if (clickedEnemy) {
      setSelectedEnemy(clickedEnemy);
      setPendingTravel(null);
      setSelectedPOI(null);
      setSelectedTown(null);
      setSelectedDungeon(null);
      setSelectedQuestNpc(null);
      setShowPlayerList(false);
      return;
    }

    const clickedPlayer = otherPlayers.find(player => tileX === player.x && tileY === player.y);
    if (clickedPlayer) {
      if (!isCurrentUserAt(clickedPlayer.x, clickedPlayer.y)) {
        closeWorldPanels();
        requestTravelIntent(clickedPlayer.x, clickedPlayer.y, clickedPlayer.username, 'player');
        return;
      }

      setPlayerListLocation({ x: clickedPlayer.x, y: clickedPlayer.y });
      setShowPlayerList(true);
      setSelectedPOI(null);
      setSelectedTown(null);
      setSelectedDungeon(null);
      setSelectedQuestNpc(null);
      return;
    }

    const clickedDungeon = worldDungeons.find(dungeon => (
      tileX >= dungeon.x &&
      tileX < dungeon.x + 3 &&
      tileY >= dungeon.y &&
      tileY < dungeon.y + 3
    ));
    if (clickedDungeon) {
      setSelectedDungeon(clickedDungeon);
      setPendingTravel(null);
      setSelectedPOI(null);
      setSelectedTown(null);
      setSelectedQuestNpc(null);
      setShowPlayerList(false);
      return;
    }

    const clickedQuestNpc = visibleQuestNpcs.find(npc => (
      tileX >= npc.x &&
      tileX < npc.x + 2 &&
      tileY >= npc.y &&
      tileY < npc.y + 2
    ));
    if (clickedQuestNpc) {
      setSelectedQuestNpc(clickedQuestNpc);
      setPendingTravel(null);
      setSelectedDungeon(null);
      setSelectedPOI(null);
      setSelectedTown(null);
      setShowPlayerList(false);
      return;
    }

    // Check if clicking on a POI (2x2 for campfire, 4x4 tiles or 8x8 for towns)
    const clickedPOI = poisData.find(
      poi => {
        const { width, height } = getPoiFootprint(poi);
        return isTileInsideFootprint(tileX, tileY, poi.x, poi.y, width, height);
      }
    );

    if (clickedPOI) {
      const { width, height } = getPoiFootprint(clickedPOI);
      const isAtClickedPoi = isCurrentUserAt(clickedPOI.x, clickedPOI.y, width, height);
      setPendingTravel(null);

      // Open town modal for towns, POI modal for others
      if (clickedPOI.type === POIType.TOWN) {
        setSelectedTown(clickedPOI);
        setSelectedDungeon(null);
        setSelectedQuestNpc(null);
        setPlayerListLocation({ x: clickedPOI.x, y: clickedPOI.y });
        setShowPlayerList(isAtClickedPoi);
      } else {
        setSelectedPOI(clickedPOI);
        setSelectedDungeon(null);
        setSelectedQuestNpc(null);
        setPlayerListLocation({ x: clickedPOI.x, y: clickedPOI.y });
        setShowPlayerList(isAtClickedPoi);
      }
    } else {
      // If shift key is held, initiate travel to that location
      if (e.shiftKey && currentUser && !currentUser.traveling) {
        // Make sure the tile is valid (within bounds)
        if (tileX >= 0 && tileX < MAP_CONFIG.width && tileY >= 0 && tileY < MAP_CONFIG.height) {
          requestTravelIntent(tileX, tileY, `Tile ${tileX}:${tileY}`, 'tile');
        }
      }
    }
  };

  const handleJobSelect = () => {
    setSelectedPOI(null);
    setShowPlayerList(false);
    setCurrentUser(getCurrentUser());
  };

  const handleWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const anchorScreenX = event.clientX - rect.left;
    const anchorScreenY = event.clientY - rect.top;
    const anchorBaseX = (cameraX + anchorScreenX) / effectiveZoom;
    const anchorBaseY = (cameraY + anchorScreenY) / effectiveZoom;
    const zoomDirection = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;

    zoomAroundBasePoint(effectiveZoom + zoomDirection, anchorBaseX, anchorBaseY, anchorScreenX, anchorScreenY);
  };

  const pendingTravelDuration = currentUser && pendingTravel
    ? getDirectTravelDurationMs(currentUser, pendingTravel.targetX, pendingTravel.targetY)
    : 0;

  const confirmPendingTravel = () => {
    if (!currentUser || !pendingTravel || currentUser.traveling) return;
    const completesHarborviewTravel = pendingTravel.kind === 'town' && pendingTravel.label === 'Harborview';
    beginTravel(pendingTravel.targetX, pendingTravel.targetY);
    if (completesHarborviewTravel) {
      completeMultiplayerTutorialCallout(currentUser.username, 'harborview-travel');
    }
  };

  const claimMainStoryReward = (questId: string): { success: boolean; error?: string } => {
    const story = STORY_CHAPTERS.flatMap(chapter => chapter.quests).find(item => item.id === questId);
    const result = claimStoryQuestReward(questId);

    if (!result.success) {
      return { success: false, error: result.error || 'Could not claim story reward.' };
    }

    emitCompletionNotice({
      id: `main-tracker-story-${questId}-${Date.now()}`,
      kind: 'quest',
      kicker: 'Story Quest',
      title: story?.name || 'Story Reward Claimed',
      description: story?.lore || 'The story reward was claimed.',
      rewards: rewardSummaryToCompletionRewards(result.rewards),
      completedAt: Date.now(),
    });
    levelUp();
    setCurrentUser(getCurrentUser());
    return { success: true };
  };

  const mainQuestUi = (!worldPanelOpen || priorityStoryReady) && !activeBattleEnemy
    ? (
      mainQuestTrackerHidden ? (
        <button
          type="button"
          onClick={() => setMainQuestTrackerVisibility(false)}
          className="main-quest-reopen command-panel vine-frame pointer-events-auto fixed left-4 top-24 z-40 rounded-full border text-zinc-100"
          aria-label="Show main quest tracker"
          title="Show main quest tracker"
        >
          !
        </button>
      ) : (
        <MainQuestTracker
          currentUser={currentUser}
          poisData={poisData}
          onTravel={requestTravelIntent}
          onClaim={claimMainStoryReward}
          onHide={() => setMainQuestTrackerVisibility(true)}
        />
      )
    )
    : null;

  return (
    <>
    <div ref={containerRef} className="game-map-shell">
      <canvas
        ref={canvasRef}
        width={actualWidth}
        height={actualHeight}
        className="game-map-canvas cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onClick={handleClick}
      />

      <TravelConfirmModal
        pendingTravel={pendingTravel}
        durationMs={pendingTravelDuration}
        activeJobCount={currentUser?.jobQueue.length || 0}
        onConfirm={confirmPendingTravel}
        onCancel={() => {
          emitFxEvent({ type: 'travel', tone: 'bone', intensity: 0.34 });
          setPendingTravel(null);
        }}
      />

      <POIModal 
        poi={selectedPOI}
        onClose={() => {
          setSelectedPOI(null);
          setShowPlayerList(false);
        }}
        onSelectJob={handleJobSelect}
        onTravel={() => {
          if (!selectedPOI) return;
          const target = getPoiTravelTarget(selectedPOI);
          requestTravelIntent(target.x, target.y, selectedPOI.name, 'poi');
          setSelectedPOI(null);
          setShowPlayerList(false);
        }}
      />

      <TownModal 
        town={selectedTown}
        onClose={() => {
          setSelectedTown(null);
          setShowPlayerList(false);
        }}
        onTravel={() => {
          if (!selectedTown) return;
          const target = getPoiTravelTarget(selectedTown);
          requestTravelIntent(target.x, target.y, selectedTown.name, 'town');
          setSelectedTown(null);
          setShowPlayerList(false);
        }}
      />

      <PlayerListModal
        isOpen={showPlayerList && !selectedPOI && !selectedTown && !selectedEnemy && !activeBattleEnemy && !selectedDungeon && !selectedDungeonRun && !selectedQuestNpc}
        location={playerListLocation}
        players={otherPlayers}
        onClose={() => setShowPlayerList(false)}
      />

      {selectedEnemy && (
        <EnemyScoutModal
          enemy={selectedEnemy}
          currentUser={currentUser}
          canStart={Boolean(currentUser && currentUser.x === selectedEnemy.x && currentUser.y === selectedEnemy.y)}
          onStart={() => {
            if (!currentUser || currentUser.x !== selectedEnemy.x || currentUser.y !== selectedEnemy.y) return;
            setActiveBattleEnemy(selectedEnemy);
            setSelectedEnemy(null);
          }}
          onTravel={() => {
            requestTravelIntent(selectedEnemy.x, selectedEnemy.y, selectedEnemy.name, 'enemy');
            setSelectedEnemy(null);
          }}
          onClose={() => setSelectedEnemy(null)}
        />
      )}

      {activeBattleEnemy && (
        <EncounterRunModal
          enemy={activeBattleEnemy}
          currentUser={currentUser}
          onClose={() => setActiveBattleEnemy(null)}
        />
      )}

      {selectedDungeon && (
        <DungeonModal
          dungeon={selectedDungeon}
          now={worldNow}
          currentUser={currentUser}
          onEnter={() => {
            setSelectedDungeonRun(selectedDungeon);
            setSelectedDungeon(null);
          }}
          onTravel={() => {
            const target = getFootprintCenterTile(selectedDungeon.x, selectedDungeon.y, 3, 3);
            requestTravelIntent(target.x, target.y, selectedDungeon.name, 'dungeon');
            setSelectedDungeon(null);
          }}
          onClose={() => setSelectedDungeon(null)}
        />
      )}

      {selectedDungeonRun && (
        <DungeonRunModal
          dungeon={selectedDungeonRun}
          currentUser={currentUser}
          now={worldNow}
          onClose={() => setSelectedDungeonRun(null)}
        />
      )}

      {selectedQuestNpc && (
        <QuestNpcModal
          npc={selectedQuestNpc}
          onTravel={() => {
            requestTravelIntent(selectedQuestNpc.x, selectedQuestNpc.y, selectedQuestNpc.name, 'quest');
            setSelectedQuestNpc(null);
          }}
          onClose={() => setSelectedQuestNpc(null)}
        />
      )}
    </div>
    {isMounted && mainQuestUi ? createPortal(mainQuestUi, document.body) : null}
    {storyDialogQuestId && currentUser && (() => {
      const quest = getAllStoryQuestsSorted().find(item => item.id === storyDialogQuestId);
      const sequence = getStoryDialogSequence(quest?.dialogId);
      if (!sequence) return null;
      return (
        <StoryDialogOverlay
          key={sequence.id}
          sequence={sequence}
          playerModelNumber={currentUser.selectedModel || 3}
          initialLineIndex={getMultiplayerTutorialDialogueLine(currentUser.username, sequence.id)}
          onLineChange={(lineIndex) => {
            saveMultiplayerTutorialDialogueLine(currentUser.username, sequence.id, lineIndex);
          }}
          onComplete={() => {
            clearMultiplayerTutorialDialogue(currentUser.username, sequence.id);
            markStoryQuestIntroSeen(storyDialogQuestId);
            setStoryDialogQuestId(null);
            setCurrentUser(getCurrentUser());
          }}
        />
      );
    })()}
    </>
  );
}

function formatQuestNpcRewards(rewards: QuestNpc['rewards']): string {
  const parts = [
    rewards.gold ? `${rewards.gold} gold` : '',
    rewards.exp ? `${rewards.exp} XP` : '',
    rewards.healthRestore ? `${rewards.healthRestore} health` : '',
    rewards.rareGems ? `${rewards.rareGems} gem${rewards.rareGems > 1 ? 's' : ''}` : '',
    rewards.equipmentRarity ? `${rewards.equipmentRarity} gear` : '',
    rewards.minionTier ? `${rewards.minionTier.replace('tier', 'tier ')} unit` : '',
  ].filter(Boolean);

  return parts.join(' / ');
}

function formatQuestRequirementText(requirement: QuestNpc['requirement']): string {
  switch (requirement.type) {
    case 'complete_jobs':
      return `Finish ${requirement.count} road job${requirement.count === 1 ? '' : 's'} from a town board or nearby work site.`;
    case 'complete_timed_jobs':
      return `Finish ${requirement.count} longer job${requirement.count === 1 ? '' : 's'} that lasts at least ${Math.round((requirement.minDuration || 0) / 60000)} minutes.`;
    case 'win_battles':
      return `Defeat ${requirement.count} enemy warband${requirement.count === 1 ? '' : 's'} on the world map.`;
    case 'recruit_minions':
      return `Recruit ${requirement.count} unit${requirement.count === 1 ? '' : 's'} into your army.`;
    case 'own_rare_gems':
      return `Carry ${requirement.count} rare gem${requirement.count === 1 ? '' : 's'} in your inventory.`;
    case 'visit_poi':
      return `Travel to ${requirement.poiName || 'the marked location'}.`;
    case 'collect_item':
      return `Bring ${requirement.count} required quest item${requirement.count === 1 ? '' : 's'}.`;
    case 'player_level':
      return `Reach commander level ${requirement.count}.`;
    case 'defeat_boss':
      return 'Defeat the named boss.';
    default:
      return 'Complete the counsel task.';
  }
}

function rewardSummaryToCompletionRewards(rewards?: RewardSummary): CompletionRewardLine[] {
  if (!rewards) return [];

  const lines: CompletionRewardLine[] = [];
  if (rewards.gold) lines.push({ label: 'Gold', value: `+${rewards.gold}`, tone: 'gold' });
  if (rewards.exp) lines.push({ label: 'XP', value: `+${rewards.exp}`, tone: 'blue' });
  if (rewards.healthRestore) lines.push({ label: 'Health', value: `+${rewards.healthRestore}`, tone: 'green' });
  if (rewards.rareGems) lines.push({ label: 'Gems', value: `+${rewards.rareGems}`, tone: 'violet' });
  rewards.items?.forEach(item => lines.push({ label: 'Item', value: item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name, tone: 'green' }));
  rewards.equipment?.forEach(item => lines.push({ label: 'Equipment', value: item.name, tone: 'green' }));
  rewards.minions?.forEach(minion => lines.push({ label: 'Minion', value: getMinionTemplate(minion.templateId)?.name || 'Minion', tone: 'green' }));
  rewards.spellIds?.forEach(spellId => lines.push({ label: 'Spell', value: BATTLE_SPELLS.find(spell => spell.id === spellId)?.name || 'Spell', tone: 'violet' }));

  return lines;
}

type StoryQuestForTracker = (typeof STORY_CHAPTERS)[number]['quests'][number];

function getStoryRequirementLabel(story: StoryQuestForTracker): string {
  const requirement = story.requirement;

  switch (requirement.type) {
    case 'complete_jobs':
      return `Finish ${requirement.count} road job${requirement.count === 1 ? '' : 's'} from a town board or work site`;
    case 'complete_timed_jobs':
      return `Finish ${requirement.count} longer job${requirement.count === 1 ? '' : 's'} of at least ${Math.round((requirement.minDuration || 0) / 60000)} minutes`;
    case 'player_level':
      return `Reach level ${requirement.count}`;
    case 'own_rare_gems':
      return `Hold ${requirement.count} rare gem${requirement.count === 1 ? '' : 's'}`;
    case 'collect_item':
      return `Recover ${requirement.count} quest relic${requirement.count === 1 ? '' : 's'}`;
    case 'recruit_minions':
      return `Recruit ${requirement.count} unit${requirement.count === 1 ? '' : 's'}`;
    case 'win_battles':
      return `Defeat ${requirement.count} enemy warband${requirement.count === 1 ? '' : 's'} on the world map`;
    case 'visit_poi':
      return `Reach ${requirement.poiName || 'the marked place'}`;
    case 'visit_quest_npc':
      return 'Find the quest contact on the map';
    case 'complete_jobs_at_poi':
      return `Work ${requirement.count} job${requirement.count === 1 ? '' : 's'} at ${requirement.poiName || 'the marked site'}`;
    case 'defeat_enemies_level':
      return `Defeat ${requirement.count} warband${requirement.count === 1 ? '' : 's'} (Lv ${requirement.minEnemyLevel || 1}${requirement.maxEnemyLevel ? `-${requirement.maxEnemyLevel}` : '+'})`;
    case 'clear_dungeons':
      return `Clear ${requirement.count} dungeon${requirement.count === 1 ? '' : 's'}${requirement.minDungeonLevel ? ` (Lv ${requirement.minDungeonLevel}+)` : ''}`;
    case 'defeat_boss':
      return 'Defeat the story boss';
    default:
      return 'Advance the story';
  }
}

function openCommandPanel(panel: 'overview' | 'jobs' | 'quests') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('wizardy:open-command-panel', { detail: { panel } }));
}

function MainQuestTracker({
  currentUser,
  poisData,
  onTravel,
  onClaim,
  onHide,
}: {
  currentUser: ReturnType<typeof getCurrentUser>;
  poisData: POI[];
  onTravel: (targetX: number, targetY: number, label: string, kind: TravelIntentKind) => void;
  onClaim: (questId: string) => { success: boolean; error?: string };
  onHide: () => void;
}) {
  const [claimError, setClaimError] = useState('');
  const storyQuests = STORY_CHAPTERS
    .flatMap(chapter => chapter.quests)
    .sort((left, right) => left.order - right.order);
  const activeStory = storyQuests.find(story => {
    const status = getStoryQuestStatus(currentUser, story.id);
    return status.unlocked && !status.claimed;
  }) || storyQuests.find(story => !getStoryQuestStatus(currentUser, story.id).claimed);

  if (!currentUser || !activeStory) return null;

  const status = getStoryQuestStatus(currentUser, activeStory.id);
  const requirement = activeStory.requirement;
  const targetPoi = requirement.type === 'visit_poi' && requirement.poiName
    ? poisData.find(poi => poi.name.toLowerCase() === requirement.poiName?.toLowerCase())
    : undefined;
  const progress = status.required > 0 ? Math.min(100, (status.progress / status.required) * 100) : 0;
  const actionPanel = requirement.type === 'complete_jobs' || requirement.type === 'complete_timed_jobs' ? 'jobs' : 'quests';
  const actionLabel = !status.unlocked
    ? `Level ${activeStory.requiredLevel}`
    : status.complete
      ? 'Claim'
      : targetPoi
        ? currentUser.traveling ? 'Walking' : 'Travel'
        : actionPanel === 'jobs' ? 'Jobs' : 'Quests';
  const targetKind: TravelIntentKind = targetPoi?.type === POIType.TOWN ? 'town' : 'poi';
  const objectiveLabel = status.complete
    ? 'Story reward ready to claim.'
    : getStoryRequirementLabel(activeStory);

  return (
    <aside className="main-quest-tracker main-quest-guide command-panel vine-frame pointer-events-auto fixed left-4 top-24 z-40 w-[min(24rem,calc(100vw-2rem))] rounded border p-4 text-zinc-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="arcane-label">Main Quest</div>
          <h3 className="fantasy-heading text-lg leading-tight">{activeStory.name}</h3>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <button
            type="button"
            onClick={onHide}
            className="ui-button rounded px-2 py-1 text-[10px] font-black"
            aria-label="Hide main quest tracker"
            title="Hide main quest tracker"
          >
            Hide
          </button>
        </div>
      </div>
      <button
        type="button"
        disabled={!status.unlocked || Boolean(currentUser.traveling && targetPoi)}
        onClick={() => {
          setClaimError('');
          if (!status.unlocked) return;

          if (status.complete) {
            const result = onClaim(activeStory.id);
            if (!result.success) setClaimError(result.error || 'Could not claim reward.');
            return;
          }

          if (targetPoi) {
            const target = getPoiTravelTarget(targetPoi);
            onTravel(target.x, target.y, targetPoi.name, targetKind);
            return;
          }

          openCommandPanel(actionPanel);
        }}
        className="main-quest-action first-step-row mt-3 block w-full rounded px-3 py-2.5 text-left text-xs font-bold disabled:opacity-45"
      >
        <span className="block leading-snug text-zinc-100">{objectiveLabel}</span>
        <span className="ui-accent mt-2 block text-[10px] font-black uppercase tracking-[0.12em]">{actionLabel}</span>
      </button>
      <div className="ui-progress-track mt-3 h-1.5 overflow-hidden rounded border">
        <div className="ui-progress-fill h-full" style={{ width: `${progress}%` }} />
      </div>
      <div className="ui-faint mt-2 flex items-center justify-between text-[10px] font-black uppercase">
        <span>{status.unlocked ? `${status.progress}/${status.required}` : 'Locked'}</span>
        <span>{targetPoi ? targetPoi.name : status.complete ? 'Ready' : actionPanel}</span>
      </div>
      {claimError && <div className="mt-2 text-xs font-black text-red-100">{claimError}</div>}
    </aside>
  );
}

function TravelConfirmModal({
  pendingTravel,
  durationMs,
  activeJobCount,
  onConfirm,
  onCancel,
}: {
  pendingTravel: PendingTravelIntent | null;
  durationMs: number;
  activeJobCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const travelKey = pendingTravel
    ? `${pendingTravel.kind}:${pendingTravel.targetX}:${pendingTravel.targetY}:${pendingTravel.label}:${activeJobCount}`
    : 'none';
  const [confirmCancelState, setConfirmCancelState] = useState({ key: 'none', confirmed: false });
  const confirmCancelJobs = confirmCancelState.key === travelKey && confirmCancelState.confirmed;

  if (!pendingTravel) return null;

  const kindLabel: Record<TravelIntentKind, string> = {
    enemy: 'Enemy',
    player: 'Player',
    poi: 'Point of Interest',
    town: 'Town',
    dungeon: 'Dungeon',
    quest: 'Quest Contact',
    tile: 'Map Tile',
  };

  return (
    <div className="world-popup-layer pointer-events-none fixed inset-x-0 bottom-24 flex justify-center px-4">
      <CinematicScrollShell
        variant="compact"
        className="travel-confirm-card world-popup-panel pointer-events-auto w-full max-w-md text-zinc-100"
        contentClassName="p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="arcane-label">{kindLabel[pendingTravel.kind]}</div>
            <h3 className="fantasy-heading truncate text-xl">Walk to {pendingTravel.label}</h3>
            <p className="ui-muted mt-1 text-xs font-bold">
              Estimated road time: {formatTravelEta(durationMs)}.
            </p>
            {activeJobCount > 0 && (
              <p className="mt-2 rounded border border-amber-200/35 bg-amber-900/35 px-2 py-1 text-[11px] font-black text-amber-100">
                Walking now cancels {activeJobCount} active or queued job{activeJobCount === 1 ? '' : 's'}.
              </p>
            )}
            {activeJobCount > 0 && confirmCancelJobs && (
              <div className="mt-2 rounded border border-red-300/40 bg-red-950/45 px-2 py-2 text-[11px] font-black text-red-100">
                Are you sure? Current job progress will be canceled and cannot be restored.
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                if (confirmCancelJobs) {
                  setConfirmCancelState({ key: travelKey, confirmed: false });
                  return;
                }
                onCancel();
              }}
              className="ui-button rounded px-3 py-2 text-xs font-black"
            >
              {confirmCancelJobs ? 'Back' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeJobCount > 0 && !confirmCancelJobs) {
                  setConfirmCancelState({ key: travelKey, confirmed: true });
                  return;
                }
                onConfirm();
              }}
              data-multiplayer-tutorial-anchor={pendingTravel.kind === 'town' && pendingTravel.label === 'Harborview' ? 'harborview-travel' : undefined}
              className="ui-button-primary rounded px-4 py-2 text-xs font-black"
            >
              {activeJobCount > 0
                ? (confirmCancelJobs ? `Cancel ${activeJobCount} Job${activeJobCount === 1 ? '' : 's'} & Walk` : 'Walk')
                : 'Walk'}
            </button>
          </div>
        </div>
      </CinematicScrollShell>
    </div>
  );
}

function QuestNpcModal({ npc, onTravel, onClose }: { npc: QuestNpc; onTravel: () => void; onClose: () => void }) {
  const [user, setUser] = useState(getCurrentUser());
  const [notice, setNotice] = useState('');
  const counselStatus = getQuestNpcStatus(user, npc.id);
  const claimed = counselStatus.claimed;
  const atNpc = Boolean(user && isTileInsideFootprint(user.x, user.y, npc.x, npc.y, 2, 2));
  const [showConversation, setShowConversation] = useState(atNpc);
  const conversation: StoryDialogSequence = useMemo(() => ({
    id: `quest-npc-conversation-${npc.id}`,
    kicker: `${npc.town} - ${npc.faction}`,
    npcName: npc.name,
    npcTitle: npc.title,
    npcModelNumber: npc.modelNumber,
    objective: {
      label: 'Counsel Task',
      title: formatQuestRequirementText(npc.requirement),
      description: `Return to ${npc.name} after the task is complete to claim ${formatQuestNpcRewards(npc.rewards)}.`,
    },
    lines: [
      { speaker: 'npc', text: npc.line },
      { speaker: 'player', text: 'What do you ask of my banner?' },
      { speaker: 'npc', text: `${npc.questHook} Prove your command, then return for counsel.` },
    ],
  }), [npc]);

  const handleClaimCounsel = () => {
    if (!atNpc) {
      setNotice('Walk to this contact before claiming counsel.');
      return;
    }

    const result = claimQuestNpcReward(npc.id);
    setNotice(result.success ? 'Counsel reward claimed.' : result.error || 'Could not claim counsel.');
    setUser(getCurrentUser());
    if (result.success) {
      emitCompletionNotice({
        id: `quest-npc-completion-${npc.id}-${Date.now()}`,
        kind: 'quest',
        kicker: npc.faction,
        title: `${npc.name}'s Counsel`,
        description: npc.questHook,
        rewards: rewardSummaryToCompletionRewards(result.rewards),
        completedAt: Date.now(),
      });
      window.setTimeout(onClose, 900);
    }
    window.setTimeout(() => setNotice(''), 2500);
  };

  return (
    <>
    {showConversation && user && (
      <StoryDialogOverlay
        sequence={conversation}
        playerModelNumber={user.selectedModel || 3}
        onComplete={() => {
          recordQuestNpcVisit(npc.id);
          setUser(getCurrentUser());
          setShowConversation(false);
        }}
      />
    )}
    <div className="world-popup-layer pointer-events-none fixed inset-0 flex items-center justify-center px-4">
      <div
        className="world-popup-panel command-panel vine-frame pointer-events-auto w-full max-w-md overflow-hidden rounded border text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="fantasy-heading text-xl">{npc.name}</h2>
            <p className="arcane-label">{npc.title}</p>
          </div>
          <button onClick={onClose} className="ui-button rounded px-3 py-1 text-xs font-bold">
            Close
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <span className="ui-icon-frame relative h-20 w-20 shrink-0 overflow-hidden rounded border">
              <Image
                src={getPlayerModelPath(npc.modelNumber)}
                alt={npc.name}
                fill
                className="player-model-art object-contain"
                sizes="80px"
                unoptimized
              />
            </span>
            <div>
              <div className="ui-accent text-xs font-black">{npc.faction}</div>
              <div className="ui-muted text-xs font-bold">{npc.town} - Lv {npc.levelRange}</div>
            </div>
          </div>
          <p className="text-sm font-bold text-zinc-100">&ldquo;{npc.line}&rdquo;</p>
          <div className="ui-card rounded border p-3 text-xs font-bold text-yellow-100">
            {npc.questHook}
          </div>
          <div className={`ui-card rounded border p-3 text-xs font-bold ${counselStatus.complete ? 'text-emerald-100' : 'text-yellow-100'}`}>
            <div className="arcane-label">Counsel Task</div>
            <div className="mt-1">{formatQuestRequirementText(npc.requirement)}</div>
            <div className="ui-progress-track mt-3 h-1.5 overflow-hidden rounded border">
              <div
                className="ui-progress-fill h-full"
                style={{ width: `${Math.min(100, (counselStatus.progress / Math.max(1, counselStatus.required)) * 100)}%` }}
              />
            </div>
            <div className="ui-faint mt-2 text-[10px] font-black uppercase">
              {counselStatus.progress}/{counselStatus.required}
            </div>
          </div>
          <div className="ui-pill rounded border p-3 text-xs font-bold text-[var(--ui-muted)]">
            <div className="arcane-label">Counsel Reward</div>
            <div className="mt-1 text-zinc-100">{formatQuestNpcRewards(npc.rewards)}</div>
          </div>
          {atNpc && (
            <button
              type="button"
              onClick={() => setShowConversation(true)}
              className="ui-button w-full rounded px-4 py-2 text-xs font-black uppercase"
            >
              Speak Again
            </button>
          )}
          {notice && (
            <div className="ui-notice rounded border px-3 py-2 text-xs font-bold">
              {notice}
            </div>
          )}
          <button
            onClick={() => {
              if (!atNpc) {
                onTravel();
                setUser(getCurrentUser());
                return;
              }
              handleClaimCounsel();
            }}
            disabled={claimed || (atNpc && !counselStatus.complete) || Boolean(user?.traveling && !atNpc)}
            className="ui-button-primary w-full rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            {claimed ? 'Counsel Claimed' : atNpc ? counselStatus.complete ? 'Claim Counsel' : 'Complete Task First' : user?.traveling ? 'Walking Here' : 'Walk Here'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

function EnemyScoutModal({
  enemy,
  currentUser,
  canStart,
  onStart,
  onTravel,
  onClose,
}: {
  enemy: WorldEnemy;
  currentUser: ReturnType<typeof getCurrentUser>;
  canStart: boolean;
  onStart: () => void;
  onTravel: () => void;
  onClose: () => void;
}) {
  const preview = currentUser ? getBattleRatingPreview(currentUser, enemy) : null;
  const toneClass = preview?.tone === 'green'
    ? 'ui-rarity-rare'
    : preview?.tone === 'red'
      ? 'border-red-300/50 bg-red-950/40 text-red-100'
      : preview?.tone === 'violet'
        ? 'ui-rarity-epic'
        : 'ui-rarity-legendary';
  const unitNames = enemy.minions
    .map(minion => getMinionTemplate(minion.templateId)?.name || minion.templateId)
    .slice(0, 5);
  const routeBattles = getEncounterRunBattleCount(enemy.level);

  return (
    <div className="world-popup-layer pointer-events-none fixed inset-0 flex items-center justify-center px-4">
      <div
        className="world-popup-panel command-panel vine-frame pointer-events-auto w-full max-w-lg overflow-hidden rounded border text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="fantasy-heading truncate text-2xl">{enemy.name}</h2>
            <p className="arcane-label">{enemy.subtitle} - Lv {enemy.level}</p>
          </div>
          <button onClick={onClose} className="ui-button rounded px-3 py-1 text-xs font-bold">
            Close
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-4">
            <span className="ui-icon-frame relative h-24 w-24 shrink-0 overflow-hidden rounded border">
              <Image
                src={enemy.artworkPath || getPlayerModelPath(enemy.modelNumber)}
                alt={enemy.name}
                fill
                className="player-model-art object-contain p-2"
                sizes="96px"
                unoptimized
              />
            </span>
            <div className="min-w-0 flex-1">
            <div className="arcane-label">Scout Report</div>
              {enemy.spawnKind === 'world-boss' && (
                <div className="ui-rarity-legendary mt-1 inline-flex rounded border px-2 py-1 text-[10px] font-black uppercase">
                  Hourly Boss
                </div>
              )}
              <p className="ui-muted mt-1 text-sm font-bold">
                {enemy.story || preview?.summary || 'Scout data unavailable.'}
              </p>
              {preview && (
                <button
                  type="button"
                  data-multiplayer-tutorial-anchor="enemy-risk"
                  onClick={() => completeMultiplayerTutorialCallout(currentUser?.username, 'enemy-risk')}
                  className={`mt-3 inline-flex rounded border px-3 py-1 text-xs font-black uppercase ${toneClass}`}
                >
                  {preview.label}
                </button>
              )}
            </div>
          </div>

          {preview && (
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <DungeonPill label="Your Power" value={String(preview.playerRating)} />
              <DungeonPill label="Enemy Power" value={String(preview.enemyRating)} />
              <DungeonPill label="Your Units" value={String(preview.playerUnits)} />
              <DungeonPill label="Enemy Units" value={String(preview.enemyUnits)} />
            </div>
          )}

          <div className="ui-card rounded border p-3">
            <div className="arcane-label">Road Structure</div>
            <p className="ui-muted mt-1 text-xs font-bold">
              {routeBattles} fight{routeBattles === 1 ? '' : 's'} total. The marked enemy is the final boss; shops and omens may appear between fights on longer roads.
            </p>
          </div>

          <div className="ui-card rounded border p-3">
            <div className="arcane-label">Enemy Warband</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {unitNames.length > 0 ? (
                unitNames.map((name, index) => (
                  <span key={`${name}-${index}`} className="ui-pill rounded border px-2 py-1 text-xs font-black text-zinc-100">
                    {name}
                  </span>
                ))
              ) : (
                <span className="ui-muted text-xs font-bold">Commander alone.</span>
              )}
              {enemy.minions.length > unitNames.length && (
                <span className="ui-pill rounded border px-2 py-1 text-xs font-black text-zinc-100">
                  +{enemy.minions.length - unitNames.length} more
                </span>
              )}
            </div>
          </div>

          <button
            onClick={canStart ? onStart : onTravel}
            disabled={!currentUser || Boolean(currentUser.traveling && !canStart)}
            className="ui-button-primary w-full rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            {canStart ? 'Start Road' : currentUser?.traveling ? 'Walking to Enemy' : 'Walk Here'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DungeonModal({
  dungeon,
  now,
  currentUser,
  onEnter,
  onTravel,
  onClose,
}: {
  dungeon: WorldDungeon;
  now: number;
  currentUser: ReturnType<typeof getCurrentUser>;
  onEnter: () => void;
  onTravel: () => void;
  onClose: () => void;
}) {
  const region = getRegionForTile(dungeon.x, dungeon.y);
  const fieldedCount = getFieldedMinions(currentUser).length;
  const requiredMinions = dungeon.level >= 12 ? 5 : dungeon.level >= 8 ? 3 : dungeon.level >= 5 ? 1 : 0;
  const atDungeon = Boolean(currentUser && isTileInsideFootprint(currentUser.x, currentUser.y, dungeon.x, dungeon.y, 3, 3));
  const canEnter = atDungeon && fieldedCount >= requiredMinions;

  return (
    <div className="world-popup-layer pointer-events-none fixed inset-0 flex items-center justify-center px-4">
      <div
        className="world-popup-panel command-panel vine-frame pointer-events-auto w-full max-w-md overflow-hidden rounded border text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="fantasy-heading text-xl">{dungeon.name}</h2>
            <p className="arcane-label">{region.name} - Lv {dungeon.level}</p>
          </div>
          <button onClick={onClose} className="ui-button rounded px-3 py-1 text-xs font-bold">
            Close
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="ui-muted text-sm font-bold">{dungeon.description}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <DungeonPill label="Region" value={region.name} />
            <DungeonPill label="Level" value={String(dungeon.level)} />
            <DungeonPill label="Expires" value={formatDungeonTimeRemaining(dungeon.expiresAt, now)} />
          </div>
          <div className="ui-card rounded border p-3">
            <div className="arcane-label">Boss</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="ui-icon-frame relative h-20 w-20 shrink-0 overflow-hidden rounded border">
                <Image
                  src={dungeon.bossArtworkPath}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="80px"
                  unoptimized
                />
              </span>
              <span className="min-w-0">
                <span className="fantasy-heading block text-base">{dungeon.bossName}</span>
                <span className="ui-muted mt-1 block text-xs font-bold">{dungeon.bossSubtitle}</span>
                <span className="ui-faint mt-1 block text-[11px] font-bold">{dungeon.bossStory}</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <DungeonPill label="Required" value={`${requiredMinions} units`} />
            <DungeonPill label="Fielded" value={`${fieldedCount} units`} />
          </div>
          <button
            onClick={!atDungeon ? onTravel : onEnter}
            disabled={!currentUser || Boolean(currentUser.traveling && !atDungeon) || (atDungeon && !canEnter)}
            className="ui-button-primary w-full rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            {!atDungeon ? currentUser?.traveling ? 'Walking Here' : 'Walk Here' : canEnter ? 'Enter Dungeon Run' : 'More Units Needed'}
          </button>
          <p className="ui-muted text-xs font-bold">
            Dungeon runs now use a short chamber path with battles, shops, chance pools, and a boss reward.
          </p>
        </div>
      </div>
    </div>
  );
}

function DungeonPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-pill rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value text-sm font-black">{value}</div>
    </div>
  );
}
