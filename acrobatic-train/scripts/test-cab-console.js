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
  console.log('Connected to CDP WebSocket');

  await send('Page.reload');
  await new Promise(r => setTimeout(r, 1500));

  // Check tutorial modal with railroad handbook text
  const artifactDir = 'C:\\Users\\ggamp\\.gemini\\antigravity-ide\\brain\\31f00bd1-6a27-4b63-ae7d-39d8de5d9418';
  const tutShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'railway_handbook_modal.png'), Buffer.from(tutShot.data, 'base64'));
  console.log('Saved railway_handbook_modal.png');

  // Start game
  await send('Runtime.evaluate', { expression: "document.getElementById('start-game-btn')?.click()" });
  await new Promise(r => setTimeout(r, 1500));

  // Press KeyH to sound locomotive horn
  console.log('Sounding locomotive horn...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyH', key: 'h', windowsVirtualKeyCode: 72 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyH', key: 'h', windowsVirtualKeyCode: 72 });
  await new Promise(r => setTimeout(r, 400));

  // Shift front bogie to left track (AMV Via 1)
  console.log('Shifting front bogie to left track (KeyA)...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65 });
  await new Promise(r => setTimeout(r, 1200));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'railway_cab_console_in_action.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved railway_cab_console_in_action.png');

  ws.close();
}

main().catch(console.error);
