'use client';

import { useEffect, useState } from 'react';
import { AllocatableStat, allocateStatPoint, getCurrentUser, getExpNeeded } from '@/lib/auth';

export default function StatAllocation() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(getCurrentUser());
  const [error, setError] = useState('');

  useEffect(() => {
    const interval = window.setInterval(() => setUser(getCurrentUser()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!user) return null;

  const handleAllocate = (stat: AllocatableStat) => {
    const result = allocateStatPoint(stat);
    if (result.success) {
      setError('');
      setUser(getCurrentUser());
      return;
    }

    setError(result.error || 'Failed to allocate point.');
  };

  const expNeeded = getExpNeeded(user.stats.level);
  const expProgress = Math.min(100, (user.exp / expNeeded) * 100);
  const shouldShowModal = user.stats.unallocatedPoints > 0 || isOpen;

  const rows: Array<{ id: AllocatableStat; label: string; value: string; note: string }> = [
    { id: 'armyPower', label: 'Army Power', value: String(user.stats.armyPower), note: 'More commander and minion damage.' },
    { id: 'defensivePower', label: 'Defensive Power', value: String(user.stats.defensivePower), note: 'More health and armor in combat.' },
    { id: 'morale', label: 'Morale', value: String(user.stats.morale), note: 'Faster travel and better turn order.' },
    { id: 'spellPower', label: 'Spell Power', value: String(user.stats.spellPower), note: 'Stronger king spells and healing.' },
    { id: 'health', label: 'Health', value: `${user.stats.health}/${user.stats.maxHealth}`, note: '+10 max HP and a small heal.' },
  ];

  return (
    <>
      {shouldShowModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="command-panel vine-frame w-full max-w-md overflow-hidden rounded border text-zinc-100"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header flex items-start justify-between border-b px-5 py-4">
              <div>
                <h2 className="fantasy-heading text-xl">Spend Stat Points</h2>
                <p className="arcane-label">Level {user.stats.level}</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="ui-button rounded px-3 py-1 text-xs font-bold">
                Close
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <div className="ui-muted mb-2 flex items-center justify-between text-xs font-bold">
                  <span>{user.exp} / {expNeeded} XP</span>
                  <span>{user.stats.unallocatedPoints} points</span>
                </div>
                <div className="ui-progress-track h-3 overflow-hidden rounded border">
                  <div className="ui-progress-fill h-full" style={{ width: `${expProgress}%` }} />
                </div>
              </div>

              {error && (
                <div className="rounded border border-red-700 bg-red-950/70 px-4 py-3 text-sm font-bold text-red-200">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                {rows.map(row => (
                  <div key={row.id} className="ui-card flex items-center justify-between gap-4 rounded border px-4 py-3">
                    <div>
                      <div className="text-sm font-black">{row.label}</div>
                      <div className="ui-muted text-xs font-bold">{row.note}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="ui-value min-w-10 text-right text-lg font-black">{row.value}</span>
                      <button
                        onClick={() => handleAllocate(row.id)}
                        disabled={user.stats.unallocatedPoints === 0}
                        className="ui-button-primary h-9 w-9 rounded text-xl font-black disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
