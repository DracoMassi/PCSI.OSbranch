// onboarding.js : tutoriel et connexion initiale

// =========================================================
// LOGIQUE ONBOARDING & DÉMARRAGE
// =========================================================
window.onbGoStep = function(step) {
  document.querySelectorAll('.onb-step').forEach(el => el.style.display = 'none');
  const target = document.getElementById('onb-step-' + step);
  if (target) target.style.display = 'block';
};

window.openOnboardingModal = function() {
  window.onbGoStep(1);
  const onbSync = document.getElementById('onb-sync-id');
  if (onbSync) onbSync.value = supaConfig.syncId || '';
  document.getElementById('onboarding-modal').classList.add('open');
};

window.finishOnboarding = function(connectSupa) {
  if (connectSupa) {
    const syncInput = document.getElementById('onb-sync-id');
    const syncId = syncInput ? syncInput.value.trim() : '';
    if (!syncId) {
      if (syncInput) syncInput.focus();
      showToast('Saisis un Sync ID ou choisis "Commencer en local"');
      return;
    }
    localStorage.setItem('pcsi_has_seen_tuto', '1');
    document.getElementById('onboarding-modal').classList.remove('open');
    supaConfig.syncId = syncId;
    document.getElementById('supa-sync-id').value = syncId;
    localStorage.setItem(SUPA_KEY, JSON.stringify(supaConfig));
    syncOk = false;
    updateSyncIndicator();
    showToast('Synchronisation en cours...');
    window.syncNowSupabase({ forceFetch: true });
  } else {
    localStorage.setItem('pcsi_has_seen_tuto', '1');
    document.getElementById('onboarding-modal').classList.remove('open');
    showToast('Mode Local-First activé 🚀');
  }
};


