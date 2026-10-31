// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9345;
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
    console.log(`[Screenshot Saved] -> ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('Capturing Phaser Prototype Gameplay Screenshots via Chrome CDP...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/chrome_cdp_proto_ss_9345',
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

    console.log(`[Connected] Page: ${appPage.title} (${appPage.url})`);
    cdp = new CDPClient(appPage.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    console.log('Waiting for DOM and Phaser scene...');
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const hasBtn = await cdp.eval(`!!document.getElementById('enterCarnivalBtn')`);
        if (hasBtn) break;
      } catch (e) {}
    }
    await sleep(1500);

    // SCREENSHOT 1: Arrival & Coaching state
    await cdp.eval(`document.getElementById('enterCarnivalBtn').click()`);
    console.log('Clicked "Enter Carnival"... waiting for arrival sequence...');
    await sleep(4800); // Barnaby walks onto walkway
    await cdp.captureScreenshot('phaser_prototype_arrival.png');

    // SCREENSHOT 2: Ghost Concealed Behind Ticket Booth Counter, Barnaby Approaching
    await cdp.eval(`document.getElementById('quickDevPlayBtn').click()`);
    console.log('Triggered Quick Dev Plan... waiting for ghost to travel to booth and sink behind counter...');
    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const isConcealed = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).isGhostConcealed`);
      if (isConcealed) break;
    }
    // Wait until Barnaby is walking into view around X = 450
    for (let i = 0; i < 40; i++) {
      await sleep(100);
      const barnabyX = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (barnabyX <= 500 && barnabyX >= 350) break;
    }
    await cdp.captureScreenshot('phaser_prototype_concealed_approach.png');

    // SCREENSHOT 3: Well-Timed Scare Payoff
    console.log('Awaiting sweet spot (80 <= X <= 255) for well-timed scare...');
    for (let i = 0; i < 60; i++) {
      await sleep(80);
      const barnabyX = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (barnabyX <= 220 && barnabyX >= 120) {
        await cdp.eval(`document.getElementById('booTriggerBtn').click()`);
        break;
      }
    }
    // Wait for reveal and leap animations to settle into outcome screen
    await sleep(2500);
    await cdp.captureScreenshot('phaser_prototype_scare_payoff.png');

    console.log('All screenshots captured successfully!');
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
  }
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
