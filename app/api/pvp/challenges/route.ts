import { apiNotConfigured } from '@/lib/apiResponses';

export const dynamic = 'force-dynamic';

export function GET() {
  return apiNotConfigured('PVP challenge API');
}

export async function POST() {
  return apiNotConfigured('PVP challenge API');
}
