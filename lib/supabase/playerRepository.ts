import type { User } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';

export interface PlayerStateRow {
  user_id: string;
  level: number;
  gold: number;
  exp: number;
  x: number;
  y: number;
  stats: User['stats'];
  inventory: User['inventory'];
  equipment: User['equipment'];
  equipped_slots: User['equippedSlots'];
  known_spell_ids: string[];
  equipped_spell_ids: string[];
  minions: User['minions'];
  job_queue: User['jobQueue'];
  traveling: User['traveling'];
  inventory_slots: number;
  inventory_upgrade_level: number;
  daily_quests?: User['dailyQuests'];
  city_quests?: User['cityQuests'];
  story_quests?: User['storyQuests'];
  daily_run?: User['dailyRun'];
  social?: User['social'];
  activity_log: User['activityLog'];
  spell_unlock_version: number;
  game_sessions: Record<string, unknown>;
  updated_at?: string;
}

export interface ProfileRow {
  id: string;
  username: string;
  selected_model: number;
}

export function userToPlayerStateRow(user: User, userId: string): PlayerStateRow {
  return {
    user_id: userId,
    level: user.stats?.level || 1,
    gold: user.gold,
    exp: user.exp,
    x: user.x,
    y: user.y,
    stats: user.stats,
    inventory: user.inventory || [],
    equipment: user.equipment || [],
    equipped_slots: user.equippedSlots || {},
    known_spell_ids: user.knownSpellIds || [],
    equipped_spell_ids: user.equippedSpellIds || [],
    minions: user.minions || [],
    job_queue: user.jobQueue || [],
    traveling: user.traveling,
    inventory_slots: user.inventorySlots || 20,
    inventory_upgrade_level: user.inventoryUpgradeLevel || 0,
    daily_quests: user.dailyQuests,
    city_quests: user.cityQuests || [],
    story_quests: user.storyQuests || [],
    daily_run: user.dailyRun,
    social: user.social,
    activity_log: user.activityLog || [],
    spell_unlock_version: user.spellUnlockVersion || 1,
    game_sessions: {},
    updated_at: new Date().toISOString(),
  };
}

export function playerStateRowToUser(row: PlayerStateRow, profile: ProfileRow): User {
  return {
    username: profile.username,
    password: '',
    gold: row.gold,
    exp: row.exp,
    x: row.x,
    y: row.y,
    inventory: row.inventory || [],
    equipment: row.equipment || [],
    equippedSlots: row.equipped_slots || {},
    minions: row.minions || [],
    activityLog: row.activity_log || [],
    stats: row.stats,
    traveling: row.traveling || null,
    jobQueue: row.job_queue || [],
    selectedModel: profile.selected_model,
    inventorySlots: row.inventory_slots,
    inventoryUpgradeLevel: row.inventory_upgrade_level,
    dailyQuests: row.daily_quests,
    cityQuests: row.city_quests || [],
    storyQuests: row.story_quests || [],
    dailyRun: row.daily_run,
    knownSpellIds: row.known_spell_ids,
    equippedSpellIds: row.equipped_spell_ids,
    spellUnlockVersion: row.spell_unlock_version,
    social: row.social,
  };
}

export async function fetchRemotePlayer(userId: string): Promise<{ profile: ProfileRow; state: PlayerStateRow } | null> {
  const supabase = createClient();

  const [{ data: profile, error: profileError }, { data: state, error: stateError }] = await Promise.all([
    supabase.from('profiles').select('id, username, selected_model').eq('id', userId).maybeSingle(),
    supabase.from('player_states').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  if (profileError) throw profileError;
  if (stateError) throw stateError;
  if (!profile || !state) return null;

  return { profile, state: state as PlayerStateRow };
}

export async function saveRemotePlayer(user: User, userId: string): Promise<void> {
  const supabase = createClient();

  const { data: existingState, error: readError } = await supabase
    .from('player_states')
    .select('game_sessions')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) throw readError;

  const row = userToPlayerStateRow(user, userId);
  row.game_sessions = {
    ...((existingState?.game_sessions as Record<string, unknown> | null) || {}),
    ...row.game_sessions,
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username: user.username,
      selected_model: user.selectedModel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) throw profileError;

  const { error: stateError } = await supabase
    .from('player_states')
    .upsert(row, { onConflict: 'user_id' });

  if (stateError) throw stateError;
}

export async function saveRemoteGameSession(userId: string, key: string, value: unknown): Promise<void> {
  const supabase = createClient();
  const { data, error: readError } = await supabase
    .from('player_states')
    .select('game_sessions')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) throw readError;

  const sessions = {
    ...((data?.game_sessions as Record<string, unknown> | null) || {}),
    [key]: value,
  };

  const { error } = await supabase
    .from('player_states')
    .update({ game_sessions: sessions, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
}

export async function readRemoteGameSession<T>(userId: string, key: string): Promise<T | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('player_states')
    .select('game_sessions')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  const sessions = (data?.game_sessions as Record<string, unknown> | null) || {};
  return (sessions[key] as T | undefined) ?? null;
}
