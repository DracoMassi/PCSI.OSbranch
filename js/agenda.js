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
  if (now.getDay() === 0) viewedWeekStart = addDays(viewedWeekStart, 7);
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

function getAgendaDay() {
  if (viewedDayIdx !== null) return viewedDayIdx;
  const today = new Date();
  for (let i = 0; i < 6; i++) {
    if (formatDateISO(addDays(viewedWeekStart, i)) === formatDateISO(today)) return i;
  }
  return 0;
}

window.setAgendaDay = function(i) {
  viewedDayIdx = i;
  renderAgenda();
};

function stepAgendaDay(delta) {
  let d = getAgendaDay() + delta;
  if (d > 5) { viewedWeekStart = addDays(viewedWeekStart, 7); d = 0; }
  else if (d < 0) { viewedWeekStart = addDays(viewedWeekStart, -7); d = 5; }
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
  return state.schedule.filter(sl => sl.date === ds || (Number(sl.dayOfWeek) === dayIdx && !sl.date));
}

function computeEveningStartMinForDay(dateObj, dayIdx) {
  const cfg = state.settings || DEFAULT_SETTINGS;
  const defaultStart = timeToMin(cfg.defaultClassEnd || '17:30');
  const slots = getDayScheduleSlots(dateObj, dayIdx);
  if (!slots.length) return defaultStart;
  let maxEnd = 0;
  slots.forEach(sl => {
    const e = timeToMin(sl.end);
    if (e > maxEnd && e <= 21 * 60) maxEnd = e;
  });
  if (maxEnd >= 15 * 60) return maxEnd;
  return defaultStart;
}

// =========================================================
// ALGORITHME D'ALLOCATION SOIRÉE (KNAPSACK & PERSISTANCE)
// =========================================================
function getTaskEveningDurationHours(task) {
  if (!task) return 1;
  const custom = state.eveningPlan && state.eveningPlan.customDurations && state.eveningPlan.customDurations[task.id];
  if (custom && custom >= 0.25) return Number(custom);

  // Si la tâche est cochée comme terminée dans le planning soirée, conserver sa durée allouée pour ne jamais faire disparaître/rétrécir son créneau
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
  const selDay = getAgendaDay();
  const selDate = addDays(viewedWeekStart, selDay);
  return formatDateISO(selDate);
}

function getOrderedEveningCandidates(dayISO = null) {
  const targetISO = dayISO || getEveningSelectedDayISO();

  // Tâches actives + tâches validées POUR CETTE SOIRÉE (depuis Missions ou Planning Soirée) :
  // elles gardent leur créneau, barrées, sans être remplacées. Les tâches validées les jours précédents n'encombrent plus.
  const pool = state.tasks.filter(t => !isTaskCompleted(t) || t.completedInEveningDate === targetISO);

  // Pour le tri initial par tension, on trie les actives; si une tâche est déjà dans manualOrder, on respecte exactement sa place
  const manual = (state.eveningPlan && Array.isArray(state.eveningPlan.manualOrder)) ? state.eveningPlan.manualOrder : [];
  const rankMap = new Map();
  manual.forEach((id, idx) => rankMap.set(id, idx));

  const cfg = state.settings || DEFAULT_SETTINGS;
  const tomorrowFirst = cfg.tomorrowFirst !== false;

  return pool.slice().sort((a, b) => {
    const hasA = rankMap.has(a.id);
    const hasB = rankMap.has(b.id);
    if (hasA && hasB) return rankMap.get(a.id) - rankMap.get(b.id);
    if (hasA !== hasB) return hasA ? -1 : 1;

    // Sinon tri par Tension décroissante (sans reléguer en bas celles cochées dans la soirée)
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
}

function buildEveningScheduleModel(dateObj, dayIdx) {
  const dayISO = formatDateISO(dateObj);
  const cfg = state.settings || DEFAULT_SETTINGS;
  const startMin = computeEveningStartMinForDay(dateObj, dayIdx);
  const dinnerStartMin = timeToMin(cfg.dinnerStart || '19:00');
  const dinnerEndMin = Math.max(dinnerStartMin + 15, timeToMin(cfg.dinnerEnd || '20:00'));
  const bedtimeMin = Math.max(dinnerEndMin + 30, timeToMin(cfg.bedtime || '23:00'));

  const effectiveStartMin = Math.min(startMin, bedtimeMin);

  // Créneaux d'étude disponibles autour du bloc dîner intouchable
  const windows = [];
  if (effectiveStartMin < dinnerStartMin) {
    windows.push({ start: effectiveStartMin, end: Math.min(dinnerStartMin, bedtimeMin), label: 'Avant dîner' });
  }
  const postDinnerStart = Math.max(effectiveStartMin, dinnerEndMin);
  if (postDinnerStart < bedtimeMin) {
    windows.push({ start: postDinnerStart, end: bedtimeMin, label: 'Après dîner' });
  }

  const totalStudyCapacityMin = windows.reduce((acc, w) => acc + Math.max(0, w.end - w.start), 0);
  const excludedSet = new Set((state.eveningPlan && state.eveningPlan.excludedIds) || []);
  const orderedCandidates = getOrderedEveningCandidates(dayISO);

  const winCursors = windows.map(w => ({ start: w.start, cursor: w.start, end: w.end, label: w.label }));
  const scheduledBlocks = [];
  const allocatedTaskIds = new Set();
  const overflowTasks = [];
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
    const remainingCap = winCursors.reduce((acc, w) => acc + Math.max(0, w.end - w.cursor), 0);

    // Knapsack : si la tâche dépasse la capacité disponible avant le couvre-feu, elle bascule dans À reporter
    if (neededMin > remainingCap) {
      if (!isTaskCompleted(task)) {
        overflowTasks.push({ task, reason: 'Dépasse le couvre-feu (' + (cfg.bedtime || '23:00') + ')', neededMin, isManualDefer: false });
        bedtimeOverflowMin += neededMin;
      }
      return;
    }

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
        totalParts: totalParts > 1 ? totalParts : null
      });
    });

    allocatedTaskIds.add(task.id);
    usedStudyMin += neededMin;
  });

  const timelineEvents = [...scheduledBlocks];

  winCursors.forEach(w => {
    if (w.end - w.cursor >= 15) {
      timelineEvents.push({
        kind: 'free',
        startMin: w.cursor,
        endMin: w.end,
        durationMin: w.end - w.cursor
      });
    }
  });

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
    startMin: effectiveStartMin,
    dinnerStartMin,
    dinnerEndMin,
    bedtimeMin,
    totalStudyCapacityMin,
    usedStudyMin,
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
  if (!state.eveningPlan) state.eveningPlan = { manualOrder: [], excludedIds: [], customDurations: {}, pinnedEveningIds: [] };
  const candidates = getOrderedEveningCandidates(dayISO).map(t => t.id);
  state.eveningPlan.manualOrder = candidates;
}

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
  showToast('Mission placée en tête de soirée');
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
  if (!state.eveningPlan) state.eveningPlan = { manualOrder: [], excludedIds: [], customDurations: {}, pinnedEveningIds: [] };
  if (!state.eveningPlan.customDurations) state.eveningPlan.customDurations = {};
  const current = getTaskEveningDurationHours(task);
  const next = Math.max(0.25, Math.min(6, Number((current + deltaHours).toFixed(2))));
  state.eveningPlan.customDurations[taskId] = next;
  task.eveningAllocatedHours = next;
  saveState();
  renderAgenda();
};

window.resetEveningAllocation = function() {
  state.eveningPlan = { manualOrder: [], excludedIds: [], customDurations: {}, pinnedEveningIds: [] };
  state.tasks.forEach(t => {
    delete t.completedInEveningDate;
    delete t.eveningAllocatedHours;
  });
  saveState();
  renderAgenda();
  showToast('Allocation soirée recalculée par tension');
};

window.updateEveningRhythmQuick = function(field, value) {
  if (!value) return;
  if (!state.settings) state.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  state.settings[field] = value;
  saveState();
  renderAgenda();
  if (typeof window.renderSettingsPanel === 'function') window.renderSettingsPanel();
};

// Validation persistante dans le Planning Soirée : la tâche NE disparaît PAS de son créneau
window.toggleTaskFromEvening = function(taskId, dayISO, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;

  const targetISO = dayISO || getEveningSelectedDayISO();
  // Figer l'ordre actuel et la durée allouée de la tâche pour qu'elle reste exactement dans son bloc horaire
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
    t.completedInEveningDate = targetISO; // Garde sa place dans la soirée courante
    showToast('Mission remise en cours');
  }
  saveState();
  renderAgenda();
};

// Drag & Drop handlers for Evening Planner
window.onEveningDragStart = function(e, taskId) {
  draggedEveningTaskId = taskId;
  e.currentTarget.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
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

window.onEveningDropOnTask = function(e, targetTaskId) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  const srcId = draggedEveningTaskId;
  draggedEveningTaskId = null;
  if (!srcId || srcId === targetTaskId) return;

  ensureEveningManualOrderInitialized();
  state.eveningPlan.excludedIds = (state.eveningPlan.excludedIds || []).filter(id => id !== srcId);
  const arr = state.eveningPlan.manualOrder.filter(id => id !== srcId);
  const targetIdx = arr.indexOf(targetTaskId);
  if (targetIdx === -1) arr.unshift(srcId);
  else arr.splice(targetIdx, 0, srcId);
  state.eveningPlan.manualOrder = arr;
  saveState();
  renderAgenda();
  showToast('Ordre de la soirée mis à jour');
};

window.onEveningDropToTimeline = function(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedEveningTaskId) return;
  const srcId = draggedEveningTaskId;
  draggedEveningTaskId = null;
  window.prioritizeTaskTonight(srcId);
};

window.onEveningDropToOverflow = function(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedEveningTaskId) return;
  const srcId = draggedEveningTaskId;
  draggedEveningTaskId = null;
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

  const weekDates = [0, 1, 2, 3, 4, 5].map(i => addDays(viewedWeekStart, i));
  const labelEl = document.getElementById('agenda-week-label');
  if (labelEl) labelEl.textContent = `Semaine du ${formatShortDate(weekDates[0])} au ${formatShortDate(weekDates[5])}`;

  if (subTab === 'evening') {
    renderEveningPlanner(weekDates);
  } else {
    renderAcademicGrid(weekDates);
  }
}

function renderEveningPlanner(weekDates) {
  const box = document.getElementById('calendar-grid-box');
  const selDay = getAgendaDay();
  const selDate = weekDates[selDay];
  const dayISO = formatDateISO(selDate);
  const todayStr = formatDateISO(new Date());
  const isToday = dayISO === todayStr;

  const cfg = state.settings || DEFAULT_SETTINGS;
  const model = buildEveningScheduleModel(selDate, selDay);
  const daySlots = getDayScheduleSlots(selDate, selDay);
  const lastSlot = daySlots.slice().sort((a, b) => timeToMin(b.end) - timeToMin(a.end))[0];

  const dayTabsHtml = `
    <div class="evening-day-tabs">
      ${weekDates.map((d, i) => {
        const dIso = formatDateISO(d);
        const active = i === selDay;
        const td = dIso === todayStr;
        return `
          <button type="button" onclick="window.setAgendaDay(${i})" class="btn-ghost evening-day-btn ${active ? 'active-pill' : ''}">
            <span class="evening-day-name">
              <span class="day-lbl-full">${DAYS_LABELS[i]}</span>
              <span class="day-lbl-short">${DAYS_LABELS[i].slice(0, 3)}</span>
              ${td ? `<span class="evening-today-dot"></span>` : ''}
            </span>
            <span class="evening-day-date mono">${formatShortDate(d)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  const rhythmBarHtml = `
    <div class="evening-rhythm-bar">
      <div class="evening-rhythm-pills">
        <div class="evening-stat-pill">
          <i class="ph-bold ph-graduation-cap" style="color:#38BDF8;"></i>
          <span><span class="rhythm-lbl">Fin des cours :</span> <strong class="mono">${minToTime(model.startMin)}</strong>${lastSlot ? ` <small class="hide-mobile" style="color:var(--text-subtle);">(${escapeHtml(lastSlot.title)})</small>` : ''}</span>
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
          <span class="rhythm-lbl">Couvre-feu :</span>
          <input type="time" value="${escapeHtml(cfg.bedtime || '23:00')}" onchange="window.updateEveningRhythmQuick('bedtime', this.value)" class="evening-time-mini mono" title="Heure de coucher stricte" />
        </div>
      </div>
      <div class="evening-rhythm-actions">
        <button type="button" onclick="window.resetEveningAllocation()" class="btn-ghost evening-regen-btn" title="Recalculer un nouveau programme du soir selon les tâches restantes">
          <i class="ph-bold ph-arrows-clockwise"></i> <span>Régénérer le programme</span>
        </button>
      </div>
    </div>
  `;

  const timelineHtml = model.timelineEvents.map(ev => {
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
            <span style="font-size:12px; color:var(--text-subtle);"><i class="ph ph-sparkle"></i> Créneau libre (${ev.durationMin} min) — Révise tes post-its ou avance une mission</span>
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
              <button type="button" class="check-touch-zone" onclick="event.stopPropagation(); window.toggleTaskFromEvening('${t.id}', '${dayISO}', event)" title="${isDone ? 'Décocher la mission' : 'Valider cette mission (reste affichée dans le créneau)'}">
                <span class="custom-check ${isDone ? 'checked' : ''}">${isDone ? '<i class="ph-bold ph-check text-xs"></i>' : ''}</span>
              </button>
              <div class="evening-task-info">
                <div class="evening-task-badges">
                  ${renderTaskTypeBadge(t.type)}
                  <span class="subj-badge"><span class="subj-dot" style="background:${s.color};"></span>${escapeHtml(s.short)}</span>
                  ${isDone ? `<span class="mono" style="font-size:10px; padding:1px 6px; border-radius:5px; background:rgba(16,185,129,0.18); border:1px solid rgba(16,185,129,0.38); color:#34D399; font-weight:700;">VALIDÉ</span>` : ''}
                  ${ev.partIndex ? `<span class="mono" style="font-size:10px; padding:1px 6px; border-radius:5px; background:rgba(255,255,255,0.08); color:var(--text-muted);">Partie ${ev.partIndex}/${ev.totalParts}</span>` : ''}
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
              <button type="button" onclick="event.stopPropagation(); window.moveEveningTaskOrder('${t.id}', -1, event)" class="btn-ghost evening-ctrl-btn" title="Monter dans la soirée"><i class="ph-bold ph-arrow-up"></i></button>
              <button type="button" onclick="event.stopPropagation(); window.moveEveningTaskOrder('${t.id}', 1, event)" class="btn-ghost evening-ctrl-btn" title="Descendre dans la soirée"><i class="ph-bold ph-arrow-down"></i></button>
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
        <div style="font-size:11.5px; color:var(--text-muted);">Toutes vos missions actives rentrent avant ${escapeHtml(cfg.bedtime || '23:00')}.</div>
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
          <div style="font-size:12.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted);">
            <i class="ph-bold ph-list-numbers"></i> Programme du soir · ${DAYS_LABELS[selDay]} ${formatShortDate(selDate)} ${isToday ? '(Ce soir)' : ''}
          </div>
          <span class="hide-mobile" style="font-size:11.5px; color:var(--text-subtle);">Glisser-déposer pour réordonner</span>
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
          Missions dépassant le couvre-feu. Clique sur « Prioriser ce soir » pour les placer en tête.
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
