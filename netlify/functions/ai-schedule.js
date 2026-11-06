// netlify/functions/ai-schedule.js
// Fonction Serverless Netlify : conversion visuelle Photo/PDF -> Emploi du temps JSON
// Supporte la rotation automatique entre plusieurs clés Gemini (GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_API_KEY_2...)
// + bascule automatique sur la passerelle Vision gratuite si aucune clé n'est configurée.

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
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const promptText = String(body.prompt || '').trim();
  const images = Array.isArray(body.images) ? body.images.slice(0, 3) : [];

  if (!promptText || !images.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt ou images manquants' }) };
  }

  // Récupérer toutes les clés Gemini configurées dans les variables d'environnement Netlify
  const rawKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    ...(process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : [])
  ]
    .map(k => (k || '').trim())
    .filter(Boolean);

  // Dédupliquer tout en mélangeant légèrement l'ordre pour répartir la charge (load-balancing)
  const uniqueKeys = Array.from(new Set(rawKeys));
  if (uniqueKeys.length > 1) {
    const startOffset = Math.floor(Math.random() * uniqueKeys.length);
    const rotated = uniqueKeys.slice(startOffset).concat(uniqueKeys.slice(0, startOffset));
    uniqueKeys.splice(0, uniqueKeys.length, ...rotated);
  }

  // 1. Essayer chaque clé Gemini configurée (rotation automatique en cas de quota 429)
  for (const apiKey of uniqueKeys) {
    try {
      const parts = [{ text: promptText }];
      images.forEach(dataUrl => {
        const base64Data = String(dataUrl).includes(',') ? String(dataUrl).split(',')[1] : String(dataUrl);
        if (base64Data) {
          parts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Data
            }
          });
        }
      });

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ text, provider: 'gemini' })
          };
        }
      }
      // Si 429 (quota) ou erreur sur cette clé, la boucle passe automatiquement à la clé suivante
    } catch (err) {
      // Passe à la clé suivante
    }
  }

  // 2. Fallback automatique sans clé via la passerelle Vision OpenAI Pollinations
  try {
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

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({ error: 'Service IA temporairement occupé (' + res.status + ')' })
      };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content
      ? data.choices[0].message.content
      : (typeof data === 'string' ? data : JSON.stringify(data));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text, provider: 'fallback' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Erreur serveur IA' })
    };
  }
};
