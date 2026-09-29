import { expireCurrentSocialRequests } from './auth';

const MIN_EXPIRE_GAP_MS = 900;
let lastExpireAt = 0;

/**
 * SocialRequestOverlay and TradeSessionOverlay both reconcile expired requests on their poll.
 * The reconcile reads and serializes every stored user, so ticks landing together run it once.
 */
export function expireSocialRequestsShared(now = Date.now()): void {
  if (now - lastExpireAt < MIN_EXPIRE_GAP_MS) return;
  lastExpireAt = now;
  expireCurrentSocialRequests(now);
}
