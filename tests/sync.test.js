import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import '../sync-core.js';

const { merge, empty } = globalThis.CrestieSync;
const doc = (geckos = [], growth = [], pairings = []) => ({ geckos, growth, pairings, photos: [], ledger: [] });
test('independent additions from laptop and phone survive', () => {
  const out = merge(empty(), doc([{ id: 'a' }]), doc([{ id: 'b' }]));
  assert.deepEqual(out.conflicts, []);
  assert.equal(out.data.geckos.length, 2);
});
test('different fields of the same gecko merge', () => {
  const b = doc([{ id: 'a', name: 'A', notes: '' }]);
  const out = merge(b, doc([{ id: 'a', name: 'B', notes: '' }]), doc([{ id: 'a', name: 'A', notes: '탈피' }]));
  assert.deepEqual(out.conflicts, []);
  assert.deepEqual(out.data.geckos, [{ id: 'a', name: 'B', notes: '탈피' }]);
});
test('same-field edits require an explicit choice', () => {
  const out = merge(doc([{ id: 'a', name: 'A' }]), doc([{ id: 'a', name: 'B' }]), doc([{ id: 'a', name: 'C' }]));
  assert.deepEqual(out.conflicts, ['geckos.a.name']);
});
test('deletion on a second device propagates, including an empty collection', () => {
  const b = doc([{ id: 'a' }], [{ id: 'g', geckoId: 'a' }]);
  assert.deepEqual(merge(b, b, empty()).data, empty());
  assert.deepEqual(merge(b, empty(), b).data, empty());
});
test('deletion versus edit is a conflict', () => {
  assert.equal(merge(doc([{ id: 'a', name: 'A' }]), empty(), doc([{ id: 'a', name: 'B' }])).conflicts.length, 1);
});

function client({ local = empty(), savedBase = null, fetcher }) {
  const timers = [], status = { dataset: {} };
  const storage = new Map(savedBase ? [['crestie-sync-base-v5', JSON.stringify({ data: savedBase })]] : []);
  const context = vm.createContext({
    console, JSON, AbortSignal, navigator: { onLine: true }, state: structuredClone(local),
    STORAGE_KEY: 'test', normalizeGecko: g => g, renderCurrent() {}, fetch: fetcher,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    document: { getElementById: () => status, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    setTimeout: f => { timers.push(f); return timers.length; }, clearTimeout() {},
  });
  vm.runInContext(readFileSync(new URL('../sync-core.js', import.meta.url), 'utf8'), context);
  let source = readFileSync(new URL('../cloud.js', import.meta.url), 'utf8');
  source = source.replace(/\}\)\(\);\s*$/, 'globalThis.testSync = {run, getBase: () => base};})();');
  vm.runInContext(source, context);
  return { context, timers, status, storage };
}
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
test('edits during POST are not acknowledged as already saved', async () => {
  const b = doc([{ id: 'a', name: 'A' }]);
  let sent;
  const c = client({ local: doc([{ id: 'a', name: 'B' }]), savedBase: b, fetcher: async (_, options) => {
    if (!options.method) return response({ ...b, revision: 'r1' });
    sent = JSON.parse(options.body);
    c.context.state.geckos[0].name = 'C';
    return response({ ok: true, revision: 'r2' });
  } });
  await c.context.testSync.run();
  assert.equal(sent.geckos[0].name, 'B');
  assert.equal(c.context.testSync.getBase().geckos[0].name, 'B');
  assert.equal(c.context.state.geckos[0].name, 'C');
  assert.equal(c.timers.length, 1);
});
test('failed upload survives reload and is retried', async () => {
  const b = doc([{ id: 'a', name: 'A' }]), local = doc([{ id: 'a', name: 'B' }]);
  const c = client({ local, savedBase: b, fetcher: async (_, options) => options.method ? response({}, 500) : response({ ...b, revision: 'r1' }) });
  await c.context.testSync.run();
  assert.equal(c.context.state.geckos[0].name, 'B');
  assert.equal(c.context.testSync.getBase().geckos[0].name, 'A');
  let uploaded = false;
  const reopened = client({ local, savedBase: JSON.parse(c.storage.get('crestie-sync-base-v5')).data, fetcher: async (_, options) => {
    if (!options.method) return response({ ...b, revision: 'r1' });
    uploaded = true; return response({ ok: true, revision: 'r2' });
  } });
  await reopened.context.testSync.run();
  assert.ok(uploaded);
});
test('first connection preserves existing laptop records', async () => {
  let sent;
  const c = client({ local: doc([{ id: 'existing' }]), fetcher: async (_, options) => {
    if (!options.method) return response({ ...empty(), revision: null });
    sent = JSON.parse(options.body); return response({ ok: true, revision: 'r1' });
  } });
  await c.context.testSync.run();
  assert.equal(sent.geckos[0].id, 'existing');
  assert.equal(sent.baseRevision, null);
});
test('another device deletion is applied without resurrecting records', async () => {
  const b = doc([{ id: 'a' }]);
  const c = client({ local: b, savedBase: b, fetcher: async (_, options) => {
    assert.equal(options.method, undefined);
    return response({ ...empty(), revision: 'r2' });
  } });
  await c.context.testSync.run();
  assert.equal(c.context.state.geckos.length, 0);
});
test('conflicting server revision schedules a fresh read without losing edits', async () => {
  const b = doc([{ id: 'a', name: 'A' }]);
  const c = client({ local: doc([{ id: 'a', name: 'B' }]), savedBase: b, fetcher: async (_, options) => options.method ? response({}, 409) : response({ ...b, revision: 'r1' }) });
  await c.context.testSync.run();
  assert.equal(c.context.state.geckos[0].name, 'B');
  assert.equal(c.timers.length, 1);
});
