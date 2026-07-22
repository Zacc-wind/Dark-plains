import { apiOk } from '@/lib/apiResponses';
import type { LeaderboardScope } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const requestedScope = new URL(request.url).searchParams.get('scope');
  const scope: LeaderboardScope = requestedScope === 'run' || requestedScope === 'all' ? requestedScope : 'world';
  return apiOk({
    scope,
    boards: [],
    source: 'database-pending',
    message: `${scope === 'run' ? 'Singleplayer run' : scope === 'all' ? 'Combined' : 'Multiplayer world'} boards are waiting for the Supabase adapter.`,
  });
}
