import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const doc = () => ({ geckos: [{ id: 'a', name: '테스트' }], growth: [], pairings: [] });
async function setup({ pages = [], records = new Map() } = {}) {
  const writes = [], reads = [], listings = [];
  class BlobPreconditionFailedError extends Error {}
  const sdk = {
    BlobPreconditionFailedError,
    get: async (path, options) => {
      reads.push(options);
      const r = records.get(path);
      return r ? { stream: new Response(JSON.stringify(r.data)).body, blob: { etag: r.etag } } : null;
    },
    list: async options => { listings.push(options); return pages[listings.length - 1] || { blobs: [], hasMore: false }; },
    put: async (path, body, options) => {
      const previous = records.get(path);
      if (previous && (!options.allowOverwrite || options.ifMatch !== previous.etag)) throw new BlobPreconditionFailedError();
      if (!previous && options.ifMatch) throw new BlobPreconditionFailedError();
      const etag = 'revision-' + (writes.length + 1);
      records.set(path, { data: JSON.parse(body), etag });
      writes.push({ path, options }); return { etag };
    }
  };
  const context = vm.createContext({ process: { env: { CRESTIE_SYNC_KEY: 'test-only-secret' } }, Response, console });
  const synthetic = new vm.SyntheticModule(Object.keys(sdk), function () {
    for (const [k, v] of Object.entries(sdk)) this.setExport(k, v);
  }, { context });
  const mod = new vm.SourceTextModule(readFileSync(new URL('../api/data.js', import.meta.url), 'utf8'), { context });
  await mod.link(() => synthetic); await mod.evaluate();
  const request = async (method, body, key = 'test-only-secret') => {
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await mod.namespace.default({ method, body, headers: { 'x-crestie-key': key } }, res);
    return res;
  };
  return { request, writes, reads, listings };
}
test('server rejects missing password and malformed records before writing', async () => {
  const s = await setup();
  assert.equal((await s.request('POST', { ...doc(), baseRevision: null }, '')).code, 401);
  assert.equal((await s.request('POST', { ...doc(), growth: 'invalid', baseRevision: null })).code, 400);
  assert.equal((await s.request('POST', '{bad')).code, 400);
  assert.equal((await s.request('POST', doc())).code, 428);
  assert.equal(s.writes.length, 0);
});
test('server compare-and-swap rejects a stale device and duplicate initial creation', async () => {
  const s = await setup();
  const first = await s.request('POST', { ...doc(), baseRevision: null });
  assert.equal(first.code, 200);
  assert.equal((await s.request('POST', { ...doc(), baseRevision: null })).code, 409);
  const second = await s.request('POST', { ...doc(), baseRevision: first.body.revision });
  assert.equal(second.code, 200);
  assert.equal((await s.request('POST', { ...doc(), baseRevision: first.body.revision })).code, 409);
  assert.equal(s.writes.length, 2);
});
test('server bypasses cached reads and reports password requirement', async () => {
  const s = await setup();
  await s.request('POST', { ...doc(), baseRevision: null });
  const read = await s.request('GET');
  assert.equal(read.body.passwordRequired, true);
  assert.equal(read.body.geckos[0].name, '테스트');
  assert.ok(s.reads.every(o => o.useCache === false));
});
test('legacy migration finds the latest snapshot beyond the first 1000 files', async () => {
  const old = { pathname: 'crestie/data/old.json', uploadedAt: '2026-09-01' };
  const latest = { pathname: 'crestie/data/latest.json', uploadedAt: '2026-09-13' };
  const s = await setup({
    pages: [{ blobs: [old], hasMore: true, cursor: 'next' }, { blobs: [latest], hasMore: false }],
    records: new Map([[old.pathname, { data: { ...doc(), updatedAt: 'old' }, etag: 'old' }], [latest.pathname, { data: { ...doc(), updatedAt: 'latest' }, etag: 'latest' }]])
  });
  const result = await s.request('GET');
  assert.equal(result.body.updatedAt, 'latest');
  assert.equal(s.listings[1].cursor, 'next');
  assert.equal(s.writes.length, 0);
});
