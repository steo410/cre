import { put } from '@vercel/blob';

function authOk(req) {
  const expected = process.env.CRESTIE_SYNC_KEY;
  return !expected || req.headers['x-crestie-key'] === expected;
}

function safeId(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!authOk(req)) return res.status(401).json({ error: '동기화 비밀번호가 올바르지 않습니다.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body?.geckoId || !body?.contentBase64) return res.status(400).json({ error: '사진 데이터가 없습니다.' });

    const bytes = Buffer.from(body.contentBase64, 'base64');
    if (bytes.length > 4 * 1024 * 1024) return res.status(413).json({ error: '압축 후 사진이 4MB를 초과합니다.' });
    const ext = body.extension === 'png' ? 'png' : 'webp';
    const contentType = ext === 'png' ? 'image/png' : 'image/webp';
    const pathname = `crestie/photos/${safeId(body.geckoId)}/${Date.now()}.${ext}`;
    const blob = await put(pathname, bytes, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      cacheControlMaxAge: 31536000
    });
    return res.status(200).json({ ok: true, url: blob.url, path: blob.pathname });
  } catch (e) {
    console.error(e);
    const msg = String(e?.message || e || '서버 오류');
    if (msg.includes('BLOB_READ_WRITE_TOKEN') || msg.includes('No token')) {
      return res.status(503).json({ error: 'Vercel Blob 저장소가 아직 프로젝트에 연결되지 않았습니다.' });
    }
    return res.status(500).json({ error: msg });
  }
}
