'use client';

import { buildQuestRewardChips } from '@/lib/rewardDisplay';
import RewardIconStrip from '@/components/RewardIconStrip';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useClock, usePolling } from '@/lib/hooks/usePolling';
import { keepIfUnchanged } from '@/lib/hooks/userSnapshot';
import Image from 'next/image';
import { ASSET_PATHS, getPlayerModelPath } from '@/lib/assetLoader';
import { playGameSound } from '@/lib/sound';
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
  getFieldedMinions,
  getCityQuestStatus,
  getCurrentUser,
  getBalancedQuestExp,
  getBalancedQuestGold,
  getEquipmentSocketAddQuote,
  getEquipmentSocketBonusValue,
  getEquipmentSocketLimit,
  getEquipmentSocketUpgradeQuote,
  getRotatingCityQuests,
  getTownShopOffers,
  getTownRecruitmentOffers,
  InventoryItem,
  MinionStack,
  RewardSummary,
  TRADE_EXCHANGE_OFFERS,
  type TradeExchangeOffer,
  type User,
  performTradeExchange,
  recruitTownWeeklyOffer,
  sellEquipmentItem,
  sellInventoryItem,
  sellMinion,
  treatInjuredArmyAtWard,
  salvageEquipmentToScrap,
  upgradeEquipmentSocketBonus,
} from '@/lib/auth';
import { BATTLE_SPELLS } from '@/lib/battle';
import { emitCompletionNotice, type CompletionRewardLine } from '@/lib/completionEvents';
import { emitFxEvent } from '@/lib/fxEvents';
import { POI } from '@/lib/mapData';
import { getGearSetById } from '@/lib/gearSets';
import { formatEquipmentQualityLabel } from '@/lib/gearProgression';
import { formatEquipmentRarityLabel, RUN_EQUIPMENT_SLOT_LABELS } from '@/lib/runEquipment';
import { getMultiplayerUnlockStatus, type MultiplayerUnlockStatus } from '@/lib/multiplayerUnlocks';
import MultiplayerFeatureLock from '@/components/MultiplayerFeatureLock';
import CinematicScrollShell from '@/components/CinematicScrollShell';

interface TownModalProps {
  town: POI | null;
  onClose: () => void;
  onTravel: () => void;
}

type TownServiceKey = 'quests' | 'shop' | 'blacksmith' | 'players';
type TownShopSection = 'buy' | 'exchange' | 'sell';
type TownSellCategory = 'items' | 'gear' | 'units';

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

function getCityQuestRequirementText(quest: {
  id?: string;
  town?: string;
  requirement: {
    type: string;
    count: number;
    itemId?: string;
    minDuration?: number;
    poiName?: string;
    minEnemyLevel?: number;
    maxEnemyLevel?: number;
    minDungeonLevel?: number;
  };
}): string {
  const { requirement } = quest;

  switch (requirement.type) {
    case 'complete_jobs':
      return `Complete ${requirement.count} ${quest.town || 'local'} job${requirement.count === 1 ? '' : 's'}.`;
    case 'complete_timed_jobs':
      return `Complete ${requirement.count} ${quest.town || 'local'} job${requirement.count === 1 ? '' : 's'} lasting ${Math.round((requirement.minDuration || 0) / 60000)}+ minutes.`;
    case 'complete_jobs_at_poi': {
      const duration = requirement.minDuration
        ? ` lasting ${Math.round(requirement.minDuration / 60000)}+ minutes`
        : '';
      return `Complete ${requirement.count} job${requirement.count === 1 ? '' : 's'} at ${requirement.poiName || 'the marked location'}${duration}.`;
    }
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
      return `Defeat ${requirement.count} enemy warband${requirement.count === 1 ? '' : 's'} on the world map.`;
    case 'defeat_enemies_level': {
      const minimum = requirement.minEnemyLevel || 1;
      const levelRange = requirement.maxEnemyLevel
        ? `levels ${minimum}-${requirement.maxEnemyLevel}`
        : `level ${minimum}+`;
      return `Defeat ${requirement.count} enemy warband${requirement.count === 1 ? '' : 's'} at ${levelRange}.`;
    }
    case 'clear_dungeons':
      return `Clear ${requirement.count} dungeon${requirement.count === 1 ? '' : 's'} at level ${requirement.minDungeonLevel || 1}+.`;
    case 'visit_poi':
      return `Reach ${requirement.poiName || 'the marked place'}.`;
    case 'visit_quest_npc':
      return 'Speak with the marked envoy on the world map.';
    case 'inspect_enemy':
      return 'Inspect the marked enemy warband.';
    case 'defeat_boss':
      return `Defeat the marked boss ${requirement.count} time${requirement.count === 1 ? '' : 's'}.`;
    default:
      return 'Complete the contract objective.';
  }
}

export default function TownModal({ town, onClose, onTravel }: TownModalProps) {
  const [user, setUser] = useState(getCurrentUser());
  const [notice, setNotice] = useState('');
  const [selectedForgeItemId, setSelectedForgeItemId] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<TownServiceKey>('quests');
  const [activeShopSection, setActiveShopSection] = useState<TownShopSection>('buy');
  const [activeSellCategory, setActiveSellCategory] = useState<TownSellCategory>('items');

  const isTownOpen = Boolean(town);
  const refreshUser = useCallback(() => {
    setUser(previous => keepIfUnchanged(previous, getCurrentUser()));
  }, []);
  usePolling(refreshUser, 1_000, { immediate: false });
  const now = useClock(1_000, isTownOpen);

  useEffect(() => {
    if (!town) return undefined;
    playGameSound('world.townEnter', { throttleMs: 220, volumeScale: 0.9 });
    document.body.classList.add('town-view-open');
    return () => {
      document.body.classList.remove('town-view-open');
      playGameSound('world.townLeave', { throttleMs: 220, volumeScale: 0.85 });
    };
  }, [town]);

  useEffect(() => {
    if (!town) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, town]);

  if (!town) return null;

  const harborStyleTowns = new Set(['Harborview', 'Blackwater Gate', 'Eclipse Hold']);
  const backgroundPath = harborStyleTowns.has(town.name)
    ? ASSET_PATHS.towns.harborviewBackground
    : ASSET_PATHS.towns.riversideBackground;
  const offers = getTownShopOffers(town.name);
  const recruitmentOffers = getTownRecruitmentOffers(town.name, user);
  const cityQuests = getRotatingCityQuests(town.name, now, 5, {
    claimedStoryQuestIds: (user?.storyQuests || [])
      .filter(progress => progress.claimed)
      .map(progress => progress.questId),
  });
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
  const equippedGearIds = new Set(Object.values(user?.equippedSlots || {}).filter(Boolean));
  const fieldedMinionIds = new Set(getFieldedMinions(user).map(minion => minion.id));
  const sellableGear = (user?.equipment || []).filter(item => !equippedGearIds.has(item.id));
  const lockedGear = (user?.equipment || []).filter(item => equippedGearIds.has(item.id));
  const sellableMinions = (user?.minions || []).filter(minion => !fieldedMinionIds.has(minion.id));
  const lockedMinions = (user?.minions || []).filter(minion => fieldedMinionIds.has(minion.id));
  const townPlayers = [
    ...(user && atTown ? [user] : []),
    ...getPlayersAtLocation(town.x, town.y).filter(player => player.username !== user?.username),
  ];
  const cityContractsUnlock = getMultiplayerUnlockStatus('city-contracts', user);
  const forgeUnlock = getMultiplayerUnlockStatus('gear-upgrades', user);
  const tradingUnlock = getMultiplayerUnlockStatus('trading', user);
  const townServices: Array<{ key: TownServiceKey; label: string; detail: string; unlock?: MultiplayerUnlockStatus }> = [
    { key: 'quests', label: 'Board', detail: cityContractsUnlock.unlocked ? `${cityQuests.length} contracts` : `Lv ${cityContractsUnlock.minLevel}`, unlock: cityContractsUnlock },
    { key: 'shop', label: 'Shop', detail: `${offers.length + recruitmentOffers.length} offers` },
    { key: 'blacksmith', label: 'Forge', detail: forgeUnlock.unlocked ? `${forgeEquipment.length} gear` : `Lv ${forgeUnlock.minLevel}`, unlock: forgeUnlock },
    { key: 'players', label: 'Players', detail: `${townPlayers.length} here` },
  ];

  const handleBuy = (offerId: string) => {
    if (!atTown) {
      setNotice('Walk into town before using the shop.');
      return;
    }

    const result = buyShopOffer(offerId, town.name);
    setNotice(result.success ? 'Bought.' : result.error || 'Purchase failed.');
    if (result.success) {
      playGameSound('inventory.coins', { throttleMs: 120 });
      emitFxEvent({ type: 'city', tone: 'gold', intensity: 0.46 });
    }
    setUser(getCurrentUser());
    window.setTimeout(() => setNotice(''), 2500);
  };

  const handleRecruit = (offerId: string) => {
    if (!atTown) {
      setNotice('Walk into town before signing a recruit.');
      return;
    }

    const result = recruitTownWeeklyOffer(offerId, town.name);
    setNotice(result.success
      ? `${result.minion ? getMinionTemplate(result.minion.templateId)?.name || 'Unit' : 'Unit'} recruited.`
      : result.error || 'Recruitment failed.');
    if (result.success) emitFxEvent({ type: 'city', tone: 'gold', intensity: 0.5 });
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
    if (result.success) playGameSound('inventory.goldGain', { throttleMs: 120 });
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
    if (result.success) playGameSound('inventory.goldGain', { throttleMs: 120 });
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
    if (result.success) playGameSound('inventory.goldGain', { throttleMs: 120 });
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
      playGameSound('quest.claim', { throttleMs: 140 });
      if (result.rewards?.gold) playGameSound('inventory.goldGain', { throttleMs: 140 });
      if (result.rewards?.rareGems) playGameSound('inventory.gemGain', { throttleMs: 140 });
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
      className="town-modal-root fixed inset-0 z-[82] bg-black"
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
          className="town-modal-bg object-cover"
          priority
        />

        <div className="town-modal-scrim absolute inset-0 bg-black/15" />

        <div className="town-modal-layer">
          <CinematicScrollShell
            variant="surface"
            className="town-left-column text-zinc-100"
            contentClassName="town-scroll-content"
          >
            <div className="town-modal-header command-panel vine-frame rounded border px-4 py-3 text-zinc-100">
              <div className="min-w-0">
                <h1 className="fantasy-heading truncate text-2xl">{town.name}</h1>
                <p className="arcane-label">
                  {atTown ? 'You are here' : user?.traveling ? 'Walking to town' : 'Away from town'}
                </p>
              </div>
              <div className="town-header-actions">
                {!atTown && (
                  <button
                    type="button"
                    onClick={onTravel}
                    disabled={!user || Boolean(user.traveling)}
                    className="town-header-button ui-button-primary rounded disabled:opacity-40"
                  >
                    {user?.traveling ? 'Walking' : 'Walk Here'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="town-header-button ui-button rounded"
                >
                  Close
                </button>
              </div>
            </div>

            {notice && (
              <div className="town-notice-slot">
                <div className="ui-notice rounded border px-4 py-2.5 text-sm font-bold">{notice}</div>
              </div>
            )}

            <div className="town-service-layout">
            <nav className="command-panel vine-frame town-service-menu rounded border p-2 text-zinc-100" aria-label="Town services">
              {townServices.map(service => (
                <button
                  key={service.key}
                  type="button"
                  onClick={() => setActiveService(service.key)}
                  aria-pressed={activeService === service.key}
                  className={`town-service-tab rounded px-3 py-2 ${activeService === service.key ? 'town-service-tab-active' : ''} ${service.unlock && !service.unlock.unlocked ? 'town-service-tab-locked' : ''}`}
                >
                  <span className="block text-sm font-black text-zinc-100">{service.label}</span>
                  <span className="ui-faint block text-[10px] font-black uppercase">{service.detail}</span>
                </button>
              ))}
            </nav>

            {activeService === 'quests' && (
            <div className="command-panel vine-frame town-service-panel rounded border text-zinc-100">
              <TownSectionHeader
                title="Quest Board"
                meta={`${cityQuests.length} contracts`}
                status={atTown ? 'Open' : 'Travel required'}
              />
              <div className="town-service-body no-scrollbar">
                {cityContractsUnlock.unlocked ? (
                  <CityQuestBoardPanel
                    quests={cityQuests}
                    user={user}
                    atTown={atTown}
                    onAccept={handleAcceptQuest}
                    onClaim={handleClaimQuest}
                  />
                ) : <MultiplayerFeatureLock status={cityContractsUnlock} compact />}
              </div>
            </div>
            )}

            {activeService === 'shop' && (
            <div className="command-panel vine-frame town-service-panel rounded border text-zinc-100">
              <TownSectionHeader
                title="Shop"
                meta={`${user?.gold || 0} gold`}
                status={atTown ? 'Open' : 'Travel required'}
              />
              <div className="town-service-body no-scrollbar space-y-3">
                <TownShopTabs active={activeShopSection} onChange={setActiveShopSection} tradingUnlock={tradingUnlock} />
                {activeShopSection === 'buy' && (
                  <TownBuyGrid
                    offers={offers}
                    recruitmentOffers={recruitmentOffers}
                    gold={user?.gold || 0}
                    playerLevel={user?.stats.level || 1}
                    atTown={atTown}
                    onBuy={handleBuy}
                    onRecruit={handleRecruit}
                  />
                )}
                {activeShopSection === 'exchange' && tradingUnlock.unlocked && (
                  <TownExchangePanel
                    offers={TRADE_EXCHANGE_OFFERS}
                    inventory={user?.inventory || []}
                    gold={user?.gold || 0}
                    atTown={atTown}
                    onExchange={handleTradeExchange}
                  />
                )}
                {activeShopSection === 'exchange' && !tradingUnlock.unlocked && (
                  <MultiplayerFeatureLock status={tradingUnlock} compact />
                )}
                {activeShopSection === 'sell' && (
                  <TownSellPanel
                    items={sellableItems}
                    equipment={sellableGear}
                    lockedEquipment={lockedGear}
                    minions={sellableMinions}
                    lockedMinions={lockedMinions}
                    activeCategory={activeSellCategory}
                    onCategoryChange={setActiveSellCategory}
                    atTown={atTown}
                    onSellItem={handleSellItem}
                    onSellGear={handleSellGear}
                    onSellUnit={handleSellUnit}
                  />
                )}
              </div>
            </div>
            )}

            {activeService === 'blacksmith' && (
            <div className="command-panel vine-frame town-service-panel rounded border text-zinc-100">
              <TownSectionHeader
                title="Forge"
                meta={`${user?.inventory?.find(item => item.id === 'rare-gem')?.quantity || 0} gems · ${user?.inventory?.find(item => item.id === 'set-scrap')?.quantity || 0} scrap`}
                status={atTown ? 'Open' : 'Travel required'}
              />
              <div className="town-service-body no-scrollbar">
                {atTown && (
                  <div className="mb-3 flex flex-wrap gap-2 px-1">
                    <button
                      type="button"
                      className="ui-button rounded px-3 py-2 text-xs font-black"
                      onClick={() => {
                        const result = treatInjuredArmyAtWard();
                        setNotice(result.success
                          ? `Injury ward treated ${result.treated} soldier${result.treated === 1 ? '' : 's'} (-${result.goldCost}g).`
                          : result.error || 'Ward unavailable.');
                        setUser(getCurrentUser());
                      }}
                    >
                      Injury Ward
                    </button>
                    {forgeEquipment.slice(0, 4).map(item => (
                      <button
                        key={`salvage-${item.id}`}
                        type="button"
                        className="ui-button rounded px-3 py-2 text-xs font-black"
                        onClick={() => {
                          const result = salvageEquipmentToScrap(item.id);
                          setNotice(result.success
                            ? `Salvaged for ${result.scrapGained} set scrap.`
                            : result.error || 'Could not salvage.');
                          setUser(getCurrentUser());
                        }}
                      >
                        Salvage {item.name.slice(0, 14)}
                      </button>
                    ))}
                  </div>
                )}
                {forgeUnlock.unlocked ? (
                  <BlacksmithPanel
                    equipment={forgeEquipment}
                    selectedItem={selectedForgeItem}
                    socketQuote={forgeSocketQuote}
                    atTown={atTown}
                    onSelect={setSelectedForgeItemId}
                    onAddBonus={handleAddForgeBonus}
                    onUpgradeBonus={handleUpgradeForgeBonus}
                  />
                ) : <MultiplayerFeatureLock status={forgeUnlock} compact />}
              </div>
            </div>
            )}

            {activeService === 'players' && (
            <div className="command-panel vine-frame town-service-panel rounded border text-zinc-100">
              <TownSectionHeader title="Travelers" meta={`${townPlayers.length} visible`} status={town.name} />
              <TownPlayersPanel players={townPlayers} currentUsername={user?.username} />
            </div>
            )}
          </div>
          </CinematicScrollShell>
        </div>
      </div>
    </div>
  );
}

function TownShopTabs({
  active,
  onChange,
  tradingUnlock,
}: {
  active: TownShopSection;
  onChange: (section: TownShopSection) => void;
  tradingUnlock: MultiplayerUnlockStatus;
}) {
  const tabs: Array<{ id: TownShopSection; label: string }> = [
    { id: 'buy', label: 'Buy' },
    { id: 'exchange', label: 'Exchange' },
    { id: 'sell', label: 'Sell' },
  ];

  return (
    <div className="town-shop-tabs rounded">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-pressed={active === tab.id}
          className={`town-shop-tab rounded ${active === tab.id ? 'town-shop-tab-active' : ''} ${tab.id === 'exchange' && !tradingUnlock.unlocked ? 'town-shop-tab-locked' : ''}`}
        >
          {tab.id === 'exchange' && !tradingUnlock.unlocked ? `${tab.label} Lv ${tradingUnlock.minLevel}` : tab.label}
        </button>
      ))}
    </div>
  );
}

function TownSectionHeader({
  title,
  meta,
  status,
}: {
  title: string;
  meta?: string;
  status?: string;
}) {
  return (
    <div className="panel-header town-section-header flex items-center justify-between gap-3 border-b px-5 py-3">
      <h2 className="fantasy-heading text-xl">{title}</h2>
      <div className="town-section-header-meta">
        {status ? <span className="town-section-status">{status}</span> : null}
        {meta ? (
          <span className="ui-pill shrink-0 rounded border px-3 py-1 text-[10px] font-black uppercase">
            {meta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TownPlayersPanel({ players, currentUsername }: { players: User[]; currentUsername?: string }) {
  const currentPlayer = players.find(player => player.username === currentUsername);
  const otherPlayers = players.filter(player => player.username !== currentUsername);

  return (
    <div className="town-service-body no-scrollbar space-y-3">
      {players.length === 0 ? (
        <div className="ui-empty rounded border border-dashed px-4 py-5 text-center text-sm font-bold">
          No one is gathered here.
        </div>
      ) : (
        <>
          {currentPlayer && (
            <div className="town-player-row flex items-center gap-3 rounded px-3 py-2">
              <span className="ui-icon-frame relative block h-10 w-10 shrink-0 overflow-hidden rounded border">
                <Image
                  src={getPlayerModelPath(currentPlayer.selectedModel || 3)}
                  alt=""
                  fill
                  sizes="40px"
                  unoptimized
                  className="player-model-art object-contain"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-zinc-100">{currentPlayer.username}</span>
                <span className="ui-faint block text-[10px] font-bold">Your commander</span>
              </span>
            </div>
          )}

          {otherPlayers.map(player => (
              <div key={player.username} className="town-player-row flex items-center gap-3 rounded px-3 py-2">
                <span className="ui-icon-frame relative block h-10 w-10 shrink-0 overflow-hidden rounded border">
                  <Image
                    src={getPlayerModelPath(player.selectedModel || 3)}
                    alt={player.username}
                    fill
                    sizes="40px"
                    unoptimized
                    className="player-model-art object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-zinc-100">{player.username}</span>
                  <span className="ui-faint block text-[10px] font-bold">Lv {player.stats?.level || 1} - {player.minions?.length || 0} units</span>
                </span>
              </div>
            ))}
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

function formatSocketBonus(bonus: EquipmentSocketBonus): string {
  const value = getEquipmentSocketBonusValue(bonus);
  return `+${value} ${SOCKET_LABELS[bonus.stat] || bonus.stat}`;
}

function getGearStatLines(item: Equipment): string[] {
  const lines: string[] = [];
  const stats = item.stats || {};
  const quality = formatEquipmentQualityLabel(item);

  if (quality) lines.push(`Quality ${quality}`);
  if (stats.armyPower) lines.push(`Army +${stats.armyPower}`);
  if (stats.defensivePower) lines.push(`Ward +${stats.defensivePower}`);
  if (stats.morale) lines.push(`Morale +${stats.morale}`);
  if (stats.spellPower) lines.push(`Spell +${stats.spellPower}`);
  if (stats.maxHealth) lines.push(`Max HP +${stats.maxHealth}`);
  (item.socketBonuses || []).forEach(bonus => lines.push(`Forge ${formatSocketBonus(bonus)}`));

  const setName = item.gearSetId ? getGearSetById(item.gearSetId)?.name : undefined;
  if (setName) lines.push(`${setName} set piece`);
  if (item.passive) lines.push(item.passive);

  return lines.length > 0 ? lines : ['No bonus stats'];
}

function getMinionStatLines(template: ReturnType<typeof getMinionTemplate>): string[] {
  if (!template) return ['Unknown unit'];
  return [
    `${template.role} · ${template.tier}`,
    `ATK ${template.stats.attack} · DEF ${template.stats.defense}`,
    `HP ${template.stats.health} · RNG ${template.stats.range}`,
  ];
}

function getCityQuestPhase(status: ReturnType<typeof getCityQuestStatus>): {
  label: string;
  tone: 'neutral' | 'active' | 'ready' | 'done';
} {
  if (status.claimed) return { label: 'Complete', tone: 'done' };
  if (status.complete) return { label: 'Ready to claim', tone: 'ready' };
  if (status.accepted) return { label: 'In progress', tone: 'active' };
  return { label: 'Available', tone: 'neutral' };
}

function TownHoverPopover({
  title,
  subtitle,
  lines,
  footer,
}: {
  title: string;
  subtitle?: string;
  lines?: string[];
  footer?: string;
}) {
  return (
    <div className="town-grid-popover command-panel vine-frame rounded border p-3 text-zinc-100">
      <div className="text-sm font-black text-zinc-100">{title}</div>
      {subtitle && <div className="ui-accent mt-1 text-[11px] font-bold">{subtitle}</div>}
      {lines && lines.length > 0 && (
        <ul className="ui-muted mt-2 space-y-1 text-[11px] font-bold">
          {lines.map(line => <li key={line}>{line}</li>)}
        </ul>
      )}
      {footer && <div className="ui-gold mt-2 text-[11px] font-black">{footer}</div>}
    </div>
  );
}

function TownGridCell({
  icon,
  label,
  meta,
  actionLabel,
  ariaLabel,
  locked,
  lockLabel = 'Locked',
  disabled,
  onClick,
  popover,
}: {
  icon: ReactNode;
  label: string;
  meta?: string;
  actionLabel?: string;
  ariaLabel?: string;
  locked?: boolean;
  lockLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  popover?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="town-grid-cell-wrap"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={locked ? undefined : onClick}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={ariaLabel}
        aria-disabled={locked || undefined}
        className={`town-grid-cell ${locked ? 'town-grid-cell-locked' : ''} ${disabled ? 'town-grid-cell-disabled' : ''}`}
      >
        <span className="town-grid-cell-icon">{icon}</span>
        <span className="town-grid-cell-label">{label}</span>
        {meta && <span className="town-grid-cell-meta">{meta}</span>}
        {!locked && actionLabel && <span className="town-grid-cell-action">{actionLabel}</span>}
        {locked && <span className="town-grid-cell-lock">{lockLabel}</span>}
      </button>
      {hovered && popover}
    </div>
  );
}

function CityQuestBoardPanel({
  quests,
  user,
  atTown,
  onAccept,
  onClaim,
}: {
  quests: ReturnType<typeof getRotatingCityQuests>;
  user: User | null;
  atTown: boolean;
  onAccept: (questId: string) => void;
  onClaim: (questId: string) => void;
}) {
  return (
    <div className="town-quest-board space-y-3">
      {quests.map(quest => {
        const status = getCityQuestStatus(user, quest.id);
        const phase = getCityQuestPhase(status);
        const progressPercent = status.required > 0
          ? Math.min(100, (status.progress / status.required) * 100)
          : 0;

        return (
          <article key={quest.id} className={`town-quest-card town-quest-card-${phase.tone}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-black text-zinc-100">{quest.name}</h3>
                  <span className={`town-quest-phase town-quest-phase-${phase.tone}`}>{phase.label}</span>
                </div>
              </div>
              <span className="ui-pill shrink-0 rounded border px-2 py-1 text-xs font-black">
                {status.progress}/{status.required}
              </span>
            </div>

            <div className="town-quest-objective mt-3 rounded border px-3 py-2.5">
              <p className="text-sm font-bold leading-snug text-zinc-100">{getCityQuestRequirementText(quest)}</p>
            </div>

            {status.accepted && !status.claimed && (
              <div className="ui-progress-track mt-3 h-2 overflow-hidden rounded border">
                <div className="ui-progress-fill h-full" style={{ width: `${progressPercent}%` }} />
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <RewardIconStrip
                chips={buildQuestRewardChips(quest.rewards, {
                  formatExp: value => getBalancedQuestExp(value, user?.stats.level || 1, 'contract'),
                  formatGold: value => getBalancedQuestGold(value, user?.stats.level || 1, 'contract'),
                })}
              />
              {!status.accepted && (
                <button
                  type="button"
                  onClick={() => onAccept(quest.id)}
                  disabled={!atTown}
                  className="ui-button-primary rounded px-4 py-2 text-xs font-black disabled:opacity-40"
                >
                  Accept Contract
                </button>
              )}
              {status.accepted && !status.claimed && (
                <button
                  type="button"
                  onClick={() => onClaim(quest.id)}
                  disabled={!status.complete || !atTown}
                  className="ui-button-primary rounded px-4 py-2 text-xs font-black disabled:opacity-40"
                >
                  {status.complete ? 'Claim Reward' : 'Objective Incomplete'}
                </button>
              )}
              {status.claimed && (
                <span className="rounded border border-emerald-500/40 bg-emerald-950/50 px-4 py-2 text-xs font-black text-emerald-200">
                  Reward Claimed
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TownBuyGrid({
  offers,
  recruitmentOffers,
  gold,
  playerLevel,
  atTown,
  onBuy,
  onRecruit,
}: {
  offers: ReturnType<typeof getTownShopOffers>;
  recruitmentOffers: ReturnType<typeof getTownRecruitmentOffers>;
  gold: number;
  playerLevel: number;
  atTown: boolean;
  onBuy: (offerId: string) => void;
  onRecruit: (offerId: string) => void;
}) {
  if (offers.length === 0 && recruitmentOffers.length === 0) {
    return <div className="ui-muted rounded bg-black/20 p-3 text-xs font-bold">No offers today.</div>;
  }

  return (
    <div className="space-y-4">
      {recruitmentOffers.length > 0 && (
        <section className="town-weekly-muster">
          <div className="town-subsection-heading mb-2">
            <div>
              <h3 className="fantasy-heading text-base">Weekly Muster</h3>
              <p className="ui-faint text-[10px] font-black uppercase">One contract per slot</p>
            </div>
            <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase">
              {formatRecruitmentReset(recruitmentOffers[0]?.resetsAt)}
            </span>
          </div>
          <div className="town-item-grid">
            {recruitmentOffers.map(offer => {
              const canBuy = atTown && offer.unlocked && !offer.claimed && gold >= offer.price;
              const lockLabel = offer.claimed ? 'Signed' : `Lv ${offer.minLevel}`;
              return (
                <TownGridCell
                  key={offer.offerId}
                  label={offer.name}
                  meta={`${offer.tier === 'tier2' ? 'Tier II' : 'Tier I'} - ${offer.price}g`}
                  actionLabel={!atTown ? 'Travel here' : gold >= offer.price ? 'Recruit' : `Need ${offer.price - gold}g`}
                  ariaLabel={`${offer.name}, weekly ${offer.tier} recruit for ${offer.price} gold`}
                  locked={offer.claimed || !offer.unlocked}
                  lockLabel={lockLabel}
                  disabled={!canBuy}
                  onClick={() => onRecruit(offer.offerId)}
                  icon={(
                    <span className="ui-icon-frame relative block h-12 w-12 shrink-0 overflow-hidden rounded border">
                      <Image src={offer.imagePath} alt={offer.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                    </span>
                  )}
                  popover={(
                    <TownHoverPopover
                      title={offer.name}
                      subtitle={`${offer.tier === 'tier2' ? 'Tier II specialist' : 'Tier I reserve'} - weekly`}
                      lines={[offer.description, offer.claimed ? 'Already signed this week' : offer.unlocked ? 'Available until the weekly reset' : `Unlocks at level ${offer.minLevel}`]}
                      footer={`${offer.price} gold`}
                    />
                  )}
                />
              );
            })}
          </div>
        </section>
      )}

      {offers.length > 0 && (
        <section>
          <div className="town-subsection-heading mb-2">
            <h3 className="fantasy-heading text-base">Market Stock</h3>
            <span className="ui-faint text-[10px] font-black uppercase">Rotates every 2 hours</span>
          </div>
          <div className="town-item-grid">
            {offers.map(offer => {
              const levelLocked = playerLevel < (offer.minLevel || 1);
              const canBuy = atTown && !levelLocked && gold >= offer.price;
              return (
                <TownGridCell
                  key={offer.id}
                  label={offer.name}
                  meta={`${offer.price}g`}
                  actionLabel={levelLocked ? undefined : !atTown ? 'Travel here' : gold >= offer.price ? 'Buy' : `Need ${offer.price - gold}g`}
                  ariaLabel={`${offer.name}, ${offer.price} gold. ${!atTown ? 'Travel to town to buy' : gold >= offer.price ? 'Buy' : `Need ${offer.price - gold} more gold`}`}
                  locked={levelLocked}
                  lockLabel={`Lv ${offer.minLevel}`}
                  disabled={!canBuy}
                  onClick={() => onBuy(offer.id)}
                  icon={(
                    <span className="ui-icon-frame relative block h-12 w-12 shrink-0 overflow-hidden rounded border">
                      <Image src={offer.imagePath} alt={offer.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                    </span>
                  )}
                  popover={(
                    <TownHoverPopover
                      title={offer.name}
                      subtitle="Shop offer"
                      lines={[offer.description, levelLocked ? `Requires level ${offer.minLevel}` : gold < offer.price ? `Need ${offer.price - gold} more gold` : 'Click to purchase']}
                      footer={`${offer.price} gold`}
                    />
                  )}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function formatRecruitmentReset(resetsAt: number | undefined): string {
  if (!resetsAt) return 'Weekly';
  const remainingHours = Math.max(1, Math.ceil((resetsAt - Date.now()) / (60 * 60 * 1000)));
  const days = Math.floor(remainingHours / 24);
  const hours = remainingHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
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
      <div className="town-subsection-heading mb-3">
        <h3 className="fantasy-heading text-base">Reliquary Exchange</h3>
        <span className="arcane-label">{offers.length} trades</span>
      </div>
      <div className="grid gap-2">
        {offers.map(offer => {
          const affordable = canAffordExchange(offer, inventory, gold);
          const rewardIcon = getInventoryItemDefinition(offer.rewardItems[0]?.itemId || '')?.imagePath || '/assets/icons/loot-chest.png';

          return (
            <article key={offer.id} className="town-exchange-row rounded px-3 py-2">
              <span className="ui-icon-frame relative block h-10 w-10 shrink-0 overflow-hidden rounded">
                <Image src={rewardIcon} alt="" fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
              </span>
              <div className="min-w-0">
                <span className="block truncate text-xs font-black text-zinc-100">{offer.name}</span>
                <span className="ui-muted block truncate text-[10px] font-bold">{offer.description}</span>
              </div>
              <div className="town-exchange-values" aria-label={`Costs ${getOfferCostText(offer)} and rewards ${getOfferRewardText(offer)}`}>
                <span>
                  <span className="town-value-label">Cost</span>
                  <strong>{getOfferCostText(offer)}</strong>
                </span>
                <span className="town-exchange-arrow" aria-hidden="true">-&gt;</span>
                <span>
                  <span className="town-value-label">Receive</span>
                  <strong>{getOfferRewardText(offer)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onExchange(offer.id)}
                className={`town-exchange-action ui-button-primary rounded px-3 py-2 text-[10px] font-black ${!atTown || !affordable ? 'town-action-unavailable' : ''}`}
              >
                {!atTown ? 'Travel here' : affordable ? 'Exchange' : 'Need goods'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TownSellPanel({
  items,
  equipment,
  lockedEquipment,
  minions,
  lockedMinions,
  activeCategory,
  onCategoryChange,
  atTown,
  onSellItem,
  onSellGear,
  onSellUnit,
}: {
  items: InventoryItem[];
  equipment: Equipment[];
  lockedEquipment: Equipment[];
  minions: MinionStack[];
  lockedMinions: MinionStack[];
  activeCategory: TownSellCategory;
  onCategoryChange: (category: TownSellCategory) => void;
  atTown: boolean;
  onSellItem: (itemId: string) => void;
  onSellGear: (equipmentId: string) => void;
  onSellUnit: (minionId: string) => void;
}) {
  const categories: Array<{ id: TownSellCategory; label: string; count: number }> = [
    { id: 'items', label: 'Items', count: items.length },
    { id: 'gear', label: 'Gear', count: equipment.length + lockedEquipment.length },
    { id: 'units', label: 'Units', count: minions.length + lockedMinions.length },
  ];

  const renderLockedGear = activeCategory === 'gear' && lockedEquipment.length > 0;
  const renderLockedUnits = activeCategory === 'units' && lockedMinions.length > 0;

  return (
    <section className="town-sell-panel border-t border-[rgba(232,217,184,0.14)] pt-4">
      <div className="town-subsection-heading mb-3">
        <h3 className="fantasy-heading text-base">Sell Goods</h3>
        <span className="arcane-label">Spare stock only</span>
      </div>

      <div className="town-shop-tabs mb-3 rounded">
        {categories.map(category => (
          <button
            key={category.id}
            type="button"
            onClick={() => onCategoryChange(category.id)}
            aria-pressed={activeCategory === category.id}
            className={`town-shop-tab rounded ${activeCategory === category.id ? 'town-shop-tab-active' : ''}`}
          >
            {category.label} ({category.count})
          </button>
        ))}
      </div>

      {activeCategory === 'items' && (
        items.length === 0 ? (
          <div className="ui-muted rounded bg-black/20 p-3 text-xs font-bold">No sellable items in your pack.</div>
        ) : (
          <div className="town-item-grid">
            {items.map(item => (
              <TownGridCell
                key={`sell-item-${item.id}-${item.quantity}`}
                label={item.name}
                meta={`${getInventoryItemSellValue(item)}g`}
                actionLabel={atTown ? 'Sell' : 'Travel here'}
                ariaLabel={`${item.name}, sell for ${getInventoryItemSellValue(item)} gold`}
                disabled={!atTown}
                onClick={() => onSellItem(item.id)}
                icon={(
                  <span className="ui-icon-frame relative block h-12 w-12 shrink-0 overflow-hidden rounded border">
                    <Image src={getInventoryIconPath(item)} alt={item.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                  </span>
                )}
                popover={(
                  <TownHoverPopover
                    title={item.name}
                    subtitle={getInventoryItemDefinition(item.id)?.kind || item.kind || 'material'}
                    lines={[
                      getInventoryItemDefinition(item.id)?.description || 'Stackable goods',
                      `Quantity: ${item.quantity}`,
                    ]}
                    footer={`Sell for ${getInventoryItemSellValue(item)} gold`}
                  />
                )}
              />
            ))}
          </div>
        )
      )}

      {activeCategory === 'gear' && (
        <>
          {equipment.length === 0 && lockedEquipment.length === 0 ? (
            <div className="ui-muted rounded bg-black/20 p-3 text-xs font-bold">No spare gear to sell.</div>
          ) : (
            <div className="town-item-grid">
              {equipment.map(item => (
                <TownGridCell
                  key={`sell-gear-${item.id}`}
                  label={item.name}
                  meta={`${getEquipmentSellValue(item)}g`}
                  actionLabel={atTown ? 'Sell' : 'Travel here'}
                  ariaLabel={`${item.name}, sell for ${getEquipmentSellValue(item)} gold`}
                  disabled={!atTown}
                  onClick={() => onSellGear(item.id)}
                  icon={(
                    <span className="ui-icon-frame relative block h-12 w-12 shrink-0 overflow-hidden rounded border">
                      <Image src={getEquipmentIconPath(item)} alt={item.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                    </span>
                  )}
                  popover={(
                    <TownHoverPopover
                      title={item.name}
                      subtitle={`${formatEquipmentRarityLabel(item.rarity)} ${RUN_EQUIPMENT_SLOT_LABELS[item.slot]}`}
                      lines={getGearStatLines(item)}
                      footer={`Sell for ${getEquipmentSellValue(item)} gold`}
                    />
                  )}
                />
              ))}
              {lockedEquipment.map(item => (
                <TownGridCell
                  key={`locked-gear-${item.id}`}
                  label={item.name}
                  meta="Equipped"
                  locked
                  lockLabel="Equipped"
                  icon={(
                    <span className="ui-icon-frame relative block h-12 w-12 shrink-0 overflow-hidden rounded border">
                      <Image src={getEquipmentIconPath(item)} alt={item.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                    </span>
                  )}
                  popover={(
                    <TownHoverPopover
                      title={item.name}
                      subtitle="Currently equipped"
                      lines={[...getGearStatLines(item), 'Unequip this piece before selling it.']}
                    />
                  )}
                />
              ))}
            </div>
          )}
          {renderLockedGear && (
            <p className="ui-muted mt-3 text-[11px] font-bold">
              {lockedEquipment.length} equipped piece{lockedEquipment.length === 1 ? '' : 's'} are locked until unequipped.
            </p>
          )}
        </>
      )}

      {activeCategory === 'units' && (
        <>
          {minions.length === 0 && lockedMinions.length === 0 ? (
            <div className="ui-muted rounded bg-black/20 p-3 text-xs font-bold">No reserve units to sell.</div>
          ) : (
            <div className="town-item-grid">
              {minions.map(minion => {
                const template = getMinionTemplate(minion.templateId);
                return (
                  <TownGridCell
                    key={`sell-unit-${minion.id}`}
                    label={template?.name || 'Unit'}
                    meta={`${getMinionSellValue(minion)}g`}
                    actionLabel={atTown ? 'Sell' : 'Travel here'}
                    ariaLabel={`${template?.name || 'Unit'}, sell for ${getMinionSellValue(minion)} gold`}
                    disabled={!atTown}
                    onClick={() => onSellUnit(minion.id)}
                    icon={(
                      <span className="ui-icon-frame relative block h-12 w-12 shrink-0 overflow-hidden rounded border">
                        {template && (
                          <Image src={`${MINION_ICON_BASE}/${template.assetName}`} alt={template.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                        )}
                      </span>
                    )}
                    popover={(
                      <TownHoverPopover
                        title={template?.name || 'Unit'}
                        subtitle={`Reserve stack x${minion.quantity}`}
                        lines={getMinionStatLines(template)}
                        footer={`Sell for ${getMinionSellValue(minion)} gold`}
                      />
                    )}
                  />
                );
              })}
              {lockedMinions.map(minion => {
                const template = getMinionTemplate(minion.templateId);
                return (
                  <TownGridCell
                    key={`locked-unit-${minion.id}`}
                    label={template?.name || 'Unit'}
                    meta="Active"
                    locked
                    lockLabel="Roster"
                    icon={(
                      <span className="ui-icon-frame relative block h-12 w-12 shrink-0 overflow-hidden rounded border">
                        {template && (
                          <Image src={`${MINION_ICON_BASE}/${template.assetName}`} alt={template.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                        )}
                      </span>
                    )}
                    popover={(
                      <TownHoverPopover
                        title={template?.name || 'Unit'}
                        subtitle="Fielded on your active roster"
                        lines={[...getMinionStatLines(template), 'Remove from the active roster before selling.']}
                      />
                    )}
                  />
                );
              })}
            </div>
          )}
          {renderLockedUnits && (
            <p className="ui-muted mt-3 text-[11px] font-bold">
              {lockedMinions.length} active roster unit{lockedMinions.length === 1 ? '' : 's'} cannot be sold while fielded.
            </p>
          )}
        </>
      )}
    </section>
  );
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
    <div className="town-forge-layout">
      <div className="town-forge-detail ui-card rounded border p-4">
        <div className="flex items-start gap-4">
          <span className="forge-slot ui-icon-frame relative block h-24 w-24 shrink-0 overflow-hidden rounded-full border">
            {selectedItem && (
              <Image
                src={getEquipmentIconPath(selectedItem)}
                alt={selectedItem.name}
                fill
                sizes="96px"
                unoptimized
                className="object-contain p-3"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black text-zinc-100">{selectedItem?.name || 'Select gear'}</div>
            {selectedItem && (
              <>
                <div className="ui-accent mt-1 text-[11px] font-black uppercase">
                  {formatEquipmentRarityLabel(selectedItem.rarity)} {RUN_EQUIPMENT_SLOT_LABELS[selectedItem.slot]}
                </div>
                <ul className="ui-muted mt-2 space-y-1 text-[11px] font-bold">
                  {getGearStatLines(selectedItem).map(line => <li key={line}>{line}</li>)}
                </ul>
              </>
            )}
            <div className="ui-faint mt-3 text-[10px] font-black uppercase">
              {socketQuote.usedSockets}/{socketQuote.socketLimit} forge slots used
            </div>
          </div>
        </div>

        <div className="town-forge-primary-action mt-4">
          <button
            type="button"
            onClick={onAddBonus}
            disabled={!atTown || !selectedItem || socketQuote.maxed}
            className="ui-button-primary rounded px-4 py-2 text-xs font-black disabled:opacity-40"
          >
            Add Forge Bonus
          </button>
          {!socketQuote.maxed && selectedItem && (
            <span className="town-forge-price ui-muted text-[11px] font-bold">
              <span className="town-value-label">Cost</span>
              {socketQuote.goldCost} gold · {socketQuote.gemCost} rare gem
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="arcane-label text-[10px]">Installed bonuses</div>
          {socketBonuses.length === 0 ? (
            <div className="ui-muted rounded border border-white/10 bg-black/20 p-3 text-xs font-bold">
              No forge bonuses installed.
            </div>
          ) : (
            socketBonuses.map(bonus => {
              const quote = getEquipmentSocketUpgradeQuote(bonus);
              return (
                <div key={bonus.id} className="town-forge-bonus-row rounded border px-3 py-2">
                  <div className="town-forge-bonus-main">
                    <div>
                      <div className="text-xs font-black text-zinc-100">{formatSocketBonus(bonus)}</div>
                      <div className="ui-faint text-[10px] font-bold">Upgrade level +{bonus.upgradeLevel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpgradeBonus(bonus.id)}
                      disabled={!atTown || quote.maxed}
                      className="ui-button-primary rounded px-3 py-1.5 text-[10px] font-black disabled:opacity-40"
                    >
                      {quote.maxed ? 'Maxed' : `Upgrade to +${quote.nextLevel}`}
                    </button>
                  </div>
                  {!quote.maxed && (
                    <div className="town-forge-upgrade-terms ui-muted mt-2 text-[10px] font-bold">
                      <span className="town-value-label">Cost / chance</span>
                      {quote.goldCost} gold · {quote.successChance}% success
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 arcane-label text-[10px]">Select gear to forge</div>
        <div className="town-item-grid town-forge-grid">
          {equipment.map(item => {
            const selected = selectedItem?.id === item.id;
            return (
              <TownGridCell
                key={item.id}
                label={item.name}
                meta={`${(item.socketBonuses || []).length}/${getEquipmentSocketLimit(item)}`}
                actionLabel={selected ? 'Selected' : 'Select'}
                ariaLabel={`${item.name}, ${(item.socketBonuses || []).length} of ${getEquipmentSocketLimit(item)} forge slots${selected ? ', selected' : ''}`}
                onClick={() => onSelect(item.id)}
                icon={(
                  <span className={`ui-icon-frame relative block h-12 w-12 shrink-0 overflow-hidden rounded border ${selected ? 'ring-2 ring-amber-200/50' : ''}`}>
                    <Image
                      src={getEquipmentIconPath(item)}
                      alt={item.name}
                      fill
                      sizes="48px"
                      unoptimized
                      className="object-contain p-1"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </span>
                )}
                popover={(
                  <TownHoverPopover
                    title={item.name}
                    subtitle={`${formatEquipmentRarityLabel(item.rarity)} · ${(item.socketBonuses || []).length}/${getEquipmentSocketLimit(item)} slots`}
                    lines={getGearStatLines(item)}
                    footer={selected ? 'Selected for forging' : 'Click to select'}
                  />
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
