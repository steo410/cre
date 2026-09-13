import { jsonStore, storageFailure } from '../lib/github-store.js';
import { authorized, passwordConfigured } from '../lib/auth.js';
const valid = d => d && ['geckos', 'growth', 'pairings'].every(k => Array.isArray(d[k]) && d[k].every(r => r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0) && new Set(d[k].map(r => r.id)).size === d[k].length);
export function createDataHandler(store = jsonStore()) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      if (req.method === 'GET') {
        const current = await store.read();
        if (!valid(current.data)) throw new Error('Invalid stored records');
        return res.status(200).json({ ...current.data, revision: current.revision, provider: 'github', passwordRequired: true, canWrite: authorized(req) });
      }
      if (!passwordConfigured()) return res.status(503).json({ error: '저장 비밀번호 설정이 필요합니다.', code: 'PASSWORD_NOT_CONFIGURED' });
      if (!authorized(req)) return res.status(401).json({ error: '기록 저장용 비밀번호를 확인해 주세요.', code: 'PASSWORD_INCORRECT' });
      let incoming;
      try { incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
      catch { return res.status(400).json({ error: '잘못된 JSON입니다.' }); }
      if (!valid(incoming)) return res.status(400).json({ error: '개체·성장·교배 기록 형식이 올바르지 않습니다.' });
      if (!Object.hasOwn(incoming, 'baseRevision')) return res.status(428).json({ error: '새로고침 후 다시 저장해 주세요.' });
      if (typeof incoming.baseRevision !== 'string' || !/^[a-f0-9]{40}$/.test(incoming.baseRevision)) return res.status(409).json({ error: 'GitHub의 최신 기록을 먼저 불러옵니다.' });
      const next = { version: 6, updatedAt: new Date().toISOString(), geckos: incoming.geckos, growth: incoming.growth, pairings: incoming.pairings };
      const revision = await store.write(next, incoming.baseRevision);
      return res.status(200).json({ ok: true, updatedAt: next.updatedAt, revision, provider: 'github' });
    } catch (error) { return storageFailure(error, res); }
  };
}
export default createDataHandler();
