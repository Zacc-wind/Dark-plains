'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getCurrentUser, updateCurrentUser } from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';

interface PlayerModelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlayerModelSelector({ isOpen, onClose }: PlayerModelSelectorProps) {
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setUser(getCurrentUser());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  if (!user || !isOpen) return null;

  const models = [1, 2, 3, 4, 5, 6];
  const currentModel = user.selectedModel || 3;

  const handleSelectModel = (modelNumber: number) => {
    const updatedUser = { ...user, selectedModel: modelNumber };
    updateCurrentUser(updatedUser);
    setUser(updatedUser);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="command-panel vine-frame relative w-full max-w-md overflow-hidden rounded border text-zinc-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="fantasy-heading text-xl">Avatar</h2>
            <p className="arcane-label">Player model</p>
          </div>
          <button
            onClick={onClose}
            className="ui-button rounded px-3 py-1 text-xs font-bold"
          >
            Close
          </button>
        </div>

        <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3">
          {models.map((modelNumber) => {
            const isSelected = currentModel === modelNumber;

            return (
              <button
                key={modelNumber}
                onClick={() => handleSelectModel(modelNumber)}
                className={`player-model-card relative flex min-h-40 flex-col items-center justify-center gap-3 rounded border p-4 transition ${
                  isSelected
                    ? 'rail-button-active'
                    : 'ui-card text-zinc-300 hover:text-white'
                }`}
              >
                <span className="relative h-24 w-24">
                  <Image
                    src={getPlayerModelPath(modelNumber)}
                    alt={`Model ${modelNumber}`}
                    fill
                    className="player-model-art object-contain"
                  />
                </span>
                <span className="font-fantasy text-sm font-black">Model {modelNumber}</span>
                {isSelected && (
                  <span className="absolute right-2 top-2 rounded border border-emerald-500 bg-emerald-950/70 px-2 py-1 text-[10px] font-black uppercase text-emerald-200">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
