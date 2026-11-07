// netlify/functions/ai-schedule.js
// Fonction Serverless Netlify : conversion visuelle Photo/PDF -> Emploi du temps JSON
//
// Variables d'environnement Netlify :
//   GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_KEY_2, ... : clés Gemini (une ou plusieurs par variable, séparées par , ; ou espace)
//   ALLOWED_ORIGIN : origines autorisées, séparées par des virgules (ex: https://mon-site.netlify.app).
//                    Vide = aucun en-tête CORS (appels same-origin uniquement).
//   GEMINI_MODELS  : modèles essayés dans l'ordre, séparés par des virgules (défaut ci-dessous).

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const MAX_IMAGES = 3;
const MAX_PROMPT_CHARS = 8000;
const MAX_ATTEMPTS = 4;
const DEFAULT_MODELS = 'gemini-2.5-flash-lite,gemini-2.5-flash';

// Seules les variables de type clé sont lues (GEMINI_MODELS ne doit pas être pris pour une clé).
const KEY_ENV_PATTERN = /^GEMINI_(API_)?KEY/i;

const SLOT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    slots: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dayOfWeek: { type: 'INTEGER', nullable: true },
          date: { type: 'STRING', nullable: true },
          start: { type: 'STRING', nullable: true },
          end: { type: 'STRING', nullable: true },
          subject: { type: 'STRING', nullable: true },
          type: { type: 'STRING', nullable: true },
          title: { type: 'STRING', nullable: true },
          room: { type: 'STRING', nullable: true }
        },
        required: ['dayOfWeek', 'date', 'start', 'end', 'subject', 'type', 'title', 'room']
      }
    }
  },
  required: ['slots']
};

function parseList(value) {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean);
}

function collectApiKeys(env) {
  const keys = [];
  Object.entries(env || {}).forEach(([name, value]) => {
    if (!KEY_ENV_PATTERN.test(name) || !value || typeof value !== 'string') return;
    value.split(/[,;\s]+/).forEach(part => {
      const cleaned = part.replace(/^['"]+|['"]+$/g, '').trim();
      if (cleaned.length >= 20) keys.push(cleaned);
    });
  });
  return Array.from(new Set(keys));
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildImageParts(images) {
  const parts = [];
  images.forEach(dataUrl => {
    const str = String(dataUrl || '');
    const match = str.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/is);
    if (match) {
      parts.push({ inline_data: { mime_type: match[1].toLowerCase(), data: match[2] } });
    }
  });
  return parts;
}

exports.handler = async function(event) {
  const env = process.env || {};
  const allowedOrigins = parseList(env.ALLOWED_ORIGIN);
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const originAllowed = allowedOrigins.includes(origin);

  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
  if (originAllowed) headers['Access-Control-Allow-Origin'] = origin;

  const reply = (statusCode, payload) => ({ statusCode, headers, body: payload === undefined ? '' : JSON.stringify(payload) });

  if (event.httpMethod === 'OPTIONS') {
    return reply(originAllowed ? 204 : 403);
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'Method Not Allowed' });
  }

  // Un navigateur envoie toujours Origin sur un POST : s'il est présent et non autorisé, on refuse.
  // (Atténuation seulement : un client non-navigateur peut forger cet en-tête.)
  if (allowedOrigins.length && origin && !originAllowed) {
    return reply(403, { error: 'Origine non autorisée' });
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return reply(413, { error: 'Document trop volumineux' });
  }

  let body;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch (e) {
    return reply(400, { error: 'Requête JSON invalide' });
  }

  const promptText = String(body.prompt || '').trim().slice(0, MAX_PROMPT_CHARS);
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (!promptText || !images.length) {
    return reply(400, { error: 'Aucune image fournie pour l\'analyse' });
  }

  const imageParts = buildImageParts(images);
  if (!imageParts.length) {
    return reply(400, { error: 'Format d\'image non reconnu' });
  }

  const apiKeys = shuffle(collectApiKeys(env));
  if (!apiKeys.length) {
    return reply(503, {
      error: 'Aucune clé Gemini active sur ce déploiement. Ajoute GEMINI_API_KEY_1 dans Netlify puis redéploie le site.'
    });
  }

  const models = parseList(env.GEMINI_MODELS || DEFAULT_MODELS);
  let lastStatus = 500;
  let lastErrorMsg = '';
  let attempts = 0;

  for (const apiKey of apiKeys) {
    for (const modelName of models) {
      if (attempts >= MAX_ATTEMPTS) break;
      attempts++;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }, ...imageParts] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              responseSchema: SLOT_SCHEMA
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = (data?.candidates?.[0]?.content?.parts || [])
            .map(p => p.text || '')
            .join('\n')
            .trim();
          if (text) return reply(200, { text, provider: modelName });
          lastStatus = 502;
          lastErrorMsg = `Réponse vide (${modelName})`;
          continue;
        }

        lastStatus = res.status;
        const errJson = await res.json().catch(() => ({}));
        lastErrorMsg = errJson?.error?.message || `HTTP ${res.status} (${modelName})`;
        // Clé invalide : inutile d'essayer d'autres modèles avec cette clé.
        if (res.status === 400 && /API_KEY_INVALID|key not valid/i.test(lastErrorMsg)) break;
        // 404 (modèle indisponible) ou 429 (quota) : modèle suivant, sans boucle de réessai.
      } catch (err) {
        lastStatus = 502;
        lastErrorMsg = err.message || 'Erreur réseau Gemini';
      }
    }
    if (attempts >= MAX_ATTEMPTS) break;
  }

  const status = lastStatus === 429 ? 429 : (lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502);
  return reply(status, { error: `Erreur Gemini (${lastStatus}) : ${lastErrorMsg || 'service indisponible'}` });
};
