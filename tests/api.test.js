import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import handler from '../api/data.js';
import photo from '../api/photo.js';
import { readJson } from '../lib/github-store.js';

const doc = () => ({ geckos: [{ id: 'a', name: '테스트' }], growth: [], pairings: [], photos: [], ledger: [] });
const hash = text => createHash('sha1').update(text).digest('hex');
function setup(t) {
  process.env.CRESTIE_GITHUB_TOKEN = 'test-only-token';
  process.env.CRESTIE_SYNC_KEY = '한글-테스트-비밀번호';
  const files = new Map(), writes = [], requests = [];
  const initial = JSON.stringify(doc());
  files.set('data/cresties.json', { content: initial, sha: hash(initial) });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options });
    assert.equal(options.headers.Authorization, 'Bearer test-only-token');
    const path = decodeURIComponent(new URL(url).pathname.split('/contents/')[1] || '');
    const before = files.get(path);
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body.branch, 'crestie-data');
      if ((before && body.sha !== before.sha) || (!before && body.sha)) return Response.json({ message: 'conflict' }, { status: 409 });
      const content = Buffer.from(body.content, 'base64').toString('utf8');
      const sha = hash(content); files.set(path, { content, sha }); writes.push(path);
      return Response.json({ content: { sha } });
    }
    assert.equal(new URL(url).searchParams.get('ref'), 'crestie-data');
    if (!before) return Response.json({}, { status: 404 });
    return Response.json({ encoding: 'base64', content: Buffer.from(before.content).toString('base64'), sha: before.sha });
  });
  const auth = createHash('sha256').update(process.env.CRESTIE_SYNC_KEY).digest('hex');
  async function call(method, body, headers = { 'x-crestie-auth': auth }, endpoint = handler) {
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await endpoint({ method, body, headers }, res); return res;
  }
  return { files, writes, requests, call, auth };
}
test('actual GitHub request format preserves Korean records and file revision', async t => {
  const s = setup(t);
  const before = await s.call('GET');
  assert.equal(before.body.canWrite, true);
  const next = doc(); next.geckos[0].notes = '산란 기록 🦎';
  const saved = await s.call('POST', { ...next, baseRevision: before.body.revision });
  assert.equal(saved.code, 200);
  const after = await s.call('GET');
  assert.equal(after.body.geckos[0].notes, '산란 기록 🦎');
  assert.equal(after.body.revision, saved.body.revision);
  assert.deepEqual(s.writes, ['data/cresties.json']);
  assert.ok(s.requests.every(r => r.options.cache === 'no-store'));
});
test('stale device cannot overwrite newer records', async t => {
  const s = setup(t), before = await s.call('GET');
  assert.equal((await s.call('POST', { ...doc(), baseRevision: before.body.revision })).code, 200);
  assert.equal((await s.call('POST', { ...doc(), baseRevision: before.body.revision })).code, 409);
  assert.equal(s.writes.length, 1);
});
test('new fields roundtrip and old tabs cannot erase them', async t => {
  const s = setup(t), before = await s.call('GET');
  const next = { ...doc(), baseRevision: before.body.revision, photos: [{ id: 'p1', geckoId: 'a', url: 'https://example.com/a.webp' }], ledger: [{ id: 'l1', date: '2026-09-16', direction: 'expense', amount: 32000, item: '사육장' }] };
  assert.equal((await s.call('POST', next)).code, 200);
  const after = await s.call('GET');
  assert.equal(after.body.photos[0].id, 'p1'); assert.equal(after.body.ledger[0].amount, 32000);
  const legacy = { geckos: [], growth: [], pairings: [], baseRevision: after.body.revision };
  assert.equal((await s.call('POST', legacy)).code, 428);
  assert.equal((await s.call('GET')).body.ledger.length, 1);
});
test('missing password and malformed records never reach GitHub writes', async t => {
  const s = setup(t);
  assert.equal((await s.call('POST', doc(), {})).code, 401);
  assert.equal((await s.call('POST', '{bad')).code, 400);
  assert.equal((await s.call('POST', { geckos: [] })).code, 400);
  assert.equal((await s.call('POST', doc())).code, 428);
  assert.equal((await s.call('POST', { ...doc(), baseRevision: null })).code, 409);
  assert.equal((await s.call('GET', undefined, {})).body.canWrite, false);
  assert.equal(s.writes.length, 0);
});
test('GitHub permission errors are distinct from record-password errors', async t => {
  const s = setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 403 }));
  const r = await s.call('GET');
  assert.equal(r.code, 503); assert.equal(r.body.code, 'GITHUB_ACCESS');
});
test('photos use GitHub and preserve existing photos with a new file path', async t => {
  const s = setup(t);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=';
  const one = await s.call('POST', { geckoId: 'a', contentBase64: png }, undefined, photo);
  const two = await s.call('POST', { geckoId: 'a', contentBase64: png }, undefined, photo);
  assert.equal(one.code, 200); assert.equal(two.code, 200);
  assert.notEqual(one.body.path, two.body.path);
  assert.ok(one.body.url.startsWith('https://raw.githubusercontent.com/steo410/cre/crestie-data/data/photos/a/'));
  assert.equal(s.writes.length, 2);
});
test('bad photo and unauthorized photo never write', async t => {
  const s = setup(t);
  assert.equal((await s.call('POST', {}, {}, photo)).code, 401);
  assert.equal((await s.call('POST', { geckoId: '../bad', contentBase64: 'eA==' }, undefined, photo)).code, 400);
  assert.equal((await s.call('POST', { geckoId: 'a', contentBase64: 'eA==' }, undefined, photo)).code, 400);
  assert.equal(s.writes.length, 0);
});
