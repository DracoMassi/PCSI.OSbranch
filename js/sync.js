// sync.js : synchronisation Supabase, modale Cloud, QR codes

// SYNC SUPABASE : INITIALISÉ EN MODE LOCAL (VIDE)
const DIRTY_KEY = 'pcsi_sync_dirty_v1';
let syncDirty = false, syncOk = false, lastSyncAt = null, syncVersion = 0, lastDataSig = '', pushTimer = null, lastAutoSync = 0;

let supaConfig = { syncId: '' }; // Mode Local-First
function dataSig() { return JSON.stringify({ t: state.tasks, s: state.schedule, p: state.postits, e: state.errorTypes, po: state.portals }); }
function supaConfigured() { return SUPABASE_URL !== '' && SUPABASE_KEY !== '' && supaConfig.syncId !== '' && !SUPABASE_URL.includes('TON_PROJET'); }
function supaEndpoint() { return `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/cockpit_sync`; }
function supaHeaders(extra) { return Object.assign({ 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }, extra || {}); }

function updateSyncIndicator() {
  const configured = supaConfigured();
  const inSync = configured && syncOk && !syncDirty && navigator.onLine !== false;
  document.querySelectorAll('.sync-dot').forEach(d => { d.classList.toggle('sync-ok', inSync); d.classList.toggle('sync-pending', !inSync); });
  const label = document.getElementById('sync-label');
  let text, tip;
  if (!configured) { text = 'Mode Local'; tip = 'Non connecté au Cloud'; }
  else if (inSync) { const t = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; text = 'Synchronisé'; tip = t ? `Synchro à ${t}` : 'Ok'; }
  else if (navigator.onLine === false) { text = 'Hors ligne'; tip = 'Hors ligne'; }
  else { text = 'Non synchronisé'; tip = syncDirty ? 'Modifications en attente' : 'En attente'; }
  if (label) label.textContent = text;
  document.querySelectorAll('.sync-dot').forEach(d => { d.title = tip; });
}

async function pushToSupabase() {
  if (!supaConfigured()) return false;
  const v = syncVersion;
  try {
    const res = await fetch(supaEndpoint(), { method: 'POST', headers: supaHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ id: supaConfig.syncId, payload: state }) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (v === syncVersion) { syncDirty = false; try { localStorage.removeItem(DIRTY_KEY); } catch (e) {} }
    syncOk = true; lastSyncAt = Date.now(); updateSyncIndicator(); return true;
  } catch (e) { updateSyncIndicator(); return false; }
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
  try {
    if (forceFetch || !syncDirty) {
      const res = await fetch(`${supaEndpoint()}?id=eq.${encodeURIComponent(supaConfig.syncId)}&select=payload`, { headers: supaHeaders() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = await res.json();
      if (rows && rows.length && rows[0].payload) {
        state = Object.assign(state, rows[0].payload); lastDataSig = dataSig(); syncDirty = false;
        if (!state.portals || !state.portals.length) state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS)); // Sécurité
        try { localStorage.removeItem(DIRTY_KEY); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
        syncOk = true; lastSyncAt = Date.now(); updateSyncIndicator(); 
        renderPortals(); renderActiveTab();
        if (!silent) showToast('Données actualisées depuis Supabase');
        if (refIco) setTimeout(() => refIco.classList.remove('animate-spin'), 350);
        return;
      }
    }
    const ok = await pushToSupabase();
    if (!silent) showToast(ok ? 'Données envoyées vers Supabase' : 'Échec de la synchronisation');
  } catch (e) { updateSyncIndicator(); if (!silent) showToast('Impossible de joindre Supabase'); }
  finally { if (refIco) setTimeout(() => refIco.classList.remove('animate-spin'), 350); }
};

window.addEventListener('online', () => { updateSyncIndicator(); if (supaConfigured()) window.syncNowSupabase({ silent: true }); });
window.addEventListener('offline', updateSyncIndicator);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && supaConfigured() && Date.now() - lastAutoSync > 20000) window.syncNowSupabase({ silent: true }); });


window.openSupabaseModal = function() { document.getElementById('supa-sync-id').value = supaConfig.syncId || ''; document.getElementById('supabase-modal').classList.add('open'); };
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


