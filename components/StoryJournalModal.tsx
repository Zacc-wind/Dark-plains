'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
  MULTIPLAYER_ONBOARDING_STORY_QUEST_IDS,
  getAllStoryQuestsSorted,
  getStoryQuestStatus,
  type User,
} from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';
import { getStoryDialogSequence } from '@/lib/storyDialogue';
import StoryDialogOverlay from './StoryDialogOverlay';

interface StoryJournalModalProps {
  player: User;
  onClose: () => void;
  onPlayerRefresh: () => void;
  onSkipOnboarding: () => { success: boolean; message?: string; error?: string };
}

export default function StoryJournalModal({
  player,
  onClose,
  onPlayerRefresh,
  onSkipOnboarding,
}: StoryJournalModalProps) {
  const [replayQuestId, setReplayQuestId] = useState<string | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [notice, setNotice] = useState('');

  const entries = useMemo(() => getAllStoryQuestsSorted()
    .map(story => {
      const sequence = getStoryDialogSequence(story.dialogId);
      const progress = player.storyQuests?.find(item => item.questId === story.id);
      if (!sequence || !progress?.introSeen) return null;
      return {
        story,
        sequence,
        status: getStoryQuestStatus(player, story.id),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)), [player]);

  const onboardingRemaining = MULTIPLAYER_ONBOARDING_STORY_QUEST_IDS.filter(questId => (
    !player.storyQuests?.some(progress => progress.questId === questId && progress.introSeen)
  )).length;
  const replayEntry = entries.find(entry => entry.story.id === replayQuestId);

  const handleSkipOnboarding = () => {
    const result = onSkipOnboarding();
    setConfirmSkip(false);
    setNotice(result.message || result.error || 'Could not update onboarding.');
    if (result.success) onPlayerRefresh();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 p-3 text-zinc-100 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Story journal"
        onClick={onClose}
      >
        <section
          className="command-panel vine-frame flex max-h-[min(52rem,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded border"
          onClick={event => event.stopPropagation()}
        >
          <header className="panel-header flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
            <div>
              <div className="arcane-label">Campaign Archive</div>
              <h2 className="fantasy-heading mt-1 text-2xl sm:text-3xl">Story Journal</h2>
              <p className="ui-muted mt-1 text-xs font-bold sm:text-sm">
                Replay conversations without changing objectives, progress, or rewards.
              </p>
            </div>
            <button type="button" onClick={onClose} className="ui-button rounded px-3 py-2 text-xs font-black">
              Close
            </button>
          </header>

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {entries.length === 0 ? (
              <div className="ui-empty rounded border border-dashed px-5 py-12 text-center">
                <div className="fantasy-heading text-lg">No conversations recorded</div>
                <p className="ui-muted mt-2 text-sm font-bold">Story scenes appear here after they are viewed or skipped.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {entries.map(({ story, sequence, status }) => {
                  const portraitPath = sequence.npcAssetPath || getPlayerModelPath(sequence.npcModelNumber || 4);
                  return (
                    <button
                      key={story.id}
                      type="button"
                      onClick={() => setReplayQuestId(story.id)}
                      className="ui-card group grid min-h-28 grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded border p-3 text-left transition hover:border-[rgba(232,217,184,0.46)]"
                    >
                      <span className="relative flex h-24 items-end justify-center overflow-hidden rounded border border-[rgba(232,217,184,0.14)] bg-black/30">
                        <Image
                          src={portraitPath}
                          alt=""
                          width={112}
                          height={144}
                          className="h-24 w-auto object-contain transition duration-300 group-hover:scale-[1.04]"
                          unoptimized
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="arcane-label block">{sequence.kicker}</span>
                        <span className="fantasy-heading mt-1 block text-base text-zinc-100">{story.name}</span>
                        <span className="ui-muted mt-1 block text-xs font-bold">{sequence.npcName} - {sequence.npcTitle}</span>
                        <span className={`ui-pill mt-3 inline-flex rounded border px-2 py-1 text-[10px] font-black ${status.claimed ? 'text-emerald-200' : 'text-[var(--ui-accent)]'}`}>
                          {status.claimed ? 'Reward claimed' : 'Conversation recorded'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="border-t border-[rgba(232,217,184,0.14)] bg-black/25 px-4 py-3 sm:px-6">
            {notice && <div className="ui-notice mb-3 rounded border px-3 py-2 text-xs font-bold">{notice}</div>}
            {onboardingRemaining > 0 && !confirmSkip && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="ui-muted text-xs font-bold">
                  {onboardingRemaining} opening conversation{onboardingRemaining === 1 ? '' : 's'} remain.
                </p>
                <button type="button" onClick={() => setConfirmSkip(true)} className="ui-button rounded px-3 py-2 text-xs font-black">
                  Skip Multiplayer Onboarding
                </button>
              </div>
            )}
            {onboardingRemaining > 0 && confirmSkip && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-xs font-bold text-amber-100">
                  This hides the first six conversations only. It does not finish quests, grant rewards, or skip objectives.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirmSkip(false)} className="ui-button rounded px-3 py-2 text-xs font-black">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSkipOnboarding} className="ui-button-danger rounded px-3 py-2 text-xs font-black">
                    Confirm Skip
                  </button>
                </div>
              </div>
            )}
          </footer>
        </section>
      </div>

      {replayEntry && (
        <StoryDialogOverlay
          key={`journal-${replayEntry.sequence.id}`}
          sequence={replayEntry.sequence}
          playerModelNumber={player.selectedModel || 3}
          onComplete={() => setReplayQuestId(null)}
        />
      )}
    </>
  );
}
