import fs from 'node:fs';
import path from 'node:path';

async function run() {
  const tabsRes = await fetch('http://localhost:9222/json');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.url.includes('localhost:3000') || t.title.includes('Acrobatic Train'));

  if (!pageTab) {
    console.error('No Acrobatic Train tab found on port 9222');
    process.exit(1);
  }

  console.log(`Found tab: ${pageTab.title} (${pageTab.id})`);
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  console.log('Connected to Chrome via CDP WebSocket!');

  // Enable Page & Runtime
  await send('Page.enable');
  await send('Runtime.enable');

  // Reload page to get fresh assets
  console.log('Reloading page...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 1500));

  // Check initial DOM
  const evalDom = async (code) => {
    const res = await send('Runtime.evaluate', { expression: code, returnByValue: true });
    return res.result?.value;
  };

  const initialPauseModalHidden = await evalDom("document.getElementById('pause-modal')?.hidden");
  console.log(`Initial #pause-modal.hidden: ${initialPauseModalHidden}`);

  // Start game by clicking start button
  console.log('Starting game...');
  await evalDom("document.getElementById('start-game-btn')?.click()");
  await new Promise(r => setTimeout(r, 2000));

  // Press KeyP to pause
  console.log('Pressing KeyP to pause...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyP', key: 'p', windowsVirtualKeyCode: 80 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyP', key: 'p', windowsVirtualKeyCode: 80 });
  await new Promise(r => setTimeout(r, 600));

  const pausedHidden = await evalDom("document.getElementById('pause-modal')?.hidden");
  console.log(`After pressing KeyP, #pause-modal.hidden: ${pausedHidden}`);

  // Capture screenshot while paused
  const artifactDir = 'C:\\Users\\ggamp\\.gemini\\antigravity-ide\\brain\\31f00bd1-6a27-4b63-ae7d-39d8de5d9418';
  const pausedShot = await send('Page.captureScreenshot', { format: 'png' });
  const pausedPath = path.join(artifactDir, 'game_paused_state.png');
  fs.writeFileSync(pausedPath, Buffer.from(pausedShot.data, 'base64'));
  console.log(`Saved paused screenshot to: ${pausedPath}`);

  // Resume game by pressing KeyP again
  console.log('Pressing KeyP to resume...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyP', key: 'p', windowsVirtualKeyCode: 80 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyP', key: 'p', windowsVirtualKeyCode: 80 });
  await new Promise(r => setTimeout(r, 600));

  const resumedHidden = await evalDom("document.getElementById('pause-modal')?.hidden");
  console.log(`After pressing KeyP again, #pause-modal.hidden: ${resumedHidden}`);

  // Let train drive 3.5 seconds across middle and side tracks
  console.log('Letting train drive along tracks...');
  await new Promise(r => setTimeout(r, 3500));

  // Capture clean track screenshot
  const cleanShot = await send('Page.captureScreenshot', { format: 'png' });
  const cleanPath = path.join(artifactDir, 'clean_middle_rail.png');
  fs.writeFileSync(cleanPath, Buffer.from(cleanShot.data, 'base64'));
  console.log(`Saved clean track screenshot to: ${cleanPath}`);

  // Check if any switch signs or unwanted posts exist in scene
  const switchSignsCount = await evalDom("window.__debugSwitchCount || 0");
  console.log(`Switch signs count in memory: ${switchSignsCount}`);

  ws.close();
  console.log('Test completed successfully!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
