'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MULTIPLAYER_ONBOARDING_STORY_QUEST_IDS,
  getAllStoryQuestsSorted,
  getStoryQuestStatus,
  type User,
} from '@/lib/auth';
import { getPlayerModelPath } from '@/lib/assetLoader';
import { getMultiplayerChapterViews } from '@/lib/multiplayerProgression';
import { readMultiplayerTutorialProgress } from '@/lib/multiplayerTutorial';
import {
  MULTIPLAYER_UNLOCK_DIALOGUES,
  getMultiplayerUnlockDialogue,
  type MultiplayerUnlockDialogueId,
} from '@/lib/multiplayerUnlockDialogue';
import { getMultiplayerUnlockLevelGroups, getNextMultiplayerUnlocks } from '@/lib/multiplayerUnlocks';
import { getStoryDialogSequence } from '@/lib/storyDialogue';
import MultiplayerOrdersPanel from './MultiplayerOrdersPanel';
import StoryDialogOverlay from './StoryDialogOverlay';

export type MultiplayerProgressionTab = 'orders' | 'campaign' | 'path';

interface MultiplayerProgressionModalProps {
  isOpen: boolean;
  initialTab?: MultiplayerProgressionTab;
  now: number;
  player: User;
  onClose: () => void;
  onPlayerRefresh: () => void;
  onSkipOnboarding: () => { success: boolean; message?: string; error?: string };
  onOpenPve?: () => void;
}

const TABS: Array<{ id: MultiplayerProgressionTab; label: string }> = [
  { id: 'orders', label: 'Orders' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'path', label: 'Level Path' },
];

const FUTURE_LEVEL_BANDS = [
  { levels: '7-10', title: 'The Drowned Moonwell', detail: 'Veteran roads, dungeon tier II, and the first regional boss.' },
  { levels: '11-15', title: 'The Broken Crown', detail: 'Eastern contracts, named elites, and Grave-Aurel.' },
  { levels: '16-20', title: 'The Glass Road', detail: 'Mirror Court access, veteran co-op, and Eclipse Hold.' },
  { levels: '21-25', title: 'The Candle Key', detail: 'Elite modifiers, advanced services, and key fragments.' },
  { levels: '26-30', title: 'The Lady In Glass', detail: 'High-war encounters, hard paths, and the court finale.' },
];

export default function MultiplayerProgressionModal({
  isOpen,
  initialTab = 'orders',
  now,
  player,
  onClose,
  onPlayerRefresh,
  onSkipOnboarding,
  onOpenPve,
}: MultiplayerProgressionModalProps) {
  const [activeTab, setActiveTab] = useState<MultiplayerProgressionTab>(initialTab);
  const [replayQuestId, setReplayQuestId] = useState<string | null>(null);
  const [replayUnlockDialogueId, setReplayUnlockDialogueId] = useState<MultiplayerUnlockDialogueId | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [notice, setNotice] = useState('');
  const shellRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusTimer = window.requestAnimationFrame(() => {
      shellRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (replayQuestId) setReplayQuestId(null);
        else if (replayUnlockDialogueId) setReplayUnlockDialogueId(null);
        else onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || replayQuestId || replayUnlockDialogueId) return;
      const focusable = Array.from(shellRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('multiplayer-progression-open');
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('multiplayer-progression-open');
      previousFocus?.focus();
    };
  }, [isOpen, replayQuestId, replayUnlockDialogueId]);

  const chapterViews = useMemo(() => getMultiplayerChapterViews(player), [player]);
  const unlockGroups = useMemo(() => getMultiplayerUnlockLevelGroups(player), [player]);
  const nextUnlocks = useMemo(() => getNextMultiplayerUnlocks(player, 3), [player]);
  const storyEntries = useMemo(() => getAllStoryQuestsSorted().map(story => {
    const sequence = getStoryDialogSequence(story.dialogId);
    const progress = player.storyQuests?.find(item => item.questId === story.id);
    if (!sequence || !progress?.introSeen) return null;
    return { story, sequence, status: getStoryQuestStatus(player, story.id) };
  }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)), [player]);
  const completedUnlockDialogues = useMemo(() => {
    const progress = readMultiplayerTutorialProgress(player.username);
    const completed = new Set(progress.completedUnlockDialogueIds || []);
    return MULTIPLAYER_UNLOCK_DIALOGUES.filter(dialogue => completed.has(dialogue.id));
  }, [player]);
  const activeStory = useMemo(() => getAllStoryQuestsSorted().find(story => {
    const status = getStoryQuestStatus(player, story.id);
    return status.unlocked && !status.claimed;
  }) || null, [player]);
  const activeStoryStatus = activeStory ? getStoryQuestStatus(player, activeStory.id) : null;
  const replayEntry = storyEntries.find(entry => entry.story.id === replayQuestId);
  const replayUnlockDialogue = getMultiplayerUnlockDialogue(replayUnlockDialogueId);
  const onboardingRemaining = MULTIPLAYER_ONBOARDING_STORY_QUEST_IDS.filter(questId => (
    !player.storyQuests?.some(progress => progress.questId === questId && progress.introSeen)
  )).length;

  const handleSkipOnboarding = () => {
    const result = onSkipOnboarding();
    setConfirmSkip(false);
    setNotice(result.message || result.error || 'Could not update onboarding.');
    if (result.success) onPlayerRefresh();
  };

  if (!isOpen) return null;

  const currentChapter = chapterViews.find(chapter => chapter.active)
    || [...chapterViews].reverse().find(chapter => chapter.unlocked);

  return (
    <>
      <div
        className="multiplayer-progression-overlay fixed inset-0 z-[115] flex items-center justify-center bg-black/80 p-3 text-zinc-100 sm:p-5"
        role="presentation"
        onMouseDown={event => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          ref={shellRef}
          className="multiplayer-progression-shell command-panel vine-frame flex max-h-[min(56rem,calc(100dvh-2rem))] w-[min(76rem,calc(100vw-2rem))] flex-col overflow-hidden rounded border shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Campaign and progression"
        >
          <header className="multiplayer-progression-header panel-header flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="arcane-label">Shared World</p>
              <h2 className="fantasy-heading text-2xl sm:text-3xl">Campaign &amp; Progression</h2>
              <p className="ui-muted mt-1 text-xs font-bold sm:text-sm">
                {currentChapter ? `Chapter ${currentChapter.numeral}: ${currentChapter.title}` : 'The road awaits a first banner.'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="multiplayer-progression-level ui-pill rounded border px-3 py-2 text-xs font-black">Level {player.stats.level}</span>
              <button type="button" onClick={onClose} className="ui-button rounded px-3 py-2 text-xs font-black" aria-label="Close campaign and progression">
                Close
              </button>
            </div>
          </header>

          <nav className="multiplayer-progression-tabs shrink-0 border-b px-4 sm:px-6" role="tablist" aria-label="Campaign sections">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`multiplayer-progression-${tab.id}`}
                className={activeTab === tab.id ? 'multiplayer-progression-tab is-active' : 'multiplayer-progression-tab'}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {notice && <div className="ui-notice shrink-0 border-b px-5 py-3 text-xs font-bold sm:px-6">{notice}</div>}

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
            {activeTab === 'orders' && (
              <div id="multiplayer-progression-orders" role="tabpanel">
                <MultiplayerOrdersPanel now={now} onPlayerRefresh={onPlayerRefresh} onOpenPve={onOpenPve} />
              </div>
            )}

            {activeTab === 'campaign' && (
              <div id="multiplayer-progression-campaign" className="multiplayer-campaign-panel" role="tabpanel">
                <section className="multiplayer-current-objective px-5 py-5 sm:px-6">
                  <div className="multiplayer-current-objective-copy">
                    <p className="arcane-label">Current Objective</p>
                    <h3 className="fantasy-heading text-xl">{activeStory?.name || 'Chapter orders complete'}</h3>
                    <p className="ui-muted mt-1 text-sm font-bold">
                      {activeStory?.lore || 'Reach the next level band to continue the campaign.'}
                    </p>
                  </div>
                  <div className="multiplayer-current-objective-progress">
                    <strong>{activeStoryStatus ? `${activeStoryStatus.progress}/${activeStoryStatus.required}` : 'Done'}</strong>
                    <span>{activeStoryStatus?.complete ? 'Ready to claim' : activeStory ? `Level ${activeStory.requiredLevel}` : 'No active step'}</span>
                  </div>
                </section>

                <section className="border-t px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="arcane-label">Campaign Road</p>
                      <h3 className="fantasy-heading text-xl">Six Chapters</h3>
                    </div>
                    <span className="ui-pill rounded border px-3 py-1 text-[10px] font-black uppercase">
                      {chapterViews.filter(chapter => chapter.complete).length}/{chapterViews.length} complete
                    </span>
                  </div>
                  <div className="multiplayer-chapter-list mt-4">
                    {chapterViews.map(chapter => {
                      const percent = chapter.questCount > 0 ? (chapter.claimedCount / chapter.questCount) * 100 : 0;
                      return (
                        <article key={chapter.id} className={`multiplayer-chapter-row ${chapter.active ? 'is-active' : ''} ${chapter.unlocked ? '' : 'is-locked'}`}>
                          <span className="multiplayer-chapter-number">{chapter.numeral}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <h4 className="fantasy-heading text-base">{chapter.title}</h4>
                              <span className="ui-faint text-[10px] font-black uppercase">Levels {chapter.minLevel}-{chapter.maxLevel}</span>
                            </div>
                            <p className="ui-muted mt-1 text-xs font-bold">{chapter.conflict}</p>
                            <div className="ui-faint mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-black uppercase">
                              <span>Guide: {chapter.guideName}</span>
                              <span>Capstone: {chapter.capstone}</span>
                            </div>
                            <div className="ui-progress-track mt-3 h-1.5 overflow-hidden rounded border">
                              <div className="ui-progress-fill h-full" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                          <div className="multiplayer-chapter-state">
                            <strong>{chapter.claimedCount}/{chapter.questCount}</strong>
                            <span>{chapter.complete ? 'Complete' : chapter.unlocked ? chapter.active ? 'Active' : 'Open' : `Lv ${chapter.minLevel}`}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="border-t px-5 py-5 sm:px-6">
                  <div>
                    <p className="arcane-label">Campaign Archive</p>
                    <h3 className="fantasy-heading text-xl">Recorded Conversations</h3>
                  </div>
                  {storyEntries.length === 0 && completedUnlockDialogues.length === 0 ? (
                    <div className="ui-empty mt-4 rounded border border-dashed px-5 py-10 text-center">
                      <div className="fantasy-heading text-base">No conversations recorded</div>
                      <p className="ui-muted mt-2 text-xs font-bold">Viewed story scenes appear here.</p>
                    </div>
                  ) : (
                    <div className="multiplayer-story-records mt-4">
                      {storyEntries.map(({ story, sequence, status }) => (
                        <button key={story.id} type="button" onClick={() => setReplayQuestId(story.id)} className="multiplayer-story-record">
                          <span className="relative h-16 w-14 shrink-0 overflow-hidden">
                            <Image
                              src={sequence.npcAssetPath || getPlayerModelPath(sequence.npcModelNumber || 4)}
                              alt=""
                              fill
                              sizes="56px"
                              className="object-contain"
                              unoptimized
                            />
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="arcane-label block">{sequence.npcName}</span>
                            <span className="fantasy-heading mt-1 block text-sm">{story.name}</span>
                          </span>
                          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">{status.claimed ? 'Claimed' : 'Recorded'}</span>
                        </button>
                      ))}
                      {completedUnlockDialogues.map(dialogue => (
                        <button
                          key={dialogue.id}
                          type="button"
                          onClick={() => setReplayUnlockDialogueId(dialogue.id)}
                          className="multiplayer-story-record"
                        >
                          <span className="relative h-16 w-14 shrink-0 overflow-hidden">
                            <Image
                              src={dialogue.sequence.npcAssetPath || getPlayerModelPath(dialogue.sequence.npcModelNumber || 4)}
                              alt=""
                              fill
                              sizes="56px"
                              className="object-contain"
                              unoptimized
                            />
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="arcane-label block">Rank {dialogue.minLevel} Briefing</span>
                            <span className="fantasy-heading mt-1 block text-sm">{dialogue.title}</span>
                          </span>
                          <span className="ui-pill rounded border px-2 py-1 text-[10px] font-black">Recorded</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {onboardingRemaining > 0 && (
                  <section className="multiplayer-onboarding-control border-t px-5 py-4 sm:px-6">
                    {!confirmSkip ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="ui-muted text-xs font-bold">{onboardingRemaining} opening conversation{onboardingRemaining === 1 ? '' : 's'} remain.</p>
                        <button type="button" onClick={() => setConfirmSkip(true)} className="ui-button rounded px-3 py-2 text-xs font-black">Skip Multiplayer Onboarding</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="max-w-2xl text-xs font-bold text-amber-100">This hides conversations only. Objectives and rewards remain unchanged.</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setConfirmSkip(false)} className="ui-button rounded px-3 py-2 text-xs font-black">Cancel</button>
                          <button type="button" onClick={handleSkipOnboarding} className="ui-button-danger rounded px-3 py-2 text-xs font-black">Confirm Skip</button>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}

            {activeTab === 'path' && (
              <div id="multiplayer-progression-path" className="multiplayer-level-path-panel px-5 py-5 sm:px-6" role="tabpanel">
                <section className="multiplayer-next-unlocks">
                  <div>
                    <p className="arcane-label">Next Unlocks</p>
                    <h3 className="fantasy-heading text-xl">What Opens Next</h3>
                  </div>
                  <div className="multiplayer-next-unlock-grid mt-4">
                    {nextUnlocks.length > 0 ? nextUnlocks.map(unlock => (
                      <div key={unlock.id} className="multiplayer-next-unlock">
                        <span>Level {unlock.minLevel}</span>
                        <strong>{unlock.title}</strong>
                        <p>{unlock.description}</p>
                      </div>
                    )) : (
                      <div className="multiplayer-next-unlock"><strong>All implemented systems open</strong><p>Continue through the current chapter bands.</p></div>
                    )}
                  </div>
                </section>

                <section className="mt-6 border-t pt-5">
                  <p className="arcane-label">Implemented Path</p>
                  <div className="multiplayer-level-path-list mt-3">
                    {unlockGroups.map(group => (
                      <article key={group.level} className={`multiplayer-level-path-row ${group.current ? 'is-current' : ''} ${group.unlocked ? 'is-unlocked' : ''}`}>
                        <span className="multiplayer-level-path-level">{group.level}</span>
                        <div className="min-w-0">
                          <h4 className="fantasy-heading text-base">Level {group.level}</h4>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            {group.features.map(feature => <span key={feature.id}>{feature.title}</span>)}
                          </div>
                        </div>
                        <strong>{group.unlocked ? 'Open' : 'Locked'}</strong>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="mt-6 border-t pt-5">
                  <p className="arcane-label">Campaign Bands</p>
                  <div className="multiplayer-future-bands mt-3">
                    {FUTURE_LEVEL_BANDS.map(band => (
                      <div key={band.levels}>
                        <span>Lv {band.levels}</span>
                        <strong>{band.title}</strong>
                        <p>{band.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>

      {replayEntry && (
        <StoryDialogOverlay
          key={`progression-journal-${replayEntry.sequence.id}`}
          sequence={replayEntry.sequence}
          playerModelNumber={player.selectedModel || 3}
          onComplete={() => setReplayQuestId(null)}
        />
      )}
      {replayUnlockDialogue && (
        <StoryDialogOverlay
          key={`progression-unlock-${replayUnlockDialogue.id}`}
          sequence={replayUnlockDialogue.sequence}
          playerModelNumber={player.selectedModel || 3}
          onComplete={() => setReplayUnlockDialogueId(null)}
        />
      )}
    </>
  );
}
