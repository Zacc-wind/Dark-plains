import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimQuestReward,
  getCurrentUser,
  getMinionTemplate,
  getTownRecruitmentOffers,
  login,
  recruitTownWeeklyOffer,
  register,
  updateCurrentUser,
} from './auth';

class MemoryLocalStorage {
  private readonly values = new Map<string, string>();

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const storage = new MemoryLocalStorage();
const NOW = Date.UTC(2026, 6, 20, 12, 0, 0);

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', { localStorage: storage });
});

describe('reliable recruitment rewards', () => {
  it('persists one weekly town recruit and rejects a duplicate claim', () => {
    expect(register('WeeklyRecruit', 'test-password').success).toBe(true);
    expect(login('WeeklyRecruit', 'test-password').success).toBe(true);
    updateCurrentUser({ gold: 2_000 });
    const before = getCurrentUser()!;
    const offer = getTownRecruitmentOffers('Harborview', before, NOW)[0];

    const first = recruitTownWeeklyOffer(offer.offerId, 'Harborview', NOW);
    expect(first.success).toBe(true);

    const after = getCurrentUser()!;
    expect(after.gold).toBe(before.gold - offer.price);
    expect(after.minions).toHaveLength(before.minions.length + 1);
    expect(after.townRecruitmentClaims).toHaveLength(1);
    expect(recruitTownWeeklyOffer(offer.offerId, 'Harborview', NOW).success).toBe(false);
    expect(getCurrentUser()!.minions).toHaveLength(after.minions.length);
  });

  it('uses the shorter daily ladder and grants the Tier I recruit deterministically', () => {
    expect(register('DailyRecruit', 'test-password').success).toBe(true);
    expect(login('DailyRecruit', 'test-password').success).toBe(true);
    const user = getCurrentUser()!;
    const dailyQuests = user.dailyQuests!;
    const dailyTwo = dailyQuests.quests.find(quest => quest.id === 'daily-2')!;
    const dailyThree = dailyQuests.quests.find(quest => quest.id === 'daily-3')!;

    expect(dailyTwo.requirement).toMatchObject({ count: 2, minDuration: 10 * 60 * 1000 });
    expect(dailyThree.requirement).toMatchObject({ count: 2, minDuration: 30 * 60 * 1000 });
    expect(dailyThree.rewards.guaranteedMinionTier).toBe('tier1');

    updateCurrentUser({
      dailyQuests: {
        ...dailyQuests,
        quests: dailyQuests.quests.map(quest =>
          quest.id === 'daily-3' ? { ...quest, progress: quest.requirement.count } : quest
        ),
      },
    });
    const rosterSize = getCurrentUser()!.minions.length;
    const claimed = claimQuestReward('daily-3');

    expect(claimed.success).toBe(true);
    expect(claimed.minions).toHaveLength(1);
    expect(getMinionTemplate(claimed.minions![0].templateId)?.tier).toBe('tier1');
    expect(getCurrentUser()!.minions).toHaveLength(rosterSize + 1);
    expect(claimQuestReward('daily-3').success).toBe(false);
  });
});
