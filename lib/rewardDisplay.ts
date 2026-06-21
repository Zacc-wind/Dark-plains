import { ASSET_PATHS } from '@/lib/assetLoader';
import {
  EquipmentRarity,
  getInventoryItemDefinition,
  InventoryItem,
  JobRewardPreview,
  MinionTier,
  MINION_TIER_LABELS,
} from '@/lib/auth';
import { QuestRewardSpec } from '@/lib/questData';
import { getSpellIconPath } from '@/lib/spellAssets';
import { BATTLE_SPELLS } from '@/lib/battle';

const EQUIPMENT_ICON_BASE = '/assets/equipment';

export interface RewardChip {
  id: string;
  iconPath: string;
  quantity?: number | string;
  title: string;
  meta?: string;
  description?: string;
  rarityClass?: string;
}

export function getRewardRarityClass(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return 'ui-rarity-legendary';
    case 'epic':
      return 'ui-rarity-epic';
    case 'rare':
      return 'ui-rarity-rare';
    case 'decent':
      return 'ui-rarity-decent';
    case 'common':
      return 'ui-rarity-decent';
    default:
      return 'ui-rarity-decent';
  }
}

export function getMinionTierRarityClass(tier: MinionTier): string {
  switch (tier) {
    case 'tier3':
      return 'ui-rarity-legendary';
    case 'tier2':
      return 'ui-rarity-rare';
    case 'tier1':
      return 'ui-rarity-decent';
    default:
      return 'ui-rarity-decent';
  }
}

function getEquipmentPreviewIconPath(rarity: EquipmentRarity, slot = 'sword'): string {
  return `${EQUIPMENT_ICON_BASE}/${slot}-${rarity}.png`;
}

function getInventoryChip(item: InventoryItem): RewardChip {
  const definition = getInventoryItemDefinition(item.id);
  const rarity = definition?.rarity || item.rarity || 'common';

  return {
    id: `item-${item.id}`,
    iconPath: item.imagePath || definition?.imagePath || ASSET_PATHS.icons.lootChest,
    quantity: item.quantity > 1 ? item.quantity : undefined,
    title: definition?.name || item.name,
    meta: definition?.kind ? definition.kind.replace('_', ' ') : 'Item',
    description: definition?.description || item.description || 'Guaranteed job reward.',
    rarityClass: getRewardRarityClass(rarity),
  };
}

export function buildJobRewardChips(
  reward: JobRewardPreview
): RewardChip[] {
  const chips: RewardChip[] = [];

  if (reward.gold > 0) {
    chips.push({
      id: 'gold',
      iconPath: ASSET_PATHS.icons.gold,
      quantity: reward.gold,
      title: 'Gold',
      meta: 'Currency',
      description: 'Paid when the job finishes.',
    });
  }

  if (reward.healthRestore) {
    chips.push({
      id: 'health',
      iconPath: ASSET_PATHS.icons.health,
      quantity: reward.healthRestore,
      title: 'Health Restore',
      meta: 'Camp rest',
      description: 'Commander health restored on completion.',
    });
  }

  if (reward.exp > 0) {
    chips.push({
      id: 'exp',
      iconPath: ASSET_PATHS.icons.xp,
      quantity: reward.exp,
      title: 'Experience',
      meta: 'Commander XP',
      description: 'Experience gained when the job completes.',
    });
  }

  if (reward.rareGems) {
    chips.push({
      id: 'gems',
      iconPath: ASSET_PATHS.icons.rareGem,
      quantity: reward.rareGems,
      title: 'Rare Gems',
      meta: 'Relic currency',
      description: 'Used for inventory upgrades and town trades.',
      rarityClass: 'ui-rarity-rare',
    });
  }

  reward.items?.forEach(item => {
    chips.push(getInventoryChip(item));
  });

  if (reward.equipmentRarity) {
    chips.push({
      id: `gear-${reward.equipmentRarity}`,
      iconPath: getEquipmentPreviewIconPath(reward.equipmentRarity),
      title: `${reward.equipmentRarity.charAt(0).toUpperCase()}${reward.equipmentRarity.slice(1)} Gear`,
      meta: 'Equipment drop',
      description: 'A guaranteed equipment piece of this rarity.',
      rarityClass: getRewardRarityClass(reward.equipmentRarity),
    });
  }

  if (reward.minionTier) {
    chips.push({
      id: `minion-${reward.minionTier}`,
      iconPath: ASSET_PATHS.icons.attack,
      title: `${MINION_TIER_LABELS[reward.minionTier]} Recruit`,
      meta: 'Warband unit',
      description: 'A guaranteed minion recruit joins your warband.',
      rarityClass: getMinionTierRarityClass(reward.minionTier),
    });
  }

  return chips;
}

export function buildQuestRewardChips(
  reward: QuestRewardSpec,
  options?: { formatExp?: (value: number) => number }
): RewardChip[] {
  const chips: RewardChip[] = [];
  const formatExp = options?.formatExp || ((value: number) => value);

  if (reward.gold) {
    chips.push({
      id: 'gold',
      iconPath: ASSET_PATHS.icons.gold,
      quantity: reward.gold,
      title: 'Gold',
      meta: 'Quest payout',
      description: 'Gold awarded when you claim this contract.',
    });
  }

  if (reward.healthRestore) {
    chips.push({
      id: 'health',
      iconPath: ASSET_PATHS.icons.health,
      quantity: reward.healthRestore,
      title: 'Health Restore',
      meta: 'Quest payout',
      description: 'Commander health restored on claim.',
    });
  }

  if (reward.exp) {
    chips.push({
      id: 'exp',
      iconPath: ASSET_PATHS.icons.xp,
      quantity: formatExp(reward.exp),
      title: 'Experience',
      meta: 'Quest payout',
      description: 'Experience gained when you claim this contract.',
    });
  }

  if (reward.rareGems) {
    chips.push({
      id: 'gems',
      iconPath: ASSET_PATHS.icons.rareGem,
      quantity: reward.rareGems,
      title: 'Rare Gems',
      meta: 'Quest payout',
      description: 'Relic gems added to your satchel.',
      rarityClass: 'ui-rarity-rare',
    });
  }

  if (reward.equipmentRarity) {
    chips.push({
      id: `gear-${reward.equipmentRarity}`,
      iconPath: getEquipmentPreviewIconPath(reward.equipmentRarity),
      title: `${reward.equipmentRarity.charAt(0).toUpperCase()}${reward.equipmentRarity.slice(1)} Gear`,
      meta: 'Quest payout',
      description: 'Equipment rewarded when you claim this contract.',
      rarityClass: getRewardRarityClass(reward.equipmentRarity),
    });
  }

  if (reward.minionTier) {
    chips.push({
      id: `minion-${reward.minionTier}`,
      iconPath: ASSET_PATHS.icons.attack,
      title: `${MINION_TIER_LABELS[reward.minionTier]} Recruit`,
      meta: 'Quest payout',
      description: 'A minion recruit joins your warband on claim.',
      rarityClass: getMinionTierRarityClass(reward.minionTier),
    });
  }

  reward.spellIds?.forEach(spellId => {
    const spell = BATTLE_SPELLS.find(entry => entry.id === spellId);
    chips.push({
      id: `spell-${spellId}`,
      iconPath: getSpellIconPath({ id: spellId }),
      title: spell?.name || spellId,
      meta: spell?.rarity || 'Spell',
      description: spell?.description || 'Spell unlocked when you claim this contract.',
      rarityClass: spell ? getRewardRarityClass(spell.rarity) : 'ui-rarity-rare',
    });
  });

  if (reward.spellChestChance) {
    chips.push({
      id: 'spell-chest',
      iconPath: ASSET_PATHS.icons.lootChest,
      quantity: `${Math.round(reward.spellChestChance * 100)}%`,
      title: 'Spell Cache Chance',
      meta: 'Bonus reward',
      description: 'Chance to receive a sealed spell cache when claiming.',
      rarityClass: 'ui-rarity-epic',
    });
  }

  return chips;
}
