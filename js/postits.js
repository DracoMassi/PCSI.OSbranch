// postits.js : mur d'erreurs, types d'erreurs

function mountPostitFilters() {
  mountCustomSelect('postit-subj-filter-mount', 'postit-filter-subj', getSubjectOptions('Toutes matières'), state.postitSubjFilter, val => { state.postitSubjFilter = val; renderPostits(); });
  mountCustomSelect('postit-type-filter-mount', 'postit-filter-type', [{ value: 'all', label: 'Tous types' }].concat(state.errorTypes.map(et => ({ value: et.id, label: `${et.icon} ${et.label}` }))), state.postitTypeFilter, val => { state.postitTypeFilter = val; renderPostits(); });
}

function renderPostits() {
  mountPostitFilters();
  const wall = document.getElementById('postit-wall');
  const filtered = state.postits.filter(p => (state.postitSubjFilter === 'all' || p.subject === state.postitSubjFilter) && (state.postitTypeFilter === 'all' || p.errType === state.postitTypeFilter));
  if (filtered.length === 0) {
    wall.innerHTML = `<div class="saas-card" style="grid-column:1/-1; padding:40px; text-align:center; color:var(--text-muted);">Aucun post-it trouvé.</div>`;
    return;
  }
  wall.innerHTML = filtered.map(p => {
    const s = getSubject(p.subject);
    const et = state.errorTypes.find(x => x.id === p.errType) || { icon: '⚠️', label: 'Piège' };
    const tilt = typeof p.rot === 'number' ? p.rot : -2.8;
    return `<div class="postit ${p.color || 'postit-yellow'}" draggable="true" ondragstart="window.onPostitDragStart(event, '${p.id}')" ondragover="window.onPostitDragOver(event)" ondragleave="window.onPostitDragLeave(event)" ondrop="window.onPostitDrop(event, '${p.id}')" ondragend="window.onPostitDragEnd(event)" style="transform: rotate(${tilt}deg);">
      <div class="postit-tape"></div><div><div style="display:flex; justify-content:space-between; align-items:center; font-size:10.5px; font-weight:700; border-bottom:1px solid rgba(0,0,0,0.14); padding-bottom:5px; margin-bottom:9px;"><span style="display:flex; align-items:center; gap:5px;"><span class="subj-dot" style="background:${s.color};"></span>${escapeHtml(s.short)}</span><span>${escapeHtml(p.source || 'DS / Colle')}</span></div>
      <div style="font-size:11px; font-weight:700; opacity:0.8; margin-bottom:6px;">${et.icon} ${escapeHtml(et.label)}</div><div class="handwriting" style="font-size:19px; line-height:1.22;">${escapeHtml(p.text)}</div>
      ${p.imageData ? `<img src="${p.imageData}" style="width:100%; border-radius:6px; margin-top:10px; border:1px solid rgba(0,0,0,0.1); opacity:0.85;" draggable="false" />` : ''}
      </div><div style="display:flex; justify-content:flex-end; gap:5px; margin-top:12px;"><button type="button" onclick="window.openPostitModal('${p.id}')" style="background:rgba(0,0,0,0.12); border:none; border-radius:5px; width:24px; height:24px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;"><i class="ph ph-pencil-simple"></i></button><button type="button" onclick="window.deletePostit('${p.id}')" style="background:rgba(0,0,0,0.12); border:none; border-radius:5px; width:24px; height:24px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;"><i class="ph ph-trash"></i></button></div></div>`;
  }).join('');
}

let draggedPostitId = null;
window.onPostitDragStart = function(e, id) { draggedPostitId = id; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; };
window.onPostitDragOver = function(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over-note'); };
window.onPostitDragLeave = function(e) { e.currentTarget.classList.remove('drag-over-note'); };
window.onPostitDragEnd = function(e) { e.currentTarget.classList.remove('dragging'); document.querySelectorAll('.postit').forEach(el => el.classList.remove('drag-over-note')); };
window.onPostitDrop = function(e, targetId) { e.preventDefault(); e.currentTarget.classList.remove('drag-over-note'); if (!draggedPostitId || draggedPostitId === targetId) return; const fromIdx = state.postits.findIndex(p => p.id === draggedPostitId), toIdx = state.postits.findIndex(p => p.id === targetId); if (fromIdx > -1 && toIdx > -1) { const [moved] = state.postits.splice(fromIdx, 1); state.postits.splice(toIdx, 0, moved); saveState(); renderPostits(); } draggedPostitId = null; };

window.openPostitModal = function(id) {
  const p = id ? state.postits.find(x => x.id === id) : null;
  document.getElementById('postit-modal-title').textContent = p ? 'Modifier le Post-it' : 'Nouveau Post-it d\'Erreur';
  document.getElementById('p-id').value = p ? p.id : '';
  document.getElementById('p-source').value = p ? (p.source || '') : '';
  document.getElementById('p-text').value = p ? p.text : '';
  const defaultSubj = p && SUBJECTS[p.subject] ? p.subject : (Object.keys(SUBJECTS)[0] || 'maths');
  mountCustomSelect('p-subject-mount', 'p-subj', getSubjectOptions(), defaultSubj);
  mountCustomSelect('p-errtype-mount', 'p-errtype', state.errorTypes.map(et => ({ value: et.id, label: `${et.icon} ${et.label}` })), p && p.errType ? p.errType : (state.errorTypes[0]?.id || 'et_calc'));
  mountCustomSelect('p-color-mount', 'p-color', [
    { value: 'postit-yellow', label: 'Jaune Pastel', dot: '#FEF08A' },
    { value: 'postit-cyan', label: 'Bleu Glace', dot: '#BAE6FD' },
    { value: 'postit-pink', label: 'Rose Poudré', dot: '#FBCFE8' },
    { value: 'postit-mint', label: 'Vert Menthe', dot: '#A7F3D0' },
    { value: 'postit-purple', label: 'Lavande', dot: '#E9D5FF' }
  ], p ? p.color : 'postit-yellow');
  window.clearCanvas();
  if (p && p.imageData && ctx) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = p.imageData; }
  document.getElementById('postit-modal').classList.add('open');
  if (typeof window.focusModalInput === 'function') window.focusModalInput('p-text');
};
window.closePostitModal = function() { document.getElementById('postit-modal').classList.remove('open'); };
window.savePostitForm = function(e) {
  e.preventDefault();
  const id = document.getElementById('p-id').value;
  const subject = customSelectValues['p-subj'] || Object.keys(SUBJECTS)[0] || 'maths';
  const errType = customSelectValues['p-errtype'] || 'et_calc';
  const color = customSelectValues['p-color'] || 'postit-yellow';
  const source = document.getElementById('p-source').value.trim() || 'DS';
  const text = document.getElementById('p-text').value.trim();
  const blank = document.createElement('canvas'); blank.width = canvas.width; blank.height = canvas.height;
  let imageData = null;
  if (canvas && canvas.toDataURL() !== blank.toDataURL()) imageData = canvas.toDataURL();
  if (id) {
    const existing = state.postits.find(x => x.id === id);
    if (existing) Object.assign(existing, { subject, errType, color, source, text, imageData });
    showToast('Post-it modifié');
  } else {
    const sign = Math.random() > 0.5 ? 1 : -1, rot = Number((sign * (2.2 + Math.random() * 2.3)).toFixed(2));
    state.postits.unshift({ id: 'p_' + Date.now(), subject, errType, color, source, text, rot, imageData });
    showToast('Post-it épinglé');
  }
  saveState(); closePostitModal(); renderPostits();
};
window.deletePostit = function(id) { state.postits = state.postits.filter(x => x.id !== id); saveState(); renderPostits(); showToast('Post-it retiré'); };
window.openErrorTypesModal = function() { renderErrorTypesList(); document.getElementById('errtypes-modal').classList.add('open'); if (typeof window.focusModalInput === 'function') window.focusModalInput('et-label'); };
window.closeErrorTypesModal = function() { document.getElementById('errtypes-modal').classList.remove('open'); };
function renderErrorTypesList() { const box = document.getElementById('errtypes-list'); box.innerHTML = state.errorTypes.map(et => `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle);"><span style="font-size:13px;">${escapeHtml(et.icon)} <strong>${escapeHtml(et.label)}</strong></span><button type="button" onclick="window.deleteErrorType('${et.id}')" class="btn-ghost" style="padding:4px 7px; color:#F87171; border:none;"><i class="ph ph-trash"></i></button></div>`).join(''); }
window.addCustomErrorType = function(e) { e.preventDefault(); const icon = document.getElementById('et-icon').value.trim() || '⚠️', label = document.getElementById('et-label').value.trim(); if (!label) return; state.errorTypes.push({ id: 'et_' + Date.now(), icon, label }); document.getElementById('et-label').value = ''; saveState(); renderErrorTypesList(); renderPostits(); showToast('Catégorie ajoutée'); };
window.deleteErrorType = function(id) { if (state.errorTypes.length <= 1) { showToast('Garde au moins une catégorie'); return; } state.errorTypes = state.errorTypes.filter(x => x.id !== id); saveState(); renderErrorTypesList(); renderPostits(); };
