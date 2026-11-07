// sync.js : synchronisation Supabase, modale Cloud, QR codes

// SYNC SUPABASE : INITIALISÉ EN MODE LOCAL (VIDE)
const DIRTY_KEY = 'pcsi_sync_dirty_v1';
let syncDirty = false, syncOk = false, syncSaving = false, syncError = false, lastSyncAt = null, syncVersion = 0, lastDataSig = '', pushTimer = null, lastAutoSync = 0;

let supaConfig = { syncId: '' }; // Mode Local-First

// Réglages propres à cet appareil : jamais envoyés au cloud (clé API personnelle, cache des résultats IA).
const LOCAL_ONLY_SETTINGS = ['aiApiKey', 'aiCache'];
function settingsForSync(settings) {
  const copy = Object.assign({}, settings || {});
  LOCAL_ONLY_SETTINGS.forEach(k => { delete copy[k]; });
  return copy;
}
function statePayloadForSync() {
  return Object.assign({}, state, { settings: settingsForSync(state.settings) });
}

function dataSig(src) {
  const s = src || state;
  return JSON.stringify({
    t: s.tasks,
    s: s.schedule,
    sd: Array.isArray(s.scheduleDocs) ? s.scheduleDocs.map(d => d.id + ':' + (d.title || '')) : [],
    p: s.postits,
    e: s.errorTypes,
    po: s.portals,
    sub: s.subjects,
    tt: s.taskTypes,
    cfg: settingsForSync(s.settings),
    ev: s.eveningPlan
  });
}
function supaConfigured() { return SUPABASE_URL !== '' && SUPABASE_KEY !== '' && supaConfig.syncId !== '' && !SUPABASE_URL.includes('TON_PROJET'); }
function supaEndpoint() { return `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/cockpit_sync`; }
function supaHeaders(extra) { return Object.assign({ 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }, extra || {}); }

function updateSyncIndicator() {
  const configured = supaConfigured();
  const offline = navigator.onLine === false;
  const inSync = configured && syncOk && !syncDirty && !syncSaving && !syncError && !offline;
  const isSaving = configured && !offline && (syncSaving || syncDirty);
  const isError = configured && (offline || syncError);

  document.querySelectorAll('.sync-dot').forEach(d => {
    d.classList.remove('sync-ok', 'sync-pending', 'sync-saving', 'sync-error');
    if (!configured) {
      d.classList.add('sync-pending');
    } else if (isError) {
      d.classList.add('sync-error');
    } else if (isSaving) {
      d.classList.add('sync-saving');
    } else if (inSync) {
      d.classList.add('sync-ok');
    } else {
      d.classList.add('sync-pending');
    }
  });

  let text, headerText, tip;
  if (!configured) {
    text = 'Mode Local';
    headerText = 'Local-First';
    tip = 'Stockage local actif · Cliquer pour configurer Cloud Sync';
  } else if (isError) {
    text = offline ? 'Hors ligne' : 'Erreur réseau';
    headerText = offline ? 'Hors ligne' : 'Erreur réseau';
    tip = 'Échec de connexion au serveur Cloud Supabase';
  } else if (isSaving) {
    text = 'Sauvegarde en cours...';
    headerText = 'Sauvegarde en cours...';
    tip = 'Synchronisation des modifications vers le Cloud...';
  } else if (inSync) {
    const t = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    text = 'Synchronisé';
    headerText = 'Synchronisé';
    tip = t ? `Synchronisé avec Supabase à ${t}` : 'Synchronisé avec Supabase';
  } else {
    text = 'En attente...';
    headerText = 'En attente...';
    tip = 'Connexion Cloud en attente';
  }

  const label = document.getElementById('sync-label');
  if (label) label.textContent = text;
  const headerLabel = document.getElementById('header-sync-label');
  if (headerLabel) headerLabel.textContent = headerText;
  document.querySelectorAll('.sync-dot').forEach(d => { d.title = tip; });
}

async function pushToSupabase() {
  if (!supaConfigured()) return false;
  const v = syncVersion;
  syncSaving = true;
  syncError = false;
  updateSyncIndicator();
  try {
    const res = await fetch(supaEndpoint(), { method: 'POST', headers: supaHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ id: supaConfig.syncId, payload: statePayloadForSync() }) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (v === syncVersion) { syncDirty = false; try { localStorage.removeItem(DIRTY_KEY); } catch (e) {} }
    syncSaving = false;
    syncError = false;
    syncOk = true;
    lastSyncAt = Date.now();
    updateSyncIndicator();
    return true;
  } catch (e) {
    syncSaving = false;
    syncError = true;
    updateSyncIndicator();
    return false;
  }
}

window.syncNowSupabase = async function(opts) {
  const silent = !!(opts && opts.silent === true), forceFetch = !!(opts && opts.forceFetch === true);
  const refIco = document.getElementById('header-refresh-ico');
  if (refIco) refIco.classList.add('animate-spin');
  if (!supaConfigured()) { 
    if (refIco) refIco.classList.remove('animate-spin'); 
    if (!silent) window.openSupabaseModal();
    return; 
  }
  lastAutoSync = Date.now();
  // Une simple lecture (pull) n'est PAS une sauvegarde : on n'affiche pas "Sauvegarde en cours..."
  syncError = false;
  try {
    if (forceFetch || !syncDirty) {
      const res = await fetch(`${supaEndpoint()}?id=eq.${encodeURIComponent(supaConfig.syncId)}&select=payload`, { headers: supaHeaders() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = await res.json();
      if (rows && rows.length && rows[0].payload) {
        const remote = rows[0].payload;
        // Données Cloud identiques aux données locales : aucun changement, aucun re-rendu
        if (dataSig(remote) === dataSig()) {
          syncDirty = false;
          try { localStorage.removeItem(DIRTY_KEY); } catch (e) {}
          syncOk = true; lastSyncAt = Date.now(); updateSyncIndicator();
          if (!silent) showToast('Déjà à jour');
          return;
        }
        // Les réglages locaux (clé API, cache IA) survivent au pull : le cloud ne les contient pas.
        const localOnly = {};
        LOCAL_ONLY_SETTINGS.forEach(k => { if (state.settings && state.settings[k] !== undefined) localOnly[k] = state.settings[k]; });
        state = Object.assign(state, remote);
        state.settings = Object.assign({}, state.settings);
        LOCAL_ONLY_SETTINGS.forEach(k => { delete state.settings[k]; });
        Object.assign(state.settings, localOnly);
        if (!state.portals || !state.portals.length) state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
        if (!remote.subjects || typeof remote.subjects !== 'object' || Object.keys(remote.subjects).length === 0) {
          state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
        } else {
          state.subjects = remote.subjects;
        }
        if (!remote.taskTypes || typeof remote.taskTypes !== 'object' || Object.keys(remote.taskTypes).length === 0) {
          state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
        } else {
          state.taskTypes = remote.taskTypes;
        }
        syncSubjectsWithState();
        syncTaskTypesWithState();
        normalizeSettingsState();
        normalizeTasksState();
        lastDataSig = dataSig();
        syncDirty = false;
        syncSaving = false;
        syncError = false;
        try { localStorage.removeItem(DIRTY_KEY); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
        syncOk = true; lastSyncAt = Date.now(); updateSyncIndicator(); 
        if (typeof window.refreshAllSubjectSelects === 'function') window.refreshAllSubjectSelects();
        renderPortals(); renderActiveTab();
        if (!silent) showToast('Données actualisées depuis Supabase');
        return;
      }
    }
    const ok = await pushToSupabase();
    if (!silent) showToast(ok ? 'Données envoyées vers Supabase' : 'Échec de la synchronisation');
  } catch (e) {
    syncSaving = false;
    syncError = true;
    updateSyncIndicator();
    if (!silent) showToast('Impossible de joindre Supabase');
  }
  finally { if (refIco) setTimeout(() => refIco.classList.remove('animate-spin'), 350); }
};

window.addEventListener('online', () => { syncError = false; updateSyncIndicator(); if (supaConfigured()) window.syncNowSupabase({ silent: true }); });
window.addEventListener('offline', updateSyncIndicator);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && supaConfigured() && Date.now() - lastAutoSync > 60000) window.syncNowSupabase({ silent: true }); });


window.openSupabaseModal = function() {
  document.getElementById('supa-sync-id').value = supaConfig.syncId || '';
  document.getElementById('supabase-modal').classList.add('open');
  if (typeof window.focusModalInput === 'function') window.focusModalInput('supa-sync-id');
};
window.closeSupabaseModal = function() { document.getElementById('supabase-modal').classList.remove('open'); const qrBox = document.getElementById('supa-qr-box'); if (qrBox) qrBox.style.display = 'none'; };

window.saveSupabaseConfig = function(e) {
  if (e) e.preventDefault();
  supaConfig.syncId = document.getElementById('supa-sync-id').value.trim();
  localStorage.setItem(SUPA_KEY, JSON.stringify(supaConfig));
  syncOk = false;
  updateSyncIndicator();
  closeSupabaseModal();
  if (supaConfig.syncId) {
    showToast('Synchronisation en cours...');
    window.syncNowSupabase({ forceFetch: true });
  } else {
    showToast('Mode Local activé 🚀');
  }
};

window.showSupabaseQR = function() {
  const syncId = document.getElementById('supa-sync-id').value.trim() || supaConfig.syncId || 'pcsi_main';
  const qrBox = document.getElementById('supa-qr-box'); const mount = document.getElementById('supa-qrcode-canvas');
  mount.innerHTML = ''; qrBox.style.display = 'flex'; const payload = JSON.stringify({ type: 'pcsi_supa_config', syncId });
  if (window.QRCode) { new QRCode(mount, { text: payload, width: 200, height: 200, colorDark: '#090A0F', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
  } else { mount.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}" alt="QR Code" style="width:200px; height:200px;" />`; }
};

let html5QrScanner = null;
window.openQRScannerModal = function() {
  window.closeSupabaseModal(); document.getElementById('qr-scanner-modal').classList.add('open');
  if (window.Html5Qrcode) { try { if (html5QrScanner) { html5QrScanner.stop().catch(() => {}).then(() => startCam()); } else { startCam(); } } catch (err) {}
  } else { showToast('Module de scan non disponible, utilise le fichier image'); }
  function startCam() {
    html5QrScanner = new Html5Qrcode('qr-reader');
    html5QrScanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (decodedText) => { handleDecodedQR(decodedText); }, () => {}).catch(err => { document.getElementById('qr-reader').innerHTML = `<div style="padding:30px 14px; text-align:center; color:var(--text-muted); font-size:12px;">Accès caméra non autorisé ou non supporté.<br>Utilise le bouton <b>Choisir une image</b> ci-dessous.</div>`; });
  }
};
window.closeQRScannerModal = function() { document.getElementById('qr-scanner-modal').classList.remove('open'); if (html5QrScanner) { try { html5QrScanner.stop().then(() => { html5QrScanner.clear(); html5QrScanner = null; }).catch(() => { html5QrScanner = null; }); } catch (e) { html5QrScanner = null; } } };
window.scanQRFromFile = function(e) { const file = e.target.files && e.target.files[0]; if (!file) return; if (!window.Html5Qrcode) { showToast('Lecteur QR non chargé'); return; } const scanner = html5QrScanner || new Html5Qrcode('qr-reader'); scanner.scanFile(file, true).then(decodedText => { handleDecodedQR(decodedText); }).catch(err => { showToast('Aucun QR code lisible'); }); };

function handleDecodedQR(decodedText) {
  try {
    let data = null; if (decodedText.startsWith('{')) data = JSON.parse(decodedText);
    if (data && data.syncId) {
      supaConfig.syncId = (data.syncId || '').trim();
      localStorage.setItem(SUPA_KEY, JSON.stringify(supaConfig));
      
      document.getElementById('supa-sync-id').value = supaConfig.syncId;
      const onbSync = document.getElementById('onb-sync-id');
      if (onbSync) onbSync.value = supaConfig.syncId;
      
      window.closeQRScannerModal(); syncOk = false; updateSyncIndicator();
      showToast('Connecté à l\'espace : ' + supaConfig.syncId);
      window.syncNowSupabase({ forceFetch: true });

      if (document.getElementById('onboarding-modal').classList.contains('open')) {
         window.finishOnboarding(false);
      }
      return;
    }
  } catch (e) {} showToast('QR code invalide');
}
