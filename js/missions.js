// missions.js : pression, liste, kanban, modale mission

const WORK_H_PER_DAY = 2.5, LOAD_GAIN = 1.2, URGENCY_MAX = 0.5, URGENCY_DECAY = 3;
function pressureColor(pct) { return `hsl(${(120 * (1 - pct / 100)).toFixed(0)}, 82%, 52%)`; }
function computePressure(task) {
  if (task.status === 'done') return { score: 0, pct: 100, pctLabel: '', badge: 'TERMINÉ', color: '#10B981', urgent: false, dayLabel: 'Validé' };
  const dur = parseFloat(task.duration) || 1; let diffDays = 7, dayLabel = `${dur}h`;
  if (task.dueDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0); const due = new Date(task.dueDate + 'T00:00:00'); diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return { score: 200 + Math.abs(diffDays) * 10, pct: 100, pctLabel: '100%', badge: 'RETARD', color: pressureColor(100), urgent: true, dayLabel: `Retard ${Math.abs(diffDays)}j` };
    dayLabel = diffDays === 0 ? "Aujourd'hui" : diffDays === 1 ? 'Demain' : `J-${diffDays}`;
  }
  const pct = Math.min(100, Math.round(100 * (1 - (1 - (1 - Math.exp(-LOAD_GAIN * (dur / (WORK_H_PER_DAY * Math.max(diffDays, 0.5)))))) * (1 - URGENCY_MAX * Math.exp(-diffDays / URGENCY_DECAY)))));
  return { score: pct, pct, pctLabel: pct + '%', badge: !task.dueDate ? 'PLANIFIÉ' : pct >= 75 ? 'CRITIQUE' : pct >= 50 ? 'TENDU' : pct >= 25 ? 'MODÉRÉ' : 'ANTICIPÉ', color: pressureColor(pct), urgent: pct >= 60, dayLabel };
}

window.setCahierMode = function(m) { state.cahierMode = m; saveState(); renderCahier(); }; window.setCahierFilter = function(s) { state.cahierSubjFilter = s; saveState(); renderCahier(); };
window.quickAddMission = function(e) {
  e.preventDefault(); const t = document.getElementById('qa-title').value.trim(); if (!t) return;
  state.tasks.unshift({ id: 't_' + Date.now(), title: t, note: '', subject: customSelectValues['qa-subj'] || 'maths', status: 'todo', duration: parseFloat(document.getElementById('qa-duration').value) || 1.5, dueDate: document.getElementById('qa-duedate').value || getOffsetDateISO(2), createdAt: Date.now() });
  document.getElementById('qa-title').value = ''; saveState(); renderCahier(); showToast('Mission ajoutée');
};

function renderCahier() {
  const active = state.tasks.filter(t => t.status !== 'done'), done = state.tasks.filter(t => t.status === 'done'), total = state.tasks.length;
  let uCount = 0, h = 0; active.forEach(t => { h += parseFloat(t.duration) || 0; if (computePressure(t).urgent) uCount++; });
  document.getElementById('kpi-urgent').textContent = uCount; document.getElementById('kpi-hours').textContent = `${h % 1 === 0 ? h : h.toFixed(1)}h`; document.getElementById('kpi-ratio').textContent = total === 0 ? '0%' : `${Math.round((done.length / total) * 100)}%`; document.getElementById('kpi-ratio-sub').textContent = `${done.length}/${total} validées`;
  const pillsBox = document.getElementById('subject-filters'); let pillsHtml = `<button type="button" onclick="window.setCahierFilter('all')" class="btn-ghost ${state.cahierSubjFilter === 'all' ? 'active-pill' : ''}">Toutes (${active.length})</button>`;
  Object.values(SUBJECTS).forEach(s => { const c = active.filter(t => t.subject === s.id).length; pillsHtml += `<button type="button" onclick="window.setCahierFilter('${s.id}')" class="btn-ghost ${state.cahierSubjFilter === s.id ? 'active-pill' : ''}"><span class="subj-dot" style="background:${s.color};"></span>${s.name} (${c})</button>`; });
  pillsBox.innerHTML = pillsHtml; document.getElementById('mode-table-btn').classList.toggle('active-pill', state.cahierMode === 'table'); document.getElementById('mode-kanban-btn').classList.toggle('active-pill', state.cahierMode === 'kanban');
  const filtered = state.tasks.filter(t => state.cahierSubjFilter === 'all' || t.subject === state.cahierSubjFilter).slice().sort((a, b) => computePressure(b).score - computePressure(a).score);
  const area = document.getElementById('tasks-render-area');
  if (state.cahierMode === 'table') {
    if (filtered.length === 0) { area.innerHTML = `<div class="saas-card" style="padding:40px; text-align:center; color:var(--text-muted);">Aucune mission trouvée.</div>`; return; }
    const sL = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
    area.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">` + filtered.map(t => {
      const s = SUBJECTS[t.subject] || SUBJECTS.physique; const p = computePressure(t); const isDone = t.status === 'done';
      return `<div class="saas-card task-row" onclick="window.toggleTask('${t.id}')" style="display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-left:3px solid ${s.color}; gap:12px; ${isDone?'opacity:0.4;':''}">
        <div style="display:flex; align-items:center; gap:14px; flex:1;"><div class="custom-check ${isDone?'checked':''}">${isDone?'<i class="ph-bold ph-check text-xs"></i>':''}</div><div><div style="font-weight:600; font-size:14px; ${isDone?'text-decoration:line-through; color:var(--text-subtle);':''}">${escapeHtml(t.title)}</div>${t.note ? `<div style="font-size:12.5px; color:var(--text-muted); margin-top:3px;">${escapeHtml(t.note)}</div>` : ''}</div></div>
        <div class="task-right" style="display:flex; align-items:center; gap:12px;"><span class="subj-badge"><span class="subj-dot" style="background:${s.color};"></span>${s.short}</span>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; min-width:105px;"><div style="display:flex; align-items:center; gap:6px; font-size:11px;" class="mono"><span style="color:${p.color}; font-weight:700;">${p.pctLabel ? p.pctLabel + ' · ' : ''}${p.badge}</span><span style="color:var(--text-muted);">${p.dayLabel}${t.duration ? ` · ${t.duration}h` : ''}</span></div><div class="pressure-track"><div class="pressure-fill" style="width:${p.pct}%; background:${p.color};"></div></div></div>
          <button type="button" onclick="event.stopPropagation(); window.cycleStatus('${t.id}')" class="btn-ghost" style="padding:5px 9px; font-size:11.5px;">${sL[t.status] || 'À faire'}</button><button type="button" onclick="event.stopPropagation(); window.openMissionModal('${t.id}')" class="btn-ghost" style="padding:6px 10px;" title="Modifier"><i class="ph ph-pencil-simple"></i></button><button type="button" onclick="event.stopPropagation(); window.deleteTask('${t.id}')" class="btn-ghost" style="padding:6px 10px; color:#F87171;" title="Supprimer"><i class="ph ph-trash"></i></button>
        </div></div>`;
    }).join('') + `</div>`;
  } else {
    const cols = [{ key: 'todo', label: 'À faire' }, { key: 'in_progress', label: 'En cours' }, { key: 'done', label: 'Terminé' }];
    area.innerHTML = `<div id="kanban-board" class="kanban-board">` + cols.map(c => {
      const cT = filtered.filter(t => t.status === c.key); const acc = { todo: '#94A3B8', in_progress: '#F59E0B', done: '#10B981' }[c.key];
      return `<div class="saas-card kanban-col" data-status="${c.key}" ondragover="window.onKanbanDragOver(event)" ondragleave="window.onKanbanDragLeave(event)" ondrop="window.onKanbanDrop(event, '${c.key}')"><div class="k-colhead" style="--accent:${acc};"><span class="k-coltitle"><i class="k-coldot"></i>${c.label}</span><span class="k-count mono">${cT.length}</span></div><div class="k-list">
          ${cT.length === 0 ? `<div class="k-empty">Glisser une mission ici</div>` : ''}
          ${cT.map(t => {
            const s = SUBJECTS[t.subject] || SUBJECTS.physique; const p = computePressure(t);
            return `<div class="saas-card kanban-card" draggable="true" ondragstart="window.onKanbanDragStart(event, '${t.id}')" ondragend="window.onKanbanDragEnd(event)" style="border-left:3px solid ${s.color};"><div class="k-head"><div class="k-head-l"><span class="k-handle" onpointerdown="window.kPointerDown(event, '${t.id}')"><i class="ph-bold ph-dots-six-vertical"></i></span><span class="subj-badge"><span class="subj-dot" style="background:${s.color};"></span>${s.short}</span></div><div class="k-actions"><button type="button" onclick="window.cycleStatus('${t.id}')" class="k-btn"><i class="ph ph-arrow-right"></i></button><button type="button" onclick="window.openMissionModal('${t.id}')" class="k-btn"><i class="ph ph-pencil-simple"></i></button><button type="button" onclick="window.deleteTask('${t.id}')" class="k-btn k-del"><i class="ph ph-trash"></i></button></div></div><div class="k-title">${escapeHtml(t.title)}</div>${t.note ? `<div class="k-note">${escapeHtml(t.note)}</div>` : ''}<div class="k-foot"><div class="mono k-due" style="color:${p.color};">${p.pctLabel ? p.pctLabel + ' · ' : ''}${p.badge} · ${p.dayLabel}${t.duration ? ' · ' + t.duration + 'h' : ''}</div><div class="pressure-track"><div class="pressure-fill" style="width:${p.pct}%; background:${p.color};"></div></div></div></div>`;
          }).join('')}</div></div>`;
    }).join('') + `</div>`;
  }
}
let draggedTaskId = null; window.onKanbanDragStart = function(e, id) { draggedTaskId = id; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; };
window.onKanbanDragEnd = function(e) { e.currentTarget.classList.remove('dragging'); document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over')); };
window.onKanbanDragOver = function(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }; window.onKanbanDragLeave = function(e) { e.currentTarget.classList.remove('drag-over'); };
function moveTaskTo(id, st) { const t = state.tasks.find(x => x.id === id); if (t && t.status !== st) { t.status = st; saveState(); renderCahier(); } }
window.onKanbanDrop = function(e, st) { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); if (draggedTaskId) moveTaskTo(draggedTaskId, st); draggedTaskId = null; };
let kd = null; window.kPointerDown = function(e, id) { if(kd) return; e.preventDefault(); e.stopPropagation(); const card = e.currentTarget.closest('.kanban-card'); if(!card) return; const r = card.getBoundingClientRect(); const ghost = card.cloneNode(true); ghost.style.cssText = `position:fixed; left:${r.left}px; top:${r.top}px; width:${r.width}px; z-index:400; pointer-events:none; opacity:0.95; transform:scale(1.03) rotate(1.5deg); box-shadow:0 18px 40px rgba(0,0,0,0.7); background:#1a1d27;`; document.body.appendChild(ghost); card.classList.add('dragging'); document.body.classList.add('k-dragging'); kd = { id, card, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, col: null, raf: 0 }; document.addEventListener('pointermove', kMove, { passive: false }); document.addEventListener('pointerup', kUp); document.addEventListener('pointercancel', kCancel); kd.raf = requestAnimationFrame(kTick); };
function kColAt(x, y) { const el = document.elementFromPoint(x, y); return el ? el.closest('.kanban-col') : null; }
function kMove(e) { if(!kd) return; e.preventDefault(); kd.x = e.clientX; kd.y = e.clientY; kd.ghost.style.left = (kd.x - kd.dx) + 'px'; kd.ghost.style.top = (kd.y - kd.dy) + 'px'; const col = kColAt(kd.x, kd.y); document.querySelectorAll('.kanban-col').forEach(c => c.classList.toggle('drag-over', c === col)); kd.col = col; }
function kTick() { if(!kd) return; const b = document.getElementById('kanban-board'); if(b) { if(kd.x < 56) b.scrollLeft -= 14; else if(kd.x > window.innerWidth - 56) b.scrollLeft += 14; } if(kd.y < 90) window.scrollBy(0, -12); else if(kd.y > window.innerHeight - 120) window.scrollBy(0, 12); kd.raf = requestAnimationFrame(kTick); }
function kCleanup() { if(!kd) return; cancelAnimationFrame(kd.raf); kd.ghost.remove(); kd.card.classList.remove('dragging'); document.body.classList.remove('k-dragging'); document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drag-over')); document.removeEventListener('pointermove', kMove); document.removeEventListener('pointerup', kUp); document.removeEventListener('pointercancel', kCancel); }
function kUp(e) { if(!kd) return; const col = kColAt(e.clientX, e.clientY) || kd.col; const id = kd.id; kCleanup(); kd = null; if(col) moveTaskTo(id, col.dataset.status); }
function kCancel() { kCleanup(); kd = null; }
window.toggleTask = function(id) { const t = state.tasks.find(x => x.id === id); if(t) { t.status = t.status === 'done' ? 'todo' : 'done'; saveState(); renderCahier(); } };
window.cycleStatus = function(id) { const t = state.tasks.find(x => x.id === id); if(t) { const order = ['todo', 'in_progress', 'done']; t.status = order[(order.indexOf(t.status) + 1) % 3]; saveState(); renderCahier(); } };
window.deleteTask = function(id) { state.tasks = state.tasks.filter(x => x.id !== id); saveState(); renderCahier(); showToast('Mission supprimée'); };
window.setModalQuickDate = function(offset) { document.getElementById('m-duedate').value = getOffsetDateISO(offset); };
window.openMissionModal = function(id) {
  const m = id ? state.tasks.find(x => x.id === id) : null; document.getElementById('mission-modal-title').textContent = m ? 'Modifier la mission' : 'Nouvelle Mission';
  document.getElementById('m-id').value = m ? m.id : ''; document.getElementById('m-title').value = m ? m.title : '';
  document.getElementById('m-duration').value = m && m.duration ? m.duration : 2; document.getElementById('m-duedate').value = m && m.dueDate ? m.dueDate : getOffsetDateISO(2);
  document.getElementById('m-note').value = m && m.note ? m.note : '';
  mountCustomSelect('m-subject-mount', 'm-subj', getSubjectOptions(), m ? m.subject : 'maths'); mountCustomSelect('m-status-mount', 'm-stat', [{ value: 'todo', label: 'À faire' }, { value: 'in_progress', label: 'En cours' }, { value: 'done', label: 'Terminé' }], m ? m.status : 'todo');
  document.getElementById('mission-modal').classList.add('open');
};
window.closeMissionModal = function() { document.getElementById('mission-modal').classList.remove('open'); };
window.saveMissionForm = function(e) {
  e.preventDefault(); const id = document.getElementById('m-id').value, title = document.getElementById('m-title').value.trim(), subject = customSelectValues['m-subj'] || 'maths', duration = parseFloat(document.getElementById('m-duration').value) || 1, dueDate = document.getElementById('m-duedate').value || null, status = customSelectValues['m-stat'] || 'todo', note = document.getElementById('m-note').value.trim();
  if (id) { const t = state.tasks.find(x => x.id === id); if (t) Object.assign(t, { title, subject, duration, dueDate, status, note }); showToast('Mission modifiée'); }
  else { state.tasks.unshift({ id: 't_' + Date.now(), title, subject, duration, dueDate, status, note, createdAt: Date.now() }); showToast('Mission créée'); }
  saveState(); closeMissionModal(); renderCahier();
};


