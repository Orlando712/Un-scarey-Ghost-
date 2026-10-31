// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9347;
const TARGET_URL = 'http://127.0.0.1:8080/prototype';
const ARTIFACT_DIR = '/Users/chaitra/.gemini/antigravity/brain/72ada52c-a880-4b8e-8c91-be8c5002e748';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(data.error);
          else cb.resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Frame Captured] -> ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function recordGameplayLoop() {
  console.log('Starting Gameplay Recording: Hiding → Reveal → Reaction → Clean Retry...');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/chrome_cdp_record_loop_profile',
    '--window-size=1080,820',
    TARGET_URL
  ]);

  let cdp = null;

  try {
    let pages = null;
    let appPage = null;
    for (let i = 0; i < 35; i++) {
      await sleep(300);
      try {
        pages = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        if (pages && pages.length > 0) {
          appPage = pages.find(p => p.type === 'page' && (p.url.includes('prototype') || p.title.includes('Boo')));
          if (appPage) break;
        }
      } catch (e) {}
    }
    if (!appPage && pages && pages.length > 0) {
      appPage = pages.find(p => p.type === 'page') || pages[0];
    }

    cdp = new CDPClient(appPage.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    console.log('Waiting for scene initialization...');
    await sleep(2000);

    // Enter carnival
    await cdp.eval(`document.getElementById('enterCarnivalBtn').click()`);
    await sleep(4800); // Barnaby walks onto walkway

    // Start plan: Hide behind booth, then spooky boo
    await cdp.eval(`(() => {
      const input = document.getElementById('coachInput');
      input.value = "Hide behind the ticket booth, then spooky boo";
      document.getElementById('coachBtn').click();
    })()`);

    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const isRec = await cdp.eval(`!document.getElementById('panelRecording').classList.contains('hidden')`);
      if (isRec) break;
    }

    await cdp.eval(`document.getElementById('defaultSoundBtn').click()`);

    // FRAME 1: Hiding Behind Booth (Concealed, Barnaby Approaching)
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      const isConcealed = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).isGhostConcealed`);
      if (isConcealed) break;
    }
    // Wait until Barnaby is mid-walkway around X = 480
    for (let i = 0; i < 35; i++) {
      await sleep(100);
      const bx = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (bx <= 520 && bx >= 400) break;
    }
    await cdp.captureScreenshot('record_1_hiding.png');

    // FRAME 2: Reveal Emerge (Ghost Leaping into Window)
    for (let i = 0; i < 40; i++) {
      await sleep(80);
      const bx = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (bx <= 210 && bx >= 120) {
        await cdp.eval(`document.getElementById('booTriggerBtn').click()`);
        break;
      }
    }
    await sleep(350); // Ghost rising to window, Barnaby beginning leap
    await cdp.captureScreenshot('record_2_reveal.png');

    // FRAME 3: Reaction & Dropped Ticket Payoff
    await sleep(1400); // Leap landed, dropped ticket resting on ground, character response visible
    await cdp.captureScreenshot('record_3_reaction.png');

    // FRAME 4: Clean Retry (Try Timing Again)
    await cdp.eval(`document.getElementById('tryAgainBtn').click()`);
    await sleep(400); // Scene cleanly reset, dropped ticket gone, ghost traveling to position
    await cdp.captureScreenshot('record_4_clean_retry.png');

    console.log('Gameplay Recording sequence captured successfully!');
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
  }
}

recordGameplayLoop().catch(err => {
  console.error('Recording failed:', err);
  process.exit(1);
});
