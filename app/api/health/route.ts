import { apiOk } from '@/lib/apiResponses';

export const dynamic = 'force-dynamic';

export function GET() {
  return apiOk({
    status: 'ready',
    storage: 'local-prototype',
    databaseConnected: false,
  });
}
