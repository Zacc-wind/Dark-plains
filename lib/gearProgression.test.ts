import { describe, expect, it } from 'vitest';
import {
  applyLuckyNameSuffix,
  buildRolledEquipmentStats,
  capEquipmentRarityForLevel,
  EQUIPMENT_FINE_QUALITY_THRESHOLD,
  EQUIPMENT_LUCKY_DROP_CHANCE,
  EQUIPMENT_LUCKY_ROLL_MIN,
  EQUIPMENT_ROLL_MAX,
  EQUIPMENT_ROLL_MIN,
  formatEquipmentQualityLabel,
  getHighestJobEquipmentRarity,
  getJobEquipmentDropChance,
  rollEquipmentAffix,
  rollJobEquipmentRarity,
  scaleEquipmentStat,
} from './gearProgression';
import { GEAR_SETS } from './gearSets';
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

describe('equipment roll variance and lucky affixes', () => {
  it('rolls normal items in the 85-115% band and Fine above threshold', () => {
    const low = rollEquipmentAffix(0.5, 0);
    expect(low.isLucky).toBe(false);
    expect(low.rollMultiplier).toBe(EQUIPMENT_ROLL_MIN);
    expect(low.qualityLabel).toBeUndefined();

    const high = rollEquipmentAffix(0.5, 1);
    expect(high.isLucky).toBe(false);
    expect(high.rollMultiplier).toBe(EQUIPMENT_ROLL_MAX);
    expect(high.qualityLabel).toBe('Fine');

    const fineEdge = rollEquipmentAffix(
      0.5,
      (EQUIPMENT_FINE_QUALITY_THRESHOLD - EQUIPMENT_ROLL_MIN) / (EQUIPMENT_ROLL_MAX - EQUIPMENT_ROLL_MIN),
    );
    expect(fineEdge.qualityLabel).toBe('Fine');
  });

  it('marks ~2% lucky drops with a raised floor and Lucky+ label', () => {
    expect(EQUIPMENT_LUCKY_DROP_CHANCE).toBe(0.02);
    const lucky = rollEquipmentAffix(0.019, 0);
    expect(lucky.isLucky).toBe(true);
    expect(lucky.qualityLabel).toBe('Lucky+');
    expect(lucky.rollMultiplier).toBe(EQUIPMENT_LUCKY_ROLL_MIN);
    expect(applyLuckyNameSuffix('Rare Sword', true)).toBe('Rare Sword+');
    expect(applyLuckyNameSuffix('Rare Sword+', true)).toBe('Rare Sword+');
  });

  it('scales persisted stats from rarity base rolls', () => {
    expect(scaleEquipmentStat(10, 0.85)).toBe(9);
    expect(scaleEquipmentStat(10, 1.15)).toBe(12);
    const stats = buildRolledEquipmentStats('epic', 'sword', 1.1, () => 0);
    expect(stats.armyPower).toBe(scaleEquipmentStat(6, 1.1));
  });

  it('derives quality labels from persisted equipment fields', () => {
    expect(formatEquipmentQualityLabel({ isLucky: true })).toBe('Lucky+');
    expect(formatEquipmentQualityLabel({ rollMultiplier: 1.08 })).toBe('Fine');
    expect(formatEquipmentQualityLabel({ rollMultiplier: 0.9 })).toBeUndefined();
  });

  it('includes the two new gear sets with 2/4 bonuses', () => {
    expect(GEAR_SETS.map(set => set.id)).toEqual(expect.arrayContaining(['ironbound', 'ember-rite']));
    const ironbound = GEAR_SETS.find(set => set.id === 'ironbound');
    const ember = GEAR_SETS.find(set => set.id === 'ember-rite');
    expect(ironbound?.bonuses.map(bonus => bonus.pieces)).toEqual([2, 4]);
    expect(ember?.bonuses.map(bonus => bonus.pieces)).toEqual([2, 4]);
    expect(ironbound?.dropSources.length).toBeGreaterThan(0);
    expect(ember?.dropSources.length).toBeGreaterThan(0);
  });
});
