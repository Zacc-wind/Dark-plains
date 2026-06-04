'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';

interface CharacterStatsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CharacterStats({ isOpen, onClose }: CharacterStatsProps) {
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const interval = window.setInterval(() => setUser(getCurrentUser()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!user || !isOpen) return null;

  const stats = user.stats;
  const travelReduction = Math.min(50, stats.morale * 5);

  const rows = [
    { label: 'Army Power', value: stats.armyPower, note: 'Commander and minion damage' },
    { label: 'Defensive Power', value: stats.defensivePower, note: 'Commander and minion durability' },
    { label: 'Morale', value: stats.morale, note: `${travelReduction}% base travel reduction` },
    { label: 'Spell Power', value: stats.spellPower, note: 'King spells, healing, and magic units' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="command-panel vine-frame w-full max-w-md overflow-hidden rounded border text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="fantasy-heading text-xl">Character Stats</h3>
            <p className="arcane-label">Level {stats.level}</p>
          </div>
          <button onClick={onClose} className="ui-button rounded px-3 py-1 text-xs font-bold">
            Close
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="ui-card rounded border p-3">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Health</span>
              <span className="ui-value">{stats.health} / {stats.maxHealth}</span>
            </div>
            <div className="ui-progress-track mt-2 h-3 overflow-hidden rounded border">
              <div
                className="h-full bg-red-500"
                style={{ width: `${Math.min(100, (stats.health / stats.maxHealth) * 100)}%` }}
              />
            </div>
          </div>

          {rows.map(row => (
            <div key={row.label} className="ui-card rounded border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-zinc-100">{row.label}</span>
                <span className="ui-value text-xl font-black">{row.value}</span>
              </div>
              <p className="ui-muted mt-1 text-xs font-bold">{row.note}</p>
            </div>
          ))}

          <p className="ui-muted pt-2 text-center text-xs font-bold">
            Complete quests and level up to earn more stat points.
          </p>
        </div>
      </div>
    </div>
  );
}
