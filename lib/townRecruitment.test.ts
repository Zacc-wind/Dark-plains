import { describe, expect, it } from 'vitest';
import {
  getTownRecruitmentSlots,
  getTownRecruitmentWeekKey,
  normalizeTownRecruitmentClaims,
} from './townRecruitment';

const WEEK_ONE = Date.UTC(2026, 6, 20, 12);
const WEEK_TWO = WEEK_ONE + 7 * 24 * 60 * 60 * 1000;

describe('weekly town recruitment', () => {
  it('keeps the same offer throughout a UTC week and rotates its id next week', () => {
    const monday = getTownRecruitmentSlots('Ashford', 1, [], WEEK_ONE)[0];
    const sunday = getTownRecruitmentSlots('Ashford', 1, [], WEEK_ONE + 6 * 24 * 60 * 60 * 1000)[0];
    const nextWeek = getTownRecruitmentSlots('Ashford', 1, [], WEEK_TWO)[0];

    expect(sunday).toMatchObject({ offerId: monday.offerId, templateId: monday.templateId, price: monday.price });
    expect(nextWeek.offerId).not.toBe(monday.offerId);
    expect(getTownRecruitmentWeekKey(WEEK_ONE)).not.toBe(getTownRecruitmentWeekKey(WEEK_TWO));
  });

  it('gives every town one Tier I slot and only specialist markets a Tier II slot', () => {
    expect(getTownRecruitmentSlots('Ashford', 30, [], WEEK_ONE).map(slot => slot.tier)).toEqual(['tier1']);
    expect(getTownRecruitmentSlots('Harborview', 30, [], WEEK_ONE).map(slot => slot.tier)).toEqual(['tier1', 'tier2']);
    expect(getTownRecruitmentSlots('Riverside', 30, [], WEEK_ONE).map(slot => slot.tier)).toEqual(['tier1', 'tier2']);
  });

  it('unlocks Tier II specialists at commander level four', () => {
    const lockedSpecialist = getTownRecruitmentSlots('Harborview', 3, [], WEEK_ONE)[1];
    const unlockedSpecialist = getTownRecruitmentSlots('Harborview', 4, [], WEEK_ONE)[1];
    expect(lockedSpecialist).toMatchObject({ tier: 'tier2', minLevel: 4, unlocked: false, claimed: false });
    expect(unlockedSpecialist).toMatchObject({ tier: 'tier2', minLevel: 4, unlocked: true, claimed: false });
  });

  it('marks a claimed weekly offer and removes duplicate claim receipts', () => {
    const offer = getTownRecruitmentSlots('Moonbridge', 3, [], WEEK_ONE)[0];
    const claim = {
      offerId: offer.offerId,
      weekKey: offer.weekKey,
      townName: offer.townName,
      templateId: offer.templateId,
      claimedAt: WEEK_ONE + 1000,
    };
    const normalized = normalizeTownRecruitmentClaims([claim, { ...claim, claimedAt: WEEK_ONE }]);

    expect(normalized).toHaveLength(1);
    expect(getTownRecruitmentSlots('Moonbridge', 3, normalized, WEEK_ONE)[0].claimed).toBe(true);
  });
});
