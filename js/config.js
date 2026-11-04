// config.js : constantes, matières, valeurs par défaut

const STORAGE_KEY = 'pcsi_minimal_saas_v2';
const SUPA_KEY = 'pcsi_supabase_cfg_v2';

const SUPABASE_URL = 'https://tuobyyfhwywbbwkayifw.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_qQg45ilq1NAzVqQ0eFfgyA_voFcptOm'; 

const SUBJECTS = {
  maths:    { id: 'maths',    name: 'Mathématiques', short: 'MATHS',    color: '#EF4444' },
  physique: { id: 'physique', name: 'Physique',      short: 'PHYSIQUE', color: '#A855F7' },
  chimie:   { id: 'chimie',   name: 'Chimie',        short: 'CHIMIE',   color: '#10B981' },
  si:       { id: 'si',       name: 'S.I.',          short: 'S.I.',     color: '#64748B' },
  francais: { id: 'francais', name: 'Français',      short: 'FRANÇAIS', color: '#3B82F6' },
  anglais:  { id: 'anglais',  name: 'Anglais',       short: 'ANGLAIS',  color: '#EAB308' }
};

const DAYS_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
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

