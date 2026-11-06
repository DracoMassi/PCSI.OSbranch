// onboarding.js : parcours d'accueil guidé en 4 étapes & configuration rapide du rythme d'internat

let currentOnbStep = 1;
const TOTAL_ONB_STEPS = 4;

window.onbGoStep = function(step) {
  currentOnbStep = Math.max(1, Math.min(TOTAL_ONB_STEPS, parseInt(step, 10) || 1));
  document.querySelectorAll('.onb-step').forEach(el => {
    el.style.display = 'none';
  });
  const target = document.getElementById('onb-step-' + currentOnbStep);
  if (target) target.style.display = 'block';

  const stepLabel = document.getElementById('onb-header-step-label');
  if (stepLabel) {
    stepLabel.textContent = `ÉTAPE ${currentOnbStep} / ${TOTAL_ONB_STEPS}`;
  }

  document.querySelectorAll('.onb-dot').forEach((dot, idx) => {
    dot.classList.toggle('active', idx + 1 === currentOnbStep);
  });

  if (currentOnbStep === 4 && typeof window.focusModalInput === 'function') {
    window.focusModalInput('onb-sync-id');
  }
};

window.onbNextOrFinish = function() {
  if (currentOnbStep < TOTAL_ONB_STEPS) {
    window.onbGoStep(currentOnbStep + 1);
  } else {
    const syncInput = document.getElementById('onb-sync-id');
    const hasSyncId = syncInput && syncInput.value.trim().length > 0;
    window.finishOnboarding(hasSyncId);
  }
};

window.openOnboardingModal = function() {
  const cfg = (typeof state !== 'undefined' && state.settings) ? state.settings : DEFAULT_SETTINGS;
  const dStart = document.getElementById('onb-dinner-start');
  const dEnd = document.getElementById('onb-dinner-end');
  const bed = document.getElementById('onb-bedtime');
  if (dStart) dStart.value = cfg.dinnerStart || '19:00';
  if (dEnd) dEnd.value = cfg.dinnerEnd || '20:00';
  if (bed) bed.value = cfg.bedtime || '23:00';

  const onbSync = document.getElementById('onb-sync-id');
  if (onbSync) onbSync.value = (typeof supaConfig !== 'undefined' && supaConfig.syncId) ? supaConfig.syncId : '';

  window.onbGoStep(1);
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.add('open');
};

window.updateOnbRhythmSetting = function(key, val) {
  if (!val || typeof state === 'undefined') return;
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.settings[key] = val;
  saveState();
  if (typeof window.renderSettingsPanel === 'function' && state.activeTab === 'sites') {
    window.renderSettingsPanel();
  }
  if (typeof renderAgenda === 'function' && state.activeTab === 'agenda') {
    renderAgenda();
  }
};

function markOnboardingCompletedInProfile() {
  try {
    localStorage.setItem('pcsi_has_seen_tuto', '1');
  } catch (e) {}
  if (typeof state !== 'undefined') {
    if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    state.settings.onboardingCompleted = true;
    if (typeof saveUiPrefsLocal === 'function') saveUiPrefsLocal();
  }
}

window.skipOnboarding = function() {
  markOnboardingCompletedInProfile();
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.remove('open');
  showToast('Tutoriel passé · Disponible à tout moment dans Réglages');
};

window.finishOnboarding = function(connectSupa) {
  if (connectSupa) {
    const syncInput = document.getElementById('onb-sync-id');
    const syncId = syncInput ? syncInput.value.trim() : '';
    if (!syncId) {
      if (syncInput) syncInput.focus();
      showToast('Saisis un Sync ID ou clique sur "Démarrer sur PCSI.OS"');
      return;
    }
    markOnboardingCompletedInProfile();
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.remove('open');
    supaConfig.syncId = syncId;
    const supaInput = document.getElementById('supa-sync-id');
    if (supaInput) supaInput.value = syncId;
    try {
      localStorage.setItem(SUPA_KEY, JSON.stringify(supaConfig));
    } catch (e) {}
    syncOk = false;
    updateSyncIndicator();
    showToast('Synchronisation Cloud en cours...');
    window.syncNowSupabase({ forceFetch: true });
  } else {
    markOnboardingCompletedInProfile();
    const modal = document.getElementById('onboarding-modal');
    if (modal) modal.classList.remove('open');
    showToast('Cockpit PCSI.OS prêt 🚀');
  }
};
