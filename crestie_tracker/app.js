const STORAGE_KEY = 'crestie-lineage-v1';

const state = loadState();
let currentView = 'dashboard';
let growthSelectedGecko = state.geckos[0]?.id || '';
let pedigreeSelectedId = '';
let pedigreeScale = 1;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);
const esc = (value='') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { geckos: [], growth: [], pairings: [] };
    const parsed = JSON.parse(raw);
    return {
      geckos: Array.isArray(parsed.geckos) ? parsed.geckos : [],
      growth: Array.isArray(parsed.growth) ? parsed.growth : [],
      pairings: Array.isArray(parsed.pairings) ? parsed.pairings : []
    };
  } catch {
    return { geckos: [], growth: [], pairings: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getGecko(id) { return state.geckos.find(g => g.id === id); }
function geckoName(id) { return getGecko(id)?.name || '미등록'; }
function sexLabel(sex) { return ({male:'수컷', female:'암컷', unknown:'미확인'})[sex] || '미확인'; }
function statusLabel(status) { return ({planned:'계획', paired:'교배 진행', eggs:'산란 / 알', hatched:'부화 확인', closed:'종료'})[status] || status; }
function sexBadge(sex) { return `<span class="badge ${sex}">${sexLabel(sex)}</span>`; }
function fmtDate(value) { return value || '-'; }

function ageText(date) {
  if (!date) return '-';
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '-';
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) return '-';
  if (months < 12) return `${months}개월`;
  return `${Math.floor(months/12)}년 ${months%12}개월`;
}

function latestGrowth(geckoId) {
  return state.growth
    .filter(r => r.geckoId === geckoId)
    .sort((a,b) => b.date.localeCompare(a.date))[0];
}

function isAncestor(ancestorId, nodeId, visited = new Set()) {
  if (!ancestorId || !nodeId || visited.has(nodeId)) return false;
  visited.add(nodeId);
  const node = getGecko(nodeId);
  if (!node) return false;
  const parents = [node.parent1Id, node.parent2Id].filter(Boolean);
  if (parents.includes(ancestorId)) return true;
  return parents.some(p => isAncestor(ancestorId, p, visited));
}

function directParentChild(aId, bId) {
  const a = getGecko(aId), b = getGecko(bId);
  if (!a || !b) return false;
  return [a.parent1Id, a.parent2Id].includes(bId) || [b.parent1Id, b.parent2Id].includes(aId);
}

function siblingRelation(aId, bId) {
  const a = getGecko(aId), b = getGecko(bId);
  if (!a || !b) return false;
  const ap = [a.parent1Id, a.parent2Id].filter(Boolean);
  const bp = [b.parent1Id, b.parent2Id].filter(Boolean);
  return ap.length > 0 && bp.length > 0 && ap.some(id => bp.includes(id));
}

function ancestorsOf(id, out = new Set()) {
  const g = getGecko(id);
  if (!g) return out;
  [g.parent1Id, g.parent2Id].filter(Boolean).forEach(p => {
    if (!out.has(p)) { out.add(p); ancestorsOf(p, out); }
  });
  return out;
}

function relationOf(aId, bId) {
  if (!aId || !bId) return '두 개체를 선택하세요.';
  if (aId === bId) return '같은 개체끼리는 교배 관계로 등록할 수 없습니다.';
  if (directParentChild(aId,bId)) return '직계 부모 · 자식 관계 — 등록 가능';
  if (siblingRelation(aId,bId)) return '형제 · 자매 관계 — 등록 가능';
  const aa = ancestorsOf(aId), bb = ancestorsOf(bId);
  if (aa.has(bId) || bb.has(aId)) return '직계 조상 · 후손 관계 — 등록 가능';
  if ([...aa].some(id => bb.has(id))) return '공통 조상이 있는 혈연 관계 — 등록 가능';
  return '확인된 공통 조상 없음';
}

const viewMeta = {
  dashboard: ['대시보드','크레스티드 게코의 성장과 혈통을 한곳에서 관리합니다.'],
  geckos: ['개체 관리','이름, 모프, 성별, 부화일, 부모 정보를 관리합니다.'],
  growth: ['성장 기록','날짜별 체중과 전장 변화를 기록하고 그래프로 확인합니다.'],
  pedigree: ['교배 · 가계도','부모 관계와 교배 관계를 바탕으로 자동 가계도를 그립니다.'],
  backup: ['백업 · 복원','모든 데이터를 JSON 파일로 내보내거나 다시 불러올 수 있습니다.']
};

function setView(name) {
  currentView = name;
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  $('#viewTitle').textContent = viewMeta[name][0];
  $('#viewSubtitle').textContent = viewMeta[name][1];
  renderCurrent();
}

function renderCurrent() {
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'geckos') renderGeckos();
  if (currentView === 'growth') renderGrowth();
  if (currentView === 'pedigree') renderPedigree();
  if (currentView === 'backup') renderBackup();
}

function renderAll() {
  saveState();
  renderCurrent();
}

function renderDashboard() {
  const latestRecords = [...state.growth].sort((a,b) => b.date.localeCompare(a.date)).slice(0,6);
  const activePairs = state.pairings.filter(p => p.status !== 'closed');
  const knownSex = state.geckos.filter(g => g.sex !== 'unknown').length;
  const withParents = state.geckos.filter(g => g.parent1Id || g.parent2Id).length;

  $('#view-dashboard').innerHTML = `
    <div class="grid cols-4">
      <div class="card stat-card"><div class="stat-label">등록 개체</div><div class="stat-value">${state.geckos.length}</div><div class="stat-sub">전체 크레스티드 게코</div></div>
      <div class="card stat-card"><div class="stat-label">성별 확인</div><div class="stat-value">${knownSex}</div><div class="stat-sub">미확인 ${state.geckos.length-knownSex}마리</div></div>
      <div class="card stat-card"><div class="stat-label">부모 정보 있음</div><div class="stat-value">${withParents}</div><div class="stat-sub">자동 가계도 연결 개체</div></div>
      <div class="card stat-card"><div class="stat-label">진행 중 교배</div><div class="stat-value">${activePairs.length}</div><div class="stat-sub">계획·진행·산란·부화</div></div>
    </div>
    <div class="grid cols-2" style="margin-top:18px">
      <div class="card pad">
        <div class="section-head"><div><h2>최근 성장 기록</h2><p>가장 최근에 입력된 기록입니다.</p></div><button class="btn secondary small" data-go="growth">전체 보기</button></div>
        ${latestRecords.length ? `<div class="list">${latestRecords.map(r => {
          const g = getGecko(r.geckoId);
          return `<div class="list-item"><div class="list-main"><b>${esc(g?.name || '삭제된 개체')}</b><span>${r.date}${r.note ? ` · ${esc(r.note)}`:''}</span></div><div class="kpi-line">${r.weight!=='' && r.weight!=null ? `<span class="badge">${r.weight} g</span>`:''}${r.length!=='' && r.length!=null ? `<span class="badge good">${r.length} cm</span>`:''}</div></div>`;
        }).join('')}</div>` : emptyHtml('아직 성장 기록이 없습니다.','첫 체중 기록을 추가해 보세요.')}
      </div>
      <div class="card pad">
        <div class="section-head"><div><h2>교배 관계</h2><p>최근 등록한 교배 계획과 진행 상태입니다.</p></div><button class="btn secondary small" data-go="pedigree">가계도 보기</button></div>
        ${state.pairings.length ? `<div class="list">${[...state.pairings].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,6).map(p => `<div class="list-item"><div class="list-main"><b>${esc(geckoName(p.aId))} × ${esc(geckoName(p.bId))}</b><span>${fmtDate(p.date)} · ${esc(relationOf(p.aId,p.bId).replace(' — 등록 가능',''))}</span></div><span class="badge ${p.status==='closed'?'unknown':'warn'}">${statusLabel(p.status)}</span></div>`).join('')}</div>` : emptyHtml('등록된 교배 관계가 없습니다.','가계도에서 교배 관계를 추가할 수 있습니다.')}
      </div>
    </div>`;
  $('#view-dashboard').querySelectorAll('[data-go]').forEach(b => b.onclick = () => setView(b.dataset.go));
}

function emptyHtml(title, sub) {
  return `<div class="empty"><b>${title}</b><span>${sub}</span></div>`;
}

function renderGeckos() {
  $('#view-geckos').innerHTML = `
    <div class="card">
      <div class="section-head" style="padding:18px 18px 0">
        <div><h2>개체 목록</h2><p>부모 정보 수정 시 가계도도 즉시 다시 계산됩니다.</p></div>
        <div class="toolbar"><input id="geckoSearch" class="search" placeholder="이름 또는 모프 검색" /><button class="btn primary" id="addGeckoInView">+ 개체 등록</button></div>
      </div>
      <div id="geckoTable"></div>
    </div>`;
  $('#addGeckoInView').onclick = () => openGeckoDialog();
  $('#geckoSearch').oninput = e => renderGeckoTable(e.target.value);
  renderGeckoTable('');
}

function renderGeckoTable(query='') {
  const el = $('#geckoTable');
  if (!el) return;
  const q = query.trim().toLowerCase();
  const list = state.geckos.filter(g => !q || g.name.toLowerCase().includes(q) || (g.morph||'').toLowerCase().includes(q));
  if (!list.length) { el.innerHTML = emptyHtml(state.geckos.length?'검색 결과가 없습니다.':'등록된 개체가 없습니다.','개체를 등록하면 성장 기록과 가계도 기능을 사용할 수 있습니다.'); return; }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>개체</th><th>성별</th><th>나이</th><th>최근 체중</th><th>부모 1</th><th>부모 2</th><th></th></tr></thead>
    <tbody>${list.map(g => {
      const last = latestGrowth(g.id);
      return `<tr><td class="name-cell"><b>${esc(g.name)}</b><span>${esc(g.morph || '모프 미입력')}</span></td><td>${sexBadge(g.sex)}</td><td>${ageText(g.hatchDate)}</td><td>${last?.weight!=null && last.weight!=='' ? `${last.weight} g` : '-'}</td><td>${esc(geckoName(g.parent1Id))}</td><td>${esc(geckoName(g.parent2Id))}</td><td><div class="actions"><button class="btn secondary small" data-edit="${g.id}">수정</button><button class="btn ghost small" data-growth="${g.id}">성장</button><button class="btn ghost small" data-delete="${g.id}">삭제</button></div></td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openGeckoDialog(b.dataset.edit));
  el.querySelectorAll('[data-growth]').forEach(b => b.onclick = () => { growthSelectedGecko = b.dataset.growth; setView('growth'); });
  el.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => deleteGecko(b.dataset.delete));
}

function fillGeckoSelect(select, {includeBlank=false, excludeId=''}={}) {
  select.innerHTML = `${includeBlank?'<option value="">없음 / 미등록</option>':''}${state.geckos.filter(g=>g.id!==excludeId).sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(g=>`<option value="${g.id}">${esc(g.name)} · ${esc(g.morph||'모프 미입력')} · ${sexLabel(g.sex)}</option>`).join('')}`;
}

function openGeckoDialog(id='') {
  const g = id ? getGecko(id) : null;
  $('#geckoDialogTitle').textContent = g ? '개체 정보 수정' : '개체 등록';
  $('#geckoId').value = g?.id || '';
  $('#geckoName').value = g?.name || '';
  $('#geckoMorph').value = g?.morph || '';
  $('#geckoSex').value = g?.sex || 'unknown';
  $('#geckoHatchDate').value = g?.hatchDate || '';
  $('#geckoAcquiredDate').value = g?.acquiredDate || '';
  $('#geckoBreeder').value = g?.breeder || '';
  $('#geckoNotes').value = g?.notes || '';
  fillGeckoSelect($('#geckoParent1'), {includeBlank:true, excludeId:id});
  fillGeckoSelect($('#geckoParent2'), {includeBlank:true, excludeId:id});
  $('#geckoParent1').value = g?.parent1Id || '';
  $('#geckoParent2').value = g?.parent2Id || '';
  $('#geckoFormError').classList.add('hidden');
  $('#geckoDialog').showModal();
}

function saveGecko() {
  const id = $('#geckoId').value;
  const name = $('#geckoName').value.trim();
  const p1 = $('#geckoParent1').value;
  const p2 = $('#geckoParent2').value;
  const err = $('#geckoFormError');
  if (!name) { err.textContent='이름을 입력하세요.'; err.classList.remove('hidden'); return; }
  if (p1 && p2 && p1 === p2) { err.textContent='부모 1과 부모 2에는 서로 다른 개체를 선택하세요.'; err.classList.remove('hidden'); return; }
  if (id && ((p1 && isAncestor(id,p1)) || (p2 && isAncestor(id,p2)))) {
    err.textContent='선택한 부모가 현재 개체의 후손이어서 가계도가 순환하게 됩니다. 부모·자식 교배 자체는 가능하지만, 한 개체가 자기 자신의 조상이 되는 구조만 막습니다.';
    err.classList.remove('hidden'); return;
  }
  const data = {
    id: id || uid(), name,
    morph: $('#geckoMorph').value.trim(), sex: $('#geckoSex').value,
    hatchDate: $('#geckoHatchDate').value, acquiredDate: $('#geckoAcquiredDate').value,
    breeder: $('#geckoBreeder').value.trim(), notes: $('#geckoNotes').value.trim(),
    parent1Id: p1, parent2Id: p2
  };
  if (id) Object.assign(getGecko(id), data); else state.geckos.push(data);
  if (!growthSelectedGecko) growthSelectedGecko = data.id;
  saveState();
  $('#geckoDialog').close();
  renderCurrent();
}

function deleteGecko(id) {
  const g = getGecko(id); if (!g) return;
  const children = state.geckos.filter(x => x.parent1Id===id || x.parent2Id===id).length;
  const msg = `“${g.name}” 개체를 삭제할까요?\n성장 기록과 교배 기록도 함께 삭제됩니다.${children?`\n자식 ${children}마리의 부모 연결은 자동으로 해제됩니다.`:''}`;
  if (!confirm(msg)) return;
  state.geckos = state.geckos.filter(x => x.id !== id);
  state.growth = state.growth.filter(x => x.geckoId !== id);
  state.pairings = state.pairings.filter(x => x.aId !== id && x.bId !== id);
  state.geckos.forEach(x => { if(x.parent1Id===id)x.parent1Id=''; if(x.parent2Id===id)x.parent2Id=''; });
  if (growthSelectedGecko === id) growthSelectedGecko = state.geckos[0]?.id || '';
  if (pedigreeSelectedId === id) pedigreeSelectedId = '';
  renderAll();
}

function renderGrowth() {
  if (!growthSelectedGecko || !getGecko(growthSelectedGecko)) growthSelectedGecko = state.geckos[0]?.id || '';
  $('#view-growth').innerHTML = `
    <div class="growth-layout">
      <div class="card pad">
        <div class="section-head"><div><h2>개체 선택</h2><p>선택한 개체의 성장 기록을 확인합니다.</p></div><button class="btn primary small" id="addGrowthInView" ${state.geckos.length?'':'disabled'}>+ 기록</button></div>
        ${state.geckos.length ? `<label>개체<select id="growthFocus">${state.geckos.sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(g=>`<option value="${g.id}" ${g.id===growthSelectedGecko?'selected':''}>${esc(g.name)} · ${esc(g.morph||'모프 미입력')}</option>`).join('')}</select></label><div id="growthSummary" style="margin-top:18px"></div>` : emptyHtml('먼저 개체를 등록하세요.','성장 기록은 등록된 개체에 연결됩니다.')}
      </div>
      <div class="card pad">
        <div class="section-head"><div><h2>성장 그래프</h2><p>체중(g)과 전장(cm)을 날짜 순서로 표시합니다.</p></div><div class="legend"><span><i></i>체중</span><span><i class="length"></i>전장</span></div></div>
        <div id="growthChart" class="chart-box"></div>
      </div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="section-head" style="padding:18px 18px 0"><div><h2>기록 내역</h2><p>수정하거나 삭제할 수 있습니다.</p></div></div>
      <div id="growthTable"></div>
    </div>`;
  if (state.geckos.length) {
    $('#growthFocus').onchange = e => { growthSelectedGecko = e.target.value; renderGrowth(); };
    $('#addGrowthInView').onclick = () => openGrowthDialog('',growthSelectedGecko);
  }
  renderGrowthSubparts();
}

function renderGrowthSubparts() {
  if (!growthSelectedGecko) {
    $('#growthChart').innerHTML = emptyHtml('표시할 데이터가 없습니다.','개체를 등록하고 성장 기록을 추가하세요.');
    $('#growthTable').innerHTML = emptyHtml('성장 기록이 없습니다.','');
    return;
  }
  const g = getGecko(growthSelectedGecko);
  const rows = state.growth.filter(r => r.geckoId===growthSelectedGecko).sort((a,b)=>a.date.localeCompare(b.date));
  const last = rows.at(-1);
  $('#growthSummary').innerHTML = `<div class="detail-grid">
    <div class="detail-row"><span>이름</span><b>${esc(g.name)}</b></div>
    <div class="detail-row"><span>모프</span><b>${esc(g.morph||'-')}</b></div>
    <div class="detail-row"><span>부화일 / 나이</span><b>${fmtDate(g.hatchDate)} · ${ageText(g.hatchDate)}</b></div>
    <div class="detail-row"><span>최근 체중</span><b>${last?.weight!=='' && last?.weight!=null ? `${last.weight} g`:'-'}</b></div>
    <div class="detail-row"><span>최근 전장</span><b>${last?.length!=='' && last?.length!=null ? `${last.length} cm`:'-'}</b></div>
    <div class="detail-row"><span>누적 기록</span><b>${rows.length}개</b></div>
  </div>`;
  $('#growthChart').innerHTML = growthChartSvg(rows);
  $('#growthTable').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>날짜</th><th>체중</th><th>전장</th><th>상태</th><th>메모</th><th></th></tr></thead><tbody>${[...rows].reverse().map(r=>`<tr><td>${r.date}</td><td>${r.weight!==''&&r.weight!=null?`${r.weight} g`:'-'}</td><td>${r.length!==''&&r.length!=null?`${r.length} cm`:'-'}</td><td>${esc(r.condition||'-')}</td><td>${esc(r.note||'-')}</td><td><div class="actions"><button class="btn secondary small" data-edit-growth="${r.id}">수정</button><button class="btn ghost small" data-delete-growth="${r.id}">삭제</button></div></td></tr>`).join('')}</tbody></table></div>` : emptyHtml('아직 기록이 없습니다.','체중 또는 전장을 추가하면 그래프가 자동으로 생성됩니다.');
  $('#growthTable').querySelectorAll('[data-edit-growth]').forEach(b=>b.onclick=()=>openGrowthDialog(b.dataset.editGrowth));
  $('#growthTable').querySelectorAll('[data-delete-growth]').forEach(b=>b.onclick=()=>deleteGrowth(b.dataset.deleteGrowth));
}

function growthChartSvg(rows) {
  if (!rows.length) return emptyHtml('그래프 데이터가 없습니다.','첫 성장 기록을 추가해 보세요.');
  const W=820,H=310, L=52,R=28,T=24,B=45;
  const data = rows.map((r,i)=>({...r,i}));
  const weights = data.filter(d=>d.weight!==''&&d.weight!=null).map(d=>Number(d.weight));
  const lengths = data.filter(d=>d.length!==''&&d.length!=null).map(d=>Number(d.length));
  if (!weights.length && !lengths.length) return emptyHtml('수치 데이터가 없습니다.','체중이나 전장을 입력하면 그래프가 표시됩니다.');
  const all = [...weights,...lengths];
  let min = Math.min(...all), max = Math.max(...all);
  if (min===max){ min=Math.max(0,min-1); max+=1; }
  const pad=(max-min)*.12; min=Math.max(0,min-pad); max+=pad;
  const x = i => L + (data.length===1?(W-L-R)/2:i*(W-L-R)/(data.length-1));
  const y = v => T + (max-Number(v))*(H-T-B)/(max-min);
  const makePath = key => {
    const pts=data.filter(d=>d[key]!==''&&d[key]!=null).map(d=>[x(d.i),y(d[key])]);
    return pts.length ? `M ${pts.map(p=>p.join(' ')).join(' L ')}` : '';
  };
  const ticks=5;
  const grid = Array.from({length:ticks},(_,i)=>{ const v=min+(max-min)*i/(ticks-1); const yy=y(v); return `<line class="chart-grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text class="chart-label" x="${L-8}" y="${yy+4}" text-anchor="end">${v.toFixed(1)}</text>`; }).join('');
  const labels = data.map((d,i)=> i===0 || i===data.length-1 || i%Math.ceil(data.length/5)===0 ? `<text class="chart-label" x="${x(i)}" y="${H-16}" text-anchor="middle">${d.date.slice(5)}</text>`:'').join('');
  const wDots=data.filter(d=>d.weight!==''&&d.weight!=null).map(d=>`<circle class="chart-dot" cx="${x(d.i)}" cy="${y(d.weight)}" r="4"><title>${d.date}: ${d.weight} g</title></circle>`).join('');
  const lDots=data.filter(d=>d.length!==''&&d.length!=null).map(d=>`<circle class="chart-dot secondary" cx="${x(d.i)}" cy="${y(d.length)}" r="4"><title>${d.date}: ${d.length} cm</title></circle>`).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="성장 그래프">${grid}<line class="chart-axis" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/>${labels}<path class="chart-line" d="${makePath('weight')}"/>${wDots}<path class="chart-line secondary" d="${makePath('length')}"/>${lDots}</svg>`;
}

function openGrowthDialog(id='', geckoId='') {
  if (!state.geckos.length) { alert('먼저 개체를 등록하세요.'); return; }
  const r = id ? state.growth.find(x=>x.id===id) : null;
  fillGeckoSelect($('#growthGecko'));
  $('#growthId').value = r?.id || '';
  $('#growthGecko').value = r?.geckoId || geckoId || growthSelectedGecko || state.geckos[0].id;
  $('#growthDate').value = r?.date || today();
  $('#growthWeight').value = r?.weight ?? '';
  $('#growthLength').value = r?.length ?? '';
  $('#growthCondition').value = r?.condition || '';
  $('#growthNote').value = r?.note || '';
  $('#growthDialog').showModal();
}

function saveGrowth() {
  const id=$('#growthId').value, geckoId=$('#growthGecko').value, date=$('#growthDate').value;
  if (!geckoId || !date) { alert('개체와 날짜를 선택하세요.'); return; }
  const data={ id:id||uid(), geckoId, date, weight:$('#growthWeight').value===''?'':Number($('#growthWeight').value), length:$('#growthLength').value===''?'':Number($('#growthLength').value), condition:$('#growthCondition').value, note:$('#growthNote').value.trim() };
  if(id) Object.assign(state.growth.find(x=>x.id===id),data); else state.growth.push(data);
  growthSelectedGecko=geckoId; saveState(); $('#growthDialog').close(); if(currentView!=='growth')setView('growth'); else renderGrowth();
}
function deleteGrowth(id){ if(!confirm('이 성장 기록을 삭제할까요?'))return; state.growth=state.growth.filter(r=>r.id!==id); renderAll(); }

function renderPedigree() {
  $('#view-pedigree').innerHTML = `
    <div class="notice">교배 관계는 혈연 여부와 관계없이 등록할 수 있습니다. 형제·자매, 부모·자식, 조상·후손 관계도 막지 않습니다. 단, 부모 정보를 잘못 수정해 한 개체가 자기 자신의 조상이 되는 순환 구조만 차단합니다.</div>
    <div class="pedigree-layout" style="margin-top:18px">
      <div class="card pedigree-canvas-card">
        <div class="pedigree-toolbar"><div><b>자동 가계도</b><div style="font-size:11px;color:var(--muted);margin-top:3px">실선: 부모 → 자식 · 점선: 교배 관계</div></div><div class="toolbar"><button class="btn secondary small" id="pairAddBtn">+ 교배 관계</button><button class="btn secondary small" id="zoomOut">−</button><button class="btn secondary small" id="zoomReset">100%</button><button class="btn secondary small" id="zoomIn">+</button></div></div>
        <div class="pedigree-viewport" id="pedigreeViewport"><svg id="pedigreeSvg"></svg></div>
      </div>
      <div class="card detail-card" id="pedigreeDetail"></div>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="section-head" style="padding:18px 18px 0"><div><h2>교배 기록 / 계획</h2><p>실제 자식이 태어나면 새 개체 등록 시 두 부모를 지정하면 됩니다.</p></div></div>
      <div id="pairTable"></div>
    </div>`;
  $('#pairAddBtn').onclick=()=>openPairDialog();
  $('#zoomIn').onclick=()=>{pedigreeScale=Math.min(1.8,pedigreeScale+.15); drawPedigree();};
  $('#zoomOut').onclick=()=>{pedigreeScale=Math.max(.55,pedigreeScale-.15); drawPedigree();};
  $('#zoomReset').onclick=()=>{pedigreeScale=1; drawPedigree();};
  drawPedigree(); renderPairTable();
}

function computeLevels() {
  const memo=new Map();
  const visiting=new Set();
  function level(id){
    if(memo.has(id))return memo.get(id);
    if(visiting.has(id))return 0;
    visiting.add(id);
    const g=getGecko(id); if(!g){visiting.delete(id);return 0;}
    const ps=[g.parent1Id,g.parent2Id].filter(p=>getGecko(p));
    const l=ps.length?Math.max(...ps.map(level))+1:0;
    visiting.delete(id); memo.set(id,l); return l;
  }
  state.geckos.forEach(g=>level(g.id));
  return memo;
}

function drawPedigree() {
  const svg=$('#pedigreeSvg'); if(!svg)return;
  if(!state.geckos.length){svg.setAttribute('viewBox','0 0 900 600');svg.innerHTML=`<text x="450" y="290" text-anchor="middle" fill="#718096" font-size="15">개체를 등록하면 가계도가 자동으로 생성됩니다.</text>`; renderPedigreeDetail(); return;}
  const levels=computeLevels();
  const groups={}; state.geckos.forEach(g=>{const l=levels.get(g.id)||0;(groups[l]??=[]).push(g);});
  Object.values(groups).forEach(arr=>arr.sort((a,b)=>a.name.localeCompare(b.name,'ko')));
  const nodeW=180,nodeH=76,gapX=54,gapY=115,pad=70;
  const maxCount=Math.max(...Object.values(groups).map(a=>a.length));
  const baseW=Math.max(920,pad*2+maxCount*nodeW+(maxCount-1)*gapX);
  const levelKeys=Object.keys(groups).map(Number).sort((a,b)=>a-b);
  const baseH=Math.max(620,pad*2+(Math.max(...levelKeys)+1)*nodeH+Math.max(...levelKeys)*gapY);
  const pos=new Map();
  levelKeys.forEach(l=>{
    const arr=groups[l]; const rowW=arr.length*nodeW+(arr.length-1)*gapX; const start=(baseW-rowW)/2;
    arr.forEach((g,i)=>pos.set(g.id,{x:start+i*(nodeW+gapX),y:pad+l*(nodeH+gapY)}));
  });
  const edges=[];
  state.geckos.forEach(child=>{
    const c=pos.get(child.id); [child.parent1Id,child.parent2Id].filter(p=>pos.has(p)).forEach(pid=>{
      const p=pos.get(pid), x1=p.x+nodeW/2,y1=p.y+nodeH,x2=c.x+nodeW/2,y2=c.y;
      const mid=(y1+y2)/2; edges.push(`<path class="pedge" d="M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}"/>`);
    });
  });
  const pairEdges=state.pairings.filter(p=>pos.has(p.aId)&&pos.has(p.bId)).map(p=>{
    const a=pos.get(p.aId),b=pos.get(p.bId); const x1=a.x+nodeW/2,y1=a.y+nodeH/2,x2=b.x+nodeW/2,y2=b.y+nodeH/2;
    const bend=Math.max(35,Math.abs(x2-x1)*.18); return `<path class="pair-edge" d="M ${x1} ${y1} C ${x1} ${y1-bend}, ${x2} ${y2-bend}, ${x2} ${y2}"><title>${esc(geckoName(p.aId))} × ${esc(geckoName(p.bId))} · ${statusLabel(p.status)}</title></path>`;
  });
  const nodes=state.geckos.map(g=>{
    const p=pos.get(g.id), selected=g.id===pedigreeSelectedId?' selected':''; const sexClass=`sex-${g.sex}`;
    const morph=(g.morph||'모프 미입력'); const short=morph.length>22?morph.slice(0,21)+'…':morph;
    return `<g class="pnode${selected}" data-node-id="${g.id}" transform="translate(${p.x} ${p.y})"><rect width="${nodeW}" height="${nodeH}"/><circle class="${sexClass}" cx="18" cy="20" r="5"/><text class="name" x="30" y="25">${esc(g.name)}</text><text class="meta" x="16" y="47">${esc(short)}</text><text class="meta" x="16" y="65">${sexLabel(g.sex)} · ${g.hatchDate?ageText(g.hatchDate):'부화일 미입력'}</text></g>`;
  }).join('');
  const scaledW=baseW/pedigreeScale, scaledH=baseH/pedigreeScale;
  svg.setAttribute('viewBox',`0 0 ${scaledW} ${scaledH}`); svg.setAttribute('width',baseW); svg.setAttribute('height',baseH);
  svg.innerHTML=`<g transform="scale(${1/pedigreeScale})">${edges.join('')}${pairEdges.join('')}${nodes}</g>`;
  svg.querySelectorAll('[data-node-id]').forEach(n=>n.addEventListener('click',()=>{pedigreeSelectedId=n.dataset.nodeId;drawPedigree();}));
  $('#zoomReset').textContent=`${Math.round(pedigreeScale*100)}%`;
  renderPedigreeDetail();
}

function renderPedigreeDetail() {
  const el=$('#pedigreeDetail'); if(!el)return;
  const g=getGecko(pedigreeSelectedId) || state.geckos[0];
  if(!g){el.innerHTML=emptyHtml('선택된 개체가 없습니다.','가계도에서 개체를 클릭하세요.'); return;}
  pedigreeSelectedId=g.id;
  const children=state.geckos.filter(x=>x.parent1Id===g.id||x.parent2Id===g.id);
  const mates=new Set(); state.pairings.forEach(p=>{if(p.aId===g.id)mates.add(p.bId);if(p.bId===g.id)mates.add(p.aId);});
  const last=latestGrowth(g.id);
  el.innerHTML=`<h3>${esc(g.name)}</h3><div class="muted">${esc(g.morph||'모프 미입력')} · ${sexLabel(g.sex)}</div>
  <div class="detail-grid">
    <div class="detail-row"><span>부화일</span><b>${fmtDate(g.hatchDate)}</b></div>
    <div class="detail-row"><span>부모 1</span><b>${esc(geckoName(g.parent1Id))}</b></div>
    <div class="detail-row"><span>부모 2</span><b>${esc(geckoName(g.parent2Id))}</b></div>
    <div class="detail-row"><span>자식</span><b>${children.length}마리</b></div>
    <div class="detail-row"><span>교배 상대</span><b>${mates.size}마리</b></div>
    <div class="detail-row"><span>최근 체중</span><b>${last?.weight!==''&&last?.weight!=null?`${last.weight} g`:'-'}</b></div>
  </div>
  ${g.notes?`<div class="notice" style="margin-bottom:12px">${esc(g.notes)}</div>`:''}
  <div class="toolbar"><button class="btn primary small" id="detailEdit">정보 수정</button><button class="btn secondary small" id="detailGrowth">성장 기록</button></div>`;
  $('#detailEdit').onclick=()=>openGeckoDialog(g.id);
  $('#detailGrowth').onclick=()=>{growthSelectedGecko=g.id;setView('growth');};
}

function renderPairTable() {
  const el=$('#pairTable'); if(!el)return;
  if(!state.pairings.length){el.innerHTML=emptyHtml('등록된 교배 관계가 없습니다.','교배 관계를 추가하면 가계도에 점선으로 표시됩니다.');return;}
  el.innerHTML=`<div class="table-wrap"><table><thead><tr><th>개체 A</th><th>개체 B</th><th>혈연 관계</th><th>날짜</th><th>상태</th><th></th></tr></thead><tbody>${state.pairings.map(p=>`<tr><td>${esc(geckoName(p.aId))}</td><td>${esc(geckoName(p.bId))}</td><td><span class="badge ${relationOf(p.aId,p.bId).includes('관계')?'warn':''}">${esc(relationOf(p.aId,p.bId).replace(' — 등록 가능',''))}</span></td><td>${fmtDate(p.date)}</td><td>${statusLabel(p.status)}</td><td><div class="actions"><button class="btn secondary small" data-edit-pair="${p.id}">수정</button><button class="btn ghost small" data-delete-pair="${p.id}">삭제</button></div></td></tr>`).join('')}</tbody></table></div>`;
  el.querySelectorAll('[data-edit-pair]').forEach(b=>b.onclick=()=>openPairDialog(b.dataset.editPair));
  el.querySelectorAll('[data-delete-pair]').forEach(b=>b.onclick=()=>{if(confirm('이 교배 관계를 삭제할까요?')){state.pairings=state.pairings.filter(p=>p.id!==b.dataset.deletePair);renderAll();}});
}

function openPairDialog(id='') {
  if(state.geckos.length<2){alert('교배 관계를 만들려면 개체가 2마리 이상 필요합니다.');return;}
  const p=id?state.pairings.find(x=>x.id===id):null;
  fillGeckoSelect($('#pairA')); fillGeckoSelect($('#pairB'));
  $('#pairId').value=p?.id||''; $('#pairA').value=p?.aId||state.geckos[0].id; $('#pairB').value=p?.bId||state.geckos[1].id;
  $('#pairDate').value=p?.date||today(); $('#pairStatus').value=p?.status||'planned'; $('#pairNote').value=p?.note||'';
  updatePairHint(); $('#pairA').onchange=updatePairHint; $('#pairB').onchange=updatePairHint; $('#pairDialog').showModal();
}
function updatePairHint(){ const text=relationOf($('#pairA').value,$('#pairB').value); $('#pairRelationHint').innerHTML=`관계 판정: <b>${esc(text)}</b>`; }
function savePair(){
  const id=$('#pairId').value,aId=$('#pairA').value,bId=$('#pairB').value;
  if(!aId||!bId||aId===bId){alert('서로 다른 두 개체를 선택하세요.');return;}
  const data={id:id||uid(),aId,bId,date:$('#pairDate').value,status:$('#pairStatus').value,note:$('#pairNote').value.trim()};
  if(id)Object.assign(state.pairings.find(x=>x.id===id),data);else state.pairings.push(data);
  saveState();$('#pairDialog').close();if(currentView!=='pedigree')setView('pedigree');else renderPedigree();
}

function renderBackup() {
  const bytes=new Blob([JSON.stringify(state)]).size;
  $('#view-backup').innerHTML=`
  <div class="backup-grid">
    <div class="card backup-card"><h3>JSON 백업</h3><p>개체, 성장 기록, 부모 관계, 교배 기록을 한 파일로 저장합니다. 다른 PC로 옮길 때 가장 안전한 방법입니다.</p><button class="btn primary" id="exportBtn">백업 파일 다운로드</button></div>
    <div class="card backup-card"><h3>JSON 복원</h3><p>이 프로그램에서 내보낸 JSON 파일을 다시 불러옵니다. 현재 데이터는 불러온 데이터로 대체됩니다.</p><button class="btn secondary" id="importBtn">백업 파일 불러오기</button></div>
    <div class="card backup-card"><h3>전체 초기화</h3><p>이 브라우저에 저장된 모든 기록을 삭제합니다. 필요하다면 먼저 백업 파일을 만들어 두세요.</p><button class="btn danger" id="resetBtn">모든 데이터 삭제</button></div>
  </div>
  <div class="card pad" style="margin-top:18px"><div class="section-head"><div><h2>현재 저장 상태</h2><p>브라우저 LocalStorage 기준</p></div></div><div class="detail-grid"><div class="detail-row"><span>개체</span><b>${state.geckos.length}마리</b></div><div class="detail-row"><span>성장 기록</span><b>${state.growth.length}개</b></div><div class="detail-row"><span>교배 기록</span><b>${state.pairings.length}개</b></div><div class="detail-row"><span>대략적 데이터 크기</span><b>${(bytes/1024).toFixed(1)} KB</b></div></div></div>`;
  $('#exportBtn').onclick=exportData; $('#importBtn').onclick=()=>$('#importFile').click(); $('#resetBtn').onclick=resetData;
}

function exportData(){
  const payload={...state, exportedAt:new Date().toISOString(), app:'Crestie Lineage', version:1};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`crestie-lineage-backup-${today()}.json`; a.click(); URL.revokeObjectURL(url);
}
function importData(file){
  const reader=new FileReader(); reader.onload=()=>{try{const p=JSON.parse(reader.result);if(!Array.isArray(p.geckos)||!Array.isArray(p.growth)||!Array.isArray(p.pairings))throw new Error();if(!confirm('현재 데이터를 백업 파일의 내용으로 바꿀까요?'))return;state.geckos=p.geckos;state.growth=p.growth;state.pairings=p.pairings;growthSelectedGecko=state.geckos[0]?.id||'';pedigreeSelectedId='';saveState();renderCurrent();alert('복원이 완료되었습니다.');}catch{alert('올바른 Crestie Lineage 백업 파일이 아닙니다.');}}; reader.readAsText(file);
}
function resetData(){if(!confirm('모든 개체, 성장 기록, 교배 기록을 완전히 삭제할까요?'))return;state.geckos=[];state.growth=[];state.pairings=[];growthSelectedGecko='';pedigreeSelectedId='';saveState();renderCurrent();}

$$('.nav-btn').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('#quickGeckoBtn').onclick=()=>openGeckoDialog();
$('#quickGrowthBtn').onclick=()=>openGrowthDialog('',growthSelectedGecko);
$('#saveGeckoBtn').onclick=saveGecko;
$('#saveGrowthBtn').onclick=saveGrowth;
$('#savePairBtn').onclick=savePair;
$('#importFile').onchange=e=>{const f=e.target.files?.[0];if(f)importData(f);e.target.value='';};

renderDashboard();
