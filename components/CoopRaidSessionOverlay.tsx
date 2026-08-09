'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { getPlayerModelPath } from '@/lib/assetLoader';
import { getCurrentUser, type User } from '@/lib/auth';
import {
  abandonCurrentCoopRaidSession,
  applyCurrentCoopRaidAction,
  confirmCurrentCoopRaidFormation,
  COOP_RAID_SESSION_UPDATED_EVENT,
  getCurrentCoopRaidSession,
  settleCurrentCoopRaidSession,
  syncOnlineCoopRaidSessions,
} from '@/lib/coopRaidClient';
import {
  getCoopRaidFormation,
  getCoopRaidReward,
  getCoopRaidSnapshot,
  type CoopRaidSession,
} from '@/lib/coopRaidSessions';
import type { PlayerModelNumber, SynchronizedBattleAction } from '@/lib/battle';
import BattleModal, {
  type BattleModalActionRequest,
  type BattleModalActionResponse,
} from './BattleModal';
import CinematicScrollShell from './CinematicScrollShell';
import FormationPanel from './FormationPanel';

function ReadinessRow({
  username,
  model,
  ready,
  local,
}: {
  username: string;
  model: number;
  ready: boolean;
  local: boolean;
}) {
  return (
    <div className={`coop-raid-ready-row flex items-center gap-3 rounded border px-3 py-3 ${ready ? 'coop-raid-ready-row-confirmed' : ''}`}>
      <span className="relative h-14 w-14 shrink-0 overflow-hidden">
        <Image src={getPlayerModelPath(model)} alt="" fill className="object-contain" unoptimized />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm text-zinc-100">{username}</strong>
        <span className="ui-muted block text-[11px] font-bold">{local ? 'Your warband' : 'Party warband'}</span>
      </span>
      <span className={`ui-pill rounded border px-2 py-1 text-[10px] font-black uppercase ${ready ? 'text-emerald-200' : 'text-amber-200'}`}>
        {ready ? 'Ready' : 'Forming'}
      </span>
    </div>
  );
}

export default function CoopRaidSessionOverlay() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [session, setSession] = useState<CoopRaidSession | null>(() => {
    const user = getCurrentUser();
    return user ? getCurrentCoopRaidSession(user.username) || null : null;
  });
  const [formationDraft, setFormationDraft] = useState<{
    sessionId: string;
    placements: Record<string, { x: number; y: number }>;
  } | null>(null);
  const [spellDraft, setSpellDraft] = useState<{ sessionId: string; spellIds: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    if (!user) {
      setSession(null);
      return;
    }
    void syncOnlineCoopRaidSessions().then(() => {
      const next = getCurrentCoopRaidSession(user.username);
      setSession(current => (
        current?.id === next?.id && current?.version === next?.version ? current : next || null
      ));
    });
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 1_000);
    window.addEventListener(COOP_RAID_SESSION_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener(COOP_RAID_SESSION_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const username = currentUser?.username || '';
  const snapshot = session && username ? getCoopRaidSnapshot(session, username) : null;
  const savedFormation = session && username ? getCoopRaidFormation(session, username) : null;
  const currentFormation = formationDraft && formationDraft.sessionId === session?.id
    ? formationDraft.placements
    : savedFormation?.placements || {};
  const currentSpellIds = spellDraft && spellDraft.sessionId === session?.id
    ? spellDraft.spellIds
    : savedFormation?.equippedSpellIds || [];

  const handleBattleAction = useCallback((request: BattleModalActionRequest): BattleModalActionResponse => {
    if (!session?.combatSnapshot || !username) {
      return { success: false, error: 'Raid session is not ready.' };
    }
    const now = Date.now();
    const action: SynchronizedBattleAction = {
      ...request,
      id: `${session.id}-${session.version}-${session.combatSnapshot.revision || 0}-${request.type}-${now}`,
      actorUsername: username,
      expectedRevision: session.combatSnapshot.revision || 0,
      createdAt: now,
    };
    const result = applyCurrentCoopRaidAction(session.id, action, session.version, now);
    if (!result.success || !result.session?.combatSnapshot) {
      return { success: false, error: result.error || 'Raid command failed.' };
    }
    setSession(result.session);
    setNotice(null);
    return { success: true, battle: result.session.combatSnapshot };
  }, [session, username]);

  const abandon = () => {
    if (!session || !username || busy) return;
    setBusy(true);
    void abandonCurrentCoopRaidSession(session.id, username, session.version).then(result => {
      if (!result.success) {
        setNotice(result.error || 'Could not abandon the raid.');
        setConfirmAbandon(false);
        return;
      }
      setSession(result.session?.phase === 'completed' ? result.session : null);
      setConfirmAbandon(false);
    }).finally(() => setBusy(false));
  };

  if (!session || !snapshot || !savedFormation || session.phase === 'expired' || session.phase === 'abandoned') {
    return null;
  }

  if (session.phase === 'formation' && !savedFormation.confirmedAt) {
    return (
      <div className="fixed inset-0 z-[96] overflow-auto bg-black/90 p-2">
        <FormationPanel
          enemyName={session.bossSnapshot.name}
          enemySubtitle="Four-phase co-op raid"
          commanderName={username}
          commanderModel={snapshot.selectedModel as PlayerModelNumber}
          stacks={snapshot.minions}
          maxFielded={5}
          formation={currentFormation}
          spellIds={currentSpellIds}
          knownSpellIds={snapshot.knownSpellIds}
          organizedRoster
          onChangeFormation={placements => setFormationDraft({ sessionId: session.id, placements })}
          onChangeSpellIds={nextSpellIds => setSpellDraft({ sessionId: session.id, spellIds: nextSpellIds })}
          onStart={() => {
            if (busy) return;
            setBusy(true);
            void confirmCurrentCoopRaidFormation(
              session.id,
              username,
              currentFormation,
              currentSpellIds,
              session.version,
            ).then(result => {
              if (!result.success || !result.session) {
                setNotice(result.error || 'Could not confirm raid formation.');
                return;
              }
              setSession(result.session);
              setNotice('Raid formation confirmed.');
            }).finally(() => setBusy(false));
          }}
          onBack={() => setConfirmAbandon(true)}
        />
        {notice && (
          <div className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 rounded border border-[rgba(226,190,103,0.48)] bg-black/92 px-4 py-3 text-sm font-black text-[var(--ui-accent)]">
            {notice}
          </div>
        )}
        {confirmAbandon && <AbandonRaidConfirmation onStay={() => setConfirmAbandon(false)} onAbandon={abandon} />}
      </div>
    );
  }

  if (session.phase === 'formation') {
    const hostReady = Boolean(session.hostFormation.confirmedAt);
    const allyReady = Boolean(session.allyFormation.confirmedAt);
    return (
      <div className="cinematic-scroll-overlay fixed inset-0 z-[96] flex items-center justify-center p-4">
        <CinematicScrollShell variant="compact" className="w-full max-w-2xl text-zinc-100">
          <div className="px-6 py-7">
            <div className="arcane-label">Raid Assembly</div>
            <h2 className="fantasy-heading mt-2 text-3xl">Awaiting Both Banners</h2>
            <p className="ui-muted mt-3 text-sm font-bold leading-relaxed">
              Each commander controls only their own formation and units. Combat opens when both warbands are sealed.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <ReadinessRow
                username={session.hostUsername}
                model={session.hostSnapshot.selectedModel}
                ready={hostReady}
                local={session.hostUsername.toLowerCase() === username.toLowerCase()}
              />
              <ReadinessRow
                username={session.allyUsername}
                model={session.allySnapshot.selectedModel}
                ready={allyReady}
                local={session.allyUsername.toLowerCase() === username.toLowerCase()}
              />
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setConfirmAbandon(true)} className="ui-button rounded px-4 py-2.5 text-xs font-black">
                Abandon Raid
              </button>
            </div>
            {notice && <p className="mt-3 text-xs font-bold text-amber-200">{notice}</p>}
          </div>
        </CinematicScrollShell>
        {confirmAbandon && <AbandonRaidConfirmation onStay={() => setConfirmAbandon(false)} onAbandon={abandon} />}
      </div>
    );
  }

  if (session.phase === 'active' && session.combatSnapshot) {
    return (
      <>
        <BattleModal
          enemy={session.bossSnapshot}
          battleState={session.combatSnapshot}
          localUsername={username}
          availableSpellIds={savedFormation.equippedSpellIds}
          persistentResults={false}
          contextLabel="Duo Raid"
          onBattleAction={handleBattleAction}
          onRetreatRequest={() => setConfirmAbandon(true)}
          onClose={() => undefined}
        />
        {confirmAbandon && (
          <AbandonRaidConfirmation onStay={() => setConfirmAbandon(false)} onAbandon={abandon} />
        )}
      </>
    );
  }

  const result = session.result;
  const won = result?.outcome === 'victory';
  const reward = won ? getCoopRaidReward(session, username) : null;
  return (
    <div className="cinematic-scroll-overlay fixed inset-0 z-[100] flex items-center justify-center p-4">
      <CinematicScrollShell variant="compact" className="w-full max-w-2xl text-zinc-100">
        <div className="px-6 py-8 text-center">
          <div className="arcane-label">Co-op Raid Complete</div>
          <h2 className="fantasy-heading mt-2 text-4xl">
            {won ? 'Incursion Broken' : result?.outcome === 'abandoned' ? 'Banners Withdrawn' : 'Raid Defeated'}
          </h2>
          <p className="ui-muted mx-auto mt-4 max-w-lg text-sm font-bold leading-relaxed">
            {won
              ? `${session.hostUsername} and ${session.allyUsername} broke all four phases of ${session.bossSnapshot.name}.`
              : `The raid against ${session.bossSnapshot.name} ended without a reward claim.`}
          </p>
          {reward && (
            <div className="coop-raid-reward-grid mx-auto mt-5 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
              <RewardCell icon="/assets/icons/gold.png" label="Gold" value={String(reward.gold)} />
              <RewardCell icon="/assets/icons/xp.png" label="XP" value={String(reward.exp)} />
              <RewardCell icon="/assets/icons/rare-gem.png" label="Gems" value={String(reward.rareGems)} />
              <RewardCell icon="/assets/icons/loot-chest.png" label="Gear" value={reward.equipmentRarity} />
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              void settleCurrentCoopRaidSession(session.id, username, session.version).then(settled => {
                if (!settled.success) {
                  setNotice(settled.error || 'Could not settle the raid result.');
                  return;
                }
                setSession(null);
                setCurrentUser(getCurrentUser());
              }).finally(() => setBusy(false));
            }}
            className="ui-button-primary mt-6 rounded px-6 py-3 text-sm font-black disabled:opacity-40"
          >
            {won ? 'Claim Raid Loot' : 'Close Raid Report'}
          </button>
          {notice && <p className="mt-4 text-xs font-bold text-red-200">{notice}</p>}
        </div>
      </CinematicScrollShell>
    </div>
  );
}

function RewardCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="ui-card rounded border px-3 py-3 text-left">
      <div className="flex items-center gap-2">
        <span className="relative h-7 w-7 shrink-0"><Image src={icon} alt="" fill className="object-contain" unoptimized /></span>
        <span className="min-w-0">
          <span className="ui-faint block text-[9px] font-black uppercase">{label}</span>
          <strong className="ui-value block truncate text-sm capitalize">{value}</strong>
        </span>
      </div>
    </div>
  );
}

function AbandonRaidConfirmation({ onStay, onAbandon }: { onStay: () => void; onAbandon: () => void }) {
  return (
    <div className="cinematic-scroll-overlay fixed inset-0 z-[160] flex items-center justify-center p-4">
      <CinematicScrollShell variant="compact" className="w-full max-w-lg text-zinc-100">
        <div className="px-6 py-7 text-center">
          <div className="arcane-label">Party Decision</div>
          <h3 className="fantasy-heading mt-2 text-3xl">Abandon this raid?</h3>
          <p className="ui-muted mt-3 text-sm font-bold">The shared session ends for both commanders and no raid loot can be claimed.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={onStay} className="ui-button rounded px-5 py-2.5 text-xs font-black">Stay</button>
            <button type="button" onClick={onAbandon} className="ui-button-danger rounded px-5 py-2.5 text-xs font-black">Abandon Raid</button>
          </div>
        </div>
      </CinematicScrollShell>
    </div>
  );
}
