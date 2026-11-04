// agenda.js : emploi du temps, colloscope, import JSON planning

let viewedWeekStart = getMonday(new Date());
window.prevWeek = () => { viewedWeekStart = addDays(viewedWeekStart, -7); renderAgenda(); };
window.nextWeek = () => { viewedWeekStart = addDays(viewedWeekStart, 7); renderAgenda(); };
function goToToday() {
  const now = new Date(); viewedWeekStart = getMonday(now);
  if (now.getDay() === 0) viewedWeekStart = addDays(viewedWeekStart, 7);
  viewedDayIdx = null; lastAgendaDay = formatDateISO(now);
}
let lastAgendaDay = '';
window.currentWeek = () => { goToToday(); renderAgenda(); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && lastAgendaDay && lastAgendaDay !== formatDateISO(new Date())) { goToToday(); if (state.activeTab === 'agenda') renderAgenda(); } });

let CAL_HOUR_H = 64; function timeToMin(t) { const p = String(t || '08:00').split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
function minToTime(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function layoutDaySlots(list) {
  const items = list.map(sl => ({ sl, s: timeToMin(sl.start), e: Math.max(timeToMin(sl.end), timeToMin(sl.start) + 15) })).sort((a, b) => a.s - b.s || a.e - b.e);
  const res = []; let cluster = [], clusterEnd = -1;
  const flush = () => { if (!cluster.length) return; const cols = []; cluster.forEach(it => { let c = cols.findIndex(end => end <= it.s); if (c === -1) { c = cols.length; cols.push(it.e); } else { cols[c] = it.e; } it.col = c; }); cluster.forEach(it => { it.cols = cols.length; res.push(it); }); cluster = []; clusterEnd = -1; };
  items.forEach(it => { if (cluster.length && it.s >= clusterEnd) flush(); cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e); }); flush(); return res;
}
let viewedDayIdx = null; function agendaIsMobile() { return window.matchMedia('(max-width: 900px)').matches; }
function getAgendaDay() { if (viewedDayIdx !== null) return viewedDayIdx; const today = new Date(); for (let i = 0; i < 6; i++) if (formatDateISO(addDays(viewedWeekStart, i)) === formatDateISO(today)) return i; return 0; }
window.setAgendaDay = function(i) { viewedDayIdx = i; renderAgenda(); };
function stepAgendaDay(delta) { let d = getAgendaDay() + delta; if (d > 5) { viewedWeekStart = addDays(viewedWeekStart, 7); d = 0; } else if (d < 0) { viewedWeekStart = addDays(viewedWeekStart, -7); d = 5; } viewedDayIdx = d; renderAgenda(); }
function renderAgenda() {
  const isMobile = agendaIsMobile(); CAL_HOUR_H = isMobile ? 50 : 64; const selDay = getAgendaDay(); const shown = isMobile ? [selDay] : [0, 1, 2, 3, 4, 5];
  const box = document.getElementById('calendar-grid-box'); const weekDates = [0, 1, 2, 3, 4, 5].map(i => addDays(viewedWeekStart, i)); const todayStr = formatDateISO(new Date());
  const labelEl = document.getElementById('agenda-week-label'); if (labelEl) labelEl.textContent = `Semaine du ${formatShortDate(weekDates[0])} au ${formatShortDate(weekDates[5])}`;
  const perDay = weekDates.map((date, i) => { const ds = formatDateISO(date); return state.schedule.filter(sl => sl.date === ds || (sl.dayOfWeek === i && !sl.date)); });
  let rangeStart = 8 * 60, rangeEnd = 19 * 60; shown.flatMap(i => perDay[i]).forEach(sl => { rangeStart = Math.min(rangeStart, Math.floor(timeToMin(sl.start) / 60) * 60); rangeEnd = Math.max(rangeEnd, Math.ceil(timeToMin(sl.end) / 60) * 60); }); rangeStart = Math.max(0, rangeStart); rangeEnd = Math.min(24 * 60, rangeEnd); const totalH = (rangeEnd - rangeStart) / 60 * CAL_HOUR_H;
  const gridBg = `repeating-linear-gradient(to bottom, transparent 0, transparent ${CAL_HOUR_H - 1}px, rgba(255,255,255,0.07) ${CAL_HOUR_H - 1}px, rgba(255,255,255,0.07) ${CAL_HOUR_H}px)`;
  let hoursCol = ''; for (let m = rangeStart; m < rangeEnd; m += 60) { hoursCol += `<div class="mono" style="position:absolute; top:${(m - rangeStart) / 60 * CAL_HOUR_H + 2}px; right:8px; font-size:10.5px; color:var(--text-subtle);">${minToTime(m)}</div>`; }
  const headers = shown.map(i => { const date = weekDates[i]; const isToday = formatDateISO(date) === todayStr; return `<div style="text-align:center; padding:8px 4px; font-size:12px; font-weight:700; border-bottom:1px solid var(--border-subtle); ${isToday ? 'color:#F8FAFC;' : 'color:var(--text-muted);'}">${DAYS_LABELS[i]} <span class="mono" style="font-weight:500; ${isToday ? 'background:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.28); color:#F8FAFC; padding:1px 6px; border-radius:6px;' : ''}">${formatShortDate(date)}</span></div>`; }).join('');
  const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const columns = shown.map(i => {
    const date = weekDates[i]; const ds = formatDateISO(date); const isToday = ds === todayStr; const laid = layoutDaySlots(perDay[i]);
    const blocks = laid.map(it => {
      const m = it.sl, sub = SUBJECTS[m.subject] || SUBJECTS.physique, top = (it.s - rangeStart) / 60 * CAL_HOUR_H, height = Math.max((it.e - it.s) / 60 * CAL_HOUR_H - 2, 22); const isSpecific = !!m.date; const widthPct = 100 / it.cols; const compact = height < 44;
      return `<div onclick="event.stopPropagation(); window.openSlotModal('${escapeHtml(m.id)}')" title="${escapeHtml(m.title)} · ${m.start}–${m.end}${m.room ? ' · ' + escapeHtml(m.room) : ''}" style="position:absolute; top:${top + 1}px; height:${height}px; left:calc(${it.col * widthPct}% + 2px); width:calc(${widthPct}% - 4px); background:${sub.color}26; border-left:3px solid ${sub.color}; border-radius:7px; padding:${compact ? '3px 7px' : '6px 8px'}; overflow:hidden; cursor:pointer; z-index:2; ${isSpecific ? 'outline:1px solid ' + sub.color + '77;' : ''} transition:background-color 0.15s ease;" onmouseover="this.style.background='${sub.color}40'" onmouseout="this.style.background='${sub.color}26'"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;"><span style="font-weight:700; font-size:11.5px; line-height:1.25; color:var(--text-main); ${compact ? 'white-space:nowrap; overflow:hidden; text-overflow:ellipsis;' : ''}">${escapeHtml(m.title)}</span><span class="mono" style="font-size:9px; padding:1px 5px; border-radius:4px; background:rgba(0,0,0,0.4); color:var(--text-muted); flex-shrink:0;">${escapeHtml(m.type || 'COURS')}</span></div>${compact ? '' : `<div class="mono" style="font-size:10px; color:var(--text-muted); margin-top:3px;">${m.start}–${m.end}</div>`}${(height >= 74 && m.room) ? `<div style="font-size:10.5px; color:var(--text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(m.room)}</div>` : ''}</div>`;
    }).join('');
    let nowLine = ''; if (isToday && nowMin >= rangeStart && nowMin <= rangeEnd) { const y = (nowMin - rangeStart) / 60 * CAL_HOUR_H; nowLine = `<div style="position:absolute; left:0; right:0; top:${y}px; height:0; border-top:2px solid #EF4444; z-index:5; pointer-events:none;"><span style="position:absolute; left:-4px; top:-5px; width:8px; height:8px; border-radius:50%; background:#EF4444;"></span></div>`; }
    return `<div onclick="window.onCalColumnClick(event, '${ds}', ${i}, ${rangeStart})" style="position:relative; height:${totalH}px; cursor:pointer; border-left:1px solid var(--border-subtle); background-image:${gridBg}; ${isToday ? 'background-color:rgba(255,255,255,0.03);' : ''}">${blocks}${nowLine}</div>`;
  }).join('');
  const gridCols = isMobile ? '44px minmax(0, 1fr)' : '52px repeat(6, minmax(130px, 1fr))';
  const dayTabs = isMobile ? `<div style="display:flex; gap:6px; margin-bottom:12px;">${weekDates.map((d, i) => `<button type="button" onclick="window.setAgendaDay(${i})" class="btn-ghost ${i === selDay ? 'active-pill' : ''}" style="flex:1; flex-direction:column; gap:0; padding:6px 0; font-size:11px;"><span>${DAYS_LABELS[i].slice(0, 3)}</span><span class="mono" style="font-size:10px; opacity:0.7;">${String(d.getDate()).padStart(2, '0')}</span></button>`).join('')}</div>` : '';
  box.innerHTML = `${dayTabs}<div style="${isMobile ? '' : 'min-width:860px;'}"><div style="display:grid; grid-template-columns:${gridCols};"><div></div>${headers}</div><div style="display:grid; grid-template-columns:${gridCols};"><div style="position:relative; height:${totalH}px;">${hoursCol}</div>${columns}</div></div>`;
}
window.onCalColumnClick = function(e, dateStr, dayIdx, rangeStart) { const rect = e.currentTarget.getBoundingClientRect(); const y = Math.max(0, e.clientY - rect.top); const minutes = rangeStart + Math.floor(y / CAL_HOUR_H * 2) * 30; window.openSlotModal(null, dateStr, minToTime(minutes), dayIdx); };
setInterval(() => { if (state.activeTab === 'agenda') renderAgenda(); }, 60000);
window.openSlotModal = function(slotId, defaultDateStr = '', defaultStart = '08:00', defaultDayIdx = 0) {
  const slot = slotId ? state.schedule.find(s => s.id === slotId) : null; document.getElementById('slot-modal-title').textContent = slot ? 'Modifier le créneau' : 'Ajouter un créneau';
  document.getElementById('s-id').value = slot ? slot.id : ''; document.getElementById('s-title').value = slot ? slot.title : ''; document.getElementById('s-start').value = slot ? slot.start : defaultStart;
  document.getElementById('s-end').value = slot ? slot.end : minToTime(Math.min(timeToMin(slot ? slot.start : defaultStart) + 120, 23 * 60 + 59)); document.getElementById('s-room').value = slot && slot.room ? slot.room : '';
  document.getElementById('s-delete-btn').style.display = slot ? 'inline-flex' : 'none'; const isRecurring = slot ? (slot.date === undefined && slot.dayOfWeek !== undefined) : true;
  document.getElementById('s-date').value = slot && slot.date ? slot.date : (defaultDateStr || formatDateISO(new Date()));
  mountCustomSelect('s-recurrence-mount', 's-recurrence', [{ value: 'weekly', label: 'Chaque semaine' }, { value: 'once', label: 'Une seule fois' }], isRecurring ? 'weekly' : 'once', (val) => { document.getElementById('s-day-container').style.display = val === 'weekly' ? 'block' : 'none'; document.getElementById('s-date-container').style.display = val === 'once' ? 'block' : 'none'; });
  document.getElementById('s-day-container').style.display = isRecurring ? 'block' : 'none'; document.getElementById('s-date-container').style.display = !isRecurring ? 'block' : 'none';
  mountCustomSelect('s-day-mount', 's-day', DAYS_LABELS.map((d, i) => ({ value: String(i), label: d })), slot && slot.dayOfWeek !== undefined ? String(slot.dayOfWeek) : String(defaultDayIdx));
  mountCustomSelect('s-subject-mount', 's-subj', getSubjectOptions(), slot ? slot.subject : 'maths'); mountCustomSelect('s-type-mount', 's-type', [{ value: 'COURS', label: 'COURS' }, { value: 'TD', label: 'TD' }, { value: 'TP', label: 'TP' }, { value: 'COLLE', label: 'COLLE' }, { value: 'DS', label: 'DS' }], slot ? slot.type : 'COURS');
  document.getElementById('slot-modal').classList.add('open');
};
window.closeSlotModal = function() { document.getElementById('slot-modal').classList.remove('open'); };
window.saveSlotForm = function(e) {
  e.preventDefault(); const id = document.getElementById('s-id').value, title = document.getElementById('s-title').value.trim(), subject = customSelectValues['s-subj'] || 'maths', type = customSelectValues['s-type'] || 'COURS', start = document.getElementById('s-start').value || '08:00', end = document.getElementById('s-end').value || '10:00', room = document.getElementById('s-room').value.trim();
  if (timeToMin(end) <= timeToMin(start)) { showToast('La fin doit être après le début'); return; } const isWeekly = customSelectValues['s-recurrence'] === 'weekly'; const dayOfWeek = isWeekly ? parseInt(customSelectValues['s-day'] || '0', 10) : undefined; const date = !isWeekly ? document.getElementById('s-date').value : undefined;
  if (id) { const existing = state.schedule.find(s => s.id === id); if (existing) { Object.assign(existing, { title, subject, type, start, end, room }); if (isWeekly) { existing.dayOfWeek = dayOfWeek; delete existing.date; } else { existing.date = date; delete existing.dayOfWeek; } } showToast('Créneau mis à jour'); }
  else { const newSlot = { id: 's_' + Date.now(), title, subject, type, start, end, room }; if (isWeekly) newSlot.dayOfWeek = dayOfWeek; else newSlot.date = date; state.schedule.push(newSlot); showToast('Créneau ajouté'); }
  saveState(); closeSlotModal(); renderAgenda();
};
window.deleteCurrentSlot = function() { const id = document.getElementById('s-id').value; if (!id) return; state.schedule = state.schedule.filter(s => s.id !== id); saveState(); closeSlotModal(); renderAgenda(); showToast('Créneau supprimé'); };
window.openScheduleImportModal = function() { document.getElementById('schedule-json-textarea').value = JSON.stringify(state.schedule, null, 2); document.getElementById('schedule-import-modal').classList.add('open'); };
window.closeScheduleImportModal = function() { document.getElementById('schedule-import-modal').classList.remove('open'); };
window.applyScheduleJSON = function() {
  try { const parsed = JSON.parse(document.getElementById('schedule-json-textarea').value.trim()); if (!Array.isArray(parsed)) throw new Error('Array JSON attendu');
    state.schedule = parsed.map((item, idx) => { const s = { id: item.id || ('s_imp_' + idx + '_' + Date.now()), start: item.start || '08:00', end: item.end || '10:00', subject: SUBJECTS[item.subject] ? item.subject : 'maths', type: item.type || 'COURS', title: item.title || 'Séance', room: item.room || '' }; if (item.date) s.date = item.date; else s.dayOfWeek = item.dayOfWeek !== undefined ? Number(item.dayOfWeek) : (item.day !== undefined ? Number(item.day) : 0); return s; });
    saveState(); closeScheduleImportModal(); renderAgenda(); showToast('Planning JSON importé avec succès');
  } catch (err) { showToast('Code JSON invalide'); }
};


