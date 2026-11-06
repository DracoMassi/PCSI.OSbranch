// app.js : point d'entrée (DOMContentLoaded)

window.addEventListener('DOMContentLoaded', () => {
  if (typeof window.loadSiteBrandingFromRepo === 'function') {
    window.loadSiteBrandingFromRepo();
  }
  window.initCanvas();
  const calBox = document.getElementById('calendar-grid-box');
  let tx = 0, ty = 0;
  calBox.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  calBox.addEventListener('touchend', e => {
    if (!agendaIsMobile()) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) stepAgendaDay(dx < 0 ? 1 : -1);
  }, { passive: true });
  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { if (state.activeTab === 'agenda') renderAgenda(); }, 150);
  });

  loadState();
  document.getElementById('app-shell').classList.toggle('sidebar-collapsed', !!state.sidebarCollapsed);
  document.getElementById('qa-duedate').value = getOffsetDateISO(2);
  const firstSubj = Object.keys(SUBJECTS)[0] || 'maths';
  mountCustomSelect('qa-subject-select', 'qa-subj', getSubjectOptions(), firstSubj);
  goToToday();

  // Toujours démarrer sur la Grille Académique dans l'Agenda (et ouvrir directement l'Emploi du Temps Académique sur mobile)
  state.agendaSubTab = 'academic';
  switchTab(agendaIsMobile() ? 'agenda' : (state.activeTab || 'agenda'));

  if (typeof initDailyDrop === 'function') {
    initDailyDrop();
  }

  // Onboarding ou démarrage normal
  if (!localStorage.getItem('pcsi_has_seen_tuto')) {
    if (typeof window.openOnboardingModal === 'function') {
      window.openOnboardingModal();
    } else {
      document.getElementById('onboarding-modal').classList.add('open');
    }
  } else if (supaConfigured()) {
    window.syncNowSupabase({ silent: true });
  }
});
