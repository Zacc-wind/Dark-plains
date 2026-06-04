'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ASSET_PATHS, getPlayerModelPath } from '@/lib/assetLoader';
import {
  addEquipmentSocketBonus,
  acceptCityQuest,
  buyShopOffer,
  claimCityQuestReward,
  Equipment,
  EquipmentSocketBonus,
  getEquipmentSellValue,
  getInventoryItemDefinition,
  getInventoryItemSellValue,
  getMinionTemplate,
  getMinionSellValue,
  getPlayersAtLocation,
  getCityQuestStatus,
  getCurrentUser,
  getBalancedQuestExp,
  getEquipmentSocketAddQuote,
  getEquipmentSocketBonusValue,
  getEquipmentSocketLimit,
  getEquipmentSocketUpgradeQuote,
  getRotatingCityQuests,
  getTownShopOffers,
  InventoryItem,
  MinionStack,
  RewardSummary,
  TRADE_EXCHANGE_OFFERS,
  type TradeExchangeOffer,
  type User,
  performTradeExchange,
  sellEquipmentItem,
  sellInventoryItem,
  sellMinion,
  upgradeEquipmentSocketBonus,
} from '@/lib/auth';
import { BATTLE_SPELLS } from '@/lib/battle';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import { emitFxEvent } from '@/lib/fxEvents';
import { POI } from '@/lib/mapData';

interface TownModalProps {
  town: POI | null;
  onClose: () => void;
}

function rewardSummaryToCompletionRewards(rewards?: RewardSummary): CompletionRewardLine[] {
  if (!rewards) return [];

  const lines: CompletionRewardLine[] = [];
  if (rewards.gold) lines.push({ label: 'Gold', value: `+${rewards.gold}`, tone: 'gold' });
  if (rewards.exp) lines.push({ label: 'XP', value: `+${rewards.exp}`, tone: 'blue' });
  if (rewards.healthRestore) lines.push({ label: 'Health', value: `+${rewards.healthRestore}`, tone: 'green' });
  if (rewards.rareGems) lines.push({ label: 'Gems', value: `+${rewards.rareGems}`, tone: 'violet' });
  rewards.items?.forEach(item => lines.push({ label: 'Item', value: item.quantity > 1 ? `${item.quantity} ${item.name}` : item.name, tone: 'green' }));
  rewards.equipment?.forEach(item => lines.push({ label: 'Equipment', value: item.name, tone: 'green' }));
  rewards.minions?.forEach(minion => lines.push({ label: 'Minion', value: getMinionTemplate(minion.templateId)?.name || 'Minion', tone: 'green' }));
  rewards.spellIds?.forEach(spellId => lines.push({ label: 'Spell', value: BATTLE_SPELLS.find(spell => spell.id === spellId)?.name || 'Spell', tone: 'violet' }));

  return lines;
}

function getCityQuestRequirementText(quest: { requirement: { type: string; count: number; itemId?: string; minDuration?: number; poiName?: string } }): string {
  const { requirement } = quest;

  switch (requirement.type) {
    case 'complete_jobs':
      return `Finish ${requirement.count} local job${requirement.count === 1 ? '' : 's'}.`;
    case 'complete_timed_jobs':
      return `Finish ${requirement.count} longer job${requirement.count === 1 ? '' : 's'}.`;
    case 'player_level':
      return `Reach level ${requirement.count}.`;
    case 'own_rare_gems':
      return `Hold ${requirement.count} rare gem${requirement.count === 1 ? '' : 's'}.`;
    case 'collect_item': {
      const itemName = getInventoryItemDefinition(requirement.itemId || '')?.name || 'quest relic';
      return `Recover ${requirement.count} ${itemName}${requirement.count === 1 ? '' : 's'} from drops.`;
    }
    case 'recruit_minions':
      return `Recruit ${requirement.count} unit${requirement.count === 1 ? '' : 's'}.`;
    case 'win_battles':
      return `Win ${requirement.count} battle${requirement.count === 1 ? '' : 's'}.`;
    case 'visit_poi':
      return `Reach ${requirement.poiName || 'the marked place'}.`;
    default:
      return 'Complete the contract objective.';
  }
}

export default function TownModal({ town, onClose }: TownModalProps) {
  const [user, setUser] = useState(getCurrentUser());
  const [notice, setNotice] = useState('');
  const [selectedForgeItemId, setSelectedForgeItemId] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState({ quests: true, shop: true, blacksmith: true });

  useEffect(() => {
    const interval = window.setInterval(() => setUser(getCurrentUser()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!town) return undefined;
    document.body.classList.add('town-view-open');
    return () => document.body.classList.remove('town-view-open');
  }, [town]);

  if (!town) return null;

  const harborStyleTowns = new Set(['Harborview', 'Blackwater Gate', 'Eclipse Hold']);
  const backgroundPath = harborStyleTowns.has(town.name)
    ? ASSET_PATHS.towns.harborviewBackground
    : ASSET_PATHS.towns.riversideBackground;
  const offers = getTownShopOffers(town.name);
  const cityQuests = getRotatingCityQuests(town.name);
  const forgeEquipment = user?.equipment || [];
  const selectedForgeItem = forgeEquipment.find(item => item.id === selectedForgeItemId) || forgeEquipment[0] || null;
  const forgeSocketQuote = getEquipmentSocketAddQuote(selectedForgeItem);
  const atTown = Boolean(
    user &&
    user.x >= town.x &&
    user.x < town.x + 8 &&
    user.y >= town.y &&
    user.y < town.y + 8
  );
  const sellableItems = (user?.inventory || []).filter(item => {
    const definition = getInventoryItemDefinition(item.id);
    const kind = definition?.kind || item.kind || 'material';
    return kind !== 'quest' && getInventoryItemSellValue(item) > 0;
  });
  const sellableGear = (user?.equipment || []).filter(item => !Object.values(user?.equippedSlots || {}).includes(item.id));
  const sellableMinions = user?.minions || [];
  const townPlayers = [
    ...(user && atTown ? [user] : []),
    ...getPlayersAtLocation(town.x, town.y).filter(player => player.username !== user?.username),
  ];

  const handleBuy = (offerId: string) => {
    if (!atTown) {
      setNotice('Walk into town before using the shop.');
      return;
    }

    const result = buyShopOffer(offerId, town.name);
    setNotice(result.success ? 'Bought.' : result.error || 'Purchase failed.');
    if (result.success) emitFxEvent({ type: 'city', tone: 'gold', intensity: 0.46 });
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  const handleSellItem = (itemId: string) => {
    if (!atTown) {
      setNotice('Walk into town before selling goods.');
      return;
    }

    const result = sellInventoryItem(itemId);
    setNotice(result.success ? result.message || 'Item sold.' : result.error || 'Sale failed.');
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  const handleSellGear = (equipmentId: string) => {
    if (!atTown) {
      setNotice('Walk into town before selling gear.');
      return;
    }

    const result = sellEquipmentItem(equipmentId);
    setNotice(result.success ? result.message || 'Gear sold.' : result.error || 'Sale failed.');
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  const handleSellUnit = (minionId: string) => {
    if (!atTown) {
      setNotice('Walk into town before selling units.');
      return;
    }

    const result = sellMinion(minionId);
    setNotice(result.success ? result.message || 'Unit sold.' : result.error || 'Sale failed.');
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  const handleTradeExchange = (exchangeId: string) => {
    if (!atTown) {
      setNotice('Walk into town before using the reliquary.');
      return;
    }

    const result = performTradeExchange(exchangeId);
    setNotice(result.success ? result.message || 'Exchange complete.' : result.error || 'Exchange failed.');
    if (result.success) emitFxEvent({ type: 'city', tone: 'violet', intensity: 0.52 });
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  const handleAcceptQuest = (questId: string) => {
    if (!atTown) {
      setNotice('Walk into town before taking contracts.');
      return;
    }

    const result = acceptCityQuest(questId, town.name);
    setNotice(result.success ? 'Contract accepted.' : result.error || 'Could not accept contract.');
    if (result.success) emitFxEvent({ type: 'quest', tone: 'violet', intensity: 0.46 });
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  const handleClaimQuest = (questId: string) => {
    if (!atTown) {
      setNotice('Walk into town before claiming contracts.');
      return;
    }

    const result = claimCityQuestReward(questId);
    setNotice(result.success ? 'Contract reward claimed.' : result.error || 'Could not claim contract.');
    setUser(getCurrentUser());
    if (result.success) {
      emitCompletionNotice({
        id: `town-contract-completion-${questId}`,
        kind: 'quest',
        kicker: town.name,
        title: cityQuests.find(quest => quest.id === questId)?.name || 'Contract Complete',
        description: 'The city board reward was claimed.',
        rewards: rewardSummaryToCompletionRewards(result.rewards),
      });
      window.setTimeout(onClose, 900);
    }
    window.setTimeout(() => setNotice(''), 2500);
  };

  const togglePanel = (panel: keyof typeof openPanels) => {
    setOpenPanels(current => ({ ...current, [panel]: !current[panel] }));
  };

  const handleAddForgeBonus = () => {
    if (!atTown) {
      setNotice('Walk into town before using the blacksmith.');
      return;
    }
    if (!selectedForgeItem) {
      setNotice('Select a piece of gear first.');
      return;
    }

    const result = addEquipmentSocketBonus(selectedForgeItem.id);
    setNotice(result.success ? 'Forge bonus added.' : result.error || 'Forge failed.');
    emitFxEvent({ type: result.success ? 'defense' : 'status', tone: result.success ? 'blue' : 'red', intensity: 0.48 });
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  const handleUpgradeForgeBonus = (bonusId: string) => {
    if (!atTown) {
      setNotice('Walk into town before using the blacksmith.');
      return;
    }
    if (!selectedForgeItem) {
      setNotice('Select a piece of gear first.');
      return;
    }

    const result = upgradeEquipmentSocketBonus(selectedForgeItem.id, bonusId);
    setNotice(result.success
      ? result.upgraded
        ? `Bonus upgraded to +${result.nextLevel}.`
        : `Forge failed. Bonus fell to +${result.nextLevel}.`
      : result.error || 'Forge failed.');
    emitFxEvent({ type: result.success && result.upgraded ? 'defense' : 'status', tone: result.success && result.upgraded ? 'blue' : 'red', intensity: 0.5 });
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-[82] bg-black"
      onClick={onClose}
    >
      <div
        className="relative h-full w-full"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={backgroundPath}
          alt={town.name}
          fill
          className="object-cover"
          priority
        />

        <div className="absolute inset-0 bg-black/15" />

        <div className="town-modal-layer">
          <div className="town-modal-top">
            <div className="command-panel vine-frame town-title-card overflow-hidden rounded border text-zinc-100">
              <div className="panel-header border-b px-5 py-4">
                <h1 className="fantasy-heading text-3xl">{town.name}</h1>
                <p className="arcane-label">Town</p>
                {town.description && (
                  <p className="ui-muted mt-2 text-xs font-bold">{town.description}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 text-center">
                <TownPill label="Access" value={atTown ? 'Here' : 'Travel'} />
                <TownPill label="Services" value="Board / Shop / Forge" />
              </div>
            </div>

            <button
              onClick={onClose}
              className="ui-button-danger rounded px-4 py-2 text-sm font-black transition"
            >
              Close
            </button>
          </div>

          <div className="town-notice-slot">
            {notice && <div className="ui-notice rounded border px-5 py-3 text-sm font-bold">{notice}</div>}
          </div>

          <div className="town-service-layout">
            <div className="command-panel vine-frame town-service-panel rounded border text-zinc-100">
              <TownSectionHeader
                title="City Quest Board"
                subtitle="Rotating contracts"
                open={openPanels.quests}
                onToggle={() => togglePanel('quests')}
              />
              {openPanels.quests && <div className="town-service-body space-y-3">
                {cityQuests.map(quest => {
                  const status = getCityQuestStatus(user, quest.id);
                  const progressPercent = Math.min(100, (status.progress / status.required) * 100);

                  return (
                    <div key={quest.id} className="town-board-card ui-card rounded border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-zinc-100">{quest.name}</div>
                          <div className="ui-accent text-xs font-bold">{quest.faction}</div>
                          <p className="ui-muted mt-1 text-xs font-bold">{quest.description}</p>
                          <p className="ui-faint mt-1 text-[11px] font-black uppercase">{getCityQuestRequirementText(quest)}</p>
                        </div>
                        <span className="ui-pill shrink-0 rounded border px-2 py-1 text-[10px] font-black text-[var(--ui-accent)]">
                          {status.progress}/{status.required}
                        </span>
                      </div>
                      {status.accepted && !status.claimed && (
                        <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
                          <div className="ui-progress-fill h-full" style={{ width: `${progressPercent}%` }} />
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="ui-muted text-[11px] font-bold">
                          {quest.rewards.gold ? `${quest.rewards.gold} gold` : ''}
                          {quest.rewards.exp ? ` / ${getBalancedQuestExp(quest.rewards.exp)} XP` : ''}
                          {quest.rewards.equipmentRarity ? ` / ${quest.rewards.equipmentRarity} gear` : ''}
                          {quest.rewards.minionTier ? ` / minion` : ''}
                        </div>
                        {!status.accepted && (
                          <button
                            onClick={() => handleAcceptQuest(quest.id)}
                            disabled={!atTown}
                            className="ui-button-primary rounded px-3 py-2 text-xs font-bold disabled:opacity-40"
                          >
                            Accept
                          </button>
                        )}
                        {status.accepted && !status.claimed && (
                          <button
                            onClick={() => handleClaimQuest(quest.id)}
                            disabled={!status.complete || !atTown}
                            className="ui-button-primary rounded px-3 py-2 text-xs font-bold disabled:opacity-40"
                          >
                            Claim
                          </button>
                        )}
                        {status.claimed && (
                          <span className="rounded border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-xs font-black text-emerald-200">
                            Done
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>

            <div className="command-panel vine-frame town-service-panel rounded border text-zinc-100">
              <TownSectionHeader
                title="Town Shop"
                subtitle={`${user?.gold || 0} gold - rotating stock`}
                open={openPanels.shop}
                onToggle={() => togglePanel('shop')}
              />
              {openPanels.shop && (
                <div className="town-service-body space-y-3">
                  {offers.map(offer => (
                    <div key={offer.id} className="town-board-card ui-card flex items-center gap-3 rounded border p-3">
                      <span className="ui-icon-frame relative h-14 w-14 shrink-0 overflow-hidden rounded border">
                        <Image
                          src={offer.imagePath}
                          alt={offer.name}
                          fill
                          className="object-contain p-1"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-zinc-100">{offer.name}</div>
                        <div className="ui-muted text-xs font-bold">{offer.description}</div>
                        <div className="ui-gold mt-1 text-xs font-black">{offer.price} gold</div>
                      </div>
                      <button
                        onClick={() => handleBuy(offer.id)}
                        disabled={!user || user.gold < offer.price || !atTown}
                        className="ui-button-primary rounded px-3 py-2 text-xs font-bold disabled:opacity-40"
                      >
                        Buy
                      </button>
                    </div>
                  ))}
                  <TownExchangePanel
                    offers={TRADE_EXCHANGE_OFFERS}
                    inventory={user?.inventory || []}
                    gold={user?.gold || 0}
                    atTown={atTown}
                    onExchange={handleTradeExchange}
                  />
                  <TownSellPanel
                    items={sellableItems}
                    equipment={sellableGear}
                    minions={sellableMinions}
                    atTown={atTown}
                    onSellItem={handleSellItem}
                    onSellGear={handleSellGear}
                    onSellUnit={handleSellUnit}
                  />
                </div>
              )}
            </div>

            <div className="command-panel vine-frame town-service-panel rounded border text-zinc-100">
              <TownSectionHeader
                title="Blacksmith"
                subtitle={`${user?.inventory?.find(item => item.id === 'rare-gem')?.quantity || 0} gems - socket and upgrade gear`}
                open={openPanels.blacksmith}
                onToggle={() => togglePanel('blacksmith')}
              />
              {openPanels.blacksmith && (
                <div className="town-service-body">
                  <BlacksmithPanel
                    equipment={forgeEquipment}
                    selectedItem={selectedForgeItem}
                    socketQuote={forgeSocketQuote}
                    atTown={atTown}
                    onSelect={setSelectedForgeItemId}
                    onAddBonus={handleAddForgeBonus}
                    onUpgradeBonus={handleUpgradeForgeBonus}
                  />
                </div>
              )}
            </div>

            <div className="command-panel vine-frame town-service-panel rounded border text-zinc-100">
              <div className="panel-header border-b px-5 py-4">
                <h2 className="fantasy-heading text-xl">Players Here</h2>
                <p className="arcane-label">Local presence</p>
              </div>
              <TownPlayersPanel players={townPlayers} currentUsername={user?.username} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TownPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-pill rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value text-sm font-black">{value}</div>
    </div>
  );
}

function TownSectionHeader({
  title,
  subtitle,
  open,
  onToggle,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="panel-header flex items-start justify-between gap-3 border-b px-5 py-4">
      <div>
        <h2 className="fantasy-heading text-xl">{title}</h2>
        <p className="arcane-label">{subtitle}</p>
      </div>
      <button onClick={onToggle} className="ui-button rounded px-3 py-2 text-[11px] font-black">
        {open ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function TownPlayersPanel({ players, currentUsername }: { players: User[]; currentUsername?: string }) {
  const otherPlayers = players.filter(player => player.username !== currentUsername);

  return (
    <div className="town-service-body space-y-3">
      {players.length === 0 ? (
        <div className="ui-empty rounded border border-dashed px-4 py-5 text-center text-sm font-bold">
          No one is gathered here.
        </div>
      ) : (
        <>
          {currentUsername && (
            <div className="town-player-row flex items-center gap-3 rounded px-3 py-2">
              <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                <Image src={getPlayerModelPath(players.find(player => player.username === currentUsername)?.selectedModel || 3)} alt="" fill className="player-model-art object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-zinc-100">{currentUsername}</span>
                <span className="ui-faint block text-[10px] font-bold">Your commander</span>
              </span>
            </div>
          )}

          {otherPlayers.length === 0 ? (
            <div className="ui-muted rounded bg-black/20 p-3 text-xs font-bold">No other players visible in town.</div>
          ) : (
            otherPlayers.map(player => (
              <div key={player.username} className="town-player-row flex items-center gap-3 rounded px-3 py-2">
                <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                  <Image src={getPlayerModelPath(player.selectedModel || 3)} alt={player.username} fill className="player-model-art object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-zinc-100">{player.username}</span>
                  <span className="ui-faint block text-[10px] font-bold">Lv {player.stats?.level || 1} - {player.minions?.length || 0} units</span>
                </span>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

const EQUIPMENT_ICON_BASE = '/assets/equipment';
const MINION_ICON_BASE = '/assets/minions';
const SOCKET_LABELS: Record<string, string> = {
  armyPower: 'Army',
  defensivePower: 'Ward',
  morale: 'Morale',
  spellPower: 'Spell',
  maxHealth: 'HP',
};

function getEquipmentIconPath(item: Pick<Equipment, 'slot' | 'rarity'>): string {
  return `${EQUIPMENT_ICON_BASE}/${item.slot}-${item.rarity}.png`;
}

function getInventoryIconPath(item: InventoryItem): string {
  return item.imagePath || getInventoryItemDefinition(item.id)?.imagePath || '/assets/icons/loot-chest.png';
}

function getInventoryQuantity(inventory: InventoryItem[], itemId: string): number {
  return inventory
    .filter(item => item.id === itemId)
    .reduce((total, item) => total + item.quantity, 0);
}

function getOfferCostText(offer: TradeExchangeOffer): string {
  const parts: string[] = [];
  if (offer.cost.gold) parts.push(`${offer.cost.gold}g`);
  (offer.cost.items || []).forEach(item => {
    const definition = getInventoryItemDefinition(item.itemId);
    parts.push(`${item.quantity} ${definition?.name || item.itemId}`);
  });
  return parts.join(' + ');
}

function getOfferRewardText(offer: TradeExchangeOffer): string {
  return offer.rewardItems
    .map(item => {
      const definition = getInventoryItemDefinition(item.itemId);
      return `${item.quantity} ${definition?.name || item.itemId}`;
    })
    .join(', ');
}

function canAffordExchange(offer: TradeExchangeOffer, inventory: InventoryItem[], gold: number): boolean {
  if (gold < (offer.cost.gold || 0)) return false;
  return (offer.cost.items || []).every(item => getInventoryQuantity(inventory, item.itemId) >= item.quantity);
}

function TownExchangePanel({
  offers,
  inventory,
  gold,
  atTown,
  onExchange,
}: {
  offers: TradeExchangeOffer[];
  inventory: InventoryItem[];
  gold: number;
  atTown: boolean;
  onExchange: (offerId: string) => void;
}) {
  return (
    <section className="town-exchange-panel border-t border-[rgba(232,217,184,0.14)] pt-4">
      <div className="mb-3">
        <h3 className="fantasy-heading text-base">Reliquary Exchange</h3>
        <p className="arcane-label">Trade goods into useful caches</p>
      </div>
      <div className="grid gap-2">
        {offers.map(offer => {
          const affordable = canAffordExchange(offer, inventory, gold);
          const rewardIcon = getInventoryItemDefinition(offer.rewardItems[0]?.itemId || '')?.imagePath || '/assets/icons/loot-chest.png';

          return (
            <button
              key={offer.id}
              onClick={() => onExchange(offer.id)}
              disabled={!atTown || !affordable}
              className="town-exchange-row flex items-center gap-3 rounded px-3 py-2 text-left disabled:opacity-40"
            >
              <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded">
                <Image src={rewardIcon} alt="" fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-zinc-100">{offer.name}</span>
                <span className="ui-muted block text-[10px] font-bold">{offer.description}</span>
                <span className="ui-faint block text-[10px] font-black">Cost: {getOfferCostText(offer)}</span>
              </span>
              <span className="ui-value max-w-28 text-right text-[10px] font-black">{getOfferRewardText(offer)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TownSellPanel({
  items,
  equipment,
  minions,
  atTown,
  onSellItem,
  onSellGear,
  onSellUnit,
}: {
  items: InventoryItem[];
  equipment: Equipment[];
  minions: MinionStack[];
  atTown: boolean;
  onSellItem: (itemId: string) => void;
  onSellGear: (equipmentId: string) => void;
  onSellUnit: (minionId: string) => void;
}) {
  const hasGoods = items.length > 0 || equipment.length > 0 || minions.length > 0;

  return (
    <section className="town-sell-panel border-t border-[rgba(232,217,184,0.14)] pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="fantasy-heading text-base">Sell Goods</h3>
          <p className="arcane-label">Items, spare gear, and reserve units</p>
        </div>
      </div>
      {!hasGoods ? (
        <div className="ui-muted rounded bg-black/20 p-3 text-xs font-bold">No sellable goods.</div>
      ) : (
        <div className="grid gap-2">
          {items.slice(0, 4).map(item => (
            <button
              key={`sell-item-${item.id}`}
              onClick={() => onSellItem(item.id)}
              disabled={!atTown}
              className="town-sell-row flex items-center gap-3 rounded px-3 py-2 text-left disabled:opacity-40"
            >
              <span className="ui-icon-frame relative h-9 w-9 shrink-0 overflow-hidden rounded">
                <Image src={getInventoryIconPath(item)} alt={item.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-zinc-100">{item.name}</span>
                <span className="ui-faint block text-[10px] font-bold">x{item.quantity}</span>
              </span>
              <span className="ui-gold text-xs font-black">{getInventoryItemSellValue(item)} gold</span>
            </button>
          ))}
          {equipment.slice(0, 4).map(item => (
            <button
              key={`sell-gear-${item.id}`}
              onClick={() => onSellGear(item.id)}
              disabled={!atTown}
              className="town-sell-row flex items-center gap-3 rounded px-3 py-2 text-left disabled:opacity-40"
            >
              <span className="ui-icon-frame relative h-9 w-9 shrink-0 overflow-hidden rounded">
                <Image src={getEquipmentIconPath(item)} alt={item.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-zinc-100">{item.name}</span>
                <span className="ui-faint block text-[10px] font-bold">{item.slot.replace('-', ' ')}</span>
              </span>
              <span className="ui-gold text-xs font-black">{getEquipmentSellValue(item)} gold</span>
            </button>
          ))}
          {minions.slice(0, 4).map(minion => {
            const template = getMinionTemplate(minion.templateId);
            return (
              <button
                key={`sell-unit-${minion.id}`}
                onClick={() => onSellUnit(minion.id)}
                disabled={!atTown}
                className="town-sell-row flex items-center gap-3 rounded px-3 py-2 text-left disabled:opacity-40"
              >
                <span className="ui-icon-frame relative h-9 w-9 shrink-0 overflow-hidden rounded">
                  {template && (
                    <Image src={`${MINION_ICON_BASE}/${template.assetName}`} alt={template.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-zinc-100">{template?.name || 'Unit'}</span>
                  <span className="ui-faint block text-[10px] font-bold">Reserve broker</span>
                </span>
                <span className="ui-gold text-xs font-black">{getMinionSellValue(minion)} gold</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatSocketBonus(bonus: EquipmentSocketBonus): string {
  const value = getEquipmentSocketBonusValue(bonus);
  return `+${value} ${SOCKET_LABELS[bonus.stat] || bonus.stat}`;
}

function BlacksmithPanel({
  equipment,
  selectedItem,
  socketQuote,
  atTown,
  onSelect,
  onAddBonus,
  onUpgradeBonus,
}: {
  equipment: Equipment[];
  selectedItem: Equipment | null;
  socketQuote: ReturnType<typeof getEquipmentSocketAddQuote>;
  atTown: boolean;
  onSelect: (itemId: string) => void;
  onAddBonus: () => void;
  onUpgradeBonus: (bonusId: string) => void;
}) {
  if (equipment.length === 0) {
    return <div className="ui-muted rounded border border-white/10 bg-black/20 p-3 text-xs font-bold">No gear available for forging.</div>;
  }

  const socketBonuses = selectedItem?.socketBonuses || [];

  return (
    <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
      <div className="text-center">
        <span className="forge-slot ui-icon-frame relative mx-auto flex h-24 w-24 overflow-hidden rounded-full border">
          {selectedItem && (
            <Image
              src={getEquipmentIconPath(selectedItem)}
              alt={selectedItem.name}
              fill
              className="object-contain p-3"
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </span>
        <div className="mt-2 text-sm font-black text-zinc-100">{selectedItem?.name || 'Select gear'}</div>
        <div className="ui-faint text-[10px] font-black uppercase">
          {socketQuote.usedSockets}/{socketQuote.socketLimit} slots
        </div>
        <button
          onClick={onAddBonus}
          disabled={!atTown || !selectedItem || socketQuote.maxed}
          className="ui-button-primary mt-3 rounded px-3 py-2 text-[11px] font-black disabled:opacity-40"
        >
          Add Bonus
        </button>
        {!socketQuote.maxed && (
          <div className="ui-muted mt-1 text-[10px] font-bold">
            {socketQuote.goldCost} gold / {socketQuote.gemCost} gem
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="grid gap-2">
          {socketBonuses.length === 0 ? (
            <div className="ui-muted rounded border border-white/10 bg-black/20 p-3 text-xs font-bold">
              Empty forge slots. Add a bonus with rare gems first.
            </div>
          ) : (
            socketBonuses.map(bonus => {
              const quote = getEquipmentSocketUpgradeQuote(bonus);
              return (
                <div key={bonus.id} className="rounded border border-white/10 bg-black/24 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-black text-zinc-100">{formatSocketBonus(bonus)}</div>
                      <div className="ui-faint text-[10px] font-bold">Level +{bonus.upgradeLevel}</div>
                    </div>
                    <button
                      onClick={() => onUpgradeBonus(bonus.id)}
                      disabled={!atTown || quote.maxed}
                      className="ui-button-primary rounded px-3 py-1.5 text-[10px] font-black disabled:opacity-40"
                    >
                      {quote.maxed ? 'Max' : `+${quote.nextLevel}`}
                    </button>
                  </div>
                  {!quote.maxed && (
                    <div className="ui-muted mt-1 text-[10px] font-bold">
                      {quote.goldCost} gold - {quote.successChance}% success
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {equipment.map(item => {
            const selected = selectedItem?.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`town-board-card flex w-full items-center gap-2 rounded border px-2 py-2 text-left ${selected ? 'border-[rgba(244,221,176,0.55)] bg-amber-950/20' : 'border-white/10 bg-black/20'}`}
              >
                <span className="ui-icon-frame relative h-10 w-10 shrink-0 overflow-hidden rounded border">
                  <Image src={getEquipmentIconPath(item)} alt={item.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-zinc-100">{item.name}</span>
                  <span className="ui-faint block text-[10px] font-bold">
                    {(item.socketBonuses || []).length}/{getEquipmentSocketLimit(item)} slots
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
