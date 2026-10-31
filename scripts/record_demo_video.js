// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9345;
const TARGET_URL = 'http://127.0.0.1:8080/prototype';
const FRAMES_DIR = '/tmp/boo_demo_frames';
const OUTPUT_VIDEO = path.join(__dirname, '../docs/demo_gameplay.mp4');

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
    this.eventListeners = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = evt => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        } else if (msg.method && this.eventListeners.has(msg.method)) {
          this.eventListeners.get(msg.method)(msg.params);
        }
      };
    });
  }

  on(method, handler) {
    this.eventListeners.set(method, handler);
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function recordDemoVideo() {
  console.log('================================================================');
  console.log('RECORDING HIGH-DEFINITION DEMO VIDEO FOR SUBMISSION');
  console.log('================================================================\n');

  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/chrome_demo_profile',
    '--window-size=1280,720',
    '--disable-gpu',
    '--no-sandbox',
    TARGET_URL
  ]);

  let cdp = null;
  let frameIndex = 0;

  try {
    let pages = null;
    let appPage = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        pages = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        if (pages && pages.length > 0) {
          appPage = pages.find(p => p.type === 'page');
          if (appPage) break;
        }
      } catch (e) {}
    }

    if (!appPage) throw new Error('Could not connect to Chrome page');

    cdp = new CDPClient(appPage.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Setup Screencast frame capture
    cdp.on('Page.screencastFrame', async params => {
      const idx = String(frameIndex++).padStart(5, '0');
      const filename = path.join(FRAMES_DIR, `frame_${idx}.jpg`);
      fs.writeFileSync(filename, Buffer.from(params.data, 'base64'));
      try {
        await cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId });
      } catch (e) {}
    });

    console.log('Starting screencast recording at 24fps...');
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 90,
      maxWidth: 1280,
      maxHeight: 800,
      everyNthFrame: 1
    });

    // Scene 1: Intro view
    console.log('[0:00] Showing Intro screen...');
    await sleep(2500);

    // Click Enter Carnival
    console.log('[0:03] Entering Carnival courtyard...');
    await cdp.eval(`document.getElementById('enterCarnivalBtn').click()`);

    // Barnaby walks in
    for (let i = 0; i < 35; i++) {
      await sleep(200);
      const isCoaching = await cdp.eval(`!document.getElementById('panelCoaching').classList.contains('hidden')`);
      if (isCoaching) break;
    }
    await sleep(1500);

    // Scene 2: Natural Text Coaching
    console.log('[0:12] Entering coaching instruction...');
    const instruction = "Hide behind the ticket booth, then jump out with a loud boo";
    await cdp.eval(`(() => {
      const inp = document.getElementById('coachInput');
      inp.value = ${JSON.stringify(instruction)};
    })()`);
    await sleep(1200);

    console.log('[0:15] Submitting instruction to Qwen on UNO Q...');
    await cdp.eval(`document.getElementById('coachBtn').click()`);

    // Await Qwen inference
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const isRec = await cdp.eval(`!document.getElementById('panelRecording').classList.contains('hidden')`);
      if (isRec) break;
    }
    await sleep(1500);

    // Scene 3: Audio Staging
    console.log('[0:22] Selecting synthesized spooky vocal audio...');
    await cdp.eval(`document.getElementById('defaultSoundBtn').click()`);

    // Scene 4: Preparation & Concealment behind booth
    console.log('[0:25] Ghost traveling to booth and concealing behind counter sill...');
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      const isConcealed = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).isGhostConcealed`);
      if (isConcealed) break;
    }

    // Barnaby walks towards counter
    console.log('[0:30] Barnaby approaching counter... timing the scare...');
    for (let i = 0; i < 40; i++) {
      await sleep(100);
      const bx = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (bx <= 215 && bx >= 120) {
        console.log(`[0:36] Triggering manual BOO! button at Barnaby X=${Math.round(bx)}px!`);
        await cdp.eval(`document.getElementById('booTriggerBtn').click()`);
        break;
      }
    }

    // Payoff celebration & golden ticket drop
    console.log('[0:38] Barnaby startled! Dropping Golden Ticket!');
    await sleep(4000);

    // Scene 5: Open Diagnostics Drawer to show on-board edge telemetry
    console.log('[0:45] Opening Diagnostics Drawer to display live UNO Q telemetry...');
    await cdp.eval(`(() => {
      const drawer = document.getElementById('diagnosticsDrawer');
      drawer.classList.remove('hidden');
    })()`);
    await sleep(4000);

    // Stop screencast
    console.log('Stopping screencast...');
    await cdp.send('Page.stopScreencast');
    await sleep(500);

    console.log(`Captured ${frameIndex} frames. Assembling MP4 video with ffmpeg...`);
    execSync(`/opt/homebrew/bin/ffmpeg -y -framerate 20 -i ${path.join(FRAMES_DIR, 'frame_%05d.jpg')} -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 "${OUTPUT_VIDEO}"`, { stdio: 'inherit' });

    console.log(`\n================================================================`);
    console.log(`DEMO VIDEO CREATED SUCCESSFULLY:`);
    console.log(OUTPUT_VIDEO);
    console.log(`================================================================\n`);

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
    if (fs.existsSync(FRAMES_DIR)) {
      fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    }
  }
}

recordDemoVideo().catch(err => {
  console.error('Demo video recording failed:', err);
  process.exit(1);
});
