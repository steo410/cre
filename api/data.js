import { get, list, put, BlobPreconditionFailedError } from '@vercel/blob';

const CURRENT = 'crestie/current.json';
const EMPTY = { version: 5, updatedAt: null, geckos: [], growth: [], pairings: [] };
const access = () => process.env.CRESTIE_BLOB_ACCESS || 'public';
const valid = d => d && ['geckos', 'growth', 'pairings'].every(k => Array.isArray(d[k]) && d[k].every(r => r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0) && new Set(d[k].map(r => r.id)).size === d[k].length);

async function read(path) {
  const result = await get(path, { access: access(), useCache: false });
  if (!result) return null;
  const data = await new Response(result.stream).json();
  if (!valid(data)) throw new Error('저장된 기록의 형식을 확인해야 합니다.');
  return { data, revision: result.blob.etag };
}

export async function readCurrent() {
  const current = await read(CURRENT);
  if (current) return current;
  // Read every legacy snapshot page; leave the original backups untouched.
  let cursor, latest;
  do {
    const page = await list({ prefix: 'crestie/data/', limit: 1000, cursor });
    for (const blob of page.blobs) {
      if (blob.pathname.endsWith('.json') && (!latest || new Date(blob.uploadedAt) > new Date(latest.uploadedAt))) latest = blob;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return { data: latest ? (await read(latest.pathname)).data : EMPTY, revision: null };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const key = process.env.CRESTIE_SYNC_KEY;
    if (req.method === 'POST' && key && req.headers['x-crestie-key'] !== key) return res.status(401).json({ error: '동기화 비밀번호를 확인해 주세요.' });
    if (req.method === 'GET') {
      const current = await readCurrent();
      return res.status(200).json({ ...current.data, revision: current.revision, passwordRequired: !!key, canWrite: !key || req.headers['x-crestie-key'] === key });
    }
    let incoming;
    try { incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: '잘못된 JSON입니다.' }); }
    if (!valid(incoming)) return res.status(400).json({ error: '개체·성장·교배 기록 형식이 올바르지 않습니다.' });
    if (!Object.hasOwn(incoming, 'baseRevision')) return res.status(428).json({ error: '새로고침 후 다시 저장해 주세요.' });
    if (incoming.baseRevision !== null && typeof incoming.baseRevision !== 'string') return res.status(400).json({ error: '잘못된 저장 버전입니다.' });
    const data = { version: 5, updatedAt: new Date().toISOString(), geckos: incoming.geckos, growth: incoming.growth, pairings: incoming.pairings };
    const blob = await put(CURRENT, JSON.stringify(data), {
      access: access(), contentType: 'application/json', addRandomSuffix: false,
      cacheControlMaxAge: 60,
      ...(incoming.baseRevision === null ? { allowOverwrite: false } : { allowOverwrite: true, ifMatch: incoming.baseRevision })
    });
    return res.status(200).json({ ok: true, updatedAt: data.updatedAt, revision: blob.etag });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError || /already exists/i.test(error.message)) return res.status(409).json({ error: '다른 기기의 변경 사항을 먼저 확인합니다.' });
    console.error('Crestie data:', error.name);
    const missing = /token|store.?id|not connected/i.test(error.message);
    return res.status(missing ? 503 : 500).json({ error: missing ? '클라우드 저장소 연결이 필요합니다. 이 기기의 기록은 유지됩니다.' : '클라우드 저장에 실패했습니다. 잠시 후 자동으로 다시 시도합니다.' });
  }
}
