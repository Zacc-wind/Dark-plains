'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Equipment,
  EquipmentSlot,
  MINION_CLASS_LABELS,
  MINION_TIER_LABELS,
  MinionTier,
  equipItem,
  getCurrentUser,
  getInventoryUsedSlots,
  getMinionTemplate,
  unequipItem,
} from '@/lib/auth';

interface InventoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const EQUIPMENT_ICON_BASE = '/assets/equipment';
const MINION_ICON_BASE = '/assets/minions';
const equipmentLayout: EquipmentSlot[][] = [
  ['sword', 'shield'],
  ['helmet', 'armor', 'armor-pants'],
  ['gloves', 'boots'],
];
const equipmentSlots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'armor-pants', 'boots', 'gloves', 'helmet'];

function getEquipmentIconPath(item: Pick<Equipment, 'slot' | 'rarity'>) {
  return `${EQUIPMENT_ICON_BASE}/${item.slot}-${item.rarity}.png`;
}

function getEquipmentStat(item: Equipment, stat: 'armyPower' | 'defensivePower' | 'morale' | 'spellPower' | 'maxHealth') {
  if (stat === 'armyPower') return item.stats.armyPower ?? item.stats.attack ?? 0;
  if (stat === 'defensivePower') return item.stats.defensivePower ?? item.stats.defense ?? 0;
  if (stat === 'morale') return item.stats.morale ?? item.stats.speed ?? 0;
  if (stat === 'spellPower') return item.stats.spellPower ?? 0;
  return item.stats.maxHealth ?? 0;
}

function rarityClasses(rarity: string) {
  switch (rarity) {
    case 'legendary': return 'ui-rarity-legendary';
    case 'epic': return 'ui-rarity-epic';
    case 'rare': return 'ui-rarity-rare';
    default: return 'ui-rarity-decent';
  }
}

function minionTierClasses(tier: MinionTier) {
  switch (tier) {
    case 'tier3': return 'ui-rarity-legendary';
    case 'tier2': return 'ui-rarity-rare';
    default: return 'ui-rarity-decent';
  }
}

export default function Inventory({ isOpen, onClose }: InventoryProps) {
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const interval = window.setInterval(() => setUser(getCurrentUser()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!user || !isOpen) return null;

  const inventory = user.inventory || [];
  const equipment = user.equipment || [];
  const equippedSlots = user.equippedSlots || {};
  const minions = user.minions || [];
  const inventorySlots = user.inventorySlots || 20;
  const inventoryUsed = getInventoryUsedSlots(inventory);

  const getEquippedItem = (slot: EquipmentSlot) => {
    const equipmentId = equippedSlots[slot];
    return equipment.find(item => item.id === equipmentId);
  };

  const unequippedItems = equipment.filter(item => !Object.values(equippedSlots).includes(item.id));
  const totals = equipmentSlots.reduce(
    (result, slot) => {
      const item = getEquippedItem(slot);
      if (!item) return result;

      return {
        armyPower: result.armyPower + getEquipmentStat(item, 'armyPower'),
        defensivePower: result.defensivePower + getEquipmentStat(item, 'defensivePower'),
        morale: result.morale + getEquipmentStat(item, 'morale'),
        spellPower: result.spellPower + getEquipmentStat(item, 'spellPower'),
        maxHealth: result.maxHealth + getEquipmentStat(item, 'maxHealth'),
      };
    },
    { armyPower: 0, defensivePower: 0, morale: 0, spellPower: 0, maxHealth: 0 }
  );

  const handleEquip = (equipmentId: string) => {
    const result = equipItem(equipmentId);
    if (result.success) setUser(getCurrentUser());
  };

  const handleUnequip = (slot: EquipmentSlot) => {
    const result = unequipItem(slot);
    if (result.success) setUser(getCurrentUser());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="command-panel vine-frame max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded border text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="fantasy-heading text-xl">Inventory</h3>
            <p className="arcane-label">{inventoryUsed}/{inventorySlots} carried item slots</p>
          </div>
          <button onClick={onClose} className="ui-button rounded px-3 py-1 text-xs font-bold">
            Close
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_1fr]">
          <section>
            <SectionTitle title="Equipped Gear" action={`${Object.keys(equippedSlots).length}/${equipmentSlots.length}`} />
            <div className="space-y-2">
              {equipmentLayout.map((row, index) => (
                <div key={index} className="grid grid-cols-3 gap-2">
                  {row.map(slot => {
                    const item = getEquippedItem(slot);
                    return (
                      <div key={slot} className="ui-card min-h-24 rounded border p-2">
                        <div className="ui-faint text-[10px] font-black uppercase">{slot.replace('-', ' ')}</div>
                        {item ? (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="ui-icon-frame relative h-12 w-12 shrink-0 overflow-hidden rounded border">
                              <Image src={getEquipmentIconPath(item)} alt={item.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                            </span>
                            <div className="min-w-0">
                              <div className={`rounded border px-2 py-1 text-xs font-bold ${rarityClasses(item.rarity)}`}>{item.name}</div>
                              <button onClick={() => handleUnequip(slot)} className="mt-2 text-xs font-bold text-red-300 hover:text-red-100">
                                Unequip
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="ui-faint mt-6 text-center text-xs font-bold uppercase">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <StatusPill label="Army" value={`+${totals.armyPower}`} />
              <StatusPill label="Ward" value={`+${totals.defensivePower}`} />
              <StatusPill label="Morale" value={`+${totals.morale}`} />
              <StatusPill label="Spell" value={`+${totals.spellPower}`} />
              <StatusPill label="Max HP" value={`+${totals.maxHealth}`} />
            </div>
          </section>

          <section>
            <SectionTitle title="Items" action={`${inventoryUsed}/${inventorySlots}`} />
            {inventory.length === 0 ? (
              <EmptyState text="No carried items." />
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {inventory.map(item => (
                  <div key={item.id} className="ui-card aspect-square rounded border p-2 text-center">
                    <div className="text-xl">{item.icon}</div>
                    <div className="mt-1 truncate text-xs font-bold">{item.name}</div>
                    <div className="ui-value text-xs font-black">x{item.quantity}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-2">
            <SectionTitle title="Available Gear" action={`${unequippedItems.length} pieces`} />
            {unequippedItems.length === 0 ? (
              <EmptyState text="No unequipped gear." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unequippedItems.map(item => (
                  <div key={item.id} className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${rarityClasses(item.rarity)}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="ui-icon-frame relative h-12 w-12 shrink-0 overflow-hidden rounded border">
                        <Image src={getEquipmentIconPath(item)} alt={item.name} fill className="object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{item.name}</div>
                        <div className="text-xs opacity-80">{item.slot.replace('-', ' ')}</div>
                      </div>
                    </div>
                    <button onClick={() => handleEquip(item.id)} className="ui-button-primary rounded px-3 py-1 text-xs font-bold">
                      Equip
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-2">
            <SectionTitle title="Minion Roster" action={`${minions.length} units`} />
            {minions.length === 0 ? (
              <EmptyState text="No minions recruited yet." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {minions.map(minion => {
                  const template = getMinionTemplate(minion.templateId);
                  if (!template) return null;

                  return (
                    <div key={minion.id} className={`rounded border p-3 ${minionTierClasses(template.tier)}`}>
                      <div className="flex items-center gap-3">
                        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-black/30">
                          <Image src={`${MINION_ICON_BASE}/${template.assetName}`} alt={template.name} fill className="sprite-soft-glow object-contain p-1" style={{ imageRendering: 'pixelated' }} />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{template.name}</div>
                          <div className="text-[11px] font-bold opacity-80">
                            {MINION_TIER_LABELS[template.tier]} {MINION_CLASS_LABELS[template.class]}
                          </div>
                          <div className="ui-value text-xs font-black">x{minion.quantity}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-[rgba(232,217,184,0.16)] pb-2">
      <h4 className="fantasy-heading font-black">{title}</h4>
      {action && <span className="ui-faint text-xs font-bold">{action}</span>}
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-pill rounded border px-3 py-2">
      <div className="text-[10px] font-black uppercase text-[var(--ui-faint)]">{label}</div>
      <div className="ui-value text-sm font-black">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="ui-card rounded border px-4 py-8 text-center text-xs font-bold text-[var(--ui-muted)]">{text}</div>;
}
