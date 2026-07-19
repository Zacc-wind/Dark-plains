export type SocialRequestKind = 'party' | 'trade';
export type SocialRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface SocialRequestPayload {
  partyLeaderUsername?: string;
  partyMemberCount?: number;
  tradeSessionId?: string;
}

export interface SocialRequestRecord {
  id: string;
  kind: SocialRequestKind;
  senderUsername: string;
  receiverUsername: string;
  createdAt: number;
  expiresAt: number;
  status: SocialRequestStatus;
  respondedAt?: number;
  payload?: SocialRequestPayload;
}

export const SOCIAL_REQUEST_TTL_MS = 2 * 60 * 1000;
const SOCIAL_REQUEST_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_KINDS = new Set<SocialRequestKind>(['party', 'trade']);
const VALID_STATUSES = new Set<SocialRequestStatus>(['pending', 'accepted', 'declined', 'expired', 'cancelled']);

function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 40) : '';
}

export function normalizeSocialRequests(
  records: readonly Partial<SocialRequestRecord>[] | null | undefined,
  now = Date.now(),
): SocialRequestRecord[] {
  const seenIds = new Set<string>();
  const normalized: SocialRequestRecord[] = [];

  (records || []).forEach(record => {
    const id = typeof record.id === 'string' ? record.id.trim().slice(0, 160) : '';
    const senderUsername = normalizeUsername(record.senderUsername);
    const receiverUsername = normalizeUsername(record.receiverUsername);
    const kind = VALID_KINDS.has(record.kind as SocialRequestKind) ? record.kind as SocialRequestKind : null;
    const status = VALID_STATUSES.has(record.status as SocialRequestStatus)
      ? record.status as SocialRequestStatus
      : 'pending';
    const createdAt = Number.isFinite(record.createdAt) ? Number(record.createdAt) : now;
    const expiresAt = Number.isFinite(record.expiresAt)
      ? Math.max(createdAt, Number(record.expiresAt))
      : createdAt + SOCIAL_REQUEST_TTL_MS;
    if (!id || !senderUsername || !receiverUsername || !kind || seenIds.has(id)) return;
    if (expiresAt < now - SOCIAL_REQUEST_RETENTION_MS) return;
    seenIds.add(id);

    const expired = status === 'pending' && expiresAt <= now;
    const respondedAt = expired
      ? expiresAt
      : Number.isFinite(record.respondedAt) ? Number(record.respondedAt) : undefined;
    const payload = record.payload ? {
      partyLeaderUsername: normalizeUsername(record.payload.partyLeaderUsername) || undefined,
      partyMemberCount: Number.isFinite(record.payload.partyMemberCount)
        ? Math.max(1, Math.floor(Number(record.payload.partyMemberCount)))
        : undefined,
      tradeSessionId: typeof record.payload.tradeSessionId === 'string'
        ? record.payload.tradeSessionId.trim().slice(0, 160) || undefined
        : undefined,
    } : undefined;
    normalized.push({
      id,
      kind,
      senderUsername,
      receiverUsername,
      createdAt,
      expiresAt,
      status: expired ? 'expired' : status,
      ...(respondedAt ? { respondedAt } : {}),
      ...(payload ? { payload } : {}),
    });
  });

  return normalized.sort((left, right) => right.createdAt - left.createdAt).slice(0, 40);
}

export function createSocialRequest({
  kind,
  senderUsername,
  receiverUsername,
  payload,
  now = Date.now(),
  ttlMs = SOCIAL_REQUEST_TTL_MS,
}: {
  kind: SocialRequestKind;
  senderUsername: string;
  receiverUsername: string;
  payload?: SocialRequestPayload;
  now?: number;
  ttlMs?: number;
}): SocialRequestRecord {
  const sender = senderUsername.trim();
  const receiver = receiverUsername.trim();
  const sequence = `${kind}-${sender.toLowerCase()}-${receiver.toLowerCase()}-${now}`;
  return {
    id: `social-request-${sequence}`,
    kind,
    senderUsername: sender,
    receiverUsername: receiver,
    createdAt: now,
    expiresAt: now + Math.max(10_000, Math.floor(ttlMs)),
    status: 'pending',
    payload,
  };
}

export function getIncomingSocialRequests(
  records: readonly Partial<SocialRequestRecord>[] | null | undefined,
  receiverUsername: string,
  now = Date.now(),
): SocialRequestRecord[] {
  const receiver = receiverUsername.trim().toLowerCase();
  return normalizeSocialRequests(records, now).filter(record => (
    record.status === 'pending'
    && record.receiverUsername.toLowerCase() === receiver
  ));
}

export function respondToSocialRequest(
  records: readonly Partial<SocialRequestRecord>[] | null | undefined,
  requestId: string,
  receiverUsername: string,
  status: Extract<SocialRequestStatus, 'accepted' | 'declined'>,
  now = Date.now(),
): { success: boolean; records: SocialRequestRecord[]; request?: SocialRequestRecord; error?: string } {
  const normalized = normalizeSocialRequests(records, now);
  const request = normalized.find(record => record.id === requestId);
  if (!request) return { success: false, records: normalized, error: 'Request not found.' };
  if (request.receiverUsername.toLowerCase() !== receiverUsername.trim().toLowerCase()) {
    return { success: false, records: normalized, request, error: 'Only the invited player can answer this request.' };
  }
  if (request.status !== 'pending') {
    return { success: false, records: normalized, request, error: `Request is already ${request.status}.` };
  }

  const nextRequest: SocialRequestRecord = { ...request, status, respondedAt: now };
  return {
    success: true,
    request: nextRequest,
    records: normalized.map(record => record.id === requestId ? nextRequest : record),
  };
}

export function getSocialRequestTimeRemaining(request: Pick<SocialRequestRecord, 'expiresAt'>, now = Date.now()): number {
  return Math.max(0, request.expiresAt - now);
}
