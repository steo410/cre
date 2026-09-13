import { createHash, timingSafeEqual } from 'node:crypto';

export function passwordConfigured() {
  return !!process.env.CRESTIE_SYNC_KEY?.trim();
}
export function authorized(req) {
  const expected = process.env.CRESTIE_SYNC_KEY?.trim();
  if (!expected) return false;
  const digest = createHash('sha256').update(expected, 'utf8').digest('hex');
  const supplied = req.headers['x-crestie-auth'];
  if (typeof supplied === 'string' && /^[a-f0-9]{64}$/.test(supplied)) {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(supplied));
  }
  const legacy = req.headers['x-crestie-key'];
  return typeof legacy === 'string' && timingSafeEqual(createHash('sha256').update(legacy.trim(), 'utf8').digest(), Buffer.from(digest, 'hex'));
}
