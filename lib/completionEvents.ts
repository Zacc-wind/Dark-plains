export type CompletionNoticeKind = 'victory' | 'defeat' | 'quest' | 'job' | 'run' | 'recruit' | 'gear';

export interface CompletionRewardLine {
  label: string;
  value: string;
  tone?: 'gold' | 'blue' | 'green' | 'red' | 'violet' | 'neutral';
}

export interface CompletionNotice {
  id: string;
  kind: CompletionNoticeKind;
  title: string;
  kicker?: string;
  description?: string;
  artworkPath?: string;
  artworkStyle?: 'item' | 'plain';
  rewards?: CompletionRewardLine[];
  completedAt?: number;
  /** @deprecated Use skipBurst instead. */
  skipReport?: boolean;
  /** Open the reward card immediately without the title burst. */
  skipBurst?: boolean;
}

const COMPLETION_EVENT_NAME = 'wizardy:completion-notice';
const COMPLETION_STATE_EVENT_NAME = 'wizardy:completion-overlay-state';

export type CompletionOverlayState = 'idle' | 'busy';

export function notifyCompletionOverlayState(state: CompletionOverlayState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CompletionOverlayState>(COMPLETION_STATE_EVENT_NAME, { detail: state }));
}

export function subscribeCompletionOverlayState(handler: (state: CompletionOverlayState) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const listener = (event: Event) => {
    handler((event as CustomEvent<CompletionOverlayState>).detail);
  };

  window.addEventListener(COMPLETION_STATE_EVENT_NAME, listener);
  return () => window.removeEventListener(COMPLETION_STATE_EVENT_NAME, listener);
}

export function subscribeCompletionOverlayIdle(handler: () => void): () => void {
  return subscribeCompletionOverlayState(state => {
    if (state === 'idle') handler();
  });
}

export function emitCompletionNotice(notice: CompletionNotice): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CompletionNotice>(COMPLETION_EVENT_NAME, { detail: notice }));
}

export function subscribeCompletionNotices(handler: (notice: CompletionNotice) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const listener = (event: Event) => {
    handler((event as CustomEvent<CompletionNotice>).detail);
  };

  window.addEventListener(COMPLETION_EVENT_NAME, listener);
  return () => window.removeEventListener(COMPLETION_EVENT_NAME, listener);
}
