const OWNER = process.env.CRESTIE_GITHUB_OWNER || 'steo410';
const REPO = process.env.CRESTIE_GITHUB_REPO || 'cre';
const BRANCH = process.env.CRESTIE_GITHUB_DATA_BRANCH || 'crestie-data';

function writeAuthOk(req) {
  const expected = process.env.CRESTIE_SYNC_KEY;
  return !!expected && req.headers['x-crestie-key'] === expected;
}

function ghHeaders() {
  const token = process.env.CRESTIE_GITHUB_TOKEN;
  return {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? {'Authorization': `Bearer ${token}`} : {})
  };
}

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if (!process.env.CRESTIE_SYNC_KEY) return res.status(503).json({error:'CRESTIE_SYNC_KEY is not configured'});
  if (!writeAuthOk(req)) return res.status(401).json({error:'동기화 비밀번호가 올바르지 않습니다.'});
  const token = process.env.CRESTIE_GITHUB_TOKEN;
  if (!token) return res.status(503).json({error:'CRESTIE_GITHUB_TOKEN is not configured'});

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const geckoId = String(body?.geckoId || '').replace(/[^a-zA-Z0-9_-]/g,'');
    const extension = ['webp','jpg','jpeg','png'].includes(String(body?.extension||'').toLowerCase()) ? String(body.extension).toLowerCase() : 'webp';
    const contentBase64 = String(body?.contentBase64 || '');
    if (!geckoId || !contentBase64) return res.status(400).json({error:'사진 데이터가 없습니다.'});
    if (contentBase64.length > 4_500_000) return res.status(413).json({error:'사진이 너무 큽니다. 더 작은 사진을 사용하세요.'});

    const path = `data/photos/${geckoId}/profile.${extension}`;
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;

    let sha;
    const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(BRANCH)}`, {headers:ghHeaders()});
    if (existing.ok) sha = (await existing.json()).sha;

    const payload = {
      message:`Update Crestie photo ${geckoId}`,
      content:contentBase64,
      branch:BRANCH,
      ...(sha?{sha}:{})
    };
    const r = await fetch(apiUrl,{method:'PUT',headers:{...ghHeaders(),'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if (!r.ok) throw new Error(`GitHub photo write failed: ${r.status} ${await r.text()}`);
    const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
    return res.status(200).json({ok:true,path,url});
  } catch(e) {
    console.error(e);
    return res.status(500).json({error:e.message||'사진 업로드 실패'});
  }
};
