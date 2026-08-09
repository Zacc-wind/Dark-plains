import {
  getInventoryItemDefinition,
  getGearUsedSlots,
  getInventorySlotCapacity,
  makeInventoryItem,
  type Equipment,
  type InventoryItem,
} from '@/lib/auth';
import type { TradeOffer, TradeSession } from '@/lib/tradeSessions';

export interface TradeParticipantSnapshot {
  username: string;
  gold: number;
  inventory: InventoryItem[];
  equipment: Equipment[];
  equippedSlots: Record<string, string | null | undefined>;
  inventorySlots: number;
}

export interface TradeSettlementResult {
  success: true;
  initiator: TradeParticipantSnapshot;
  receiver: TradeParticipantSnapshot;
}

export interface TradeSettlementFailure {
  success: false;
  error: string;
}

function normalizeInventoryItem(item: InventoryItem): InventoryItem {
  const definition = getInventoryItemDefinition(item.id);
  return {
    ...item,
    name: item.name || definition?.name || item.id,
    kind: item.kind || definition?.kind,
    rarity: item.rarity || definition?.rarity,
    quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
  };
}

function addInventoryItems(currentInventory: InventoryItem[], incomingItems: InventoryItem[]): InventoryItem[] {
  const next = currentInventory.map(item => ({ ...item }));
  incomingItems.forEach(incoming => {
    const existing = next.find(item => item.id === incoming.id);
    if (existing) {
      existing.quantity += incoming.quantity;
      return;
    }
    next.push(normalizeInventoryItem({ ...incoming }));
  });
  return next.filter(item => item.quantity > 0);
}

function removeInventoryItem(currentInventory: InventoryItem[], itemId: string, quantity: number): InventoryItem[] {
  return currentInventory
    .map(item => {
      if (item.id !== itemId) return item;
      return { ...item, quantity: item.quantity - quantity };
    })
    .filter(item => item.quantity > 0);
}

export function isTradeOfferEmpty(offer: TradeOffer): boolean {
  return offer.gold <= 0 && offer.items.length === 0 && offer.equipmentIds.length === 0;
}

export function validateTradeOfferAgainstSnapshot(
  participant: TradeParticipantSnapshot,
  offer: TradeOffer,
): string | undefined {
  if (offer.gold > participant.gold) {
    return `${participant.username} no longer has enough gold for this offer.`;
  }

  for (const offeredItem of offer.items) {
    const inventoryItem = (participant.inventory || []).find(item => item.id === offeredItem.itemId);
    if (!inventoryItem || inventoryItem.quantity < offeredItem.quantity) {
      return `${participant.username} no longer owns the offered item quantity.`;
    }
    const definition = getInventoryItemDefinition(offeredItem.itemId);
    if (definition?.kind === 'quest' || inventoryItem.kind === 'quest') {
      return 'Quest items cannot be traded.';
    }
  }

  const equippedIds = new Set(Object.values(participant.equippedSlots || {}).filter(Boolean));
  for (const equipmentId of offer.equipmentIds) {
    if (!(participant.equipment || []).some(item => item.id === equipmentId)) {
      return `${participant.username} no longer owns the offered gear.`;
    }
    if (equippedIds.has(equipmentId)) return 'Equipped gear cannot be traded.';
  }

  return undefined;
}

function getTradeInventoryItems(participant: TradeParticipantSnapshot, offer: TradeOffer): InventoryItem[] {
  return offer.items.map(offeredItem => {
    const inventoryItem = (participant.inventory || []).find(item => item.id === offeredItem.itemId);
    return normalizeInventoryItem({
      ...(inventoryItem || makeInventoryItem(offeredItem.itemId)),
      quantity: offeredItem.quantity,
    });
  });
}

function applyOfferTransfer(
  participant: TradeParticipantSnapshot,
  ownOffer: TradeOffer,
  otherOffer: TradeOffer,
  incomingItems: InventoryItem[],
  incomingGear: Equipment[],
): TradeParticipantSnapshot {
  let inventory = participant.inventory || [];
  ownOffer.items.forEach(item => {
    inventory = removeInventoryItem(inventory, item.itemId, item.quantity);
  });
  inventory = addInventoryItems(inventory, incomingItems);
  const outgoingGear = new Set(ownOffer.equipmentIds);
  const equipment = [
    ...(participant.equipment || []).filter(item => !outgoingGear.has(item.id)),
    ...incomingGear,
  ];

  return {
    ...participant,
    gold: participant.gold - ownOffer.gold + otherOffer.gold,
    inventory,
    equipment,
  };
}

/** Atomically validate and transfer both offers. Does not mutate inputs. */
export function settleTradeOffers(
  session: TradeSession,
  initiator: TradeParticipantSnapshot,
  receiver: TradeParticipantSnapshot,
): TradeSettlementResult | TradeSettlementFailure {
  const initiatorError = validateTradeOfferAgainstSnapshot(initiator, session.initiatorOffer);
  const receiverError = validateTradeOfferAgainstSnapshot(receiver, session.receiverOffer);
  if (initiatorError || receiverError) {
    return { success: false, error: initiatorError || receiverError || 'Trade validation failed.' };
  }
  if (isTradeOfferEmpty(session.initiatorOffer) && isTradeOfferEmpty(session.receiverOffer)) {
    return { success: false, error: 'At least one item, gear piece, or gold offer is required.' };
  }

  const initiatorIncomingGear = (receiver.equipment || [])
    .filter(item => session.receiverOffer.equipmentIds.includes(item.id));
  const receiverIncomingGear = (initiator.equipment || [])
    .filter(item => session.initiatorOffer.equipmentIds.includes(item.id));

  const initiatorGearAfter = getGearUsedSlots(initiator)
    - session.initiatorOffer.equipmentIds.length
    + initiatorIncomingGear.length;
  const receiverGearAfter = getGearUsedSlots(receiver)
    - session.receiverOffer.equipmentIds.length
    + receiverIncomingGear.length;

  if (initiatorGearAfter > getInventorySlotCapacity(initiator)) {
    return { success: false, error: `${initiator.username} has no gear storage for this trade.` };
  }
  if (receiverGearAfter > getInventorySlotCapacity(receiver)) {
    return { success: false, error: `${receiver.username} has no gear storage for this trade.` };
  }

  const initiatorOwnedGearIds = new Set((initiator.equipment || []).map(item => item.id));
  const receiverOwnedGearIds = new Set((receiver.equipment || []).map(item => item.id));
  if (
    initiatorIncomingGear.some(item => initiatorOwnedGearIds.has(item.id))
    || receiverIncomingGear.some(item => receiverOwnedGearIds.has(item.id))
  ) {
    return { success: false, error: 'Duplicate gear ownership detected. Trade cancelled for safety.' };
  }

  const initiatorIncomingItems = getTradeInventoryItems(receiver, session.receiverOffer);
  const receiverIncomingItems = getTradeInventoryItems(initiator, session.initiatorOffer);

  return {
    success: true,
    initiator: applyOfferTransfer(
      initiator,
      session.initiatorOffer,
      session.receiverOffer,
      initiatorIncomingItems,
      initiatorIncomingGear,
    ),
    receiver: applyOfferTransfer(
      receiver,
      session.receiverOffer,
      session.initiatorOffer,
      receiverIncomingItems,
      receiverIncomingGear,
    ),
  };
}
