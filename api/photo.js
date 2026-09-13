import { randomUUID } from 'node:crypto';
import { authorized, passwordConfigured } from '../lib/auth.js';
import { writeFile, storageFailure } from '../lib/github-store.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!passwordConfigured()) return res.status(503).json({ error: '저장 비밀번호 설정이 필요합니다.' });
  if (!authorized(req)) return res.status(401).json({ error: '기록 저장용 비밀번호를 확인해 주세요.' });
  try {
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: '잘못된 JSON입니다.' }); }
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(body?.geckoId) || typeof body?.contentBase64 !== 'string' || !/^[a-zA-Z0-9+/]+={0,2}$/.test(body.contentBase64)) return res.status(400).json({ error: '사진 형식이 올바르지 않습니다.' });
    const bytes = Buffer.from(body.contentBase64, 'base64');
    if (bytes.length > 3 * 1024 * 1024) return res.status(413).json({ error: '사진을 3MB 이하로 줄여 주세요.' });
    const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!png && !webp) return res.status(400).json({ error: '지원하는 사진 형식은 PNG와 WebP입니다.' });
    const path = 'data/photos/' + body.geckoId + '/' + randomUUID() + (png ? '.png' : '.webp');
    await writeFile(path, bytes, null, 'Save Crestie photo');
    return res.status(200).json({ ok: true, path, url: 'https://raw.githubusercontent.com/steo410/cre/crestie-data/' + path });
  } catch (error) { return storageFailure(error, res); }
}
