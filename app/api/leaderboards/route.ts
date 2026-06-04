import { apiOk } from '@/lib/apiResponses';

export const dynamic = 'force-dynamic';

export function GET() {
  return apiOk({
    boards: [],
    source: 'database-pending',
    message: 'The client Leaders panel still reads the local prototype store until Supabase is connected.',
  });
}
