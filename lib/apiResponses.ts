export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  deploymentMode?: 'local-prototype' | 'database';
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
  return Response.json(
    {
      ok: false,
      error: `${feature} needs the live database adapter before it can be used online.`,
      deploymentMode: 'local-prototype',
    } satisfies ApiEnvelope<never>,
    { status: 501 }
  );
}
