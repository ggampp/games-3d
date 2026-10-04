import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { askJev, choice, score } from './jev/client.js';

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

const server = http.createServer(async (req, res) => {
  // Safe backend API endpoint for AI Stunt Judge (keeps TYPESAFE_API_KEY strictly server-side)
  if (req.method === 'POST' && req.url === '/api/stunt-judge') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const telemetry = JSON.parse(body || '{}');
        const questions = {
          stunt_title: choice(
            "Based on the player's acrobatic stunt telemetry in `telemetry`, assign a high-octane arcade title for this stunt.",
            {
              "APEX DRIFTER": "Extended high-speed diagonal drift between parallel rails",
              "GRAVITY DEFIER": "High-altitude vertical backflip or high aerial ring collection",
              "BARREL ROLL MAESTRO": "Complete longitudinal 360-degree roll in diagonal stance",
              "RAIL PHANTOM": "Close shave passing danger poles or crossing hazards at extreme velocity",
              "SONIC BULLET": "Top speed run with zero track wobble"
            }
          ),
          style_score: score(
            "Rate the artistic complexity and daring of this train maneuver from 0 (standard) to 2 (legendary).",
            [
              "Standard clean execution (+25 bonus)",
              "Impressive technical acrobatic feat (+50 bonus)",
              "Legendary death-defying stunt mastery (+100 bonus)"
            ]
          )
        };

        const result = await askJev(telemetry, questions);
        const { stunt_title, style_score } = result.answers;
        const bonusMap = [25, 50, 100];
        const bonusPoints = bonusMap[Math.min(2, Math.round(style_score?.score || 1))];

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          title: stunt_title.choice,
          confidence: stunt_title.confidence || 0.9,
          bonus: bonusPoints,
          model: result.model
        }));
      } catch (err) {
        // Fallback default stunt title on timeout or offline
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          title: 'ACROBATIC DRIFTER',
          confidence: 0.85,
          bonus: 50,
          model: 'fallback-local'
        }));
      }
    });
    return;
  }
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(process.cwd(), reqPath);

  // Security check: avoid directory traversal
  if (!filePath.startsWith(process.cwd()) || reqPath.includes('.env')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Acrobatic Train 3D rodando em: http://localhost:${PORT}`);
  console.log(`🎮 Controles pelo Teclado:`);
  console.log(`   - Vagão Dianteiro: [A] Esquerda | [D] Direita`);
  console.log(`   - Vagão Traseiro:  [←] Esquerda | [→] Direita (ou [J] / [L])`);
  console.log(`   - Alinhar Trem:    [W] (ou [↑])`);
  console.log(`   - Centralizar:     [S] (ou [↓])`);
  console.log(`   - Iniciar/Retry:   [Espaço] ou [Enter]\n`);
});
