// utils.js : dates, toast, échappement HTML

function getOffsetDateISO(daysOffset) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + daysOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getMonday(d) { const date = new Date(d); const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1); return new Date(date.setDate(diff)); }
function addDays(d, days) { const date = new Date(d); date.setDate(date.getDate() + days); return date; }
function formatDateISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function formatShortDate(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }

function showToast(msg) { const t = document.getElementById('toast'); document.getElementById('toast-text').textContent = msg; t.classList.add('show'); clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.remove('show'), 2400); }

function escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function uid() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}
