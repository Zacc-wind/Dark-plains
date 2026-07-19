import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptPlayerTradeRequest,
  confirmCurrentPlayerTrade,
  getCurrentPlayerTradeSession,
  getCurrentUser,
  getIncomingSocialRequests,
  getSocialState,
  getUsers,
  login,
  makeInventoryItem,
  register,
  requestPlayerTrade,
  setCurrentPlayerTradeLock,
  updateCurrentPlayerTradeOffer,
  updateCurrentUser,
  type Equipment,
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
const TEST_GEAR: Equipment = {
  id: 'trade-test-gear',
  name: 'Trade Test Helm',
  slot: 'helmet',
  rarity: 'rare',
  stats: { defensivePower: 3 },
};

function prepareCurrentPlayer(level: number, updates: Parameters<typeof updateCurrentUser>[0] = {}): void {
  const user = getCurrentUser();
  if (!user) throw new Error('Expected a logged-in player.');
  updateCurrentUser({ ...updates, stats: { ...user.stats, level, ...(updates.stats || {}) } });
}

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', { localStorage: storage });
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T12:00:00Z'));
});

describe('player trade auth integration', () => {
  it('validates and atomically transfers both offers after two confirmations', () => {
    expect(register('TradeLeader', 'test-password').success).toBe(true);
    expect(register('TradePartner', 'test-password').success).toBe(true);

    expect(login('TradeLeader', 'test-password').success).toBe(true);
    prepareCurrentPlayer(4, {
      gold: 300,
      inventory: [makeInventoryItem('black-amber', 3), makeInventoryItem('candle-key-fragment', 1)],
      equipment: [TEST_GEAR],
    });
    expect(login('TradePartner', 'test-password').success).toBe(true);
    prepareCurrentPlayer(4, {
      gold: 200,
      inventory: [makeInventoryItem('red-mercy-draught', 2)],
    });

    expect(login('TradeLeader', 'test-password').success).toBe(true);
    expect(requestPlayerTrade('TradePartner')).toMatchObject({ success: true });

    expect(login('TradePartner', 'test-password').success).toBe(true);
    const request = getIncomingSocialRequests().find(candidate => candidate.kind === 'trade');
    expect(request).toBeDefined();
    expect(acceptPlayerTradeRequest(request!.id)).toMatchObject({ success: true });
    let session = getCurrentPlayerTradeSession();
    expect(session?.status).toBe('active');
    const receiverUpdate = updateCurrentPlayerTradeOffer(session!.id, {
      gold: 30,
      items: [{ itemId: 'red-mercy-draught', quantity: 1 }],
    }, session!.version);
    expect(receiverUpdate.success).toBe(true);

    expect(login('TradeLeader', 'test-password').success).toBe(true);
    session = getCurrentPlayerTradeSession();
    expect(updateCurrentPlayerTradeOffer(session!.id, {
      gold: 20,
      items: [{ itemId: 'candle-key-fragment', quantity: 1 }],
    }, session!.version)).toMatchObject({ success: false, error: 'Quest items cannot be traded.' });
    const initiatorUpdate = updateCurrentPlayerTradeOffer(session!.id, {
      gold: 20,
      items: [{ itemId: 'black-amber', quantity: 2 }],
      equipmentIds: [TEST_GEAR.id],
    }, session!.version);
    expect(initiatorUpdate.success).toBe(true);
    expect(updateCurrentPlayerTradeOffer(session!.id, { gold: 1 }, session!.version)).toMatchObject({
      success: false,
      error: 'Trade changed. Review the latest offers before editing.',
    });
    expect(setCurrentPlayerTradeLock(session!.id, true, initiatorUpdate.session!.version).success).toBe(true);

    expect(login('TradePartner', 'test-password').success).toBe(true);
    session = getCurrentPlayerTradeSession();
    expect(setCurrentPlayerTradeLock(session!.id, true, session!.version).success).toBe(true);
    session = getCurrentPlayerTradeSession();
    const partnerConfirmation = confirmCurrentPlayerTrade(session!.id, session!.version);
    expect(partnerConfirmation.success).toBe(true);
    expect(partnerConfirmation.completed).not.toBe(true);

    expect(login('TradeLeader', 'test-password').success).toBe(true);
    session = getCurrentPlayerTradeSession();
    expect(confirmCurrentPlayerTrade(session!.id, session!.version)).toMatchObject({ success: true, completed: true });
    expect(getCurrentPlayerTradeSession()).toBeUndefined();

    const users = getUsers();
    const leader = users.find(user => user.username === 'TradeLeader')!;
    const partner = users.find(user => user.username === 'TradePartner')!;
    expect(leader.gold).toBe(310);
    expect(partner.gold).toBe(190);
    expect(leader.inventory.find(item => item.id === 'black-amber')?.quantity).toBe(1);
    expect(leader.inventory.find(item => item.id === 'red-mercy-draught')?.quantity).toBe(1);
    expect(partner.inventory.find(item => item.id === 'black-amber')?.quantity).toBe(2);
    expect(partner.equipment.some(item => item.id === TEST_GEAR.id)).toBe(true);
    expect(leader.equipment.some(item => item.id === TEST_GEAR.id)).toBe(false);
    expect(leader.activityLog[0]).toMatchObject({ title: 'Trade with TradePartner', source: 'Player Exchange' });
    expect(partner.activityLog[0]).toMatchObject({ title: 'Trade with TradeLeader', source: 'Player Exchange' });
    expect(leader.multiplayerEngagement?.events.filter(event => event.kind === 'trade-completed')).toHaveLength(1);
    expect(partner.multiplayerEngagement?.events.filter(event => event.kind === 'trade-completed')).toHaveLength(1);
    expect(getSocialState(leader).tradeSessions?.[0].status).toBe('completed');
    expect(getSocialState(partner).tradeSessions?.[0].status).toBe('completed');
  });
});
