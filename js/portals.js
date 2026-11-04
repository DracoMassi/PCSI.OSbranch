// portals.js : portails CPGE (sidebar et onglet Sites)

// =========================================================
// GESTION DES PORTAILS CPGE (PC + MOBILE)
// =========================================================
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
  saveState(); closePortalModal(); renderPortals();
};

window.deletePortal = function() {
  const id = document.getElementById('port-id').value;
  if (!id) return;
  state.portals = state.portals.filter(p => p.id !== id);
  saveState(); closePortalModal(); renderPortals();
  showToast('Lien supprimé');
};


