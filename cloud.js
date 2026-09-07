/* Crestie Lineage v3 - GitHub Cloud Sync */
(() => {
  const CLOUD_KEY = 'crestie-cloud-sync-key';
  const SYNC_INTERVAL = 2500;
  let remoteLoaded = false;
  let syncing = false;
  let lastSnapshot = '';
  let lastRemoteUpdate = null;
  let photoFile = null;

  const getSyncKey = () => localStorage.getItem(CLOUD_KEY) || '';
  const headers = (json = false) => ({
    ...(json ? {'Content-Type':'application/json'} : {}),
    ...(getSyncKey() ? {'X-Crestie-Key': getSyncKey()} : {})
  });

  function snapshot() {
    return JSON.stringify({geckos: state.geckos, growth: state.growth, pairings: state.pairings});
  }

  function setStatus(text, cls='') {
    let el = document.getElementById('cloudStatus');
    if (!el) {
      el = document.createElement('button');
      el.id = 'cloudStatus';
      el.className = 'cloud-status';
      el.type = 'button';
      el.title = 'GitHub 동기화 설정';
      document.querySelector('.top-actions')?.prepend(el);
      el.onclick = configureSync;
    }
    el.textContent = text;
    el.dataset.state = cls;
  }

  function configureSync() {
    const current = getSyncKey();
    const key = prompt('Crestie 동기화 비밀번호를 입력하세요.\n(Vercel의 CRESTIE_SYNC_KEY와 같은 값)', current);
    if (key === null) return;
    if (key.trim()) localStorage.setItem(CLOUD_KEY, key.trim());
    else localStorage.removeItem(CLOUD_KEY);
    setStatus('GitHub 연결 확인…','busy');
    loadRemote(true);
  }

  async function api(path, options={}) {
    const res = await fetch(path, {...options, headers:{...headers(!!options.body), ...(options.headers||{})}});
    const body = await res.json().catch(()=>({}));
    if (!res.ok) {
      const err = new Error(body.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  function applyRemote(data) {
    if (!data || !Array.isArray(data.geckos)) return false;
    state.geckos.splice(0, state.geckos.length, ...data.geckos.map(normalizeGecko));
    state.growth.splice(0, state.growth.length, ...(Array.isArray(data.growth)?data.growth:[]));
    state.pairings.splice(0, state.pairings.length, ...(Array.isArray(data.pairings)?data.pairings:[]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!growthSelectedGecko || !getGecko(growthSelectedGecko)) growthSelectedGecko = state.geckos[0]?.id || '';
    lastSnapshot = snapshot();
    lastRemoteUpdate = data.updatedAt || null;
    renderCurrent();
    decoratePhotos();
    return true;
  }

  async function loadRemote(force=false) {
    if (syncing) return;
    syncing = true;
    try {
      const data = await api('/api/data');
      const remoteHasData = (data.geckos?.length || data.growth?.length || data.pairings?.length);
      const localHasData = (state.geckos.length || state.growth.length || state.pairings.length);
      if (!remoteLoaded && !remoteHasData && localHasData) {
        // First cloud run: keep existing local data and upload it instead of wiping it.
        remoteLoaded = true;
        lastSnapshot = '';
        setStatus('로컬 자료 이전 중…','busy');
        await pushRemote(true);
        return;
      }
      if (force || !remoteLoaded || (data.updatedAt && data.updatedAt !== lastRemoteUpdate)) applyRemote(data);
      remoteLoaded = true;
      setStatus('☁ GitHub 동기화','ok');
    } catch (e) {
      if (e.status === 401) setStatus('🔒 동기화 비밀번호 필요','warn');
      else if (e.status === 503) setStatus('⚙ GitHub 설정 필요','warn');
      else setStatus('☁ 오프라인 저장','warn');
      console.warn('Cloud load:', e);
    } finally { syncing = false; }
  }

  async function pushRemote(force=false) {
    if (syncing && !force) return;
    const now = snapshot();
    if (!force && (!remoteLoaded || now === lastSnapshot)) return;
    syncing = true;
    setStatus('저장 중…','busy');
    try {
      const data = await api('/api/data', {method:'POST', body: JSON.stringify({geckos:state.geckos,growth:state.growth,pairings:state.pairings})});
      lastSnapshot = snapshot();
      lastRemoteUpdate = data.updatedAt || new Date().toISOString();
      setStatus('✓ GitHub 저장됨','ok');
      setTimeout(()=>setStatus('☁ GitHub 동기화','ok'),1200);
    } catch(e) {
      if (e.status === 401) setStatus('🔒 동기화 비밀번호 필요','warn');
      else if (e.status === 503) setStatus('⚙ GitHub 설정 필요','warn');
      else setStatus('저장 실패 · 로컬 유지','warn');
      console.warn('Cloud save:', e);
    } finally { syncing = false; }
  }

  function installPhotoUI() {
    const notes = document.getElementById('geckoNotes');
    if (!notes || document.getElementById('geckoPhoto')) return;
    const box = document.createElement('div');
    box.className = 'photo-upload-box';
    box.innerHTML = `
      <div class="photo-preview" id="geckoPhotoPreview"><span>사진 없음</span></div>
      <div class="photo-controls">
        <b>개체 대표 사진</b>
        <span>휴대폰에서는 카메라로 바로 촬영할 수 있습니다. 업로드 전 자동 압축됩니다.</span>
        <input id="geckoPhoto" type="file" accept="image/*" capture="environment" />
        <button type="button" class="btn secondary small" id="removePhotoBtn">대표 사진 제거</button>
      </div>`;
    notes.closest('label')?.before(box);
    document.getElementById('geckoPhoto').addEventListener('change', e => {
      photoFile = e.target.files?.[0] || null;
      if (photoFile) showLocalPreview(photoFile);
    });
    document.getElementById('removePhotoBtn').onclick = () => {
      const id = document.getElementById('geckoId').value;
      const g = getGecko(id);
      if (g) { g.photoUrl=''; g.photoPath=''; saveState(); decoratePhotos(); updatePhotoPreview(g); }
      photoFile = null;
    };
  }

  function showLocalPreview(file) {
    const p = document.getElementById('geckoPhotoPreview');
    if (!p) return;
    const url = URL.createObjectURL(file);
    p.innerHTML = `<img src="${url}" alt="선택한 사진" />`;
  }

  function updatePhotoPreview(g) {
    const p = document.getElementById('geckoPhotoPreview');
    if (!p) return;
    p.innerHTML = g?.photoUrl ? `<img src="${g.photoUrl}?v=${Date.now()}" alt="${esc(g.name)}" />` : '<span>사진 없음</span>';
  }

  async function compressImage(file) {
    const bitmap = await createImageBitmap(file);
    const max = 1400;
    const scale = Math.min(1, max/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(bitmap.width*scale));
    canvas.height = Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
    return blob || file;
  }

  async function uploadPhoto(gecko, file) {
    setStatus('사진 업로드 중…','busy');
    const blob = await compressImage(file);
    const base64 = await new Promise((resolve,reject)=>{
      const r=new FileReader(); r.onload=()=>resolve(String(r.result).split(',')[1]); r.onerror=reject; r.readAsDataURL(blob);
    });
    const result = await api('/api/photo', {method:'POST', body:JSON.stringify({geckoId:gecko.id,contentBase64:base64,extension:'webp'})});
    gecko.photoUrl = result.url;
    gecko.photoPath = result.path;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    photoFile = null;
    document.getElementById('geckoPhoto').value='';
    updatePhotoPreview(gecko);
    decoratePhotos();
    await pushRemote(true);
  }

  function decoratePhotos() {
    document.querySelectorAll('#view-geckos tbody tr').forEach(row=>{
      const cell=row.querySelector('td'); if(!cell || cell.querySelector('.gecko-thumb')) return;
      const name=cell.querySelector('b')?.textContent; const g=state.geckos.find(x=>x.name===name);
      if(g?.photoUrl){ const img=document.createElement('img'); img.className='gecko-thumb'; img.src=g.photoUrl; img.alt=g.name; cell.prepend(img); cell.classList.add('with-photo'); }
    });
    document.querySelectorAll('.pnode').forEach(node=>{
      const id=node.dataset?.id;
      const g=id?getGecko(id):null;
      if(g?.photoUrl && !node.querySelector('image')) {
        // SVG pedigree rendering differs by version; photo remains available in the edit/detail view.
      }
    });
  }

  function patchDialogs() {
    installPhotoUI();
    const dialog=document.getElementById('geckoDialog');
    dialog?.addEventListener('close',()=>{photoFile=null;});
    const originalOpen = window.openGeckoDialog || openGeckoDialog;
    window.openGeckoDialog = function(id='') { originalOpen(id); setTimeout(()=>{ installPhotoUI(); updatePhotoPreview(id?getGecko(id):null); const f=document.getElementById('geckoPhoto'); if(f)f.value=''; photoFile=null; },0); };

    // Existing onclick handlers may hold the old function reference, so observe dialog opening too.
    new MutationObserver(()=>{ if(dialog?.open){ installPhotoUI(); const id=document.getElementById('geckoId')?.value; updatePhotoPreview(id?getGecko(id):null); } }).observe(dialog,{attributes:true,attributeFilter:['open']});

    const saveBtn=document.getElementById('saveGeckoBtn');
    saveBtn?.addEventListener('click',()=>{
      if(!photoFile) return;
      const beforeIds=new Set(state.geckos.map(g=>g.id));
      const existingId=document.getElementById('geckoId').value;
      const selected=photoFile;
      setTimeout(async()=>{
        const g=existingId?getGecko(existingId):state.geckos.find(x=>!beforeIds.has(x.id));
        if(!g) return;
        try { await uploadPhoto(g,selected); renderCurrent(); decoratePhotos(); }
        catch(e){ alert('사진 업로드에 실패했습니다: '+e.message); }
      },150);
    }, true);
  }

  function installCloudCard() {
    const note=document.querySelector('.sidebar-note');
    if(note){ note.innerHTML='<b>GitHub Cloud</b><span>기록과 사진을 GitHub에 저장해 여러 기기에서 동기화합니다.</span>'; note.style.cursor='pointer'; note.onclick=configureSync; }
  }

  document.addEventListener('DOMContentLoaded', async()=>{
    installCloudCard();
    patchDialogs();
    setStatus('☁ 연결 중…','busy');
    await loadRemote();
    decoratePhotos();
    setInterval(()=>pushRemote(false), SYNC_INTERVAL);
    setInterval(()=>loadRemote(false), 30000);
    new MutationObserver(decoratePhotos).observe(document.querySelector('.main') || document.body,{childList:true,subtree:true});
  });
})();
