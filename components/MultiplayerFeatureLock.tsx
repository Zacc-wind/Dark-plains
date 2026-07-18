import type { MultiplayerUnlockStatus } from '@/lib/multiplayerUnlocks';

export default function MultiplayerFeatureLock({
  status,
  compact = false,
}: {
  status: MultiplayerUnlockStatus;
  compact?: boolean;
}) {
  return (
    <div className={`multiplayer-feature-lock ${compact ? 'multiplayer-feature-lock-compact' : ''}`}>
      <span className="multiplayer-feature-lock-icon" aria-hidden="true">&#128274;</span>
      <div className="min-w-0">
        <p className="arcane-label">Level {status.minLevel} Unlock</p>
        <h3 className="fantasy-heading multiplayer-feature-lock-title">{status.title}</h3>
        <p className="ui-muted multiplayer-feature-lock-copy">{status.description}</p>
      </div>
      <span className="ui-pill multiplayer-feature-lock-level rounded border">Lv {status.level}/{status.minLevel}</span>
    </div>
  );
}
