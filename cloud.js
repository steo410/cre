/* Crestie Lineage v3 - GitHub Cloud Sync (safe migration hotfix) */
(() => {
  const CLOUD_KEY = 'crestie-cloud-sync-key';
  const BACKUP_KEY = 'crestie-local-backup-before-cloud';
  const SYNC_INTERVAL = 2500;
  let remoteLoaded = false;
  let syncing = false;
  let lastSnapshot = '';
  let lastRemoteUpdate = null;
  let photoFile = null;

  const getSyncKey = () => localStorage.getItem(CLOUD_KEY) || '';
  const headers = (json=false) => ({
    ...(json ? {'Content-Type':'application/json'} : {}),
    ...(getSyncKey() ? {'X-Crestie-Key':getSyncKey()} : {})
  });
  const snapshot = () => JSON.stringify({geckos:state.geckos,growth:state.growth,pairings:state.pairings});
  const hasLocalData = () => !!(state.geckos.length || state.growth.length || state.pairings.length);
  const hasRemoteData = d => !!(d?.geckos?.length || d?.growth?.length || d?.pairings?.length);

  function setStatus(text, cls='') {
    let el=document.getElementById('cloudStatus');
    if(!el){
      el=document.createElement('button'); el.id='cloudStatus'; el.className='cloud-status'; el.type='button'; el.title='GitHub 동기화 설정';
      document.querySelector('.top-actions')?.prepend(el); el.onclick=configureSync;
    }
    el.textContent=text; el.dataset.state=cls;
  }

  async function api(path, options={}) {
    const res=await fetch(path,{...options,headers:{...headers(!!options.body),...(options.headers||{})},cache:'no-store'});
    const body=await res.json().catch(()=>({}));
    if(!res.ok){const e=new Error(body.error||`HTTP ${res.status}`);e.status=res.status;throw e;}
    return body;
  }

  function backupLocal() {
    if(!hasLocalData()) return;
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify({savedAt:new Date().toISOString(),data:{geckos:state.geckos,growth:state.growth,pairings:state.pairings}})); } catch {}
  }

  function applyRemote(data) {
    if(!data || !Array.isArray(data.geckos)) return false;
    // Never overwrite a non-empty local collection with a completely empty cloud file.
    if(!hasRemoteData(data) && hasLocalData()) return false;
    backupLocal();
    state.geckos.splice(0,state.geckos.length,...data.geckos.map(normalizeGecko));
    state.growth.splice(0,state.growth.length,...(Array.isArray(data.growth)?data.growth:[]));
    state.pairings.splice(0,state.pairings.length,...(Array.isArray(data.pairings)?data.pairings:[]));
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    if(!growthSelectedGecko || !getGecko(growthSelectedGecko)) growthSelectedGecko=state.geckos[0]?.id||'';
    lastSnapshot=snapshot(); lastRemoteUpdate=data.updatedAt||null;
    renderCurrent(); decoratePhotos(); return true;
  }

  async function pushRemote(force=false) {
    if(syncing && !force) return false;
    const now=snapshot();
    if(!force && (!remoteLoaded || now===lastSnapshot)) return false;
    if(!getSyncKey()){setStatus('🔒 동기화 비밀번호 필요','warn');return false;}
    const previousSyncing=syncing; syncing=true; setStatus('저장 중…','busy');
    try{
      const data=await api('/api/data',{method:'POST',body:JSON.stringify({geckos:state.geckos,growth:state.growth,pairings:state.pairings})});
      remoteLoaded=true; lastSnapshot=snapshot(); lastRemoteUpdate=data.updatedAt||new Date().toISOString();
      setStatus('✓ GitHub 저장됨','ok'); setTimeout(()=>setStatus('☁ GitHub 동기화','ok'),1200); return true;
    }catch(e){
      if(e.status===401)setStatus('🔒 비밀번호가 맞지 않음','warn');
      else if(e.status===503)setStatus('⚙ GitHub 토큰 설정 필요','warn');
      else setStatus('저장 실패 · 로컬 유지','warn');
      console.warn('Cloud save:',e); return false;
    }finally{syncing=previousSyncing;}
  }

  async function loadRemote(force=false) {
    if(syncing) return;
    syncing=true; setStatus('☁ 연결 확인…','busy');
    try{
      const data=await api('/api/data');
      const remoteHas=hasRemoteData(data), localHas=hasLocalData();

      // Critical safety rule: an empty GitHub file must NEVER erase local records.
      if(!remoteHas && localHas){
        if(!getSyncKey()){
          remoteLoaded=false;
          setStatus('🔒 비밀번호 입력 후 기존 자료 이전','warn');
          return;
        }
        setStatus('기존 자료 GitHub로 이전 중…','busy');
        const ok=await pushRemote(true);
        if(ok) setStatus('✓ 기존 자료 이전 완료','ok');
        return;
      }

      if(remoteHas){
        if(force || !remoteLoaded || (data.updatedAt && data.updatedAt!==lastRemoteUpdate)) applyRemote(data);
        remoteLoaded=true; lastRemoteUpdate=data.updatedAt||lastRemoteUpdate;
        setStatus('☁ GitHub 동기화','ok');
        return;
      }

      // Both sides empty: simply establish the connection, without changing anything.
      remoteLoaded=true; lastSnapshot=snapshot(); lastRemoteUpdate=data.updatedAt||null;
      setStatus(getSyncKey()?'☁ GitHub 동기화':'🔒 동기화 비밀번호 필요',getSyncKey()?'ok':'warn');
    }catch(e){
      if(e.status===401)setStatus('🔒 비밀번호가 맞지 않음','warn');
      else if(e.status===503)setStatus('⚙ GitHub 설정 필요','warn');
      else setStatus('☁ 오프라인 저장','warn');
      console.warn('Cloud load:',e);
    }finally{syncing=false;}
  }

  function configureSync(){
    const key=prompt('Crestie 동기화 비밀번호를 입력하세요.\n(Vercel의 CRESTIE_SYNC_KEY와 같은 값)',getSyncKey());
    if(key===null)return;
    if(key.trim())localStorage.setItem(CLOUD_KEY,key.trim()); else localStorage.removeItem(CLOUD_KEY);
    setStatus('GitHub 연결 확인…','busy'); loadRemote(true);
  }

  function installCloudCard(){
    const note=document.querySelector('.sidebar-note');
    if(note){note.innerHTML='<b>GitHub Cloud</b><span>기록과 사진을 GitHub에 저장해 여러 기기에서 동기화합니다.</span>';note.style.cursor='pointer';note.onclick=configureSync;}
  }

  function installPhotoUI(){
    const notes=document.getElementById('geckoNotes');
    if(!notes || document.getElementById('geckoPhoto'))return;
    const box=document.createElement('div'); box.className='photo-upload-box';
    box.innerHTML=`<div class="photo-preview" id="geckoPhotoPreview"><span>사진 없음</span></div><div class="photo-controls"><b>개체 대표 사진</b><span>휴대폰 카메라/갤러리 또는 노트북 파일에서 선택할 수 있습니다.</span><input id="geckoPhoto" type="file" accept="image/*" capture="environment" /></div>`;
    notes.closest('label')?.before(box);
    document.getElementById('geckoPhoto').addEventListener('change',e=>{photoFile=e.target.files?.[0]||null;if(photoFile)showLocalPreview(photoFile);});
  }

  function showLocalPreview(file){
    const p=document.getElementById('geckoPhotoPreview');if(!p)return;
    const url=URL.createObjectURL(file);p.innerHTML=`<img src="${url}" alt="선택한 사진" />`;
  }
  function updatePhotoPreview(g){
    const p=document.getElementById('geckoPhotoPreview');if(!p)return;
    p.innerHTML=g?.photoUrl?`<img src="${g.photoUrl}?v=${Date.now()}" alt="${esc(g.name)}" />`:'<span>사진 없음</span>';
  }
  async function compressImage(file){
    const bitmap=await createImageBitmap(file), max=1400, scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bitmap.width*scale));c.height=Math.max(1,Math.round(bitmap.height*scale));c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(r,'image/webp',0.82)) || file;
  }
  async function uploadPhoto(g,file){
    if(!getSyncKey())throw new Error('먼저 동기화 비밀번호를 입력하세요.');
    setStatus('사진 업로드 중…','busy');
    const blob=await compressImage(file);
    const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
    const result=await api('/api/photo',{method:'POST',body:JSON.stringify({geckoId:g.id,contentBase64:base64,extension:'webp'})});
    g.photoUrl=result.url;g.photoPath=result.path;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));photoFile=null;
    const f=document.getElementById('geckoPhoto');if(f)f.value='';updatePhotoPreview(g);decoratePhotos();await pushRemote(true);
  }

  function decoratePhotos(){
    document.querySelectorAll('#view-geckos tbody tr').forEach(row=>{
      const cell=row.querySelector('td');if(!cell||cell.querySelector('.gecko-thumb'))return;
      const name=cell.querySelector('b')?.textContent,g=state.geckos.find(x=>x.name===name);
      if(g?.photoUrl){const img=document.createElement('img');img.className='gecko-thumb';img.src=g.photoUrl;img.alt=g.name;cell.prepend(img);cell.classList.add('with-photo');}
    });
  }

  function patchDialogs(){
    installPhotoUI();
    const dialog=document.getElementById('geckoDialog');
    dialog?.addEventListener('close',()=>{photoFile=null;});
    new MutationObserver(()=>{
      if(dialog?.open){installPhotoUI();const id=document.getElementById('geckoId')?.value;updatePhotoPreview(id?getGecko(id):null);}
    }).observe(dialog,{attributes:true,attributeFilter:['open']});
    document.getElementById('saveGeckoBtn')?.addEventListener('click',()=>{
      if(!photoFile)return;
      const before=new Set(state.geckos.map(g=>g.id)), existing=document.getElementById('geckoId').value, selected=photoFile;
      setTimeout(async()=>{const g=existing?getGecko(existing):state.geckos.find(x=>!before.has(x.id));if(!g)return;try{await uploadPhoto(g,selected);renderCurrent();decoratePhotos();}catch(e){alert('사진 업로드에 실패했습니다: '+e.message);}},180);
    },true);
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    installCloudCard();patchDialogs();setStatus('☁ 연결 중…','busy');
    await loadRemote();decoratePhotos();
    setInterval(()=>pushRemote(false),SYNC_INTERVAL);
    setInterval(()=>loadRemote(false),30000);
    new MutationObserver(decoratePhotos).observe(document.querySelector('.main')||document.body,{childList:true,subtree:true});
  });
})();
