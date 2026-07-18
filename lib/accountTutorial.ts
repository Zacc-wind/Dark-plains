import { readGameJson, writeGameJson } from '@/lib/gameStore';
import type { ModeTutorialProgress } from '@/lib/modeTutorial';
import type { SingleplayerRunTutorialProgress } from '@/lib/singleplayerTutorial';
import type { MultiplayerTutorialProgress } from '@/lib/multiplayerTutorial';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { saveRemoteGameSession } from '@/lib/supabase/playerRepository';
import { createClient } from '@/lib/supabase/client';

export interface AccountTutorials {
  mode?: ModeTutorialProgress;
  singleplayerRun?: SingleplayerRunTutorialProgress;
  multiplayer?: MultiplayerTutorialProgress;
}

const ACCOUNT_TUTORIALS_PREFIX = 'wizardy_account_tutorials';
const REMOTE_TUTORIALS_KEY = 'tutorials';
const persistenceQueues = new Map<string, Promise<void>>();

function getLocalKey(username: string): string {
  return `${ACCOUNT_TUTORIALS_PREFIX}_${username.trim().toLowerCase()}`;
}

export function readAccountTutorials(username?: string | null): AccountTutorials {
  if (!username) return {};
  return readGameJson<AccountTutorials>(getLocalKey(username), {});
}

export function writeAccountTutorials(username: string | null | undefined, tutorials: AccountTutorials): void {
  if (!username) return;
  writeGameJson(getLocalKey(username), tutorials);
  const queueKey = username.trim().toLowerCase();
  const previous = persistenceQueues.get(queueKey) || Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(() => persistAccountTutorials(username, tutorials));
  persistenceQueues.set(queueKey, queued);
  void queued.finally(() => {
    if (persistenceQueues.get(queueKey) === queued) persistenceQueues.delete(queueKey);
  });
}

export function applyRemoteAccountTutorials(username: string, tutorials: AccountTutorials | null | undefined): void {
  if (!username || !tutorials) return;
  const local = readAccountTutorials(username);
  const remoteMultiplayer = tutorials.multiplayer;
  const localMultiplayer = local.multiplayer;
  const multiplayer = (localMultiplayer?.updatedAt || 0) > (remoteMultiplayer?.updatedAt || 0)
    ? localMultiplayer
    : remoteMultiplayer ?? localMultiplayer;
  writeGameJson(getLocalKey(username), {
    mode: tutorials.mode ?? local.mode,
    singleplayerRun: tutorials.singleplayerRun ?? local.singleplayerRun,
    multiplayer,
  });
}

async function persistAccountTutorials(username: string, tutorials: AccountTutorials): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await saveRemoteGameSession(user.id, REMOTE_TUTORIALS_KEY, tutorials);
  } catch {
    // Tutorial sync is best-effort; local progress still applies for this session.
  }
}

export function readRemoteTutorialsFromGameSessions(gameSessions: Record<string, unknown> | null | undefined): AccountTutorials | null {
  const tutorials = gameSessions?.[REMOTE_TUTORIALS_KEY];
  if (!tutorials || typeof tutorials !== 'object') return null;
  return tutorials as AccountTutorials;
}
