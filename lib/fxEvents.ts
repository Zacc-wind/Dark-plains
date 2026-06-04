export type FxEventType =
  | 'victory'
  | 'defeat'
  | 'quest'
  | 'job'
  | 'run'
  | 'recruit'
  | 'heal'
  | 'defense'
  | 'attack'
  | 'status'
  | 'spell'
  | 'travel'
  | 'city'
  | 'dungeon'
  | 'spawn'
  | 'daily'
  | 'interface';

export type FxTone = 'gold' | 'blue' | 'green' | 'red' | 'violet' | 'bone' | 'neutral';

export interface FxEvent {
  type: FxEventType;
  tone?: FxTone;
  intensity?: number;
  x?: number;
  y?: number;
  label?: string;
}

export const FX_EVENT_NAME = 'wizardy:fx-event';

export function emitFxEvent(event: FxEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<FxEvent>(FX_EVENT_NAME, { detail: event }));
}
