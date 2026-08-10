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
  genetics: ['유전 · 교배 예상','두 개체를 선택해 유전 형질과 예상 자손 확률을 계산합니다.'],
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
  if (currentView === 'genetics') renderGenetics();
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
    <thead><tr><th>개체</th><th>유전 / 통용 표기</th><th>성별</th><th>나이</th><th>최근 체중</th><th>부모 1</th><th>부모 2</th><th></th></tr></thead>
    <tbody>${list.map(g => {
      const last = latestGrowth(g.id);
      const aliases=comboAliasesForGecko(g);
      const geneText=aliases[0] || geneticAssessment(g).certain.filter(x=>!x.includes('유전자 없음')).slice(0,2).join(' · ') || '-';
      return `<tr><td class="name-cell"><b>${esc(g.name)}</b><span>${esc(g.morph || '모프 미입력')}</span></td><td class="name-cell"><b>${esc(geneText)}</b><span>${aliases.length>1?esc(aliases.slice(1).join(' / ')):'자동 추론'}</span></td><td>${sexBadge(g.sex)}</td><td>${ageText(g.hatchDate)}</td><td>${last?.weight!=null && last.weight!=='' ? `${last.weight} g` : '-'}</td><td>${esc(geckoName(g.parent1Id))}</td><td>${esc(geckoName(g.parent2Id))}</td><td><div class="actions"><button class="btn secondary small" data-edit="${g.id}">수정</button><button class="btn ghost small" data-growth="${g.id}">성장</button><button class="btn ghost small" data-delete="${g.id}">삭제</button></div></td></tr>`;
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
  $('#geckoNotation').value = g?.breederNotation || '';
  $('#geckoTraits').value = (g?.customTraits || []).join(', ');
  $('#geneLilly').value = g?.genetics?.lilly || 'unknown';
  $('#geneAxanthic').value = g?.genetics?.axanthic || 'unknown';
  $('#geneCappuccino').value = g?.genetics?.cappuccino || 'unknown';
  $('#traitSolidBack').value = g?.genetics?.solidBack || 'unknown';
  $('#notationHint').textContent = '';
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
  const data = normalizeGecko({
    id: id || uid(), name,
    morph: $('#geckoMorph').value.trim(), sex: $('#geckoSex').value,
    hatchDate: $('#geckoHatchDate').value, acquiredDate: $('#geckoAcquiredDate').value,
    breeder: $('#geckoBreeder').value.trim(), notes: $('#geckoNotes').value.trim(),
    parent1Id: p1, parent2Id: p2,
    breederNotation: $('#geckoNotation').value.trim(),
    customTraits: splitTraits($('#geckoTraits').value),
    genetics: {
      lilly: $('#geneLilly').value,
      axanthic: $('#geneAxanthic').value,
      cappuccino: $('#geneCappuccino').value,
      solidBack: $('#traitSolidBack').value
    }
  });
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
