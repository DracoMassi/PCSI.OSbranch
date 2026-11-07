// config.js : constantes, matières, types de tâches, multiplicateurs et paramètres par défaut

const STORAGE_KEY = 'pcsi_minimal_saas_v2';
const SUPA_KEY = 'pcsi_supabase_cfg_v2';
const DAILY_DROP_SEEN_KEY = 'pcsi_daily_drop_seen_date';

const SUPABASE_URL = 'https://tuobyyfhwywbbwkayifw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qQg45ilq1NAzVqQ0eFfgyA_voFcptOm';

const DEFAULT_SUBJECTS = {
  maths:    { id: 'maths',    name: 'Mathématiques', short: 'MATHS',    color: '#EF4444', builtin: true },
  physique: { id: 'physique', name: 'Physique',      short: 'PHYSIQUE', color: '#A855F7', builtin: true },
  chimie:   { id: 'chimie',   name: 'Chimie',        short: 'CHIMIE',   color: '#10B981', builtin: true },
  si:       { id: 'si',       name: 'S.I.',          short: 'S.I.',     color: '#64748B', builtin: true },
  francais: { id: 'francais', name: 'Français',      short: 'FRANÇAIS', color: '#3B82F6', builtin: true },
  anglais:  { id: 'anglais',  name: 'Anglais',       short: 'ANGLAIS',  color: '#EAB308', builtin: true }
};

const SUBJECTS = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));

const SUBJECT_COLOR_PRESETS = [
  '#EF4444', '#F97316', '#EAB308', '#10B981',
  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1',
  '#A855F7', '#EC4899', '#84CC16', '#64748B'
];

const DEFAULT_TASK_TYPES = {
  Exercice:   { id: 'Exercice',   label: 'Exercice',   color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(56, 189, 248, 0.36)', icon: 'ph-pencil-line',        defaultMult: 0.7 },
  TD:         { id: 'TD',         label: 'TD',         color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.14)', border: 'rgba(59, 130, 246, 0.36)', icon: 'ph-list-checks',        defaultMult: 1.0 },
  DM:         { id: 'DM',         label: 'DM',         color: '#F97316', bg: 'rgba(249, 115, 22, 0.14)', border: 'rgba(249, 115, 22, 0.36)', icon: 'ph-file-text',          defaultMult: 2.0 },
  Colle:      { id: 'Colle',      label: 'Colle',      color: '#A855F7', bg: 'rgba(168, 85, 247, 0.14)', border: 'rgba(168, 85, 247, 0.36)', icon: 'ph-chalkboard-teacher', defaultMult: 1.6 },
  TP:         { id: 'TP',         label: 'TP',         color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.36)', icon: 'ph-flask',              defaultMult: 1.0 },
  'Révision': { id: 'Révision',   label: 'Révision',   color: '#EAB308', bg: 'rgba(234, 179, 8, 0.14)',  border: 'rgba(234, 179, 8, 0.36)',  icon: 'ph-brain',              defaultMult: 0.9 },
  Cours:      { id: 'Cours',      label: 'Cours',      color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.14)',  border: 'rgba(6, 182, 212, 0.36)',  icon: 'ph-book-open-text',     defaultMult: 0.4 },
  DS:         { id: 'DS',         label: 'DS',         color: '#EF4444', bg: 'rgba(239, 68, 68, 0.16)',  border: 'rgba(239, 68, 68, 0.42)',  icon: 'ph-warning-octagon',    defaultMult: 3.0 }
};

const TASK_TYPES = JSON.parse(JSON.stringify(DEFAULT_TASK_TYPES));

const TASK_TYPE_ICON_PRESETS = [
  { icon: 'ph-pencil-line',        label: 'Exercice' },
  { icon: 'ph-list-checks',        label: 'TD / Liste' },
  { icon: 'ph-file-text',          label: 'DM / Devoir' },
  { icon: 'ph-chalkboard-teacher', label: 'Colle / Oral' },
  { icon: 'ph-flask',              label: 'TP / Labo' },
  { icon: 'ph-brain',              label: 'Révision' },
  { icon: 'ph-book-open-text',     label: 'Cours' },
  { icon: 'ph-warning-octagon',    label: 'DS / Examen' },
  { icon: 'ph-lightning',          label: 'Flash / Urgent' },
  { icon: 'ph-code',               label: 'Info / Code' },
  { icon: 'ph-compass',            label: 'TIPE / Projet' },
  { icon: 'ph-star',               label: 'Concours / Annale' }
];

function hexToRgba(hex, alpha = 0.15) {
  const clean = String(hex || '#38BDF8').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const DEFAULT_TASK_TYPE = 'Exercice';

const DEFAULT_TYPE_MULTIPLIERS = {
  DS: 3.0,
  DM: 2.0,
  Colle: 1.6,
  TD: 1.0,
  TP: 1.0,
  'Révision': 0.9,
  Exercice: 0.7,
  Cours: 0.4
};

const DEFAULT_SETTINGS = {
  alpha: 0.65,               // Poids Urgence Deadline (0.10 à 0.90)
  beta: 0.35,                // Poids Durée Estimée (1 - alpha)
  autoDsBoost: true,         // Boost auto des tâches de la matière du DS du samedi
  dsBoostFactor: 1.4,        // Multiplicateur AutoDSFactor (ex: x1.4)
  dsSubjectOverride: 'auto', // 'auto' (détecté depuis l'agenda) ou id matière
  typeMultipliers: JSON.parse(JSON.stringify(DEFAULT_TYPE_MULTIPLIERS)),
  tomorrowFirst: true,       // Place les tâches dues demain tout en haut du backlog
  sortMode: 'tension',       // 'tension' | 'deadline'
  dinnerStart: '19:00',      // Début pause dîner
  dinnerEnd: '20:00',        // Fin pause dîner
  bedtime: '23:00',          // Couvre-feu / heure de coucher cible
  defaultClassEnd: '17:30',  // Heure de début soirée par défaut si aucun cours l'après-midi
  commuteBufferMin: 30,      // Buffer trajet / transition (min) après les cours et avant une séance tardive
  ankiDeck: 'PCSI::Vocabulaire' // Deck Anki cible (supporte Parent::Enfant)
};

const DAYS_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const AFTER_HOURS_DAYS_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const AFTER_HOURS_DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/**
 * Détecte les jours fériés français (fixes + mobiles calculés via algorithme de Meeus/Jones/Butcher)
 */
function getFrenchBankHolidayName(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return null;
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const mmdd = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const fixed = {
    '01-01': 'Jour de l\'An',
    '05-01': 'Fête du Travail',
    '05-08': 'Victoire 1945',
    '07-14': 'Fête Nationale',
    '08-15': 'Assomption',
    '11-01': 'Toussaint',
    '11-11': 'Armistice 1918',
    '12-25': 'Noël'
  };
  if (fixed[mmdd]) return fixed[mmdd];

  // Calcul de Pâques (algorithme de Meeus)
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d1 = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d1 - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m1 = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m1 + 114) / 31);
  const easterDay = ((h + l - 7 * m1 + 114) % 31) + 1;
  const easter = new Date(y, easterMonth - 1, easterDay);

  const addDays = (base, offset) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + offset);
    return dt.getMonth() + 1 === m && dt.getDate() === d;
  };

  if (addDays(easter, 1)) return 'Lundi de Pâques';
  if (addDays(easter, 39)) return 'Ascension';
  if (addDays(easter, 50)) return 'Lundi de Pentecôte';
  return null;
}

function isFrenchBankHoliday(dateObj) {
  return Boolean(getFrenchBankHolidayName(dateObj));
}


const DEFAULT_ERROR_TYPES = [
  { id: 'et_calc', label: 'Erreur de calcul', icon: '🔢' },
  { id: 'et_cours', label: 'Oubli de cours', icon: '🧠' },
  { id: 'et_hyp', label: 'Oubli d\'hypothèse', icon: '⚠️' },
  { id: 'et_hom', label: 'Homogénéité / Unité', icon: '📏' },
  { id: 'et_redac', label: 'Rédaction / Rigueur', icon: '✍️' }
];

const DEFAULT_PORTALS = [
  { id: 'port_1', title: 'Cahier de Prépa', url: 'https://cahier-de-prepa.fr/pcsia-lakanal/', icon: 'ph-book-open', desc: 'Cours, colloscope, documents' },
  { id: 'port_2', title: 'S2I Achard', url: 'http://s2i.cpge.achard.free.fr', icon: 'ph-cpu', desc: 'Sciences de l\'ingénieur' },
  { id: 'port_3', title: 'MonLycée.net', url: 'https://auth.monlycee.net/realms/TWIDF/protocol/openid-connect/auth?approval_prompt=force&client_id=psn-web-een&code_challenge=a549sIcPfHp7Hq23KmbnL3mSI-lk7ZWyRjzhygja6Ok&code_challenge_method=S256&redirect_uri=https%3A%2F%2Fpsn.monlycee.net%2Foauth2%2Fcallback&response_type=code&scope=openid&state=HVtdB5urANmg_K3CUQfrHMwqqaeLdR_G0FvY5JS-rrI%3Ahttps%3A%2F%2Fpsn.monlycee.net%2Fcas%2Finit%3FredirectUrl%3Dhttps%3A%2F%2Fpsn.monlycee.net%2F', icon: 'ph-identification-badge', desc: 'ENT du lycée' }
];

function getSubject(subjId) {
  if (subjId && SUBJECTS[subjId]) return SUBJECTS[subjId];
  const first = Object.values(SUBJECTS)[0];
  return first || DEFAULT_SUBJECTS.physique;
}

function getTaskTypeMeta(typeId) {
  if (typeId && TASK_TYPES[typeId]) return TASK_TYPES[typeId];
  if (typeId) {
    const lower = String(typeId).toLowerCase();
    const found = Object.values(TASK_TYPES).find(t =>
      t.id.toLowerCase() === lower || (t.label && t.label.toLowerCase() === lower)
    );
    if (found) return found;
  }
  if (TASK_TYPES[DEFAULT_TASK_TYPE]) return TASK_TYPES[DEFAULT_TASK_TYPE];
  const first = Object.values(TASK_TYPES)[0];
  return first || DEFAULT_TASK_TYPES.Exercice;
}

function getTypeMultiplier(typeId) {
  const meta = getTaskTypeMeta(typeId);
  const map = (typeof state !== 'undefined' && state.settings && state.settings.typeMultipliers)
    ? state.settings.typeMultipliers
    : DEFAULT_TYPE_MULTIPLIERS;
  const val = parseFloat(map[meta.id]);
  if (Number.isFinite(val) && val >= 0.1) return Number(val.toFixed(2));
  if (Number.isFinite(meta.defaultMult) && meta.defaultMult >= 0.1) return Number(meta.defaultMult.toFixed(2));
  return DEFAULT_TYPE_MULTIPLIERS[meta.id] || 1.0;
}

// =========================================================
// BRANDING DYNAMIQUE DEPUIS LE REPO GITHUB (nom-du-site.txt & icon.png)
// =========================================================

function formatBrandNameHtml(rawName) {
  const clean = String(rawName || 'PCSI.OS').trim() || 'PCSI.OS';
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx > 0 && dotIdx < clean.length - 1) {
    const prefix = clean.slice(0, dotIdx);
    const suffix = clean.slice(dotIdx);
    return `${prefix.replace(/</g, '&lt;')}<span>${suffix.replace(/</g, '&lt;')}</span>`;
  }
  return clean.replace(/</g, '&lt;');
}

function applySiteBrandingToDOM(siteName, subtitle) {
  const cleanName = String(siteName || 'PCSI.OS').trim() || 'PCSI.OS';
  const cleanSub = subtitle ? String(subtitle).trim() : '';

  document.title = cleanSub ? `${cleanName} — ${cleanSub}` : cleanName;

  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.setAttribute('content', cleanName);

  const appNameMeta = document.querySelector('meta[name="application-name"]');
  if (appNameMeta) appNameMeta.setAttribute('content', cleanName);

  document.querySelectorAll('.brand-name').forEach(el => {
    el.innerHTML = formatBrandNameHtml(cleanName);
  });

  if (cleanSub) {
    const subEl = document.getElementById('brand-subtitle');
    if (subEl) subEl.textContent = cleanSub;
  }
}

window.loadSiteBrandingFromRepo = async function() {
  try {
    const cached = localStorage.getItem('pcsi_site_branding_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.name) applySiteBrandingToDOM(parsed.name, parsed.subtitle);
    }
  } catch (e) {}

  try {
    const res = await fetch('nom-du-site.txt?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const siteName = lines[0];
      const subtitle = lines[1] || '';
      applySiteBrandingToDOM(siteName, subtitle);
      try {
        localStorage.setItem('pcsi_site_branding_cache', JSON.stringify({ name: siteName, subtitle }));
      } catch (e) {}
    }
  } catch (e) {}
};
