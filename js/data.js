// data.js : reset, export/import JSON, capture caméra en direct, gestion des documents Photo/PDF (Colloscope, EDT), et conversion directe par IA Vision vers l'agenda

let currentScheduleImportTab = 'files';
let selectedScheduleDocCategory = 'Emploi du temps';
let currentlyViewedDocId = null;
let currentDocViewerZoom = 1;

let stagedScheduleDoc = null;
let stagedAiSlots = [];
let activeCameraStream = null;
let currentCameraFacingMode = 'environment';

window.openResetModal = function() { document.getElementById('reset-modal').classList.add('open'); };
window.closeResetModal = function() { document.getElementById('reset-modal').classList.remove('open'); };

window.clearDoneMissions = function() {
  state.tasks = state.tasks.filter(t => !isTaskCompleted(t));
  saveState();
  closeResetModal();
  renderActiveTab();
  showToast('Missions terminées purgées');
};

window.clearAllMissions = function() {
  state.tasks = [];
  saveState();
  closeResetModal();
  renderActiveTab();
  showToast('Toutes les missions ont été supprimées');
};

window.factoryResetAll = function() {
  state.tasks = [];
  state.postits = [];
  state.schedule = [];
  state.scheduleDocs = [];
  state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
  state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
  state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
  state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.eveningPlan = { manualOrder: [], excludedIds: [], customDurations: {}, pinnedEveningIds: [] };
  syncSubjectsWithState();
  syncTaskTypesWithState();
  saveState();
  if (typeof window.refreshAllSubjectSelects === 'function') window.refreshAllSubjectSelects();
  closeResetModal();
  renderPortals();
  renderActiveTab();
  showToast('Plateforme entièrement remise à zéro');
};

window.exportJSON = function() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cockpit_pcsi_${getOffsetDateISO(0)}.json`;
  a.click();
  a.remove();
  showToast('Sauvegarde JSON téléchargée');
};

window.importJSON = function(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      state = Object.assign(state, imported);
      if (!Array.isArray(state.portals)) state.portals = JSON.parse(JSON.stringify(DEFAULT_PORTALS));
      if (!imported.subjects || typeof imported.subjects !== 'object' || Object.keys(imported.subjects).length === 0) {
        state.subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
      } else {
        state.subjects = imported.subjects;
      }
      if (!imported.taskTypes || typeof imported.taskTypes !== 'object' || Object.keys(imported.taskTypes).length === 0) {
        state.taskTypes = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));
      } else {
        state.taskTypes = imported.taskTypes;
      }
      syncSubjectsWithState();
      syncTaskTypesWithState();
      normalizeSettingsState();
      normalizeTasksState();
      saveState();
      if (typeof window.refreshAllSubjectSelects === 'function') window.refreshAllSubjectSelects();
      renderPortals();
      renderActiveTab();
      showToast('Données restaurées avec succès');
    } catch (err) {
      showToast('Fichier JSON invalide');
    }
  };
  r.readAsText(f);
  e.target.value = '';
};

// =========================================================
// NAVIGATION DANS LA MODALE D'IMPORT IA & DOCUMENTS
// =========================================================

window.switchScheduleImportTab = function(tab) {
  currentScheduleImportTab = ['files', 'docs', 'text', 'json'].includes(tab) ? tab : 'files';
  if (currentScheduleImportTab !== 'files') {
    window.stopScheduleCamera();
  }
  const panes = {
    files: document.getElementById('sched-import-pane-files'),
    docs: document.getElementById('sched-import-pane-docs'),
    text: document.getElementById('sched-import-pane-text'),
    json: document.getElementById('sched-import-pane-json')
  };
  const btns = {
    files: document.getElementById('sched-tab-files-btn'),
    docs: document.getElementById('sched-tab-docs-btn'),
    text: document.getElementById('sched-tab-text-btn'),
    json: document.getElementById('sched-tab-json-btn')
  };
  Object.keys(panes).forEach(k => {
    if (panes[k]) panes[k].style.display = currentScheduleImportTab === k ? 'block' : 'none';
    if (btns[k]) btns[k].classList.toggle('active-pill', currentScheduleImportTab === k);
  });

  window.renderScheduleDocsGallery();
  if (currentScheduleImportTab === 'json') {
    const jsonArea = document.getElementById('schedule-json-textarea');
    if (jsonArea) jsonArea.value = JSON.stringify(state.schedule, null, 2);
  }
};

window.setScheduleDocCategory = function(cat) {
  selectedScheduleDocCategory = cat || 'Emploi du temps';
  document.querySelectorAll('#sched-doc-cat-pills [data-doc-cat]').forEach(btn => {
    btn.classList.toggle('active-pill', btn.getAttribute('data-doc-cat') === selectedScheduleDocCategory);
  });
};

function setScheduleFileStatus(html, isVisible = true) {
  const box = document.getElementById('sched-file-status-box');
  if (!box) return;
  box.style.display = isVisible ? 'block' : 'none';
  box.innerHTML = html || '';
}

window.toggleAiKeyConfigBox = function() {
  const box = document.getElementById('sched-ai-key-box');
  if (!box) return;
  const isHidden = box.style.display === 'none';
  box.style.display = isHidden ? 'block' : 'none';
  const input = document.getElementById('sched-ai-api-key-input');
  if (input && state.settings) {
    input.value = state.settings.aiApiKey || '';
  }
};

window.saveAiApiKeySetting = function(val) {
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.settings.aiApiKey = (val || '').trim();
  saveState();
  const box = document.getElementById('sched-ai-key-box');
  if (box) box.style.display = 'none';
  showToast(state.settings.aiApiKey ? 'Clé API IA enregistrée' : 'Mode IA Vision intégré activé');
};

// =========================================================
// CAMÉRA EN DIRECT (WEBRTC + BASCULE NATIVE MOBILE)
// =========================================================

window.openScheduleCameraCapture = async function() {
  const liveBox = document.getElementById('sched-camera-live-box');
  const videoEl = document.getElementById('sched-camera-video');
  const nativeInput = document.getElementById('sched-camera-native-input');

  // Si le navigateur supporte getUserMedia en contexte sécurisé, ouvrir le viseur caméra en direct
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && liveBox && videoEl) {
    try {
      window.stopScheduleCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: currentCameraFacingMode },
          width: { ideal: 1600 },
          height: { ideal: 1200 }
        },
        audio: false
      });
      activeCameraStream = stream;
      videoEl.srcObject = stream;
      liveBox.style.display = 'block';
      await videoEl.play().catch(() => {});
      return;
    } catch (err) {
      // Si permission refusée ou non-HTTPS, basculer automatiquement sur l'appareil photo natif du téléphone
    }
  }

  if (nativeInput) {
    nativeInput.click();
  } else {
    showToast('Appareil photo non disponible sur cet appareil');
  }
};

window.flipScheduleCamera = function() {
  currentCameraFacingMode = currentCameraFacingMode === 'environment' ? 'user' : 'environment';
  window.openScheduleCameraCapture();
};

window.stopScheduleCamera = function() {
  if (activeCameraStream) {
    try {
      activeCameraStream.getTracks().forEach(t => t.stop());
    } catch (e) {}
    activeCameraStream = null;
  }
  const videoEl = document.getElementById('sched-camera-video');
  if (videoEl) videoEl.srcObject = null;
  const liveBox = document.getElementById('sched-camera-live-box');
  if (liveBox) liveBox.style.display = 'none';
};

window.captureScheduleCameraFrame = function() {
  const videoEl = document.getElementById('sched-camera-video');
  if (!videoEl || !activeCameraStream) return;

  let w = videoEl.videoWidth || 1280;
  let h = videoEl.videoHeight || 960;
  const maxDim = 1450;
  if (w > maxDim || h > maxDim) {
    if (w >= h) {
      h = Math.round(h * (maxDim / w));
      w = maxDim;
    } else {
      w = Math.round(w * (maxDim / h));
      h = maxDim;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(videoEl, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.84);

  window.stopScheduleCamera();

  const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  const docObj = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: `${selectedScheduleDocCategory} (${nowStr})`,
    category: selectedScheduleDocCategory,
    kind: 'image',
    pages: [dataUrl],
    totalPages: 1,
    extractedText: '',
    addedAt: formatDateISO(new Date())
  };

  if (!Array.isArray(state.scheduleDocs)) state.scheduleDocs = [];
  state.scheduleDocs.unshift(docObj);
  saveState();
  window.renderScheduleDocsGallery();
  if (state.activeTab === 'agenda') renderAgenda();

  stageDocumentForAi(docObj, true);
};

// =========================================================
// UPLOAD PHOTO / PDF & PRÉPARATION VISUELLE POUR L'IA
// =========================================================

window.onScheduleFileDragOver = function(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.add('drag-over');
};

window.onScheduleFileDragLeave = function(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
};

window.onScheduleFileDrop = function(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    window.handleScheduleFilesUpload(e.dataTransfer.files);
  }
};

function loadExternalScriptOnce(src, globalVarName) {
  if (globalVarName && window[globalVarName]) return Promise.resolve(window[globalVarName]);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(globalVarName ? window[globalVarName] : true));
      existing.addEventListener('error', () => reject(new Error('Impossible de charger ' + src)));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(globalVarName ? window[globalVarName] : true);
    s.onerror = () => reject(new Error('Impossible de charger ' + src));
    document.head.appendChild(s);
  });
}

function compressImageFileToDataUrl(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture image impossible'));
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format image non supporté'));
      img.onload = () => {
        let w = img.naturalWidth || img.width || 1000;
        let h = img.naturalHeight || img.height || 1000;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round(h * (maxDim / w));
            w = maxDim;
          } else {
            w = Math.round(w * (maxDim / h));
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function processPdfFileToVisualPages(file) {
  const arrayBuf = await file.arrayBuffer();
  const pdfjsLib = await loadExternalScriptOnce(
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'pdfjsLib'
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
  const maxPages = Math.min(pdf.numPages, 4);
  const pageImages = [];
  const rawPdfHints = [];

  for (let pNum = 1; pNum <= maxPages; pNum++) {
    setScheduleFileStatus(`<i class="ph-bold ph-spinner animate-spin" style="color:#FB923C;"></i> Conversion visuelle du PDF <strong>${escapeHtml(file.name)}</strong> pour l'IA (page ${pNum}/${maxPages})...`);
    const page = await pdf.getPage(pNum);

    const baseVp = page.getViewport({ scale: 1 });
    const targetScale = Math.min(1.8, Math.max(1.15, 1380 / Math.max(baseVp.width, baseVp.height, 600)));
    const vp = page.getViewport({ scale: targetScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pageImages.push(canvas.toDataURL('image/jpeg', 0.80));

    // Contexte additionnel optionnel si le PDF possède aussi des calques texte
    try {
      const tc = await page.getTextContent();
      const pageTxt = (tc.items || []).map(i => i.str).join(' ').replace(/\s{2,}/g, ' ').trim();
      if (pageTxt.length > 10) rawPdfHints.push(pageTxt);
    } catch (e) {}
  }

  return {
    pages: pageImages,
    totalPages: pdf.numPages,
    pdfHintText: rawPdfHints.join('\n')
  };
}

window.handleScheduleFilesUpload = async function(fileList) {
  if (!fileList || !fileList.length) return;
  if (!Array.isArray(state.scheduleDocs)) state.scheduleDocs = [];

  const files = Array.from(fileList);
  let latestDoc = null;

  for (const file of files) {
    const lowerName = (file.name || '').toLowerCase();
    const cleanTitle = (file.name || 'Document').replace(/\.[a-z0-9]{2,5}$/i, '');

    try {
      if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
        const pdfData = await processPdfFileToVisualPages(file);
        const docObj = {
          id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title: cleanTitle,
          category: selectedScheduleDocCategory,
          kind: 'pdf',
          pages: pdfData.pages,
          totalPages: pdfData.totalPages,
          pdfHintText: pdfData.pdfHintText || '',
          addedAt: formatDateISO(new Date())
        };
        state.scheduleDocs.unshift(docObj);
        latestDoc = docObj;
      } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic)$/i.test(lowerName)) {
        setScheduleFileStatus(`<i class="ph-bold ph-spinner animate-spin" style="color:#38BDF8;"></i> Préparation de la photo <strong>${escapeHtml(file.name)}</strong> pour l'IA...`);
        const dataUrl = await compressImageFileToDataUrl(file, 1400, 0.82);
        const docObj = {
          id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title: cleanTitle,
          category: selectedScheduleDocCategory,
          kind: 'image',
          pages: [dataUrl],
          totalPages: 1,
          pdfHintText: '',
          addedAt: formatDateISO(new Date())
        };
        state.scheduleDocs.unshift(docObj);
        latestDoc = docObj;
      }
    } catch (err) {
      showToast(`Impossible de lire ${file.name}`);
    }
  }

  ['sched-camera-native-input', 'sched-photo-input', 'sched-pdf-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  saveState();
  window.renderScheduleDocsGallery();
  if (state.activeTab === 'agenda') renderAgenda();

  if (latestDoc) {
    stageDocumentForAi(latestDoc, true);
  }
};

function stageDocumentForAi(docObj, autoRunAi = true) {
  if (!docObj) return;
  stagedScheduleDoc = docObj;

  const stagedBox = document.getElementById('sched-ai-staged-box');
  const stagedTitle = document.getElementById('sched-ai-staged-title');
  const thumbsBox = document.getElementById('sched-ai-staged-thumbs');
  if (stagedBox && stagedTitle && thumbsBox) {
    stagedBox.style.display = 'block';
    stagedTitle.innerHTML = `<i class="ph-bold ph-check-circle"></i> ${escapeHtml(docObj.title)} <span class="mono" style="font-size:10.5px; color:var(--text-muted); font-weight:500;">(${escapeHtml(docObj.category || 'Doc')} · ${(docObj.pages || []).length} page${(docObj.pages || []).length > 1 ? 's' : ''})</span>`;
    thumbsBox.innerHTML = (docObj.pages || []).map((imgUrl, idx) => `
      <div onclick="window.openScheduleDocViewer('${escapeHtml(docObj.id)}')" style="position:relative; width:74px; height:56px; border-radius:8px; overflow:hidden; border:1px solid rgba(56,189,248,0.4); cursor:pointer; flex-shrink:0; background:#000;" title="Cliquer pour agrandir">
        <img src="${imgUrl}" alt="Page ${idx + 1}" style="width:100%; height:100%; object-fit:cover; display:block;" />
        <span class="mono" style="position:absolute; bottom:2px; right:2px; font-size:9px; padding:1px 4px; border-radius:4px; background:rgba(9,10,15,0.82); color:#F8FAFC;">P.${idx + 1}</span>
      </div>
    `).join('');
  }

  if (autoRunAi) {
    window.analyzeStagedDocWithAI();
  }
}

window.clearStagedScheduleDoc = function() {
  stagedScheduleDoc = null;
  stagedAiSlots = [];
  const stagedBox = document.getElementById('sched-ai-staged-box');
  if (stagedBox) stagedBox.style.display = 'none';
  const resCard = document.getElementById('sched-ai-results-card');
  if (resCard) resCard.style.display = 'none';
  setScheduleFileStatus('', false);
};

// =========================================================
// MOTEUR D'ANALYSE VISUELLE PAR IA (MANUSCRIT, TABLEAU, COLLOSCOPE -> JSON)
// =========================================================

function buildScheduleVisionPrompt(doc, userHint) {
  const subjectsList = Object.values(SUBJECTS).map(s => `"${s.id}" (${s.name})`).join(', ');
  const todayISO = formatDateISO(new Date());

  return `Tu es un assistant expert en lecture d'emplois du temps et de colloscopes de classe préparatoire CPGE PCSI (même écrits à la main, photographiés de travers, ou sous forme de tableaux complexes).
Analyse visuellement l'image (ou les pages) fournie(s) et convertis tous les créneaux pertinents en un objet JSON directement exploitable par le gestionnaire d'emploi du temps pcsi.os.

Date d'aujourd'hui : ${todayISO}
Catégorie du document : ${doc.category || 'Emploi du temps'}
${userHint ? `CONSIGNE SPÉCIFIQUE DE L'ÉLÈVE : "${userHint}" (Respecte strictement cette consigne, par exemple filtre uniquement son trinôme ou son groupe si précisé).` : ''}
${doc.pdfHintText ? `Indice texte brut issu du PDF (attention, fie-toi d'abord à l'agencement visuel des colonnes/lignes sur l'image) :\n${doc.pdfHintText.slice(0, 2500)}` : ''}

Matières disponibles (utilise exactement l'un de ces identifiants pour le champ "subject") :
${subjectsList}

Règles de conversion :
1. Pour un emploi du temps hebdomadaire récurrent, renseigne "dayOfWeek" (entier : 0 = Lundi, 1 = Mardi, 2 = Mercredi, 3 = Jeudi, 4 = Vendredi, 5 = Samedi) et OMETS le champ "date".
2. Pour un événement à une date précise (ex: une Colle d'une semaine donnée ou un DS du samedi avec une date précise), renseigne "date" au format "YYYY-MM-DD" (ou "dayOfWeek" si seule la journée de la semaine est indiquée).
3. "start" et "end" doivent être au format "HH:MM" sur 24h (ex: "08:00", "10:00", "17:30"). Si seule l'heure de début d'une colle est écrite (ex: "17h"), ajoute 1h pour la fin ("18:00").
4. "type" doit être choisi parmi : "COURS", "TD", "TP", "COLLE", "DS".
5. "title" doit être court et clair (ex: "Cours Maths", "TP Physique", "Colle Anglais", "DS Chimie").
6. "room" contient la salle ou le nom du colleur si visible (ex: "C204", "Labo 2", "M. Dupont"), sinon "".

Réponds UNIQUEMENT avec un objet JSON valide de la forme exacte suivante, sans aucun texte autour ni balise markdown :
{
  "slots": [
    {
      "dayOfWeek": 0,
      "start": "08:00",
      "end": "10:00",
      "subject": "maths",
      "type": "COURS",
      "title": "Cours Mathématiques",
      "room": "C204"
    }
  ]
}`;
}

function extractJsonSlotsFromAiResponse(rawText) {
  if (!rawText) return [];
  let cleaned = String(rawText).trim();
  // Retirer d'éventuels blocs ```json ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // Chercher le premier objet {...} ou tableau [...] dans la réponse
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (objMatch) {
      try { parsed = JSON.parse(objMatch[0]); } catch (e2) {}
    }
    if (!parsed && arrMatch) {
      try { parsed = JSON.parse(arrMatch[0]); } catch (e3) {}
    }
  }

  if (!parsed) return [];
  const rawArr = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed.slots) ? parsed.slots : (Array.isArray(parsed.schedule) ? parsed.schedule : []));

  return rawArr.map((item, idx) => {
    if (!item || typeof item !== 'object') return null;
    const rawSubj = String(item.subject || '').toLowerCase().trim();
    const subject = SUBJECTS[rawSubj] ? rawSubj : matchSubjectFromText(`${item.subject || ''} ${item.title || ''}`);
    const rawType = String(item.type || '').toUpperCase().trim();
    const validTypes = ['COURS', 'TD', 'TP', 'COLLE', 'DS'];
    const type = validTypes.includes(rawType) ? rawType : matchSlotTypeFromText(`${item.type || ''} ${item.title || ''}`);

    const parseTimeField = (val, fallback) => {
      if (!val) return fallback;
      const m = String(val).trim().match(/^(\d{1,2})\s*[:hH]?\s*(\d{2})?$/);
      if (!m) return fallback;
      return normalizeHourString(m[1], m[2] || '00');
    };

    const start = parseTimeField(item.start, '08:00');
    let end = parseTimeField(item.end, '10:00');
    if (end <= start) {
      const sH = parseInt(start.split(':')[0], 10) || 8;
      end = `${String(Math.min(23, sH + (type === 'COLLE' ? 1 : 2))).padStart(2, '0')}:${start.split(':')[1] || '00'}`;
    }

    const subjMeta = getSubject(subject);
    const title = (item.title && String(item.title).trim())
      ? String(item.title).trim()
      : `${type === 'COLLE' ? 'Colle' : type === 'DS' ? 'DS' : type === 'TP' ? 'TP' : type === 'TD' ? 'TD' : 'Cours'} ${subjMeta.name}`;

    const slot = {
      id: `s_ai_${Date.now()}_${idx}`,
      start,
      end,
      subject,
      type,
      title,
      room: item.room ? String(item.room).trim() : ''
    };

    if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(String(item.date).trim())) {
      slot.date = String(item.date).trim();
    } else {
      let d = item.dayOfWeek !== undefined ? Number(item.dayOfWeek) : (item.day !== undefined ? Number(item.day) : 0);
      if (!Number.isFinite(d) || d < 0 || d > 5) d = 0;
      slot.dayOfWeek = d;
    }
    return slot;
  }).filter(Boolean);
}

async function callVisionAiProviders(doc, promptText) {
  const images = (doc.pages || []).slice(0, 3);

  // 1. Appel prioritaire à la fonction Serverless Netlify (/.netlify/functions/ai-schedule)
  // Les clés Gemini (GEMINI_API_KEY_1, GEMINI_API_KEY_2...) sont stockées côté serveur sur Netlify :
  // invisibles pour les utilisateurs, avec rotation automatique et aucun réglage requis.
  try {
    const netlifyRes = await fetch('/.netlify/functions/ai-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: promptText,
        images
      })
    });
    if (netlifyRes.ok) {
      const data = await netlifyRes.json();
      if (data && data.text) return data.text;
    }
  } catch (e) {
    // En mode local hors Netlify, bascule transparente ci-dessous
  }

  // 2. Bascule automatique (Mode développement local hors Netlify ou si aucune clé n'est définie)
  const contentBlocks = [{ type: 'text', text: promptText }];
  images.forEach(dataUrl => {
    contentBlocks.push({
      type: 'image_url',
      image_url: { url: dataUrl }
    });
  });

  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an expert French CPGE timetable and colloscope vision parser. Always output valid JSON with a "slots" array.'
        },
        {
          role: 'user',
          content: contentBlocks
        }
      ]
    })
  });
  if (!res.ok) throw new Error('Service IA occupé (' + res.status + ')');
  const data = await res.json();
  if (data && data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content || '';
  }
  return typeof data === 'string' ? data : JSON.stringify(data);
}

window.analyzeStagedDocWithAI = async function() {
  if (!stagedScheduleDoc && Array.isArray(state.scheduleDocs) && state.scheduleDocs.length > 0) {
    stagedScheduleDoc = state.scheduleDocs[0];
  }
  if (!stagedScheduleDoc || !stagedScheduleDoc.pages || !stagedScheduleDoc.pages.length) {
    showToast('Prends une photo ou sélectionne un fichier Photo / PDF d\'abord');
    return;
  }

  const hintEl = document.getElementById('sched-ai-hint-input');
  const userHint = hintEl ? hintEl.value.trim() : '';
  const analyzeBtn = document.getElementById('sched-ai-analyze-btn');
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Analyse IA...`;
  }

  setScheduleFileStatus(`
    <div style="display:flex; align-items:center; gap:10px;">
      <i class="ph-bold ph-spinner animate-spin" style="font-size:18px; color:#38BDF8; flex-shrink:0;"></i>
      <div>
        <div style="font-weight:700; color:var(--text-main);">L'IA analyse visuellement ton document...</div>
        <div style="font-size:11px; color:var(--text-muted);">Lecture des horaires, de l'écriture manuscrite/tableau et conversion au format agenda.</div>
      </div>
    </div>
  `);

  try {
    const prompt = buildScheduleVisionPrompt(stagedScheduleDoc, userHint);
    const aiRawText = await callVisionAiProviders(stagedScheduleDoc, prompt);
    const slots = extractJsonSlotsFromAiResponse(aiRawText);

    if (!slots.length) {
      // Fallback si le PDF avait du texte structuré direct
      const fallbackSlots = stagedScheduleDoc.pdfHintText ? window.parseRawScheduleText(stagedScheduleDoc.pdfHintText) : [];
      if (fallbackSlots.length > 0) {
        stagedAiSlots = fallbackSlots;
        renderStagedAiSlotsPreview();
        setScheduleFileStatus('', false);
        showToast(`${fallbackSlots.length} créneau(x) prêts à importer !`);
      } else {
        setScheduleFileStatus(`
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="color:#F59E0B;"><i class="ph-bold ph-warning-circle"></i> L'IA n'a pas détecté de créneaux clairs. Précise une consigne (ex: "Lis les cours du lundi au vendredi") ou reprends une photo plus nette.</span>
            <button type="button" onclick="window.analyzeStagedDocWithAI()" class="btn-ghost" style="padding:4px 10px; font-size:11px; min-height:28px;">Réessayer</button>
          </div>
        `);
      }
    } else {
      stagedAiSlots = slots;
      renderStagedAiSlotsPreview();
      setScheduleFileStatus('', false);
      showToast(`${slots.length} créneau(x) convertis par l'IA !`);
    }
  } catch (err) {
    setScheduleFileStatus(`
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="color:#F87171;"><i class="ph-bold ph-warning"></i> ${escapeHtml(err.message || 'Erreur lors de la connexion à l\'IA.')} Tu peux réessayer ou configurer une clé Gemini gratuite.</span>
        <button type="button" onclick="window.analyzeStagedDocWithAI()" class="btn-ghost" style="padding:4px 10px; font-size:11px; min-height:28px;">Réessayer</button>
      </div>
    `);
  } finally {
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = `<i class="ph-bold ph-sparkle"></i> Convertir avec l'IA`;
    }
  }
};

function renderStagedAiSlotsPreview() {
  const card = document.getElementById('sched-ai-results-card');
  const titleEl = document.getElementById('sched-ai-results-title');
  const listEl = document.getElementById('sched-ai-results-list');
  if (!card || !listEl) return;

  if (!stagedAiSlots || !stagedAiSlots.length) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  if (titleEl) {
    titleEl.innerHTML = `<i class="ph-bold ph-check-circle"></i> ${stagedAiSlots.length} créneau${stagedAiSlots.length > 1 ? 'x' : ''} prêt${stagedAiSlots.length > 1 ? 's' : ''} à importer`;
  }

  listEl.innerHTML = stagedAiSlots.map((sl, idx) => {
    const s = getSubject(sl.subject);
    const dayStr = sl.date ? sl.date : DAYS_LABELS[sl.dayOfWeek || 0];
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; background:rgba(255,255,255,0.035); border-left:3px solid ${s.color}; font-size:11.5px;">
        <div style="display:flex; align-items:center; gap:7px; min-width:0; flex-wrap:wrap;">
          <strong class="mono" style="color:var(--text-main);">${escapeHtml(dayStr)} · ${sl.start}–${sl.end}</strong>
          <span style="color:${s.color}; font-weight:700; font-size:10.5px;">[${escapeHtml(s.short)}]</span>
          <span style="color:var(--text-main); font-weight:600;">${escapeHtml(sl.title)}</span>
          ${sl.room ? `<span class="mono" style="font-size:10px; color:var(--text-muted);">(${escapeHtml(sl.room)})</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          <span class="mono" style="font-size:9.5px; padding:1px 5px; border-radius:4px; background:rgba(255,255,255,0.07); color:var(--text-muted);">${escapeHtml(sl.type)}</span>
          <button type="button" onclick="window.removeStagedAiSlot(${idx})" class="btn-ghost" style="padding:2px 6px; min-height:24px; border:none; color:var(--text-subtle);" title="Retirer ce créneau">
            <i class="ph-bold ph-x"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.removeStagedAiSlot = function(idx) {
  stagedAiSlots.splice(idx, 1);
  renderStagedAiSlotsPreview();
};

window.commitAiScheduleSlots = function(replaceExisting = false) {
  if (!stagedAiSlots || !stagedAiSlots.length) {
    showToast('Aucun créneau à importer');
    return;
  }
  const count = stagedAiSlots.length;
  if (replaceExisting) {
    state.schedule = stagedAiSlots.slice();
  } else {
    state.schedule = state.schedule.concat(stagedAiSlots);
  }
  const jsonArea = document.getElementById('schedule-json-textarea');
  if (jsonArea) jsonArea.value = JSON.stringify(state.schedule, null, 2);

  stagedAiSlots = [];
  renderStagedAiSlotsPreview();
  saveState();
  closeScheduleImportModal();
  renderAgenda();
  showToast(`${count} créneau${count > 1 ? 'x' : ''} importé${count > 1 ? 's' : ''} dans l'agenda !`);
};

window.extractSlotsFromDoc = function(docId) {
  const doc = (state.scheduleDocs || []).find(d => d.id === docId);
  if (!doc) return;
  window.closeScheduleDocViewer();
  document.getElementById('schedule-import-modal').classList.add('open');
  window.switchScheduleImportTab('files');
  stageDocumentForAi(doc, true);
};

// =========================================================
// GALERIE & VISIONNEUSE PLEIN ÉCRAN DES DOCUMENTS CONSERVÉS
// =========================================================

window.renameScheduleDoc = function(docId, newTitle) {
  const doc = (state.scheduleDocs || []).find(d => d.id === docId);
  if (!doc) return;
  const clean = (newTitle || '').trim();
  if (!clean) return;
  doc.title = clean;
  saveState();
  if (state.activeTab === 'agenda') renderAgenda();
};

window.deleteScheduleDoc = function(docId, event) {
  if (event) event.stopPropagation();
  if (!Array.isArray(state.scheduleDocs)) return;
  state.scheduleDocs = state.scheduleDocs.filter(d => d.id !== docId);
  if (stagedScheduleDoc && stagedScheduleDoc.id === docId) {
    window.clearStagedScheduleDoc();
  }
  saveState();
  window.renderScheduleDocsGallery();
  if (state.activeTab === 'agenda') renderAgenda();
  showToast('Document supprimé');
};

window.renderScheduleDocsGallery = function() {
  const gallery = document.getElementById('schedule-docs-gallery');
  const countLbl = document.getElementById('sched-docs-total-label');
  const tabCount = document.getElementById('sched-tab-docs-count');
  const docs = Array.isArray(state.scheduleDocs) ? state.scheduleDocs : [];
  if (countLbl) countLbl.textContent = `${docs.length} document${docs.length > 1 ? 's' : ''}`;
  if (tabCount) tabCount.textContent = String(docs.length);
  if (!gallery) return;

  if (!docs.length) {
    gallery.innerHTML = `
      <div style="padding:24px 16px; text-align:center; border-radius:11px; border:1px dashed var(--border-subtle); background:rgba(255,255,255,0.015); color:var(--text-subtle); font-size:12px;">
        <i class="ph-bold ph-files" style="font-size:22px; color:var(--text-muted); margin-bottom:6px; display:block;"></i>
        Aucun document conservé pour le moment.<br/>
        Les photos et PDF importés dans l'onglet <strong>Import IA</strong> sont automatiquement sauvegardés ici.
      </div>
    `;
    return;
  }

  gallery.innerHTML = docs.map(doc => {
    const thumb = (doc.pages && doc.pages[0]) ? doc.pages[0] : '';
    const isPdf = doc.kind === 'pdf';
    return `
      <div class="sched-doc-card" onclick="window.openScheduleDocViewer('${escapeHtml(doc.id)}')">
        <div class="sched-doc-thumb" style="${thumb ? `background-image:url('${thumb}');` : ''}">
          <span class="sched-doc-kind-tag mono" style="background:${isPdf ? 'rgba(249,115,22,0.9)' : 'rgba(56,189,248,0.9)'};">${isPdf ? 'PDF' : 'PHOTO'}</span>
        </div>
        <div class="sched-doc-meta" onclick="event.stopPropagation();">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:3px;">
            <span class="mono" style="font-size:10px; padding:1px 6px; border-radius:5px; background:rgba(255,255,255,0.07); color:var(--text-muted);">${escapeHtml(doc.category || 'Colloscope')}</span>
            ${doc.totalPages > 1 ? `<span class="mono" style="font-size:10px; color:var(--text-subtle);">${doc.totalPages} pages</span>` : ''}
          </div>
          <input type="text" class="sched-doc-title-input" value="${escapeHtml(doc.title)}" onchange="window.renameScheduleDoc('${escapeHtml(doc.id)}', this.value)" title="Renommer ce document" />
        </div>
        <div class="sched-doc-actions" onclick="event.stopPropagation();">
          <button type="button" onclick="window.openScheduleDocViewer('${escapeHtml(doc.id)}')" class="btn-ghost sched-doc-act-btn" title="Ouvrir et zoomer">
            <i class="ph-bold ph-eye"></i> <span>Voir</span>
          </button>
          <button type="button" onclick="window.extractSlotsFromDoc('${escapeHtml(doc.id)}')" class="btn-ghost sched-doc-act-btn" style="color:#38BDF8;" title="Analyser avec l'IA pour importer les créneaux">
            <i class="ph-bold ph-sparkle"></i> <span>IA</span>
          </button>
          <button type="button" onclick="window.deleteScheduleDoc('${escapeHtml(doc.id)}', event)" class="btn-ghost sched-doc-act-btn" style="color:#F87171;" title="Supprimer ce document">
            <i class="ph-bold ph-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
};

window.openScheduleDocViewer = function(docId) {
  const doc = (state.scheduleDocs || []).find(d => d.id === docId);
  if (!doc) return;
  currentlyViewedDocId = doc.id;
  currentDocViewerZoom = 1;

  const badgeEl = document.getElementById('doc-viewer-badge');
  const titleEl = document.getElementById('doc-viewer-title');
  const zoomLbl = document.getElementById('doc-viewer-zoom-lbl');
  if (badgeEl) badgeEl.textContent = (doc.category || 'DOCUMENT').toUpperCase();
  if (titleEl) titleEl.textContent = doc.title || 'Document';
  if (zoomLbl) zoomLbl.textContent = '100%';

  renderDocViewerPages(doc);
  document.getElementById('schedule-doc-viewer-modal').classList.add('open');
};

function renderDocViewerPages(doc) {
  const wrap = document.getElementById('doc-viewer-canvas-wrap');
  const nav = document.getElementById('doc-viewer-pages-nav');
  if (!wrap || !doc) return;
  const pages = Array.isArray(doc.pages) ? doc.pages : [];
  if (nav) {
    if (pages.length > 1) {
      nav.style.display = 'flex';
      nav.innerHTML = `<span class="mono" style="font-size:11.5px; color:var(--text-muted);"><i class="ph-bold ph-files"></i> ${pages.length} pages affichées — fais défiler ou zoome librement</span>`;
    } else {
      nav.style.display = 'none';
    }
  }
  const widthPct = Math.round(currentDocViewerZoom * 100);
  wrap.innerHTML = pages.map((dataUrl, idx) => `
    <div style="width:${widthPct}%; max-width:${currentDocViewerZoom > 1 ? 'none' : '100%'}; display:flex; flex-direction:column; align-items:center; gap:6px;">
      ${pages.length > 1 ? `<span class="mono" style="font-size:10.5px; color:var(--text-subtle);">Page ${idx + 1} / ${pages.length}</span>` : ''}
      <img src="${dataUrl}" alt="${escapeHtml(doc.title)} - page ${idx + 1}" style="width:100%; height:auto; border-radius:8px; box-shadow:0 12px 32px rgba(0,0,0,0.45); background:#fff;" />
    </div>
  `).join('');
}

window.zoomScheduleDocViewer = function(delta) {
  const doc = (state.scheduleDocs || []).find(d => d.id === currentlyViewedDocId);
  if (!doc) return;
  currentDocViewerZoom = Math.max(0.5, Math.min(2.5, Number((currentDocViewerZoom + delta).toFixed(2))));
  const zoomLbl = document.getElementById('doc-viewer-zoom-lbl');
  if (zoomLbl) zoomLbl.textContent = `${Math.round(currentDocViewerZoom * 100)}%`;
  renderDocViewerPages(doc);
};

window.extractSlotsFromViewedDoc = function() {
  if (!currentlyViewedDocId) return;
  window.extractSlotsFromDoc(currentlyViewedDocId);
};

window.closeScheduleDocViewer = function() {
  const modal = document.getElementById('schedule-doc-viewer-modal');
  if (modal) modal.classList.remove('open');
};

function normalizeHourString(hStr, mStr) {
  const h = Math.max(0, Math.min(23, parseInt(hStr, 10) || 8));
  const m = Math.max(0, Math.min(59, parseInt(mStr || '0', 10) || 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function matchSubjectFromText(line) {
  const lower = line.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // 1. Check custom & default subjects in SUBJECTS
  for (const subj of Object.values(SUBJECTS)) {
    const sName = subj.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sShort = subj.short.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '');
    if (sName.length >= 3 && lower.includes(sName)) return subj.id;
    const shortRegex = new RegExp(`\\b${sShort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (sShort.length >= 2 && shortRegex.test(lower)) return subj.id;
  }
  // 2. Common CPGE keywords
  if (/\b(maths?|mathematiques?|algebre|analyse|geometrie)\b/i.test(lower)) return SUBJECTS.maths ? 'maths' : Object.keys(SUBJECTS)[0];
  if (/\b(physique|phys|optique|meca|mecanique|elec|electro|thermo|thermodynamique)\b/i.test(lower)) return SUBJECTS.physique ? 'physique' : Object.keys(SUBJECTS)[0];
  if (/\b(chimie|chim|orga|atomistique|cinetique|solutions?)\b/i.test(lower)) return SUBJECTS.chimie ? 'chimie' : Object.keys(SUBJECTS)[0];
  if (/\b(s\.?i\.?|s2i|sciences? de l'ingenieur|automatique|cinematique)\b/i.test(lower)) return SUBJECTS.si ? 'si' : Object.keys(SUBJECTS)[0];
  if (/\b(francais|lettres|philo|philosophie)\b/i.test(lower)) return SUBJECTS.francais ? 'francais' : Object.keys(SUBJECTS)[0];
  if (/\b(anglais|english|lv1|lv2)\b/i.test(lower)) return SUBJECTS.anglais ? 'anglais' : Object.keys(SUBJECTS)[0];

  return Object.keys(SUBJECTS)[0] || 'maths';
}

function matchSlotTypeFromText(line) {
  const lower = line.toLowerCase();
  if (/\b(colles?|kh[ôo]lles?)\b/i.test(lower)) return 'COLLE';
  if (/\b(ds|devoir surveill[ée]|concours blanc)\b/i.test(lower)) return 'DS';
  if (/\b(tp|travaux pratiques|labo)\b/i.test(lower)) return 'TP';
  if (/\b(td|travaux dirig[ée]s|exos?)\b/i.test(lower)) return 'TD';
  return 'COURS';
}

window.parseRawScheduleText = function(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const trimmed = rawText.trim();

  // Si l'utilisateur a collé du JSON directement dans la zone texte libre
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.schedule) ? parsed.schedule : []);
      if (arr.length) {
        return arr.map((item, idx) => {
          const s = {
            id: item.id || ('s_ing_' + idx + '_' + Date.now()),
            start: item.start || '08:00',
            end: item.end || '10:00',
            subject: SUBJECTS[item.subject] ? item.subject : matchSubjectFromText(item.subject || item.title || ''),
            type: (item.type || 'COURS').toUpperCase(),
            title: item.title || 'Séance',
            room: item.room || ''
          };
          if (item.date) s.date = item.date;
          else s.dayOfWeek = item.dayOfWeek !== undefined ? Number(item.dayOfWeek) : 0;
          return s;
        });
      }
    } catch (e) {}
  }

  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];
  let currentDayContext = 0;
  let currentDateContext = null;

  const dayPatterns = [
    { idx: 0, rx: /\b(lundi|lun|monday|mon)\b/i },
    { idx: 1, rx: /\b(mardi|mar|tuesday|tue)\b/i },
    { idx: 2, rx: /\b(mercredi|mer|wednesday|wed)\b/i },
    { idx: 3, rx: /\b(jeudi|jeu|thursday|thu)\b/i },
    { idx: 4, rx: /\b(vendredi|ven|friday|fri)\b/i },
    { idx: 5, rx: /\b(samedi|sam|saturday|sat)\b/i }
  ];

  const timeRangeRx = /(\d{1,2})\s*(?:[:hH]\s*(\d{2})?)?\s*(?:-|–|—|à|to|->|\/)\s*(\d{1,2})\s*(?:[:hH]\s*(\d{2})?)?/;
  const isoDateRx = /\b(20\d{2}-\d{2}-\d{2})\b/;
  const frDateRx = /\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}|\d{2}))?\b/;

  lines.forEach((line, idx) => {
    // Ignorer les lignes purement commentaires
    if (line.startsWith('#') || line.startsWith('//')) return;

    // Détection de jour ou de date sur la ligne
    let detectedDay = null;
    for (const dp of dayPatterns) {
      if (dp.rx.test(line)) {
        detectedDay = dp.idx;
        break;
      }
    }

    let detectedDate = null;
    const isoMatch = line.match(isoDateRx);
    if (isoMatch) {
      detectedDate = isoMatch[1];
    } else {
      const frMatch = line.match(frDateRx);
      if (frMatch) {
        const dd = String(frMatch[1]).padStart(2, '0');
        const mm = String(frMatch[2]).padStart(2, '0');
        let yyyy = frMatch[3] ? String(frMatch[3]) : String(new Date().getFullYear());
        if (yyyy.length === 2) yyyy = '20' + yyyy;
        if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
          detectedDate = `${yyyy}-${mm}-${dd}`;
        }
      }
    }

    const timeMatch = line.match(timeRangeRx);
    // Si la ligne contient uniquement un jour (ex: "Lundi :") sans horaire, elle met à jour le contexte
    if (!timeMatch) {
      if (detectedDate) {
        currentDateContext = detectedDate;
        currentDayContext = null;
      } else if (detectedDay !== null) {
        currentDayContext = detectedDay;
        currentDateContext = null;
      }
      return;
    }

    const start = normalizeHourString(timeMatch[1], timeMatch[2]);
    const end = normalizeHourString(timeMatch[3], timeMatch[4]);

    const subject = matchSubjectFromText(line);
    const type = matchSlotTypeFromText(line);
    const subjMeta = getSubject(subject);

    // Extraire la salle éventuelle (ex: "Salle C204", "[B12]", "Amphi A", "Labo 2", "C204")
    let room = '';
    const roomExplicit = line.match(/\b(?:salle|amphi|labo|trin[ôo]me)\s+([A-Za-z0-9\-_]+)/i);
    if (roomExplicit) {
      room = roomExplicit[0].trim();
    } else {
      const codeRoom = line.match(/\b([A-Z]\s?\d{2,3}[a-z]?)\b/);
      if (codeRoom) room = codeRoom[1].trim();
    }

    // Construire un intitulé propre en retirant la date, le jour et la plage horaire
    let cleanTitle = line
      .replace(timeMatch[0], ' ')
      .replace(isoDateRx, ' ')
      .replace(frDateRx, ' ');

    dayPatterns.forEach(dp => {
      cleanTitle = cleanTitle.replace(dp.rx, ' ');
    });
    if (room) {
      cleanTitle = cleanTitle.replace(room, ' ');
    }
    cleanTitle = cleanTitle.replace(/^[\s\-–—:|,;•]+|[\s\-–—:|,;•]+$/g, '').replace(/\s{2,}/g, ' ').trim();

    if (!cleanTitle || cleanTitle.length < 2) {
      cleanTitle = `${type === 'COLLE' ? 'Colle' : type === 'DS' ? 'DS' : type === 'TP' ? 'TP' : type === 'TD' ? 'TD' : 'Cours'} ${subjMeta.name}`;
    }

    const slotObj = {
      id: `s_txt_${Date.now()}_${idx}`,
      title: cleanTitle,
      subject,
      type,
      start,
      end,
      room
    };

    const finalDate = detectedDate || (type === 'COLLE' && currentDateContext ? currentDateContext : null);
    if (finalDate) {
      slotObj.date = finalDate;
    } else {
      slotObj.dayOfWeek = detectedDay !== null ? detectedDay : (currentDayContext !== null ? currentDayContext : 0);
    }

    results.push(slotObj);
  });

  return results;
};

window.loadSampleRawSchedule = function() {
  const area = document.getElementById('schedule-raw-textarea');
  if (!area) return;
  const nextSatISO = (() => {
    const d = new Date();
    const diff = d.getDay() === 6 ? 0 : (6 - d.getDay());
    return getOffsetDateISO(diff);
  })();
  area.value = [
    'Lundi 08:00-10:00 Mathématiques Cours C204',
    'Lundi 10:00-12:00 Physique Cours C204',
    'Lundi 14:00-16:00 Chimie TD C204',
    'Lundi 17:00-18:00 Colle Mathématiques Salle B12',
    'Mardi 08:00-10:00 Physique TD C204',
    'Mardi 10:00-12:00 S.I. Cours Labo SI',
    'Mardi 14:00-17:30 TP Physique Labo 2',
    'Mercredi 08:00-10:00 Mathématiques Cours C204',
    'Mercredi 10:00-12:00 Français Cours C204',
    'Mercredi 17:30-18:30 Colle Anglais Salle A104',
    'Jeudi 08:00-10:00 Chimie Cours C204',
    'Jeudi 10:00-12:00 Mathématiques TD C204',
    'Jeudi 14:00-17:00 TP Chimie Labo Chimie',
    'Vendredi 08:00-10:00 Physique Cours C204',
    'Vendredi 10:00-12:00 Anglais Cours C204',
    'Vendredi 14:00-16:30 S.I. TP Labo SI',
    `${nextSatISO} 08:00-12:00 DS Physique Amphi Pasteur`
  ].join('\n');
  window.previewRawScheduleIngestion();
};

window.previewRawScheduleIngestion = function() {
  const area = document.getElementById('schedule-raw-textarea');
  const previewBox = document.getElementById('schedule-raw-preview');
  if (!area || !previewBox) return;
  const parsed = window.parseRawScheduleText(area.value);
  if (!parsed.length) {
    previewBox.innerHTML = `<span style="color:var(--text-subtle);">Colle ton texte ci-dessus pour détecter automatiquement les créneaux (Jour/Date, Horaires, Matière, Type, Salle).</span>`;
    return;
  }
  previewBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="font-weight:700; color:#10B981;"><i class="ph-bold ph-check-circle"></i> ${parsed.length} créneau(x) détecté(s) :</span>
      <span class="mono" style="font-size:10.5px; color:var(--text-subtle);">Prêt à importer</span>
    </div>
    <div style="display:flex; flex-direction:column; gap:5px; max-height:150px; overflow-y:auto;">
      ${parsed.map(sl => {
        const s = getSubject(sl.subject);
        const dayStr = sl.date ? sl.date : DAYS_LABELS[sl.dayOfWeek || 0];
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:5px 8px; border-radius:6px; background:rgba(255,255,255,0.03); border-left:2px solid ${s.color}; font-size:11.5px;">
            <span style="display:flex; align-items:center; gap:6px; min-width:0;">
              <strong class="mono" style="color:var(--text-main);">${escapeHtml(dayStr)} ${sl.start}–${sl.end}</strong>
              <span style="color:${s.color}; font-weight:700;">[${escapeHtml(s.short)}]</span>
              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(sl.title)}</span>
            </span>
            <span class="mono" style="font-size:10px; color:var(--text-muted); flex-shrink:0;">${escapeHtml(sl.type)}${sl.room ? ' · ' + escapeHtml(sl.room) : ''}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
};

window.applyRawScheduleIngestion = function(replaceExisting = false) {
  const area = document.getElementById('schedule-raw-textarea');
  if (!area) return;
  const parsed = window.parseRawScheduleText(area.value);
  if (!parsed.length) {
    showToast('Aucun créneau détecté dans le texte');
    return;
  }
  if (replaceExisting) {
    state.schedule = parsed;
  } else {
    state.schedule = state.schedule.concat(parsed);
  }
  // Synchroniser aussi le textarea JSON
  const jsonArea = document.getElementById('schedule-json-textarea');
  if (jsonArea) jsonArea.value = JSON.stringify(state.schedule, null, 2);

  saveState();
  closeScheduleImportModal();
  renderAgenda();
  showToast(`${parsed.length} créneau(x) importé(s) dans l'agenda`);
};
