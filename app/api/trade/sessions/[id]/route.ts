import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import type { Equipment, InventoryItem } from '@/lib/auth';
import { requireMultiplayerUnlock } from '@/lib/multiplayerUnlocks';
import { createClient } from '@/lib/supabase/server';
import {
  getTradeSessionAdminClient,
  shouldUseOnlineTradeSessions,
  tradeSessionFromDbRow,
  tradeSessionToDbPayload,
  type TradeSessionDbRow,
} from '@/lib/tradeSessionDb';
import {
  settleTradeOffers,
  validateTradeOfferAgainstSnapshot,
  type TradeParticipantSnapshot,
} from '@/lib/tradeSettlement';
import {
  activateTradeSession,
  confirmTradeSession,
  getTradeOffer,
  setTradeSessionLock,
  setTradeSessionStatus,
  updateTradeSessionOffer,
  type TradeOffer,
  type TradeSession,
} from '@/lib/tradeSessions';

export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = NonNullable<ReturnType<typeof getTradeSessionAdminClient>>;
type TradePatchAction = 'accept' | 'decline' | 'cancel' | 'update_offer' | 'set_lock' | 'confirm';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ProfileRow {
  id: string;
  username: string;
}

interface PlayerStateTradeRow {
  user_id: string;
  gold: number;
  inventory: InventoryItem[] | null;
  equipment: Equipment[] | null;
  equipped_slots: Record<string, string | null | undefined> | null;
  inventory_slots: number | null;
  level: number | null;
  game_sessions: Record<string, unknown> | null;
  activity_log: unknown[] | null;
}

async function getAuthenticatedUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

async function getProfileMap(
  supabase: SupabaseServerClient,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', ids);
  if (error) throw error;
  return new Map((data as ProfileRow[] | null || []).map(profile => [profile.id, profile.username]));
}

function hydrateSession(
  row: TradeSessionDbRow,
  usernameById: Map<string, string>,
  now = Date.now(),
): TradeSession | null {
  const initiatorUsername = usernameById.get(row.initiator_id);
  const receiverUsername = usernameById.get(row.recipient_id);
  if (!initiatorUsername || !receiverUsername) return null;
  return tradeSessionFromDbRow(row, initiatorUsername, receiverUsername, now);
}

async function loadTradeRow(admin: AdminClient, sessionId: string): Promise<TradeSessionDbRow | null> {
  const { data, error } = await admin
    .from('trade_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as TradeSessionDbRow | null;
}

async function loadParticipantSnapshot(
  admin: AdminClient,
  userId: string,
  username: string,
): Promise<TradeParticipantSnapshot & { level: number; game_sessions: Record<string, unknown>; activity_log: unknown[] }> {
  const { data, error } = await admin
    .from('player_states')
    .select('user_id, gold, inventory, equipment, equipped_slots, inventory_slots, level, game_sessions, activity_log')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const row = data as PlayerStateTradeRow | null;
  if (!row) throw new Error(`Player state missing for ${username}.`);
  return {
    username,
    gold: Math.max(0, Math.floor(Number(row.gold) || 0)),
    inventory: Array.isArray(row.inventory) ? row.inventory : [],
    equipment: Array.isArray(row.equipment) ? row.equipment : [],
    equippedSlots: (row.equipped_slots || {}) as Record<string, string | null | undefined>,
    inventorySlots: Math.max(1, Math.floor(Number(row.inventory_slots) || 20)),
    level: Math.max(1, Math.floor(Number(row.level) || 1)),
    game_sessions: (row.game_sessions || {}) as Record<string, unknown>,
    activity_log: Array.isArray(row.activity_log) ? row.activity_log : [],
  };
}

async function writeSessionVersioned(
  admin: AdminClient,
  session: TradeSession,
  initiatorId: string,
  recipientId: string,
  expectedVersion: number,
): Promise<TradeSessionDbRow | null> {
  const payload = tradeSessionToDbPayload(session, initiatorId, recipientId);
  const { data, error } = await admin
    .from('trade_sessions')
    .update({
      status: payload.status,
      version: payload.version,
      initiator_offer: payload.initiator_offer,
      recipient_offer: payload.recipient_offer,
      locks: payload.locks,
      confirmations: payload.confirmations,
      expires_at: payload.expires_at,
      updated_at: new Date(session.updatedAt).toISOString(),
    })
    .eq('id', session.id)
    .eq('version', expectedVersion)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as TradeSessionDbRow | null;
}

function conflictResponse(session: TradeSession, error: string) {
  return Response.json(
    { ok: false, error, data: { session }, deploymentMode: 'database' },
    { status: 409 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!shouldUseOnlineTradeSessions()) {
    return apiNotConfigured('Trade session API');
  }

  const { id } = await context.params;
  let body: {
    action?: TradePatchAction;
    expectedVersion?: number;
    offer?: Partial<TradeOffer>;
    locked?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.', deploymentMode: 'database' }, { status: 400 });
  }

  const action = body.action;
  const expectedVersion = Math.floor(Number(body.expectedVersion));
  if (!action || !['accept', 'decline', 'cancel', 'update_offer', 'set_lock', 'confirm'].includes(action)) {
    return Response.json({ ok: false, error: 'Invalid trade action.', deploymentMode: 'database' }, { status: 400 });
  }
  if (!Number.isFinite(expectedVersion) || expectedVersion < 1) {
    return Response.json({ ok: false, error: 'expectedVersion is required.', deploymentMode: 'database' }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = getTradeSessionAdminClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId || !admin) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  try {
    const row = await loadTradeRow(admin, id);
    if (!row) {
      return Response.json({ ok: false, error: 'Trade session was not found.', deploymentMode: 'database' }, { status: 404 });
    }

    if (row.initiator_id !== userId && row.recipient_id !== userId) {
      return Response.json({ ok: false, error: 'You are not part of this trade.', deploymentMode: 'database' }, { status: 403 });
    }

    const usernameById = await getProfileMap(supabase, [row.initiator_id, row.recipient_id]);
    const username = usernameById.get(userId);
    if (!username) {
      return Response.json({ ok: false, error: 'Your profile is missing.', deploymentMode: 'database' }, { status: 404 });
    }

    const now = Date.now();
    let session = hydrateSession(row, usernameById, now);
    if (!session) {
      return Response.json({ ok: false, error: 'Trade session could not be loaded.', deploymentMode: 'database' }, { status: 500 });
    }

    if (session.status === 'completed') {
      return apiOk({ session, completed: true, duplicate: true }, undefined, 'database');
    }

    if (session.version !== expectedVersion) {
      return conflictResponse(session, 'Trade changed. Review the latest offers.');
    }

    if (session.status === 'expired' || ((session.status === 'pending' || session.status === 'active') && session.expiresAt <= now)) {
      const expired = setTradeSessionStatus(session, 'expired', now);
      const written = await writeSessionVersioned(admin, expired, row.initiator_id, row.recipient_id, expectedVersion);
      const next = written
        ? hydrateSession(written, usernameById, now) || expired
        : expired;
      return conflictResponse(next, 'Trade expired.');
    }

    if (session.status === 'cancelled') {
      return conflictResponse(session, 'Trade is no longer active.');
    }

    const actorState = await loadParticipantSnapshot(admin, userId, username);
    const unlock = requireMultiplayerUnlock('trading', actorState.level);
    if (!unlock.allowed && action !== 'cancel' && action !== 'decline') {
      return Response.json({ ok: false, error: unlock.error, deploymentMode: 'database' }, { status: 403 });
    }

    let nextSession: TradeSession = session;
    let completed = false;
    let pendingSettlement: ReturnType<typeof settleTradeOffers> | null = null;
    let initiatorStateForSettle: Awaited<ReturnType<typeof loadParticipantSnapshot>> | null = null;
    let receiverStateForSettle: Awaited<ReturnType<typeof loadParticipantSnapshot>> | null = null;

    if (action === 'accept') {
      const activation = activateTradeSession(session, username, now);
      if (!activation.success) {
        return Response.json({ ok: false, error: activation.error, data: { session: activation.session }, deploymentMode: 'database' }, { status: 409 });
      }
      nextSession = activation.session;
    } else if (action === 'decline' || action === 'cancel') {
      nextSession = setTradeSessionStatus(session, 'cancelled', now, username);
    } else if (action === 'update_offer') {
      const update = updateTradeSessionOffer(session, username, body.offer || {}, now);
      if (!update.success) {
        return Response.json({ ok: false, error: update.error, data: { session: update.session }, deploymentMode: 'database' }, { status: 409 });
      }
      const ownOffer = getTradeOffer(update.session, username);
      const validationError = ownOffer ? validateTradeOfferAgainstSnapshot(actorState, ownOffer) : 'Trade participant not found.';
      if (validationError) {
        return Response.json({ ok: false, error: validationError, data: { session }, deploymentMode: 'database' }, { status: 400 });
      }
      nextSession = update.session;
    } else if (action === 'set_lock') {
      const locked = Boolean(body.locked);
      if (locked) {
        const ownOffer = getTradeOffer(session, username);
        const validationError = ownOffer ? validateTradeOfferAgainstSnapshot(actorState, ownOffer) : 'Trade participant not found.';
        if (validationError) {
          return Response.json({ ok: false, error: validationError, data: { session }, deploymentMode: 'database' }, { status: 400 });
        }
      }
      const update = setTradeSessionLock(session, username, locked, now);
      if (!update.success) {
        return Response.json({ ok: false, error: update.error, data: { session: update.session }, deploymentMode: 'database' }, { status: 409 });
      }
      nextSession = update.session;
    } else {
      const confirmation = confirmTradeSession(session, username, now);
      if (!confirmation.success) {
        return Response.json({ ok: false, error: confirmation.error, data: { session: confirmation.session }, deploymentMode: 'database' }, { status: 409 });
      }

      if (!confirmation.readyToComplete) {
        nextSession = confirmation.session;
      } else {
        const initiatorUsername = usernameById.get(row.initiator_id)!;
        const receiverUsername = usernameById.get(row.recipient_id)!;
        const [initiatorState, receiverState] = await Promise.all([
          loadParticipantSnapshot(admin, row.initiator_id, initiatorUsername),
          loadParticipantSnapshot(admin, row.recipient_id, receiverUsername),
        ]);

        const settlement = settleTradeOffers(confirmation.session, initiatorState, receiverState);
        if (!settlement.success) {
          return Response.json({ ok: false, error: settlement.error, data: { session: confirmation.session }, deploymentMode: 'database' }, { status: 409 });
        }

        nextSession = setTradeSessionStatus(confirmation.session, 'completed', now);
        completed = true;
        pendingSettlement = settlement;
        initiatorStateForSettle = initiatorState;
        receiverStateForSettle = receiverState;
      }
    }

    // Lock the session row first so concurrent confirms cannot double-settle.
    const written = await writeSessionVersioned(
      admin,
      nextSession,
      row.initiator_id,
      row.recipient_id,
      expectedVersion,
    );

    if (!written) {
      const fresh = await loadTradeRow(admin, id);
      const freshSession = fresh ? hydrateSession(fresh, usernameById, now) : session;
      return conflictResponse(freshSession || session, 'Trade changed. Review the latest offers.');
    }

    let participants: Array<{ username: string; gold: number; inventory: InventoryItem[]; equipment: Equipment[] }> | undefined;

    if (
      completed
      && pendingSettlement
      && pendingSettlement.success
      && initiatorStateForSettle
      && receiverStateForSettle
    ) {
      const initiatorUsername = usernameById.get(row.initiator_id)!;
      const receiverUsername = usernameById.get(row.recipient_id)!;
      const engagementId = `trade-completed:${nextSession.id}`;
      const stampEngagement = (
        state: NonNullable<typeof initiatorStateForSettle>,
        otherUsername: string,
      ) => {
        const existing = (state.game_sessions?.multiplayerEngagement as { events?: Array<{ id?: string }> } | undefined)?.events || [];
        if (existing.some(event => event.id === engagementId)) {
          return state.game_sessions;
        }
        return {
          ...state.game_sessions,
          multiplayerEngagement: {
            ...((state.game_sessions?.multiplayerEngagement as object) || {}),
            events: [
              {
                id: engagementId,
                kind: 'trade-completed',
                occurredAt: now,
                contextId: 'player-exchange',
                targetId: otherUsername,
              },
              ...existing,
            ].slice(0, 80),
          },
        };
      };

      const [initiatorResult, receiverResult] = await Promise.all([
        admin
          .from('player_states')
          .update({
            gold: pendingSettlement.initiator.gold,
            inventory: pendingSettlement.initiator.inventory,
            equipment: pendingSettlement.initiator.equipment,
            game_sessions: stampEngagement(initiatorStateForSettle, receiverUsername),
            updated_at: new Date(now).toISOString(),
          })
          .eq('user_id', row.initiator_id),
        admin
          .from('player_states')
          .update({
            gold: pendingSettlement.receiver.gold,
            inventory: pendingSettlement.receiver.inventory,
            equipment: pendingSettlement.receiver.equipment,
            game_sessions: stampEngagement(receiverStateForSettle, initiatorUsername),
            updated_at: new Date(now).toISOString(),
          })
          .eq('user_id', row.recipient_id),
      ]);
      if (initiatorResult.error) throw initiatorResult.error;
      if (receiverResult.error) throw receiverResult.error;

      participants = [
        {
          username: pendingSettlement.initiator.username,
          gold: pendingSettlement.initiator.gold,
          inventory: pendingSettlement.initiator.inventory,
          equipment: pendingSettlement.initiator.equipment,
        },
        {
          username: pendingSettlement.receiver.username,
          gold: pendingSettlement.receiver.gold,
          inventory: pendingSettlement.receiver.inventory,
          equipment: pendingSettlement.receiver.equipment,
        },
      ];
    }

    const saved = hydrateSession(written, usernameById, now) || nextSession;
    return apiOk({
      session: saved,
      ...(completed ? { completed: true } : {}),
      ...(participants ? { participants } : {}),
    }, undefined, 'database');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update trade session.';
    return Response.json({ ok: false, error: message, deploymentMode: 'database' }, { status: 500 });
  }
}
