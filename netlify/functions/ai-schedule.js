// netlify/functions/ai-schedule.js
// Fonction Serverless Netlify : conversion visuelle Photo/PDF -> Emploi du temps JSON
// Supporte la détection et la rotation automatique entre toutes les clés Gemini (GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (event.body || '{}');
    body = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Requête JSON invalide' }) };
  }

  const promptText = String(body.prompt || '').trim();
  const images = Array.isArray(body.images) ? body.images.slice(0, 3) : [];
  const clientKey = String(body.clientApiKey || '').trim();

  if (!promptText || !images.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Aucune image fournie pour l\'analyse' }) };
  }

  // Récupérer automatiquement TOUTES les clés Gemini présentes dans les variables d'environnement Netlify
  // (GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_KEY_1, etc.)
  const envKeys = [];
  if (clientKey) envKeys.push(clientKey);

  Object.entries(process.env || {}).forEach(([k, v]) => {
    if (/gemini/i.test(k) && v && typeof v === 'string') {
      v.split(/[,;\s]+/).forEach(part => {
        const cleaned = part.replace(/^['"]+|['"]+$/g, '').trim();
        if (cleaned.length >= 20) envKeys.push(cleaned);
      });
    }
  });

  const uniqueKeys = Array.from(new Set(envKeys));
  if (uniqueKeys.length === 0) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: 'Clé GEMINI_API_KEY_1 non encore active sur ce déploiement Netlify. Après avoir ajouté une variable dans Netlify, fais un nouveau déploiement (git push ou "Trigger deploy" dans Netlify → Deploys) pour l\'activer.'
      })
    };
  }

  // Rotation aléatoire de l'ordre des clés pour répartir la charge (load-balancing)
  if (uniqueKeys.length > 1) {
    const startOffset = Math.floor(Math.random() * uniqueKeys.length);
    const rotated = uniqueKeys.slice(startOffset).concat(uniqueKeys.slice(0, startOffset));
    uniqueKeys.splice(0, uniqueKeys.length, ...rotated);
  }

  // Construire les blocs d'images avec détection exacte du mimeType (image/jpeg, image/png, image/webp)
  const imageParts = [];
  images.forEach(dataUrl => {
    const str = String(dataUrl || '');
    const mimeMatch = str.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
    const mimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';
    const base64Data = str.includes(',') ? str.split(',')[1] : str;
    if (base64Data) {
      imageParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    }
  });

  if (imageParts.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Format d\'image non reconnu' }) };
  }

  // Modèles Gemini Vision testés dans l'ordre (compatibles avec toutes les clés Google AI Studio 2025/2026)
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];
  let lastErrorMsg = '';
  let lastStatus = 500;

  for (const apiKey of uniqueKeys) {
    for (const modelName of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: promptText }, ...imageParts]
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = (data?.candidates?.[0]?.content?.parts || [])
            .map(p => p.text || '')
            .join('\n')
            .trim();
          if (text) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ text, provider: modelName })
            };
          }
        } else {
          lastStatus = res.status;
          const errJson = await res.json().catch(() => ({}));
          lastErrorMsg = errJson?.error?.message || `HTTP ${res.status} (${modelName})`;
          // Si la clé elle-même est invalide (API_KEY_INVALID), inutile de tester les autres modèles avec cette même clé
          if (res.status === 400 && /API_KEY_INVALID|key not valid/i.test(lastErrorMsg)) {
            break;
          }
          // Si 404 (modèle non dispo sur ce projet) ou 429 (quota atteint sur ce modèle), on tente le modèle suivant
        }
      } catch (err) {
        lastErrorMsg = err.message || 'Erreur réseau Gemini';
      }
    }
  }

  return {
    statusCode: lastStatus || 500,
    headers,
    body: JSON.stringify({
      error: `Erreur Gemini (${lastStatus}) : ${lastErrorMsg || 'Vérifie ta clé GEMINI_API_KEY_1 dans Netlify et redéploie le site.'}`
    })
  };
};
