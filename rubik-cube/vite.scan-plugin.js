import fs from 'node:fs';
import path from 'node:path';

const SIX_FACES_PROMPT = `You are reading a 3x3 Rubik's cube from 6 photos, one for each face (U = Top, L = Left, F = Front, R = Right, B = Back, D = Down).
Color vocabulary (MUST use these exact lowercase strings in JSON): white, yellow, red, orange, blue, green.

For each face, extract the 3x3 grid in standard row-major order (indices 0 to 8):
  0 1 2
  3 4 5
  6 7 8

Index 4 is the center sticker of the face.
Return ONLY valid JSON in this exact structure:
{
  "U": ["color0", "color1", "color2", "color3", "color4", "color5", "color6", "color7", "color8"],
  "L": ["color0", "color1", "color2", "color3", "color4", "color5", "color6", "color7", "color8"],
  "F": ["color0", "color1", "color2", "color3", "color4", "color5", "color6", "color7", "color8"],
  "R": ["color0", "color1", "color2", "color3", "color4", "color5", "color6", "color7", "color8"],
  "B": ["color0", "color1", "color2", "color3", "color4", "color5", "color6", "color7", "color8"],
  "D": ["color0", "color1", "color2", "color3", "color4", "color5", "color6", "color7", "color8"]
}`;

function readEnvVar(key) {
  if (process.env[key]) return process.env[key].trim();
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const text = fs.readFileSync(envPath, 'utf8');
    const match = text.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
  } catch {
    /* no .env */
  }
  return '';
}

function getApiConfig() {
  const openRouterKey = readEnvVar('OPENROUTER_API_KEY');
  if (openRouterKey) {
    const model = readEnvVar('OPENROUTER_MODEL') || 'google/gemini-2.5-flash';
    return { provider: 'openrouter', apiKey: openRouterKey, model };
  }

  const xaiKey = readEnvVar('XAI_API_KEY');
  if (xaiKey) {
    const model = readEnvVar('XAI_MODEL') || 'grok-4.6';
    return { provider: 'xai', apiKey: xaiKey, model };
  }

  return { provider: null, apiKey: '', model: '' };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function extractJsonObject(text) {
  if (!text) throw new Error('Resposta vazia da visão.');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('A visão não devolveu JSON válido das faces.');
  }
  return JSON.parse(raw.slice(start, end + 1));
}

async function callOpenRouterSixFaces(images, apiKey, model = 'google/gemini-2.5-flash') {
  const content = [];
  const faceLabels = {
    U: 'Face Topo (Up)',
    L: 'Face Esquerda (Left)',
    F: 'Face Frente (Front)',
    R: 'Face Direita (Right)',
    B: 'Face Trás (Back)',
    D: 'Face Base (Down)'
  };

  for (const [face, url] of Object.entries(images)) {
    if (url) {
      content.push({ type: 'text', text: `Foto da ${faceLabels[face] || face} (${face}):` });
      content.push({ type: 'image_url', image_url: { url } });
    }
  }
  content.push({ type: 'text', text: SIX_FACES_PROMPT });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Rubik Cube 3D Scanner 6 Faces'
    },
    body: JSON.stringify({
      model: model,
      temperature: 0,
      messages: [{ role: 'user', content }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(String(msg));
  }

  const text = data.choices?.[0]?.message?.content || '';
  return extractJsonObject(text);
}

function attachRoutes(middlewares) {
  middlewares.use(async (req, res, next) => {
    if (req.url?.split('?')[0] === '/api/scan-status' && req.method === 'GET') {
      const config = getApiConfig();
      sendJson(res, 200, {
        vision: Boolean(config.apiKey),
        provider: config.provider,
        model: config.model
      });
      return;
    }

    if (req.url?.split('?')[0] === '/api/scan-six-faces' && req.method === 'POST') {
      try {
        const config = getApiConfig();
        if (!config.apiKey) {
          sendJson(res, 503, {
            error: 'API Key não configurada. Defina OPENROUTER_API_KEY no arquivo .env.'
          });
          return;
        }

        const body = await readBody(req);
        if (!body.images || typeof body.images !== 'object') {
          sendJson(res, 400, { error: 'Envie o mapa de imagens das 6 faces em data URL.' });
          return;
        }

        let readings = await callOpenRouterSixFaces(body.images, config.apiKey, config.model);
        sendJson(res, 200, { readings, provider: config.provider, model: config.model });
      } catch (err) {
        sendJson(res, 500, { error: err.message || 'Falha na análise visual das 6 faces.' });
      }
      return;
    }

    next();
  });
}

export function scanTwoShotPlugin() {
  return {
    name: 'scan-two-shot',
    configureServer(server) {
      attachRoutes(server.middlewares);
    },
    configurePreviewServer(server) {
      attachRoutes(server.middlewares);
    }
  };
}
