import { describe, expect, it } from 'vitest';
import { createTradeSession } from './tradeSessions';
import {
  tradeSessionFromDbRow,
  tradeSessionToDbPayload,
  tradeStatusFromDb,
  tradeStatusToDb,
} from './tradeSessionDb';

describe('tradeSessionDb', () => {
  it('maps app statuses to database statuses', () => {
    const pending = createTradeSession('Alice', 'Bob', 1_000);
    expect(tradeStatusToDb(pending)).toBe('offered');

    const active = { ...pending, status: 'active' as const, initiatorLocked: false, receiverLocked: false };
    expect(tradeStatusToDb(active)).toBe('negotiating');

    const locked = { ...active, initiatorLocked: true, receiverLocked: true };
    expect(tradeStatusToDb(locked)).toBe('locked');
  });

  it('maps database statuses back to app statuses', () => {
    expect(tradeStatusFromDb('offered', {})).toBe('pending');
    expect(tradeStatusFromDb('negotiating', {})).toBe('active');
    expect(tradeStatusFromDb('locked', { initiator: true, recipient: true })).toBe('active');
    expect(tradeStatusFromDb('completed', {})).toBe('completed');
  });

  it('round-trips session payload fields', () => {
    const session = {
      ...createTradeSession('Alice', 'Bob', 1_700_000_000_000),
      status: 'active' as const,
      initiatorOffer: { gold: 25, items: [{ itemId: 'herb', quantity: 2 }], equipmentIds: ['sword-1'] },
      receiverOffer: { gold: 10, items: [], equipmentIds: [] },
      initiatorLocked: true,
      receiverLocked: false,
      initiatorAccepted: false,
      receiverAccepted: false,
      version: 3,
    };

    const payload = tradeSessionToDbPayload(session, 'init-id', 'recv-id');
    expect(payload.status).toBe('negotiating');
    expect(payload.initiator_offer).toEqual(session.initiatorOffer);
    expect(payload.locks).toEqual({ initiator: true, recipient: false });

    const restored = tradeSessionFromDbRow(
      {
        ...payload,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
      },
      'Alice',
      'Bob',
      session.createdAt,
    );

    expect(restored.status).toBe('active');
    expect(restored.initiatorLocked).toBe(true);
    expect(restored.receiverLocked).toBe(false);
    expect(restored.initiatorOffer.gold).toBe(25);
    expect(restored.version).toBe(3);
  });
});
