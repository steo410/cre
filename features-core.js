(() => {
  const categories = { gecko: '크레 거래', enclosure: '사육장', equipment: '사육용품', food: '먹이·영양제', medical: '진료·관리', other: '기타' };
  function safePhoto(url) {
    return typeof url === 'string' && (/^https?:\/\//i.test(url) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url));
  }
  function photosFor(state, gecko) {
    if (!gecko) return [];
    const photos = (state.photos || []).filter(p => p.geckoId === gecko.id && safePhoto(p.url));
    if (safePhoto(gecko.photoUrl) && !photos.some(p => p.url === gecko.photoUrl)) {
      return [{ id: 'legacy-' + gecko.id, geckoId: gecko.id, url: gecko.photoUrl, legacy: true }, ...photos];
    }
    return photos;
  }
  function ledgerRows(rows, filter = {}) {
    return rows.filter(r => (!filter.month || r.date?.startsWith(filter.month)) && (!filter.category || r.category === filter.category) && (!filter.direction || r.direction === filter.direction));
  }
  function totals(rows) {
    return rows.reduce((a, r) => {
      if (r.direction === 'income') a.income += r.amount;
      else if (r.direction === 'expense') a.expense += r.amount;
      a.balance = a.income - a.expense;
      return a;
    }, { income: 0, expense: 0, balance: 0 });
  }
  globalThis.CrestieFeatures = { categories, safePhoto, photosFor, ledgerRows, totals };
})();
