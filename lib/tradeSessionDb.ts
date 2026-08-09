import {
  emptyTradeOffer,
  type TradeOffer,
  type TradeSession,
  type TradeSessionStatus,
} from '@/lib/tradeSessions';
import { isSupabaseAdminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';

/** DB statuses from migration 007_multiplayer_sessions.sql */
export type TradeSessionDbStatus =
  | 'offered'
  | 'negotiating'
  | 'locked'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface TradeSessionDbRow {
  id: string;
  initiator_id: string;
  recipient_id: string;
  status: TradeSessionDbStatus;
  version: number;
  initiator_offer: TradeOffer | Record<string, unknown>;
  recipient_offer: TradeOffer | Record<string, unknown>;
  locks: { initiator?: boolean; recipient?: boolean } | Record<string, unknown>;
  confirmations: { initiator?: boolean; recipient?: boolean } | Record<string, unknown>;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export function shouldUseOnlineTradeSessions(): boolean {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

export function tradeStatusToDb(session: TradeSession): TradeSessionDbStatus {
  if (session.status === 'pending') return 'offered';
  if (session.status === 'completed') return 'completed';
  if (session.status === 'cancelled') return 'cancelled';
  if (session.status === 'expired') return 'expired';
  if (session.initiatorLocked && session.receiverLocked) return 'locked';
  return 'negotiating';
}

export function tradeStatusFromDb(
  status: TradeSessionDbStatus,
  locks: { initiator?: boolean; recipient?: boolean },
): TradeSessionStatus {
  if (status === 'offered') return 'pending';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'expired') return 'expired';
  if (status === 'locked' || status === 'negotiating') return 'active';
  void locks;
  return 'active';
}

function asOffer(value: unknown): TradeOffer {
  if (!value || typeof value !== 'object') return emptyTradeOffer();
  const record = value as Partial<TradeOffer>;
  return {
    gold: Math.max(0, Math.floor(Number(record.gold) || 0)),
    items: Array.isArray(record.items)
      ? record.items
        .map(item => ({
          itemId: String(item?.itemId || '').trim(),
          quantity: Math.max(0, Math.floor(Number(item?.quantity) || 0)),
        }))
        .filter(item => item.itemId && item.quantity > 0)
      : [],
    equipmentIds: Array.isArray(record.equipmentIds)
      ? record.equipmentIds.map(id => String(id || '').trim()).filter(Boolean)
      : [],
  };
}

function toTimestamp(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

export function tradeSessionFromDbRow(
  row: TradeSessionDbRow,
  initiatorUsername: string,
  receiverUsername: string,
  now = Date.now(),
): TradeSession {
  const locks = (row.locks || {}) as { initiator?: boolean; recipient?: boolean };
  const confirmations = (row.confirmations || {}) as { initiator?: boolean; recipient?: boolean };
  const status = tradeStatusFromDb(row.status, locks);
  const createdAt = toTimestamp(row.created_at, now);
  const updatedAt = toTimestamp(row.updated_at, createdAt);
  const expiresAt = toTimestamp(row.expires_at, createdAt);

  return {
    id: row.id,
    initiatorUsername,
    receiverUsername,
    createdAt,
    updatedAt,
    expiresAt,
    status: status === 'pending' || status === 'active'
      ? (expiresAt <= now ? 'expired' : status)
      : status,
    version: Math.max(1, Math.floor(Number(row.version) || 1)),
    initiatorOffer: asOffer(row.initiator_offer),
    receiverOffer: asOffer(row.recipient_offer),
    initiatorLocked: status === 'active' && Boolean(locks.initiator),
    receiverLocked: status === 'active' && Boolean(locks.recipient),
    initiatorAccepted: status === 'active' && Boolean(confirmations.initiator),
    receiverAccepted: status === 'active' && Boolean(confirmations.recipient),
  };
}

export function tradeSessionToDbPayload(
  session: TradeSession,
  initiatorId: string,
  recipientId: string,
): Omit<TradeSessionDbRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: session.id,
    initiator_id: initiatorId,
    recipient_id: recipientId,
    status: tradeStatusToDb(session),
    version: session.version,
    initiator_offer: session.initiatorOffer,
    recipient_offer: session.receiverOffer,
    locks: {
      initiator: session.initiatorLocked,
      recipient: session.receiverLocked,
    },
    confirmations: {
      initiator: session.initiatorAccepted,
      recipient: session.receiverAccepted,
    },
    expires_at: new Date(session.expiresAt).toISOString(),
  };
}

export function getTradeSessionAdminClient() {
  return createAdminClient();
}
