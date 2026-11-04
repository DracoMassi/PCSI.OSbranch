// state.js : objet state global, chargement et sauvegarde locale

let state = {
  activeTab: 'cahier', sidebarCollapsed: false, cahierMode: 'table', cahierSubjFilter: 'all', postitSubjFilter: 'all', postitTypeFilter: 'all',
  errorTypes: JSON.parse(JSON.stringify(DEFAULT_ERROR_TYPES)), portals: [], tasks: [], schedule: [], postits: []
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { 
      const parsed = JSON.parse(raw);
      state = Object.assign(state, parsed); 
      if (!state.errorTypes || !state.errorTypes.length) state.errorTypes = JSON.parse(JSON.stringify(DEFAULT_ERROR_TYPES));
      if (!Array.isArray(parsed.portals)) state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
    } else {
      state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
    }
    const rawSupa = localStorage.getItem(SUPA_KEY);
    if (rawSupa) supaConfig = Object.assign(supaConfig, JSON.parse(rawSupa));
    syncDirty = localStorage.getItem(DIRTY_KEY) === '1';
  } catch (e) {
    state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
  }
  lastDataSig = dataSig(); updateSyncIndicator(); renderPortals();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  const sig = dataSig();
  if (sig !== lastDataSig) {
    lastDataSig = sig; syncVersion++; syncDirty = true;
    try { localStorage.setItem(DIRTY_KEY, '1'); } catch (e) {}
    if (supaConfigured()) { clearTimeout(pushTimer); pushTimer = setTimeout(pushToSupabase, 700); }
  }
  updateSyncIndicator();
}


