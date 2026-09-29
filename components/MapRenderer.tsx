'use client';

import { type WheelEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { findPoiAtTile, getPoiFootprint, getStaticPOIs, MAP_CONFIG, POI, POIType } from '@/lib/mapData';
import {
  AssetLoader,
  ASSET_PATHS,
  getPlayerModelPath,
  preloadDeferredAssetsWhenIdle,
  preloadMapAssets,
} from '@/lib/assetLoader';
import { getEncounterRunBattleCount } from '@/lib/encounterRunBattleCount';
import {
  drawMapPlateLabel,
  getMapLabelFont,
  MAP_LABEL_BONE,
  resetMapLabelCache,
} from './map/mapLabels';
import {
  areFriends as areSocialFriends,
  claimReadyQuestRewards,
  claimQuestReward,
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
  getStoryQuestResponseChoiceId,
  getPendingStoryDialogQuest,
  markStoryQuestIntroSeen,
  recordStoryQuestResponse,
  recordCurrentMultiplayerEngagementEvent,
  recordQuestNpcVisit,
  updateJobTravelProgress,
  isPartyMember as isSocialPartyMember,
} from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCachedWorldPlayers, refreshWorldPlayers, worldMapPlayerToUser } from '@/lib/worldPlayers';
import { BATTLE_SPELLS, WorldEnemy, getBattleRatingPreview, getNpcEnemiesForUser, getPlayerModelAsset } from '@/lib/battle';
import { canPrepareCoopRaid, ensureCurrentCoopRaidSession } from '@/lib/coopRaidClient';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import { emitFxEvent } from '@/lib/fxEvents';
import { emitMapFogState } from '@/lib/mapFogEvents';
import { playGameSound } from '@/lib/sound';
import { QUEST_NPCS, getAllStoryQuestsSorted, getQuestNpcWorldVoice, type QuestNpc } from '@/lib/questData';
import { getStoryDialogSequence, type StoryDialogSequence } from '@/lib/storyDialogue';
import { isDungeonQuestObjective, isPoiQuestObjective, isQuestNpcObjective } from '@/lib/questMarkers';
import {
  WorldDungeon,
  formatDungeonTier,
  formatDungeonTimeRemaining,
  getActiveDungeons,
  getDungeonRequiredPlayerLevel,
  getDungeonTier,
  getRegionForTile,
} from '@/lib/worldEvents';
import { getMultiplayerUnlockStatus, type MultiplayerFeatureId } from '@/lib/multiplayerUnlocks';
import CinematicScrollShell from './CinematicScrollShell';
import {
  clearMultiplayerTutorialDialogue,
  completeMultiplayerUnlockDialogue,
  completeMultiplayerTutorialCallout,
  getMultiplayerTutorialDialogueLine,
  MULTIPLAYER_FIND_WORK_EVENT,
  readMultiplayerTutorialProgress,
  saveMultiplayerTutorialDialogueLine,
} from '@/lib/multiplayerTutorial';
import {
  getMultiplayerUnlockDialogue,
  getNextMultiplayerUnlockDialogue,
  type MultiplayerUnlockDialogueId,
} from '@/lib/multiplayerUnlockDialogue';
import {
  GRAPHICS_QUALITY_EVENT_NAME,
  type GraphicsQuality,
  getMapAnimIntervalMs,
  getMapCanvasRenderSize,
  getMapImageSmoothingQuality,
  isHeavyUiOverlayOpen,
  readGraphicsQualitySetting,
  shouldDrawCampfireParticles,
  shouldDrawMapShadows,
  shouldDrawRichMapMarkers,
} from '@/lib/graphicsSettings';

const POIModal = dynamic(() => import('./POIModal'), { ssr: false });
const TownModal = dynamic(() => import('./TownModal'), { ssr: false });
const PlayerListModal = dynamic(() => import('./PlayerListModal'), { ssr: false });
const StoryDialogOverlay = dynamic(() => import('./StoryDialogOverlay'), { ssr: false });
const EncounterRunModal = dynamic(
  () => import('./RoguelikeRunModal').then(module => module.EncounterRunModal),
  { ssr: false },
);
const DungeonRunModal = dynamic(
  () => import('./RoguelikeRunModal').then(module => module.DungeonRunModal),
  { ssr: false },
);

/**
 * Graphics flags read once per quality change instead of per draw call
 * (each settings read parses localStorage JSON).
 */
const mapGfx = {
  quality: 'medium' as GraphicsQuality,
  shadows: true,
  rich: false,
  particles: false,
  smoothing: 'medium' as ImageSmoothingQuality,
  animIntervalMs: 66,
};

function refreshMapGfx(): void {
  const quality = readGraphicsQualitySetting();
  mapGfx.quality = quality;
  mapGfx.shadows = shouldDrawMapShadows(quality);
  mapGfx.rich = shouldDrawRichMapMarkers(quality);
  mapGfx.particles = shouldDrawCampfireParticles(quality);
  mapGfx.smoothing = getMapImageSmoothingQuality(quality);
  mapGfx.animIntervalMs = getMapAnimIntervalMs(quality);
}

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

function drawCampfireGroundPad(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number
): void {
  drawGroundShadow(ctx, centerX, centerY + size * 0.22, size * 0.46, size * 0.2);
  ctx.save();
  ctx.fillStyle = 'rgba(28, 18, 12, 0.55)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + size * 0.18, size * 0.34, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(72, 48, 28, 0.55)';
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.stroke();
  ctx.restore();
}

function drawCampfireGroundGlow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
  alpha: number
): void {
  const radius = size * 0.3;
  const glow = ctx.createRadialGradient(centerX, centerY + size * 0.08, 0, centerX, centerY + size * 0.08, radius);
  glow.addColorStop(0, `rgba(255, 156, 64, ${alpha})`);
  glow.addColorStop(0.4, `rgba(232, 96, 28, ${alpha * 0.55})`);
  glow.addColorStop(0.78, `rgba(120, 42, 14, ${alpha * 0.18})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY + size * 0.08, radius, 0, Math.PI * 2);
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
  if (!mapGfx.particles) return;
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
const MAP_FOG_POINTER_EMIT_MS = 40;
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
  if (enemy.spawnKind === 'story-boss' || enemy.spawnKind === 'regional-threat' || enemy.spawnKind === 'coop-boss') return true;
  return isScreenPointRevealed(getEnemyScreenCenter(enemy, cameraX, cameraY, tileSize), cursor, playerRevealPoint, zoom);
}

function drawMapLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  options?: { alpha?: number; fontSize?: number }
): void {
  const alpha = options?.alpha ?? 1;
  const fontSize = options?.fontSize ?? 10;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.font = getMapLabelFont(fontSize);
  ctx.textAlign = 'center';
  if (mapGfx.shadows) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

const rgbaAlphaCache = new Map<string, Map<string, string>>();

/** Swaps the alpha of an `rgba(...)` color; cached because draw helpers call it every frame. */
function withRgbaAlpha(color: string, alpha: string): string {
  let byAlpha = rgbaAlphaCache.get(color);
  if (!byAlpha) {
    byAlpha = new Map();
    rgbaAlphaCache.set(color, byAlpha);
  }
  let result = byAlpha.get(alpha);
  if (!result) {
    result = color.replace(/[\d.]+\)$/, `${alpha})`);
    byAlpha.set(alpha, result);
  }
  return result;
}

interface MapLabelBudget {
  showNames: boolean;
  questBangAlpha: number;
  questBangSize: number;
}

const MAP_LABEL_BUDGET_FAR: MapLabelBudget = { showNames: false, questBangAlpha: 0.38, questBangSize: 10 };
const MAP_LABEL_BUDGET_MID: MapLabelBudget = { showNames: false, questBangAlpha: 0.58, questBangSize: 11 };
const MAP_LABEL_BUDGET_NEAR: MapLabelBudget = { showNames: true, questBangAlpha: 1, questBangSize: 13 };
const MAP_LANDMARK_LABEL_SIZE = 13;
const MAP_CHARACTER_LABEL_SIZE = 12;

function getMapLabelBudget(zoom: number): MapLabelBudget {
  const zoomRatio = zoom / DEFAULT_MAP_ZOOM;
  if (zoomRatio < 0.92) return MAP_LABEL_BUDGET_FAR;
  if (zoomRatio < 1) return MAP_LABEL_BUDGET_MID;
  return MAP_LABEL_BUDGET_NEAR;
}

function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number
): void {
  if (!mapGfx.shadows) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVisibleWorldMap(
  ctx: CanvasRenderingContext2D,
  worldMap: HTMLImageElement,
  cameraX: number,
  cameraY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
): void {
  const baseWidth = MAP_CONFIG.width * MAP_CONFIG.tileSize;
  const baseHeight = MAP_CONFIG.height * MAP_CONFIG.tileSize;
  const safeZoom = Math.max(0.01, zoom);
  let sx = cameraX / safeZoom;
  let sy = cameraY / safeZoom;
  let sw = viewportWidth / safeZoom;
  let sh = viewportHeight / safeZoom;

  if (sx < 0) {
    const clipped = -sx;
    sx = 0;
    sw -= clipped;
  }
  if (sy < 0) {
    const clipped = -sy;
    sy = 0;
    sh -= clipped;
  }
  if (sx + sw > baseWidth) sw = baseWidth - sx;
  if (sy + sh > baseHeight) sh = baseHeight - sy;
  if (sw <= 0 || sh <= 0) return;

  const dx = (sx * safeZoom) - cameraX;
  const dy = (sy * safeZoom) - cameraY;
  const dw = sw * safeZoom;
  const dh = sh * safeZoom;
  ctx.drawImage(worldMap, sx, sy, sw, sh, dx, dy, dw, dh);
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
  ctx.lineWidth = hovered ? 1.9 : 1.5;
  ctx.strokeStyle = hovered ? JOB_POI_DISK.borderHover : JOB_POI_DISK.border;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (accentRing) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = withRgbaAlpha(accentRing, hovered ? '0.34' : '0.18');
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
    if (!hovered && idleImageFilter && mapGfx.rich) {
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
    ctx.strokeStyle = hovered ? accentColor : withRgbaAlpha(accentColor, '0.52');
    ctx.lineWidth = hovered ? 1.35 : 1.1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 0.6, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    ctx.restore();
  }

  if (label && (showLabel || hovered)) {
    drawMapPlateLabel(
      ctx,
      label,
      centerX,
      centerY + radius + 4,
      labelColor,
      hovered ? MAP_LANDMARK_LABEL_SIZE + 1 : MAP_LANDMARK_LABEL_SIZE,
    );
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
    showLabel?: boolean;
  }
): void {
  const {
    centerX,
    centerY,
    footprint,
    image,
    hovered = false,
    fallbackLabel = '?',
    label,
    showLabel = false,
  } = options;

  drawCircularLandmarkMarker(ctx, {
    centerX,
    centerY,
    footprint,
    radiusRatio: 0.14,
    hoveredRadiusRatio: 0.16,
    image,
    hovered,
    fallbackLabel,
    label,
    showLabel: showLabel || hovered,
    ringColor: 'rgba(234, 220, 154, 0.78)',
    ringHoverColor: 'rgba(255, 236, 170, 0.95)',
    backingColor: 'rgba(8, 7, 9, 0.55)',
    labelColor: MAP_LABEL_BONE,
    ringWidth: 1.75,
    ringHoverWidth: 2.5,
  });
}

function drawDungeonMarker(
  ctx: CanvasRenderingContext2D,
  options: {
    centerX: number;
    centerY: number;
    size: number;
    image?: HTMLImageElement | null;
    hovered?: boolean;
    label?: string;
    showLabel?: boolean;
  }
): void {
  const { centerX, centerY, size, image, hovered = false, label, showLabel = false } = options;

  drawCircularLandmarkMarker(ctx, {
    centerX,
    centerY,
    footprint: size / 0.34,
    radiusRatio: 0.34,
    hoveredRadiusRatio: 0.38,
    image,
    hovered,
    fallbackLabel: 'Dg',
    label,
    showLabel: showLabel || hovered,
    ringColor: 'rgba(186, 140, 255, 0.78)',
    ringHoverColor: 'rgba(224, 190, 255, 0.96)',
    backingColor: 'rgba(18, 8, 28, 0.72)',
    labelColor: '#f5d0fe',
    ringWidth: 1.7,
    ringHoverWidth: 2.4,
    accentColor: 'rgba(168, 85, 247, 0.7)',
    idleImageFilter: 'saturate(0.92) brightness(0.94)',
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
  const size = footprint * (hovered ? 1.08 : 1);
  const poolAlpha = (0.32 + pulse * 0.14) * (0.94 + flicker * 0.06);
  const fogHaloAlpha = (0.018 + pulse * 0.012) * (0.9 + flicker * 0.08);

  drawCampfireGroundPad(ctx, centerX, centerY, size);
  if (mapGfx.rich) {
    drawMapGlowPool(ctx, {
      centerX,
      centerY: centerY + size * 0.04,
      radiusX: size * 1.05,
      radiusY: size * 0.82,
      innerRgb: '255, 124, 42',
      outerRgb: '168, 52, 18',
      alpha: fogHaloAlpha,
    });
    drawCampfireGroundGlow(ctx, centerX, centerY, size, poolAlpha);
    drawCampfireGroundGlow(ctx, centerX, centerY, size, poolAlpha * 0.42);
  } else {
    drawCampfireGroundGlow(ctx, centerX, centerY, size, poolAlpha * 0.7);
  }

  if (image) {
    ctx.save();
    if (mapGfx.shadows) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = hovered ? 6 : 3;
      ctx.shadowOffsetY = 1;
    }
    ctx.drawImage(
      image,
      centerX - size / 2,
      centerY - size / 2,
      size,
      size
    );
    ctx.restore();
  }

  drawCampfireEmberParticles(ctx, centerX, centerY, size, now, pulse);

  if (hovered && label) {
    drawMapPlateLabel(ctx, label, centerX, centerY + size * 0.5, MAP_LABEL_BONE, MAP_LANDMARK_LABEL_SIZE);
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
  const rich = mapGfx.rich;
  const poolAlpha = hovered ? 0.2 : rich ? 0.08 + pulse * 0.06 : 0.1;
  const glowStrength = hovered ? 0.62 : rich ? 0.26 + pulse * 0.14 : 0.3;

  drawGroundShadow(ctx, centerX, centerY + diskRadius * 0.66, diskRadius * 0.72, diskRadius * 0.2);

  if (rich || hovered) {
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
  }

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
    if (rich || hovered) {
      ctx.shadowColor = glow.shadow.replace(/[\d.]+\)$/, `${glowStrength})`);
      ctx.shadowBlur = hovered ? 10 : rich ? 4 + pulse * 4 : 0;
      ctx.globalAlpha = hovered ? 0.99 : 0.97;
      if (rich) {
        ctx.filter = hovered
          ? 'brightness(1.06) saturate(1.05)'
          : `brightness(${0.99 + pulse * 0.02}) saturate(${0.96 + pulse * 0.03})`;
      }
    }
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
    drawMapPlateLabel(ctx, label, centerX, centerY + diskRadius + 4, MAP_LABEL_BONE, MAP_LANDMARK_LABEL_SIZE);
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
    showLabel?: boolean;
    topText?: string;
    topTextColor?: string;
    topTextAlpha?: number;
    topTextSize?: number;
    hovered?: boolean;
    frameColor?: string;
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
    showLabel = true,
    topText,
    topTextColor = labelColor,
    topTextAlpha = 1,
    topTextSize = 10,
    hovered = false,
    frameColor,
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
    ctx.imageSmoothingQuality = mapGfx.smoothing;
    if (hovered && mapGfx.rich) {
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

  if (frameColor) {
    const centerX = drawX + drawSize / 2;
    const centerY = drawY + drawSize / 2;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = Math.max(1.5, drawSize * 0.045);
    if (mapGfx.shadows) {
      ctx.shadowColor = frameColor;
      ctx.shadowBlur = Math.max(5, drawSize * 0.18);
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, drawSize * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (topText) {
    drawMapLabel(ctx, topText, x + size / 2, y - 4, topTextColor, {
      alpha: topTextAlpha,
      fontSize: topTextSize,
    });
  }

  if (label && (showLabel || hovered)) {
    drawMapPlateLabel(ctx, label, x + size / 2, y + size + 1, labelColor, MAP_CHARACTER_LABEL_SIZE);
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
  if (mapGfx.shadows) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = Math.max(8, tileSize * 0.22);
  }
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

  if (mapGfx.shadows) {
    ctx.shadowBlur = Math.max(10, tileSize * 0.18);
  }
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

type MapUser = ReturnType<typeof getCurrentUser>;
type MapPlayer = ReturnType<typeof getUsers>[number];
type MapHoverKind = 'enemy' | 'dungeon' | 'npc' | 'poi';

interface MapHoverTarget {
  kind: MapHoverKind | null;
  id: string | null;
}

interface MapView {
  x: number;
  y: number;
  zoom: number;
}

interface MapViewMetrics {
  minZoom: number;
  effectiveZoom: number;
  tileSize: number;
  maxCameraX: number;
  maxCameraY: number;
}

interface MapPoiGroups {
  landmarks: POI[];
  sites: POI[];
  campfires: POI[];
}

interface OtherPlayerMarker {
  player: MapPlayer;
  modelPath: string;
  labelColor: string;
  partyMember: boolean;
}

/** Latest React-derived data the imperative draw loop reads; replaced (not mutated) when inputs change. */
interface MapScene {
  width: number;
  height: number;
  poiGroups: MapPoiGroups;
  questPoiNames: ReadonlySet<string>;
  dungeonQuestObjective: boolean;
  worldDungeons: WorldDungeon[];
  visibleQuestNpcs: QuestNpc[];
  tutorialAnchorNpc: QuestNpc | null;
  otherPlayerMarkers: OtherPlayerMarker[];
  worldEnemies: WorldEnemy[];
  pendingTravel: PendingTravelIntent | null;
}

interface MapFrameOutput {
  hasPlayer: boolean;
  playerX: number;
  playerY: number;
}

function computeMapViewMetrics(width: number, height: number, zoom: number, out?: MapViewMetrics): MapViewMetrics {
  const minZoom = getMinMapZoom(width, height);
  const effectiveZoom = Math.max(minZoom, Math.min(MAX_MAP_ZOOM, zoom));
  const tileSize = MAP_CONFIG.tileSize * effectiveZoom;
  const target = out ?? { minZoom: 0, effectiveZoom: 0, tileSize: 0, maxCameraX: 0, maxCameraY: 0 };
  target.minZoom = minZoom;
  target.effectiveZoom = effectiveZoom;
  target.tileSize = tileSize;
  target.maxCameraX = Math.max(0, MAP_CONFIG.width * tileSize - width);
  target.maxCameraY = Math.max(0, MAP_CONFIG.height * tileSize - height);
  return target;
}

function getPlayerScreenPoint(
  user: MapUser,
  now: number,
  view: MapView,
  tileSize: number,
): { x: number; y: number } | null {
  const position = getRenderedUserPosition(user, now);
  if (!position) return null;
  return {
    x: position.x * tileSize - view.x + tileSize / 2,
    y: position.y * tileSize - view.y + tileSize / 2,
  };
}

/** Changes only when the committed tile position or travel/job phase changes, not on every interpolation tick. */
function getUserMovementSignature(user: MapUser): string {
  if (!user) return '';
  const activeJob = user.jobQueue?.[0];
  return [
    user.x,
    user.y,
    user.traveling ? `${user.traveling.startTime}:${user.traveling.targetX}:${user.traveling.targetY}` : '-',
    user.jobQueue?.length ?? 0,
    activeJob ? `${activeJob.id}:${activeJob.travelComplete ? 1 : 0}` : '-',
  ].join('|');
}

function getTownMarkerImagePath(poi: POI): string {
  return ['Harborview', 'Blackwater Gate', 'Eclipse Hold'].includes(poi.name)
    ? ASSET_PATHS.pois.harborview
    : ASSET_PATHS.pois.riverside;
}

const renderSizeCache = {
  width: -1,
  height: -1,
  quality: '' as GraphicsQuality | '',
  pixelRatio: -1,
  result: { width: 1, height: 1, scale: 1 },
};

function getCachedMapCanvasRenderSize(width: number, height: number, pixelRatio: number) {
  if (
    renderSizeCache.width !== width
    || renderSizeCache.height !== height
    || renderSizeCache.quality !== mapGfx.quality
    || renderSizeCache.pixelRatio !== pixelRatio
  ) {
    renderSizeCache.width = width;
    renderSizeCache.height = height;
    renderSizeCache.quality = mapGfx.quality;
    renderSizeCache.pixelRatio = pixelRatio;
    renderSizeCache.result = getMapCanvasRenderSize(width, height, mapGfx.quality, pixelRatio);
  }
  return renderSizeCache.result;
}

const playerRevealScratch = { x: 0, y: 0 };

function drawWorldMapFrame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  scene: MapScene,
  view: MapView,
  metrics: MapViewMetrics,
  hover: MapHoverTarget,
  currentUser: MapUser,
  cursorScreen: { x: number; y: number } | null,
  now: number,
  out: MapFrameOutput,
): void {
  const actualWidth = scene.width;
  const actualHeight = scene.height;
  const pixelRatio = window.devicePixelRatio || 1;
  const renderSize = getCachedMapCanvasRenderSize(actualWidth, actualHeight, pixelRatio);
  if (canvas.width !== renderSize.width || canvas.height !== renderSize.height) {
    canvas.width = renderSize.width;
    canvas.height = renderSize.height;
  }
  ctx.setTransform(renderSize.scale, 0, 0, renderSize.scale, 0, 0);

  // Clear canvas in CSS-pixel space
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, actualWidth, actualHeight);
  // Terrain, markers and sprites are all drawn resampled, so smoothing stays on at every buffer scale.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = mapGfx.smoothing;

  const cameraX = view.x;
  const cameraY = view.y;
  const tileSize = metrics.tileSize;
  const effectiveZoom = metrics.effectiveZoom;
  const mapWidth = MAP_CONFIG.width * tileSize;
  const mapHeight = MAP_CONFIG.height * tileSize;
  const renderedUserPosition = getRenderedUserPosition(currentUser, now);
  let playerRevealPoint: { x: number; y: number } | null = null;
  if (renderedUserPosition) {
    playerRevealScratch.x = renderedUserPosition.x * tileSize - cameraX + tileSize / 2;
    playerRevealScratch.y = renderedUserPosition.y * tileSize - cameraY + tileSize / 2;
    playerRevealPoint = playerRevealScratch;
    out.hasPlayer = true;
    out.playerX = playerRevealScratch.x;
    out.playerY = playerRevealScratch.y;
  } else {
    out.hasPlayer = false;
  }

  const worldMap = AssetLoader.requestImage(ASSET_PATHS.map.world);
  if (worldMap) {
    drawVisibleWorldMap(ctx, worldMap, cameraX, cameraY, actualWidth, actualHeight, effectiveZoom);
  } else {
    ctx.fillStyle = '#182216';
    ctx.fillRect(-cameraX, -cameraY, mapWidth, mapHeight);
  }

  const pendingTravel = scene.pendingTravel;
  const activeTravel = currentUser?.traveling;
  const activeJob = currentUser?.jobQueue?.[0];
  const activeJobTraveling = Boolean(
    activeJob &&
    now >= activeJob.startTime &&
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
      now,
    });
  }

  const labelBudget = getMapLabelBudget(effectiveZoom);
  const drawQuestBang = (x: number, y: number) => {
    drawMapLabel(ctx, '!', x, y, '#fef08a', {
      alpha: labelBudget.questBangAlpha,
      fontSize: labelBudget.questBangSize,
    });
  };
  const hoveredPoiId = hover.kind === 'poi' ? hover.id : null;
  const hoveredDungeonId = hover.kind === 'dungeon' ? hover.id : null;
  const hoveredNpcId = hover.kind === 'npc' ? hover.id : null;
  const hoveredEnemyId = hover.kind === 'enemy' ? hover.id : null;

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

    const imagePath = poi.type === POIType.TOWN ? getTownMarkerImagePath(poi) : POI_IMAGE_PATHS[poi.type];
    const poiImage = AssetLoader.requestImage(imagePath);
    const markerCenterX = screenX + footprintWidth / 2;
    const markerCenterY = screenY + footprintHeight / 2;
    const hovered = hoveredPoiId === poi.id;
    const questObjective = scene.questPoiNames.has(poi.name);

    if (poi.type === POIType.TOWN) {
      drawTownMarker(ctx, {
        centerX: markerCenterX,
        centerY: markerCenterY,
        footprint: poiSize,
        image: poiImage,
        hovered,
        fallbackLabel: poi.name.slice(0, 2).toUpperCase(),
        label: poi.name,
        showLabel: labelBudget.showNames,
      });
      if (questObjective) {
        drawQuestBang(markerCenterX, screenY - 6);
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
        now,
      });
      if (questObjective) {
        drawQuestBang(markerCenterX, screenY - 6);
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
      now,
    });
    if (questObjective) {
      drawQuestBang(markerCenterX, screenY - 6);
    }
  };

  scene.poiGroups.landmarks.forEach(drawPoiMarker);

  const dungeonImage = AssetLoader.requestImage(ASSET_PATHS.pois.mountain);
  scene.worldDungeons.forEach(dungeon => {
    const dungeonSize = tileSize * 1.45;
    const dungeonCenterX = dungeon.x * tileSize - cameraX + tileSize * 1.5;
    const dungeonCenterY = dungeon.y * tileSize - cameraY + tileSize * 1.5;
    const hovered = hoveredDungeonId === dungeon.id;

    if (
      dungeonCenterX >= -dungeonSize &&
      dungeonCenterX < actualWidth + dungeonSize &&
      dungeonCenterY >= -dungeonSize &&
      dungeonCenterY < actualHeight + dungeonSize
    ) {
      drawDungeonMarker(ctx, {
        centerX: dungeonCenterX,
        centerY: dungeonCenterY,
        size: dungeonSize,
        image: dungeonImage,
        hovered,
        label: dungeon.name,
        showLabel: false,
      });

      const labelPoint = { x: dungeonCenterX, y: dungeonCenterY };
      if (hovered || isScreenPointRevealed(labelPoint, cursorScreen, playerRevealPoint, effectiveZoom)) {
        drawMapLabel(ctx, `Lv ${dungeon.level}`, dungeonCenterX, dungeonCenterY - dungeonSize * 0.58, '#f5d0fe', {
          fontSize: 11,
        });
      }
      if (scene.dungeonQuestObjective) {
        drawQuestBang(dungeonCenterX, dungeonCenterY - dungeonSize * 0.72);
      }
    }
  });

  scene.poiGroups.sites.forEach(drawPoiMarker);

  scene.visibleQuestNpcs.forEach(npc => {
    const npcScreenX = npc.x * tileSize - cameraX;
    const npcScreenY = npc.y * tileSize - cameraY;
    const npcSize = getCharacterSpriteSize(tileSize, effectiveZoom, 0.9, 26);

    if (
      npcScreenX >= -npcSize &&
      npcScreenX < actualWidth &&
      npcScreenY >= -npcSize &&
      npcScreenY < actualHeight
    ) {
      drawCharacterSprite(ctx, {
        image: AssetLoader.requestImage(getPlayerModelPath(npc.modelNumber)),
        x: npcScreenX + (tileSize - npcSize) / 2,
        y: npcScreenY + (tileSize - npcSize) / 2 - tileSize * 0.08,
        size: npcSize,
        fallbackColor: '#854d0e',
        label: npc.name,
        labelColor: '#fef08a',
        showLabel: labelBudget.showNames,
        // visibleQuestNpcs is already filtered by shouldShowQuestNpcMarker.
        topText: '!',
        topTextColor: '#fef08a',
        topTextAlpha: labelBudget.questBangAlpha,
        topTextSize: labelBudget.questBangSize,
        hovered: hoveredNpcId === npc.id,
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
      const playerImg = AssetLoader.requestImage(getPlayerModelPath(currentUser.selectedModel || 3));
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
        showLabel: labelBudget.showNames,
      });
    }
  }

  const otherPlayerSize = getCharacterSpriteSize(tileSize, effectiveZoom, 0.88, 25);
  scene.otherPlayerMarkers.forEach(({ player, modelPath, labelColor, partyMember }) => {
    const sameTileAsCurrentUser = currentUser && player.x === currentUser.x && player.y === currentUser.y;
    const playerScreenX = player.x * tileSize - cameraX + (sameTileAsCurrentUser ? tileSize * 0.22 : 0);
    const playerScreenY = player.y * tileSize - cameraY + (sameTileAsCurrentUser ? tileSize * 0.1 : 0);

    if (
      playerScreenX >= -otherPlayerSize &&
      playerScreenX < actualWidth &&
      playerScreenY >= -otherPlayerSize &&
      playerScreenY < actualHeight
    ) {
      drawCharacterSprite(ctx, {
        image: AssetLoader.requestImage(modelPath),
        x: playerScreenX + (tileSize - otherPlayerSize) / 2,
        y: playerScreenY + (tileSize - otherPlayerSize) / 2 - tileSize * 0.08,
        size: otherPlayerSize,
        fallbackColor: '#0e7490',
        label: player.username,
        labelColor,
        showLabel: labelBudget.showNames,
        frameColor: partyMember ? '#6ee7b7' : undefined,
      });
    }
  });

  scene.worldEnemies.forEach(enemy => {
    const enemyScreenX = enemy.x * tileSize - cameraX;
    const enemyScreenY = enemy.y * tileSize - cameraY;
    const isWorldBoss = enemy.spawnKind === 'world-boss';
    const isStoryBoss = enemy.spawnKind === 'story-boss';
    const isRegionalThreat = enemy.spawnKind === 'regional-threat';
    const isCoopBoss = enemy.spawnKind === 'coop-boss';
    const isBossThreat = isWorldBoss || isStoryBoss || isRegionalThreat || isCoopBoss;
    const enemySize = getCharacterSpriteSize(tileSize, effectiveZoom, isBossThreat ? 1.22 : 0.88, isBossThreat ? 36 : 25);

    if (
      enemyScreenX < -enemySize ||
      enemyScreenX >= actualWidth ||
      enemyScreenY < -enemySize ||
      enemyScreenY >= actualHeight ||
      !isEnemyRevealedOnScreen(enemy, cameraX, cameraY, tileSize, cursorScreen, playerRevealPoint, effectiveZoom)
    ) {
      return;
    }

    const enemyHovered = hoveredEnemyId === enemy.id;
    drawCharacterSprite(ctx, {
      image: AssetLoader.requestImage(enemy.artworkPath || getPlayerModelAsset(enemy.modelNumber)),
      x: enemyScreenX + (tileSize - enemySize) / 2,
      y: enemyScreenY + (tileSize - enemySize) / 2 - tileSize * 0.08,
      size: enemySize,
      fallbackColor: '#7f1d1d',
      topText: isWorldBoss ? 'Boss' : isStoryBoss ? 'Story' : isRegionalThreat ? 'Threat' : (labelBudget.showNames || enemyHovered ? `Lv ${enemy.level}` : undefined),
      topTextColor: isBossThreat ? '#fca5a5' : '#fecaca',
      topTextAlpha: labelBudget.showNames ? 1 : 0.7,
      topTextSize: labelBudget.showNames ? 12 : 10,
      label: isBossThreat || enemyHovered ? enemy.name : undefined,
      labelColor: '#fecaca',
      showLabel: labelBudget.showNames || enemyHovered,
      hovered: enemyHovered,
    });
  });

  ctx.shadowBlur = 0;
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
  const tutorialAnchorRef = useRef<HTMLSpanElement>(null);
  // Camera, zoom, hover and animation time live in refs: the rAF loop draws from them without re-rendering React.
  const viewRef = useRef<MapView>({ x: 0, y: 0, zoom: DEFAULT_MAP_ZOOM });
  const hoverRef = useRef<MapHoverTarget>({ kind: null, id: null });
  const sceneRef = useRef<MapScene | null>(null);
  const liveUserRef = useRef<MapUser>(null);
  const dirtyRef = useRef(true);
  const mapCoveredRef = useRef(false);
  const syncDrawLoopRef = useRef<(() => void) | null>(null);
  const frameOutputRef = useRef<MapFrameOutput>({ hasPlayer: false, playerX: 0, playerY: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const userMovementSignatureRef = useRef('');
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [selectedTown, setSelectedTown] = useState<POI | null>(null);
  const [selectedEnemy, setSelectedEnemy] = useState<WorldEnemy | null>(null);
  const [activeBattleEnemy, setActiveBattleEnemy] = useState<WorldEnemy | null>(null);
  const [selectedDungeon, setSelectedDungeon] = useState<WorldDungeon | null>(null);
  const [selectedDungeonRun, setSelectedDungeonRun] = useState<WorldDungeon | null>(null);
  const [selectedQuestNpc, setSelectedQuestNpc] = useState<QuestNpc | null>(null);
  const cursorScreenRef = useRef<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [dimensionsReady, setDimensionsReady] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showPlayerList, setShowPlayerList] = useState(false);
  const [playerListLocation, setPlayerListLocation] = useState<{ x: number; y: number } | null>(null);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [worldPlayersTick, setWorldPlayersTick] = useState(0);
  const [worldNow, setWorldNow] = useState(() => Date.now());
  const [pendingTravel, setPendingTravel] = useState<PendingTravelIntent | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [mainQuestTrackerHidden, setMainQuestTrackerHidden] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(MAIN_QUEST_TRACKER_HIDDEN_KEY) === 'true';
  });
  const [storyDialogQuestId, setStoryDialogQuestId] = useState<string | null>(null);
  const [unlockDialogId, setUnlockDialogId] = useState<MultiplayerUnlockDialogueId | null>(null);
  const cameraInitialized = useRef(false);
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const worldEnemySignatureRef = useRef('');
  const activeBattleEnemyRef = useRef<WorldEnemy | null>(null);
  const selectedDungeonRunRef = useRef<WorldDungeon | null>(null);
  const lastWalkTileKeyRef = useRef<string | null>(null);
  const walkStepParityRef = useRef(0);
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
    mapCoveredRef.current = Boolean(activeBattleEnemy || selectedDungeonRun);
    syncDrawLoopRef.current?.();
  }, [activeBattleEnemy, selectedDungeonRun]);

  useEffect(() => {
    const pending = getPendingStoryDialogQuest(currentUser);
    if (!pending || storyDialogQuestId || unlockDialogId) return;

    if (!getStoryDialogSequence(pending.dialogId)) {
      markStoryQuestIntroSeen(pending.id);
      const refreshFrame = window.requestAnimationFrame(() => setCurrentUser(getCurrentUser()));
      return () => window.cancelAnimationFrame(refreshFrame);
    }

    const openFrame = window.requestAnimationFrame(() => setStoryDialogQuestId(pending.id));
    return () => window.cancelAnimationFrame(openFrame);
  }, [currentUser, storyDialogQuestId, unlockDialogId]);

  useEffect(() => {
    if (!currentUser || storyDialogQuestId || unlockDialogId) return;
    if (getPendingStoryDialogQuest(currentUser)) return;

    const tutorialProgress = readMultiplayerTutorialProgress(currentUser.username);
    const pending = getNextMultiplayerUnlockDialogue(
      currentUser.stats.level,
      tutorialProgress.completedUnlockDialogueIds || [],
    );
    if (!pending) return;

    const openFrame = window.requestAnimationFrame(() => setUnlockDialogId(pending.id));
    return () => window.cancelAnimationFrame(openFrame);
  }, [currentUser, storyDialogQuestId, unlockDialogId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setIsMounted(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cancelDeferred: (() => void) | null = null;
    void preloadMapAssets().then(() => {
      if (cancelled) return;
      setAssetsLoaded(true);
      cancelDeferred = preloadDeferredAssetsWhenIdle();
    });
    return () => {
      cancelled = true;
      cancelDeferred?.();
    };
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
    const refreshWorldState = () => {
      setWorldNow(Date.now());
      setCurrentUser(getCurrentUser());
    };
    // Game progress is timestamp-based, so the logic below keeps running while hidden;
    // only the React refresh is skipped until the tab is visible again.
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshWorldState();
    };

    const interval = setInterval(() => {
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
            playGameSound('quest.claim', { throttleMs: 180 });
            if (claim.rewards?.gold) playGameSound('inventory.goldGain', { throttleMs: 180 });
            if (claim.rewards?.rareGems) playGameSound('inventory.gemGain', { throttleMs: 180 });
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

      if (!document.hidden) refreshWorldState();
    }, 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
      if (!latestUser.traveling && !activeJobTraveling) {
        lastWalkTileKeyRef.current = null;
        return;
      }

      const now = Date.now();
      if (activeJobTraveling) updateJobTravelProgress();
      checkTravelComplete();
      const nextUser = getCurrentUser();
      // The draw loop interpolates the walker from timestamps; React only hears about committed steps.
      liveUserRef.current = nextUser;
      const movementSignature = getUserMovementSignature(nextUser);
      if (movementSignature !== userMovementSignatureRef.current) {
        userMovementSignatureRef.current = movementSignature;
        setCurrentUser(nextUser);
      }

      const position = getRenderedUserPosition(nextUser, now);
      if (!position) {
        lastWalkTileKeyRef.current = null;
        return;
      }

      const tileKey = `${Math.floor(position.x)},${Math.floor(position.y)}`;
      if (lastWalkTileKeyRef.current && lastWalkTileKeyRef.current !== tileKey) {
        walkStepParityRef.current ^= 1;
        playGameSound(
          walkStepParityRef.current ? 'world.walkStep1' : 'world.walkStep2',
          { throttleMs: 90, volumeScale: 0.8 }
        );
      }
      lastWalkTileKeyRef.current = tileKey;
    }, DIRECT_TRAVEL_RENDER_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  // Single imperative draw loop. Input changes (camera, hover, scene) mark the frame dirty and draw on the
  // next animation frame; ambient animation (campfires, travel) redraws at the graphics-quality frame cap.
  useEffect(() => {
    if (!assetsLoaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    refreshMapGfx();
    let frameId = 0;
    let lastDrawAt = 0;
    let lastFogEmitAt = 0;
    const metrics = computeMapViewMetrics(1, 1, DEFAULT_MAP_ZOOM);
    const fog = {
      emitted: false,
      hasPlayer: false,
      playerX: 0,
      playerY: 0,
      hasPointer: false,
      pointerX: 0,
      pointerY: 0,
      cameraX: 0,
      cameraY: 0,
      zoom: 0,
      width: 0,
      height: 0,
      campfires: [] as Array<{ x: number; y: number }>,
    };
    const anchor = { element: null as HTMLSpanElement | null, left: NaN, top: NaN, size: NaN };

    const shouldRun = () => !document.hidden && !isHeavyUiOverlayOpen() && !mapCoveredRef.current;

    const positionTutorialAnchor = (scene: MapScene, view: MapView) => {
      const element = tutorialAnchorRef.current;
      const npc = scene.tutorialAnchorNpc;
      if (!element || !npc) {
        anchor.element = null;
        return;
      }
      const tileSize = metrics.tileSize;
      const size = getCharacterSpriteSize(tileSize, metrics.effectiveZoom, 0.9, 26);
      const left = npc.x * tileSize - view.x + (tileSize - size) / 2;
      const top = npc.y * tileSize - view.y + (tileSize - size) / 2 - tileSize * 0.08;
      if (anchor.element === element && anchor.left === left && anchor.top === top && anchor.size === size) return;
      anchor.element = element;
      anchor.left = left;
      anchor.top = top;
      anchor.size = size;
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
    };

    const emitFogIfChanged = (scene: MapScene, view: MapView, now: number) => {
      const output = frameOutputRef.current;
      const pointer = cursorScreenRef.current;
      const cameraChanged = fog.cameraX !== view.x
        || fog.cameraY !== view.y
        || fog.zoom !== metrics.effectiveZoom
        || fog.width !== scene.width
        || fog.height !== scene.height;
      const playerChanged = fog.hasPlayer !== output.hasPlayer
        || (output.hasPlayer && (fog.playerX !== output.playerX || fog.playerY !== output.playerY));
      const pointerPresenceChanged = fog.hasPointer !== Boolean(pointer);
      const pointerMoved = Boolean(pointer) && (fog.pointerX !== pointer?.x || fog.pointerY !== pointer?.y);
      if (fog.emitted && !cameraChanged && !playerChanged && !pointerPresenceChanged) {
        if (!pointerMoved || now - lastFogEmitAt < MAP_FOG_POINTER_EMIT_MS) return;
      }

      if (!fog.emitted || cameraChanged) {
        const tileSize = metrics.tileSize;
        fog.campfires = scene.poiGroups.campfires.map(poi => {
          const footprint = getPoiFootprint(poi);
          return {
            x: poi.x * tileSize - view.x + (footprint.width * tileSize) / 2,
            y: poi.y * tileSize - view.y + (footprint.height * tileSize) / 2,
          };
        });
      }
      fog.emitted = true;
      fog.hasPlayer = output.hasPlayer;
      fog.playerX = output.playerX;
      fog.playerY = output.playerY;
      fog.hasPointer = Boolean(pointer);
      fog.pointerX = pointer?.x ?? 0;
      fog.pointerY = pointer?.y ?? 0;
      fog.cameraX = view.x;
      fog.cameraY = view.y;
      fog.zoom = metrics.effectiveZoom;
      fog.width = scene.width;
      fog.height = scene.height;
      lastFogEmitAt = now;
      emitMapFogState({
        pointer: pointer ? { x: pointer.x, y: pointer.y } : null,
        player: output.hasPlayer ? { x: output.playerX, y: output.playerY } : null,
        campfires: fog.campfires,
        width: scene.width,
        height: scene.height,
        zoom: metrics.effectiveZoom,
      });
    };

    const tick = (timestamp: number) => {
      frameId = 0;
      if (!shouldRun()) return;
      frameId = window.requestAnimationFrame(tick);

      const scene = sceneRef.current;
      if (!scene) return;
      const view = viewRef.current;
      computeMapViewMetrics(scene.width, scene.height, view.zoom, metrics);
      const clampedX = Math.max(0, Math.min(metrics.maxCameraX, view.x));
      const clampedY = Math.max(0, Math.min(metrics.maxCameraY, view.y));
      if (clampedX !== view.x || clampedY !== view.y) {
        view.x = clampedX;
        view.y = clampedY;
        dirtyRef.current = true;
      }

      if (dirtyRef.current || timestamp - lastDrawAt >= mapGfx.animIntervalMs) {
        dirtyRef.current = false;
        lastDrawAt = timestamp;
        drawWorldMapFrame(
          canvas,
          ctx,
          scene,
          view,
          metrics,
          hoverRef.current,
          liveUserRef.current,
          cursorScreenRef.current,
          Date.now(),
          frameOutputRef.current,
        );
        positionTutorialAnchor(scene, view);
      }
      emitFogIfChanged(scene, view, timestamp);
    };

    const sync = () => {
      if (shouldRun()) {
        if (!frameId) {
          dirtyRef.current = true;
          frameId = window.requestAnimationFrame(tick);
        }
      } else if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const markDirty = () => {
      dirtyRef.current = true;
    };
    const handleQualityChange = () => {
      refreshMapGfx();
      markDirty();
    };
    const handleFontsLoaded = () => {
      resetMapLabelCache();
      markDirty();
    };

    const overlayObserver = new MutationObserver(sync);
    overlayObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener(GRAPHICS_QUALITY_EVENT_NAME, handleQualityChange);
    const unsubscribeImages = AssetLoader.onImageLoaded(markDirty);
    const fontSet = typeof document.fonts !== 'undefined' ? document.fonts : null;
    fontSet?.addEventListener('loadingdone', handleFontsLoaded);
    void fontSet?.ready.then(handleFontsLoaded);
    syncDrawLoopRef.current = sync;
    sync();

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      syncDrawLoopRef.current = null;
      overlayObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener(GRAPHICS_QUALITY_EVENT_NAME, handleQualityChange);
      unsubscribeImages();
      fontSet?.removeEventListener('loadingdone', handleFontsLoaded);
    };
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
  const poiGroups = useMemo<MapPoiGroups>(() => ({
    landmarks: poisData.filter(poi => poi.type === POIType.TOWN || poi.type === POIType.CAMPFIRE),
    sites: poisData.filter(poi => poi.type !== POIType.TOWN && poi.type !== POIType.CAMPFIRE),
    campfires: poisData.filter(poi => poi.type === POIType.CAMPFIRE),
  }), [poisData]);
  const questPoiNames = useMemo<ReadonlySet<string>>(
    () => new Set(poisData.filter(poi => isPoiQuestObjective(currentUser, poi.name)).map(poi => poi.name)),
    [currentUser, poisData]
  );
  const dungeonQuestObjective = useMemo(() => isDungeonQuestObjective(currentUser), [currentUser]);
  const otherPlayerMarkers = useMemo<OtherPlayerMarker[]>(() => otherPlayers.map((player, index) => {
    const partyMember = isSocialPartyMember(currentUser, player.username);
    const friend = areSocialFriends(currentUser, player.username);
    return {
      player,
      modelPath: getPlayerModelPath(player.selectedModel || ((index % 6) + 1)),
      labelColor: partyMember ? '#a7f3d0' : friend ? '#bfdbfe' : '#ffffff',
      partyMember,
    };
  }), [currentUser, otherPlayers]);
  const tutorialAnchorNpc = useMemo(
    () => visibleQuestNpcs.find(npc => npc.id === 'quest-npc-marshal-orren') ?? null,
    [visibleQuestNpcs]
  );

  useEffect(() => {
    liveUserRef.current = currentUser;
    dirtyRef.current = true;
  }, [currentUser]);

  useEffect(() => {
    sceneRef.current = {
      width: actualWidth,
      height: actualHeight,
      poiGroups,
      questPoiNames,
      dungeonQuestObjective,
      worldDungeons,
      visibleQuestNpcs,
      tutorialAnchorNpc,
      otherPlayerMarkers,
      worldEnemies,
      pendingTravel,
    };
    dirtyRef.current = true;
  }, [
    actualWidth,
    actualHeight,
    poiGroups,
    questPoiNames,
    dungeonQuestObjective,
    worldDungeons,
    visibleQuestNpcs,
    tutorialAnchorNpc,
    otherPlayerMarkers,
    worldEnemies,
    pendingTravel,
  ]);

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

  const getViewMetrics = () => computeMapViewMetrics(actualWidth, actualHeight, viewRef.current.zoom);

  const zoomAroundBasePoint = (
    nextZoomValue: number,
    anchorBaseX: number,
    anchorBaseY: number,
    anchorScreenX: number,
    anchorScreenY: number
  ) => {
    const metrics = getViewMetrics();
    const nextZoom = Math.max(metrics.minZoom, Math.min(MAX_MAP_ZOOM, Number(nextZoomValue.toFixed(2))));
    if (nextZoom === metrics.effectiveZoom) return;

    const nextMaxCameraX = Math.max(0, MAP_CONFIG.width * MAP_CONFIG.tileSize * nextZoom - actualWidth);
    const nextMaxCameraY = Math.max(0, MAP_CONFIG.height * MAP_CONFIG.tileSize * nextZoom - actualHeight);

    const view = viewRef.current;
    view.zoom = nextZoom;
    view.x = Math.max(0, Math.min(nextMaxCameraX, anchorBaseX * nextZoom - anchorScreenX));
    view.y = Math.max(0, Math.min(nextMaxCameraY, anchorBaseY * nextZoom - anchorScreenY));
    dirtyRef.current = true;
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
      const { tileSize, maxCameraX, maxCameraY } = computeMapViewMetrics(actualWidth, actualHeight, viewRef.current.zoom);
      viewRef.current.x = Math.max(0, Math.min(
        maxCameraX,
        currentUser.x * tileSize - actualWidth / 2 + tileSize / 2
      ));
      viewRef.current.y = Math.max(0, Math.min(
        maxCameraY,
        currentUser.y * tileSize - actualHeight / 2 + tileSize / 2
      ));
      cameraInitialized.current = true;
      dirtyRef.current = true;
    }
  }, [currentUser, viewportReady, actualWidth, actualHeight]);

  // Mouse drag handlers
  const setHoverTarget = (kind: MapHoverKind | null, id: string | null) => {
    const hover = hoverRef.current;
    if (hover.kind === kind && hover.id === id) return;
    hover.kind = kind;
    hover.id = id;
    dirtyRef.current = true;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX + viewRef.current.x, y: e.clientY + viewRef.current.y };
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    cursorScreenRef.current = { x: screenX, y: screenY };
    const view = viewRef.current;
    const cameraX = view.x;
    const cameraY = view.y;
    const { tileSize, effectiveZoom, maxCameraX, maxCameraY } = getViewMetrics();
    const playerRevealPoint = getPlayerScreenPoint(liveUserRef.current, Date.now(), view, tileSize);
    const isDragging = isDraggingRef.current;
    const mouseX = screenX + cameraX;
    const mouseY = screenY + cameraY;
    const tileX = Math.floor(mouseX / tileSize);
    const tileY = Math.floor(mouseY / tileSize);
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

    // Check if hovering over a POI (2x2 for campfire, 4x4 tiles or 8x8 for towns)
    const hoveredPOI = hoveredEnemy || hoveredDungeon || hoveredQuestNpc
      ? undefined
      : findPoiAtTile(poisData, tileX, tileY);

    let nextCursor: string;
    if (hoveredEnemy) {
      setHoverTarget('enemy', hoveredEnemy.id);
      nextCursor = currentUser?.x === hoveredEnemy.x && currentUser?.y === hoveredEnemy.y ? 'crosshair' : 'pointer';
    } else if (hoveredDungeon) {
      setHoverTarget('dungeon', hoveredDungeon.id);
      nextCursor = 'pointer';
    } else if (hoveredQuestNpc) {
      setHoverTarget('npc', hoveredQuestNpc.id);
      nextCursor = 'pointer';
    } else if (hoveredPOI) {
      setHoverTarget('poi', hoveredPOI.id);
      nextCursor = 'pointer';
    } else {
      setHoverTarget(null, null);
      nextCursor = isDragging ? 'grabbing' : 'grab';
    }
    if (canvas.style.cursor !== nextCursor) canvas.style.cursor = nextCursor;

    if (!isDragging) return;

    const dragDistance = Math.abs(e.clientX - dragOriginRef.current.x) + Math.abs(e.clientY - dragOriginRef.current.y);
    if (dragDistance > 4) {
      hasDraggedRef.current = true;
    }

    const newCameraX = Math.max(0, Math.min(
      maxCameraX,
      dragStartRef.current.x - e.clientX
    ));
    const newCameraY = Math.max(0, Math.min(
      maxCameraY,
      dragStartRef.current.y - e.clientY
    ));

    if (newCameraX !== view.x || newCameraY !== view.y) {
      view.x = newCameraX;
      view.y = newCameraY;
      dirtyRef.current = true;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setHoverTarget(null, null);
    cursorScreenRef.current = null;
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
    const view = viewRef.current;
    const cameraX = view.x;
    const cameraY = view.y;
    const { tileSize, effectiveZoom } = getViewMetrics();
    const mouseX = e.clientX - rect.left + cameraX;
    const mouseY = e.clientY - rect.top + cameraY;
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
    const playerRevealPoint = getPlayerScreenPoint(liveUserRef.current, Date.now(), view, tileSize);
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
      if (clickedQuestNpc.id === 'quest-npc-marshal-orren' && currentUser) {
        const marshalStory = getStoryQuestStatus(currentUser, 'story-03-lost-apprentice');
        if (marshalStory.unlocked && !marshalStory.complete) {
          completeMultiplayerTutorialCallout(currentUser.username, 'marshal-orren-contact');
        }
      }
      setSelectedQuestNpc(clickedQuestNpc);
      setPendingTravel(null);
      setSelectedDungeon(null);
      setSelectedPOI(null);
      setSelectedTown(null);
      setShowPlayerList(false);
      return;
    }

    // Check if clicking on a POI (2x2 for campfire, 4x4 tiles or 8x8 for towns)
    const clickedPOI = findPoiAtTile(poisData, tileX, tileY);

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
    const view = viewRef.current;
    const { effectiveZoom } = getViewMetrics();
    const anchorBaseX = (view.x + anchorScreenX) / effectiveZoom;
    const anchorBaseY = (view.y + anchorScreenY) / effectiveZoom;
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

    playGameSound('quest.claim', { throttleMs: 140 });
    if (result.rewards?.gold) playGameSound('inventory.goldGain', { throttleMs: 140 });
    if (result.rewards?.rareGems) playGameSound('inventory.gemGain', { throttleMs: 140 });

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

  const claimTrackedDailyReward = (questId: string): { success: boolean; error?: string } => {
    const quest = currentUser?.dailyQuests?.quests.find(item => item.id === questId);
    const result = claimQuestReward(questId);
    if (!result.success) {
      return { success: false, error: result.error || 'Could not claim daily reward.' };
    }

    playGameSound('quest.claim', { throttleMs: 140 });

    const rewards: RewardSummary = {
      equipment: result.rewards?.length ? result.rewards : undefined,
      minions: result.minions?.length ? result.minions : undefined,
    };
    emitCompletionNotice({
      id: `main-tracker-daily-${questId}-${Date.now()}`,
      kind: 'quest',
      kicker: 'Daily Objective',
      title: quest?.name || 'Daily Reward Claimed',
      description: quest?.description || 'The daily objective reward was claimed.',
      rewards: rewardSummaryToCompletionRewards(rewards),
      completedAt: Date.now(),
    });
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
          worldEnemies={worldEnemies}
          onTravel={requestTravelIntent}
          onInspectEnemy={(enemy) => {
            setSelectedEnemy(enemy);
            setSelectedPOI(null);
            setSelectedTown(null);
            setSelectedDungeon(null);
            setSelectedQuestNpc(null);
          }}
          onClaim={claimMainStoryReward}
          onClaimDaily={claimTrackedDailyReward}
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
        className="game-map-canvas cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onClick={handleClick}
      />

      {tutorialAnchorNpc && (
        // Positioned imperatively by the draw loop so camera moves don't re-render React.
        <span
          ref={tutorialAnchorRef}
          key={`tutorial-anchor-${tutorialAnchorNpc.id}`}
          data-multiplayer-tutorial-anchor="marshal-orren-contact"
          className="pointer-events-none absolute"
          aria-hidden="true"
        />
      )}

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
            if (selectedEnemy.requiredPlayerLevel && currentUser.stats.level < selectedEnemy.requiredPlayerLevel) return;
            if (selectedEnemy.spawnKind === 'coop-boss') {
              const prep = canPrepareCoopRaid(currentUser);
              if (!prep.ok) {
                window.alert(prep.reason);
                return;
              }
              if (prep.resumeBossId && prep.resumeBossId !== selectedEnemy.id) {
                window.alert('Finish your current co-op raid before preparing another incursion.');
                return;
              }
              void ensureCurrentCoopRaidSession(selectedEnemy.id).then(result => {
                if (!result.success) {
                  window.alert(result.error || 'Could not prepare this raid.');
                  return;
                }
                setSelectedEnemy(null);
              });
              return;
            }
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
      if (!sequence || !quest) return null;
      return (
        <StoryDialogOverlay
          key={sequence.id}
          sequence={sequence}
          playerModelNumber={currentUser.selectedModel || 3}
          initialLineIndex={getMultiplayerTutorialDialogueLine(currentUser.username, sequence.id)}
          initialChoiceId={getStoryQuestResponseChoiceId(currentUser, quest.id)}
          onLineChange={(lineIndex) => {
            saveMultiplayerTutorialDialogueLine(currentUser.username, sequence.id, lineIndex);
          }}
          onChoice={(choice) => {
            recordStoryQuestResponse(quest.id, choice.id);
            setCurrentUser(getCurrentUser());
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
    {unlockDialogId && currentUser && !storyDialogQuestId && (() => {
      const definition = getMultiplayerUnlockDialogue(unlockDialogId);
      if (!definition) return null;
      const sequence = definition.sequence;
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
            completeMultiplayerUnlockDialogue(currentUser.username, unlockDialogId);
            clearMultiplayerTutorialDialogue(currentUser.username, sequence.id);
            setUnlockDialogId(null);
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
    case 'inspect_enemy':
      return 'Inspect the named threat and read its scout rating.';
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
    case 'inspect_enemy':
      return 'Inspect the named threat scout report';
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
  worldEnemies,
  onTravel,
  onInspectEnemy,
  onClaim,
  onClaimDaily,
  onHide,
}: {
  currentUser: ReturnType<typeof getCurrentUser>;
  poisData: POI[];
  worldEnemies: WorldEnemy[];
  onTravel: (targetX: number, targetY: number, label: string, kind: TravelIntentKind) => void;
  onInspectEnemy: (enemy: WorldEnemy) => void;
  onClaim: (questId: string) => { success: boolean; error?: string };
  onClaimDaily: (questId: string) => { success: boolean; error?: string };
  onHide: () => void;
}) {
  const [claimError, setClaimError] = useState('');
  const [activeTab, setActiveTab] = useState<'story' | 'daily'>('story');
  const storyQuests = getAllStoryQuestsSorted();
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
  const targetQuestNpc = requirement.type === 'visit_quest_npc'
    ? QUEST_NPCS.find(npc => npc.id === requirement.questNpcId)
    : undefined;
  const targetEnemy = requirement.type === 'inspect_enemy'
    ? worldEnemies.find(enemy => enemy.id === requirement.enemyId)
    : requirement.type === 'defeat_boss'
      ? worldEnemies.find(enemy => enemy.bossId === requirement.bossId)
      : undefined;
  const progress = status.required > 0 ? Math.min(100, (status.progress / status.required) * 100) : 0;
  const actionPanel = requirement.type === 'complete_jobs' || requirement.type === 'complete_timed_jobs' ? 'jobs' : 'quests';
  const actionLabel = !status.unlocked
    ? `Level ${activeStory.requiredLevel}`
    : status.complete
      ? 'Claim'
      : targetPoi || targetQuestNpc
        ? currentUser.traveling ? 'Walking' : 'Travel'
        : targetEnemy
          ? 'Scout'
          : actionPanel === 'jobs' ? 'Jobs' : 'Quests';
  const targetKind: TravelIntentKind = targetPoi?.type === POIType.TOWN ? 'town' : 'poi';
  const objectiveLabel = status.complete
    ? 'Story reward ready to claim.'
    : getStoryRequirementLabel(activeStory);
  const activeCityQuests = (currentUser.cityQuests || [])
    .map(cityQuest => {
      const template = getCityQuestTemplate(cityQuest.questId);
      return template ? { template, status: getCityQuestStatus(currentUser, cityQuest.questId) } : null;
    })
    .filter((quest): quest is NonNullable<typeof quest> => Boolean(quest && !quest.status.claimed))
    .slice(0, 2);
  const dailyQuests = currentUser.dailyQuests?.quests || [];
  const readyDailyCount = dailyQuests.filter(quest => !quest.claimed && quest.progress >= quest.requirement.count).length;

  return (
    <CinematicScrollShell
      variant="compact"
      className="main-quest-tracker main-quest-guide pointer-events-auto fixed left-4 top-24 z-40 w-[min(27rem,calc(100vw-2rem))] text-zinc-100"
      contentClassName="main-quest-tracker-content p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="arcane-label">Road Ledger</div>
          <h3 className="fantasy-heading text-lg leading-tight">
            {activeTab === 'story' ? activeStory.name : 'Daily Objectives'}
          </h3>
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
      <div className="main-quest-tabs mt-3" role="tablist" aria-label="Quest tracker view">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'story'}
          onClick={() => {
            setClaimError('');
            setActiveTab('story');
          }}
          className={`main-quest-tab ${activeTab === 'story' ? 'main-quest-tab-active' : ''}`}
        >
          Story
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'daily'}
          onClick={() => {
            setClaimError('');
            setActiveTab('daily');
          }}
          className={`main-quest-tab ${activeTab === 'daily' ? 'main-quest-tab-active' : ''}`}
        >
          Daily {readyDailyCount > 0 ? `(${readyDailyCount})` : ''}
        </button>
      </div>

      {activeTab === 'story' ? (
        <div role="tabpanel">
          <button
            type="button"
            disabled={!status.unlocked || Boolean(currentUser.traveling && (targetPoi || targetQuestNpc))}
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

              if (targetQuestNpc) {
                onTravel(targetQuestNpc.x, targetQuestNpc.y, targetQuestNpc.name, 'quest');
                return;
              }

              if (targetEnemy) {
                onInspectEnemy(targetEnemy);
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
            <span>{targetPoi ? targetPoi.name : targetQuestNpc ? targetQuestNpc.name : targetEnemy ? targetEnemy.name : status.complete ? 'Ready' : actionPanel}</span>
          </div>
          {activeCityQuests.length > 0 && (
            <div className="main-quest-orders mt-3 border-t border-[rgba(232,217,184,0.16)] pt-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="arcane-label">City Contracts</span>
                <span className="ui-faint text-[10px] font-black">{activeCityQuests.length}</span>
              </div>
              {activeCityQuests.map(quest => (
                <button
                  key={quest.template.id}
                  type="button"
                  onClick={() => openCommandPanel('quests')}
                  className="main-quest-order-row"
                  title={`Open ${quest.template.name}`}
                >
                  <span>{quest.template.name}</span>
                  <strong>{quest.status.complete ? 'Ready' : `${quest.status.progress}/${quest.status.required}`}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="main-quest-daily-list mt-3" role="tabpanel">
          {dailyQuests.map(quest => {
            const complete = quest.progress >= quest.requirement.count;
            const rewardLabel = quest.rewards.guaranteedMinionTier
              ? `${quest.rewards.guaranteedMinionTier.replace('tier', 'Tier ')} recruit`
              : quest.rewards.randomSupply
                ? 'Supply cache'
                : `${quest.rewards.guaranteedItem} gear`;

            return (
              <article key={quest.id} className={`main-quest-daily-row ${quest.claimed ? 'main-quest-daily-row-claimed' : ''}`}>
                <div className="main-quest-daily-copy">
                  <strong>{quest.name}</strong>
                  <span>{quest.description}</span>
                  <small>{rewardLabel}</small>
                </div>
                <div className="main-quest-daily-action">
                  <span>{quest.progress}/{quest.requirement.count}</span>
                  {quest.claimed ? (
                    <b>Claimed</b>
                  ) : complete ? (
                    <button
                      type="button"
                      onClick={() => {
                        setClaimError('');
                        const result = onClaimDaily(quest.id);
                        if (!result.success) setClaimError(result.error || 'Could not claim daily reward.');
                      }}
                    >
                      Claim
                    </button>
                  ) : (
                    <button type="button" onClick={() => openCommandPanel('jobs')}>Jobs</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {claimError && <div className="mt-2 text-xs font-black text-red-100">{claimError}</div>}
    </CinematicScrollShell>
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
  const worldVoice = getQuestNpcWorldVoice(npc, user);
  const atNpc = Boolean(user && isTileInsideFootprint(user.x, user.y, npc.x, npc.y, 2, 2));
  const [showConversation, setShowConversation] = useState(atNpc);
  const returnStory = getAllStoryQuestsSorted().find(story => (
    story.requirement.type === 'visit_quest_npc'
    && story.requirement.afterQuestId
    && story.requirement.questNpcId === npc.id
    && getStoryQuestStatus(user, story.id).unlocked
    && !getStoryQuestStatus(user, story.id).claimed
  ));
  const authoredReturnConversation = getStoryDialogSequence(returnStory?.dialogId);
  const conversation: StoryDialogSequence = authoredReturnConversation || {
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
      { speaker: 'npc', text: worldVoice.line },
      { speaker: 'player', text: 'What do you ask of my banner?' },
      { speaker: 'npc', text: `${worldVoice.questHook} Prove your command, then return for counsel.` },
    ],
  };

  const handleClaimCounsel = () => {
    if (!atNpc) {
      setNotice('Walk to this contact before claiming counsel.');
      return;
    }

    const result = claimQuestNpcReward(npc.id);
    setNotice(result.success ? 'Counsel reward claimed.' : result.error || 'Could not claim counsel.');
    setUser(getCurrentUser());
    if (result.success) {
      playGameSound('quest.claim', { throttleMs: 140 });
      if (result.rewards?.gold) playGameSound('inventory.goldGain', { throttleMs: 140 });
      if (result.rewards?.rareGems) playGameSound('inventory.gemGain', { throttleMs: 140 });
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
        initialChoiceId={returnStory ? getStoryQuestResponseChoiceId(user, returnStory.id) : undefined}
        onChoice={(choice) => {
          if (!returnStory) return;
          recordStoryQuestResponse(returnStory.id, choice.id);
          setUser(getCurrentUser());
        }}
        onComplete={() => {
          recordQuestNpcVisit(npc.id);
          if (returnStory) markStoryQuestIntroSeen(returnStory.id);
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
          <p className="text-sm font-bold text-zinc-100">&ldquo;{worldVoice.line}&rdquo;</p>
          <div className="ui-card rounded border p-3 text-xs font-bold text-yellow-100">
            {worldVoice.questHook}
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
  const requiredPlayerLevel = enemy.requiredPlayerLevel || 1;
  const battleLevelLocked = Boolean(currentUser && currentUser.stats.level < requiredPlayerLevel);

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
              {enemy.spawnKind === 'story-boss' && (
                <div className="ui-rarity-legendary mt-1 inline-flex rounded border px-2 py-1 text-[10px] font-black uppercase">
                  {enemy.storyLabel || 'Story Encounter'}
                </div>
              )}
              {enemy.spawnKind === 'regional-threat' && (
                <div className="ui-rarity-epic mt-1 inline-flex rounded border px-2 py-1 text-[10px] font-black uppercase">
                  Regional Threat Boss
                </div>
              )}
              {enemy.spawnKind === 'coop-boss' && (
                <div className="ui-rarity-legendary mt-1 inline-flex rounded border px-2 py-1 text-[10px] font-black uppercase">
                  Duo Raid
                </div>
              )}
              <p className="ui-muted mt-1 text-sm font-bold">
                {enemy.story || preview?.summary || 'Scout data unavailable.'}
              </p>
              {preview && (
                <button
                  type="button"
                  data-multiplayer-tutorial-anchor="enemy-risk"
                  onClick={() => {
                    completeMultiplayerTutorialCallout(currentUser?.username, 'enemy-risk');
                    recordCurrentMultiplayerEngagementEvent({
                      id: `enemy-inspected:${enemy.id}`,
                      kind: 'enemy-inspected',
                      contextId: enemy.spawnRegionId || 'world-map',
                      targetId: enemy.id,
                    });
                  }}
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
              {enemy.spawnKind === 'coop-boss'
                ? 'Duo raid: two commanders confirm formation, then fight a four-phase synchronized boss.'
                : `${routeBattles} fight${routeBattles === 1 ? '' : 's'} total. The marked enemy is the final boss; shops and omens may appear between fights on longer roads.`}
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
            onClick={battleLevelLocked ? undefined : canStart ? onStart : onTravel}
            disabled={!currentUser || battleLevelLocked || Boolean(currentUser.traveling && !canStart)}
            className="ui-button-primary w-full rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            {battleLevelLocked
              ? `Battle unlocks at level ${requiredPlayerLevel}`
              : canStart
                ? (enemy.spawnKind === 'coop-boss' ? 'Prepare Raid' : 'Start Road')
                : currentUser?.traveling
                  ? (enemy.spawnKind === 'coop-boss' ? 'Walking to Raid' : 'Walking to Enemy')
                  : (enemy.spawnKind === 'coop-boss' ? 'Walk to Raid' : 'Walk Here')}
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
  const dungeonTier = dungeon.tier || getDungeonTier(dungeon.level);
  const dungeonTierLabel = formatDungeonTier(dungeonTier);
  const requiredPlayerLevel = dungeon.requiredPlayerLevel || getDungeonRequiredPlayerLevel(dungeon.level);
  const unlockFeature: MultiplayerFeatureId = dungeonTier === 3
    ? 'dungeon-tier-iii'
    : dungeonTier === 2
      ? 'dungeon-tier-ii'
      : 'dungeon-preview';
  const dungeonUnlock = getMultiplayerUnlockStatus(unlockFeature, currentUser);
  const atDungeon = Boolean(currentUser && isTileInsideFootprint(currentUser.x, currentUser.y, dungeon.x, dungeon.y, 3, 3));
  const canEnter = dungeonUnlock.unlocked && atDungeon && fieldedCount >= requiredMinions;

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
            <DungeonPill label="Tier" value={`${dungeonTierLabel} - Lv ${dungeon.level}`} />
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
            <DungeonPill label="Entry" value={dungeonUnlock.unlocked ? `${fieldedCount} fielded` : `Level ${requiredPlayerLevel}`} />
          </div>
          <button
            onClick={!atDungeon ? onTravel : onEnter}
            disabled={!currentUser || !dungeonUnlock.unlocked || Boolean(currentUser.traveling && !atDungeon) || (atDungeon && !canEnter)}
            className="ui-button-primary w-full rounded px-4 py-3 text-sm font-black disabled:opacity-40"
          >
            {!dungeonUnlock.unlocked
              ? `Tier ${dungeonTierLabel} unlocks at level ${requiredPlayerLevel}`
              : !atDungeon
                ? currentUser?.traveling ? 'Walking Here' : 'Walk Here'
                : canEnter ? 'Enter Dungeon Run' : 'More Units Needed'}
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
