import fs from 'node:fs';
import path from 'node:path';

async function run() {
  const tabsRes = await fetch('http://localhost:9222/json');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.url.includes('localhost:3000') || t.title.includes('Acrobatic Train'));

  if (!pageTab) {
    console.error('No tab found on port 9222');
    process.exit(1);
  }

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();
  const consoleLogs = [];

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push(data.params.args.map(a => a.value).join(' '));
    }
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
  console.log('Connected to CDP WebSocket');

  await send('Page.enable');
  await send('Runtime.enable');

  // Hard reload
  console.log('Reloading page...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 1600));

  const evalDom = async (code) => {
    const res = await send('Runtime.evaluate', { expression: code, returnByValue: true });
    return res.result?.value;
  };

  // Start game
  console.log('Starting game...');
  await evalDom("document.getElementById('start-game-btn')?.click()");
  await new Promise(r => setTimeout(r, 1800));

  // Let train drive 4 seconds
  console.log('Driving train along rails...');
  await new Promise(r => setTimeout(r, 3500));

  // Cycle skin to Crimson to test dynamic recoloring of new detailed parts
  console.log('Cycling skin to Crimson Bullet...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyT', key: 't', windowsVirtualKeyCode: 84 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyT', key: 't', windowsVirtualKeyCode: 84 });
  await new Promise(r => setTimeout(r, 1000));

  const artifactDir = 'C:\\Users\\ggamp\\.gemini\\antigravity-ide\\brain\\31f00bd1-6a27-4b63-ae7d-39d8de5d9418';
  
  // Capture screenshot of high-detail train
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const shotPath1 = path.join(artifactDir, 'detailed_train_in_action.png');
  fs.writeFileSync(shotPath1, Buffer.from(shot1.data, 'base64'));
  console.log(`Saved screenshot 1 to: ${shotPath1}`);

  // Test Pause with P
  console.log('Testing pause...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyP', key: 'p', windowsVirtualKeyCode: 80 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyP', key: 'p', windowsVirtualKeyCode: 80 });
  await new Promise(r => setTimeout(r, 600));

  const shotPaused = await send('Page.captureScreenshot', { format: 'png' });
  const shotPausedPath = path.join(artifactDir, 'detailed_train_paused.png');
  fs.writeFileSync(shotPausedPath, Buffer.from(shotPaused.data, 'base64'));
  console.log(`Saved paused screenshot to: ${shotPausedPath}`);

  // Unpause
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyP', key: 'p', windowsVirtualKeyCode: 80 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyP', key: 'p', windowsVirtualKeyCode: 80 });
  await new Promise(r => setTimeout(r, 2000));

  // Cycle skin to Midnight Gold
  console.log('Cycling skin to Midnight Gold...');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyT', key: 't', windowsVirtualKeyCode: 84 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyT', key: 't', windowsVirtualKeyCode: 84 });
  await new Promise(r => setTimeout(r, 1500));

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const shotPath2 = path.join(artifactDir, 'detailed_train_midnight.png');
  fs.writeFileSync(shotPath2, Buffer.from(shot2.data, 'base64'));
  console.log(`Saved screenshot 2 to: ${shotPath2}`);

  console.log(`Console logs captured: ${consoleLogs.length}`);
  if (consoleLogs.length > 0) {
    console.log('Recent logs:', consoleLogs.slice(-5));
  }

  ws.close();
  console.log('Test completed successfully!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
