'use client';

import { useState } from 'react';

interface MenuProps {
  onOpenStats: () => void;
  onOpenInventory: () => void;
  onOpenAvatar: () => void;
  onOpenDailyQuests: () => void;
}

export default function Menu({ onOpenStats, onOpenInventory, onOpenAvatar, onOpenDailyQuests }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-4 rounded-lg transition-all shadow-lg z-40 border:0"
        style={{ 
          imageRendering: 'pixelated',
          backgroundColor: '#92400e'
        }}
      >
        MENU
      </button>

      {/* Menu modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-slate-900 border-4 border-amber-500 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
            style={{ 
              boxShadow: '0 25px 60px rgba(0,0,0,0.95), 0 0 0 2px rgba(245,158,11,0.5)',
              imageRendering: 'pixelated',
              backgroundColor: '#0f172a'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6 border-b-2 border-amber-600 pb-3">
              <h2 className="text-2xl font-bold text-yellow-300">
                Menu
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-amber-300 text-3xl leading-none font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Stats button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenStats();
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-lg transition-all border-2 border-amber-500"
                style={{ 
                  imageRendering: 'pixelated',
                  textShadow: '2px 2px 0 #000'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">⚔️ Character Stats</span>
                  <span className="text-amber-300">›</span>
                </div>
              </button>

              {/* Inventory button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenInventory();
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-lg transition-all border-2 border-amber-500"
                style={{ 
                  imageRendering: 'pixelated',
                  textShadow: '2px 2px 0 #000'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">🎒 Inventory</span>
                  <span className="text-amber-300">›</span>
                </div>
              </button>

              {/* Avatar button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenAvatar();
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-lg transition-all border-2 border-amber-500"
                style={{ 
                  imageRendering: 'pixelated',
                  textShadow: '2px 2px 0 #000'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">👤 Choose Avatar</span>
                  <span className="text-amber-300">›</span>
                </div>
              </button>

              {/* Daily Quests button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenDailyQuests();
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-lg transition-all border-2 border-amber-500"
                style={{ 
                  imageRendering: 'pixelated',
                  textShadow: '2px 2px 0 #000'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">📅 Daily Quests</span>
                  <span className="text-amber-300">›</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
