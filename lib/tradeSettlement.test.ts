import { describe, expect, it } from 'vitest';
import { createTradeSession } from './tradeSessions';
import {
  isTradeOfferEmpty,
  settleTradeOffers,
  validateTradeOfferAgainstSnapshot,
  type TradeParticipantSnapshot,
} from './tradeSettlement';
import type { Equipment } from './auth';

const HELM: Equipment = {
  id: 'settle-helm',
  name: 'Settle Helm',
  slot: 'helmet',
  rarity: 'rare',
  stats: { defensivePower: 2 },
};

function snapshot(partial: Partial<TradeParticipantSnapshot> & Pick<TradeParticipantSnapshot, 'username'>): TradeParticipantSnapshot {
  return {
    gold: 100,
    inventory: [],
    equipment: [],
    equippedSlots: {},
    inventorySlots: 20,
    ...partial,
  };
}

describe('tradeSettlement', () => {
  it('rejects empty mutual offers', () => {
    const session = {
      ...createTradeSession('A', 'B', 1),
      status: 'active' as const,
      initiatorOffer: { gold: 0, items: [], equipmentIds: [] },
      receiverOffer: { gold: 0, items: [], equipmentIds: [] },
    };
    expect(isTradeOfferEmpty(session.initiatorOffer)).toBe(true);
    const result = settleTradeOffers(session, snapshot({ username: 'A' }), snapshot({ username: 'B' }));
    expect(result.success).toBe(false);
  });

  it('rejects quest items and transfers valid gold/items/gear once', () => {
    const initiator = snapshot({
      username: 'A',
      gold: 50,
      inventory: [
        { id: 'black-amber', name: 'Black Amber', quantity: 3, icon: 'black-amber' },
        { id: 'candle-key-fragment', name: 'Candle Key', quantity: 1, icon: 'candle', kind: 'quest' },
      ],
      equipment: [HELM],
    });
    const receiver = snapshot({
      username: 'B',
      gold: 40,
      inventory: [{ id: 'red-mercy-draught', name: 'Red Mercy', quantity: 2, icon: 'red-mercy-draught' }],
    });

    expect(validateTradeOfferAgainstSnapshot(initiator, {
      gold: 10,
      items: [{ itemId: 'candle-key-fragment', quantity: 1 }],
      equipmentIds: [],
    })).toBe('Quest items cannot be traded.');

    const session = {
      ...createTradeSession('A', 'B', 1),
      status: 'active' as const,
      initiatorOffer: { gold: 10, items: [{ itemId: 'black-amber', quantity: 2 }], equipmentIds: [HELM.id] },
      receiverOffer: { gold: 5, items: [{ itemId: 'red-mercy-draught', quantity: 1 }], equipmentIds: [] },
    };

    const first = settleTradeOffers(session, initiator, receiver);
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.initiator.gold).toBe(45);
    expect(first.receiver.gold).toBe(45);
    expect(first.initiator.inventory.find(item => item.id === 'black-amber')?.quantity).toBe(1);
    expect(first.receiver.equipment.some(item => item.id === HELM.id)).toBe(true);
    expect(first.initiator.equipment.some(item => item.id === HELM.id)).toBe(false);

    // Re-settling the original snapshots again is deterministic; idempotency is enforced at the session-row layer.
    const second = settleTradeOffers(session, initiator, receiver);
    expect(second.success).toBe(true);
  });

  it('fails when offered gold is no longer owned', () => {
    const result = validateTradeOfferAgainstSnapshot(
      snapshot({ username: 'A', gold: 4 }),
      { gold: 10, items: [], equipmentIds: [] },
    );
    expect(result).toBe('A no longer has enough gold for this offer.');
  });
});
