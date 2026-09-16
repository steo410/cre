let ledgerMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
let ledgerCategory = '', ledgerDirection = '';
const won = amount => new Intl.NumberFormat('ko-KR').format(amount) + '원';
const ledgerOptions = selected => Object.entries(CrestieFeatures.categories).map(([key, value]) => '<option value="' + key + '"' + (selected === key ? ' selected' : '') + '>' + value + '</option>').join('');
function renderLedger() {
  const rows = CrestieFeatures.ledgerRows(state.ledger, { month: ledgerMonth, category: ledgerCategory, direction: ledgerDirection });
  const sums = CrestieFeatures.totals(rows);
  const el = document.getElementById('view-ledger');
  el.innerHTML = '<div class="card pad"><div class="section-head"><div><h2>사육 · 거래 가계부</h2><p>크레의 입양·분양, 사육장과 용품의 수입·지출을 기록합니다.</p></div><button type="button" class="btn primary" id="addLedger">＋ 거래 기록</button></div><div class="ledger-filters"><label>조회 월<input type="month" id="ledgerMonth" value="' + esc(ledgerMonth) + '"></label><button type="button" class="btn secondary" id="ledgerAll">전체 기간</button><label>분류<select id="ledgerCategory"><option value="">모든 분류</option>' + ledgerOptions(ledgerCategory) + '</select></label><label>수입·지출<select id="ledgerDirection"><option value="">모두</option><option value="income"' + (ledgerDirection === 'income' ? ' selected' : '') + '>수입 · 판매</option><option value="expense"' + (ledgerDirection === 'expense' ? ' selected' : '') + '>지출 · 구매</option></select></label></div></div>' +
    '<div class="grid cols-3 ledger-summary"><div class="card stat-card"><div class="stat-label">선택 기간 수입</div><div class="stat-value ledger-income">' + won(sums.income) + '</div></div><div class="card stat-card"><div class="stat-label">선택 기간 지출</div><div class="stat-value ledger-expense">' + won(sums.expense) + '</div></div><div class="card stat-card"><div class="stat-label">차액 (수입 − 지출)</div><div class="stat-value">' + won(sums.balance) + '</div></div></div>' +
    '<div class="card"><div class="section-head ledger-list-head"><div><h2>거래 내역</h2><p>' + rows.length + '건 · 금액은 원화 기준입니다.</p></div><button type="button" class="btn secondary small" id="ledgerCsv">현재 내역 CSV 내려받기</button></div>' +
    (rows.length ? '<div class="table-wrap"><table><thead><tr><th>날짜</th><th>구분</th><th>분류</th><th>품목 · 개체</th><th>금액</th><th>메모</th><th>관리</th></tr></thead><tbody>' +
      [...rows].sort((a, b) => b.date.localeCompare(a.date)).map(r => '<tr><td>' + esc(r.date) + '</td><td><span class="badge ' + (r.direction === 'income' ? 'female' : 'unknown') + '">' + (r.direction === 'income' ? '수입' : '지출') + '</span></td><td>' + esc(CrestieFeatures.categories[r.category] || '기타') + '</td><td class="name-cell"><b>' + esc(r.item) + '</b><span>' + esc(r.geckoName || '') + '</span></td><td class="' + (r.direction === 'income' ? 'ledger-income' : 'ledger-expense') + '">' + won(r.amount) + '</td><td class="ledger-memo">' + esc(r.note || '') + '</td><td><div class="actions"><button type="button" class="btn secondary small" data-ledger-edit="' + esc(r.id) + '">수정</button><button type="button" class="btn ghost small" data-ledger-delete="' + esc(r.id) + '">삭제</button></div></td></tr>').join('') + '</tbody></table></div>' :
      emptyHtml('이 기간의 거래 기록이 없습니다.', '거래 기록을 추가하거나 조회 기간을 바꿔 보세요.')) + '</div>';
  document.getElementById('addLedger').onclick = () => openLedgerDialog();
  document.getElementById('ledgerMonth').onchange = e => { ledgerMonth = e.target.value; renderLedger(); };
  document.getElementById('ledgerAll').onclick = () => { ledgerMonth = ''; renderLedger(); };
  document.getElementById('ledgerCategory').onchange = e => { ledgerCategory = e.target.value; renderLedger(); };
  document.getElementById('ledgerDirection').onchange = e => { ledgerDirection = e.target.value; renderLedger(); };
  el.querySelectorAll('[data-ledger-edit]').forEach(b => b.onclick = () => openLedgerDialog(b.dataset.ledgerEdit));
  el.querySelectorAll('[data-ledger-delete]').forEach(b => b.onclick = () => {
    if (!confirm('이 거래 기록을 삭제할까요? 다른 기기에도 반영됩니다.')) return;
    state.ledger = state.ledger.filter(r => r.id !== b.dataset.ledgerDelete); saveState(); renderLedger();
  });
  document.getElementById('ledgerCsv').onclick = () => {
    const quote = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
    const records = [['날짜', '구분', '분류', '품목', '개체', '금액(원)', '메모'], ...rows.map(r => [r.date, r.direction === 'income' ? '수입' : '지출', CrestieFeatures.categories[r.category], r.item, r.geckoName, r.amount, r.note])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + records.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'crestie-ledger-' + (ledgerMonth || 'all') + '.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
function openLedgerDialog(id = '') {
  let dialog = document.getElementById('ledgerDialog');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id = 'ledgerDialog'; dialog.className = 'modal';
    dialog.innerHTML = '<form id="ledgerForm" class="modal-card small"><div class="modal-head"><h2 id="ledgerDialogTitle">거래 기록</h2><button type="button" class="icon-btn" aria-label="가계부 닫기" id="closeLedger">×</button></div><input type="hidden" id="ledgerId"><div class="form-grid two"><label>날짜<input id="entryDate" type="date" required></label><label>수입·지출<select id="entryDirection"><option value="expense">지출 · 구매</option><option value="income">수입 · 판매</option></select></label><label>분류<select id="entryCategory">' + ledgerOptions('equipment') + '</select></label><label>총 금액 (원)<input id="entryAmount" type="number" min="1" max="1000000000000" step="1" inputmode="numeric" required placeholder="예: 35000"></label></div><label>품목 · 거래 내용<input id="entryItem" required maxlength="160" placeholder="예: 사육장 구매 / 크레 분양"></label><label>관련 크레 (선택)<select id="entryGecko"></select></label><label>메모<textarea id="entryNote" rows="3" maxlength="2000" placeholder="거래 관련 메모"></textarea></label><p class="muted">이 가계부는 공개 GitHub 저장소에 저장됩니다. 연락처·계좌번호 등은 적지 마세요.</p><div class="modal-actions"><button type="button" class="btn secondary" id="cancelLedger">취소</button><button type="submit" class="btn primary">가계부 저장</button></div></form>';
    document.body.append(dialog);
    document.getElementById('closeLedger').onclick = document.getElementById('cancelLedger').onclick = () => dialog.close();
    document.getElementById('ledgerForm').onsubmit = event => {
      event.preventDefault();
      const amount = Number(document.getElementById('entryAmount').value), item = document.getElementById('entryItem').value.trim(), date = document.getElementById('entryDate').value;
      if (!item || !date || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000000) return;
      const entryId = document.getElementById('ledgerId').value, geckoId = document.getElementById('entryGecko').value;
      const previous = state.ledger.find(r => r.id === entryId);
      const record = { id: entryId || uid(), date, amount, item, direction: document.getElementById('entryDirection').value, category: document.getElementById('entryCategory').value, geckoId, geckoName: getGecko(geckoId)?.name || (geckoId === previous?.geckoId ? previous?.geckoName : '') || '', note: document.getElementById('entryNote').value.trim() };
      if (previous) Object.assign(previous, record); else state.ledger.push(record);
      saveState(); dialog.close(); ledgerMonth = date.slice(0, 7); ledgerCategory = ''; ledgerDirection = ''; renderLedger();
    };
  }
  const r = state.ledger.find(x => x.id === id);
  document.getElementById('ledgerDialogTitle').textContent = r ? '거래 기록 수정' : '거래 기록 추가';
  document.getElementById('ledgerId').value = r?.id || '';
  const now = new Date();
  document.getElementById('entryDate').value = r?.date || now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  document.getElementById('entryDirection').value = r?.direction || 'expense';
  document.getElementById('entryCategory').value = r?.category || 'equipment';
  document.getElementById('entryAmount').value = r?.amount ?? '';
  document.getElementById('entryItem').value = r?.item || '';
  document.getElementById('entryNote').value = r?.note || '';
  const select = document.getElementById('entryGecko');
  select.innerHTML = '<option value="">관련 개체 없음</option>' + state.geckos.map(g => '<option value="' + esc(g.id) + '">' + esc(g.name) + '</option>').join('') + (r?.geckoId && !getGecko(r.geckoId) ? '<option value="' + esc(r.geckoId) + '">' + esc(r.geckoName || '기존 개체') + ' (현재 목록에 없음)</option>' : '');
  select.value = r?.geckoId || '';
  dialog.showModal();
}
