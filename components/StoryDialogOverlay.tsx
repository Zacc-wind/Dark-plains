'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPlayerModelPath } from '@/lib/assetLoader';
import type { StoryDialogSequence } from '@/lib/storyDialogue';

export default function StoryDialogOverlay({
  sequence,
  playerModelNumber,
  onComplete,
}: {
  sequence: StoryDialogSequence;
  playerModelNumber: number;
  onComplete: () => void;
}) {
  const [lineIndex, setLineIndex] = useState(0);
  const finishedRef = useRef(false);
  const line = sequence.lines[lineIndex];
  const isLastLine = lineIndex >= sequence.lines.length - 1;
  const activeSpeaker = line?.speaker || 'npc';

  useEffect(() => {
    setLineIndex(0);
    finishedRef.current = false;
  }, [sequence.id]);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete();
  };

  const advance = () => {
    if (finishedRef.current) return;
    if (isLastLine) {
      finish();
      return;
    }
    setLineIndex(current => current + 1);
  };

  if (!line) return null;

  const overlay = (
    <div
      className="story-dialog-layer fixed inset-0 z-[125] flex items-end justify-center p-3 text-zinc-100 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={sequence.kicker}
      onClick={advance}
    >
      <div className="story-dialog-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="story-dialog-stage pointer-events-none absolute inset-x-0 bottom-[9.5rem] flex items-end justify-center gap-4 px-4 sm:bottom-[10.5rem] sm:gap-8">
        <div className={`story-dialog-spirit story-dialog-spirit-player ${activeSpeaker === 'player' ? 'story-dialog-spirit-speaking' : ''}`}>
          <Image
            src={getPlayerModelPath(playerModelNumber)}
            alt=""
            width={120}
            height={120}
            className="story-dialog-spirit-image object-contain"
            unoptimized
          />
          <span className="story-dialog-spirit-label">You</span>
        </div>
        <div className={`story-dialog-spirit story-dialog-spirit-npc ${activeSpeaker === 'npc' ? 'story-dialog-spirit-speaking' : ''}`}>
          <Image
            src={getPlayerModelPath(sequence.npcModelNumber || 4)}
            alt=""
            width={120}
            height={120}
            className="story-dialog-spirit-image object-contain"
            unoptimized
          />
          <span className="story-dialog-spirit-label">{sequence.npcName}</span>
        </div>
      </div>

      <section
        className="story-dialog-panel command-panel vine-frame relative w-full max-w-3xl rounded border p-4 sm:p-5"
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
          <p className="ui-muted mt-4 min-h-[4.5rem] text-sm font-bold leading-relaxed sm:text-base">
            {line.text}
          </p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="story-dialog-hint ui-faint text-[10px] font-black uppercase tracking-[0.14em]">
              Tap outside or continue
            </span>
            <button
              type="button"
              onClick={advance}
              className="story-dialog-continue ui-button-primary rounded px-4 py-2 text-xs font-black uppercase"
            >
              {isLastLine ? 'Continue' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
}
