// daily_drop.js : Daily Drop (English & Humanities Culture Hub + Press Kiosk Dock)

let dailyCultureData = null;
let currentDropIndex = 0;
let currentFocusTab = null; // 'vocab' | 'grammar'
let cultureGExpanded = false;

const FALLBACK_DAILY_CULTURE = {
  pressKiosk: {
    newsAndGeopolitics: [
      { id: 'kiosk_guardian', name: 'The Guardian', tag: 'UK · Politics & Editorial', desc: 'Analyses politiques, débats de société britanniques et éditoriaux de référence pour la synthèse CPGE.', url: 'https://www.theguardian.com/international', icon: 'ph-newspaper', accent: '#3B82F6' },
      { id: 'kiosk_bbc', name: 'BBC News', tag: 'UK · World Affairs', desc: 'Dépêches diplomatiques mondiales, idiomatisme britannique et grands dossiers internationaux.', url: 'https://www.bbc.com/news/world', icon: 'ph-globe-hemisphere-west', accent: '#EF4444' },
      { id: 'kiosk_economist', name: 'The Economist', tag: 'UK · Geopolitics & Policy', desc: 'Le style argumentatif roi des concours (CCINP, Mines-Ponts, Centrale, X-ENS).', url: 'https://www.economist.com/', icon: 'ph-chart-line-up', accent: '#F97316' },
      { id: 'kiosk_foreign_affairs', name: 'Foreign Affairs', tag: 'US · Diplomacy & Strategy', desc: 'Essais de référence sur les relations internationales, la souveraineté et les équilibres mondiaux.', url: 'https://www.foreignaffairs.com/', icon: 'ph-compass', accent: '#10B981' }
    ],
    cultureAndLongform: [
      { id: 'kiosk_atlantic', name: 'The Atlantic', tag: 'US · Culture, History & Politics', desc: 'Grands reportages littéraires, philosophie politique et critique culturelle américaine.', url: 'https://www.theatlantic.com/world/', icon: 'ph-feather', accent: '#A855F7' },
      { id: 'kiosk_newyorker', name: 'The New Yorker', tag: 'US · Literature, Arts & Essays', desc: 'Critique littéraire, portraits historiques et chroniques sociétales au vocabulaire d\'élite.', url: 'https://www.newyorker.com/', icon: 'ph-book-open-text', accent: '#EAB308' },
      { id: 'kiosk_nyt', name: 'The New York Times', tag: 'US · World & Opinion', desc: 'Perspective américaine sur les mutations démocratiques, le droit et la diplomatie.', url: 'https://www.nytimes.com/section/world', icon: 'ph-buildings', accent: '#F8FAFC' },
      { id: 'kiosk_ft', name: 'Financial Times', tag: 'UK · Global Economy & Society', desc: 'Décryptage des grands basculements géoéconomiques, commerciaux et institutionnels.', url: 'https://www.ft.com/world', icon: 'ph-bank', accent: '#06B6D4' }
    ]
  },
  drops: [
    {
      id: 'drop_01',
      theme: 'Tournants historiques & Faux-amis classiques',
      wordOfTheDay: {
        word: 'A turning point / A watershed',
        phonetic: '/ˈwɔː.tə.ʃed/',
        partOfSpeech: 'nom',
        meaning: 'Un grand tournant décisif (le moment où tout bascule)',
        example: 'The fall of the Berlin Wall in 1989 was a major watershed in European history.',
        exampleTranslation: "La chute du mur de Berlin en 1989 a été un grand tournant dans l'histoire européenne.",
        collocations: ['a major watershed (un tournant majeur)', 'reach a turning point (atteindre un point de bascule)', 'a historic milestone (une étape historique)']
      },
      dailyFocus: {
        defaultMode: 'grammar',
        topicTitle: 'Exprimer un changement important',
        topicalWords: [
          { term: 'To trigger / To spark', translation: 'Déclencher / Provoquer (une crise, un débat)', note: "Bien meilleur que 'to cause'. Ex: The new law sparked protests." },
          { term: 'A bone of contention', translation: 'Un sujet de désaccord / Une pomme de discorde', note: 'Ex: Money remains a major bone of contention between them.' },
          { term: 'To strengthen / To shore up', translation: 'Renforcer / Consolider', note: 'Ex: Measures to strengthen the economy.' },
          { term: 'Ineffective / Toothless', translation: 'Inefficace / Sans vrai pouvoir de sanction', note: "Ex: Critics called the law toothless (littéralement : 'sans dents')." },
          { term: 'At stake', translation: 'En jeu', note: "Ex: Thousands of jobs are at stake (Des milliers d'emplois sont en jeu)." }
        ],
        grammarTraps: [
          {
            title: 'Faux-ami n°1 : « Actually » ne veut PAS dire « actuellement » !',
            rule: "En anglais, « actually » veut dire « en fait / en réalité ». Pour dire « actuellement / en ce moment », il faut toujours utiliser « currently » ou « nowadays ».",
            wrong: "He is actually working in London this month. (Faux si on veut dire 'en ce moment')",
            right: 'He is currently working in London. / Actually, he prefers Paris. (En fait, il préfère Paris)'
          },
          {
            title: 'Faux-ami n°2 : « Comprehensive » ne veut PAS dire « compréhensif » !',
            rule: "« Comprehensive » signifie « complet / approfondi » (comme dans 'une étude complète'). Pour dire que quelqu'un est compréhensif (gentil, à l'écoute), on dit « understanding ».",
            wrong: 'My teacher was very comprehensive when I explained my problem.',
            right: 'My teacher was very understanding. / We need a comprehensive solution (une solution complète).'
          }
        ]
      },
      articleOfTheDay: {
        title: 'How Diplomacy Works in a Divided World',
        source: 'Foreign Affairs',
        category: 'Géopolitique',
        readingTime: '5 min',
        abstract: "Comment les pays négocient entre eux aujourd'hui lorsque l'ONU et les alliances traditionnelles sont bloquées.",
        url: 'https://www.foreignaffairs.com/world'
      },
      cultureGNiche: {
        category: 'Histoire & Géopolitique',
        title: '1648 : La Paix de Westphalie, le jour où sont nés les États modernes',
        hook: "Aujourd'hui, l'idée que chaque pays a des frontières fixes et qu'aucun État étranger n'a le droit de lui dicter ses lois nous paraît évidente. Pourtant, cette règle a une date de naissance précise : les traités de Westphalie en 1648.",
        details: "Au XVIIe siècle, l'Europe sort de la guerre de Trente Ans (1618-1648), un conflit religieux atroce entre catholiques et protestants qui a tué près d'un tiers de la population allemande. Pour arrêter le massacre, les diplomates européens inventent en 1648 un système tout simple mais révolutionnaire : désormais, chaque État est « souverain » chez lui. Cela veut dire deux choses : 1) tous les pays sont juridiquement égaux (petits ou grands), et 2) aucun pays n'a le droit d'intervenir dans les affaires intérieures de son voisin au nom de la religion ou de la morale. 💡 En dissertation ou en colle : c'est l'exemple parfait pour expliquer comment on fait la paix entre des gens qui ne sont pas d'accord — en fixant des règles communes plutôt qu'en cherchant à imposer ses idées par la force."
      }
    }
  ]
};

function getDayOfYearIndex(totalCount) {
  if (!totalCount || totalCount <= 1) return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return dayOfYear % totalCount;
}

async function initDailyDrop() {
  try {
    const res = await fetch('data/daily_culture.json');
    if (res.ok) {
      dailyCultureData = await res.json();
    } else {
      dailyCultureData = FALLBACK_DAILY_CULTURE;
    }
  } catch (e) {
    dailyCultureData = FALLBACK_DAILY_CULTURE;
  }

  const drops = (dailyCultureData && Array.isArray(dailyCultureData.drops)) ? dailyCultureData.drops : FALLBACK_DAILY_CULTURE.drops;
  currentDropIndex = getDayOfYearIndex(drops.length);
  const todayDrop = drops[currentDropIndex] || drops[0];
  currentFocusTab = (todayDrop && todayDrop.dailyFocus && todayDrop.dailyFocus.defaultMode) || 'grammar';
  cultureGExpanded = false;

  checkDailyDropFirstVisit();
  if (state.activeTab === 'dailydrop') {
    renderDailyDrop();
  }
}

function checkDailyDropFirstVisit() {
  const todayISO = formatDateISO(new Date());
  let seenDate = '';
  try { seenDate = localStorage.getItem(DAILY_DROP_SEEN_KEY) || ''; } catch (e) {}

  const isUnread = seenDate !== todayISO;
  updateDailyDropBadges(isUnread);

  // Sur téléphone / mobile, ne jamais afficher de pop-up Daily Drop (uniquement le petit point discret sur l'onglet)
  const isMobileScreen = window.innerWidth <= 900 || (typeof agendaIsMobile === 'function' && agendaIsMobile());
  if (isUnread && !isMobileScreen) {
    setTimeout(() => {
      if (window.innerWidth <= 900 || (typeof agendaIsMobile === 'function' && agendaIsMobile())) return;
      const onb = document.getElementById('onboarding-modal');
      if (onb && onb.classList.contains('open')) return;
      if (state.activeTab === 'dailydrop') return;
      showDailyDropInviteBanner();
    }, 1100);
  }
}

function updateDailyDropBadges(show) {
  ['dailydrop-nav-badge', 'mob-dailydrop-nav-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'inline-block' : 'none';
  });
}

function showDailyDropInviteBanner() {
  const banner = document.getElementById('daily-drop-invite-toast');
  if (!banner) return;
  const drops = (dailyCultureData && dailyCultureData.drops) || FALLBACK_DAILY_CULTURE.drops;
  const drop = drops[currentDropIndex] || drops[0];
  const wordSpan = document.getElementById('dd-toast-word');
  if (wordSpan && drop && drop.wordOfTheDay) {
    wordSpan.textContent = `"${drop.wordOfTheDay.word}" & Culture G`;
  }
  banner.classList.add('show');
}

window.dismissDailyDropBanner = function(markSeen = false) {
  const banner = document.getElementById('daily-drop-invite-toast');
  if (banner) banner.classList.remove('show');
  if (markSeen) {
    try { localStorage.setItem(DAILY_DROP_SEEN_KEY, formatDateISO(new Date())); } catch (e) {}
    updateDailyDropBadges(false);
  }
};

window.openDailyDropFromBanner = function() {
  window.dismissDailyDropBanner(true);
  window.switchTab('dailydrop');
};

window.stepDailyDropEdition = function(delta) {
  const drops = (dailyCultureData && dailyCultureData.drops) || FALLBACK_DAILY_CULTURE.drops;
  if (!drops.length) return;
  if (delta === 0) {
    currentDropIndex = getDayOfYearIndex(drops.length);
  } else {
    currentDropIndex = (currentDropIndex + delta + drops.length) % drops.length;
  }
  const d = drops[currentDropIndex];
  currentFocusTab = (d && d.dailyFocus && d.dailyFocus.defaultMode) || 'grammar';
  cultureGExpanded = false;
  renderDailyDrop();
};

window.setDailyFocusTab = function(mode) {
  currentFocusTab = mode === 'vocab' ? 'vocab' : 'grammar';
  renderDailyDrop();
};

window.toggleCultureGAccordion = function() {
  cultureGExpanded = !cultureGExpanded;
  const body = document.getElementById('culture-g-accordion-body');
  const btn = document.getElementById('culture-g-accordion-btn');
  if (body) body.style.display = cultureGExpanded ? 'block' : 'none';
  if (btn) {
    btn.innerHTML = cultureGExpanded
      ? `<i class="ph-bold ph-caret-up"></i> <span>Masquer l'analyse détaillée</span>`
      : `<i class="ph-bold ph-book-open-text"></i> <span>En savoir plus (Analyse &amp; Références Concours)</span>`;
  }
};

let currentDropAnkiItems = [];

function registerAnkiItem(front, back, tag = 'Vocabulaire') {
  const idx = currentDropAnkiItems.length;
  currentDropAnkiItems.push({ front: String(front || ''), back: String(back || ''), tag });
  return idx;
}

function renderAnkiTriggerBtn(ankiIdx, label = '+ Anki') {
  return `<button type="button" onclick="event.stopPropagation(); window.openAnkiPopinByIndex(${ankiIdx})" class="btn-ghost dd-anki-btn mono" style="padding:2px 8px; font-size:10.5px; font-weight:700; color:#38BDF8; border-color:rgba(56,189,248,0.32); background:rgba(56,189,248,0.08); border-radius:6px;" title="Envoyer vers Anki via AnkiConnect (localhost:8765)">[${escapeHtml(label)}]</button>`;
}

function ensureAnkiModalMounted() {
  if (document.getElementById('anki-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'anki-modal';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:9px;">
          <span style="width:32px; height:32px; border-radius:9px; background:rgba(56,189,248,0.14); border:1px solid rgba(56,189,248,0.32); color:#38BDF8; display:inline-flex; align-items:center; justify-content:center; font-size:16px;">
            <i class="ph-bold ph-cards"></i>
          </span>
          <div>
            <h3 style="font-size:15px; font-weight:700;">Ajouter à Anki (AnkiConnect)</h3>
            <div class="mono" style="font-size:10.5px; color:var(--text-subtle);">POST http://localhost:8765 · Note Type : Basic</div>
          </div>
        </div>
        <button type="button" onclick="window.closeAnkiModal()" class="btn-ghost" style="padding:4px 7px; border:none;"><i class="ph ph-x"></i></button>
      </div>
      <form onsubmit="window.submitAnkiCard(event)" style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="font-size:11.5px; font-weight:600; color:var(--text-muted); display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Target Anki Deck <small style="color:var(--text-subtle);">(Syntaxe Parent::Enfant)</small></span>
            <span class="mono" style="font-size:10px; color:#38BDF8;">Défaut : PCSI::Vocabulaire</span>
          </label>
          <input type="text" id="anki-deck-input" class="saas-input mono" placeholder="PCSI::Vocabulaire" />
        </div>
        <div>
          <label style="font-size:11.5px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px;">Front (Recto — Mot, Expression ou Notion) *</label>
          <input type="text" id="anki-front-input" class="saas-input" required />
        </div>
        <div>
          <label style="font-size:11.5px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px;">Back (Verso — Traduction, Définition &amp; Exemple) *</label>
          <textarea id="anki-back-input" class="saas-input" rows="4" style="resize:vertical;" required></textarea>
        </div>
        <div id="anki-modal-status" style="display:none; font-size:11.5px; padding:8px 10px; border-radius:8px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
          <button type="button" onclick="window.closeAnkiModal()" class="btn-ghost">Annuler</button>
          <button type="submit" id="anki-submit-btn" class="btn-primary">
            <i class="ph-bold ph-paper-plane-tilt"></i> <span>Ajouter la carte</span>
          </button>
        </div>
      </form>
    </div>
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) window.closeAnkiModal();
  });
  document.body.appendChild(modal);
}

window.openAnkiModal = function(front = '', back = '', customDeck = null) {
  ensureAnkiModalMounted();
  const cfg = (typeof state !== 'undefined' && state.settings) ? state.settings : DEFAULT_SETTINGS;
  const targetDeck = String(customDeck || cfg.ankiDeck || 'PCSI::Vocabulaire').trim() || 'PCSI::Vocabulaire';

  const deckEl = document.getElementById('anki-deck-input');
  const frontEl = document.getElementById('anki-front-input');
  const backEl = document.getElementById('anki-back-input');
  const statusEl = document.getElementById('anki-modal-status');

  if (deckEl) deckEl.value = targetDeck;
  if (frontEl) frontEl.value = front || '';
  if (backEl) backEl.value = back || '';
  if (statusEl) {
    statusEl.style.display = 'none';
    statusEl.textContent = '';
  }

  const m = document.getElementById('anki-modal');
  if (m) m.classList.add('open');
  if (typeof window.focusModalInput === 'function') window.focusModalInput('anki-front-input');
};

window.openAnkiPopinByIndex = function(idx) {
  const item = currentDropAnkiItems[idx];
  if (!item) return;
  window.openAnkiModal(item.front, item.back);
};

window.closeAnkiModal = function() {
  const m = document.getElementById('anki-modal');
  if (m) m.classList.remove('open');
};

window.submitAnkiCard = async function(e) {
  if (e) e.preventDefault();
  const deckEl = document.getElementById('anki-deck-input');
  const frontEl = document.getElementById('anki-front-input');
  const backEl = document.getElementById('anki-back-input');
  const btn = document.getElementById('anki-submit-btn');
  const statusEl = document.getElementById('anki-modal-status');

  const deckName = String(deckEl ? deckEl.value : '').trim() || 'PCSI::Vocabulaire';
  const frontRaw = String(frontEl ? frontEl.value : '').trim();
  const backRaw = String(backEl ? backEl.value : '').trim();

  if (!frontRaw || !backRaw) {
    showToast('Renseigne le Recto (Front) et le Verso (Back)');
    return;
  }

  // Sauvegarder le deck cible s'il a été personnalisé
  if (typeof state !== 'undefined' && state.settings) {
    state.settings.ankiDeck = deckName;
    if (typeof saveState === 'function') saveState();
  }

  const frontHtml = escapeHtml(frontRaw).replace(/\r?\n/g, '<br>');
  const backHtml = escapeHtml(backRaw).replace(/\r?\n/g, '<br>');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner"></i> <span>Connexion à Anki...</span>`;
  }

  try {
    // 1. Créer le deck (supporte la hiérarchie Parent::Child) au cas où il n'existe pas encore dans Anki
    await fetch('http://localhost:8765', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createDeck',
        version: 6,
        params: { deck: deckName }
      })
    });

    // 2. Appel addNote via AnkiConnect
    const res = await fetch('http://localhost:8765', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addNote',
        version: 6,
        params: {
          note: {
            deckName,
            modelName: 'Basic',
            fields: {
              Front: frontHtml,
              Back: backHtml
            },
            options: {
              allowDuplicate: false,
              duplicateScope: 'deck'
            },
            tags: ['pcsi_os', 'daily_drop']
          }
        }
      })
    });

    const data = await res.json();
    if (data && data.error) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(245, 158, 11, 0.14)';
        statusEl.style.border = '1px solid rgba(245, 158, 11, 0.35)';
        statusEl.style.color = '#FBBF24';
        statusEl.textContent = `AnkiConnect : ${data.error}`;
      }
      showToast(`Anki : ${data.error}`);
    } else {
      window.closeAnkiModal();
      showToast(`Carte ajoutée dans Anki (${deckName}) ✓`);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(239, 68, 68, 0.12)';
      statusEl.style.border = '1px solid rgba(239, 68, 68, 0.35)';
      statusEl.style.color = '#FCA5A5';
      statusEl.innerHTML = `Impossible de joindre <b>http://localhost:8765</b>. Vérifie qu'<b>Anki</b> est ouvert sur ton ordinateur avec l'extension <b>AnkiConnect</b> (code <code class="mono">2055492159</code>).`;
    }
    showToast('Anki non détecté sur localhost:8765 (vérifie qu\'Anki est ouvert)');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-paper-plane-tilt"></i> <span>Ajouter la carte</span>`;
    }
  }
};

function renderDailyDrop() {
  try { localStorage.setItem(DAILY_DROP_SEEN_KEY, formatDateISO(new Date())); } catch (e) {}
  updateDailyDropBadges(false);
  window.dismissDailyDropBanner(false);

  const mount = document.getElementById('daily-drop-mount');
  if (!mount) return;
  currentDropAnkiItems = [];

  const data = dailyCultureData || FALLBACK_DAILY_CULTURE;
  const drops = (data && Array.isArray(data.drops) && data.drops.length) ? data.drops : FALLBACK_DAILY_CULTURE.drops;
  const drop = drops[currentDropIndex] || drops[0];
  const todayIdx = getDayOfYearIndex(drops.length);
  const isTodayEdition = currentDropIndex === todayIdx;

  const w = drop.wordOfTheDay || {};
  const f = drop.dailyFocus || {};
  const art = drop.articleOfTheDay || {};
  const cg = drop.cultureGNiche || {};
  const kiosk = data.pressKiosk || FALLBACK_DAILY_CULTURE.pressKiosk;
  const newsKiosk = kiosk.newsAndGeopolitics || kiosk.newsAndWorld || [];
  const cultureKiosk = kiosk.cultureAndLongform || kiosk.scienceAndEssays || [];

  const focusMode = currentFocusTab || f.defaultMode || 'grammar';

  // Enregistrer le Word of the Day pour AnkiConnect
  const wotdBackParts = [w.meaning || ''];
  if (w.example) wotdBackParts.push(`Ex: "${w.example}"`);
  if (w.exampleTranslation) wotdBackParts.push(`→ ${w.exampleTranslation}`);
  const wotdAnkiIdx = registerAnkiItem(
    `${w.word || ''}${w.phonetic ? ' ' + w.phonetic : ''}`,
    wotdBackParts.filter(Boolean).join('\n')
  );

  // Enregistrer la notion de Culture G pour AnkiConnect
  const cgAnkiIdx = registerAnkiItem(
    cg.title || 'Notion Culture G',
    `${cg.hook || ''}${cg.category ? '\n[' + cg.category + ']' : ''}`
  );

  const focusContentHtml = focusMode === 'vocab'
    ? `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${(f.topicalWords || []).map((item, idx) => {
          const itemAnkiIdx = registerAnkiItem(
            item.term,
            `${item.translation || ''}${item.note ? '\nNote : ' + item.note : ''}`
          );
          return `
            <div class="dd-vocab-row">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <span style="font-weight:700; font-size:13.5px; color:#F8FAFC;">
                  <span class="mono" style="font-size:11px; color:#EAB308; margin-right:6px;">0${idx + 1}.</span>${escapeHtml(item.term)}
                </span>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="font-size:12.5px; font-weight:600; color:#38BDF8;">${escapeHtml(item.translation)}</span>
                  ${renderAnkiTriggerBtn(itemAnkiIdx)}
                </div>
              </div>
              ${item.note ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:3px; font-style:italic;">${escapeHtml(item.note)}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `
    : `
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${(f.grammarTraps || []).map((gt, idx) => {
          const gtAnkiIdx = registerAnkiItem(
            gt.title,
            `${gt.rule || ''}\n✓ ${gt.right || ''}\n(✗ ${gt.wrong || ''})`
          );
          return `
            <div class="dd-grammar-card">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span class="mono" style="font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:6px; background:rgba(239, 68, 68, 0.16); border:1px solid rgba(239, 68, 68, 0.35); color:#F87171;">PIÈGE #${idx + 1}</span>
                  <span style="font-weight:700; font-size:13.5px; color:var(--text-main);">${escapeHtml(gt.title)}</span>
                </div>
                ${renderAnkiTriggerBtn(gtAnkiIdx)}
              </div>
              <p style="font-size:12.5px; color:var(--text-muted); line-height:1.55; margin-bottom:10px;">${escapeHtml(gt.rule)}</p>
              <div class="dd-trap-compare-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:8px;">
                <div style="padding:8px 10px; border-radius:8px; background:rgba(239, 68, 68, 0.08); border:1px solid rgba(239, 68, 68, 0.22); font-size:12px;">
                  <div class="mono" style="font-size:10px; font-weight:700; color:#F87171; margin-bottom:2px;">✗ ERREUR CLASSIQUE</div>
                  <div style="color:#FCA5A5; text-decoration:line-through;">${escapeHtml(gt.wrong)}</div>
                </div>
                <div style="padding:8px 10px; border-radius:8px; background:rgba(16, 185, 129, 0.08); border:1px solid rgba(16, 185, 129, 0.25); font-size:12px;">
                  <div class="mono" style="font-size:10px; font-weight:700; color:#34D399; margin-bottom:2px;">✓ BON ANGLAIS</div>
                  <div style="color:#D1FAE5; font-weight:600;">${escapeHtml(gt.right)}</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

  const currentDeckBadge = (typeof state !== 'undefined' && state.settings && state.settings.ankiDeck)
    ? state.settings.ankiDeck
    : 'PCSI::Vocabulaire';

  mount.innerHTML = `
    <!-- BARRE D'ÉDITION DU JOUR -->
    <div class="saas-card dd-header-bar" style="padding:16px 20px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:12px; min-width:0;">
        <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, rgba(234,179,8,0.2), rgba(59,130,246,0.2)); border:1px solid rgba(255,255,255,0.14); display:flex; align-items:center; justify-content:center; font-size:20px; color:#FACC15; flex-shrink:0;">
          <i class="ph-bold ph-sparkle"></i>
        </div>
        <div style="min-width:0;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="mono" style="font-size:10.5px; font-weight:700; color:#FACC15; text-transform:uppercase; letter-spacing:0.06em;">DAILY DROP · ÉDITION #${currentDropIndex + 1}/${drops.length}</span>
            ${isTodayEdition ? `<span class="mono" style="font-size:10px; padding:1px 7px; border-radius:99px; background:rgba(16,185,129,0.16); border:1px solid rgba(16,185,129,0.35); color:#34D399;">AUJOURD'HUI</span>` : ''}
            <span class="mono" style="font-size:10px; padding:1px 7px; border-radius:99px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); color:#38BDF8;" title="Deck Anki cible configurable dans les Paramètres">Deck : ${escapeHtml(currentDeckBadge)}</span>
          </div>
          <h2 style="font-size:15.5px; font-weight:700; color:var(--text-main);">${escapeHtml(drop.theme || 'English & Humanités CPGE')}</h2>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <button type="button" onclick="window.stepDailyDropEdition(-1)" class="btn-ghost" style="padding:6px 10px;" title="Édition précédente"><i class="ph-bold ph-caret-left"></i></button>
        <button type="button" onclick="window.stepDailyDropEdition(0)" class="btn-ghost ${isTodayEdition ? 'active-pill' : ''}" style="padding:6px 12px; font-size:12px;">Drop du jour</button>
        <button type="button" onclick="window.stepDailyDropEdition(1)" class="btn-ghost" style="padding:6px 10px;" title="Édition suivante"><i class="ph-bold ph-caret-right"></i></button>
      </div>
    </div>

    <!-- GRILLE PRINCIPALE : WORD OF THE DAY + DAILY FOCUS -->
    <div class="dd-compartment-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-bottom:16px;">
      
      <!-- 1. WORD OF THE DAY (ENGLISH) -->
      <div class="saas-card dd-card" style="padding:20px 22px; display:flex; flex-direction:column; justify-content:space-between; border-top:2px solid #EAB308;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
            <span class="mono" style="font-size:10.5px; font-weight:700; color:#EAB308; text-transform:uppercase; letter-spacing:0.06em;">
              <i class="ph-bold ph-translate"></i> Word of the Day · English
            </span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="mono" style="font-size:11px; color:var(--text-subtle);">${escapeHtml(w.partOfSpeech || 'noun')}</span>
              ${renderAnkiTriggerBtn(wotdAnkiIdx)}
            </div>
          </div>

          <div style="display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:6px;">
            <h3 style="font-size:26px; font-weight:800; letter-spacing:-0.02em; color:#F8FAFC;">${escapeHtml(w.word || '')}</h3>
            <span class="mono" style="font-size:13.5px; color:#38BDF8;">${escapeHtml(w.phonetic || '')}</span>
          </div>

          <div style="font-size:13px; font-weight:600; color:var(--text-muted); margin-bottom:14px;">
            ${escapeHtml(w.meaning || '')}
          </div>

          <div style="padding:12px 14px; border-radius:10px; background:rgba(255,255,255,0.03); border-left:3px solid #EAB308; margin-bottom:14px;">
            <div class="mono" style="font-size:10px; color:var(--text-subtle); text-transform:uppercase; margin-bottom:4px;">Exemple en contexte</div>
            <p style="font-size:13px; color:var(--text-main); font-style:italic; line-height:1.55;">"${escapeHtml(w.example || '')}"</p>
            ${w.exampleTranslation ? `<p style="font-size:12px; color:var(--text-muted); margin-top:5px; line-height:1.45;">→ ${escapeHtml(w.exampleTranslation)}</p>` : ''}
          </div>
        </div>

        <div>
          <div class="mono" style="font-size:10.5px; font-weight:700; color:var(--text-subtle); text-transform:uppercase; margin-bottom:8px;">Expressions prêtes à l'emploi</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${(w.collocations || []).map(col => {
              const colAnkiIdx = registerAnkiItem(col, `${w.word || ''} — ${w.meaning || ''}`);
              return `
                <span class="mono" style="display:inline-flex; align-items:center; gap:6px; font-size:11.5px; padding:4px 9px; border-radius:7px; background:rgba(234, 179, 8, 0.1); border:1px solid rgba(234, 179, 8, 0.25); color:#FEF08A;">
                  <span>${escapeHtml(col)}</span>
                  <button type="button" onclick="event.stopPropagation(); window.openAnkiPopinByIndex(${colAnkiIdx})" style="background:none; border:none; color:#38BDF8; font-weight:800; font-size:10px; cursor:pointer; padding:0;" title="Ajouter cette expression à Anki">[+ Anki]</button>
                </span>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- 2. DAILY FOCUS (5 TOPICAL WORDS OR 2 GRAMMAR TRAPS) -->
      <div class="saas-card dd-card" style="padding:20px 22px; border-top:2px solid #38BDF8;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
          <div>
            <span class="mono" style="font-size:10.5px; font-weight:700; color:#38BDF8; text-transform:uppercase; letter-spacing:0.06em;">
              <i class="ph-bold ph-crosshair"></i> Anglais Pratique · ${escapeHtml(f.topicTitle || 'À retenir')}
            </span>
          </div>
          <div style="display:flex; gap:4px; background:rgba(255,255,255,0.03); padding:3px; border-radius:9px; border:1px solid var(--border-subtle);">
            <button type="button" onclick="window.setDailyFocusTab('grammar')" class="btn-ghost ${focusMode === 'grammar' ? 'active-pill' : ''}" style="padding:5px 10px; font-size:11px; border:none;">
              2 Pièges à éviter
            </button>
            <button type="button" onclick="window.setDailyFocusTab('vocab')" class="btn-ghost ${focusMode === 'vocab' ? 'active-pill' : ''}" style="padding:5px 10px; font-size:11px; border:none;">
              5 Mots utiles
            </button>
          </div>
        </div>
        ${focusContentHtml}
      </div>
    </div>

    <!-- GRILLE SECONDAIRE : CULTURE G DE NICHE (FR) + ARTICLE OF THE DAY (EN) -->
    <div class="dd-compartment-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-bottom:24px;">
      
      <!-- 3. CULTURE G DE NICHE (STRICTEMENT EN FRANÇAIS - HUMANITÉS / HISTOIRE / PHILO / LITTÉRATURE / GÉOPOLITIQUE) -->
      <div class="saas-card dd-card" style="padding:20px 22px; display:flex; flex-direction:column; justify-content:space-between; border-top:2px solid #A855F7;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
            <span class="mono" style="font-size:10.5px; font-weight:700; color:#C084FC; text-transform:uppercase; letter-spacing:0.06em;">
              <i class="ph-bold ph-feather"></i> Culture G de Niche · Lettres, Histoire &amp; Philosophie
            </span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="mono" style="font-size:10.5px; padding:2px 8px; border-radius:6px; background:rgba(168, 85, 247, 0.15); border:1px solid rgba(168, 85, 247, 0.3); color:#D8B4FE;">
                ${escapeHtml(cg.category || 'Philosophie & Histoire')}
              </span>
              ${renderAnkiTriggerBtn(cgAnkiIdx)}
            </div>
          </div>

          <h3 style="font-size:16.5px; font-weight:700; color:var(--text-main); line-height:1.35; margin-bottom:10px;">
            ${escapeHtml(cg.title || '')}
          </h3>

          <p style="font-size:13px; color:var(--text-muted); line-height:1.6; margin-bottom:12px;">
            ${escapeHtml(cg.hook || '')}
          </p>

          <div id="culture-g-accordion-body" style="display:${cultureGExpanded ? 'block' : 'none'}; padding:13px 15px; border-radius:10px; background:rgba(168, 85, 247, 0.07); border:1px solid rgba(168, 85, 247, 0.22); margin-bottom:12px; font-size:12.5px; color:var(--text-main); line-height:1.65; white-space:pre-line;">
            ${escapeHtml(cg.details || '')}
          </div>
        </div>

        <div style="padding-top:10px; border-top:1px solid var(--border-subtle); display:flex; justify-content:flex-end;">
          <button type="button" id="culture-g-accordion-btn" onclick="window.toggleCultureGAccordion()" class="btn-ghost" style="font-size:12px; color:#D8B4FE; border-color:rgba(168, 85, 247, 0.3);">
            <i class="ph-bold ${cultureGExpanded ? 'ph-caret-up' : 'ph-book-open-text'}"></i>
            <span>${cultureGExpanded ? "Masquer l'analyse détaillée" : 'En savoir plus (Analyse & Références Concours)'}</span>
          </button>
        </div>
      </div>

      <!-- 4. ARTICLE OF THE DAY (ENGLISH PRESS - POLITICS, HISTORY, LITERATURE, INTERNATIONAL AFFAIRS) -->
      <div class="saas-card dd-card" style="padding:20px 22px; display:flex; flex-direction:column; justify-content:space-between; border-top:2px solid #10B981;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px; flex-wrap:wrap;">
            <span class="mono" style="font-size:10.5px; font-weight:700; color:#10B981; text-transform:uppercase; letter-spacing:0.06em;">
              <i class="ph-bold ph-article"></i> Article of the Day · International Press
            </span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="mono" style="font-size:10.5px; padding:2px 8px; border-radius:6px; background:rgba(16, 185, 129, 0.14); color:#34D399; font-weight:700;">${escapeHtml(art.source || 'The Guardian')}</span>
              ${art.readingTime ? `<span class="mono" style="font-size:10.5px; color:var(--text-subtle);"><i class="ph ph-clock"></i> ${escapeHtml(art.readingTime)}</span>` : ''}
            </div>
          </div>

          <h3 style="font-size:17px; font-weight:700; color:var(--text-main); line-height:1.35; margin-bottom:10px;">
            ${escapeHtml(art.title || '')}
          </h3>

          <p style="font-size:13px; color:var(--text-muted); line-height:1.55; margin-bottom:16px;">
            ${escapeHtml(art.abstract || '')}
          </p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border-subtle); flex-wrap:wrap; gap:8px;">
          <span class="mono" style="font-size:11px; color:var(--text-subtle);">${escapeHtml(art.category || 'Politics & Culture')}</span>
          <a href="${escapeHtml(art.url || 'https://www.theguardian.com/international')}" target="_blank" rel="noopener" class="btn-primary" style="text-decoration:none; font-size:12px; padding:7px 13px;">
            <span>Read on ${escapeHtml(art.source || 'Source')}</span>
            <i class="ph-bold ph-arrow-up-right"></i>
          </a>
        </div>
      </div>

    </div>

    <!-- 5. ENGLISH PRESS KIOSK DOCK -->
    <div class="saas-card" style="padding:20px 22px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
        <div>
          <h3 style="font-size:15px; font-weight:700; display:flex; align-items:center; gap:8px;">
            <i class="ph-bold ph-newspaper-clipping" style="color:#38BDF8;"></i>
            <span>English Press Kiosk Dock</span>
          </h3>
          <p style="font-size:12px; color:var(--text-muted);">Accès direct aux grandes rédactions anglophones (Politique, Géopolitique, Histoire, Littérature &amp; Essais)</p>
        </div>
      </div>

      <div class="section-label" style="margin-bottom:10px; color:#38BDF8;">Geopolitics, World &amp; Public Policy</div>
      <div class="sites-grid" style="margin-bottom:20px;">
        ${newsKiosk.map(src => `
          <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener" class="saas-card site-card" style="border-left:3px solid ${src.accent || '#3B82F6'};">
            <span class="site-ico" style="color:${src.accent || '#3B82F6'};"><i class="ph ${escapeHtml(src.icon || 'ph-newspaper')}"></i></span>
            <span class="site-txt">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                <b>${escapeHtml(src.name)}</b>
                <span class="mono" style="font-size:10px; color:var(--text-subtle);">${escapeHtml(src.tag)}</span>
              </div>
              <small style="margin-top:2px;">${escapeHtml(src.desc)}</small>
            </span>
            <i class="ph ph-arrow-up-right site-go"></i>
          </a>
        `).join('')}
      </div>

      <div class="section-label" style="margin-bottom:10px; color:#A855F7;">Culture, Literature &amp; Long-Form Essays</div>
      <div class="sites-grid">
        ${cultureKiosk.map(src => `
          <a href="${escapeHtml(src.url)}" target="_blank" rel="noopener" class="saas-card site-card" style="border-left:3px solid ${src.accent || '#A855F7'};">
            <span class="site-ico" style="color:${src.accent || '#A855F7'};"><i class="ph ${escapeHtml(src.icon || 'ph-feather')}"></i></span>
            <span class="site-txt">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                <b>${escapeHtml(src.name)}</b>
                <span class="mono" style="font-size:10px; color:var(--text-subtle);">${escapeHtml(src.tag)}</span>
              </div>
              <small style="margin-top:2px;">${escapeHtml(src.desc)}</small>
            </span>
            <i class="ph ph-arrow-up-right site-go"></i>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}
