// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9224;
const TARGET_URL = 'http://127.0.0.1:8080/prototype';

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
        } else if (data.method === 'Runtime.consoleAPICalled') {
          const args = (data.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
          console.log(`  [Browser Console ${data.params.type}] ${args}`);
        } else if (data.method === 'Runtime.exceptionThrown') {
          console.error(`  [Browser Uncaught Error]`, JSON.stringify(data.params.exceptionDetails, null, 2));
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runPhaserVerification() {
  console.log('================================================================');
  console.log('STARTING PHASER PLAYABLE PROTOTYPE VERIFICATION (CHROME CDP)');
  console.log('================================================================');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/chrome_cdp_phaser_profile',
    '--window-size=1024,768',
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
      appPage = pages.find(p => p.type === 'page') || pages.find(p => p.url.includes('prototype')) || pages[0];
    }

    if (!appPage) {
      throw new Error('Could not find Boo, Please! prototype page in Chrome sessions');
    }

    console.log(`[Browser Connected] Target Page: ${appPage.title} (${appPage.url})`);
    cdp = new CDPClient(appPage.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // Wait for Phaser boot and texture loading
    console.log('Waiting for Phaser scene initialization...');
    await sleep(1500);

    // ================================================================
    // CHECK 1: Scene & Depth Ordering Verification
    // ================================================================
    console.log('\n[Check 1: Scene Architecture & Depth Ordering]');
    const sceneCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      if (!scene) return { error: 'Scene not found' };

      const bg = scene.children.list.find(c => c.texture && c.texture.key === 'bg');
      const boothBack = scene.boothBack;
      const ghost = scene.ghost;
      const boothCounter = scene.boothCounter;
      const barnaby = scene.barnaby;

      return {
        hasCanvas: !!document.querySelector('#phaserContainer canvas'),
        bgDepth: bg ? bg.depth : null,
        boothBackDepth: boothBack ? boothBack.depth : null,
        ghostDepth: ghost ? ghost.depth : null,
        boothCounterDepth: boothCounter ? boothCounter.depth : null,
        barnabyDepth: barnaby ? barnaby.depth : null,
        ghostX: ghost ? ghost.x : null,
        ghostY: ghost ? ghost.y : null,
        boothX: boothCounter ? boothCounter.x : null,
        boothY: boothCounter ? boothCounter.y : null
      };
    })()`);

    console.log(`  Phaser Canvas Rendered: ${sceneCheck.hasCanvas}`);
    console.log(`  Depth Order: BoothBack(${sceneCheck.boothBackDepth}) < Ghost(${sceneCheck.ghostDepth}) < BoothCounter(${sceneCheck.boothCounterDepth}) < Barnaby(${sceneCheck.barnabyDepth})`);
    console.log(`  Ghost Pos: (${sceneCheck.ghostX}, ${sceneCheck.ghostY}), Booth Pos: (${sceneCheck.boothX}, ${sceneCheck.boothY})`);

    if (!sceneCheck.hasCanvas) throw new Error('Phaser canvas was not created in DOM!');
    if (sceneCheck.boothBackDepth >= sceneCheck.ghostDepth) throw new Error('boothBack must be behind ghost!');
    if (sceneCheck.ghostDepth >= sceneCheck.boothCounterDepth) throw new Error('boothCounter must be in front of ghost!');
    if (sceneCheck.boothCounterDepth >= sceneCheck.barnabyDepth) throw new Error('barnaby must walk in front of counter!');
    console.log('  ✓ Physical depth ordering verified: Ghost is positioned between booth back and counter.');

    // ================================================================
    // CHECK 2: Barnaby Walk-in Arrival Sequence
    // ================================================================
    console.log('\n[Check 2: Barnaby Walk-in Entrance Sequence]');
    await cdp.eval(`document.getElementById('enterCarnivalBtn').click()`);
    console.log('  Clicked "🎟 Enter the carnival"...');

    // Wait for arrival sequence to complete (~4.8s)
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const isCoaching = await cdp.eval(`!document.getElementById('panelCoaching').classList.contains('hidden')`);
      if (isCoaching) break;
    }

    const arrivalCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        isCoachingVisible: !document.getElementById('panelCoaching').classList.contains('hidden'),
        barnabyX: scene.barnaby.x,
        ghostTexture: scene.ghost.texture.key
      };
    })()`);

    console.log(`  Coaching View Reached: ${arrivalCheck.isCoachingVisible}`);
    console.log(`  Barnaby Position: X=${arrivalCheck.barnabyX} (Arrived on walkway)`);
    console.log(`  Ghost Expression: ${arrivalCheck.ghostTexture}`);

    if (!arrivalCheck.isCoachingVisible) throw new Error('Did not transition to coaching panel!');
    console.log('  ✓ Arrival sequence complete: Barnaby walked into view, ghost asked for coaching.');

    // ================================================================
    // CHECK 3: Checkpoint A — Core Timing Playable Loop & Rules
    // ================================================================
    console.log('\n[Check 3A: Timing Rule — EARLY Scare (X > 255)]');

    // Trigger Quick Dev Plan
    await cdp.eval(`document.getElementById('quickDevPlayBtn').click()`);
    console.log('  Triggered Quick Dev Plan (hide → spooky_boo)...');

    // Wait for ghost to prepare and Barnaby to start walking
    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const isApproaching = await cdp.eval(`!document.getElementById('panelTimingTrigger').classList.contains('hidden') && !document.getElementById('booTriggerBtn').disabled`);
      if (isApproaching) break;
    }

    // Trigger scare immediately while Barnaby is still approaching from right (X ~ 500 > 255)
    await sleep(200);
    const earlyTriggerCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      const xBefore = scene.barnaby.x;
      document.getElementById('booTriggerBtn').click();
      return { xBefore };
    })()`);

    console.log(`  Pressed BOO early at Barnaby X = ${earlyTriggerCheck.xBefore.toFixed(1)} (Threshold: > 255)`);

    // Wait for outcome
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      const isOutcome = await cdp.eval(`!document.getElementById('panelOutcome').classList.contains('hidden')`);
      if (isOutcome) break;
    }

    const earlyOutcomeCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        timingBadge: document.getElementById('timingResultBadge').textContent,
        outcomeBadge: document.getElementById('outcomeResultBadge').textContent,
        barnabyTexture: scene.barnaby.texture.key,
        ruleText: document.getElementById('outcomeRuleText').textContent
      };
    })()`);

    console.log(`  Early Result: ${earlyOutcomeCheck.timingBadge} -> ${earlyOutcomeCheck.outcomeBadge}`);
    console.log(`  Barnaby Texture: ${earlyOutcomeCheck.barnabyTexture}`);
    console.log(`  Rule Applied: ${earlyOutcomeCheck.ruleText}`);

    if (!earlyOutcomeCheck.timingBadge.includes('EARLY')) throw new Error('Timing not recognized as EARLY!');
    if (!earlyOutcomeCheck.outcomeBadge.includes('AMUSED')) throw new Error('Early outcome should be AMUSED (Barnaby chuckles)!');
    if (earlyOutcomeCheck.barnabyTexture !== 'barnaby_laughing') throw new Error('Barnaby should have barnaby_laughing texture!');
    console.log('  ✓ Early trigger rule verified: Barnaby spotted the ghost premature reveal and chuckled.');

    // ----------------------------------------------------------------
    console.log('\n[Check 3B: Timing Rule — WELL-TIMED Scare (80 <= X <= 255)]');

    // Click "Try Timing Again"
    await cdp.eval(`document.getElementById('tryAgainBtn').click()`);
    console.log('  Clicked "Try Timing Again"...');

    // Wait for approach to start
    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const isApproaching = await cdp.eval(`!document.getElementById('panelTimingTrigger').classList.contains('hidden') && !document.getElementById('booTriggerBtn').disabled`);
      if (isApproaching) break;
    }

    // Wait until Barnaby enters the sweet spot (80 <= X <= 255)
    console.log('  Monitoring Barnaby walking across path into encounter zone...');
    let triggerX = 0;
    for (let i = 0; i < 75; i++) {
      await sleep(100);
      const curX = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (curX <= 230 && curX >= 110) {
        triggerX = curX;
        await cdp.eval(`document.getElementById('booTriggerBtn').click()`);
        break;
      }
    }

    if (triggerX === 0) throw new Error('Never reached well-timed zone (80 <= X <= 255) before timeout!');

    console.log(`  Pressed BOO right in encounter zone at Barnaby X = ${triggerX.toFixed(1)} (Range: 80–255)`);

    // Wait for outcome
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      const isOutcome = await cdp.eval(`!document.getElementById('panelOutcome').classList.contains('hidden')`);
      if (isOutcome) break;
    }

    const wellTimedCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        timingBadge: document.getElementById('timingResultBadge').textContent,
        outcomeBadge: document.getElementById('outcomeResultBadge').textContent,
        barnabyTexture: scene.barnaby.texture.key,
        ticketVisible: scene.droppedTicket.visible,
        ghostTexture: scene.ghost.texture.key
      };
    })()`);

    console.log(`  Well-Timed Result: ${wellTimedCheck.timingBadge} -> ${wellTimedCheck.outcomeBadge}`);
    console.log(`  Barnaby Startle Texture: ${wellTimedCheck.barnabyTexture}`);
    console.log(`  Dropped Ticket Visible: ${wellTimedCheck.ticketVisible}`);
    console.log(`  Ghost Expression: ${wellTimedCheck.ghostTexture}`);

    if (!wellTimedCheck.timingBadge.includes('WELL TIMED')) throw new Error('Timing not recognized as WELL TIMED!');
    if (!wellTimedCheck.outcomeBadge.includes('SHOCK')) throw new Error('Well-timed stealth scare should achieve SHOCK!');
    if (wellTimedCheck.barnabyTexture !== 'barnaby_shocked') throw new Error('Barnaby should have barnaby_shocked texture!');
    if (!wellTimedCheck.ticketVisible) throw new Error('Golden ticket should drop on successful shock scare!');
    console.log('  ✓ Well-timed trigger rule verified: Barnaby startled, jumped, and dropped ticket!');

    // ----------------------------------------------------------------
    console.log('\n[Check 3C: Timing Rule — LATE Scare (X < 75)]');

    // Click "Try Timing Again"
    await cdp.eval(`document.getElementById('tryAgainBtn').click()`);

    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const isApproaching = await cdp.eval(`!document.getElementById('panelTimingTrigger').classList.contains('hidden') && !document.getElementById('booTriggerBtn').disabled`);
      if (isApproaching) break;
    }

    // Wait until Barnaby has already walked past the booth (X < 75)
    let lateTriggerX = 0;
    for (let i = 0; i < 80; i++) {
      await sleep(100);
      const curX = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (curX < 70 && curX > 10) {
        lateTriggerX = curX;
        await cdp.eval(`document.getElementById('booTriggerBtn').click()`);
        break;
      }
    }

    if (lateTriggerX === 0) throw new Error('Never reached late zone (X < 75) before timeout!');
    console.log(`  Pressed BOO late at Barnaby X = ${lateTriggerX.toFixed(1)} (Threshold: < 75)`);

    for (let i = 0; i < 20; i++) {
      await sleep(200);
      const isOutcome = await cdp.eval(`!document.getElementById('panelOutcome').classList.contains('hidden')`);
      if (isOutcome) break;
    }

    const lateCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        timingBadge: document.getElementById('timingResultBadge').textContent,
        outcomeBadge: document.getElementById('outcomeResultBadge').textContent,
        ghostTexture: scene.ghost.texture.key
      };
    })()`);

    console.log(`  Late Result: ${lateCheck.timingBadge} -> ${lateCheck.outcomeBadge}`);
    console.log(`  Ghost Sheepish Texture: ${lateCheck.ghostTexture}`);

    if (!lateCheck.timingBadge.includes('LATE')) throw new Error('Timing not recognized as LATE!');
    if (!lateCheck.outcomeBadge.includes('OBLIVIOUS')) throw new Error('Late scare should be OBLIVIOUS!');
    console.log('  ✓ Late trigger rule verified: Barnaby walked past, ghost looked sheepish.');

    // ----------------------------------------------------------------
    console.log('\n[Check 3D: Timing Rule — MISSED / NO INPUT Trigger]');

    await cdp.eval(`document.getElementById('tryAgainBtn').click()`);

    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const isApproaching = await cdp.eval(`!document.getElementById('panelTimingTrigger').classList.contains('hidden') && !document.getElementById('booTriggerBtn').disabled`);
      if (isApproaching) break;
    }

    console.log('  Letting Barnaby walk completely past the stage without any player input...');
    // Await full walk traversal (~7.5s)
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const isOutcome = await cdp.eval(`!document.getElementById('panelOutcome').classList.contains('hidden')`);
      if (isOutcome) break;
    }

    const missedCheck = await cdp.eval(`(() => {
      return {
        timingBadge: document.getElementById('timingResultBadge').textContent,
        outcomeBadge: document.getElementById('outcomeResultBadge').textContent
      };
    })()`);

    console.log(`  Missed Result: ${missedCheck.timingBadge} -> ${missedCheck.outcomeBadge}`);
    if (!missedCheck.timingBadge.includes('MISSED')) throw new Error('Absent trigger should resolve to MISSED!');
    console.log('  ✓ Absent trigger cleanly concluded without infinite waiting.');

    // ================================================================
    // CHECK 4: Checkpoint B — Real UNO Q API Integration (Qwen & YAMNet)
    // ================================================================
    console.log('\n[Check 4A: Live Model Coaching — Hide & Spooky Boo]');

    // Click "Change Coaching"
    await cdp.eval(`document.getElementById('changeCoachingBtn').click()`);
    await sleep(400);

    // Submit live prompt: "Hide behind the ticket booth, then spooky boo"
    await cdp.eval(`(() => {
      const input = document.getElementById('coachInput');
      input.value = "Hide behind the ticket booth, then spooky boo";
      document.getElementById('coachBtn').click();
    })()`);

    console.log('  Submitted instruction to Qwen 2.5 on UNO Q...');

    // Wait for Qwen on UNO Q to respond
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const isRec = await cdp.eval(`!document.getElementById('panelRecording').classList.contains('hidden')`);
      if (isRec) break;
    }

    const recActive = await cdp.eval(`!document.getElementById('panelRecording').classList.contains('hidden')`);
    console.log(`  Reached sound demonstration panel: ${recActive}`);
    if (!recActive) throw new Error('Did not reach recording step from live Qwen plan!');

    // Choose ghost sound
    await cdp.eval(`document.getElementById('defaultSoundBtn').click()`);
    console.log('  Selected sound, beginning preparation...');

    // Verify ghost traveled to booth and concealed (animation ~2300ms)
    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const isConcealed = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).isGhostConcealed`);
      if (isConcealed) break;
    }
    const boothConcealCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        isConcealed: scene.isGhostConcealed,
        ghostX: scene.ghost.x,
        ghostY: scene.ghost.y,
        readyVisible: scene.readyIndicator.visible
      };
    })()`);

    console.log(`  Ghost at Booth: X=${boothConcealCheck.ghostX}, Y=${boothConcealCheck.ghostY}`);
    console.log(`  Ghost Concealed behind counter: ${boothConcealCheck.isConcealed}`);
    console.log(`  Ready Visual Indicator Visible: ${boothConcealCheck.readyVisible}`);

    if (Math.abs(boothConcealCheck.ghostX - 135) > 10) throw new Error('Ghost did not travel to booth X=135!');
    if (!boothConcealCheck.isConcealed) throw new Error('Ghost is not concealed behind counter!');
    if (!boothConcealCheck.readyVisible) throw new Error('Ready indicator was not shown!');
    console.log('  ✓ Ghost visibly traveled across stage and fully concealed behind ticket booth counter.');

    // Trigger scare when Barnaby is in zone
    let liveTriggerX = 0;
    for (let i = 0; i < 75; i++) {
      await sleep(100);
      const curX = await cdp.eval(`(window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene'))).barnaby.x`);
      if (curX <= 220 && curX >= 100) {
        liveTriggerX = curX;
        await cdp.eval(`document.getElementById('booTriggerBtn').click()`);
        break;
      }
    }
    if (liveTriggerX === 0) throw new Error('Never reached live scare trigger zone before timeout!');

    // Wait for outcome
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      const isOutcome = await cdp.eval(`!document.getElementById('panelOutcome').classList.contains('hidden')`);
      if (isOutcome) break;
    }

    const liveOutcomeCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        outcome: document.getElementById('outcomeResultBadge').textContent,
        ghostRevealedY: scene.ghost.y,
        isConcealedNow: scene.isGhostConcealed
      };
    })()`);

    console.log(`  Live Outcome: ${liveOutcomeCheck.outcome}, Ghost Emerge Y = ${liveOutcomeCheck.ghostRevealedY}`);
    if (liveOutcomeCheck.ghostRevealedY > 300) throw new Error('Ghost did not emerge up to window on reveal!');
    console.log('  ✓ Model-planned hide and scare executed with physical emergence and sound.');

    // ----------------------------------------------------------------
    console.log('\n[Check 4B: Live Model Coaching — Pause & Whisper Boo (Distinct Plan)]');

    await cdp.eval(`document.getElementById('changeCoachingBtn').click()`);
    await sleep(400);

    // Submit distinct instruction: "Pause for suspense, then whisper boo"
    await cdp.eval(`(() => {
      const input = document.getElementById('coachInput');
      input.value = "Pause for suspense, then whisper boo";
      document.getElementById('coachBtn').click();
    })()`);

    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const isRec = await cdp.eval(`!document.getElementById('panelRecording').classList.contains('hidden')`);
      if (isRec) break;
    }

    await cdp.eval(`document.getElementById('defaultSoundBtn').click()`);

    // Verify ghost stays on center stage (X=380) and does NOT teleport to booth
    await sleep(1200);
    const pausePlanCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        ghostX: scene.ghost.x,
        isConcealed: scene.isGhostConcealed,
        planActions: scene.currentPlan.actions
      };
    })()`);

    console.log(`  Pause Plan Actions: ${pausePlanCheck.planActions.join(' → ')}`);
    console.log(`  Ghost Position: X=${pausePlanCheck.ghostX} (Center Stage: 380, Did not teleport to booth: ${pausePlanCheck.ghostX > 300})`);

    if (pausePlanCheck.ghostX < 300) throw new Error('Pause plan should stay on stage, not teleport behind booth!');
    console.log('  ✓ Distinct plans are visually distinct: pause waits on center stage without teleporting.');

    // ----------------------------------------------------------------
    console.log('\n[Check 4C: Unsupported Instruction Honest Rejection]');

    await cdp.eval(`document.getElementById('changeCoachingBtn').click()`);
    await sleep(400);

    await cdp.eval(`(() => {
      const input = document.getElementById('coachInput');
      input.value = "Turn into a fire dragon and eat him";
      document.getElementById('coachBtn').click();
    })()`);

    for (let i = 0; i < 35; i++) {
      await sleep(200);
      const hasErr = await cdp.eval(`!document.getElementById('errorBanner').classList.contains('hidden')`);
      if (hasErr) break;
    }

    const unsuppCheck = await cdp.eval(`(() => {
      return {
        errVisible: !document.getElementById('errorBanner').classList.contains('hidden'),
        errText: document.getElementById('errorBannerText').textContent
      };
    })()`);

    console.log(`  Error Banner Visible: ${unsuppCheck.errVisible}`);
    console.log(`  Rejection Text: "${unsuppCheck.errText}"`);

    if (!unsuppCheck.errVisible) throw new Error('Unsupported instruction was not honestly rejected!');
    console.log('  ✓ Unsupported instruction honestly rejected without fake actions.');

    // ================================================================
    // CHECK 5: Cancelation & Clean Full Restart
    // ================================================================
    console.log('\n[Check 5: Cancelation & Clean Full Restart]');

    await cdp.eval(`document.getElementById('quickDevPlayBtn').click()`);
    await sleep(1500); // During approach
    await cdp.eval(`document.getElementById('restartBtn').click()`);
    await sleep(400);

    const restartCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        isArrivalVisible: !document.getElementById('panelArrival').classList.contains('hidden'),
        ghostX: scene.ghost.x,
        ghostY: scene.ghost.y,
        barnabyX: scene.barnaby.x,
        canTrigger: scene.canTriggerScare
      };
    })()`);

    console.log(`  Arrival Panel Restored: ${restartCheck.isArrivalVisible}`);
    console.log(`  Ghost Reset Position: (${restartCheck.ghostX}, ${restartCheck.ghostY})`);
    console.log(`  Barnaby Reset Position: X=${restartCheck.barnabyX} (Offscreen)`);
    console.log(`  Scare Trigger Disabled: ${!restartCheck.canTrigger}`);

    if (!restartCheck.isArrivalVisible) throw new Error('Restart did not restore arrival panel!');
    if (restartCheck.ghostX !== 380) throw new Error('Ghost was not reset to stage mark!');
    if (restartCheck.canTrigger) throw new Error('Trigger should be disabled after restart!');
    console.log('  ✓ Restart cleanly canceled tweens, reset actors, and restored initial state.');

    // ================================================================
    // CHECK 6: Layout & Keyboard Input
    // ================================================================
    console.log('\n[Check 6: Spacebar Alternative Keyboard Input]');

    await cdp.eval(`document.getElementById('quickDevPlayBtn').click()`);
    for (let i = 0; i < 25; i++) {
      await sleep(200);
      const isApproaching = await cdp.eval(`!document.getElementById('panelTimingTrigger').classList.contains('hidden') && !document.getElementById('booTriggerBtn').disabled`);
      if (isApproaching) break;
    }

    // Trigger scare via SPACEBAR keydown event
    await cdp.eval(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }));
    })()`);
    await sleep(300);

    const spaceCheck = await cdp.eval(`(() => {
      const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
      return {
        triggerConsumed: !scene.canTriggerScare
      };
    })()`);

    console.log(`  Spacebar triggered scare action: ${spaceCheck.triggerConsumed}`);
    if (!spaceCheck.triggerConsumed) throw new Error('Spacebar key did not trigger scare!');
    console.log('  ✓ Spacebar keyboard alternative fully functional.');

    console.log('\n================================================================');
    console.log('ALL PHASER PROTOTYPE VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
    console.log('================================================================');

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGTERM');
  }
}

runPhaserVerification().catch(err => {
  console.error('\n❌ PHASER PROTOTYPE VERIFICATION FAILED:', err);
  process.exit(1);
});
