'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { getAllStoryQuestsSorted, getCurrentUser, getStoryQuestStatus } from '@/lib/auth';
import {
  completeMultiplayerTutorialCallout,
  getNextMultiplayerTutorialCallout,
  MULTIPLAYER_TUTORIAL_CHANGE_EVENT,
  type MultiplayerTutorialCalloutId,
} from '@/lib/multiplayerTutorial';
import CinematicScrollShell from './CinematicScrollShell';

const MOBILE_TUTORIAL_QUERY = '(max-width: 820px), (pointer: coarse)';

const CALLOUT_COPY: Record<MultiplayerTutorialCalloutId, { kicker: string; title: string; body: string }> = {
  'jobs-open': {
    kicker: 'First Banner',
    title: 'Open Jobs',
    body: 'The Jobs ledger tracks active work and recent contracts. Open it once before taking your first road order.',
  },
  'job-start': {
    kicker: 'First Banner',
    title: 'Sign a real contract',
    body: 'Choose an available job at a work site. This lesson advances only after the job is accepted into your live queue.',
  },
  'harborview-travel': {
    kicker: 'The Candle Road',
    title: 'Confirm Harborview',
    body: 'Review the road time, then begin the actual journey to Harborview.',
  },
  'enemy-risk': {
    kicker: 'Scout Discipline',
    title: 'Inspect the risk',
    body: 'Compare your power, unit count, and the scout rating before committing the warband.',
  },
  'formation-confirm': {
    kicker: 'First World Battle',
    title: 'Confirm formation',
    body: 'Place the commander and fielded units, check the four spells, then start the real battle.',
  },
  'commander-loss-warning': {
    kicker: 'Commander Rule',
    title: 'Protect the commander',
    body: 'The battle ends when your commander falls, even if allied units remain. Keep the crown out of exposed lanes.',
  },
  'battle-result-claim': {
    kicker: 'Battle Report',
    title: 'Claim the result',
    body: 'Review the report before claiming. Fallen or wounded persistent units remain changed after a world battle; the claim records the reward and closes the road.',
  },
};

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
}

function getActiveStoryQuestId(): string | null {
  const user = getCurrentUser();
  if (!user) return null;
  const activeStory = getAllStoryQuestsSorted().find((story) => {
    const status = getStoryQuestStatus(user, story.id);
    return status.unlocked && !status.claimed;
  });
  if (!activeStory) return null;

  return getStoryQuestStatus(user, activeStory.id).complete ? null : activeStory.id;
}

function getAnchorRect(calloutId: MultiplayerTutorialCalloutId): AnchorRect | null {
  const anchor = Array.from(document.querySelectorAll<HTMLElement>(
    `[data-multiplayer-tutorial-anchor="${calloutId}"]`,
  )).find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return !candidate.matches(':disabled')
      && rect.width > 0
      && rect.height > 0
      && rect.bottom >= 0
      && rect.top <= window.innerHeight
      && rect.right >= 0
      && rect.left <= window.innerWidth;
  });
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
  };
}

function sameRect(left: AnchorRect | null, right: AnchorRect | null): boolean {
  if (!left || !right) return left === right;
  return Math.abs(left.top - right.top) < 0.5
    && Math.abs(left.left - right.left) < 0.5
    && Math.abs(left.width - right.width) < 0.5
    && Math.abs(left.height - right.height) < 0.5;
}

export default function MultiplayerTutorialSpotlight() {
  const [revision, setRevision] = useState(0);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const [activeStoryQuestId, setActiveStoryQuestId] = useState(getActiveStoryQuestId);
  const [suppressed, setSuppressed] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(MOBILE_TUTORIAL_QUERY).matches
  ));
  const username = getCurrentUser()?.username || null;
  const calloutId = getNextMultiplayerTutorialCallout(username, activeStoryQuestId);

  useEffect(() => {
    const interval = window.setInterval(() => setActiveStoryQuestId(getActiveStoryQuestId()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_TUTORIAL_QUERY);
    const handleMediaChange = () => setSuppressed(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    const handleProgressChange = () => setRevision(current => current + 1);
    window.addEventListener(MULTIPLAYER_TUTORIAL_CHANGE_EVENT, handleProgressChange);
    return () => window.removeEventListener(MULTIPLAYER_TUTORIAL_CHANGE_EVENT, handleProgressChange);
  }, []);

  useEffect(() => {
    if (!calloutId || suppressed) return undefined;
    let frame = 0;
    const updateAnchor = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextRect = getAnchorRect(calloutId);
        setAnchorRect(current => sameRect(current, nextRect) ? current : nextRect);
      });
    };
    const observer = new MutationObserver(updateAnchor);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    updateAnchor();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [calloutId, revision, suppressed]);

  if (!calloutId || !anchorRect || suppressed || typeof document === 'undefined') return null;

  const copy = CALLOUT_COPY[calloutId];
  const panelWidth = Math.min(360, window.innerWidth - 24);
  const panelLeft = Math.max(12, Math.min(
    window.innerWidth - panelWidth - 12,
    anchorRect.left + anchorRect.width / 2 - panelWidth / 2,
  ));
  const placeBelow = anchorRect.bottom + 180 < window.innerHeight;
  const panelTop = placeBelow
    ? anchorRect.bottom + 10
    : Math.max(12, anchorRect.top - 170);

  return createPortal(
    <div className="multiplayer-tutorial-layer" aria-live="polite">
      <div
        className="multiplayer-tutorial-ring"
        style={{
          top: anchorRect.top - 5,
          left: anchorRect.left - 5,
          width: anchorRect.width + 10,
          height: anchorRect.height + 10,
        }}
        aria-hidden="true"
      />
      <CinematicScrollShell
        variant="compact"
        className="multiplayer-tutorial-callout"
        contentClassName="multiplayer-tutorial-callout-content"
        style={{ top: panelTop, left: panelLeft, width: panelWidth }}
        role="status"
      >
        <p className="multiplayer-tutorial-kicker">{copy.kicker}</p>
        <h2 className="multiplayer-tutorial-title fantasy-heading">{copy.title}</h2>
        <p className="multiplayer-tutorial-copy">{copy.body}</p>
        {calloutId === 'commander-loss-warning' && (
          <button
            type="button"
            className="multiplayer-tutorial-ack ui-button-primary"
            onClick={() => completeMultiplayerTutorialCallout(username, calloutId)}
          >
            Understood
          </button>
        )}
      </CinematicScrollShell>
    </div>,
    document.body,
  );
}
