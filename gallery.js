(() => {
  let api, schedule, pending = [], removed = new Set(), jobs = 0, queue = Promise.resolve(), failures = [];
  let active = [], activeIndex = 0, zoom = 1, viewer;
  const photosFor = gecko => CrestieFeatures.photosFor(state, gecko);
  function clearPending() { pending.forEach(p => URL.revokeObjectURL(p.url)); pending = []; removed.clear(); }
  function showPhotos(photos, index = 0) {
    if (!photos.length) return;
    active = photos; activeIndex = index; zoom = 1;
    if (!viewer) {
      viewer = document.createElement('dialog'); viewer.className = 'photo-viewer'; viewer.id = 'photoViewer';
      viewer.innerHTML = '<div class="viewer-head"><strong id="viewerCount"></strong><button type="button" class="btn secondary" data-action="close" aria-label="확대 사진 닫기">닫기 ×</button></div><div class="viewer-stage"><img id="viewerImage" alt="확대 사진"></div><div class="viewer-controls"><button type="button" class="btn secondary" data-action="prev" aria-label="이전 사진">← 이전</button><button type="button" class="btn secondary" data-action="out" aria-label="사진 축소">−</button><button type="button" class="btn secondary" data-action="reset">100%</button><button type="button" class="btn secondary" data-action="in" aria-label="사진 확대">＋</button><button type="button" class="btn secondary" data-action="next" aria-label="다음 사진">다음 →</button></div>';
      viewer.onclick = e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'close') viewer.close();
        if (action === 'prev' || action === 'next') { activeIndex = (activeIndex + (action === 'prev' ? -1 : 1) + active.length) % active.length; zoom = 1; }
        if (action === 'in') zoom = Math.min(4, zoom + .5);
        if (action === 'out') zoom = Math.max(1, zoom - .5);
        if (action === 'reset') zoom = 1;
        if (action) drawViewer();
      };
      viewer.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault(); activeIndex = (activeIndex + (e.key === 'ArrowLeft' ? -1 : 1) + active.length) % active.length; zoom = 1; drawViewer();
        }
      });
      document.body.append(viewer);
    }
    drawViewer(); if (!viewer.open) viewer.showModal();
  }
  function drawViewer() {
    const img = viewer.querySelector('img'); img.src = active[activeIndex].url;
    img.style.width = zoom === 1 ? '' : (zoom * 100) + '%';
    img.style.maxWidth = zoom === 1 ? '100%' : 'none'; img.style.maxHeight = zoom === 1 ? '65vh' : 'none';
    document.getElementById('viewerCount').textContent = '사진 ' + (activeIndex + 1) + ' / ' + active.length;
    viewer.querySelector('[data-action="reset"]').textContent = Math.round(zoom * 100) + '%';
    viewer.querySelector('[data-action="prev"]').disabled = active.length < 2;
    viewer.querySelector('[data-action="next"]').disabled = active.length < 2;
  }
  function tile(photo, index, all, remove) {
    const wrap = document.createElement('div'); wrap.className = 'gallery-tile';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'photo-open'; button.setAttribute('aria-label', '사진 ' + (index + 1) + ' 확대');
    const img = document.createElement('img'); img.src = photo.url; img.alt = '개체 사진 ' + (index + 1); button.append(img);
    button.onclick = () => showPhotos(all, index); wrap.append(button);
    if (remove) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost small'; b.textContent = '사진 빼기'; b.onclick = remove; wrap.append(b); }
    return wrap;
  }
  function drawEditor() {
    const box = document.getElementById('geckoPhotoGallery'); if (!box) return;
    box.replaceChildren();
    const g = getGecko(document.getElementById('geckoId').value);
    const saved = photosFor(g).filter(p => !removed.has(p.id));
    const all = [...saved, ...pending];
    all.forEach((p, i) => box.append(tile(p, i, all, () => {
      if (p.file) { URL.revokeObjectURL(p.url); pending = pending.filter(q => q !== p); }
      else removed.add(p.id);
      drawEditor();
    })));
    if (!all.length) box.textContent = '아직 사진이 없습니다. 여러 장을 한 번에 선택할 수 있어요.';
    document.getElementById('photoSelectionCount').textContent = '저장된 사진 ' + saved.length + '장 · 추가할 사진 ' + pending.length + '장';
  }
  async function compress(file) {
    const bitmap = await createImageBitmap(file), scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
    if (!blob) throw new Error('사진을 변환하지 못했습니다.');
    return blob;
  }
  function notice() {
    let el = document.getElementById('photoUploadNotice');
    if (!el) { el = document.createElement('div'); el.id = 'photoUploadNotice'; el.className = 'notice'; el.setAttribute('role', 'status'); document.querySelector('.topbar').after(el); }
    el.replaceChildren(); el.hidden = !jobs && !failures.length;
    if (jobs) el.textContent = '사진을 저장하고 있습니다. 완료될 때까지 이 화면을 열어 두세요.';
    else if (failures.length) {
      el.textContent = failures.length + '장의 사진을 저장하지 못했습니다. ';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn secondary small'; b.textContent = '실패한 사진 다시 저장';
      b.onclick = () => { const retry = failures; failures = []; enqueue(retry); }; el.append(b);
    }
  }
  function enqueue(items) {
    jobs++; notice();
    queue = queue.then(async () => {
      for (const item of items) {
        if (!getGecko(item.geckoId)) continue;
        try {
          const blob = await compress(item.file);
          const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(blob); });
          const uploaded = await api('/api/photo', { method: 'POST', body: JSON.stringify({ geckoId: item.geckoId, contentBase64: base64 }) });
          if (!getGecko(item.geckoId)) continue;
          state.photos.push({ id: uid(), geckoId: item.geckoId, url: uploaded.url, path: uploaded.path, addedAt: new Date().toISOString() });
          saveState();
        } catch (e) { failures.push(item); console.warn('Photo upload failed:', e.message); }
      }
    }).finally(() => { jobs--; notice(); decorate(); schedule(0); });
  }
  function decorate() {
    document.querySelectorAll('#view-geckos tbody tr').forEach(row => {
      const id = row.querySelector('[data-edit]')?.dataset.edit, g = getGecko(id);
      if (!g) return;
      const cell = row.querySelector('td'), photos = photosFor(g);
      const signature = photos.map(p => p.id + p.url).join('|');
      if (cell.dataset.gallery === signature) return;
      cell.dataset.gallery = signature;
      cell.querySelector('.gallery-cover')?.remove();
      if (!photos.length) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'gallery-cover'; b.setAttribute('aria-label', g.name + ' 사진 ' + photos.length + '장 보기');
      const img = document.createElement('img'); img.src = photos[0].url; img.alt = g.name; b.append(img);
      const count = document.createElement('span'); count.textContent = photos.length + '장'; b.append(count);
      b.onclick = () => showPhotos(photos); cell.prepend(b);
    });
  }
  function init(options) {
    api = options.api; schedule = options.schedule;
    const box = document.createElement('section'); box.className = 'photo-editor';
    box.innerHTML = '<h3>개체 사진첩</h3><p>사진을 여러 장 선택한 뒤 저장하세요. 사진을 누르면 크게 볼 수 있습니다.</p><label class="btn secondary photo-pick">＋ 사진 추가<input id="geckoPhoto" type="file" accept="image/*" multiple></label><p id="photoSelectionCount"></p><div id="geckoPhotoGallery" class="photo-gallery"></div>';
    document.getElementById('geckoNotes').closest('label').before(box);
    const input = document.getElementById('geckoPhoto');
    input.onchange = () => {
      for (const file of input.files || []) {
        if (file.type && !file.type.startsWith('image/')) continue;
        pending.push({ file, url: URL.createObjectURL(file), id: uid() });
      }
      input.value = ''; drawEditor();
    };
    const dialog = document.getElementById('geckoDialog');
    new MutationObserver(() => { if (dialog.open) { clearPending(); input.value = ''; drawEditor(); } }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    const button = document.getElementById('saveGeckoBtn'), original = button.onclick;
    button.onclick = event => {
      const selected = [...pending], deleted = new Set(removed), ids = new Set(state.geckos.map(g => g.id)), id = document.getElementById('geckoId').value;
      original.call(button, event); if (dialog.open) return;
      const g = id ? getGecko(id) : state.geckos.find(g => !ids.has(g.id)); if (!g) return;
      if (deleted.has('legacy-' + g.id)) { g.photoUrl = ''; g.photoPath = ''; }
      state.photos = state.photos.filter(p => !deleted.has(p.id)); saveState();
      if (selected.length) enqueue(selected.map(p => ({ file: p.file, geckoId: g.id })));
      clearPending(); decorate();
    };
  }
  globalThis.CrestiePhotos = { init, decorate, photosFor, showPhotos, get busy() { return jobs > 0; }, get unsaved() { return jobs > 0 || failures.length > 0; } };
})();
