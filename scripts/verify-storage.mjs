// Real server credentials, isolated non-personal test file, no animal records.
import { createHash } from 'node:crypto';
import { createDataHandler } from '../api/data.js';
import { jsonStore, writeFile, readJson } from '../lib/github-store.js';
if (process.env.VERCEL_ENV !== 'production') {
  console.log('Storage verification runs only in Production.');
  process.exit(0);
}
const path = 'data/sync-check.json';
try {
  try { await readJson(path); }
  catch (error) {
    if (error.code !== 'GITHUB_NOT_FOUND') throw error;
    await writeFile(path, Buffer.from(JSON.stringify({ geckos: [], growth: [], pairings: [] })), null, 'Initialize storage connection check');
  }
  const handler = createDataHandler(jsonStore(path));
  const password = process.env.CRESTIE_SYNC_KEY?.trim();
  if (!password) throw new Error('PASSWORD_NOT_CONFIGURED');
  const auth = createHash('sha256').update(password, 'utf8').digest('hex');
  async function call(method, body) {
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; } };
    await handler({ method, body, headers: { 'x-crestie-auth': auth } }, res);
    if (res.statusCode !== 200) throw new Error(res.value.code || 'STORAGE_CHECK_HTTP_' + res.statusCode);
    return res.value;
  }
  const before = await call('GET');
  if (!before.canWrite) throw new Error('PASSWORD_CHECK_FAILED');
  const stamp = new Date().toISOString();
  const saved = await call('POST', { baseRevision: before.revision, geckos: [{ id: 'connection-check', name: 'Storage connection test', checkedAt: stamp }], growth: [], pairings: [], photos: [], ledger: [] });
  const after = await call('GET');
  if (saved.revision !== after.revision || after.geckos[0]?.checkedAt !== stamp) throw new Error('STORAGE_READBACK_FAILED');
  console.log('PASS: production password, GitHub write, and independent read-back.');
} catch (error) {
  console.error('Storage verification failed:', error.code || error.message);
  process.exit(1);
}
