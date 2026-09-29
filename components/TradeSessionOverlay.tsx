'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelPlayerTradeSession,
  confirmCurrentPlayerTrade,
  getCurrentPlayerTradeSession,
  getCurrentUser,
  getInventoryItemDefinition,
  getUsers,
  setCurrentPlayerTradeLock,
  updateCurrentPlayerTradeOffer,
  type Equipment,
  type InventoryItem,
  type PlayerTradeActionResult,
  type User,
} from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';
import {
  TRADE_SESSION_OPEN_EVENT,
  getTradeOffer,
  getTradeSessionSide,
  type TradeOffer,
} from '@/lib/tradeSessions';
import { emitCompletionNotice } from '@/lib/completionEvents';
import { emitFxEvent } from '@/lib/fxEvents';
import { playGameSound, preloadGameSounds } from '@/lib/sound';
import { usePolling } from '@/lib/hooks/usePolling';
import { expireSocialRequestsShared } from '@/lib/socialRequestTicker';

const EQUIPMENT_ICON_BASE = '/assets/equipment';
const IDLE_TRADE_POLL_MS = 3_000;
const ACTIVE_TRADE_POLL_MS = 1_000;

function getEquipmentIconPath(item: Pick<Equipment, 'slot' | 'rarity'>): string {
  return `${EQUIPMENT_ICON_BASE}/${item.slot}-${item.rarity}.png`;
}

function getInventoryIconPath(item: InventoryItem): string {
  return item.imagePath || getInventoryItemDefinition(item.id)?.imagePath || '/assets/icons/loot-chest.png';
}

function formatRemaining(expiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function getOfferItemQuantity(offer: TradeOffer, itemId: string): number {
  return offer.items.find(item => item.itemId === itemId)?.quantity || 0;
}

function TradePartyHeader({ user, label, locked, accepted }: {
  user: User;
  label: string;
  locked: boolean;
  accepted: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <span className="ui-avatar-frame relative h-14 w-14 shrink-0 overflow-hidden rounded border">
        <Image
          src={getPlayerModelPath(user.selectedModel || 3)}
          alt=""
          fill
          sizes="56px"
          className="player-model-art object-contain"
          unoptimized
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="arcane-label">{label}</p>
        <h3 className="fantasy-heading truncate text-lg">{user.username}</h3>
      </div>
      <span className={`ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase ${accepted ? 'text-emerald-200' : locked ? 'text-amber-200' : ''}`}>
        {accepted ? 'Confirmed' : locked ? 'Locked' : 'Editing'}
      </span>
    </div>
  );
}

function ReadOnlyOffer({ owner, offer }: { owner: User; offer: TradeOffer }) {
  const items = offer.items.map(entry => ({
    entry,
    item: (owner.inventory || []).find(candidate => candidate.id === entry.itemId),
  }));
  const gear = (owner.equipment || []).filter(item => offer.equipmentIds.includes(item.id));
  const empty = offer.gold <= 0 && items.length === 0 && gear.length === 0;

  return (
    <div className="space-y-3 p-4">
      <div className="ui-pill flex items-center justify-between rounded border px-3 py-2 text-xs font-black">
        <span>Gold</span>
        <span className="ui-accent">{offer.gold}</span>
      </div>
      {empty ? (
        <div className="ui-faint rounded border border-dashed px-3 py-8 text-center text-xs font-bold">No valuables offered.</div>
      ) : (
        <div className="grid gap-2">
          {items.map(({ entry, item }) => (
            <div key={entry.itemId} className="ui-card flex items-center gap-3 rounded border p-2">
              <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                <Image src={getInventoryIconPath(item || { id: entry.itemId, name: entry.itemId, quantity: entry.quantity, icon: '' })} alt="" fill sizes="40px" className="object-contain p-1" unoptimized />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-black">{item?.name || entry.itemId}</span>
              <span className="ui-accent text-xs font-black">x{entry.quantity}</span>
            </div>
          ))}
          {gear.map(item => (
            <div key={item.id} className="ui-card flex items-center gap-3 rounded border p-2">
              <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                <Image src={getEquipmentIconPath(item)} alt="" fill sizes="40px" className="object-contain p-1" />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-black">{item.name}</span>
              <span className="ui-faint text-[10px] font-black uppercase">{item.rarity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradeSessionOverlay() {
  const [now, setNow] = useState(() => Date.now());
  const [, setRevision] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const current = getCurrentUser();
  const session = current ? getCurrentPlayerTradeSession(current, now) : undefined;
  const activeSession = session?.status === 'active' && !dismissedIds.includes(session.id) ? session : undefined;
  const activeSessionId = activeSession?.id;

  const refresh = useCallback(() => {
    const tickAt = Date.now();
    expireSocialRequestsShared(tickAt);
    setNow(tickAt);
    setRevision(value => value + 1);
  }, []);
  usePolling(refresh, activeSessionId ? ACTIVE_TRADE_POLL_MS : IDLE_TRADE_POLL_MS, { immediate: false });

  useEffect(() => {
    const handleOpen = () => {
      const latest = getCurrentPlayerTradeSession();
      if (latest) setDismissedIds(ids => ids.filter(id => id !== latest.id));
      setNow(Date.now());
      setRevision(value => value + 1);
    };
    window.addEventListener(TRADE_SESSION_OPEN_EVENT, handleOpen);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(TRADE_SESSION_OPEN_EVENT, handleOpen);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!activeSessionId) return undefined;
    preloadGameSounds(['ui.modalOpen', 'social.tradeReceived', 'social.accept', 'social.decline']);
    playGameSound('ui.modalOpen', { throttleMs: 250 });
    emitFxEvent({ type: 'interface', tone: 'gold', intensity: 0.65 });
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])')?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedIds(ids => ids.includes(activeSessionId) ? ids : [...ids, activeSessionId]);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') || []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [activeSessionId]);

  if (!current || !activeSession) return null;
  const users = getUsers();
  const initiator = users.find(user => user.username.toLowerCase() === activeSession.initiatorUsername.toLowerCase());
  const receiver = users.find(user => user.username.toLowerCase() === activeSession.receiverUsername.toLowerCase());
  if (!initiator || !receiver) return null;
  const side = getTradeSessionSide(activeSession, current.username);
  if (!side) return null;
  const other = side === 'initiator' ? receiver : initiator;
  const ownOffer = getTradeOffer(activeSession, current.username)!;
  const otherOffer = getTradeOffer(activeSession, other.username)!;
  const ownLocked = side === 'initiator' ? activeSession.initiatorLocked : activeSession.receiverLocked;
  const otherLocked = side === 'initiator' ? activeSession.receiverLocked : activeSession.initiatorLocked;
  const ownAccepted = side === 'initiator' ? activeSession.initiatorAccepted : activeSession.receiverAccepted;
  const otherAccepted = side === 'initiator' ? activeSession.receiverAccepted : activeSession.initiatorAccepted;
  const equippedIds = new Set(Object.values(current.equippedSlots || {}).filter(Boolean));
  const tradeableItems = (current.inventory || []).filter(item => {
    const definition = getInventoryItemDefinition(item.id);
    return item.quantity > 0 && definition?.kind !== 'quest' && item.kind !== 'quest';
  });
  const tradeableGear = (current.equipment || []).filter(item => !equippedIds.has(item.id));

  const applyResult = (result: PlayerTradeActionResult) => {
    setNotice(result.message || result.error || 'Trade action failed.');
    if (result.success) setRevision(value => value + 1);
    if (result.completed) {
      playGameSound('social.accept', { throttleMs: 120 });
      emitCompletionNotice({
        id: `player-trade-${activeSession.id}`,
        kind: 'quest',
        kicker: 'Player Exchange',
        title: `Trade with ${other.username} completed`,
        description: 'Both offers passed final ownership validation and were transferred.',
        rewards: [],
      });
    }
  };

  const runTradeAction = async (action: () => Promise<PlayerTradeActionResult>) => {
    if (busy) return;
    setBusy(true);
    try {
      applyResult(await action());
    } finally {
      setBusy(false);
    }
  };

  const updateOffer = (nextOffer: TradeOffer) => {
    if (busy || ownLocked) return;
    void runTradeAction(() => updateCurrentPlayerTradeOffer(activeSession.id, nextOffer, activeSession.version));
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    const items = ownOffer.items.filter(item => item.itemId !== itemId);
    if (quantity > 0) items.push({ itemId, quantity });
    updateOffer({ ...ownOffer, items });
  };

  const toggleEquipment = (equipmentId: string) => {
    const selected = ownOffer.equipmentIds.includes(equipmentId);
    updateOffer({
      ...ownOffer,
      equipmentIds: selected
        ? ownOffer.equipmentIds.filter(id => id !== equipmentId)
        : [...ownOffer.equipmentIds, equipmentId],
    });
  };

  return (
    <div
      className="fixed inset-0 z-[88] flex items-center justify-center bg-black/75 p-3 sm:p-5"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          setDismissedIds(ids => ids.includes(activeSession.id) ? ids : [...ids, activeSession.id]);
        }
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Player trade" className="command-panel vine-frame flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded border text-zinc-100">
        <header className="panel-header flex items-start justify-between gap-4 border-b px-4 py-3 sm:px-5">
          <div>
            <p className="arcane-label">Protected Player Exchange</p>
            <h2 className="fantasy-heading text-2xl">Trade Writ</h2>
            <p className="ui-muted mt-1 text-xs font-bold">Version {activeSession.version} - {formatRemaining(activeSession.expiresAt, now)} remaining</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDismissedIds(ids => [...ids, activeSession.id])} className="ui-button rounded px-3 py-2 text-xs font-black">Later</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runTradeAction(() => cancelPlayerTradeSession(activeSession.id))}
              className="ui-button-danger rounded px-3 py-2 text-xs font-black disabled:opacity-40"
            >
              Cancel Trade
            </button>
          </div>
        </header>

        {notice && <div className="ui-notice border-b px-4 py-2 text-center text-xs font-bold">{notice}</div>}

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="grid min-h-full lg:grid-cols-2 lg:divide-x">
            <section>
              <TradePartyHeader user={current} label="Your Offer" locked={ownLocked} accepted={ownAccepted} />
              <div className="space-y-5 p-4">
                <label className="block">
                  <span className="arcane-label">Gold</span>
                  <input
                    type="number"
                    min={0}
                    max={current.gold}
                    value={ownOffer.gold}
                    disabled={ownLocked || busy}
                    onChange={event => updateOffer({ ...ownOffer, gold: Math.min(current.gold, Math.max(0, Number(event.target.value) || 0)) })}
                    className="ui-input mt-2 w-full rounded px-3 py-2 text-sm font-black disabled:opacity-50"
                  />
                  <span className="ui-faint mt-1 block text-[10px] font-bold">Available: {current.gold}</span>
                </label>

                <div>
                  <p className="arcane-label">Items</p>
                  {tradeableItems.length === 0 ? (
                    <p className="ui-faint mt-2 text-xs font-bold">No tradeable carried items.</p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {tradeableItems.map(item => {
                        const quantity = getOfferItemQuantity(ownOffer, item.id);
                        return (
                          <div key={item.id} className="ui-card flex items-center gap-2 rounded border p-2">
                            <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                              <Image src={getInventoryIconPath(item)} alt="" fill sizes="40px" className="object-contain p-1" unoptimized />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-black">{item.name}</span>
                            <button type="button" disabled={ownLocked || quantity <= 0} onClick={() => updateItemQuantity(item.id, quantity - 1)} className="ui-button h-8 w-8 rounded text-sm font-black disabled:opacity-30" aria-label={`Remove one ${item.name}`}>-</button>
                            <span className="w-7 text-center text-xs font-black">{quantity}</span>
                            <button type="button" disabled={ownLocked || quantity >= item.quantity} onClick={() => updateItemQuantity(item.id, quantity + 1)} className="ui-button h-8 w-8 rounded text-sm font-black disabled:opacity-30" aria-label={`Add one ${item.name}`}>+</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <p className="arcane-label">Unequipped Gear</p>
                  {tradeableGear.length === 0 ? (
                    <p className="ui-faint mt-2 text-xs font-bold">No unequipped gear available.</p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {tradeableGear.map(item => {
                        const selected = ownOffer.equipmentIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={ownLocked}
                            onClick={() => toggleEquipment(item.id)}
                            className={`ui-card flex items-center gap-3 rounded border p-2 text-left disabled:opacity-50 ${selected ? 'border-amber-400/70 bg-amber-950/20' : ''}`}
                          >
                            <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                              <Image src={getEquipmentIconPath(item)} alt="" fill sizes="40px" className="object-contain p-1" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-xs">{item.name}</strong>
                              <small className="ui-faint uppercase">{item.rarity} {item.slot}</small>
                            </span>
                            <span className="text-xs font-black">{selected ? 'Offered' : 'Add'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section>
              <TradePartyHeader user={other} label="Their Offer" locked={otherLocked} accepted={otherAccepted} />
              <ReadOnlyOffer owner={other} offer={otherOffer} />
            </section>
          </div>
        </div>

        <footer className="grid gap-3 border-t px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-5">
          <p className="ui-muted text-xs font-bold">
            Offer changes clear both locks. Completion revalidates live ownership, gold, and gear capacity.
          </p>
          <button
            type="button"
            disabled={busy || ownAccepted}
            onClick={() => void runTradeAction(() => setCurrentPlayerTradeLock(activeSession.id, !ownLocked, activeSession.version))}
            className="ui-button rounded px-4 py-2 text-xs font-black disabled:opacity-35"
          >
            {ownLocked ? 'Unlock Offer' : 'Lock Offer'}
          </button>
          <button
            type="button"
            disabled={busy || !ownLocked || !otherLocked || ownAccepted}
            onClick={() => void runTradeAction(() => confirmCurrentPlayerTrade(activeSession.id, activeSession.version))}
            className="ui-button-primary rounded px-4 py-2 text-xs font-black disabled:opacity-35"
          >
            {ownAccepted ? 'Confirmed' : otherLocked ? 'Final Confirm' : 'Awaiting Locks'}
          </button>
        </footer>
      </div>
    </div>
  );
}
