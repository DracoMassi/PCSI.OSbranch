// state.js : objet state global, chargement, normalisation, matières dynamiques et réglages

let state = {
  activeTab: 'cahier',
  sidebarCollapsed: false,
  cahierMode: 'table',
  cahierSubjFilter: 'all',
  postitSubjFilter: 'all',
  postitTypeFilter: 'all',
  agendaSubTab: 'academic',
  errorTypes: JSON.parse(JSON.stringify(DEFAULT_ERROR_TYPES)),
  portals: [],
  subjects: JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)),
  taskTypes: JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES)),
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  eveningPlan: {
    manualOrder: [],
    excludedIds: [],
    customDurations: {},
    pinnedEveningIds: [],
    naps: {}
  },
  tasks: [],
  schedule: [],
  scheduleDocs: [],
  postits: []
};

function syncSubjectsWithState() {
  if (!state.subjects || typeof state.subjects !== 'object' || Object.keys(state.subjects).length === 0) {
    state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
  }
  Object.keys(SUBJECTS).forEach(k => delete SUBJECTS[k]);
  Object.entries(state.subjects).forEach(([k, v]) => {
    if (v && v.id && v.name) {
      SUBJECTS[k] = {
        id: v.id,
        name: v.name,
        short: (v.short || v.name.slice(0, 6)).toUpperCase(),
        color: v.color || '#3B82F6',
        builtin: !!DEFAULT_SUBJECTS[k]
      };
    }
  });
}

function syncTaskTypesWithState() {
  if (!state.taskTypes || typeof state.taskTypes !== 'object' || Object.keys(state.taskTypes).length === 0) {
    state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
  }
  Object.keys(TASK_TYPES).forEach(k => delete TASK_TYPES[k]);
  Object.entries(state.taskTypes).forEach(([k, v]) => {
    if (v && (v.id || k) && v.label) {
      const id = v.id || k;
      const color = v.color || '#38BDF8';
      const defMult = parseFloat(v.defaultMult);
      TASK_TYPES[id] = {
        id,
        label: String(v.label).trim(),
        color,
        bg: v.bg || hexToRgba(color, 0.15),
        border: v.border || hexToRgba(color, 0.38),
        icon: v.icon || 'ph-pencil-line',
        defaultMult: (Number.isFinite(defMult) && defMult >= 0.1 && defMult <= 5.0)
          ? Number(defMult.toFixed(2))
          : (DEFAULT_TYPE_MULTIPLIERS[id] || 1.0)
      };
    }
  });
  if (Object.keys(TASK_TYPES).length === 0) {
    state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
    Object.assign(TASK_TYPES, JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES)));
  }
}

function normalizeSettingsState() {
  const incomingSettings = state.settings || {};
  const incomingMults = incomingSettings.typeMultipliers || {};
  state.settings = Object.assign({}, DEFAULT_SETTINGS, incomingSettings);
  state.settings.typeMultipliers = Object.assign({}, DEFAULT_TYPE_MULTIPLIERS, incomingMults);
  Object.keys(TASK_TYPES).forEach(k => {
    const v = parseFloat(state.settings.typeMultipliers[k]);
    const fallback = (TASK_TYPES[k] && Number.isFinite(TASK_TYPES[k].defaultMult))
      ? TASK_TYPES[k].defaultMult
      : (DEFAULT_TYPE_MULTIPLIERS[k] || 1.0);
    state.settings.typeMultipliers[k] = (Number.isFinite(v) && v >= 0.1 && v <= 5.0)
      ? Number(v.toFixed(2))
      : fallback;
  });

  const a = parseFloat(state.settings.alpha);
  state.settings.alpha = Number.isFinite(a) ? Math.min(0.95, Math.max(0.05, Number(a.toFixed(2)))) : DEFAULT_SETTINGS.alpha;
  state.settings.beta = Number((1 - state.settings.alpha).toFixed(2));
  const boost = parseFloat(state.settings.dsBoostFactor);
  state.settings.dsBoostFactor = Number.isFinite(boost) ? Math.min(2.5, Math.max(1.0, Number(boost.toFixed(2)))) : DEFAULT_SETTINGS.dsBoostFactor;
  state.settings.autoDsBoost = state.settings.autoDsBoost !== false;
  state.settings.tomorrowFirst = state.settings.tomorrowFirst !== false;
  state.settings.sortMode = state.settings.sortMode === 'deadline' ? 'deadline' : 'tension';
  state.settings.dinnerStart = state.settings.dinnerStart || '19:00';
  state.settings.dinnerEnd = state.settings.dinnerEnd || '20:00';
  state.settings.bedtime = state.settings.bedtime || '23:00';
  state.settings.defaultClassEnd = state.settings.defaultClassEnd || '17:30';
  const buf = parseInt(state.settings.commuteBufferMin, 10);
  state.settings.commuteBufferMin = Number.isFinite(buf) ? Math.min(120, Math.max(0, buf)) : 30;
  const rawDeck = String(state.settings.ankiDeck || '').trim();
  state.settings.ankiDeck = rawDeck || 'PCSI::Vocabulaire';

  if (!state.eveningPlan || typeof state.eveningPlan !== 'object') {
    state.eveningPlan = { manualOrder: [], excludedIds: [], customDurations: {}, pinnedEveningIds: [], naps: {} };
  }
  if (!Array.isArray(state.eveningPlan.manualOrder)) state.eveningPlan.manualOrder = [];
  if (!Array.isArray(state.eveningPlan.excludedIds)) state.eveningPlan.excludedIds = [];
  if (!Array.isArray(state.eveningPlan.pinnedEveningIds)) state.eveningPlan.pinnedEveningIds = [];
  if (!state.eveningPlan.customDurations || typeof state.eveningPlan.customDurations !== 'object') {
    state.eveningPlan.customDurations = {};
  }
  if (!state.eveningPlan.naps || typeof state.eveningPlan.naps !== 'object' || Array.isArray(state.eveningPlan.naps)) {
    state.eveningPlan.naps = {};
  }
  if (!Array.isArray(state.scheduleDocs)) {
    state.scheduleDocs = [];
  }
}

function inferTaskTypeFromTitle(title) {
  const defaultType = TASK_TYPES[DEFAULT_TASK_TYPE] ? DEFAULT_TASK_TYPE : (Object.keys(TASK_TYPES)[0] || 'Exercice');
  if (!title) return defaultType;
  const clean = title.trim();
  for (const t of Object.values(TASK_TYPES)) {
    const escaped = String(t.label || t.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped && new RegExp('^' + escaped + '\\b', 'i').test(clean)) {
      return t.id;
    }
  }
  if (TASK_TYPES.TD && /^td\b/i.test(clean)) return 'TD';
  if (TASK_TYPES.DM && /^dm\b/i.test(clean)) return 'DM';
  if (TASK_TYPES.Exercice && /^(exo|exercice)s?\b/i.test(clean)) return 'Exercice';
  if (TASK_TYPES.Colle && /^(colle|kh[ôo]lle)\b/i.test(clean)) return 'Colle';
  if (TASK_TYPES.TP && /^tp\b/i.test(clean)) return 'TP';
  if (TASK_TYPES.DS && /^ds\b/i.test(clean)) return 'DS';
  if (TASK_TYPES['Révision'] && /^r[ée]vision/i.test(clean)) return 'Révision';
  if (TASK_TYPES.Cours && /^cours\b/i.test(clean)) return 'Cours';
  return defaultType;
}

function buildDefaultPipelinePhases(totalDuration, phaseCount = 3) {
  const dur = Math.max(0.5, parseFloat(totalDuration) || 2);
  if (Number(phaseCount) === 2) {
    const p1 = Math.max(0.5, Math.round((dur * 0.5) * 2) / 2);
    const p2 = Math.max(0.5, Number((dur - p1).toFixed(1)));
    return [
      { id: 'ph_1', title: 'Phase 1 : Recherche & Brouillon', duration: p1, done: false },
      { id: 'ph_2', title: 'Phase 2 : Résolution & Rédaction', duration: p2, done: false }
    ];
  }
  const p1 = Math.max(0.5, Math.round((dur * 0.35) * 2) / 2);
  const p2 = Math.max(0.5, Math.round((dur * 0.4) * 2) / 2);
  const p3 = Math.max(0.5, Number(Math.max(0.5, dur - p1 - p2).toFixed(1)));
  return [
    { id: 'ph_1', title: 'Phase 1 : Recherche / Brouillon', duration: p1, done: false },
    { id: 'ph_2', title: 'Phase 2 : Résolution', duration: p2, done: false },
    { id: 'ph_3', title: 'Phase 3 : Rédaction', duration: p3, done: false }
  ];
}

function normalizeTasksState() {
  if (!Array.isArray(state.tasks)) state.tasks = [];
  state.tasks.forEach(t => {
    if (!t.type || !TASK_TYPES[t.type]) {
      const matched = t.type ? Object.keys(TASK_TYPES).find(k => k.toLowerCase() === String(t.type).toLowerCase()) : null;
      t.type = matched || inferTaskTypeFromTitle(t.title);
    }
    const imp = parseFloat(t.importance);
    t.importance = Number.isFinite(imp) ? Math.min(2.5, Math.max(0.5, Number(imp.toFixed(1)))) : 1.0;

    if (t.completed === true || t.status === 'done') {
      t.completed = true;
      t.status = 'done';
    } else {
      t.completed = false;
      t.status = t.status === 'in_progress' ? 'in_progress' : 'todo';
    }

    if (!t.pipeline || typeof t.pipeline !== 'object') {
      t.pipeline = { enabled: false, phases: [] };
    } else {
      t.pipeline.enabled = !!t.pipeline.enabled;
      if (!Array.isArray(t.pipeline.phases)) t.pipeline.phases = [];
    }
  });
}

function getUpcomingSaturdayDsSubjects() {
  const override = state.settings && state.settings.dsSubjectOverride;
  if (override && override !== 'auto' && override !== 'none' && SUBJECTS[override]) {
    return [override];
  }
  if (override === 'none') return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const daysUntilSat = day === 6 ? 0 : (6 - day);
  const nextSat = addDays(today, daysUntilSat);
  const nextSatISO = formatDateISO(nextSat);
  const weekAfterSatISO = formatDateISO(addDays(nextSat, 7));

  const found = new Set();
  if (Array.isArray(state.schedule)) {
    state.schedule.forEach(sl => {
      if (!sl) return;
      const isDs = String(sl.type || '').toUpperCase() === 'DS' || /\bds\b/i.test(sl.title || '');
      if (!isDs) return;
      if (sl.date === nextSatISO || sl.date === weekAfterSatISO || (!sl.date && Number(sl.dayOfWeek) === 5)) {
        if (sl.subject && SUBJECTS[sl.subject]) found.add(sl.subject);
      }
    });
  }
  if (Array.isArray(state.tasks)) {
    state.tasks.forEach(t => {
      if (!t || t.completed || t.status === 'done') return;
      if (t.type === 'DS' && (t.dueDate === nextSatISO || t.dueDate === weekAfterSatISO) && t.subject && SUBJECTS[t.subject]) {
        found.add(t.subject);
      }
    });
  }
  return Array.from(found);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign(state, parsed);
      if (!state.errorTypes || !state.errorTypes.length) state.errorTypes = JSON.parse(JSON.stringify(DEFAULT_ERROR_TYPES));
      if (!Array.isArray(parsed.portals)) state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
      if (!parsed.subjects || typeof parsed.subjects !== 'object' || Object.keys(parsed.subjects).length === 0) {
        state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
      } else {
        state.subjects = parsed.subjects;
      }
      if (!parsed.taskTypes || typeof parsed.taskTypes !== 'object' || Object.keys(parsed.taskTypes).length === 0) {
        state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
      } else {
        state.taskTypes = parsed.taskTypes;
      }
    } else {
      state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
      state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
      state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
    }
    const rawSupa = localStorage.getItem(SUPA_KEY);
    if (rawSupa) supaConfig = Object.assign(supaConfig, JSON.parse(rawSupa));
    syncDirty = localStorage.getItem(DIRTY_KEY) === '1';
  } catch (e) {
    state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
    state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
    state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
  }
  syncSubjectsWithState();
  syncTaskTypesWithState();
  normalizeSettingsState();
  normalizeTasksState();
  lastDataSig = dataSig();
  updateSyncIndicator();
  renderPortals();
}

function saveUiPrefsLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

function saveState() {
  syncSubjectsWithState();
  syncTaskTypesWithState();
  normalizeSettingsState();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  const sig = dataSig();
  if (sig !== lastDataSig) {
    lastDataSig = sig;
    syncVersion++;
    syncDirty = true;
    try { localStorage.setItem(DIRTY_KEY, '1'); } catch (e) {}
    if (supaConfigured()) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushToSupabase, 700);
    }
  }
  updateSyncIndicator();
}
