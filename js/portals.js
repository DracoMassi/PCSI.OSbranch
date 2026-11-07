// portals.js : portails CPGE, panneau de réglages (Moteur de Tension, Multiplicateurs, Rythme Soirée) et gestion dynamique des matières

function renderPortals() {
  const sidebarMount = document.getElementById('sidebar-portals-mount');
  if (sidebarMount) {
    if (!state.portals.length) {
      sidebarMount.innerHTML = `<button type="button" onclick="window.openPortalModal(null)" class="nav-item" style="padding:7px 10px; font-size:12px; color:var(--text-subtle); border:1px dashed var(--border-subtle); justify-content:center;"><i class="ph-bold ph-plus"></i> Ajouter un lien</button>`;
    } else {
      sidebarMount.innerHTML = state.portals.map(p => `
        <div class="sidebar-portal-row">
          <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" class="sidebar-portal-link" title="${escapeHtml(p.desc || p.title)}">
            <i class="ph ${escapeHtml(p.icon || 'ph-link')}"></i>
            <span>${escapeHtml(p.title)}</span>
          </a>
          <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.editPortal('${p.id}')" class="sidebar-portal-edit" title="Modifier ce lien">
            <i class="ph ph-pencil-simple"></i>
          </button>
        </div>
      `).join('');
    }
  }

  const sitesMount = document.getElementById('sites-grid-mount');
  if (sitesMount) {
    sitesMount.innerHTML = state.portals.map(p => `
      <div class="site-card-wrap">
        <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" class="saas-card site-card has-edit">
          <span class="site-ico"><i class="ph ${escapeHtml(p.icon || 'ph-link')}"></i></span>
          <span class="site-txt"><b>${escapeHtml(p.title)}</b><small>${escapeHtml(p.desc || p.url)}</small></span>
        </a>
        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.editPortal('${p.id}')" class="site-edit-btn" title="Modifier ce lien">
          <i class="ph ph-pencil-simple"></i>
        </button>
      </div>
    `).join('') + `
      <button type="button" onclick="window.openPortalModal(null)" class="saas-card site-card" style="justify-content:center; border:1px dashed var(--border-subtle); background:rgba(255,255,255,0.02);">
        <span style="display:flex; align-items:center; gap:8px; color:var(--text-muted); font-weight:600;"><i class="ph-bold ph-plus"></i> Ajouter un lien</span>
      </button>
    `;
  }

  window.renderSettingsPanel();
}

window.highlightPortalIcon = function(iconVal) {
  const clean = (iconVal || '').trim();
  document.querySelectorAll('#port-icon-presets .icon-Preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.icon === clean);
  });
};

window.selectPortalIcon = function(iconName) {
  const input = document.getElementById('port-icon');
  if (input) input.value = iconName;
  window.highlightPortalIcon(iconName);
};

window.openPortalModal = function(id) {
  const p = id ? state.portals.find(x => x.id === id) : null;
  document.getElementById('portal-modal-title').textContent = p ? 'Modifier le lien' : 'Ajouter un lien CPGE';
  document.getElementById('port-id').value = p ? p.id : '';
  document.getElementById('port-title').value = p ? p.title : '';
  document.getElementById('port-url').value = p ? p.url : '';
  document.getElementById('port-desc').value = p ? (p.desc || '') : '';
  const ico = p ? (p.icon || 'ph-link') : 'ph-link';
  document.getElementById('port-icon').value = ico;
  window.highlightPortalIcon(ico);
  document.getElementById('port-delete-btn').style.display = p ? 'inline-flex' : 'none';
  document.getElementById('portal-modal').classList.add('open');
  if (typeof window.focusModalInput === 'function') window.focusModalInput('port-title');
};

window.editPortal = function(id) { window.openPortalModal(id); };
window.closePortalModal = function() { document.getElementById('portal-modal').classList.remove('open'); };

window.savePortalForm = function(e) {
  e.preventDefault();
  const id = document.getElementById('port-id').value;
  const title = document.getElementById('port-title').value.trim();
  let url = document.getElementById('port-url').value.trim();
  if (url && !/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)) {
    url = 'https://' + url;
  }
  const desc = document.getElementById('port-desc').value.trim();
  const icon = document.getElementById('port-icon').value.trim() || 'ph-link';

  if (id) {
    const existing = state.portals.find(x => x.id === id);
    if (existing) Object.assign(existing, { title, url, desc, icon });
    showToast('Lien modifié');
  } else {
    state.portals.push({ id: 'port_' + Date.now(), title, url, desc, icon });
    showToast('Lien ajouté');
  }
  saveState();
  closePortalModal();
  renderPortals();
};

window.deletePortal = function() {
  const id = document.getElementById('port-id').value;
  if (!id) return;
  state.portals = state.portals.filter(p => p.id !== id);
  saveState();
  closePortalModal();
  renderPortals();
  showToast('Lien supprimé');
};

// =========================================================
// PANNEAU DE RÉGLAGES & PERSONNALISATION (GLASSMORPHISM)
// =========================================================

window.openSettingsSection = function() {
  window.switchTab('sites');
  setTimeout(() => {
    const el = document.getElementById('settings-panel-mount');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
};

window.onAlphaBetaSliderInput = function(alphaPct) {
  const a = Math.min(0.95, Math.max(0.05, Number((parseInt(alphaPct, 10) / 100).toFixed(2))));
  const b = Number((1 - a).toFixed(2));
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.settings.alpha = a;
  state.settings.beta = b;
  const lbl = document.getElementById('cfg-alpha-beta-readout');
  if (lbl) lbl.textContent = `α = ${a.toFixed(2)} (Urgence) · β = ${b.toFixed(2)} (Durée)`;
  saveState();
  if (state.activeTab === 'cahier') renderCahier();
};

window.onDsBoostFactorInput = function(val) {
  const v = Math.min(2.5, Math.max(1.0, Number((parseFloat(val) || 1.4).toFixed(1))));
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.settings.dsBoostFactor = v;
  const lbl = document.getElementById('cfg-ds-boost-readout');
  if (lbl) lbl.textContent = `×${v.toFixed(1)}`;
  saveState();
  if (state.activeTab === 'cahier') renderCahier();
};

window.toggleAutoDsBoost = function() {
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.settings.autoDsBoost = !state.settings.autoDsBoost;
  saveState();
  window.renderSettingsPanel();
  if (state.activeTab === 'cahier') renderCahier();
  showToast(state.settings.autoDsBoost ? 'Boost Auto-DS activé' : 'Boost Auto-DS désactivé');
};

window.setDsSubjectOverride = function(val) {
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.settings.dsSubjectOverride = val || 'auto';
  saveState();
  window.renderSettingsPanel();
  if (state.activeTab === 'cahier') renderCahier();
};

window.updateSettingValue = function(key, val) {
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (key === 'commuteBufferMin') {
    const num = parseInt(val, 10);
    state.settings.commuteBufferMin = Number.isFinite(num) ? Math.min(120, Math.max(0, num)) : 30;
  } else if (key === 'ankiDeck') {
    const cleanDeck = String(val || '').trim();
    state.settings.ankiDeck = cleanDeck || 'PCSI::Vocabulaire';
    showToast(`Deck Anki cible : ${state.settings.ankiDeck}`);
  } else {
    state.settings[key] = val;
  }
  saveState();
  window.renderSettingsPanel();
  if (state.activeTab === 'agenda') renderAgenda();
  if (state.activeTab === 'cahier') renderCahier();
  if (state.activeTab === 'dailydrop' && typeof renderDailyDrop === 'function') renderDailyDrop();
};

window.onTypeMultiplierInput = function(typeId, val) {
  if (!TASK_TYPES[typeId]) return;
  const v = Math.min(4.0, Math.max(0.1, Number((parseFloat(val) || 1.0).toFixed(1))));
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!state.settings.typeMultipliers) state.settings.typeMultipliers = JSON.parse(JSON.stringify(DEFAULT_TYPE_MULTIPLIERS));
  state.settings.typeMultipliers[typeId] = v;
  const badge = document.getElementById(`cfg-tmult-val-${typeId}`);
  if (badge) badge.textContent = `×${v.toFixed(1)}`;
  const slider = document.getElementById(`cfg-tmult-range-${typeId}`);
  if (slider && document.activeElement !== slider) slider.value = v;
  const numInput = document.getElementById(`cfg-tmult-num-${typeId}`);
  if (numInput && document.activeElement !== numInput) numInput.value = v.toFixed(1);
  saveState();
  if (state.activeTab === 'cahier') renderCahier();
};

window.resetTypeMultipliers = function() {
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.taskTypes = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES)), state.taskTypes || {});
  Object.keys(DEFAULT_TASK_TYPES).forEach(k => {
    state.taskTypes[k] = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES[k]));
  });
  syncTaskTypesWithState();
  state.settings.typeMultipliers = JSON.parse(JSON.stringify(DEFAULT_TYPE_MULTIPLIERS));
  Object.values(TASK_TYPES).forEach(t => {
    if (!state.settings.typeMultipliers[t.id]) {
      state.settings.typeMultipliers[t.id] = t.defaultMult || 1.0;
    }
  });
  saveState();
  if (typeof window.refreshAllTaskTypePills === 'function') window.refreshAllTaskTypePills();
  window.renderSettingsPanel();
  if (state.activeTab === 'cahier') renderCahier();
  showToast('Types de tâches et multiplicateurs réinitialisés aux valeurs CPGE');
};

// =========================================================
// GESTION DYNAMIQUE DES TYPES DE TÂCHES (AJOUTER / MODIFIER / SUPPRIMER)
// =========================================================

window.openTaskTypeModal = function(typeId = null) {
  const t = (typeId && TASK_TYPES[typeId]) ? TASK_TYPES[typeId] : null;
  const titleEl = document.getElementById('tasktype-modal-title');
  if (titleEl) titleEl.textContent = t ? `Modifier le type « ${t.label} »` : 'Ajouter un type de tâche';

  document.getElementById('tt-edit-id').value = t ? t.id : '';
  document.getElementById('tt-label-input').value = t ? t.label : '';
  const curMult = t ? getTypeMultiplier(t.id) : 1.2;
  document.getElementById('tt-mult-input').value = curMult.toFixed(1);

  const col = t ? t.color : '#F97316';
  document.getElementById('tt-color-input').value = col;
  window.renderTaskTypeColorPresets(col);

  const ico = t ? (t.icon || 'ph-pencil-line') : 'ph-pencil-line';
  document.getElementById('tt-icon-input').value = ico;
  window.renderTaskTypeIconPresets(ico);

  const delBtn = document.getElementById('tt-delete-btn');
  if (delBtn) {
    delBtn.style.display = (t && Object.keys(TASK_TYPES).length > 1) ? 'inline-flex' : 'none';
  }

  document.getElementById('tasktype-modal').classList.add('open');
  if (typeof window.focusModalInput === 'function') window.focusModalInput('tt-label-input');
};

window.closeTaskTypeModal = function() {
  const m = document.getElementById('tasktype-modal');
  if (m) m.classList.remove('open');
};

window.selectTaskTypePresetColor = function(hex) {
  const input = document.getElementById('tt-color-input');
  if (input) input.value = hex;
  window.renderTaskTypeColorPresets(hex);
};

window.renderTaskTypeColorPresets = function(activeHex) {
  const box = document.getElementById('tt-color-presets');
  if (!box) return;
  const clean = (activeHex || '').toUpperCase();
  box.innerHTML = SUBJECT_COLOR_PRESETS.map(c => {
    const isAct = c.toUpperCase() === clean;
    return `
      <button type="button" onclick="window.selectTaskTypePresetColor('${c}')" class="color-preset-swatch ${isAct ? 'active' : ''}" style="background:${c};" title="${c}">
        ${isAct ? '<i class="ph-bold ph-check" style="color:#090A0F; font-size:12px;"></i>' : ''}
      </button>
    `;
  }).join('');
};

window.selectTaskTypeIcon = function(iconName) {
  const input = document.getElementById('tt-icon-input');
  if (input) input.value = iconName;
  window.renderTaskTypeIconPresets(iconName);
};

window.renderTaskTypeIconPresets = function(activeIcon) {
  const box = document.getElementById('tt-icon-presets');
  if (!box) return;
  const clean = (activeIcon || 'ph-pencil-line').trim();
  box.innerHTML = TASK_TYPE_ICON_PRESETS.map(p => {
    const isAct = p.icon === clean;
    return `
      <button type="button" class="icon-Preset-btn ${isAct ? 'active' : ''}" onclick="window.selectTaskTypeIcon('${p.icon}')" title="${escapeHtml(p.label)}">
        <i class="ph-bold ${p.icon}"></i>
      </button>
    `;
  }).join('');
};

window.saveTaskTypeForm = function(e) {
  e.preventDefault();
  const existingId = document.getElementById('tt-edit-id').value.trim();
  const label = document.getElementById('tt-label-input').value.trim();
  if (!label) return;

  const multRaw = parseFloat(document.getElementById('tt-mult-input').value);
  const mult = (Number.isFinite(multRaw) && multRaw >= 0.1 && multRaw <= 4.0) ? Number(multRaw.toFixed(1)) : 1.0;
  const color = document.getElementById('tt-color-input').value || '#38BDF8';
  const icon = document.getElementById('tt-icon-input').value.trim() || 'ph-pencil-line';

  if (!state.taskTypes || typeof state.taskTypes !== 'object') {
    state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
  }

  let id = existingId;
  if (!id) {
    const cleanKey = label.replace(/[^a-zA-Z0-9À-ÿ_-]/g, '');
    id = (cleanKey && !state.taskTypes[cleanKey])
      ? cleanKey
      : ('type_' + Date.now().toString(36).slice(-4));
  }

  state.taskTypes[id] = {
    id,
    label,
    color,
    bg: hexToRgba(color, 0.15),
    border: hexToRgba(color, 0.38),
    icon,
    defaultMult: mult
  };

  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!state.settings.typeMultipliers) state.settings.typeMultipliers = {};
  state.settings.typeMultipliers[id] = mult;

  syncTaskTypesWithState();
  saveState();
  if (typeof window.refreshAllTaskTypePills === 'function') window.refreshAllTaskTypePills();
  window.closeTaskTypeModal();
  window.renderSettingsPanel();
  renderActiveTab();
  showToast(existingId ? `Type « ${label} » mis à jour` : `Type « ${label} » ajouté`);
};

window.deleteTaskType = function(typeIdArg = null) {
  const typeId = typeIdArg || document.getElementById('tt-edit-id')?.value;
  if (!typeId || !state.taskTypes || !state.taskTypes[typeId]) return;
  if (Object.keys(state.taskTypes).length <= 1) {
    showToast('Garde au moins un type de tâche actif');
    return;
  }
  const removedLabel = state.taskTypes[typeId].label || typeId;
  const fallbackId = Object.keys(state.taskTypes).find(k => k !== typeId) || DEFAULT_TASK_TYPE;

  delete state.taskTypes[typeId];
  if (state.settings && state.settings.typeMultipliers) {
    delete state.settings.typeMultipliers[typeId];
  }
  syncTaskTypesWithState();

  state.tasks.forEach(t => {
    if (t.type === typeId) t.type = fallbackId;
  });

  saveState();
  if (typeof window.refreshAllTaskTypePills === 'function') window.refreshAllTaskTypePills();
  window.closeTaskTypeModal();
  window.renderSettingsPanel();
  renderActiveTab();
  showToast(`Type « ${removedLabel} » supprimé`);
};

// =========================================================
// GESTION DYNAMIQUE DES MATIÈRES (+ AJOUTER UNE MATIÈRE)
// =========================================================

window.openSubjectModal = function(subjId = null) {
  const s = subjId && SUBJECTS[subjId] ? SUBJECTS[subjId] : null;
  document.getElementById('subject-modal-title').textContent = s ? 'Modifier la matière' : 'Ajouter une matière';
  document.getElementById('subj-edit-id').value = s ? s.id : '';
  document.getElementById('subj-name-input').value = s ? s.name : '';
  document.getElementById('subj-short-input').value = s ? s.short : '';
  const col = s ? s.color : '#F97316';
  document.getElementById('subj-color-input').value = col;
  window.renderSubjectColorPresets(col);
  document.getElementById('subject-modal').classList.add('open');
  if (typeof window.focusModalInput === 'function') window.focusModalInput('subj-name-input');
};

window.closeSubjectModal = function() {
  document.getElementById('subject-modal').classList.remove('open');
};

window.selectSubjectPresetColor = function(hex) {
  const input = document.getElementById('subj-color-input');
  if (input) input.value = hex;
  window.renderSubjectColorPresets(hex);
};

window.renderSubjectColorPresets = function(activeHex) {
  const box = document.getElementById('subj-color-presets');
  if (!box) return;
  const clean = (activeHex || '').toUpperCase();
  box.innerHTML = SUBJECT_COLOR_PRESETS.map(c => {
    const isAct = c.toUpperCase() === clean;
    return `
      <button type="button" onclick="window.selectSubjectPresetColor('${c}')" class="color-preset-swatch ${isAct ? 'active' : ''}" style="background:${c};" title="${c}">
        ${isAct ? '<i class="ph-bold ph-check" style="color:#090A0F; font-size:12px;"></i>' : ''}
      </button>
    `;
  }).join('');
};

window.saveSubjectForm = function(e) {
  e.preventDefault();
  const existingId = document.getElementById('subj-edit-id').value.trim();
  const name = document.getElementById('subj-name-input').value.trim();
  const shortRaw = document.getElementById('subj-short-input').value.trim();
  const color = document.getElementById('subj-color-input').value || '#3B82F6';
  if (!name) return;

  const short = (shortRaw || name.slice(0, 6)).toUpperCase();
  const id = existingId || ('subj_' + name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now().toString(36).slice(-3));

  if (!state.subjects || typeof state.subjects !== 'object') {
    state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
  }
  state.subjects[id] = {
    id,
    name,
    short,
    color,
    builtin: !!DEFAULT_SUBJECTS[id]
  };

  syncSubjectsWithState();
  saveState();
  if (typeof window.refreshAllSubjectSelects === 'function') window.refreshAllSubjectSelects();
  closeSubjectModal();
  window.renderSettingsPanel();
  renderActiveTab();
  showToast(existingId ? 'Matière mise à jour' : `Matière "${name}" ajoutée`);
};

window.deleteSubject = function(subjId) {
  if (!subjId || !state.subjects || !state.subjects[subjId]) return;
  if (Object.keys(state.subjects).length <= 1) {
    showToast('Garde au moins une matière active');
    return;
  }
  const fallbackId = Object.keys(state.subjects).find(k => k !== subjId) || 'maths';
  delete state.subjects[subjId];
  syncSubjectsWithState();

  state.tasks.forEach(t => { if (t.subject === subjId) t.subject = fallbackId; });
  state.schedule.forEach(s => { if (s.subject === subjId) s.subject = fallbackId; });
  state.postits.forEach(p => { if (p.subject === subjId) p.subject = fallbackId; });
  if (state.cahierSubjFilter === subjId) state.cahierSubjFilter = 'all';
  if (state.postitSubjFilter === subjId) state.postitSubjFilter = 'all';

  saveState();
  if (typeof window.refreshAllSubjectSelects === 'function') window.refreshAllSubjectSelects();
  window.renderSettingsPanel();
  renderActiveTab();
  showToast('Matière supprimée');
};

window.renderSettingsPanel = function() {
  const mount = document.getElementById('settings-panel-mount');
  if (!mount) return;

  const cfg = state.settings || DEFAULT_SETTINGS;
  const alphaPct = Math.round((cfg.alpha || 0.65) * 100);
  const detectedDsSubjects = getUpcomingSaturdayDsSubjects();
  const detectedDsNames = detectedDsSubjects.map(id => SUBJECTS[id]?.name || id).join(', ') || 'Aucun DS détecté ce samedi';
  const mults = Object.assign({}, DEFAULT_TYPE_MULTIPLIERS, cfg.typeMultipliers || {});

  const typeList = Object.values(TASK_TYPES);

  mount.innerHTML = `
    <div class="settings-grid">
      
      <!-- SECTION 1 : ALGORITHME & MOTEUR DE TENSION -->
      <div class="saas-card settings-card">
        <div class="settings-card-head">
          <div class="settings-card-ico" style="color:#EF4444; background:rgba(239,68,68,0.12); border-color:rgba(239,68,68,0.28);">
            <i class="ph-bold ph-gauge"></i>
          </div>
          <div>
            <h3 style="font-size:14.5px; font-weight:700;">Algorithme &amp; Moteur de Tension</h3>
            <p style="font-size:11.5px; color:var(--text-muted);">Tension = [(α·Urgence) + (β·Durée)] × TypeMult × Importance × AutoDS</p>
          </div>
        </div>

        <div class="settings-field-group">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
            <label style="font-size:12px; font-weight:600; color:var(--text-main);">Ratio α (Urgence Deadline) vs β (Durée)</label>
            <span id="cfg-alpha-beta-readout" class="mono" style="font-size:11px; color:#38BDF8; font-weight:700;">
              α = ${(cfg.alpha || 0.65).toFixed(2)} (Urgence) · β = ${(cfg.beta || 0.35).toFixed(2)} (Durée)
            </span>
          </div>
          <input type="range" min="10" max="90" step="5" value="${alphaPct}" oninput="window.onAlphaBetaSliderInput(this.value)" class="saas-range" />
          <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--text-subtle); margin-top:4px;">
            <span>Priorité Charge Longue (β fort)</span>
            <span>Équilibré</span>
            <span>Priorité Deadline Courte (α fort)</span>
          </div>
        </div>

        <div class="settings-field-group" style="border-top:1px solid var(--border-subtle); padding-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
            <div>
              <div style="font-size:12.5px; font-weight:600; color:var(--text-main);">Facteur Auto-DS du Samedi</div>
              <div style="font-size:11px; color:var(--text-muted);">Amplifie automatiquement la tension des missions de la matière du prochain DS</div>
            </div>
            <button type="button" onclick="window.toggleAutoDsBoost()" class="settings-toggle-btn ${cfg.autoDsBoost ? 'on' : ''}" aria-label="Activer Boost Auto-DS">
              <span class="settings-toggle-knob"></span>
            </button>
          </div>

          <div class="settings-subgrid-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:center; ${cfg.autoDsBoost ? '' : 'opacity:0.45; pointer-events:none;'}">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                <span style="color:var(--text-muted);">Multiplicateur DS</span>
                <span id="cfg-ds-boost-readout" class="mono" style="font-weight:700; color:#F59E0B;">×${(cfg.dsBoostFactor || 1.4).toFixed(1)}</span>
              </div>
              <input type="range" min="1.1" max="2.2" step="0.1" value="${cfg.dsBoostFactor || 1.4}" oninput="window.onDsBoostFactorInput(this.value)" class="saas-range" />
            </div>
            <div>
              <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Matière ciblée Samedi</label>
              <select class="saas-input" style="padding:6px 10px; font-size:11.5px;" onchange="window.setDsSubjectOverride(this.value)">
                <option value="auto" ${(!cfg.dsSubjectOverride || cfg.dsSubjectOverride === 'auto') ? 'selected' : ''}>Auto (${escapeHtml(detectedDsNames)})</option>
                ${Object.values(SUBJECTS).map(s => `<option value="${s.id}" ${cfg.dsSubjectOverride === s.id ? 'selected' : ''}>Forcer : ${escapeHtml(s.name)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="settings-field-group" style="border-top:1px solid var(--border-subtle); padding-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div>
              <div style="font-size:12.5px; font-weight:600; color:var(--text-main);">Option « Tâches de demain en priorité »</div>
              <div style="font-size:11px; color:var(--text-muted);">Propulse systématiquement les missions dues le lendemain en tête du backlog</div>
            </div>
            <button type="button" onclick="window.toggleTomorrowFirst()" class="settings-toggle-btn ${cfg.tomorrowFirst !== false ? 'on' : ''}" aria-label="Tâches de demain en priorité">
              <span class="settings-toggle-knob"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- SECTION 2 : AFTER-HOURS ENGINE & INTÉGRATION ANKICONNECT -->
      <div class="saas-card settings-card">
        <div class="settings-card-head">
          <div class="settings-card-ico" style="color:#A855F7; background:rgba(168,85,247,0.12); border-color:rgba(168,85,247,0.28);">
            <i class="ph-bold ph-cpu"></i>
          </div>
          <div>
            <h3 style="font-size:14.5px; font-weight:700;">After-Hours Engine &amp; AnkiConnect</h3>
            <p style="font-size:11.5px; color:var(--text-muted);">Enveloppe horaire dynamique, buffer de trajet et deck Anki cible</p>
          </div>
        </div>

        <div class="settings-subgrid-2" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:11.5px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:5px;">
              <i class="ph-bold ph-fork-knife" style="color:#F59E0B;"></i> Début Pause Dîner
            </label>
            <input type="time" class="saas-input mono" value="${escapeHtml(cfg.dinnerStart || '19:00')}" onchange="window.updateSettingValue('dinnerStart', this.value)" />
          </div>
          <div>
            <label style="font-size:11.5px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:5px;">
              <i class="ph-bold ph-fork-knife" style="color:#F59E0B;"></i> Fin Pause Dîner
            </label>
            <input type="time" class="saas-input mono" value="${escapeHtml(cfg.dinnerEnd || '20:00')}" onchange="window.updateSettingValue('dinnerEnd', this.value)" />
          </div>
        </div>

        <div class="settings-subgrid-2" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:11.5px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:5px;">
              <i class="ph-bold ph-bed" style="color:#C084FC;"></i> Couvre-feu / Coucher Cible
            </label>
            <input type="time" class="saas-input mono" value="${escapeHtml(cfg.bedtime || '23:00')}" onchange="window.updateSettingValue('bedtime', this.value)" />
          </div>
          <div>
            <label style="font-size:11.5px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:5px;">
              <i class="ph-bold ph-person-simple-walk" style="color:#34D399;"></i> Buffer Trajet / Transition (min)
            </label>
            <input type="number" min="0" max="120" step="5" class="saas-input mono" value="${Number.isFinite(Number(cfg.commuteBufferMin)) ? Number(cfg.commuteBufferMin) : 30}" onchange="window.updateSettingValue('commuteBufferMin', this.value)" />
          </div>
        </div>

        <div style="padding-top:10px; border-top:1px solid var(--border-subtle);">
          <label style="font-size:11.5px; font-weight:600; color:var(--text-muted); display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;">
            <span><i class="ph-bold ph-cards" style="color:#38BDF8;"></i> Target Anki Deck <small style="color:var(--text-subtle); font-weight:400;">(Syntaxe Parent::Enfant)</small></span>
            <span class="mono" style="font-size:10px; color:#38BDF8;">localhost:8765</span>
          </label>
          <input type="text" id="settings-anki-deck-input" class="saas-input mono" placeholder="PCSI::Vocabulaire (ex: Anglais::Vocabulaire)" value="${escapeHtml(cfg.ankiDeck || 'PCSI::Vocabulaire')}" onchange="window.updateSettingValue('ankiDeck', this.value)" />
          <div style="font-size:11px; color:var(--text-subtle); margin-top:4px;">
            Utilisé par les boutons <b>[+ Anki]</b> du Daily Drop. Défaut si vide : <code class="mono">PCSI::Vocabulaire</code>.
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; padding-top:8px; border-top:1px solid var(--border-subtle);">
          <span style="font-size:11px; color:var(--text-subtle);">Présélections Couvre-feu :</span>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${['22:30', '23:00', '23:30', '00:00'].map(t => `
              <button type="button" onclick="window.updateSettingValue('bedtime', '${t}')" class="btn-ghost mono ${cfg.bedtime === t ? 'active-pill' : ''}" style="padding:5px 10px; font-size:11px;">${t}</button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding-top:10px; border-top:1px solid var(--border-subtle);">
          <div>
            <div style="font-size:12px; font-weight:600; color:var(--text-main);">Guide de prise en main PCSI.OS</div>
            <div style="font-size:11px; color:var(--text-muted);">Relancer le parcours interactif en 4 étapes</div>
          </div>
          <button type="button" onclick="window.openOnboardingModal()" class="btn-ghost" style="padding:7px 13px; font-size:12px; color:#FACC15; border-color:rgba(250,204,21,0.3);">
            <i class="ph-bold ph-sparkle"></i> Revoir le tutoriel
          </button>
        </div>
      </div>

      <!-- SECTION 3 : TYPES DE TÂCHES & MULTIPLICATEURS (AJOUT / MODIFICATION / SUPPRESSION) -->
      <div class="saas-card settings-card" style="grid-column: 1 / -1;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div class="settings-card-head">
            <div class="settings-card-ico" style="color:#F97316; background:rgba(249,115,22,0.12); border-color:rgba(249,115,22,0.28);">
              <i class="ph-bold ph-sliders"></i>
            </div>
            <div>
              <h3 style="font-size:14.5px; font-weight:700;">Types de Tâches &amp; Multiplicateurs (DM, DS, TD, Colle...)</h3>
              <p style="font-size:11.5px; color:var(--text-muted);">Ajoute, modifie ou supprime librement tes types de tâches et règle leur multiplicateur de priorité</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button type="button" onclick="window.resetTypeMultipliers()" class="btn-ghost" style="padding:7px 12px; font-size:12px;">
              <i class="ph ph-arrow-counter-clockwise"></i> Valeurs par défaut
            </button>
            <button type="button" onclick="window.openTaskTypeModal(null)" class="btn-primary" style="padding:7px 13px; font-size:12px;">
              <i class="ph-bold ph-plus"></i> + Ajouter un type
            </button>
          </div>
        </div>

        <div class="type-multipliers-grid">
          ${typeList.map(tm => {
            const typeId = tm.id;
            const val = Number((parseFloat(mults[typeId]) || tm.defaultMult || DEFAULT_TYPE_MULTIPLIERS[typeId] || 1.0).toFixed(1));
            return `
              <div class="type-mult-card" style="border-left:3px solid ${tm.color};">
                <div class="type-mult-card-top">
                  <div style="display:flex; align-items:center; gap:7px; min-width:0;">
                    <span class="task-type-badge mono" style="background:${tm.bg}; border:1px solid ${tm.border}; color:${tm.color};">
                      <i class="ph-bold ${escapeHtml(tm.icon)}"></i> ${escapeHtml(tm.label)}
                    </span>
                    <span id="cfg-tmult-val-${escapeHtml(tm.id)}" class="mono" style="font-size:11.5px; font-weight:700; color:${tm.color};">×${val.toFixed(1)}</span>
                  </div>
                  <div class="type-mult-card-actions">
                    <button type="button" onclick="window.openTaskTypeModal('${escapeHtml(tm.id)}')" class="type-card-icon-btn" title="Modifier ce type de tâche">
                      <i class="ph-bold ph-pencil-simple"></i>
                    </button>
                    ${typeList.length > 1 ? `
                      <button type="button" onclick="window.deleteTaskType('${escapeHtml(tm.id)}')" class="type-card-icon-btn type-card-icon-del" title="Supprimer ce type de tâche">
                        <i class="ph-bold ph-trash"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
                <div class="type-mult-card-bottom">
                  <input type="range" id="cfg-tmult-range-${escapeHtml(tm.id)}" min="0.2" max="3.5" step="0.1" value="${val}" oninput="window.onTypeMultiplierInput('${escapeHtml(tm.id)}', this.value)" class="saas-range" style="flex:1;" />
                  <input type="number" id="cfg-tmult-num-${escapeHtml(tm.id)}" class="saas-input mono type-mult-num-input" min="0.1" max="4.0" step="0.1" value="${val.toFixed(1)}" onchange="window.onTypeMultiplierInput('${escapeHtml(tm.id)}', this.value)" />
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- SECTION 4 : GESTION DYNAMIQUE DES MATIÈRES -->
      <div class="saas-card settings-card" style="grid-column: 1 / -1;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:4px;">
          <div class="settings-card-head">
            <div class="settings-card-ico" style="color:#10B981; background:rgba(16,185,129,0.12); border-color:rgba(16,185,129,0.28);">
              <i class="ph-bold ph-palette"></i>
            </div>
            <div>
              <h3 style="font-size:14.5px; font-weight:700;">Matières &amp; Codes Couleurs</h3>
              <p style="font-size:11.5px; color:var(--text-muted);">Personnalise tes matières. Synchronisé avec Supabase, les filtres de missions et l'agenda.</p>
            </div>
          </div>
          <button type="button" onclick="window.openSubjectModal(null)" class="btn-primary" style="padding:8px 14px; font-size:12.5px;">
            <i class="ph-bold ph-plus"></i> + Ajouter une matière
          </button>
        </div>

        <div class="subjects-settings-grid">
          ${Object.values(SUBJECTS).map(s => `
            <div class="subject-Manage-card" style="border-left: 3px solid ${s.color};">
              <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                <span class="subj-dot" style="width:12px; height:12px; background:${s.color}; box-shadow:0 0 10px ${s.color}88;"></span>
                <div style="min-width:0;">
                  <div style="font-weight:700; font-size:13px; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(s.name)}</div>
                  <span class="mono" style="font-size:10.5px; color:var(--text-muted);">Code : ${escapeHtml(s.short)}</span>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:5px; flex-shrink:0;">
                <button type="button" onclick="window.openSubjectModal('${s.id}')" class="type-card-icon-btn" title="Modifier cette matière">
                  <i class="ph-bold ph-pencil-simple"></i>
                </button>
                ${Object.keys(SUBJECTS).length > 1 ? `
                  <button type="button" onclick="window.deleteSubject('${s.id}')" class="type-card-icon-btn type-card-icon-del" title="Supprimer cette matière">
                    <i class="ph-bold ph-trash"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;
};
