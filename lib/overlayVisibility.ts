/** Body classes toggled by modals that cover (most of) the world map. */
const MAP_COVERING_BODY_CLASSES = [
  'town-view-open',
  'poi-view-open',
  'command-center-open',
  'multiplayer-progression-open',
];

export function isMapCoveredByModal(): boolean {
  if (typeof document === 'undefined') return false;
  return MAP_COVERING_BODY_CLASSES.some(className => document.body.classList.contains(className));
}
