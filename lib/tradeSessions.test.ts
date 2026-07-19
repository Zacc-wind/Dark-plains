import { describe, expect, it } from 'vitest';
import {
  TRADE_REQUEST_TTL_MS,
  activateTradeSession,
  confirmTradeSession,
  createTradeSession,
  getCurrentTradeSession,
  normalizeTradeSessions,
  setTradeSessionLock,
  updateTradeSessionOffer,
} from './tradeSessions';

const NOW = Date.parse('2026-07-20T12:00:00Z');

describe('trade session state machine', () => {
  it('allows only the receiver to activate a pending request', () => {
    const pending = createTradeSession('Initiator', 'Receiver', NOW);
    expect(activateTradeSession(pending, 'Initiator', NOW + 1).success).toBe(false);

    const activated = activateTradeSession(pending, 'receiver', NOW + 2);
    expect(activated.success).toBe(true);
    expect(activated.session).toMatchObject({ status: 'active', version: 2 });
  });

  it('invalidates both locks when either participant changes an offer', () => {
    let session = activateTradeSession(createTradeSession('Initiator', 'Receiver', NOW), 'Receiver', NOW + 1).session;
    session = updateTradeSessionOffer(session, 'Initiator', {
      gold: 50,
      items: [{ itemId: 'black-amber', quantity: 2 }],
    }, NOW + 2).session;
    session = setTradeSessionLock(session, 'Initiator', true, NOW + 3).session;
    session = setTradeSessionLock(session, 'Receiver', true, NOW + 4).session;

    expect(session).toMatchObject({ initiatorLocked: true, receiverLocked: true });
    expect(updateTradeSessionOffer(session, 'Initiator', { gold: 25 }, NOW + 5).success).toBe(false);

    session = setTradeSessionLock(session, 'Receiver', false, NOW + 6).session;
    session = updateTradeSessionOffer(session, 'Receiver', { gold: 10 }, NOW + 7).session;
    expect(session).toMatchObject({ initiatorLocked: false, receiverLocked: false });
  });

  it('requires two locked offers and two distinct confirmations', () => {
    let session = activateTradeSession(createTradeSession('Initiator', 'Receiver', NOW), 'Receiver', NOW + 1).session;
    expect(confirmTradeSession(session, 'Initiator', NOW + 2).success).toBe(false);

    session = setTradeSessionLock(session, 'Initiator', true, NOW + 3).session;
    session = setTradeSessionLock(session, 'Receiver', true, NOW + 4).session;
    const first = confirmTradeSession(session, 'Initiator', NOW + 5);
    expect(first).toMatchObject({ success: true, readyToComplete: false });
    const second = confirmTradeSession(first.session, 'Receiver', NOW + 6);
    expect(second).toMatchObject({ success: true, readyToComplete: true });
  });

  it('expires pending sessions and drops them from the current-session lookup', () => {
    const pending = createTradeSession('Initiator', 'Receiver', NOW);
    const expired = normalizeTradeSessions([pending], NOW + TRADE_REQUEST_TTL_MS + 1)[0];
    expect(expired.status).toBe('expired');
    expect(getCurrentTradeSession([expired], 'Receiver', NOW + TRADE_REQUEST_TTL_MS + 1)).toBeUndefined();
  });
});
