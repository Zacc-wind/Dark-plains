'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser, claimQuestReward, getMinionTemplate, MINION_TIER_LABELS } from '@/lib/auth';

interface DailyQuestsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DailyQuests({ isOpen, onClose }: DailyQuestsProps) {
  const [user, setUser] = useState(getCurrentUser());
  const [claimingQuest, setClaimingQuest] = useState<string | null>(null);
  const [rewardMessage, setRewardMessage] = useState<string>('');

  useEffect(() => {
    const interval = setInterval(() => {
      setUser(getCurrentUser());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!user || !isOpen) return null;

  const quests = user.dailyQuests?.quests || [];

  const handleClaimReward = (questId: string) => {
    setClaimingQuest(questId);
    const result = claimQuestReward(questId);
    
    if (result.success && result.rewards) {
      const equipmentRewardNames = result.rewards.map(r => `${r.rarity.toUpperCase()} ${r.name}`);
      const minionRewardNames = (result.minions || []).map(minion => {
        const template = getMinionTemplate(minion.templateId);
        return `${minion.quantity} ${template?.name || 'Minion'}`;
      });
      const rewardNames = [...equipmentRewardNames, ...minionRewardNames].join(', ');
      setRewardMessage(`Claimed: ${rewardNames}!`);
      setTimeout(() => setRewardMessage(''), 3000);
      setUser(getCurrentUser());
    } else if (result.error) {
      setRewardMessage(result.error);
      setTimeout(() => setRewardMessage(''), 3000);
    }
    
    setClaimingQuest(null);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-amber-300';
      case 'epic': return 'text-purple-300';
      case 'rare': return 'text-blue-300';
      case 'decent': return 'text-gray-300';
      default: return 'text-gray-300';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border-4 border-amber-500 rounded-xl p-6 w-full max-w-2xl mx-4 shadow-2xl"
        style={{ 
          boxShadow: '0 25px 60px rgba(0,0,0,0.95), 0 0 0 2px rgba(245,158,11,0.5)',
          imageRendering: 'pixelated',
          maxHeight: '80vh',
          overflowY: 'auto',
          backgroundColor: '#0f172a'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b-2 border-amber-600 pb-3">
          <h3 className="font-bold text-yellow-300 text-2xl">
            📅 Daily Quests
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:text-amber-300 text-3xl font-bold"
          >
            ×
          </button>
        </div>

        {rewardMessage && (
          <div className="mb-4 p-3 bg-green-900/50 border-2 border-green-500 rounded-lg">
            <p className="text-green-300 font-bold text-center">{rewardMessage}</p>
          </div>
        )}

        <div className="space-y-4">
          {quests.map((quest) => {
            const isComplete = quest.progress >= quest.requirement.count;
            const progressPercent = Math.min(100, (quest.progress / quest.requirement.count) * 100);

            return (
              <div
                key={quest.id}
                className={`bg-slate-800 border-2 ${
                  quest.claimed ? 'border-green-600' : isComplete ? 'border-amber-500' : 'border-slate-600'
                } rounded-lg p-4`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className={`font-bold text-lg ${
                      quest.claimed ? 'text-green-300' : 'text-yellow-300'
                    }`}>
                      {quest.name}
                    </h4>
                    <p className="text-slate-400 text-sm font-bold">{quest.description}</p>
                  </div>
                  {quest.claimed && (
                    <span className="text-green-300 font-bold text-sm bg-green-900/30 px-3 py-1 rounded">
                      ✓ Claimed
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400 font-bold">Progress</span>
                    <span className="text-xs text-yellow-300 font-bold">
                      {quest.progress} / {quest.requirement.count}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        isComplete ? 'bg-green-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Rewards */}
                <div className="mb-3">
                  <p className="text-xs text-slate-400 font-bold mb-1">Rewards:</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded bg-slate-700 ${getRarityColor(quest.rewards.guaranteedItem)}`}>
                      ✓ {quest.rewards.guaranteedItem.toUpperCase()} item
                    </span>
                    {quest.rewards.bonusItem && (
                      <span className={`text-xs font-bold px-2 py-1 rounded bg-slate-700 ${getRarityColor(quest.rewards.bonusItem.rarity)}`}>
                        {(quest.rewards.bonusItem.chance * 100).toFixed(0)}% {quest.rewards.bonusItem.rarity.toUpperCase()} item
                      </span>
                    )}
                    <span className="text-xs font-bold px-2 py-1 rounded bg-slate-700 text-amber-300">
                      {(quest.rewards.legendaryChance * 100).toFixed(0)}% LEGENDARY
                    </span>
                    {quest.rewards.minionChance && (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-slate-700 text-emerald-300">
                        {(quest.rewards.minionChance.chance * 100).toFixed(0)}% {MINION_TIER_LABELS[quest.rewards.minionChance.tier]} minion
                      </span>
                    )}
                  </div>
                </div>

                {/* Claim Button */}
                {!quest.claimed && isComplete && (
                  <button
                    onClick={() => handleClaimReward(quest.id)}
                    disabled={claimingQuest === quest.id}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-all disabled:opacity-50"
                  >
                    {claimingQuest === quest.id ? 'Claiming...' : 'Claim Reward'}
                  </button>
                )}
                
                {!quest.claimed && !isComplete && (
                  <button
                    disabled
                    className="w-full bg-slate-700 text-slate-500 font-bold py-2 px-4 rounded cursor-not-allowed"
                  >
                    Complete Quest to Claim
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t-2 border-amber-600">
          <p className="text-xs text-yellow-300 font-bold text-center">
            💡 Daily quests reset at midnight • Complete jobs to progress
          </p>
        </div>
      </div>
    </div>
  );
}
