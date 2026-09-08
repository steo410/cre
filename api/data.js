import { list, put } from '@vercel/blob';

const PREFIX = 'crestie/data/';
const EMPTY = { version: 4, updatedAt: null, geckos: [], growth: [], pairings: [] };

function authOk(req) {
  const expected = process.env.CRESTIE_SYNC_KEY;
  return !expected || req.headers['x-crestie-key'] === expected;
}

async function latestDataBlob() {
  const result = await list({ prefix: PREFIX, limit: 1000 });
  const blobs = (result.blobs || []).filter(b => b.pathname.endsWith('.json'));
  blobs.sort((a,b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  return blobs[0] || null;
}

async function readLatest() {
  const blob = await latestDataBlob();
  if (!blob) return EMPTY;
  const r = await fetch(`${blob.url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Blob read failed: ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    if (req.method === 'GET') {
      return res.status(200).json(await readLatest());
    }
    if (req.method === 'POST') {
      if (!authOk(req)) return res.status(401).json({ error: '동기화 비밀번호가 올바르지 않습니다.' });
      const incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!incoming || !Array.isArray(incoming.geckos)) return res.status(400).json({ error: '잘못된 데이터 형식입니다.' });
      const updatedAt = new Date().toISOString();
      const data = {
        version: 4,
        updatedAt,
        geckos: incoming.geckos,
        growth: Array.isArray(incoming.growth) ? incoming.growth : [],
        pairings: Array.isArray(incoming.pairings) ? incoming.pairings : []
      };
      const stamp = updatedAt.replace(/[:.]/g, '-');
      await put(`${PREFIX}${stamp}.json`, JSON.stringify(data), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: true,
        cacheControlMaxAge: 60
      });
      return res.status(200).json({ ok: true, updatedAt });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    const msg = String(e?.message || e || '서버 오류');
    if (msg.includes('BLOB_READ_WRITE_TOKEN') || msg.includes('No token')) {
      return res.status(503).json({ error: 'Vercel Blob 저장소가 아직 프로젝트에 연결되지 않았습니다.' });
    }
    return res.status(500).json({ error: msg });
  }
}
