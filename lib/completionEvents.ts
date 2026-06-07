export type CompletionNoticeKind = 'victory' | 'defeat' | 'quest' | 'job' | 'run' | 'recruit';

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
  rewards?: CompletionRewardLine[];
  completedAt?: number;
}

const COMPLETION_EVENT_NAME = 'wizardy:completion-notice';

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
