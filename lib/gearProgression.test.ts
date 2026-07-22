import { describe, expect, it } from 'vitest';
import {
  capEquipmentRarityForLevel,
  getHighestJobEquipmentRarity,
  getJobEquipmentDropChance,
  rollJobEquipmentRarity,
} from './gearProgression';
import { getLootEquipmentDropChance, rollLootEquipmentRarity } from './lootTables';

const MINUTE = 60 * 1000;

describe('multiplayer equipment progression', () => {
  it('gates random job gear until level three and favors long work', () => {
    expect(getJobEquipmentDropChance(MINUTE, 2)).toBe(0);
    expect(getJobEquipmentDropChance(MINUTE, 3)).toBe(1.5);
    expect(getJobEquipmentDropChance(10 * MINUTE, 3)).toBe(4);
    expect(getJobEquipmentDropChance(30 * MINUTE, 3)).toBe(8);
    expect(getJobEquipmentDropChance(60 * MINUTE, 3)).toBe(14);
  });

  it('uses level three, five, ten, and fifteen as rarity gates', () => {
    expect(capEquipmentRarityForLevel('decent', 2)).toBeNull();
    expect(capEquipmentRarityForLevel('decent', 3)).toBe('decent');
    expect(capEquipmentRarityForLevel('legendary', 3)).toBe('decent');
    expect(capEquipmentRarityForLevel('legendary', 5)).toBe('rare');
    expect(capEquipmentRarityForLevel('legendary', 10)).toBe('epic');
    expect(capEquipmentRarityForLevel('legendary', 15)).toBe('legendary');
    expect(getHighestJobEquipmentRarity(60 * MINUTE, 10)).toBe('epic');
  });

  it('requires a successful drop roll before rolling job rarity', () => {
    expect(rollJobEquipmentRarity(60 * MINUTE, 15, 0, 0.14, 0)).toBeNull();
    expect(rollJobEquipmentRarity(60 * MINUTE, 15, 0, 0.139, 0.004)).toBe('legendary');
    expect(rollJobEquipmentRarity(60 * MINUTE, 10, 0, 0, 0)).toBe('epic');
  });

  it('uses separate drop and rarity rolls for combat loot', () => {
    expect(getLootEquipmentDropChance('battle')).toBe(10);
    expect(rollLootEquipmentRarity('battle', 15, 0, 0.1, 0)).toBeNull();
    expect(rollLootEquipmentRarity('battle', 5, 0, 0.099, 0)).toBe('rare');
    expect(rollLootEquipmentRarity('dungeon-boss', 10, 0, 0, 0)).toBe('epic');
    expect(rollLootEquipmentRarity('dungeon-boss', 15, 0, 0, 0)).toBe('legendary');
  });
});
