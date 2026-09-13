const REPO = 'steo410/cre';
export const BRANCH = 'crestie-data';
export const DATA_PATH = 'data/cresties.json';
export class StorageError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export async function github(path, options = {}) {
  const token = process.env.CRESTIE_GITHUB_TOKEN?.trim();
  if (!token) throw new StorageError(503, 'GitHub 저장 연결을 확인해야 합니다.', 'GITHUB_NOT_CONFIGURED');
  const response = await fetch('https://api.github.com/repos/' + REPO + path, {
    ...options, cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/vnd.github+json', 'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Crestie-Lineage', ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) throw new StorageError(503, 'GitHub 기록 파일 또는 연결 권한을 확인해야 합니다.', 'GITHUB_NOT_FOUND');
    if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) throw new StorageError(429, '저장 요청이 많아 잠시 후 다시 시도합니다.', 'GITHUB_RATE_LIMIT');
    if (response.status === 401 || response.status === 403) throw new StorageError(503, 'GitHub 저장 권한을 확인해야 합니다. 기록 비밀번호 오류가 아닙니다.', 'GITHUB_ACCESS');
    if (response.status === 409 || response.status === 422) throw new StorageError(409, '다른 기기의 변경 사항을 먼저 확인합니다.', 'REVISION_CONFLICT');
    throw new StorageError(502, 'GitHub 연결이 지연되고 있습니다. 잠시 후 다시 시도합니다.', 'GITHUB_UNAVAILABLE');
  }
  return body;
}
const pathUrl = path => '/contents/' + path.split('/').map(encodeURIComponent).join('/');
export async function readJson(path = DATA_PATH) {
  const file = await github(pathUrl(path) + '?ref=' + BRANCH);
  let text;
  if (file.encoding === 'base64' && typeof file.content === 'string') text = Buffer.from(file.content, 'base64').toString('utf8');
  else {
    const blob = await github('/git/blobs/' + file.sha);
    text = Buffer.from(blob.content, 'base64').toString('utf8');
  }
  return { data: JSON.parse(text), revision: file.sha };
}
export async function writeFile(path, bytes, revision, message = 'Save Crestie records') {
  const result = await github(pathUrl(path), {
    method: 'PUT',
    body: JSON.stringify({ branch: BRANCH, message, content: bytes.toString('base64'), ...(revision ? { sha: revision } : {}) })
  });
  if (!result.content?.sha) throw new StorageError(502, 'GitHub 저장 완료를 확인하지 못했습니다.', 'SAVE_UNCONFIRMED');
  return result.content.sha;
}
export function jsonStore(path = DATA_PATH) {
  return {
    read: () => readJson(path),
    write: (data, revision) => writeFile(path, Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8'), revision)
  };
}
export function storageFailure(error, res) {
  const message = error instanceof StorageError ? error.message : '저장 서버에 연결하지 못했습니다. 이 기기의 기록은 유지됩니다.';
  console.error('Crestie storage:', error.code || error.name);
  return res.status(error.status || 502).json({ error: message, code: error.code || 'STORAGE_UNAVAILABLE' });
}
