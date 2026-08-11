import type { CharacterStats, MinionClass, MinionStack, MinionStats, MinionTemplate } from '@/lib/auth';
import { getMinionTemplate } from '@/lib/auth';
import type { BattleCombatTraits, PlayerModelNumber } from '@/lib/battle';

export type RunCommanderSpecialId = 'bleed-on-hit' | 'sustain-on-kill' | 'quick-step';

export interface RunCommanderUnitFocus {
  label: string;
  summary: string;
  class?: MinionClass;
  roleKeywords?: string[];
  statBonus: Partial<Pick<MinionStats, 'attack' | 'defense' | 'magic' | 'healing' | 'health' | 'movement' | 'range'>>;
}

export interface RunCommanderProfile {
  model: PlayerModelNumber;
  label: string;
  title: string;
  description: string;
  passiveName: string;
  passiveSummary: string;
  specialId?: RunCommanderSpecialId;
  specialName?: string;
  specialSummary?: string;
  statBonus: Partial<Pick<CharacterStats, 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth' | 'health'>>;
  unitFocus: RunCommanderUnitFocus;
}

export const RUN_COMMANDER_PROFILES: RunCommanderProfile[] = [
  {
    model: 1,
    label: 'Templar',
    title: 'Iron Marshal',
    description: 'Best for shielded warbands and knight-heavy drafts.',
    passiveName: 'Shield Oath',
    passiveSummary: '+1 army ward, +10 commander health, and templars gain ward and health.',
    statBonus: { defensivePower: 1, maxHealth: 10, health: 10 },
    unitFocus: {
      label: 'Templar Line',
      summary: 'Templars gain +2 ward and +6 health.',
      class: 'templar',
      statBonus: { defense: 2, health: 6 },
    },
  },
  {
    model: 2,
    label: 'Arcanist',
    title: 'Moon Arcanist',
    description: 'Best for spell pressure and commander damage.',
    passiveName: 'Moon Channel',
    passiveSummary: '+2 spell power, and wizards gain stronger magic.',
    statBonus: { spellPower: 2 },
    unitFocus: {
      label: 'Wizard Circle',
      summary: 'Wizards gain +2 magic.',
      class: 'wizard',
      statBonus: { magic: 2 },
    },
  },
  {
    model: 3,
    label: 'Prior',
    title: 'Candle Prior',
    description: 'Best for defensive healer-centered runs.',
    passiveName: 'Candle Discipline',
    passiveSummary: '+1 ward, +1 morale, +6 commander health, and priests heal better.',
    specialId: 'sustain-on-kill',
    specialName: 'Candle Sustain',
    specialSummary: 'Commander restores 8 health after defeating an enemy.',
    statBonus: { defensivePower: 1, morale: 1, maxHealth: 6, health: 6 },
    unitFocus: {
      label: 'Priest Choir',
      summary: 'Priests gain +2 healing and +4 health.',
      class: 'priest',
      statBonus: { healing: 2, health: 4 },
    },
  },
  {
    model: 4,
    label: 'Vanguard',
    title: 'Blood Vanguard',
    description: 'Best for aggressive melee drafts.',
    passiveName: 'Red Advance',
    passiveSummary: '+2 army damage, and knight frontliners hit harder.',
    specialId: 'bleed-on-hit',
    specialName: 'Blood Openings',
    specialSummary: 'Commander attacks apply bleed to living targets.',
    statBonus: { armyPower: 2 },
    unitFocus: {
      label: 'Knight Charge',
      summary: 'Knights gain +2 attack.',
      class: 'knight',
      statBonus: { attack: 2 },
    },
  },
  {
    model: 5,
    label: 'Duelist',
    title: 'Road Duelist',
    description: 'Best for fast turns and skirmisher-heavy drafts.',
    passiveName: 'Quick March',
    passiveSummary: '+1 morale, +1 army damage, and skirmishers move faster.',
    specialId: 'quick-step',
    specialName: 'Road Step',
    specialSummary: 'Commander gains +1 movement each battle.',
    statBonus: { morale: 1, armyPower: 1 },
    unitFocus: {
      label: 'Skirmisher Steps',
      summary: 'Assassins and skirmishers gain +1 movement and +1 attack.',
      roleKeywords: ['assassin', 'skirmisher', 'wing-step'],
      statBonus: { movement: 1, attack: 1 },
    },
  },
  {
    model: 6,
    label: 'Warden',
    title: 'Grave Warden',
    description: 'Best for durable mixed warbands.',
    passiveName: 'Grave Hold',
    passiveSummary: '+1 damage, +1 ward, +8 commander health, and guards hold longer.',
    statBonus: { armyPower: 1, defensivePower: 1, maxHealth: 8, health: 8 },
    unitFocus: {
      label: 'Grave Guard',
      summary: 'Guard and tank units gain +1 ward and +5 health.',
      roleKeywords: ['guard', 'tank', 'fighter'],
      statBonus: { defense: 1, health: 5 },
    },
  },
];

export function getRunCommanderProfile(model: number | undefined): RunCommanderProfile {
  return RUN_COMMANDER_PROFILES.find(profile => profile.model === model) || RUN_COMMANDER_PROFILES[2];
}

export function getRunCommanderCombatTraits(profile: RunCommanderProfile): BattleCombatTraits {
  switch (profile.specialId) {
    case 'bleed-on-hit':
      return { bleedOnHit: true };
    case 'sustain-on-kill':
      return { sustainHealOnKill: 8 };
    case 'quick-step':
      return { moveBonus: 1 };
    default:
      return {};
  }
}

export function mergeBattleCombatTraits(
  ...traitsList: Array<BattleCombatTraits | undefined>
): BattleCombatTraits {
  return traitsList.reduce<BattleCombatTraits>((merged, traits) => {
    if (!traits) return merged;
    return {
      bleedOnHit: Boolean(merged.bleedOnHit || traits.bleedOnHit),
      sustainHealOnKill: Math.max(merged.sustainHealOnKill || 0, traits.sustainHealOnKill || 0) || undefined,
      moveBonus: (merged.moveBonus || 0) + (traits.moveBonus || 0) || undefined,
    };
  }, {});
}

export function applyRunCommanderProfileStats(stats: CharacterStats, profile: RunCommanderProfile): CharacterStats {
  const maxHealth = stats.maxHealth + (profile.statBonus.maxHealth || 0);
  return {
    ...stats,
    armyPower: stats.armyPower + (profile.statBonus.armyPower || 0),
    defensivePower: stats.defensivePower + (profile.statBonus.defensivePower || 0),
    morale: stats.morale + (profile.statBonus.morale || 0),
    spellPower: stats.spellPower + (profile.statBonus.spellPower || 0),
    maxHealth,
    health: Math.min(maxHealth, stats.health + (profile.statBonus.maxHealth || 0) + (profile.statBonus.health || 0)),
  };
}

export function doesCommanderUnitFocusApply(template: MinionTemplate, focus: RunCommanderUnitFocus): boolean {
  if (focus.class && template.class === focus.class) return true;
  if (focus.roleKeywords?.some(keyword => template.role.toLowerCase().includes(keyword))) return true;
  return false;
}

export function applyRunCommanderUnitBonusToStack(stack: MinionStack, profile: RunCommanderProfile): MinionStack {
  const template = getMinionTemplate(stack.templateId);
  if (!template || !doesCommanderUnitFocusApply(template, profile.unitFocus)) {
    const { runStatBonus: _runStatBonus, runBonusLabel: _runBonusLabel, ...cleanStack } = stack;
    void _runStatBonus;
    void _runBonusLabel;
    return cleanStack;
  }

  return {
    ...stack,
    runStatBonus: profile.unitFocus.statBonus,
    runBonusLabel: profile.unitFocus.label,
  };
}

export function pickRunCommanderDraftChoices(count = 4): RunCommanderProfile[] {
  const shuffled = [...RUN_COMMANDER_PROFILES];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = temp;
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
