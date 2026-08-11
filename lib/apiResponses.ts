import {
  assertManagedAuthAvailable,
  MANAGED_AUTH_UNAVAILABLE_MESSAGE,
} from '@/lib/supabase/config';

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  deploymentMode?: 'local-prototype' | 'database' | 'unavailable';
  authMode?: 'supabase' | 'local-prototype' | 'unavailable';
}

export function apiOk<T>(
  data: T,
  init?: ResponseInit,
  deploymentMode: ApiEnvelope<T>['deploymentMode'] = 'local-prototype',
): Response {
  return Response.json(
    {
      ok: true,
      data,
      deploymentMode,
    } satisfies ApiEnvelope<T>,
    init
  );
}

export function apiNotConfigured(feature: string): Response {
  const productionBlock = assertManagedAuthAvailable();
  if (productionBlock) return productionBlock;

  return Response.json(
    {
      ok: false,
      error: `${feature} needs the live database adapter before it can be used online.`,
      deploymentMode: 'local-prototype',
    } satisfies ApiEnvelope<never>,
    { status: 501 }
  );
}

/** Shared 503 when production is live but managed auth keys are missing. */
export function apiManagedAuthUnavailable(): Response {
  return assertManagedAuthAvailable()
    ?? Response.json(
      {
        ok: false,
        error: MANAGED_AUTH_UNAVAILABLE_MESSAGE,
        authMode: 'unavailable',
        deploymentMode: 'unavailable',
      } satisfies ApiEnvelope<never>,
      { status: 503 },
    );
}
