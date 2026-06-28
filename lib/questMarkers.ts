import type { User } from './auth';
import {
  getAllStoryQuestsSorted,
  getCityQuestTemplate,
  getQuestNpcById,
  type QuestRequirementSpec,
  type StoryQuestTemplate,
} from './questData';
import { getStaticPOIs } from './mapData';
import { getCityQuestStatus, getStoryQuestStatus } from './auth';

export type QuestObjectiveMarkerKind = 'poi' | 'quest_npc' | 'dungeon';

export interface QuestObjectiveMarker {
  id: string;
  kind: QuestObjectiveMarkerKind;
  label: string;
  x: number;
  y: number;
  poiName?: string;
  questNpcId?: string;
}

function pushPoiMarker(
  markers: QuestObjectiveMarker[],
  requirement: QuestRequirementSpec,
  label: string,
  idPrefix: string,
): void {
  const poi = getStaticPOIs().find(item => (
    (requirement.poiId && item.id === requirement.poiId) ||
    (requirement.poiName && item.name.toLowerCase() === requirement.poiName.toLowerCase())
  ));
  if (!poi) return;

  markers.push({
    id: `${idPrefix}-poi-${poi.id}`,
    kind: 'poi',
    label,
    x: poi.x + 2,
    y: poi.y + 1,
    poiName: poi.name,
  });
}

function pushQuestNpcMarker(
  markers: QuestObjectiveMarker[],
  questNpcId: string | undefined,
  label: string,
  idPrefix: string,
): void {
  const npc = questNpcId ? getQuestNpcById(questNpcId) : undefined;
  if (!npc) return;

  markers.push({
    id: `${idPrefix}-npc-${npc.id}`,
    kind: 'quest_npc',
    label,
    x: npc.x,
    y: npc.y,
    questNpcId: npc.id,
  });
}

function addStoryObjectiveMarkers(
  markers: QuestObjectiveMarker[],
  story: StoryQuestTemplate,
): void {
  const requirement = story.requirement;

  switch (requirement.type) {
    case 'visit_poi':
    case 'complete_jobs_at_poi':
      pushPoiMarker(markers, requirement, story.name, story.id);
      break;
    case 'visit_quest_npc':
      pushQuestNpcMarker(markers, requirement.questNpcId, story.name, story.id);
      break;
    case 'clear_dungeons':
      markers.push({
        id: `${story.id}-dungeon`,
        kind: 'dungeon',
        label: story.name,
        x: 0,
        y: 0,
      });
      break;
    default:
      break;
  }
}

function addCityObjectiveMarkers(
  markers: QuestObjectiveMarker[],
  questId: string,
  name: string,
  requirement: QuestRequirementSpec,
): void {
  switch (requirement.type) {
    case 'visit_poi':
    case 'complete_jobs_at_poi':
      pushPoiMarker(markers, requirement, name, questId);
      break;
    case 'visit_quest_npc':
      pushQuestNpcMarker(markers, requirement.questNpcId, name, questId);
      break;
    case 'clear_dungeons':
      markers.push({
        id: `${questId}-dungeon`,
        kind: 'dungeon',
        label: name,
        x: 0,
        y: 0,
      });
      break;
    default:
      break;
  }
}

export function getQuestObjectiveMarkers(user: User | null | undefined): QuestObjectiveMarker[] {
  if (!user) return [];

  const markers: QuestObjectiveMarker[] = [];
  const seen = new Set<string>();

  const activeStory = getAllStoryQuestsSorted().find(story => {
    const status = getStoryQuestStatus(user, story.id);
    return status.unlocked && !status.claimed && !status.complete;
  });

  if (activeStory) {
    addStoryObjectiveMarkers(markers, activeStory);
  }

  (user.cityQuests || []).forEach(progress => {
    if (progress.claimed) return;
    const template = getCityQuestTemplate(progress.questId);
    if (!template) return;
    const status = getCityQuestStatus(user, progress.questId);
    if (status.complete) return;
    addCityObjectiveMarkers(markers, template.id, template.name, template.requirement);
  });

  return markers.filter(marker => {
    if (seen.has(marker.id)) return false;
    seen.add(marker.id);
    return true;
  });
}

export function isQuestNpcObjective(user: User | null | undefined, npcId: string): boolean {
  return getQuestObjectiveMarkers(user).some(marker => marker.kind === 'quest_npc' && marker.questNpcId === npcId);
}

export function isPoiQuestObjective(user: User | null | undefined, poiName: string): boolean {
  return getQuestObjectiveMarkers(user).some(marker => (
    marker.kind === 'poi' && marker.poiName?.toLowerCase() === poiName.toLowerCase()
  ));
}

export function isDungeonQuestObjective(user: User | null | undefined): boolean {
  return getQuestObjectiveMarkers(user).some(marker => marker.kind === 'dungeon');
}
