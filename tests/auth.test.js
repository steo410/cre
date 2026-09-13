import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorized, passwordConfigured } from '../lib/auth.js';

test('Korean passwords work without invalid HTTP header characters', () => {
  process.env.CRESTIE_SYNC_KEY = '한글-테스트-비밀번호';
  const value = createHash('sha256').update(process.env.CRESTIE_SYNC_KEY, 'utf8').digest('hex');
  assert.equal(authorized({ headers: { 'x-crestie-auth': value } }), true);
  assert.doesNotThrow(() => new Headers({ 'x-crestie-auth': value }));
});
test('incorrect and absent passwords fail closed', () => {
  process.env.CRESTIE_SYNC_KEY = 'test-only';
  assert.equal(authorized({ headers: {} }), false);
  assert.equal(authorized({ headers: { 'x-crestie-auth': 'f'.repeat(64) } }), false);
  delete process.env.CRESTIE_SYNC_KEY;
  assert.equal(passwordConfigured(), false);
  assert.equal(authorized({ headers: { 'x-crestie-key': '' } }), false);
});
