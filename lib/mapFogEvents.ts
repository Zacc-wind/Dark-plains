export interface MapFogState {
  pointer: { x: number; y: number } | null;
  player: { x: number; y: number } | null;
  width: number;
  height: number;
  zoom: number;
}

export const MAP_FOG_EVENT_NAME = 'wizardy:map-fog-state';

export function emitMapFogState(state: MapFogState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<MapFogState>(MAP_FOG_EVENT_NAME, { detail: state }));
}
