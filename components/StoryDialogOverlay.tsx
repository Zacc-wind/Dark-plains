'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPlayerModelPath } from '@/lib/assetLoader';
import type { StoryDialogChoice, StoryDialogSequence } from '@/lib/storyDialogue';
import CinematicScrollShell from './CinematicScrollShell';

export default function StoryDialogOverlay({
  sequence,
  playerModelNumber,
  initialLineIndex = 0,
  initialChoiceId,
  onLineChange,
  onChoice,
  onComplete,
}: {
  sequence: StoryDialogSequence;
  playerModelNumber: number;
  initialLineIndex?: number;
  initialChoiceId?: string;
  onLineChange?: (lineIndex: number) => void;
  onChoice?: (choice: StoryDialogChoice) => void;
  onComplete: () => void;
}) {
  const [lineIndex, setLineIndex] = useState(() => (
    Math.min(Math.max(0, Math.floor(initialLineIndex)), Math.max(0, sequence.lines.length - 1))
  ));
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | undefined>(() => (
    initialChoiceId && sequence.lines.some(item => item.choices?.some(choice => choice.id === initialChoiceId))
      ? initialChoiceId
      : undefined
  ));
  const finishedRef = useRef(false);
  const line = sequence.lines[lineIndex];
  const isLastLine = lineIndex >= sequence.lines.length - 1;
  const activeSpeaker = line?.speaker || 'npc';
  const lineChoices = line?.choices || [];
  const selectedChoice = lineChoices.find(choice => choice.id === selectedChoiceId);
  const isChoicePending = lineChoices.length > 0 && !selectedChoice;

  useEffect(() => {
    onLineChange?.(lineIndex);
  }, [lineIndex, onLineChange]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete();
  }, [onComplete]);

  const advance = useCallback(() => {
    if (finishedRef.current || isChoicePending) return;
    if (isLastLine) {
      finish();
      return;
    }
    setLineIndex(current => current + 1);
  }, [finish, isChoicePending, isLastLine]);

  const selectChoice = useCallback((choice: StoryDialogChoice) => {
    if (selectedChoiceId) return;
    setSelectedChoiceId(choice.id);
    onChoice?.(choice);
  }, [onChoice, selectedChoiceId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target instanceof HTMLElement && event.target.closest('button, a, input, select, textarea')) return;
      if (isChoicePending) return;
      event.preventDefault();
      advance();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advance, isChoicePending]);

  if (!line) return null;

  const npcImagePath = sequence.npcAssetPath || getPlayerModelPath(sequence.npcModelNumber || 4);
  const overlay = (
    <div
      className="story-dialog-layer fixed inset-0 z-[125] flex items-end justify-center p-3 text-zinc-100 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={sequence.kicker}
      onClick={advance}
    >
      <div className="story-dialog-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="story-dialog-stage pointer-events-none absolute inset-0">
        <div className={`story-dialog-spirit story-dialog-spirit-player ${activeSpeaker === 'player' ? 'story-dialog-spirit-speaking' : ''}`}>
          <Image
            src={getPlayerModelPath(playerModelNumber)}
            alt="Your commander"
            width={520}
            height={720}
            priority
            className="story-dialog-spirit-image object-contain"
            unoptimized
          />
          <span className="story-dialog-spirit-label">You</span>
        </div>
        <div className={`story-dialog-spirit story-dialog-spirit-npc ${activeSpeaker === 'npc' ? 'story-dialog-spirit-speaking' : ''}`}>
          <Image
            src={npcImagePath}
            alt={sequence.npcName}
            width={520}
            height={720}
            priority
            className="story-dialog-spirit-image object-contain"
            unoptimized
          />
          <span className="story-dialog-spirit-label">{sequence.npcName}</span>
        </div>
      </div>

      <CinematicScrollShell
        className="story-dialog-panel w-full max-w-5xl"
        contentClassName="relative p-4 sm:p-5"
        onClick={event => event.stopPropagation()}
      >
        <div className="story-dialog-panel-glow" aria-hidden="true" />
        <div className="relative z-10">
          <div className="arcane-label">{sequence.kicker}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="fantasy-heading text-xl sm:text-2xl">
              {activeSpeaker === 'player' ? 'You' : sequence.npcName}
            </h2>
            <span className="ui-faint text-[10px] font-black uppercase tracking-[0.12em]">
              {activeSpeaker === 'player' ? 'Commander' : sequence.npcTitle}
            </span>
          </div>
          <p key={`${sequence.id}-${lineIndex}`} className="story-dialog-copy ui-muted mt-4 min-h-[4.5rem] max-w-3xl text-sm font-bold leading-relaxed sm:text-base">
            {selectedChoice?.text || line.text}
          </p>
          {isChoicePending && (
            <div className="story-dialog-choices mt-4" role="group" aria-label={line.choicePrompt || 'Choose a response'}>
              <div className="arcane-label mb-2">{line.choicePrompt || 'Choose a response'}</div>
              <div className="story-dialog-choice-grid">
                {lineChoices.map(choice => (
                  <button
                    key={choice.id}
                    type="button"
                    data-tone={choice.tone}
                    className="story-dialog-choice"
                    onClick={() => selectChoice(choice)}
                  >
                    <span className="story-dialog-choice-tone">{choice.tone}</span>
                    <span className="story-dialog-choice-label">{choice.label}</span>
                    <span className="story-dialog-choice-copy">{choice.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {isLastLine && sequence.objective && (
            <div className="story-dialog-objective mt-4 rounded border px-4 py-3">
              <div className="arcane-label">{sequence.objective.label}</div>
              <div className="mt-1 text-sm font-black text-zinc-100 sm:text-base">{sequence.objective.title}</div>
              <p className="ui-muted mt-1 text-xs font-bold leading-relaxed sm:text-sm">{sequence.objective.description}</p>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="story-dialog-hint ui-faint text-[10px] font-black uppercase tracking-[0.14em]">
                {isChoicePending ? 'Choose a response' : 'Enter or continue'}
              </span>
              <span className="story-dialog-progress" aria-label={`Dialogue line ${lineIndex + 1} of ${sequence.lines.length}`}>
                {sequence.lines.map((_, index) => (
                  <span key={index} className={index === lineIndex ? 'is-current' : index < lineIndex ? 'is-complete' : ''} />
                ))}
              </span>
            </div>
            {!isChoicePending && (
              <button
                type="button"
                onClick={advance}
                className="story-dialog-continue ui-button-primary rounded px-4 py-2 text-xs font-black uppercase"
              >
                {isLastLine ? sequence.objective ? 'Accept Order' : 'Continue' : activeSpeaker === 'npc' ? 'Respond' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </CinematicScrollShell>
    </div>
  );

  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
}
