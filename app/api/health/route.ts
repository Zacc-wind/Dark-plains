import { apiOk } from '@/lib/apiResponses';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return apiOk({
      status: 'ready',
      storage: 'local-prototype',
      databaseConnected: false,
    });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const databaseConnected = !error;

    return apiOk({
      status: 'ready',
      storage: 'supabase',
      databaseConnected,
      schemaReady: databaseConnected,
      hint: databaseConnected
        ? 'Supabase is connected.'
        : 'Run supabase/migrations/001_initial_schema.sql in the Supabase SQL editor.',
    }, { status: 200 }, 'database');
  } catch {
    return apiOk({
      status: 'ready',
      storage: 'supabase',
      databaseConnected: false,
      schemaReady: false,
      hint: 'Supabase env vars are set, but the server client failed to connect.',
    }, { status: 200 }, 'database');
  }
}
