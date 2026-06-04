'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser, logout, getExpNeeded } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getPlayerModelPath } from '@/lib/assetLoader';

interface StatsBarProps {
  onOpenAvatar: () => void;
}

export default function StatsBar({ onOpenAvatar }: StatsBarProps) {
  const [user, setUser] = useState(getCurrentUser());
  const router = useRouter();

  useEffect(() => {
    // Update user stats periodically
    const interval = setInterval(() => {
      setUser(getCurrentUser());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) return null;

  const currentModel = user.selectedModel || 3;
  const expNeeded = getExpNeeded(user.stats.level);

  return (
    <div className="bg-slate-900 border:0 border-slate-700 px-6 py-3 flex items-center justify-between z-50"
      style={{ 
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        height: '80px',
        backgroundColor: '#0f172a'
      }}
    >
      <div className="flex items-center gap-8">
        {/* Player name and avatar */}
        <button
          onClick={onOpenAvatar}
          className="flex items-center gap-3 hover:bg-amber-500/10 px-3 py-2 rounded-lg transition-all"
        >
          <div className="w-10 h-10 relative rounded-lg overflow-hidden bg-slate-700">
            <Image
              src={getPlayerModelPath(currentModel)}
              alt="Player Avatar"
              width={75}
              height={48}
              className="player-model-art object-contain"
            />
          </div>
          <span className="text-amber-200 font-bold text-lg">
            {user.username}
          </span>
        </button>

        {/* Health */}
        <div className="flex items-center gap-2 px-4 py-2 border:0 border-red-700 rounded-lg">
          <Image src="/assets/icons/health.png" alt="HP" width={24} height={24} style={{ imageRendering: 'pixelated', width: '24px', height: '24px' }} />
          <span className="text-red-300 font-semibold">
            {user.stats.health}/{user.stats.maxHealth}
          </span>
        </div>

        {/* Gold */}
        <div className="flex items-center gap-3 px-4 py-2 border:0 border-amber-700 rounded-lg">
          <Image src="/assets/icons/gold.png" alt="Gold" width={24} height={24} style={{ imageRendering: 'pixelated', width: '24px', height: '24px' }} />
          <span className="text-amber-200 font-semibold">
            {user.gold}
          </span>
          <span className="text-amber-500/70 text-sm">GOLD</span>
        </div>

        {/* Experience */}
        <div className="">
          <div className="flex items-center gap-3">
            <Image src="/assets/icons/xp.png" alt="XP" width={24} height={24} style={{ imageRendering: 'pixelated', width: '24px', height: '24px' }} />
            <div className="flex flex-col">
              <span className="text-blue-200 font-semibold text-xs">Level {user.stats.level}</span>
              <span className="text-blue-300 font-bold">{user.exp} / {expNeeded} XP</span>
            </div>
          </div>
        </div>

        <div className="text-amber-300 text-sm font-semibold">
          Road ready
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-semibold px-6 py-2 rounded-lg transition-all shadow-lg"
      >
        LOGOUT
      </button>
    </div>
  );
}
