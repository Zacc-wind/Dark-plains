import { apiOk } from '@/lib/apiResponses';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import {
  assertManagedAuthAvailable,
  getAuthMode,
  isSupabaseConfigured,
  MANAGED_AUTH_UNAVAILABLE_MESSAGE,
} from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (assertManagedAuthAvailable()) {
    return Response.json(
      {
        ok: false,
        error: MANAGED_AUTH_UNAVAILABLE_MESSAGE,
        data: {
          status: 'auth_unavailable',
          storage: 'unavailable',
          authMode: getAuthMode(),
          databaseConnected: false,
        },
        authMode: getAuthMode(),
        deploymentMode: 'unavailable',
      },
      { status: 503 },
    );
  }

  if (!isSupabaseConfigured()) {
    return apiOk({
      status: 'ready',
      storage: 'local-prototype',
      authMode: getAuthMode(),
      databaseConnected: false,
    });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const databaseConnected = !error;
    const registrationReady = isSupabaseAdminConfigured();

    return apiOk({
      status: 'ready',
      storage: 'supabase',
      authMode: getAuthMode(),
      databaseConnected,
      schemaReady: databaseConnected,
      registrationReady,
      hint: databaseConnected
        ? registrationReady
          ? 'Supabase is connected. Registration is ready.'
          : 'Supabase is connected. Add SUPABASE_SERVICE_ROLE_KEY to enable registration.'
        : 'Run supabase/migrations/001_initial_schema.sql in the Supabase SQL editor.',
    }, { status: 200 }, 'database');
  } catch {
    return apiOk({
      status: 'ready',
      storage: 'supabase',
      authMode: getAuthMode(),
      databaseConnected: false,
      schemaReady: false,
      hint: 'Supabase env vars are set, but the server client failed to connect.',
    }, { status: 200 }, 'database');
  }
}
