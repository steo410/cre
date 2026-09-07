const OWNER = process.env.CRESTIE_GITHUB_OWNER || 'steo410';
const REPO = process.env.CRESTIE_GITHUB_REPO || 'cre';
const BRANCH = process.env.CRESTIE_GITHUB_DATA_BRANCH || 'crestie-data';
const PATH = 'data/cresties.json';

function authOk(req) {
  const expected = process.env.CRESTIE_SYNC_KEY;
  if (!expected) return true;
  return req.headers['x-crestie-key'] === expected;
}

function ghHeaders() {
  const token = process.env.CRESTIE_GITHUB_TOKEN;
  return {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? {'Authorization': `Bearer ${token}`} : {})
  };
}

async function readFile() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, {headers: ghHeaders()});
  if (r.status === 404) return {sha:null, data:{version:3,updatedAt:null,geckos:[],growth:[],pairings:[]}};
  if (!r.ok) throw new Error(`GitHub read failed: ${r.status}`);
  const j = await r.json();
  const text = Buffer.from(j.content.replace(/\n/g,''),'base64').toString('utf8');
  return {sha:j.sha, data:JSON.parse(text)};
}

async function writeFile(data, sha) {
  const token = process.env.CRESTIE_GITHUB_TOKEN;
  if (!token) {
    const e = new Error('CRESTIE_GITHUB_TOKEN is not configured');
    e.code = 503; throw e;
  }
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const body = {
    message: `Sync Crestie data ${new Date().toISOString()}`,
    content: Buffer.from(JSON.stringify(data,null,2),'utf8').toString('base64'),
    branch: BRANCH,
    ...(sha ? {sha} : {})
  };
  const r = await fetch(url,{method:'PUT',headers:{...ghHeaders(),'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (!r.ok) throw new Error(`GitHub write failed: ${r.status} ${await r.text()}`);
  return r.json();
}

module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if (!authOk(req)) return res.status(401).json({error:'동기화 비밀번호가 올바르지 않습니다.'});
  try {
    if (req.method === 'GET') {
      const {data} = await readFile();
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const incoming = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!incoming || !Array.isArray(incoming.geckos)) return res.status(400).json({error:'잘못된 데이터 형식입니다.'});
      const current = await readFile();
      const data = {
        version:3,
        updatedAt:new Date().toISOString(),
        geckos:incoming.geckos,
        growth:Array.isArray(incoming.growth)?incoming.growth:[],
        pairings:Array.isArray(incoming.pairings)?incoming.pairings:[]
      };
      await writeFile(data,current.sha);
      return res.status(200).json({ok:true,updatedAt:data.updatedAt});
    }
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({error:'Method not allowed'});
  } catch(e) {
    const code=e.code||500;
    console.error(e);
    return res.status(code).json({error:e.message||'서버 오류'});
  }
};
