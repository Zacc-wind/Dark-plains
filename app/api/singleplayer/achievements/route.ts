import { apiNotConfigured, apiOk } from '@/lib/apiResponses';
import { getDailyRunState } from '@/lib/auth';
import { getRunDiscoveryViews } from '@/lib/runDiscovery';
import {
  getRunMilestoneUnlockCounts,
  getRunMilestoneViews,
  isRunMilestoneRewardClaimed,
} from '@/lib/runMilestones';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { playerStateRowToUser } from '@/lib/supabase/playerRepository';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseConfigured()) return apiNotConfigured('Singleplayer achievement API');

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ ok: false, error: 'Not authenticated.', deploymentMode: 'database' }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: state, error: stateError }] = await Promise.all([
    supabase.from('profiles').select('id, username, selected_model').eq('id', user.id).maybeSingle(),
    supabase.from('player_states').select('*').eq('user_id', user.id).maybeSingle(),
  ]);

  if (profileError || stateError) {
    return Response.json({
      ok: false,
      error: profileError?.message || stateError?.message || 'Failed to load singleplayer progression.',
      deploymentMode: 'database',
    }, { status: 500 });
  }
  if (!profile || !state) {
    return Response.json({
      ok: false,
      error: 'Player profile or save row is missing. Apply the checked-in Supabase migrations first.',
      deploymentMode: 'database',
    }, { status: 404 });
  }

  const player = playerStateRowToUser(state, profile);
  const runState = getDailyRunState(player);
  const milestones = getRunMilestoneViews(runState).map(milestone => ({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    category: milestone.category,
    tier: milestone.tier,
    iconPath: milestone.iconPath,
    unlocked: milestone.unlocked,
    unlockedAt: milestone.unlockedAt,
    progressLabel: milestone.progressLabel,
    rewardHint: milestone.rewardHint,
    claimReward: milestone.claimReward,
    rewardClaimed: isRunMilestoneRewardClaimed(runState, milestone.id),
  }));
  const discoveries = getRunDiscoveryViews(runState).map(discovery => ({
    id: discovery.key,
    kind: discovery.kind,
    contentId: discovery.contentId,
    name: discovery.name,
    description: discovery.description,
    iconPath: discovery.iconPath,
    sourceType: discovery.sourceType,
    sourceId: discovery.sourceId,
    minRunLevel: discovery.minRunLevel,
    tier: discovery.tier,
    classId: discovery.classId,
    unlocked: discovery.unlocked,
    unlockedAt: discovery.unlockedAt,
    pendingOffer: discovery.pendingOffer,
    progressLabel: discovery.progressLabel,
  }));

  return apiOk({
    runLevel: runState.runLevel,
    runExp: runState.runExp,
    milestoneCounts: getRunMilestoneUnlockCounts(runState),
    milestones,
    discoveries,
  }, undefined, 'database');
}
