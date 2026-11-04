// data.js : reset, export et import JSON

window.openResetModal = function() { document.getElementById('reset-modal').classList.add('open'); }; window.closeResetModal = function() { document.getElementById('reset-modal').classList.remove('open'); };
window.clearDoneMissions = function() { state.tasks = state.tasks.filter(t => t.status !== 'done'); saveState(); closeResetModal(); renderActiveTab(); showToast('Missions terminées purgées'); };
window.clearAllMissions = function() { state.tasks = []; saveState(); closeResetModal(); renderActiveTab(); showToast('Toutes les missions ont été supprimées'); };
window.factoryResetAll = function() { state.tasks = []; state.postits = []; state.schedule = []; state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS)); saveState(); closeResetModal(); renderActiveTab(); showToast('Plateforme entièrement remise à zéro'); };


window.exportJSON = function() { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cockpit_pcsi_${getOffsetDateISO(0)}.json`; a.click(); a.remove(); showToast('Sauvegarde JSON téléchargée'); };
window.importJSON = function(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { try { const imported = JSON.parse(ev.target.result); state = Object.assign(state, imported); if (!Array.isArray(state.portals)) state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS)); saveState(); renderPortals(); renderActiveTab(); showToast('Données restaurées avec succès'); } catch (err) { showToast('Fichier JSON invalide'); } }; r.readAsText(f); e.target.value = ''; };

