import { apiNotConfigured } from '@/lib/apiResponses';

export const dynamic = 'force-dynamic';

export function GET() {
  return apiNotConfigured('Player profile and state API');
}

export async function PATCH() {
  return apiNotConfigured('Player profile and state API');
}
