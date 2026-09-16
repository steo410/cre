/* Crestie Lineage: durable local edits and automatic cross-device sync. */
(() => {
  const { equal, empty, data, merge } = CrestieSync;
  const CLOUD_KEY = 'crestie-cloud-sync-key';
  const META_KEY = 'crestie-sync-base-v5';
  const BACKUP_KEY = 'crestie-local-backup-before-cloud';
  const copy = d => JSON.parse(JSON.stringify(d));
  const current = () => copy(data(state));
  let base = null, syncing = false, conflict = null, passwordRequired = false, timer;
  try { base = JSON.parse(localStorage.getItem(META_KEY) || 'null')?.data || null; } catch {}
  const getKey = () => localStorage.getItem(CLOUD_KEY) || '';
  function status(text, cls = '') {
    let el = document.getElementById('cloudStatus');
    if (!el) {
      el = document.createElement('button');
      el.id = 'cloudStatus'; el.type = 'button'; el.className = 'cloud-status';
      el.setAttribute('aria-live', 'polite'); el.onclick = configure;
      document.querySelector('.top-actions')?.prepend(el);
    }
    el.textContent = text; el.dataset.state = cls;
  }
  async function api(path, options = {}) {
    const digest = getKey() ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getKey().trim()))), byte => byte.toString(16).padStart(2, '0')).join('') : '';
    const response = await fetch(path, {
      ...options, cache: 'no-store', signal: AbortSignal.timeout(30000),
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(digest ? { 'X-Crestie-Auth': digest } : {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body.error || '서버에 연결하지 못했습니다.'); error.status = response.status; throw error; }
    return body;
  }
  function backup(remote) {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data: current(), remote }));
  }
  function remember(remote) {
    localStorage.setItem(META_KEY, JSON.stringify({ data: remote }));
    base = copy(remote);
  }
  function apply(next) {
    if (equal(current(), next)) return;
    backup(next);
    state.geckos = next.geckos.map(normalizeGecko);
    state.growth = next.growth;
    state.pairings = next.pairings;
    state.photos = next.photos || [];
    state.ledger = next.ledger || [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!document.querySelector('dialog[open]')) renderCurrent();
    decorate();
  }
  function schedule(delay = 350) {
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }
  async function run() {
    if (syncing || conflict || globalThis.CrestiePhotos?.busy || document.querySelector('dialog[open]')) return;
    if (!navigator.onLine) { status('오프라인 · 이 기기에 저장됨', 'warn'); return; }
    syncing = true;
    let again = false;
    status('☁ 기록 동기화 중…', 'busy');
    try {
      const received = await api('/api/data');
      if (!['geckos', 'growth', 'pairings'].every(k => Array.isArray(received[k]))) throw new Error('저장 서버의 응답을 확인해 주세요.');
      passwordRequired = !!received.passwordRequired;
      const remote = { ...data(received), geckos: received.geckos.map(normalizeGecko) };
      const merged = merge(data(base || empty()), current(), remote);
      if (merged.conflicts.length) {
        conflict = { remote, base: base || empty() };
        backup(remote);
        status('기록 충돌 · 눌러서 확인', 'warn');
        return;
      }
      apply(merged.data);
      remember(remote);
      const sent = current();
      if (!equal(sent, remote)) {
        status('☁ 다른 기기에서도 볼 수 있도록 저장 중…', 'busy');
        const result = await api('/api/data', { method: 'POST', body: JSON.stringify({ ...sent, baseRevision: received.revision }) });
        if (!result.ok || !result.revision) throw new Error('저장 완료를 확인하지 못했습니다.');
        // Acknowledge exactly what was sent, never edits made during the request.
        remember(sent);
        again = !equal(current(), sent);
      }
      status(again ? '추가 변경 저장 대기 중…' : received.canWrite === false ? '조회 연결됨 · 저장 비밀번호 입력' : '✓ GitHub 저장됨', again ? 'busy' : received.canWrite === false ? 'warn' : 'ok');
    } catch (error) {
      again = error.status === 409;
      status(again ? '다른 기기의 변경 확인 중…' : error.status === 428 ? '새로고침 후 저장해 주세요' : error.status === 401 ? '비밀번호 필요 · 눌러서 입력' : error.status === 503 ? 'GitHub 연결 확인 필요 · 이 기기에 저장됨' : '연결 실패 · 이 기기에 저장됨', 'warn');
      const el = document.getElementById('cloudStatus'); if (el) el.title = error.message;
      console.warn('Crestie sync:', error.message);
    } finally {
      syncing = false;
      if (again) schedule(500);
    }
  }
  function configure() {
    if (conflict) { showConflict(); return; }
    if (passwordRequired || !getKey()) {
      const key = prompt('기록 저장용 비밀번호를 입력하세요. 처음 연결한 기기에서 한 번만 입력하면 됩니다.', getKey());
      if (key === null) return;
      key.trim() ? localStorage.setItem(CLOUD_KEY, key.trim()) : localStorage.removeItem(CLOUD_KEY);
    }
    schedule(0);
  }
  function showConflict() {
    if (document.getElementById('syncConflictDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'syncConflictDialog'; dialog.className = 'modal';
    dialog.innerHTML = '<div class="modal-card small"><h2>같은 기록을 두 기기에서 수정했어요</h2><p>충돌한 항목에 사용할 내용을 선택하세요. 서로 다른 항목의 수정은 함께 보존합니다.</p><p>선택 전 양쪽 기록을 백업 파일로 받을 수 있습니다.</p><div class="toolbar"><button class="btn secondary" data-choice="backup">양쪽 기록 백업</button><button class="btn primary" data-choice="local">이 기기 수정 사용</button><button class="btn secondary" data-choice="remote">다른 기기 수정 사용</button><button class="btn ghost" data-choice="later">나중에</button></div></div>';
    dialog.addEventListener('click', e => {
      const choice = e.target.dataset.choice;
      if (!choice) return;
      if (choice === 'backup') {
        const url = URL.createObjectURL(new Blob([JSON.stringify({ local: current(), remote: conflict.remote }, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'crestie-conflict-backup.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); return;
      }
      if (choice !== 'later') {
        backup(conflict.remote);
        const resolved = choice === 'local' ? merge(conflict.base, current(), conflict.remote) : merge(conflict.base, conflict.remote, current());
        apply(resolved.data); remember(conflict.remote); conflict = null;
      }
      dialog.close(); dialog.remove(); renderCurrent(); schedule(0);
    });
    dialog.addEventListener('cancel', () => { dialog.remove(); });
    document.body.append(dialog); dialog.showModal();
  }
  function decorate() { globalThis.CrestiePhotos?.decorate(); }

  document.addEventListener('DOMContentLoaded', () => {
    const note = document.querySelector('.sidebar-note');
    if (note) note.innerHTML = '<b>기기 간 자동 저장</b><span>같은 사이트를 열면 노트북과 휴대폰에서 기록을 함께 볼 수 있습니다. 상단의 GitHub 저장 완료 표시를 확인하세요.</span>';
    CrestiePhotos.init({ api, schedule }); run(); decorate();
    window.addEventListener('crestie:changed', () => { status('이 기기에 저장됨 · 클라우드 저장 대기', 'busy'); schedule(); });
    window.addEventListener('online', () => schedule(0));
    window.addEventListener('focus', () => schedule(0));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(0); });
    window.addEventListener('beforeunload', event => {
      if ((base && !equal(current(), base)) || conflict || syncing || globalThis.CrestiePhotos?.unsaved) { event.preventDefault(); event.returnValue = ''; }
    });
    setInterval(() => { if (!document.hidden) run(); }, 15000);
    new MutationObserver(decorate).observe(document.querySelector('.main') || document.body, { childList: true, subtree: true });
  });
})();
