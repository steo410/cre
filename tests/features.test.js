import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../features-core.js';
import '../sync-core.js';
const { photosFor, totals, ledgerRows } = globalThis.CrestieFeatures;
test('legacy profile photo remains visible alongside new photos', () => {
  const g = { id: 'a', photoUrl: 'https://example.com/old.webp' };
  const state = { photos: [{ id: 'p', geckoId: 'a', url: 'https://example.com/new.webp' }] };
  const photos = photosFor(state, g);
  assert.equal(photos.length, 2); assert.equal(photos[0].legacy, true);
  assert.equal(photos[1].id, 'p');
});
test('same photo URL is not duplicated and other geckos stay separate', () => {
  const state = { photos: [{ id: 'p', geckoId: 'a', url: 'https://example.com/old.webp' }, { id: 'q', geckoId: 'b', url: 'https://example.com/b.webp' }] };
  assert.equal(photosFor(state, { id: 'a', photoUrl: state.photos[0].url }).length, 1);
  assert.equal(photosFor(state, { id: 'none', photoUrl: 'javascript:alert(1)' }).length, 0);
});
test('ledger month, category and direction filters calculate won accurately', () => {
  const rows = [
    { date: '2026-09-01', category: 'gecko', direction: 'income', amount: 150000 },
    { date: '2026-09-02', category: 'equipment', direction: 'expense', amount: 35000 },
    { date: '2026-08-03', category: 'food', direction: 'expense', amount: 12000 }
  ];
  assert.deepEqual(totals(ledgerRows(rows, { month: '2026-09' })), { income: 150000, expense: 35000, balance: 115000 });
  assert.equal(ledgerRows(rows, { category: 'food', direction: 'expense' }).length, 1);
  assert.deepEqual(totals([]), { income: 0, expense: 0, balance: 0 });
});
test('old browser data is upgraded without losing photos or notes', () => {
  const old = { geckos: [{ id: 'g', name: '기존 개체', notes: '기존 메모', photoUrl: 'https://example.com/old.webp' }], growth: [{ id: 'r', geckoId: 'g' }], pairings: [] };
  const context = vm.createContext({ localStorage: { getItem: () => JSON.stringify(old) } });
  let source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  source = source.slice(0, source.indexOf('function getGecko'));
  vm.runInContext(source + ';globalThis.result = state;', context);
  assert.equal(context.result.geckos[0].photoUrl, old.geckos[0].photoUrl);
  assert.equal(context.result.geckos[0].notes, '기존 메모');
  assert.equal(context.result.growth.length, 1);
  assert.equal(context.result.photos.length, 0); assert.equal(context.result.ledger.length, 0);
});
test('two devices can add photos and ledger entries independently', () => {
  const { empty, merge } = globalThis.CrestieSync, base = empty(), a = empty(), b = empty();
  a.photos.push({ id: 'p1', geckoId: 'g', url: 'https://example.com/1.webp' });
  b.photos.push({ id: 'p2', geckoId: 'g', url: 'https://example.com/2.webp' });
  a.ledger.push({ id: 't1', amount: 1000 }); b.ledger.push({ id: 't2', amount: 2000 });
  const merged = merge(base, a, b);
  assert.equal(merged.conflicts.length, 0); assert.equal(merged.data.photos.length, 2); assert.equal(merged.data.ledger.length, 2);
});
