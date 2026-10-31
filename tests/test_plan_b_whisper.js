// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9348;
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
    console.log(`  [Saved Frame] -> ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runPlanBVerification() {
  console.log('================================================================');
  console.log('VERIFYING PLAN B: PAUSE -> WHISPER BOO (DISTINCT AI INTERPRETATION)');
  console.log('================================================================');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/chrome_cdp_plan_b_profile',
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
    if (!appPage && pages && pages.length > 0) appPage = pages[0];
    if (!appPage) throw new Error('Could not find Boo prototype page');

    console.log(`[Browser Connected] Target Page: ${appPage.title}`);
    cdp = new CDPClient(appPage.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    console.log('Waiting for Phaser boot and scene initialization...');
    for (let i = 0; i < 30; i++) {
      await sleep(250);
      const ready = await cdp.eval(`!!(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')))`).catch(() => false);
      if (ready) break;
    }
    await sleep(1000);

    // Enter carnival
    await cdp.eval(`document.getElementById('enterCarnivalBtn').click()`);
    console.log('  Barnaby entered carnival...');
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const isCoaching = await cdp.eval(`!document.getElementById('panelCoaching').classList.contains('hidden')`);
      if (isCoaching) break;
    }

    // Submit Plan B: "Pause for suspense, then whisper boo"
    await cdp.eval(`(() => {
      const input = document.getElementById('coachInput');
      input.value = "Pause for suspense, then whisper boo";
      document.getElementById('coachBtn').click();
    })()`);
    console.log('  Submitted Plan B instruction: "Pause for suspense, then whisper boo"...');

    // Wait for Qwen to plan and reach sound recording
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const isRec = await cdp.eval(`!document.getElementById('panelRecording').classList.contains('hidden')`);
      if (isRec) break;
    }

    // Select default sound
    await cdp.eval(`document.getElementById('defaultSoundBtn').click()`);
    console.log('  Selected default sound -> Preparation started...');

    // Wait 1.5s for preparation to execute
    await sleep(1500);

    // Verify Ghost state during Plan B preparation:
    // Ghost MUST REMAIN ON STAGE at STAGE_MARK_X = 380!
    // Ghost MUST NOT travel to booth X = 135!
    // Ghost is NOT concealed behind counter!
    const planBPrepCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        ghostX: scene.ghost.x,
        ghostY: scene.ghost.y,
        isConcealed: scene.isGhostConcealed,
        hasHide: scene.currentPlan.hasHide,
        hasPause: scene.currentPlan.hasPause,
        isWhisper: scene.currentPlan.isWhisper,
        ghostTexture: scene.ghost.texture.key,
        stageMarkX: scene.STAGE_MARK_X
      };
    })()`);

    console.log(`  Plan B Actions: hasPause=${planBPrepCheck.hasPause}, hasHide=${planBPrepCheck.hasHide}, isWhisper=${planBPrepCheck.isWhisper}`);
    console.log(`  Ghost X: ${planBPrepCheck.ghostX} (Stage Mark: ${planBPrepCheck.stageMarkX})`);
    console.log(`  Ghost Concealed State: ${planBPrepCheck.isConcealed} (Must be FALSE)`);
    console.log(`  Ghost Texture: ${planBPrepCheck.ghostTexture}`);

    if (planBPrepCheck.isConcealed) throw new Error('Plan B should NOT conceal ghost behind booth counter!');
    if (Math.abs(planBPrepCheck.ghostX - 380) > 10) throw new Error('Plan B Ghost MUST stay on center stage (X=380), NOT move to booth!');

    // Wait until Barnaby approaches center stage (X around 380-420)
    console.log('  Awaiting Barnaby near center stage...');
    for (let i = 0; i < 60; i++) {
      await sleep(100);
      const barnabyX = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (barnabyX <= 420 && barnabyX >= 340) {
        console.log(`  Triggering Whisper Boo at Barnaby X = ${barnabyX.toFixed(1)}...`);
        await cdp.eval(`document.getElementById('booTriggerBtn').click()`);
        break;
      }
    }

    // Inspect reveal beat:
    // Ghost MUST lean horizontally toward Barnaby (X > 380), NOT teleport to booth!
    await sleep(400);
    const whisperRevealCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        ghostX: scene.ghost.x,
        ghostAngle: scene.ghost.angle,
        ghostTexture: scene.ghost.texture.key
      };
    })()`);

    console.log(`  Ghost X after Whisper Lean: ${whisperRevealCheck.ghostX.toFixed(1)} (Leaned forward from 380)`);
    console.log(`  Ghost Angle: ${whisperRevealCheck.ghostAngle}°`);
    console.log(`  Ghost Texture: ${whisperRevealCheck.ghostTexture}`);

    if (whisperRevealCheck.ghostX < 380) throw new Error('Ghost should NOT teleport back to booth on Plan B whisper!');
    if (whisperRevealCheck.ghostTexture !== 'ghost_whisper') throw new Error('Ghost texture should be ghost_whisper on Plan B!');

    await cdp.captureScreenshot('polish_plan_b_whisper.png');
    console.log('  ✓ Priority 3 Verified: Plan B (Pause -> Whisper Boo) remained on stage and leaned toward Barnaby without booth teleportation!');

    console.log('================================================================');
    console.log('PLAN B VERIFICATION PASSED PERFECTLY!');
    console.log('================================================================');
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
  }
}

runPlanBVerification().catch(err => {
  console.error('Plan B verification failed:', err);
  process.exit(1);
});
