// ui.js : selects personnalisés, sidebar, navigation entre onglets

const customSelectValues = {};
function mountCustomSelect(mountId, selectId, options, initialValue, onChange) {
  const mount = document.getElementById(mountId); if (!mount) return; customSelectValues[selectId] = initialValue;
  const render = () => {
    const currentVal = customSelectValues[selectId]; const currentOpt = options.find(o => String(o.value) === String(currentVal)) || options[0];
    const dotHtml = currentOpt && currentOpt.dot ? `<span class="subj-dot" style="background:${currentOpt.dot};"></span>` : '';
    mount.innerHTML = `<div class="custom-select" id="cs-${selectId}"><div class="custom-select-trigger" onclick="window.toggleCustomSelect('${selectId}', event)"><span style="display:flex; align-items:center; gap:7px; overflow:hidden; white-space:nowrap;">${dotHtml}<span>${currentOpt ? currentOpt.label : ''}</span></span><i class="ph ph-caret-down" style="font-size:12px; color:var(--text-subtle);"></i></div><div class="custom-select-menu">${options.map(opt => { const isSel = String(opt.value) === String(currentVal); const d = opt.dot ? `<span class="subj-dot" style="background:${opt.dot};"></span>` : ''; return `<div class="custom-select-option ${isSel ? 'selected' : ''}" onclick="window.pickCustomSelect('${selectId}', '${opt.value}', event)"><span style="display:flex; align-items:center; gap:7px;">${d}<span>${opt.label}</span></span>${isSel ? '<i class="ph-bold ph-check" style="font-size:11px;"></i>' : ''}</div>`; }).join('')}</div></div>`;
  }; mount._rerender = render; mount._onChange = onChange; render();
}
window.toggleCustomSelect = function(s, e) { e.stopPropagation(); const t = document.getElementById(`cs-${s}`); const wasOpen = t && t.classList.contains('open'); document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open')); if (t && !wasOpen) t.classList.add('open'); };
window.pickCustomSelect = function(s, val, e) { e.stopPropagation(); customSelectValues[s] = val; document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open')); const el = document.getElementById(`cs-${s}`); if (el && el.parentElement && el.parentElement._rerender) { const parent = el.parentElement; parent._rerender(); if (parent._onChange) parent._onChange(val); } };
document.addEventListener('click', () => { document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open')); });
function getSubjectOptions(includeAll = null) { const l = Object.values(SUBJECTS).map(s => ({ value: s.id, label: s.name, dot: s.color })); if (includeAll) l.unshift({ value: 'all', label: includeAll }); return l; }

window.toggleSidebar = function() { state.sidebarCollapsed = !state.sidebarCollapsed; document.getElementById('app-shell').classList.toggle('sidebar-collapsed', state.sidebarCollapsed); saveState(); };
window.switchTab = function(tabId) {
  state.activeTab = tabId; document.querySelectorAll('.tab-view').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`tab-${tabId}`); if (target) target.style.display = 'block';
  ['cahier', 'agenda', 'postits', 'sites'].forEach(id => { const b = document.getElementById(`nav-${id}`); if (b) b.classList.toggle('active', id === tabId); const m = document.getElementById(`mob-nav-${id}`); if (m) m.classList.toggle('active', id === tabId); });
  document.body.dataset.tab = tabId;
  const headers = { cahier: ['Missions & Cahier de Texte', 'Priorisation dynamique selon l\'échéance et la charge de travail'], agenda: ['Emploi du temps & Colloscope', 'Visualisation hebdomadaire Lundi–Samedi et créneaux de colles'], postits: ['Mur d\'Erreurs & Pièges Classiques', 'Post-its interactifs inclinés à relire avant chaque DS'], sites: ['Sites & Outils', 'Portails CPGE, synchronisation et gestion des données'] };
  document.getElementById('view-title').textContent = headers[tabId][0]; document.getElementById('view-subtitle').textContent = headers[tabId][1];
  if (agendaIsMobile()) window.scrollTo(0, 0);
  saveState(); renderActiveTab();
};
function renderActiveTab() { if (state.activeTab === 'cahier') renderCahier(); else if (state.activeTab === 'agenda') renderAgenda(); else if (state.activeTab === 'postits') renderPostits(); else if (state.activeTab === 'sites') renderPortals(); }


