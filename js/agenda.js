// agenda.js : double vue (Grille Académique & Planning Soirée intelligent avec persistance des tâches cochées), colloscope, import planning

let viewedWeekStart = getMonday(new Date());
let viewedDayIdx = null;
let lastAgendaDay = '';
let draggedEveningTaskId = null;

window.prevWeek = () => { viewedWeekStart = addDays(viewedWeekStart, -7); renderAgenda(); };
window.nextWeek = () => { viewedWeekStart = addDays(viewedWeekStart, 7); renderAgenda(); };

function goToToday() {
  const now = new Date();
  viewedWeekStart = getMonday(now);
  viewedDayIdx = null;
  lastAgendaDay = formatDateISO(now);
}

window.currentWeek = () => { goToToday(); renderAgenda(); };

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && lastAgendaDay && lastAgendaDay !== formatDateISO(new Date())) {
    goToToday();
    if (state.activeTab === 'agenda') renderAgenda();
  }
});

let CAL_HOUR_H = 64;
function timeToMin(t) {
  const p = String(t || '08:00').split(':');
  return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}
function minToTime(m) {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(m)));
  return String(Math.floor(clamped / 60)).padStart(2, '0') + ':' + String(clamped % 60).padStart(2, '0');
}

function layoutDaySlots(list) {
  const items = list.map(sl => ({
    sl,
    s: timeToMin(sl.start),
    e: Math.max(timeToMin(sl.end), timeToMin(sl.start) + 15)
  })).sort((a, b) => a.s - b.s || a.e - b.e);
  const res = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const cols = [];
    cluster.forEach(it => {
      let c = cols.findIndex(end => end <= it.s);
      if (c === -1) { c = cols.length; cols.push(it.e); }
      else { cols[c] = it.e; }
      it.col = c;
    });
    cluster.forEach(it => { it.cols = cols.length; res.push(it); });
    cluster = [];
    clusterEnd = -1;
  };
  items.forEach(it => {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  });
  flush();
  return res;
}

function agendaIsMobile() { return window.matchMedia('(max-width: 900px)').matches; }

function getAgendaDay(allowSunday = false) {
  const maxIdx = allowSunday ? 6 : 5;
  if (viewedDayIdx !== null) return Math.min(maxIdx, Math.max(0, viewedDayIdx));
  const today = new Date();
  for (let i = 0; i <= maxIdx; i++) {
    if (formatDateISO(addDays(viewedWeekStart, i)) === formatDateISO(today)) return i;
  }
  return 0;
}

window.setAgendaDay = function(i) {
  viewedDayIdx = i;
  renderAgenda();
};

function stepAgendaDay(delta) {
  const isEvening = state.agendaSubTab === 'evening';
  const maxIdx = isEvening ? 6 : 5;
  let d = getAgendaDay(isEvening) + delta;
  if (d > maxIdx) { viewedWeekStart = addDays(viewedWeekStart, 7); d = 0; }
  else if (d < 0) { viewedWeekStart = addDays(viewedWeekStart, -7); d = maxIdx; }
  viewedDayIdx = d;
  renderAgenda();
}

window.setAgendaSubTab = function(subTab) {
  state.agendaSubTab = subTab === 'evening' ? 'evening' : 'academic';
  if (typeof saveUiPrefsLocal === 'function') saveUiPrefsLocal();
  renderAgenda();
};

function getDayScheduleSlots(dateObj, dayIdx) {
  const ds = formatDateISO(dateObj);
  const isHoliday = typeof isFrenchBankHoliday === 'function' && isFrenchBankHoliday(dateObj);
  // Sur un jour férié ou dimanche, aucun cours hebdomadaire obligatoire n'est injecté (seuls les événements explicitement datés sur ce jour précis sont conservés)
  if (isHoliday || dayIdx === 6 || dateObj.getDay() === 0) {
    return state.schedule.filter(sl => sl.date === ds);
  }
  return state.schedule.filter(sl => sl.date === ds || (Number(sl.dayOfWeek) === dayIdx && !sl.date));
}

/**
 * Détecte si la journée est un week-end sans cours ou un jour férié (Blank Canvas)
 */
function getDayCanvasStatus(dateObj, dayIdx, slots) {
  const holidayName = typeof getFrenchBankHolidayName === 'function' ? getFrenchBankHolidayName(dateObj) : null;
  const isSunday = dayIdx === 6 || dateObj.getDay() === 0;
  const isSaturday = dayIdx === 5 || dateObj.getDay() === 6;
  const hasMandatoryCourses = Array.isArray(slots) && slots.length > 0;

  if (holidayName && !hasMandatoryCourses) {
    return { isBlankCanvas: true, reason: `Jour férié (${holidayName})`, badge: 'JOUR FÉRIÉ · BLANK CANVAS' };
  }
  if (isSunday && !hasMandatoryCourses) {
    return { isBlankCanvas: true, reason: 'Dimanche (Aucun cours obligatoire)', badge: 'WEEK-END · BLANK CANVAS' };
  }
  if (isSaturday && !hasMandatoryCourses) {
    return { isBlankCanvas: true, reason: 'Samedi libre (Aucun cours)', badge: 'WEEK-END · BLANK CANVAS' };
  }
  return { isBlankCanvas: false, reason: null, badge: null };
}

/**
 * Feature 1: Dynamic Gap Calculation (After-Hours Engine)
 * Analyse l'emploi du temps du jour pour détecter :
 * - Les fins de cours anticipées vs séances tardives (ex: fin des cours à 15:30, colle à 19:00 -> ouvre 16:00-18:30 avec buffer de 30m)
 * - Les jours Blank Canvas (week-ends / jours fériés sans cours)
 * - La fenêtre de dîner et la limite de coucher (bedtime)
 */
function computeAfterHoursEnvelope(dateObj, dayIdx) {
  const cfg = state.settings || DEFAULT_SETTINGS;
  const bufferMin = Number.isFinite(Number(cfg.commuteBufferMin)) ? Math.max(0, Number(cfg.commuteBufferMin)) : 30;
  const defaultClassEndMin = timeToMin(cfg.defaultClassEnd || '17:30');
  const dinnerStartMin = timeToMin(cfg.dinnerStart || '19:00');
  const dinnerEndMin = Math.max(dinnerStartMin + 15, timeToMin(cfg.dinnerEnd || '20:00'));
  const bedtimeMin = Math.max(dinnerEndMin + 30, timeToMin(cfg.bedtime || '23:00'));

  const rawSlots = getDayScheduleSlots(dateObj, dayIdx);
  const canvasStatus = getDayCanvasStatus(dateObj, dayIdx, rawSlots);

  // Trier et normaliser les créneaux académiques du jour
  const sortedSlots = rawSlots.map(sl => ({
    raw: sl,
    start: timeToMin(sl.start),
    end: Math.max(timeToMin(sl.end), timeToMin(sl.start) + 15),
    title: sl.title || 'Cours',
    type: sl.type || 'Cours'
  })).sort((a, b) => a.start - b.start || a.end - b.end);

  // Cas 1 : Week-end ou Jour Férié (Blank Canvas : aucun cours obligatoire en journée)
  if (canvasStatus.isBlankCanvas) {
    const canvasStart = 9 * 60; // 09:00
    const lunchStart = 12 * 60 + 30; // 12:30
    const lunchEnd = 13 * 60 + 30;   // 13:30
    const windows = [];
    if (canvasStart < lunchStart) {
      windows.push({ start: canvasStart, end: Math.min(lunchStart, dinnerStartMin), label: 'Session Matin (Blank Canvas)' });
    }
    if (lunchEnd < dinnerStartMin) {
      windows.push({ start: lunchEnd, end: Math.min(dinnerStartMin, bedtimeMin), label: 'Session Après-midi' });
    }
    if (dinnerEndMin < bedtimeMin) {
      windows.push({ start: dinnerEndMin, end: bedtimeMin, label: 'Session Soirée' });
    }
    return {
      isBlankCanvas: true,
      canvasReason: canvasStatus.reason,
      canvasBadge: canvasStatus.badge,
      bufferMin,
      startMin: canvasStart,
      dinnerStartMin,
      dinnerEndMin,
      bedtimeMin,
      windows,
      lateAcademicSlots: [],
      lastDaytimeSlot: null,
      lunchBreak: { startMin: lunchStart, endMin: lunchEnd }
    };
  }

  // Cas 2 : Journée de semaine sans créneau renseigné dans l'agenda
  if (sortedSlots.length === 0) {
    const effectiveStart = Math.min(defaultClassEndMin, bedtimeMin);
    const windows = [];
    if (effectiveStart < dinnerStartMin) {
      windows.push({ start: effectiveStart, end: Math.min(dinnerStartMin, bedtimeMin), label: 'Avant dîner' });
    }
    const postDinner = Math.max(effectiveStart, dinnerEndMin);
    if (postDinner < bedtimeMin) {
      windows.push({ start: postDinner, end: bedtimeMin, label: 'Après dîner' });
    }
    return {
      isBlankCanvas: false,
      canvasReason: null,
      canvasBadge: null,
      bufferMin,
      startMin: effectiveStart,
      dinnerStartMin,
      dinnerEndMin,
      bedtimeMin,
      windows,
      lateAcademicSlots: [],
      lastDaytimeSlot: null,
      lunchBreak: null
    };
  }

  // Cas 3 : Journée avec cours -> détection dynamique des trous d'après-midi et des séances tardives (ex: Colle à 19h00)
  // On regroupe les cours continus de la journée (pause déjeuner < 14h15 ou intercours < 2*buffer + 20m)
  let coreDismissalSlot = sortedSlots[0];
  let lateAcademicSlots = [];

  for (let i = 1; i < sortedSlots.length; i++) {
    const prev = coreDismissalSlot;
    const curr = sortedSlots[i];
    const gap = curr.start - prev.end;
    // Un trou d'après-midi exploitable (entre la fin des cours de journée et une séance tardive type Colle)
    // doit se produire après la pause déjeuner (prev.end >= 13:30 et curr.start >= 16:00) et offrir au moins (2 * bufferMin + 25 min)
    // Exemple : fin des cours à 15:30, colle à 19:00 -> gap = 210 min -> fenêtre active 16:00 à 18:30 !
    const minStudyGap = (2 * bufferMin) + 25;
    if (prev.end >= (13 * 60 + 30) && curr.start >= (16 * 60) && gap >= minStudyGap) {
      lateAcademicSlots = sortedSlots.slice(i);
      break;
    } else {
      if (curr.end > coreDismissalSlot.end) {
        coreDismissalSlot = curr;
      }
    }
  }

  // Début de l'enveloppe After-Hours = fin du bloc de cours principal + buffer trajet (ex: 15:30 + 30m = 16:00)
  const rawAfterHoursStart = coreDismissalSlot.end + bufferMin;
  const effectiveStartMin = Math.min(Math.max(12 * 60, rawAfterHoursStart), bedtimeMin);

  // Construire les fenêtres en soustrayant de [effectiveStartMin, bedtimeMin] :
  // 1) Chaque séance tardive entourée de son buffer [slot.start - bufferMin, slot.end + bufferMin]
  // 2) La fenêtre de dîner [dinnerStartMin, dinnerEndMin]
  let intervals = [{ start: effectiveStartMin, end: bedtimeMin }];

  const subtractInterval = (list, cutStart, cutEnd) => {
    if (cutEnd <= cutStart) return list;
    const next = [];
    list.forEach(iv => {
      if (cutEnd <= iv.start || cutStart >= iv.end) {
        next.push(iv);
      } else {
        if (cutStart > iv.start) next.push({ start: iv.start, end: cutStart });
        if (cutEnd < iv.end) next.push({ start: cutEnd, end: iv.end });
      }
    });
    return next;
  };

  lateAcademicSlots.forEach(ls => {
    // Buffer avant la séance tardive (ex: 19:00 - 30m = 18:30)
    // Si la séance tardive se termine pendant ou juste avant le dîner, pas de double buffer après
    const postBuffer = (ls.end >= dinnerStartMin && ls.end <= dinnerEndMin) ? 0 : bufferMin;
    intervals = subtractInterval(intervals, ls.start - bufferMin, ls.end + postBuffer);
  });

  // Soustraire la pause dîner
  intervals = subtractInterval(intervals, dinnerStartMin, dinnerEndMin);

  // Conserver les fenêtres d'au moins 15 minutes
  const windows = intervals
    .filter(iv => (iv.end - iv.start) >= 15)
    .map(iv => ({
      start: iv.start,
      end: iv.end,
      label: iv.end <= dinnerStartMin ? 'Fenêtre pré-dîner' : 'Fenêtre soirée'
    }));

  return {
    isBlankCanvas: false,
    canvasReason: null,
    canvasBadge: null,
    bufferMin,
    startMin: effectiveStartMin,
    rawClassEndMin: coreDismissalSlot.end,
    dinnerStartMin,
    dinnerEndMin,
    bedtimeMin,
    windows,
    lateAcademicSlots,
    lastDaytimeSlot: coreDismissalSlot.raw,
    lunchBreak: null
  };
}

function computeEveningStartMinForDay(dateObj, dayIdx) {
  const env = computeAfterHoursEnvelope(dateObj, dayIdx);
  return env.startMin;
}

// =========================================================
// FEATURE 2 : PEDAGOGICAL DEPENDENCY ORDERING (Cours -> TD/Exos -> DM)
// =========================================================

const PEDAGO_STOPWORDS = new Set([
  'cours', 'td', 'tp', 'dm', 'ds', 'colle', 'kholle', 'exercice', 'exercices',
  'exo', 'exos', 'chapitre', 'chap', 'ch', 'lecon', 'theme', 'partie', 'sequence',
  'sujet', 'feuille', 'fiche', 'serie', 'revisions', 'revision', 'preparation',
  'apprendre', 'relire', 'faire', 'finir', 'terminer', 'corriger', 'entrainement',
  'approfondissement', 'dans', 'pour', 'avec', 'sans', 'tout', 'tous', 'toute',
  'toutes', 'entre', 'vers', 'chez', 'plus', 'moins', 'sur', 'aux', 'des', 'les',
  'une', 'numero', 'maths', 'mathematiques', 'physique', 'chimie', 'sii',
  'informatique', 'anglais', 'francais', 'philo'
]);

/**
 * Normalise un intitulé de mission (sans accents, minuscule) et extrait :
 * - Les jetons de chapitre explicites (ex: "Ch. 2", "Chapitre 02" -> "ch_2")
 * - Les jetons thématiques (ex: "Thermodynamique" -> "thermodynamique")
 */
function extractChapterSignature(title) {
  const norm = String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const chapterNums = [];
  const chapRegex = /\b(?:chapitre|chap|ch|theme|lecon|partie|seq|sequence)\s*\.?\s*0*(\d+|[ivx]{1,4})\b/gi;
  let match;
  while ((match = chapRegex.exec(norm)) !== null) {
    chapterNums.push('ch_' + String(match[1]).toLowerCase());
  }

  const words = norm
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !/^\d+$/.test(w) && !PEDAGO_STOPWORDS.has(w))
    .map(w => w.replace(/(?:es|s|x)$/, '')); // Racinisation légère pluriel -> singulier

  const topicTokens = Array.from(new Set(words.filter(w => w.length >= 4)));
  return {
    chapterNums: Array.from(new Set(chapterNums)),
    topicTokens
  };
}

/**
 * Retourne le rang pédagogique strict :
 * 1 = Cours (apprentissage / révision de cours)
 * 2 = Exercice / TD / TP / Colle (entraînement & application)
 * 3 = DM / DS (production / évaluation)
 */
function getPedagogicalRank(task) {
  if (!task) return 2;
  const rawType = String(task.type || '').trim().toLowerCase();
  const normTitle = String(task.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  if (rawType === 'cours' || rawType === 'revision' || rawType === 'révision' || /^(?:cours|apprendre|relire\s+le\s+cours)\b/.test(normTitle)) {
    return 1;
  }
  if (rawType === 'dm' || rawType === 'ds' || /^(?:dm|ds|devoir)\b/.test(normTitle)) {
    return 3;
  }
  if (rawType === 'exercice' || rawType === 'td' || rawType === 'tp' || rawType === 'colle' || /^(?:td|tp|exo|exercice|colle|kholle)\b/.test(normTitle)) {
    return 2;
  }
  return 2;
}

function getPedagogicalStageName(rank) {
  if (rank === 1) return 'Cours';
  if (rank === 2) return 'TD/Exos';
  return 'DM';
}

/**
 * Vérifie si deux missions de la même matière partagent le même chapitre/thème
 * ou appartiennent au même flux pédagogique sans conflit de numéro de chapitre.
 */
function tasksSharePedagogicalContext(sigA, sigB) {
  // Si les deux mentionnent un numéro de chapitre explicite (ex: Ch. 2 vs Ch. 3), ils doivent avoir au moins un numéro en commun
  if (sigA.chapterNums.length > 0 && sigB.chapterNums.length > 0) {
    return sigA.chapterNums.some(c => sigB.chapterNums.includes(c));
  }
  // S'ils partagent un mot-clé thématique (ex: "thermodynamique", "optique", "matrice")
  if (sigA.topicTokens.length > 0 && sigB.topicTokens.length > 0) {
    if (sigA.topicTokens.some(t => sigB.topicTokens.includes(t))) return true;
  }
  // Dans une même matière programmée le même soir, si aucun numéro de chapitre contradictoire n'est spécifié,
  // le flux Cours -> TD/Exos -> DM s'applique naturellement.
  return true;
}

// =========================================================
// ALGORITHME D'ALLOCATION AFTER-HOURS (KNAPSACK, SIESTES & PERSISTANCE)
// =========================================================
function getTaskEveningDurationHours(task) {
  if (!task) return 1;
  const custom = state.eveningPlan && state.eveningPlan.customDurations && state.eveningPlan.customDurations[task.id];
  if (custom && custom >= 0.25) return Number(custom);

  if (isTaskCompleted(task)) {
    if (task.eveningAllocatedHours && task.eveningAllocatedHours >= 0.25) {
      return Number(task.eveningAllocatedHours);
    }
    return getTaskTotalDuration(task);
  }

  if (task.pipeline && task.pipeline.enabled && Array.isArray(task.pipeline.phases) && task.pipeline.phases.length > 0) {
    const nextPhase = task.pipeline.phases.find(p => !p.done);
    if (nextPhase) return Math.max(0.25, parseFloat(nextPhase.duration) || 0.5);
  }
  return getTaskRemainingDuration(task);
}

function getTaskActivePhaseLabel(task) {
  if (task.pipeline && task.pipeline.enabled && Array.isArray(task.pipeline.phases) && task.pipeline.phases.length > 0) {
    const idx = task.pipeline.phases.findIndex(p => !p.done);
    if (idx !== -1) {
      return `${task.pipeline.phases[idx].title} (${idx + 1}/${task.pipeline.phases.length})`;
    }
    return `Pipeline complété (${task.pipeline.phases.length}/${task.pipeline.phases.length})`;
  }
  return null;
}

function getEveningSelectedDayISO() {
  const selDay = getAgendaDay(state.agendaSubTab === 'evening');
  const selDate = addDays(viewedWeekStart, selDay);
  return formatDateISO(selDate);
}

function getDayNaps(dayISO) {
  if (!state.eveningPlan || !state.eveningPlan.naps || typeof state.eveningPlan.naps !== 'object') return [];
  const list = state.eveningPlan.naps[dayISO];
  return Array.isArray(list) ? list : [];
}

function getOrderedEveningCandidates(dayISO = null) {
  const targetISO = dayISO || getEveningSelectedDayISO();

  const pool = state.tasks.filter(t => !isTaskCompleted(t) || t.completedInEveningDate === targetISO);

  const manual = (state.eveningPlan && Array.isArray(state.eveningPlan.manualOrder)) ? state.eveningPlan.manualOrder : [];
  const rankMap = new Map();
  manual.forEach((id, idx) => rankMap.set(id, idx));

  const cfg = state.settings || DEFAULT_SETTINGS;
  const tomorrowFirst = cfg.tomorrowFirst !== false;

  // 1. Tri initial par Tension Index (et respect de l'ordre manuel si déjà fixé)
  const tensionSorted = pool.slice().sort((a, b) => {
    const hasA = rankMap.has(a.id);
    const hasB = rankMap.has(b.id);
    if (hasA && hasB) return rankMap.get(a.id) - rankMap.get(b.id);
    if (hasA !== hasB) return hasA ? -1 : 1;

    const pa = computePressure(Object.assign({}, a, { completed: false, status: 'todo' }));
    const pb = computePressure(Object.assign({}, b, { completed: false, status: 'todo' }));

    if (tomorrowFirst) {
      const aTom = a.dueDate && pa.diffDays <= 1;
      const bTom = b.dueDate && pb.diffDays <= 1;
      if (aTom !== bTom) return aTom ? -1 : 1;
    }
    if (pb.score !== pa.score) return pb.score - pa.score;
    return pa.diffDays - pb.diffDays;
  });

  // 2. Feature 2 : Ordonnancement pédagogique (Cours -> Exercice/TD -> DM)
  // Pour les tâches non figées manuellement, regrouper les tâches de même matière et chapitre/thème
  // afin d'imposer l'ordre prérequis Cours (1) -> Exercice/TD (2) -> DM (3)
  const sigCache = new Map();
  const getSig = (t) => {
    if (!sigCache.has(t.id)) sigCache.set(t.id, extractChapterSignature(t.title));
    return sigCache.get(t.id);
  };

  tensionSorted.forEach(t => { delete t._pedagoChainLabel; });

  const result = [];
  const consumedIds = new Set();

  for (let i = 0; i < tensionSorted.length; i++) {
    const anchor = tensionSorted[i];
    if (consumedIds.has(anchor.id)) continue;

    // Si la tâche a été placée manuellement par l'utilisateur, respecter sa position exacte
    if (rankMap.has(anchor.id)) {
      consumedIds.add(anchor.id);
      result.push(anchor);
      continue;
    }

    const anchorSig = getSig(anchor);
    const cluster = [anchor];
    consumedIds.add(anchor.id);

    for (let j = i + 1; j < tensionSorted.length; j++) {
      const cand = tensionSorted[j];
      if (consumedIds.has(cand.id) || rankMap.has(cand.id)) continue;
      if (cand.subject !== anchor.subject) continue;
      const candSig = getSig(cand);
      if (tasksSharePedagogicalContext(anchorSig, candSig)) {
        cluster.push(cand);
        consumedIds.add(cand.id);
      }
    }

    if (cluster.length > 1) {
      // Vérifier s'il y a plusieurs niveaux pédagogiques distincts (ex: Cours + TD ou TD + DM)
      const distinctStages = new Set(cluster.map(t => getPedagogicalRank(t)));
      cluster.sort((a, b) => {
        const ra = getPedagogicalRank(a);
        const rb = getPedagogicalRank(b);
        if (ra !== rb) return ra - rb;
        const pa = computePressure(Object.assign({}, a, { completed: false, status: 'todo' }));
        const pb = computePressure(Object.assign({}, b, { completed: false, status: 'todo' }));
        return pb.score - pa.score;
      });
      if (distinctStages.size > 1) {
        const chainLabel = Array.from(distinctStages)
          .sort((a, b) => a - b)
          .map(r => getPedagogicalStageName(r))
          .join(' → ');
        cluster.forEach((t, idx) => {
          t._pedagoChainLabel = `Flux ${idx + 1}/${cluster.length} · ${chainLabel}`;
        });
      }
    }

    result.push(...cluster);
  }

  return result;
}

function buildEveningScheduleModel(dateObj, dayIdx) {
  const dayISO = formatDateISO(dateObj);
  const cfg = state.settings || DEFAULT_SETTINGS;
  const env = computeAfterHoursEnvelope(dateObj, dayIdx);

  const effectiveStartMin = env.startMin;
  const dinnerStartMin = env.dinnerStartMin;
  const dinnerEndMin = env.dinnerEndMin;
  const bedtimeMin = env.bedtimeMin;
  const windows = env.windows;

  const baseStudyCapacityMin = windows.reduce((acc, w) => acc + Math.max(0, w.end - w.start), 0);
  const excludedSet = new Set((state.eveningPlan && state.eveningPlan.excludedIds) || []);
  const orderedCandidates = getOrderedEveningCandidates(dayISO);
  const dayNaps = getDayNaps(dayISO);
  const totalNapMin = dayNaps.reduce((acc, n) => acc + (parseInt(n.durationMin, 10) || 20), 0);

  // Étape 1 : Sélectionner les missions qui rentrent dans l'enveloppe d'étude (AVANT l'impact des siestes,
  // afin qu'insérer une sieste décale dynamiquement les blocs suivants SANS JAMAIS supprimer de mission !)
  const selectedTasks = [];
  const overflowTasks = [];
  const allocatedTaskIds = new Set();
  let usedStudyMin = 0;
  let bedtimeOverflowMin = 0;

  orderedCandidates.forEach(task => {
    if (excludedSet.has(task.id)) {
      if (!isTaskCompleted(task)) {
        overflowTasks.push({ task, reason: 'Reporté manuellement', neededMin: Math.round(getTaskEveningDurationHours(task) * 60), isManualDefer: true });
      }
      return;
    }

    const durHours = getTaskEveningDurationHours(task);
    const neededMin = Math.max(15, Math.round(durHours * 60));
    const remainingBaseCap = Math.max(0, baseStudyCapacityMin - usedStudyMin);

    if (neededMin > remainingBaseCap) {
      if (!isTaskCompleted(task)) {
        overflowTasks.push({ task, reason: 'Dépasse le couvre-feu (' + (cfg.bedtime || '23:00') + ')', neededMin, isManualDefer: false });
        bedtimeOverflowMin += neededMin;
      }
      return;
    }

    selectedTasks.push({ task, neededMin });
    allocatedTaskIds.add(task.id);
    usedStudyMin += neededMin;
  });

  // Étape 2 : Ordonner la séquence unifiée [Siestes + Missions sélectionnées] selon manualOrder
  // Par défaut, une nouvelle sieste se place en tête ou à la position choisie par glisser-déposer,
  // ce qui décale dynamiquement toutes les missions situées après elle.
  const manual = (state.eveningPlan && Array.isArray(state.eveningPlan.manualOrder)) ? state.eveningPlan.manualOrder : [];
  const timelineSequence = [];
  const napMap = new Map(dayNaps.map(n => [n.id, n]));
  const taskMap = new Map(selectedTasks.map(item => [item.task.id, item]));
  const placedIds = new Set();

  manual.forEach(id => {
    if (napMap.has(id) && !placedIds.has(id)) {
      timelineSequence.push({ itemType: 'nap', nap: napMap.get(id) });
      placedIds.add(id);
    } else if (taskMap.has(id) && !placedIds.has(id)) {
      timelineSequence.push({ itemType: 'task', taskItem: taskMap.get(id) });
      placedIds.add(id);
    }
  });

  // Les siestes non encore présentes dans manualOrder sont insérées au début de la fenêtre active
  dayNaps.forEach(n => {
    if (!placedIds.has(n.id)) {
      timelineSequence.unshift({ itemType: 'nap', nap: n });
      placedIds.add(n.id);
    }
  });

  selectedTasks.forEach(item => {
    if (!placedIds.has(item.task.id)) {
      timelineSequence.push({ itemType: 'task', taskItem: item });
      placedIds.add(item.task.id);
    }
  });

  // Étape 3 : Allouer les créneaux horaires dans les fenêtres actives
  // Si les siestes poussent la dernière tâche au-delà de bedtimeMin, on étend la dernière fenêtre de totalNapMin
  // pour que les tâches soient décalées (shifted) sans jamais être supprimées.
  const winCursors = windows.map((w, idx) => ({
    start: w.start,
    cursor: w.start,
    end: (idx === windows.length - 1) ? (w.end + totalNapMin) : w.end,
    baseEnd: w.end,
    label: w.label
  }));

  const scheduledBlocks = [];

  timelineSequence.forEach(entry => {
    if (entry.itemType === 'nap') {
      const nap = entry.nap;
      const napDur = Math.max(10, parseInt(nap.durationMin, 10) || 20);
      let left = napDur;
      for (let i = 0; i < winCursors.length && left > 0; i++) {
        const w = winCursors[i];
        const avail = w.end - w.cursor;
        if (avail <= 0) continue;
        const chunk = Math.min(avail, left);
        scheduledBlocks.push({
          kind: 'nap',
          nap,
          startMin: w.cursor,
          endMin: w.cursor + chunk,
          durationMin: chunk
        });
        w.cursor += chunk;
        left -= chunk;
      }
      return;
    }

    const { task, neededMin } = entry.taskItem;
    let leftToAllocate = neededMin;
    let partIndex = 1;
    const tempSegments = [];

    for (let i = 0; i < winCursors.length && leftToAllocate > 0; i++) {
      const w = winCursors[i];
      const avail = w.end - w.cursor;
      if (avail <= 0) continue;
      const chunk = Math.min(avail, leftToAllocate);
      tempSegments.push({
        winIdx: i,
        start: w.cursor,
        end: w.cursor + chunk,
        durationMin: chunk
      });
      w.cursor += chunk;
      leftToAllocate -= chunk;
    }

    const totalParts = tempSegments.length;
    tempSegments.forEach(seg => {
      scheduledBlocks.push({
        kind: 'task',
        task,
        startMin: seg.start,
        endMin: seg.end,
        durationMin: seg.durationMin,
        partIndex: totalParts > 1 ? partIndex++ : null,
        totalParts: totalParts > 1 ? totalParts : null,
        shiftedPastBedtime: seg.end > bedtimeMin
      });
    });
  });

  const timelineEvents = [...scheduledBlocks];

  // Ajouter les créneaux libres restants dans la limite du couvre-feu de base
  winCursors.forEach(w => {
    const freeEnd = Math.min(w.baseEnd, w.end);
    if (freeEnd - w.cursor >= 15) {
      timelineEvents.push({
        kind: 'free',
        startMin: w.cursor,
        endMin: freeEnd,
        durationMin: freeEnd - w.cursor
      });
    }
  });

  // Ajouter les séances académiques tardives (ex: Colle 19:00-20:00) pour visualiser pourquoi la fenêtre pré-colle s'est arrêtée à 18:30
  if (Array.isArray(env.lateAcademicSlots)) {
    env.lateAcademicSlots.forEach(ls => {
      timelineEvents.push({
        kind: 'academic_late',
        slot: ls,
        startMin: ls.start,
        endMin: ls.end,
        durationMin: ls.end - ls.start,
        bufferMin: env.bufferMin
      });
    });
  }

  // Ajouter la pause déjeuner en mode Blank Canvas (Week-end / Férié)
  if (env.lunchBreak) {
    timelineEvents.push({
      kind: 'lunch',
      startMin: env.lunchBreak.startMin,
      endMin: env.lunchBreak.endMin,
      durationMin: env.lunchBreak.endMin - env.lunchBreak.startMin
    });
  }

  if (dinnerStartMin < bedtimeMin && dinnerEndMin > effectiveStartMin) {
    timelineEvents.push({
      kind: 'dinner',
      startMin: dinnerStartMin,
      endMin: dinnerEndMin,
      durationMin: dinnerEndMin - dinnerStartMin
    });
  }

  timelineEvents.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const cumulativeDemandMin = usedStudyMin + bedtimeOverflowMin;

  return {
    dayISO,
    envelope: env,
    startMin: effectiveStartMin,
    dinnerStartMin,
    dinnerEndMin,
    bedtimeMin,
    totalStudyCapacityMin: baseStudyCapacityMin,
    usedStudyMin,
    totalNapMin,
    bedtimeOverflowMin,
    cumulativeDemandMin,
    timelineEvents,
    allocatedTaskIds: Array.from(allocatedTaskIds),
    overflowTasks
  };
}

function formatDurationHM(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes || 0));
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  return `${hrs}h${String(mins).padStart(2, '0')}`;
}

function ensureEveningManualOrderInitialized(dayISO = null) {
  const targetISO = dayISO || getEveningSelectedDayISO();
  if (!state.eveningPlan) state.eveningPlan = { manualOrder: [], excludedIds: [], customDurations: {}, pinnedEveningIds: [], naps: {} };
  const existingNaps = getDayNaps(targetISO).map(n => n.id);
  const candidates = getOrderedEveningCandidates(targetISO).map(t => t.id);
  // Conserver les positions existantes des siestes dans manualOrder
  const currentManual = Array.isArray(state.eveningPlan.manualOrder) ? state.eveningPlan.manualOrder : [];
  const merged = [];
  currentManual.forEach(id => {
    if ((existingNaps.includes(id) || candidates.includes(id)) && !merged.includes(id)) {
      merged.push(id);
    }
  });
  existingNaps.forEach(id => {
    if (!merged.includes(id)) merged.unshift(id);
  });
  candidates.forEach(id => {
    if (!merged.includes(id)) merged.push(id);
  });
  state.eveningPlan.manualOrder = merged;
}

/**
 * Feature 1.3 : Power Nap / Pause Trigger (+ Poser une sieste : 20m, 30m, 45m)
 * Insère une sieste dans l'After-Hours Engine et décale dynamiquement les blocs de tâches suivants sans les supprimer.
 */
window.addEveningNap = function(durationMin = 20, event = null) {
  if (event) event.stopPropagation();
  const dur = [20, 30, 45].includes(Number(durationMin)) ? Number(durationMin) : 20;
  const dayISO = getEveningSelectedDayISO();
  ensureEveningManualOrderInitialized(dayISO);
  if (!state.eveningPlan.naps || typeof state.eveningPlan.naps !== 'object') {
    state.eveningPlan.naps = {};
  }
  if (!Array.isArray(state.eveningPlan.naps[dayISO])) {
    state.eveningPlan.naps[dayISO] = [];
  }
  const napId = 'nap_' + uid();
  state.eveningPlan.naps[dayISO].push({
    id: napId,
    durationMin: dur,
    label: `Power Nap (${dur}m)`
  });
  // Insérer la sieste au début des tâches non terminées (ou en tête de soirée) pour décaler les blocs suivants
  const firstActiveTaskIdx = state.eveningPlan.manualOrder.findIndex(id => {
    const t = state.tasks.find(x => x.id === id);
    return t && !isTaskCompleted(t);
  });
  if (firstActiveTaskIdx !== -1) {
    state.eveningPlan.manualOrder.splice(firstActiveTaskIdx, 0, napId);
  } else {
    state.eveningPlan.manualOrder.unshift(napId);
  }
  saveState();
  renderAgenda();
  showToast(`Sieste de ${dur} min posée — créneaux suivants décalés (+${dur}m)`);
};

window.removeEveningNap = function(napId, dayISO = null, event = null) {
  if (event) event.stopPropagation();
  const targetISO = dayISO || getEveningSelectedDayISO();
  if (state.eveningPlan && state.eveningPlan.naps && Array.isArray(state.eveningPlan.naps[targetISO])) {
    state.eveningPlan.naps[targetISO] = state.eveningPlan.naps[targetISO].filter(n => n.id !== napId);
  }
  if (state.eveningPlan && Array.isArray(state.eveningPlan.manualOrder)) {
    state.eveningPlan.manualOrder = state.eveningPlan.manualOrder.filter(id => id !== napId);
  }
  saveState();
  renderAgenda();
  showToast('Sieste retirée — planning réajusté');
};

window.moveEveningTaskOrder = function(taskId, delta, event) {
  if (event) event.stopPropagation();
  ensureEveningManualOrderInitialized();
  state.eveningPlan.excludedIds = (state.eveningPlan.excludedIds || []).filter(id => id !== taskId);
  const arr = state.eveningPlan.manualOrder;
  const idx = arr.indexOf(taskId);
  if (idx === -1) return;
  const targetIdx = Math.max(0, Math.min(arr.length - 1, idx + delta));
  if (targetIdx === idx) return;
  const [item] = arr.splice(idx, 1);
  arr.splice(targetIdx, 0, item);
  saveState();
  renderAgenda();
};

window.prioritizeTaskTonight = function(taskId, event) {
  if (event) event.stopPropagation();
  ensureEveningManualOrderInitialized();
  state.eveningPlan.excludedIds = (state.eveningPlan.excludedIds || []).filter(id => id !== taskId);
  state.eveningPlan.manualOrder = [taskId, ...state.eveningPlan.manualOrder.filter(id => id !== taskId)];
  saveState();
  renderAgenda();
  showToast('Mission placée en tête de l\'After-Hours Engine');
};

window.deferTaskToOverflow = function(taskId, event) {
  if (event) event.stopPropagation();
  ensureEveningManualOrderInitialized();
  if (!state.eveningPlan.excludedIds.includes(taskId)) {
    state.eveningPlan.excludedIds.push(taskId);
  }
  saveState();
  renderAgenda();
  showToast('Mission basculée dans À reporter');
};

window.adjustEveningTaskDuration = function(taskId, deltaHours, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!state.eveningPlan) state.eveningPlan = { manualOrder: [], excludedIds: [], customDurations: {}, pinnedEveningIds: [], naps: {} };
  if (!state.eveningPlan.customDurations) state.eveningPlan.customDurations = {};
  const current = getTaskEveningDurationHours(task);
  const next = Math.max(0.25, Math.min(6, Number((current + deltaHours).toFixed(2))));
  state.eveningPlan.customDurations[taskId] = next;
  task.eveningAllocatedHours = next;
  saveState();
  renderAgenda();
};

window.resetEveningAllocation = function() {
  const existingNaps = (state.eveningPlan && state.eveningPlan.naps) ? state.eveningPlan.naps : {};
  state.eveningPlan = { manualOrder: [], excludedIds: [], customDurations: {}, pinnedEveningIds: [], naps: existingNaps };
  state.tasks.forEach(t => {
    delete t.completedInEveningDate;
    delete t.eveningAllocatedHours;
  });
  saveState();
  renderAgenda();
  showToast('After-Hours Engine recalculé (Tension + Flux Cours → TD → DM)');
};

window.updateEveningRhythmQuick = function(field, value) {
  if (value === undefined || value === null || value === '') return;
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (field === 'commuteBufferMin') {
    const num = parseInt(value, 10);
    state.settings.commuteBufferMin = Number.isFinite(num) ? Math.min(120, Math.max(0, num)) : 30;
  } else {
    state.settings[field] = value;
  }
  saveState();
  renderAgenda();
  if (typeof window.renderSettingsPanel === 'function') window.renderSettingsPanel();
};

// Validation persistante dans l'After-Hours Engine : la tâche NE disparaît PAS de son créneau
window.toggleTaskFromEvening = function(taskId, dayISO, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;

  const targetISO = dayISO || getEveningSelectedDayISO();
  ensureEveningManualOrderInitialized(targetISO);
  if (!state.eveningPlan.pinnedEveningIds) state.eveningPlan.pinnedEveningIds = [];
  if (!state.eveningPlan.pinnedEveningIds.includes(taskId)) {
    state.eveningPlan.pinnedEveningIds.push(taskId);
  }

  const wasDone = isTaskCompleted(t);
  if (!wasDone) {
    t.eveningAllocatedHours = getTaskEveningDurationHours(t);
    setTaskCompletedState(t, true, targetISO);
    showToast('Mission validée (conservée dans la timeline)');
  } else {
    setTaskCompletedState(t, false, null);
    t.completedInEveningDate = targetISO;
    showToast('Mission remise en cours');
  }
  saveState();
  renderAgenda();
};

// Drag & Drop handlers for After-Hours Engine (supporte les tâches et les siestes)
window.onEveningDragStart = function(e, itemId) {
  draggedEveningTaskId = itemId;
  e.currentTarget.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
  }
};

window.onEveningDragEnd = function(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.evening-drop-target').forEach(el => el.classList.remove('drag-over'));
};

window.onEveningDragOver = function(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
};

window.onEveningDragLeave = function(e) {
  e.currentTarget.classList.remove('drag-over');
};

window.onEveningDropOnTask = function(e, targetItemId) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  const srcId = draggedEveningTaskId;
  draggedEveningTaskId = null;
  if (!srcId || srcId === targetItemId) return;

  ensureEveningManualOrderInitialized();
  state.eveningPlan.excludedIds = (state.eveningPlan.excludedIds || []).filter(id => id !== srcId);
  const arr = state.eveningPlan.manualOrder.filter(id => id !== srcId);
  const targetIdx = arr.indexOf(targetItemId);
  if (targetIdx === -1) arr.unshift(srcId);
  else arr.splice(targetIdx, 0, srcId);
  state.eveningPlan.manualOrder = arr;
  saveState();
  renderAgenda();
  showToast('Ordre After-Hours mis à jour');
};

window.onEveningDropToTimeline = function(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedEveningTaskId) return;
  const srcId = draggedEveningTaskId;
  draggedEveningTaskId = null;
  if (String(srcId).startsWith('nap_')) return;
  window.prioritizeTaskTonight(srcId);
};

window.onEveningDropToOverflow = function(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedEveningTaskId) return;
  const srcId = draggedEveningTaskId;
  draggedEveningTaskId = null;
  if (String(srcId).startsWith('nap_')) {
    window.removeEveningNap(srcId);
    return;
  }
  window.deferTaskToOverflow(srcId);
};

// =========================================================
// RENDU GLOBAL DE L'ONGLET AGENDA
// =========================================================
function renderAgenda() {
  const subTab = state.agendaSubTab === 'evening' ? 'evening' : 'academic';
  const btnAcad = document.getElementById('agenda-tab-academic-btn');
  const btnEven = document.getElementById('agenda-tab-evening-btn');
  if (btnAcad) btnAcad.classList.toggle('active-pill', subTab === 'academic');
  if (btnEven) btnEven.classList.toggle('active-pill', subTab === 'evening');

  const academicControls = document.getElementById('agenda-academic-controls');
  if (academicControls) academicControls.style.display = subTab === 'academic' ? 'flex' : 'none';

  const mobileTools = document.querySelector('#tab-agenda .agenda-tools.mobile-block');
  if (mobileTools) mobileTools.style.display = subTab === 'academic' ? '' : 'none';

  const box = document.getElementById('calendar-grid-box');
  if (box) box.classList.toggle('evening-mode-active', subTab === 'evening');

  const docsCount = Array.isArray(state.scheduleDocs) ? state.scheduleDocs.length : 0;
  ['agenda-docs-count-badge', 'agenda-docs-mobile-badge'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = String(docsCount);
      el.style.display = docsCount > 0 ? 'inline-block' : 'none';
    }
  });

  const weekDates6 = [0, 1, 2, 3, 4, 5].map(i => addDays(viewedWeekStart, i));
  const weekDates7 = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(viewedWeekStart, i));
  const labelEl = document.getElementById('agenda-week-label');
  if (labelEl) {
    const endIdx = subTab === 'evening' ? 6 : 5;
    labelEl.textContent = `Semaine du ${formatShortDate(weekDates7[0])} au ${formatShortDate(weekDates7[endIdx])}`;
  }

  if (subTab === 'evening') {
    renderEveningPlanner(weekDates7);
  } else {
    renderAcademicGrid(weekDates6);
  }
}

function renderEveningPlanner(weekDates) {
  const box = document.getElementById('calendar-grid-box');
  const selDay = getAgendaDay(true);
  const selDate = weekDates[selDay] || weekDates[0];
  const dayISO = formatDateISO(selDate);
  const todayStr = formatDateISO(new Date());
  const isToday = dayISO === todayStr;

  const cfg = state.settings || DEFAULT_SETTINGS;
  const model = buildEveningScheduleModel(selDate, selDay);
  const env = model.envelope;
  const dayLabels = typeof AFTER_HOURS_DAYS_LABELS !== 'undefined' ? AFTER_HOURS_DAYS_LABELS : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  const dayTabsHtml = `
    <div class="evening-day-tabs">
      ${weekDates.map((d, i) => {
        const dIso = formatDateISO(d);
        const active = i === selDay;
        const td = dIso === todayStr;
        const hol = typeof getFrenchBankHolidayName === 'function' ? getFrenchBankHolidayName(d) : null;
        const lbl = dayLabels[i] || 'Jour';
        return `
          <button type="button" onclick="window.setAgendaDay(${i})" class="btn-ghost evening-day-btn ${active ? 'active-pill' : ''}" title="${hol ? escapeHtml(hol) : lbl}">
            <span class="evening-day-name">
              <span class="day-lbl-full">${lbl}</span>
              <span class="day-lbl-short">${lbl.slice(0, 3)}</span>
              ${td ? `<span class="evening-today-dot"></span>` : ''}
              ${hol ? `<span style="font-size:9px; color:#34D399; font-weight:800;">★</span>` : ''}
            </span>
            <span class="evening-day-date mono">${formatShortDate(d)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  // Résumé intelligent de l'ouverture de fenêtre (ex: Fin des cours 15:30 + 30m buffer -> 16:00 | Colle à 19:00 -> fenêtre 16:00-18:30)
  const startContextHtml = env.isBlankCanvas
    ? `<span style="color:#34D399; font-weight:700;"><i class="ph-bold ph-sun-horizon"></i> ${escapeHtml(env.canvasBadge)}</span> <small class="hide-mobile" style="color:var(--text-subtle);">(${escapeHtml(env.canvasReason)} · 09:00 → ${minToTime(model.bedtimeMin)})</small>`
    : `<span><span class="rhythm-lbl">Ouverture :</span> <strong class="mono">${minToTime(model.startMin)}</strong>${env.lastDaytimeSlot ? ` <small class="hide-mobile" style="color:var(--text-subtle);">(Fin ${minToTime(env.rawClassEndMin)} + ${env.bufferMin}m trajet)</small>` : ''}</span>`;

  const windowsSummaryBadges = env.windows.map(w =>
    `<span class="mono" style="font-size:10.5px; padding:2px 7px; border-radius:6px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); color:#38BDF8;">${minToTime(w.start)} → ${minToTime(w.end)}</span>`
  ).join(' ');

  const rhythmBarHtml = `
    <div class="evening-rhythm-bar">
      <div class="evening-rhythm-pills">
        <div class="evening-stat-pill">
          <i class="ph-bold ph-lightning" style="color:#38BDF8;"></i>
          ${startContextHtml}
        </div>
        <div class="evening-stat-pill" title="Buffer de trajet / transition après les cours et avant une colle tardive">
          <i class="ph-bold ph-person-simple-walk" style="color:#34D399;"></i>
          <span class="rhythm-lbl">Buffer :</span>
          <select onchange="window.updateEveningRhythmQuick('commuteBufferMin', this.value)" class="evening-time-mini mono" style="cursor:pointer;">
            ${[0, 15, 20, 30, 45, 60].map(v => `<option value="${v}" ${Number(env.bufferMin) === v ? 'selected' : ''}>${v}m</option>`).join('')}
          </select>
        </div>
        <div class="evening-stat-pill">
          <i class="ph-bold ph-fork-knife" style="color:#F59E0B;"></i>
          <span class="rhythm-lbl">Dîner :</span>
          <input type="time" value="${escapeHtml(cfg.dinnerStart || '19:00')}" onchange="window.updateEveningRhythmQuick('dinnerStart', this.value)" class="evening-time-mini mono" title="Début du dîner" />
          <span>→</span>
          <input type="time" value="${escapeHtml(cfg.dinnerEnd || '20:00')}" onchange="window.updateEveningRhythmQuick('dinnerEnd', this.value)" class="evening-time-mini mono" title="Fin du dîner" />
        </div>
        <div class="evening-stat-pill">
          <i class="ph-bold ph-moon-stars" style="color:#A855F7;"></i>
          <span class="rhythm-lbl">Coucher :</span>
          <input type="time" value="${escapeHtml(cfg.bedtime || '23:00')}" onchange="window.updateEveningRhythmQuick('bedtime', this.value)" class="evening-time-mini mono" title="Heure de coucher stricte" />
        </div>
      </div>
      <div class="evening-rhythm-actions" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
        <div class="nap-trigger-group" style="display:inline-flex; align-items:center; gap:4px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.28); padding:3px 7px; border-radius:9px;">
          <span style="font-size:11px; font-weight:700; color:#34D399; padding:0 4px;"><i class="ph-bold ph-battery-charging"></i> + Poser une sieste :</span>
          <button type="button" onclick="window.addEveningNap(20, event)" class="btn-ghost evening-ctrl-btn mono" style="padding:3px 7px; font-size:11px; color:#34D399; border-color:rgba(16,185,129,0.3);">20m</button>
          <button type="button" onclick="window.addEveningNap(30, event)" class="btn-ghost evening-ctrl-btn mono" style="padding:3px 7px; font-size:11px; color:#34D399; border-color:rgba(16,185,129,0.3);">30m</button>
          <button type="button" onclick="window.addEveningNap(45, event)" class="btn-ghost evening-ctrl-btn mono" style="padding:3px 7px; font-size:11px; color:#34D399; border-color:rgba(16,185,129,0.3);">45m</button>
        </div>
        <button type="button" onclick="window.resetEveningAllocation()" class="btn-ghost evening-regen-btn" title="Recalculer l'After-Hours Engine (Tension + Flux Cours → TD → DM)">
          <i class="ph-bold ph-arrows-clockwise"></i> <span>Optimiser</span>
        </button>
      </div>
    </div>
  `;

  const timelineHtml = model.timelineEvents.map(ev => {
    if (ev.kind === 'lunch') {
      return `
        <div class="evening-slot-card evening-slot-dinner" style="border-left:3px solid #38BDF8;">
          <div class="evening-slot-time mono">
            <span>${minToTime(ev.startMin)}</span>
            <span class="evening-time-sep">↓</span>
            <span>${minToTime(ev.endMin)}</span>
            <span class="evening-dur-chip">${ev.durationMin}m</span>
          </div>
          <div class="evening-slot-body">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:9px;">
                <span class="evening-dinner-ico" style="color:#38BDF8; background:rgba(56,189,248,0.14);"><i class="ph-fill ph-coffee"></i></span>
                <div>
                  <div style="font-weight:700; font-size:13px; color:#BAE6FD;">Pause Déjeuner &amp; Coupure Méridienne</div>
                  <div class="hide-mobile" style="font-size:11.5px; color:var(--text-muted);">Coupure recommandée sur journée Blank Canvas · ${ev.durationMin} min</div>
                </div>
              </div>
              <span class="mono" style="font-size:10px; padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.14); border:1px solid rgba(56,189,248,0.35); color:#38BDF8;">PAUSE MIDI</span>
            </div>
          </div>
        </div>
      `;
    }

    if (ev.kind === 'academic_late') {
      const ls = ev.slot;
      return `
        <div class="evening-slot-card evening-slot-dinner" style="border-left:3px solid #F43F5E; background:rgba(244,63,94,0.06);">
          <div class="evening-slot-time mono">
            <span style="color:#FDA4AF; font-weight:700;">${minToTime(ev.startMin)}</span>
            <span class="evening-time-sep">↓</span>
            <span>${minToTime(ev.endMin)}</span>
            <span class="evening-dur-chip">${ev.durationMin}m</span>
          </div>
          <div class="evening-slot-body">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:9px;">
                <span class="evening-dinner-ico" style="color:#FB7185; background:rgba(244,63,94,0.16);"><i class="ph-fill ph-chalkboard-teacher"></i></span>
                <div>
                  <div style="font-weight:700; font-size:13px; color:#FECDD3;">Séance Académique Tardive : ${escapeHtml(ls.title)}</div>
                  <div style="font-size:11.5px; color:rgba(254,205,211,0.75);">Buffer de transition (${ev.bufferMin}m) appliqué dès ${minToTime(ev.startMin - ev.bufferMin)}</div>
                </div>
              </div>
              <span class="mono" style="font-size:10px; padding:2px 8px; border-radius:99px; background:rgba(244,63,94,0.16); border:1px solid rgba(244,63,94,0.38); color:#FDA4AF;">EMPLOI DU TEMPS</span>
            </div>
          </div>
        </div>
      `;
    }

    if (ev.kind === 'nap') {
      const nap = ev.nap;
      return `
        <div class="evening-slot-card evening-slot-nap evening-drop-target"
             draggable="true"
             ondragstart="window.onEveningDragStart(event, '${nap.id}')"
             ondragend="window.onEveningDragEnd(event)"
             ondragover="window.onEveningDragOver(event)"
             ondragleave="window.onEveningDragLeave(event)"
             ondrop="window.onEveningDropOnTask(event, '${nap.id}')"
             style="border-left: 3px solid #10B981; background: rgba(16, 185, 129, 0.07);">
          <div class="evening-slot-time mono">
            <span style="color:#34D399; font-weight:700;">${minToTime(ev.startMin)}</span>
            <span class="evening-time-sep">↓</span>
            <span>${minToTime(ev.endMin)}</span>
            <span class="evening-dur-chip" style="color:#34D399;">${ev.durationMin}m</span>
          </div>
          <div class="evening-slot-body">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:9px; min-width:0;">
                <span class="k-handle evening-drag-handle" title="Glisser pour déplacer la sieste">⠿</span>
                <span class="evening-dinner-ico" style="color:#34D399; background:rgba(16,185,129,0.16);"><i class="ph-fill ph-battery-charging"></i></span>
                <div style="min-width:0;">
                  <div style="font-weight:700; font-size:13px; color:#A7F3D0;">Power Nap &amp; Récupération Cognitive (${ev.durationMin} min)</div>
                  <div class="hide-mobile" style="font-size:11.5px; color:rgba(167, 243, 208, 0.75);">Décale automatiquement les missions suivantes (+${ev.durationMin}m) sans aucune suppression</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="mono" style="font-size:10px; padding:2px 8px; border-radius:99px; background:rgba(16,185,129,0.16); border:1px solid rgba(16,185,129,0.38); color:#34D399;">SIESTE FLASH</span>
                <button type="button" onclick="window.removeEveningNap('${nap.id}', '${dayISO}', event)" class="btn-ghost evening-ctrl-btn" style="color:#F87171; padding:3px 7px;" title="Supprimer cette sieste">
                  <i class="ph-bold ph-x"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (ev.kind === 'dinner') {
      return `
        <div class="evening-slot-card evening-slot-dinner">
          <div class="evening-slot-time mono">
            <span>${minToTime(ev.startMin)}</span>
            <span class="evening-time-sep">↓</span>
            <span>${minToTime(ev.endMin)}</span>
            <span class="evening-dur-chip">${ev.durationMin}m</span>
          </div>
          <div class="evening-slot-body">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:9px; min-width:0;">
                <span class="evening-dinner-ico"><i class="ph-fill ph-fork-knife"></i></span>
                <div style="min-width:0;">
                  <div style="font-weight:700; font-size:13px; color:#FDE68A;">Pause Dîner &amp; Coupure</div>
                  <div class="hide-mobile" style="font-size:11.5px; color:rgba(253, 230, 138, 0.7);">Bloc sanctuarisé intouchable · ${ev.durationMin} min</div>
                </div>
              </div>
              <span class="mono" style="font-size:10px; padding:2px 8px; border-radius:99px; background:rgba(245, 158, 11, 0.16); border:1px solid rgba(245, 158, 11, 0.35); color:#FBBF24;">PAUSE REPAS</span>
            </div>
          </div>
        </div>
      `;
    }

    if (ev.kind === 'free') {
      return `
        <div class="evening-slot-card evening-slot-free evening-drop-target" ondragover="window.onEveningDragOver(event)" ondragleave="window.onEveningDragLeave(event)" ondrop="window.onEveningDropToTimeline(event)">
          <div class="evening-slot-time mono">
            <span>${minToTime(ev.startMin)}</span>
            <span class="evening-time-sep">↓</span>
            <span>${minToTime(ev.endMin)}</span>
            <span class="evening-dur-chip">+${(ev.durationMin / 60).toFixed(1)}h</span>
          </div>
          <div class="evening-slot-body" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <span style="font-size:12px; color:var(--text-subtle);"><i class="ph ph-sparkle"></i> Créneau libre (${ev.durationMin} min) — Glisse une mission ici ou pose une sieste</span>
          </div>
        </div>
      `;
    }

    // Task block (persistant même lorsqu'il est coché comme terminé)
    const t = ev.task;
    const isDone = isTaskCompleted(t);
    const s = getSubject(t.subject);
    const p = computePressure(t);
    const phaseLbl = getTaskActivePhaseLabel(t);
    const durH = (ev.durationMin / 60).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');

    return `
      <div class="evening-slot-card evening-slot-task evening-drop-target ${isDone ? 'evening-slot-task-done' : ''}"
           draggable="true"
           ondragstart="window.onEveningDragStart(event, '${t.id}')"
           ondragend="window.onEveningDragEnd(event)"
           ondragover="window.onEveningDragOver(event)"
           ondragleave="window.onEveningDragLeave(event)"
           ondrop="window.onEveningDropOnTask(event, '${t.id}')"
           style="border-left: 3px solid ${s.color}; ${isDone ? 'opacity:0.55; background:rgba(16,185,129,0.04);' : ''}">
        <div class="evening-slot-time mono">
          <span style="color:var(--text-main); font-weight:700;">${minToTime(ev.startMin)}</span>
          <span class="evening-time-sep">↓</span>
          <span>${minToTime(ev.endMin)}</span>
          <span class="evening-dur-chip">${durH}h</span>
          <span class="evening-mobile-due mono" style="color:${isDone ? '#34D399' : p.color};">${isDone ? 'VALIDÉ' : p.dayLabel}</span>
        </div>
        <div class="evening-slot-body">
          <div class="evening-task-layout">
            <div class="evening-task-main">
              <span class="k-handle evening-drag-handle" title="Glisser pour réordonner sur la timeline">⠿</span>
              <button type="button" class="check-touch-zone" onclick="event.stopPropagation(); window.toggleTaskFromEvening('${t.id}', '${dayISO}', event)" title="${isDone ? 'Décocher la mission' : 'Valider cette mission (reste affichée dans le créneau)'}">
                <span class="custom-check ${isDone ? 'checked' : ''}">${isDone ? '<i class="ph-bold ph-check text-xs"></i>' : ''}</span>
              </button>
              <div class="evening-task-info">
                <div class="evening-task-badges">
                  ${renderTaskTypeBadge(t.type)}
                  <span class="subj-badge"><span class="subj-dot" style="background:${s.color};"></span>${escapeHtml(s.short)}</span>
                  ${t._pedagoChainLabel ? `<span class="mono" style="font-size:10px; padding:1px 6px; border-radius:5px; background:rgba(56,189,248,0.14); border:1px solid rgba(56,189,248,0.32); color:#38BDF8; font-weight:600;" title="Ordonnancement pédagogique automatique (Cours → TD/Exos → DM)"><i class="ph-bold ph-flow-arrow"></i> ${escapeHtml(t._pedagoChainLabel)}</span>` : ''}
                  ${isDone ? `<span class="mono" style="font-size:10px; padding:1px 6px; border-radius:5px; background:rgba(16,185,129,0.18); border:1px solid rgba(16,185,129,0.38); color:#34D399; font-weight:700;">VALIDÉ</span>` : ''}
                  ${ev.partIndex ? `<span class="mono" style="font-size:10px; padding:1px 6px; border-radius:5px; background:rgba(255,255,255,0.08); color:var(--text-muted);">Partie ${ev.partIndex}/${ev.totalParts}</span>` : ''}
                  ${ev.shiftedPastBedtime ? `<span class="mono" style="font-size:10px; padding:1px 6px; border-radius:5px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.35); color:#FBBF24;">Décalé (Sieste)</span>` : ''}
                </div>
                <div class="evening-task-title" style="${isDone ? 'text-decoration:line-through; color:var(--text-subtle);' : 'color:var(--text-main);'}">${escapeHtml(t.title)}</div>
                ${phaseLbl ? `<div style="font-size:11.5px; color:${isDone ? '#10B981' : '#38BDF8'}; margin-top:3px; font-weight:600; ${isDone ? 'text-decoration:line-through;' : ''}"><i class="ph-bold ph-git-commit"></i> ${escapeHtml(phaseLbl)}</div>` : ''}
                ${t.note ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:2px; ${isDone ? 'text-decoration:line-through;' : ''}">${escapeHtml(t.note)}</div>` : ''}
              </div>
            </div>
            <div class="evening-task-actions" onclick="event.stopPropagation();">
              <span class="evening-desktop-due mono" style="font-size:11px; font-weight:700; color:${p.color}; margin-right:4px;">${isDone ? 'TERMINÉ' : p.dayLabel}</span>
              <button type="button" onclick="event.stopPropagation(); window.adjustEveningTaskDuration('${t.id}', -0.25, event)" class="btn-ghost evening-ctrl-btn" title="Réduire le temps ce soir (-15 min)">-15m</button>
              <button type="button" onclick="event.stopPropagation(); window.adjustEveningTaskDuration('${t.id}', 0.25, event)" class="btn-ghost evening-ctrl-btn" title="Augmenter le temps ce soir (+15 min)">+15m</button>
              <button type="button" onclick="event.stopPropagation(); window.moveEveningTaskOrder('${t.id}', -1, event)" class="btn-ghost evening-ctrl-btn" title="Monter dans la timeline"><i class="ph-bold ph-arrow-up"></i></button>
              <button type="button" onclick="event.stopPropagation(); window.moveEveningTaskOrder('${t.id}', 1, event)" class="btn-ghost evening-ctrl-btn" title="Descendre dans la timeline"><i class="ph-bold ph-arrow-down"></i></button>
              <button type="button" onclick="event.stopPropagation(); window.deferTaskToOverflow('${t.id}', event)" class="btn-ghost evening-ctrl-btn evening-ctrl-defer" title="Reporter (Basculer dans À reporter)"><i class="ph-bold ph-arrow-elbow-right"></i> <span class="evening-defer-lbl">Reporter</span></button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const curfewBlockHtml = `
    <div class="evening-slot-card evening-slot-curfew">
      <div class="evening-slot-time mono">
        <span style="color:#C084FC; font-weight:700;">${minToTime(model.bedtimeMin)}</span>
      </div>
      <div class="evening-slot-body" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:9px;">
          <span class="evening-curfew-ico"><i class="ph-fill ph-moon-stars"></i></span>
          <div>
            <div style="font-weight:700; font-size:13px; color:#E9D5FF;">Couvre-feu &amp; Sommeil (${escapeHtml(cfg.bedtime || '23:00')})</div>
            <div class="hide-mobile" style="font-size:11.5px; color:rgba(233, 213, 255, 0.7);">Arrêt impératif du travail — consolidation mémoire &amp; récupération CPGE</div>
          </div>
        </div>
        <span class="mono" style="font-size:10px; padding:2px 8px; border-radius:99px; background:rgba(168, 85, 247, 0.18); border:1px solid rgba(168, 85, 247, 0.4); color:#D8B4FE;">STOP STRICT</span>
      </div>
    </div>
  `;

  const overflowHtml = model.overflowTasks.length === 0
    ? `
      <div class="evening-overflow-empty">
        <i class="ph-bold ph-check-circle" style="font-size:20px; color:#10B981; margin-bottom:4px;"></i>
        <div style="font-weight:600; font-size:12.5px; color:var(--text-main);">Aucun débordement ce soir</div>
        <div style="font-size:11.5px; color:var(--text-muted);">Toutes vos missions actives rentrent dans l'After-Hours Engine avant ${escapeHtml(cfg.bedtime || '23:00')}.</div>
      </div>
    `
    : model.overflowTasks.map(item => {
        const t = item.task;
        const s = getSubject(t.subject);
        const p = computePressure(t);
        const durH = (item.neededMin / 60).toFixed(1).replace(/\.0$/, '');
        return `
          <div class="saas-card evening-overflow-card"
               draggable="true"
               ondragstart="window.onEveningDragStart(event, '${t.id}')"
               ondragend="window.onEveningDragEnd(event)"
               style="border-left:3px solid ${s.color}; padding:12px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span class="k-handle evening-drag-handle" title="Glisser vers la timeline">⠿</span>
                ${renderTaskTypeBadge(t.type)}
                <span class="subj-badge"><span class="subj-dot" style="background:${s.color};"></span>${escapeHtml(s.short)}</span>
              </div>
              <span class="mono" style="font-size:11px; font-weight:700; color:${p.color};">${p.dayLabel} · ${durH}h</span>
            </div>
            <div style="font-weight:600; font-size:13px; color:var(--text-main); margin-bottom:4px;">${escapeHtml(t.title)}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:8px; padding-top:8px; border-top:1px solid var(--border-subtle); flex-wrap:wrap;">
              <span style="font-size:11px; color:#F59E0B;"><i class="ph ph-clock-countdown"></i> ${escapeHtml(item.reason)}</span>
              <button type="button" onclick="event.stopPropagation(); window.prioritizeTaskTonight('${t.id}', event)" class="btn-ghost evening-ctrl-btn" style="padding:5px 10px; font-size:11px;">
                <i class="ph-bold ph-arrow-up-left"></i> Prioriser ce soir
              </button>
            </div>
          </div>
        `;
      }).join('');

  box.innerHTML = `
    ${dayTabsHtml}
    ${rhythmBarHtml}
    <div class="evening-planner-grid">
      <div class="evening-timeline-col evening-drop-target"
           ondragover="window.onEveningDragOver(event)"
           ondragleave="window.onEveningDragLeave(event)"
           ondrop="window.onEveningDropToTimeline(event)">
        <div class="evening-section-head">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:12.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">
              <i class="ph-bold ph-cpu" style="color:#38BDF8;"></i> After-Hours Engine · ${dayLabels[selDay] || ''} ${formatShortDate(selDate)} ${isToday ? '(Aujourd\'hui)' : ''}
            </span>
            ${windowsSummaryBadges}
          </div>
          <span class="hide-mobile" style="font-size:11.5px; color:var(--text-subtle);">Flux Cours → TD → DM · Glisser ⠿ pour réordonner</span>
        </div>
        <div class="evening-timeline-stack">
          ${timelineHtml}
          ${curfewBlockHtml}
        </div>
      </div>

      <div class="evening-overflow-col evening-drop-target"
           ondragover="window.onEveningDragOver(event)"
           ondragleave="window.onEveningDragLeave(event)"
           ondrop="window.onEveningDropToOverflow(event)">
        <div class="evening-section-head">
          <div style="font-size:12.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#F59E0B;">
            <i class="ph-bold ph-tray"></i> À reporter (${model.overflowTasks.length})
          </div>
          <span class="mono" style="font-size:11px; color:var(--text-subtle);">Après ${escapeHtml(cfg.bedtime || '23:00')}</span>
        </div>
        <p class="hide-mobile" style="font-size:11.5px; color:var(--text-muted); margin-bottom:12px;">
          Missions hors enveloppe horaire. Glisse la poignée ⠿ vers la timeline ou clique sur « Prioriser ce soir ».
        </p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${overflowHtml}
        </div>
      </div>
    </div>
  `;
}

function renderAcademicGrid(weekDates) {
  const isMobile = agendaIsMobile();
  CAL_HOUR_H = isMobile ? 50 : 64;
  const selDay = getAgendaDay();
  const shown = isMobile ? [selDay] : [0, 1, 2, 3, 4, 5];
  const box = document.getElementById('calendar-grid-box');
  const todayStr = formatDateISO(new Date());

  const perDay = weekDates.map((date, i) => getDayScheduleSlots(date, i));
  let rangeStart = 8 * 60, rangeEnd = 19 * 60;
  shown.flatMap(i => perDay[i]).forEach(sl => {
    rangeStart = Math.min(rangeStart, Math.floor(timeToMin(sl.start) / 60) * 60);
    rangeEnd = Math.max(rangeEnd, Math.ceil(timeToMin(sl.end) / 60) * 60);
  });
  rangeStart = Math.max(0, rangeStart);
  rangeEnd = Math.min(24 * 60, rangeEnd);
  const totalH = (rangeEnd - rangeStart) / 60 * CAL_HOUR_H;
  const gridBg = `repeating-linear-gradient(to bottom, transparent 0, transparent ${CAL_HOUR_H - 1}px, rgba(255,255,255,0.07) ${CAL_HOUR_H - 1}px, rgba(255,255,255,0.07) ${CAL_HOUR_H}px)`;

  let hoursCol = '';
  for (let m = rangeStart; m < rangeEnd; m += 60) {
    hoursCol += `<div class="mono" style="position:absolute; top:${(m - rangeStart) / 60 * CAL_HOUR_H + 2}px; right:8px; font-size:10.5px; color:var(--text-subtle);">${minToTime(m)}</div>`;
  }

  const headers = shown.map(i => {
    const date = weekDates[i];
    const isToday = formatDateISO(date) === todayStr;
    return `<div style="text-align:center; padding:8px 4px; font-size:12px; font-weight:700; border-bottom:1px solid var(--border-subtle); ${isToday ? 'color:#F8FAFC;' : 'color:var(--text-muted);'}">${DAYS_LABELS[i]} <span class="mono" style="font-weight:500; ${isToday ? 'background:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.28); color:#F8FAFC; padding:1px 6px; border-radius:6px;' : ''}">${formatShortDate(date)}</span></div>`;
  }).join('');

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const columns = shown.map(i => {
    const date = weekDates[i];
    const ds = formatDateISO(date);
    const isToday = ds === todayStr;
    const laid = layoutDaySlots(perDay[i]);
    const blocks = laid.map(it => {
      const m = it.sl;
      const sub = getSubject(m.subject);
      const top = (it.s - rangeStart) / 60 * CAL_HOUR_H;
      const height = Math.max((it.e - it.s) / 60 * CAL_HOUR_H - 2, 22);
      const isSpecific = !!m.date;
      const widthPct = 100 / it.cols;
      const compact = height < 44;
      return `<div onclick="event.stopPropagation(); window.openSlotModal('${escapeHtml(m.id)}')" title="${escapeHtml(m.title)} · ${m.start}–${m.end}${m.room ? ' · ' + escapeHtml(m.room) : ''}" style="position:absolute; top:${top + 1}px; height:${height}px; left:calc(${it.col * widthPct}% + 2px); width:calc(${widthPct}% - 4px); background:${sub.color}26; border-left:3px solid ${sub.color}; border-radius:7px; padding:${compact ? '3px 7px' : '6px 8px'}; overflow:hidden; cursor:pointer; z-index:2; ${isSpecific ? 'outline:1px solid ' + sub.color + '77;' : ''} transition:background-color 0.15s ease;" onmouseover="this.style.background='${sub.color}40'" onmouseout="this.style.background='${sub.color}26'"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;"><span style="font-weight:700; font-size:11.5px; line-height:1.25; color:var(--text-main); ${compact ? 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis;' : ''}">${escapeHtml(m.title)}</span><span class="mono" style="font-size:9px; padding:1px 5px; border-radius:4px; background:rgba(0,0,0,0.4); color:var(--text-muted); flex-shrink:0;">${escapeHtml(m.type || 'COURS')}</span></div>${compact ? '' : `<div class="mono" style="font-size:10px; color:var(--text-muted); margin-top:3px;">${m.start}–${m.end}</div>`}${(height >= 74 && m.room) ? `<div style="font-size:10.5px; color:var(--text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.room)}</div>` : ''}</div>`;
    }).join('');
    let nowLine = '';
    if (isToday && nowMin >= rangeStart && nowMin <= rangeEnd) {
      const y = (nowMin - rangeStart) / 60 * CAL_HOUR_H;
      nowLine = `<div style="position:absolute; left:0; right:0; top:${y}px; height:0; border-top:2px solid #EF4444; z-index:5; pointer-events:none;"><span style="position:absolute; left:-4px; top:-5px; width:8px; height:8px; border-radius:50%; background:#EF4444;"></span></div>`;
    }
    return `<div onclick="window.onCalColumnClick(event, '${ds}', ${i}, ${rangeStart})" style="position:relative; height:${totalH}px; cursor:pointer; border-left:1px solid var(--border-subtle); background-image:${gridBg}; ${isToday ? 'background-color:rgba(255,255,255,0.03);' : ''}">${blocks}${nowLine}</div>`;
  }).join('');

  const gridCols = isMobile ? '44px minmax(0, 1fr)' : '52px repeat(6, minmax(130px, 1fr))';
  const dayTabs = isMobile
    ? `<div style="display:flex; gap:6px; margin-bottom:12px;">${weekDates.map((d, i) => `<button type="button" onclick="window.setAgendaDay(${i})" class="btn-ghost ${i === selDay ? 'active-pill' : ''}" style="flex:1; flex-direction:column; gap:0; padding:6px 0; font-size:11px;"><span>${DAYS_LABELS[i].slice(0, 3)}</span><span class="mono" style="font-size:10px; opacity:0.7;">${String(d.getDate()).padStart(2, '0')}</span></button>`).join('')}</div>`
    : '';
  const docs = Array.isArray(state.scheduleDocs) ? state.scheduleDocs : [];
  const docsQuickBar = docs.length > 0
    ? `
      <div class="sched-docs-quickbar">
        <span class="sched-docs-quicklbl"><i class="ph-bold ph-files"></i> Mes Docs :</span>
        <div class="sched-docs-quicklist">
          ${docs.map(doc => `
            <button type="button" onclick="window.openScheduleDocViewer('${escapeHtml(doc.id)}')" class="btn-ghost sched-doc-chip" title="Ouvrir ${escapeHtml(doc.title)}">
              <i class="ph-bold ${doc.kind === 'pdf' ? 'ph-file-pdf' : 'ph-image'}" style="color:${doc.kind === 'pdf' ? '#FB923C' : '#38BDF8'};"></i>
              <span class="sched-doc-chip-cat">${escapeHtml(doc.category || 'Doc')}</span>
              <span class="sched-doc-chip-title">${escapeHtml(doc.title)}</span>
            </button>
          `).join('')}
          <button type="button" onclick="window.openScheduleImportModal('files')" class="btn-ghost sched-doc-chip-add" title="Ajouter une photo ou un PDF">
            <i class="ph-bold ph-plus"></i> Photo / PDF
          </button>
        </div>
      </div>
    `
    : '';
  box.innerHTML = `${docsQuickBar}${dayTabs}<div style="${isMobile ? '' : 'min-width:860px;'}"><div style="display:grid; grid-template-columns:${gridCols};"><div></div>${headers}</div><div style="display:grid; grid-template-columns:${gridCols};"><div style="position:relative; height:${totalH}px;">${hoursCol}</div>${columns}</div></div>`;
}

window.onCalColumnClick = function(e, dateStr, dayIdx, rangeStart) {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = Math.max(0, e.clientY - rect.top);
  const minutes = rangeStart + Math.floor(y / CAL_HOUR_H * 2) * 30;
  window.openSlotModal(null, dateStr, minToTime(minutes), dayIdx);
};

setInterval(() => { if (state.activeTab === 'agenda') renderAgenda(); }, 60000);

window.openSlotModal = function(slotId, defaultDateStr = '', defaultStart = '08:00', defaultDayIdx = 0) {
  const slot = slotId ? state.schedule.find(s => s.id === slotId) : null;
  document.getElementById('slot-modal-title').textContent = slot ? 'Modifier le créneau' : 'Ajouter un créneau';
  document.getElementById('s-id').value = slot ? slot.id : '';
  document.getElementById('s-title').value = slot ? slot.title : '';
  document.getElementById('s-start').value = slot ? slot.start : defaultStart;
  document.getElementById('s-end').value = slot ? slot.end : minToTime(Math.min(timeToMin(slot ? slot.start : defaultStart) + 120, 23 * 60 + 59));
  document.getElementById('s-room').value = slot && slot.room ? slot.room : '';
  document.getElementById('s-delete-btn').style.display = slot ? 'inline-flex' : 'none';
  const isRecurring = slot ? (slot.date === undefined && slot.dayOfWeek !== undefined) : true;
  document.getElementById('s-date').value = slot && slot.date ? slot.date : (defaultDateStr || formatDateISO(new Date()));

  mountCustomSelect('s-recurrence-mount', 's-recurrence', [
    { value: 'weekly', label: 'Chaque semaine' },
    { value: 'once', label: 'Une seule fois' }
  ], isRecurring ? 'weekly' : 'once', (val) => {
    document.getElementById('s-day-container').style.display = val === 'weekly' ? 'block' : 'none';
    document.getElementById('s-date-container').style.display = val === 'once' ? 'block' : 'none';
  });

  document.getElementById('s-day-container').style.display = isRecurring ? 'block' : 'none';
  document.getElementById('s-date-container').style.display = !isRecurring ? 'block' : 'none';
  mountCustomSelect('s-day-mount', 's-day', DAYS_LABELS.map((d, i) => ({ value: String(i), label: d })), slot && slot.dayOfWeek !== undefined ? String(slot.dayOfWeek) : String(defaultDayIdx));
  const defaultSubj = slot && SUBJECTS[slot.subject] ? slot.subject : (Object.keys(SUBJECTS)[0] || 'maths');
  mountCustomSelect('s-subject-mount', 's-subj', getSubjectOptions(), defaultSubj);
  mountCustomSelect('s-type-mount', 's-type', [
    { value: 'COURS', label: 'COURS' },
    { value: 'TD', label: 'TD' },
    { value: 'TP', label: 'TP' },
    { value: 'COLLE', label: 'COLLE' },
    { value: 'DS', label: 'DS' }
  ], slot ? slot.type : 'COURS');
  document.getElementById('slot-modal').classList.add('open');
  if (typeof window.focusModalInput === 'function') window.focusModalInput('s-title');
};

window.closeSlotModal = function() { document.getElementById('slot-modal').classList.remove('open'); };

window.saveSlotForm = function(e) {
  e.preventDefault();
  const id = document.getElementById('s-id').value;
  const title = document.getElementById('s-title').value.trim();
  const subject = customSelectValues['s-subj'] || Object.keys(SUBJECTS)[0] || 'maths';
  const type = customSelectValues['s-type'] || 'COURS';
  const start = document.getElementById('s-start').value || '08:00';
  const end = document.getElementById('s-end').value || '10:00';
  const room = document.getElementById('s-room').value.trim();
  if (timeToMin(end) <= timeToMin(start)) { showToast('La fin doit être après le début'); return; }
  const isWeekly = customSelectValues['s-recurrence'] === 'weekly';
  const dayOfWeek = isWeekly ? parseInt(customSelectValues['s-day'] || '0', 10) : undefined;
  const date = !isWeekly ? document.getElementById('s-date').value : undefined;

  if (id) {
    const existing = state.schedule.find(s => s.id === id);
    if (existing) {
      Object.assign(existing, { title, subject, type, start, end, room });
      if (isWeekly) { existing.dayOfWeek = dayOfWeek; delete existing.date; }
      else { existing.date = date; delete existing.dayOfWeek; }
    }
    showToast('Créneau mis à jour');
  } else {
    const newSlot = { id: 's_' + Date.now(), title, subject, type, start, end, room };
    if (isWeekly) newSlot.dayOfWeek = dayOfWeek;
    else newSlot.date = date;
    state.schedule.push(newSlot);
    showToast('Créneau ajouté');
  }
  saveState();
  closeSlotModal();
  renderAgenda();
};

window.deleteCurrentSlot = function() {
  const id = document.getElementById('s-id').value;
  if (!id) return;
  state.schedule = state.schedule.filter(s => s.id !== id);
  saveState();
  closeSlotModal();
  renderAgenda();
  showToast('Créneau supprimé');
};

window.openScheduleImportModal = function(initialTab = 'files') {
  const jsonArea = document.getElementById('schedule-json-textarea');
  if (jsonArea) jsonArea.value = JSON.stringify(state.schedule, null, 2);
  const keyInput = document.getElementById('sched-ai-api-key-input');
  if (keyInput && state.settings) keyInput.value = state.settings.aiApiKey || '';
  if (typeof window.switchScheduleImportTab === 'function') {
    window.switchScheduleImportTab(initialTab || 'files');
  }
  if (typeof window.renderScheduleDocsGallery === 'function') {
    window.renderScheduleDocsGallery();
  }
  document.getElementById('schedule-import-modal').classList.add('open');
  if (initialTab === 'text' && typeof window.focusModalInput === 'function') {
    window.focusModalInput('schedule-raw-textarea');
  }
};

window.closeScheduleImportModal = function() {
  if (typeof window.stopScheduleCamera === 'function') window.stopScheduleCamera();
  document.getElementById('schedule-import-modal').classList.remove('open');
};

window.applyScheduleJSON = function() {
  try {
    const rawVal = document.getElementById('schedule-json-textarea').value.trim();
    const parsed = JSON.parse(rawVal);
    if (!Array.isArray(parsed)) throw new Error('Array JSON attendu');
    state.schedule = parsed.map((item, idx) => {
      const s = {
        id: item.id || ('s_imp_' + idx + '_' + Date.now()),
        start: item.start || '08:00',
        end: item.end || '10:00',
        subject: SUBJECTS[item.subject] ? item.subject : (Object.keys(SUBJECTS)[0] || 'maths'),
        type: item.type || 'COURS',
        title: item.title || 'Séance',
        room: item.room || ''
      };
      if (item.date) s.date = item.date;
      else s.dayOfWeek = item.dayOfWeek !== undefined ? Number(item.dayOfWeek) : (item.day !== undefined ? Number(item.day) : 0);
      return s;
    });
    saveState();
    closeScheduleImportModal();
    renderAgenda();
    showToast('Planning JSON importé avec succès');
  } catch (err) {
    showToast('Code JSON invalide');
  }
};
