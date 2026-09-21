let morphQuery = '', morphGroup = '';
function morphCard(m) {
  return `<article class="morph-card morph-${m.group}"><div class="morph-card-top"><span class="morph-category">${esc(CrestieMorphs.groups[m.group])}</span><span class="morph-index">${esc(m.en)}</span></div><h3>${esc(m.name)}</h3><p>${esc(m.look)}</p><details><summary>구분 · 유전 정보</summary><p>${esc(m.note)}</p>${m.aliases?`<p>다른 표기: ${esc(m.aliases)}</p>`:''}</details></article>`;
}
function renderMorphs() {
  const el=$('#view-morphs');
  el.innerHTML=`<div class="morph-hero"><div><span class="morph-eyebrow">CRESTIE MORPH GUIDE</span><h2>우리 크레의 특징을<br>하나씩 알아보세요.</h2><p>모프 하나로 모든 특징이 정해지지는 않아요.<br>색상, 무늬, 유전 모프를 함께 살펴보세요.</p></div><div class="morph-total"><b>${CrestieMorphs.entries.length}</b><span>모프 · 특징 안내</span></div></div><div class="morph-featured"><div><b>릴리화이트</b><span>유전 모프</span></div><div><b>아잔틱</b><span>유전 모프</span></div><div><b>릴리아잔틱</b><span>릴리화이트 + 비주얼 아잔틱</span></div></div><div class="card pad morph-tools"><label for="morphSearch">이름이나 특징으로 찾기</label><input type="search" id="morphSearch" placeholder="예: 릴잔틱, 달마시안, Pinstripe" value="${esc(morphQuery)}"><div class="morph-filters" role="group" aria-label="모프 분류">${[['','전체'],...Object.entries(CrestieMorphs.groups)].map(([id,name])=>`<button type="button" class="morph-filter" data-morph-group="${id}" aria-pressed="${morphGroup===id}">${name}</button>`).join('')}</div><p id="morphCount" role="status" aria-live="polite"></p></div><div id="morphGrid" class="morph-grid"></div><div class="morph-footnote"><b>이름과 유전 정보는 구분해서 기록하세요.</b><p>색은 파이어업·파이어다운, 성장, 조명에 따라 달라집니다. 사진이나 모프 이름만으로 헷·혈통을 확정할 수 없습니다. 개체 등록에서 여러 특징을 선택할 수 있으며, 유전 정보는 별도 항목에 입력합니다.</p><p>도감은 대표적인 통용명 안내입니다. 새로운 라인과 표현명은 계속 추가될 수 있으며, 분류 기준은 브리더마다 다를 수 있습니다.</p><a href="https://www.ibexotic.com/" target="_blank" rel="noopener noreferrer">유전 조합 참고 · IB Exotic</a></div>`;
  const update=()=>{const found=CrestieMorphs.search(morphQuery,morphGroup);$('#morphCount').textContent=`${found.length}개 항목 · 전체 ${CrestieMorphs.entries.length}개`;$('#morphGrid').innerHTML=found.length?found.map(morphCard).join(''):emptyHtml('일치하는 모프가 없습니다.','다른 이름으로 검색하거나 전체 분류를 선택하세요.');};
  $('#morphSearch').oninput=e=>{morphQuery=e.target.value;update();};
  el.querySelectorAll('[data-morph-group]').forEach(b=>b.onclick=()=>{morphGroup=b.dataset.morphGroup;el.querySelectorAll('[data-morph-group]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));update();});
  update();
}
function morphBadges(g) {
  return (g.customTraits||[]).map(name=>`<span class="morph-tag">${esc(name)}</span>`).join('');
}
function initMorphPicker() {
  const traits=$('#geckoTraits');
  const box=document.createElement('details');box.className='morph-picker';
  box.innerHTML='<summary>모프 · 특징 선택하기 <span>여러 개 선택 가능</span></summary><p>선택한 항목은 기타 형질에 추가됩니다. 유전 정보는 확인한 내용만 별도로 입력하세요.</p><label>모프 검색<input type="search" id="morphPickerSearch" placeholder="한글·영문 이름 검색"></label><div id="morphPickerResults"></div><p id="morphPickerStatus" role="status" aria-live="polite"></p>';
  traits.closest('label').after(box);
  const input=$('#morphPickerSearch'),results=$('#morphPickerResults');
  function refresh() {
    const selected=splitTraits(traits.value), found=CrestieMorphs.search(input.value);
    results.innerHTML=Object.entries(CrestieMorphs.groups).map(([id,label])=>{const group=found.filter(m=>m.group===id);return group.length?`<div class="morph-picker-group"><b>${label}</b><div>${group.map(m=>`<button type="button" class="morph-choice" data-morph-id="${m.id}" aria-pressed="${selected.includes(m.name)}">${esc(m.name)}</button>`).join('')}</div></div>`:'';}).join('')||'<p>일치하는 항목이 없습니다.</p>';
    $('#morphPickerStatus').textContent=`기록할 특징 ${selected.length}개`;
  }
  results.onclick=e=>{const b=e.target.closest('[data-morph-id]');if(!b)return;const m=CrestieMorphs.entries.find(x=>x.id===b.dataset.morphId);const selected=splitTraits(traits.value).includes(m.name);traits.value=CrestieMorphs.toggleTrait(traits.value,m.name);b.setAttribute('aria-pressed',String(!selected));$('#morphPickerStatus').textContent=`기록할 특징 ${splitTraits(traits.value).length}개`;};
  input.oninput=refresh;traits.addEventListener('input',refresh);
  new MutationObserver(()=>{if($('#geckoDialog').open){input.value='';box.open=false;refresh();}}).observe($('#geckoDialog'),{attributes:true,attributeFilter:['open']});
  refresh();
}
initMorphPicker();
