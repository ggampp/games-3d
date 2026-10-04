import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const tabs = await fetch('http://localhost:9222/json').then(r => r.json());
  const pageTab = tabs.find(t => t.url.includes('3000'));
  if (!pageTab) return;

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    const handler = (e) => {
      const data = JSON.parse(e.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 1400));
  await send('Runtime.evaluate', { expression: "document.getElementById('start-game-btn')?.click()" });
  await new Promise(r => setTimeout(r, 1500));

  const artifactDir = 'C:\\Users\\ggamp\\.gemini\\antigravity-ide\\brain\\31f00bd1-6a27-4b63-ae7d-39d8de5d9418';
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'cyber_shinkansen_detailed.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved cyber_shinkansen_detailed.png');

  ws.close();
}

main().catch(console.error);
