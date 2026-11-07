// ui.js : selects personnalisés, sidebar, navigation entre onglets

const customSelectValues = {};

function mountCustomSelect(mountId, selectId, options, initialValue, onChange) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  customSelectValues[selectId] = initialValue;
  const render = () => {
    const currentVal = customSelectValues[selectId];
    const currentOpt = options.find(o => String(o.value) === String(currentVal)) || options[0];
    const dotHtml = currentOpt && currentOpt.dot ? `<span class="subj-dot" style="background:${currentOpt.dot};"></span>` : '';
    mount.innerHTML = `<div class="custom-select" id="cs-${selectId}"><div class="custom-select-trigger" onclick="window.toggleCustomSelect('${selectId}', event)"><span style="display:flex; align-items:center; gap:7px; overflow:hidden; white-space:nowrap;">${dotHtml}<span>${currentOpt ? escapeHtml(currentOpt.label) : ''}</span></span><i class="ph ph-caret-down" style="font-size:12px; color:var(--text-subtle);"></i></div><div class="custom-select-menu">${options.map(opt => {
      const isSel = String(opt.value) === String(currentVal);
      const d = opt.dot ? `<span class="subj-dot" style="background:${opt.dot};"></span>` : '';
      return `<div class="custom-select-option ${isSel ? 'selected' : ''}" onclick="window.pickCustomSelect('${selectId}', '${opt.value}', event)"><span style="display:flex; align-items:center; gap:7px;">${d}<span>${escapeHtml(opt.label)}</span></span>${isSel ? '<i class="ph-bold ph-check" style="font-size:11px;"></i>' : ''}</div>`;
    }).join('')}</div></div>`;
  };
  mount._rerender = render;
  mount._onChange = onChange;
  render();
}

window.toggleCustomSelect = function(s, e) {
  e.stopPropagation();
  const t = document.getElementById(`cs-${s}`);
  const wasOpen = t && t.classList.contains('open');
  document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
  if (t && !wasOpen) t.classList.add('open');
};

window.pickCustomSelect = function(s, val, e) {
  e.stopPropagation();
  customSelectValues[s] = val;
  document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
  const el = document.getElementById(`cs-${s}`);
  if (el && el.parentElement && el.parentElement._rerender) {
    const parent = el.parentElement;
    parent._rerender();
    if (parent._onChange) parent._onChange(val);
  }
};

document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
});

window.focusModalInput = function(inputId) {
  setTimeout(() => {
    const el = document.getElementById(inputId);
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
      if (typeof el.setSelectionRange === 'function' && (el.type === 'text' || el.tagName === 'TEXTAREA')) {
        const len = (el.value || '').length;
        el.setSelectionRange(len, len);
      }
    } catch (e) {}
  }, 45);
};

window.closeAnyOpenModal = function() {
  const openSelects = document.querySelectorAll('.custom-select.open');
  if (openSelects.length > 0) {
    openSelects.forEach(el => el.classList.remove('open'));
    return true;
  }
  const modalClosers = [
    ['schedule-doc-viewer-modal', () => window.closeScheduleDocViewer && window.closeScheduleDocViewer()],
    ['mission-modal', () => window.closeMissionModal && window.closeMissionModal()],
    ['slot-modal', () => window.closeSlotModal && window.closeSlotModal()],
    ['schedule-import-modal', () => window.closeScheduleImportModal && window.closeScheduleImportModal()],
    ['postit-modal', () => window.closePostitModal && window.closePostitModal()],
    ['errtypes-modal', () => window.closeErrorTypesModal && window.closeErrorTypesModal()],
    ['reset-modal', () => window.closeResetModal && window.closeResetModal()],
    ['qr-scanner-modal', () => window.closeQRScannerModal && window.closeQRScannerModal()],
    ['supabase-modal', () => window.closeSupabaseModal && window.closeSupabaseModal()],
    ['portal-modal', () => window.closePortalModal && window.closePortalModal()],
    ['subject-modal', () => window.closeSubjectModal && window.closeSubjectModal()],
    ['tasktype-modal', () => window.closeTaskTypeModal && window.closeTaskTypeModal()],
    ['anki-modal', () => window.closeAnkiModal && window.closeAnkiModal()],
    ['onboarding-modal', () => window.skipOnboarding && window.skipOnboarding()]
  ];
  for (const [id, fn] of modalClosers) {
    const m = document.getElementById(id);
    if (m && m.classList.contains('open')) {
      fn();
      return true;
    }
  }
  return false;
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (window.closeAnyOpenModal()) {
      e.preventDefault();
    }
    return;
  }
  if (e.key === 'Enter') {
    const openModal = document.querySelector('.modal-backdrop.open');
    if (!openModal) return;
    const active = document.activeElement;
    if (active && active.tagName === 'TEXTAREA') {
      if (e.ctrlKey || e.metaKey) {
        const form = active.closest('form');
        if (form) {
          e.preventDefault();
          form.requestSubmit();
        }
      }
      return;
    }
    if (active && active.tagName === 'BUTTON') return;
    const form = openModal.querySelector('form');
    if (form) {
      e.preventDefault();
      form.requestSubmit();
    } else if (openModal.id === 'onboarding-modal' && typeof window.onbNextOrFinish === 'function') {
      e.preventDefault();
      window.onbNextOrFinish();
    }
  }
});

function getSubjectOptions(includeAll = null) {
  const l = Object.values(SUBJECTS).map(s => ({ value: s.id, label: s.name, dot: s.color }));
  if (includeAll) l.unshift({ value: 'all', label: includeAll });
  return l;
}

window.refreshAllSubjectSelects = function() {
  const firstSubj = Object.keys(SUBJECTS)[0] || 'maths';
  const curQa = customSelectValues['qa-subj'];
  mountCustomSelect('qa-subject-select', 'qa-subj', getSubjectOptions(), (curQa && SUBJECTS[curQa]) ? curQa : firstSubj);
  if (typeof mountPostitFilters === 'function') mountPostitFilters();
};

window.toggleSidebar = function() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  document.getElementById('app-shell').classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  if (typeof saveUiPrefsLocal === 'function') saveUiPrefsLocal();
};

window.switchTab = function(tabId) {
  const validTabs = ['cahier', 'agenda', 'postits', 'dailydrop', 'sites'];
  if (!validTabs.includes(tabId)) tabId = 'cahier';
  state.activeTab = tabId;

  document.querySelectorAll('.tab-view').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.style.display = 'block';

  validTabs.forEach(id => {
    const b = document.getElementById(`nav-${id}`);
    if (b) b.classList.toggle('active', id === tabId);
    const m = document.getElementById(`mob-nav-${id}`);
    if (m) m.classList.toggle('active', id === tabId);
  });

  document.body.dataset.tab = tabId;
  const headers = {
    cahier: ['Missions & Cahier de Texte', 'Priorisation automatique selon le type de devoir, la date et la durée'],
    agenda: ['Emploi du temps & After-Hours Engine', 'Grille des cours de la semaine et optimiseur intelligent de créneaux (Cours → TD → DM)'],
    postits: ['Mur d\'Erreurs & Pièges Classiques', 'Post-its interactifs à relire avant chaque DS ou colle'],
    dailydrop: ['Daily Drop · Anglais & Culture G', 'Mot du jour, erreurs classiques à éviter en anglais, Culture G et export AnkiConnect'],
    sites: ['Portails, Données & Réglages', 'After-Hours Engine, AnkiConnect, matières, coefficients et sauvegarde Cloud']
  };
  document.getElementById('view-title').textContent = headers[tabId][0];
  document.getElementById('view-subtitle').textContent = headers[tabId][1];
  if (agendaIsMobile()) window.scrollTo(0, 0);
  if (typeof saveUiPrefsLocal === 'function') saveUiPrefsLocal();
  renderActiveTab();
};

function renderActiveTab() {
  if (state.activeTab === 'cahier') renderCahier();
  else if (state.activeTab === 'agenda') renderAgenda();
  else if (state.activeTab === 'postits') renderPostits();
  else if (state.activeTab === 'dailydrop' && typeof renderDailyDrop === 'function') renderDailyDrop();
  else if (state.activeTab === 'sites') renderPortals();
}
