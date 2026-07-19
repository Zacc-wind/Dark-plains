import { describe, expect, it } from 'vitest';
import {
  SOCIAL_REQUEST_TTL_MS,
  createSocialRequest,
  getIncomingSocialRequests,
  normalizeSocialRequests,
  respondToSocialRequest,
} from '@/lib/socialRequests';

const NOW = Date.parse('2026-07-20T12:00:00Z');

describe('social request lifecycle', () => {
  it('creates a targeted request with a stable expiry and payload', () => {
    const request = createSocialRequest({
      kind: 'party',
      senderUsername: 'Leader',
      receiverUsername: 'Recruit',
      payload: { partyLeaderUsername: 'Leader', partyMemberCount: 2 },
      now: NOW,
    });

    expect(request).toMatchObject({
      kind: 'party',
      senderUsername: 'Leader',
      receiverUsername: 'Recruit',
      status: 'pending',
      expiresAt: NOW + SOCIAL_REQUEST_TTL_MS,
      payload: { partyLeaderUsername: 'Leader', partyMemberCount: 2 },
    });
    expect(getIncomingSocialRequests([request], 'recruit', NOW)).toEqual([request]);
    expect(getIncomingSocialRequests([request], 'someone-else', NOW)).toEqual([]);
  });

  it('accepts or declines only through the named receiver', () => {
    const request = createSocialRequest({
      kind: 'party',
      senderUsername: 'Leader',
      receiverUsername: 'Recruit',
      now: NOW,
    });

    expect(respondToSocialRequest([request], request.id, 'Leader', 'accepted', NOW + 1).success).toBe(false);
    const accepted = respondToSocialRequest([request], request.id, 'Recruit', 'accepted', NOW + 2);
    expect(accepted.success).toBe(true);
    expect(accepted.request).toMatchObject({ status: 'accepted', respondedAt: NOW + 2 });
    expect(respondToSocialRequest(accepted.records, request.id, 'Recruit', 'declined', NOW + 3).success).toBe(false);
  });

  it('expires pending requests and removes duplicates during legacy normalization', () => {
    const request = createSocialRequest({
      kind: 'party',
      senderUsername: 'Leader',
      receiverUsername: 'Recruit',
      now: NOW,
      ttlMs: 10_000,
    });
    const normalized = normalizeSocialRequests([request, request], NOW + 10_001);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({ status: 'expired', respondedAt: request.expiresAt });
    expect(getIncomingSocialRequests(normalized, 'Recruit', NOW + 10_001)).toEqual([]);
  });
});
