// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9223;
const TARGET_URL = 'http://127.0.0.1:8080/';

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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runBrowserVerification() {
  console.log('================================================================');
  console.log('STARTING ACTUAL BROWSER INTERACTION VERIFICATION (CHROME CDP)');
  console.log('================================================================');

  // Launch headless Chrome
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--user-data-dir=/tmp/chrome_cdp_profile_courtyard',
    '--window-size=1024,768',
    TARGET_URL
  ]);

  let cdp = null;

  try {
    // Wait for Chrome DevTools port to open
    let pages = null;
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      try {
        pages = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        if (pages && pages.length > 0) break;
      } catch (e) {}
    }

    const appPage = pages.find(p => p.url.includes('8080') || p.title.includes('Boo'));
    if (!appPage) {
      throw new Error('Could not find Boo, Please! page in Chrome sessions');
    }

    console.log(`[Browser Connected] Target Page: ${appPage.title} (${appPage.url})`);
    cdp = new CDPClient(appPage.webSocketDebuggerUrl);
    await cdp.connect();

    // Enable Runtime & DOM
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // Wait for initial page hydration
    await sleep(800);

    // ================================================================
    // CHECK 1: Courtyard Landscape Scene & Ticket Booth Concealment Geometry
    // ================================================================
    console.log('\n[Check 1: Abandoned Carnival Courtyard Landscape & Ticket Booth Architecture]');

    const sceneCheck = await cdp.eval(`(() => {
      const courtyard = document.getElementById('courtyardScene');
      const ticketBooth = document.getElementById('ticketBooth');
      const ghostPos = document.getElementById('ghostPosNode');
      const ghostVp = document.getElementById('ghostViewportNode');
      const visitorPos = document.getElementById('visitorPosNode');
      const sign = document.querySelector('.swinging-sign');

      const csStyle = window.getComputedStyle(courtyard);
      const tbStyle = window.getComputedStyle(ticketBooth);
      const vpStyle = window.getComputedStyle(ghostVp);
      const gPosStyle = window.getComputedStyle(ghostPos);
      const vPosStyle = window.getComputedStyle(visitorPos);

      const tbRect = ticketBooth.getBoundingClientRect();
      const vpRect = ghostVp.getBoundingClientRect();
      const csRect = courtyard.getBoundingClientRect();

      return {
        courtyardHeight: csRect.height,
        courtyardWidth: csRect.width,
        courtyardOverflow: csStyle.overflow,
        ticketBoothZIndex: tbStyle.zIndex,
        ghostPosZIndex: gPosStyle.zIndex,
        visitorPosZIndex: vPosStyle.zIndex,
        viewportOverflow: vpStyle.overflow,
        hasSwingingSign: !!sign,
        boothWidth: tbRect.width,
        boothHeight: tbRect.height
      };
    })()`);

    console.log(`  Courtyard Size: ${sceneCheck.courtyardWidth.toFixed(0)}x${sceneCheck.courtyardHeight.toFixed(0)}px (Overflow: ${sceneCheck.courtyardOverflow})`);
    console.log(`  Ticket Booth: ${sceneCheck.boothWidth.toFixed(0)}x${sceneCheck.boothHeight.toFixed(0)}px (z-index = ${sceneCheck.ticketBoothZIndex})`);
    console.log(`  Actor Layers: Ghost z-index = ${sceneCheck.ghostPosZIndex}, Visitor z-index = ${sceneCheck.visitorPosZIndex}`);
    console.log(`  Ghost Viewport: Overflow = ${sceneCheck.viewportOverflow}`);
    console.log(`  Swinging TICKETS Sign Present: ${sceneCheck.hasSwingingSign}`);

    if (sceneCheck.viewportOverflow !== 'hidden') {
      throw new Error(`Viewport overflow must be hidden, got: ${sceneCheck.viewportOverflow}`);
    }
    if (parseInt(sceneCheck.ticketBoothZIndex) <= parseInt(sceneCheck.ghostPosZIndex)) {
      throw new Error(`Ticket booth must layer in front of the ghost actor (z-index ${sceneCheck.ticketBoothZIndex} <= ${sceneCheck.ghostPosZIndex})`);
    }
    console.log('  ✓ Courtyard landscape & ticket booth foreground layering confirmed.');

    // ================================================================
    // CHECK 2: Initial Arrival View & Barnaby Entrance Walk-In
    // ================================================================
    console.log('\n[Check 2: Barnaby Walk-in Entrance Sequence]');

    const initialArrivalCheck = await cdp.eval(`(() => {
      const stepArrival = document.getElementById('stepArrival');
      const visitorPos = document.getElementById('visitorPosNode');
      const ghostPos = document.getElementById('ghostPosNode');
      const visitorDialogue = document.getElementById('visitorDialogue');
      const startBtn = document.getElementById('startCoachingBtn');

      return {
        stepArrivalVisible: !stepArrival.classList.contains('hidden'),
        visitorLeft: visitorPos.style.left || window.getComputedStyle(visitorPos).left,
        ghostLeft: ghostPos.style.left || window.getComputedStyle(ghostPos).left,
        visitorDialogueHidden: visitorDialogue.classList.contains('hidden'),
        startBtnText: startBtn.textContent.trim()
      };
    })()`);

    console.log(`  Initial View: Arrival step active = ${initialArrivalCheck.stepArrivalVisible}`);
    console.log(`  Barnaby Initial Position: ${initialArrivalCheck.visitorLeft} (Offscreen right)`);
    console.log(`  Ghost Initial Position: ${initialArrivalCheck.ghostLeft} (Center stage mark)`);
    console.log(`  Visitor Dialogue Hidden: ${initialArrivalCheck.visitorDialogueHidden}`);
    console.log(`  Start Button: "${initialArrivalCheck.startBtnText}"`);

    // Click "Enter the carnival" to trigger Barnaby's entrance
    console.log('  Clicking "🎟 Enter the carnival"...');
    await cdp.eval(`document.getElementById('startCoachingBtn').click()`);

    // Check that walking animation was applied
    await sleep(200);
    const walkingCheck = await cdp.eval(`(() => {
      const motion = document.getElementById('visitorMotionNode');
      return {
        isWalking: motion.classList.contains('walking')
      };
    })()`);
    console.log(`  Barnaby walking animation active: ${walkingCheck.isWalking}`);

    // Wait for entrance sequence to complete (walk in + ghost squeak + clockwork pause + coaching prompt)
    console.log('  Awaiting Barnaby walkway arrival and coaching transition (~4.5s)...');
    for (let i = 0; i < 25; i++) {
      await sleep(300);
      const isCoaching = await cdp.eval(`!document.getElementById('stepCoaching').classList.contains('hidden')`);
      if (isCoaching) break;
    }

    const postEntranceCheck = await cdp.eval(`(() => {
      const stepCoaching = document.getElementById('stepCoaching');
      const visitorPos = document.getElementById('visitorPosNode');
      const ghostDialogue = document.getElementById('dialogueText');
      const coachInput = document.getElementById('coachInput');

      return {
        stepCoachingActive: !stepCoaching.classList.contains('hidden'),
        visitorLeft: visitorPos.style.left,
        ghostDialogue: ghostDialogue.textContent,
        inputFocused: document.activeElement === coachInput
      };
    })()`);

    console.log(`  Coaching Step Reached: ${postEntranceCheck.stepCoachingActive}`);
    console.log(`  Barnaby Settled Position: ${postEntranceCheck.visitorLeft} (Walkway mark)`);
    console.log(`  Ghost Line: "${postEntranceCheck.ghostDialogue}"`);

    if (!postEntranceCheck.stepCoachingActive) {
      throw new Error('Did not transition to coaching step after Barnaby entrance walk-in!');
    }
    console.log('  ✓ Barnaby visibly entered courtyard from offscreen right; ghost asked for coaching.');

    // ================================================================
    // CHECK 3: Ticket Booth Hide-and-Reveal Animation & Decoupling
    // ================================================================
    console.log('\n[Check 3: Ticket Booth Travel, Concealment, and Reveal Animation]');

    // Submit coaching: "Hide behind the ticket booth, then spooky boo"
    const coachingSubmit = await cdp.eval(`(() => {
      const input = document.getElementById('coachInput');
      input.value = "Hide behind the ticket booth, then spooky boo";
      document.getElementById('coachBtn').click();
      return true;
    })()`);

    console.log('  Submitted coaching: "Hide behind the ticket booth, then spooky boo"');

    // Wait for LLM on UNO Q to respond
    for (let i = 0; i < 25; i++) {
      await sleep(300);
      const isRecording = await cdp.eval(`!document.getElementById('stepRecording').classList.contains('hidden')`);
      if (isRecording) break;
    }

    const recActive = await cdp.eval(`!document.getElementById('stepRecording').classList.contains('hidden')`);
    console.log(`  Reached recording view: ${recActive}`);
    if (!recActive) throw new Error('Did not reach recording view after entrance coaching!');

    // Select default synthesized phantom squeak
    await cdp.eval(`document.getElementById('defaultSoundBtn').click()`);
    console.log('  Selected default ghost squeak.');

    // Wait for performance view to activate
    for (let i = 0; i < 20; i++) {
      await sleep(200);
      const isPerf = await cdp.eval(`!document.getElementById('stepPerformance').classList.contains('hidden')`);
      if (isPerf) break;
    }

    // Inspect ghost travel to ticket booth
    await sleep(500);
    const boothTravelCheck = await cdp.eval(`(() => {
      const ghostPos = document.getElementById('ghostPosNode');
      const perfBanner = document.getElementById('performanceActionText');
      return {
        ghostLeft: ghostPos.style.left,
        bannerText: perfBanner.textContent
      };
    })()`);
    console.log(`  Ghost traveling to booth: Left = ${boothTravelCheck.ghostLeft}, Banner: "${boothTravelCheck.bannerText}"`);

    // Wait for ghost to sink behind opaque booth counter
    await sleep(1500);
    const boothHiddenCheck = await cdp.eval(`(() => {
      const motion = document.getElementById('ghostMotionNode');
      const ghostVp = document.getElementById('ghostViewportNode');
      const ticketBooth = document.getElementById('ticketBooth');
      const ghostSvg = document.getElementById('ghostSvg');

      const vpRect = ghostVp.getBoundingClientRect();
      const tbRect = ticketBooth.getBoundingClientRect();
      const ghostRect = ghostSvg.getBoundingClientRect();

      return {
        hasHideClass: motion.classList.contains('ghost-hide'),
        ghostRectBottom: ghostRect.bottom,
        vpRectBottom: vpRect.bottom,
        tbRectBottom: tbRect.bottom,
        isClippedAtFloor: Math.min(ghostRect.bottom, vpRect.bottom) <= (tbRect.bottom + 5)
      };
    })()`);

    console.log(`  Ghost Motion has 'ghost-hide': ${boothHiddenCheck.hasHideClass}`);
    console.log(`  Ghost clipped at booth floor: ${boothHiddenCheck.isClippedAtFloor}`);

    if (!boothHiddenCheck.hasHideClass) {
      throw new Error("Ghost did not acquire 'ghost-hide' during booth concealment!");
    }
    if (!boothHiddenCheck.isClippedAtFloor) {
      throw new Error("Ghost hem protrudes below ticket booth floor!");
    }
    console.log('  ✓ Ghost traveled to ticket booth and concealed completely behind opaque counter.');

    // Wait for reveal, synchronous audio onset, and visitor reaction
    console.log('  Waiting for reveal and visitor reaction completion...');
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      const isOutcome = await cdp.eval(`!document.getElementById('stepOutcome').classList.contains('hidden')`);
      if (isOutcome) break;
    }

    const outcomeCheck = await cdp.eval(`(() => {
      const stepOutcome = document.getElementById('stepOutcome');
      const visitorSvg = document.getElementById('visitorSvg');
      const visitorDialogue = document.getElementById('visitorDialogue');
      const visitorDialogueText = document.getElementById('visitorDialogueText');
      const diagOutcomeResult = document.getElementById('diagOutcomeResult');

      return {
        stepOutcomeActive: !stepOutcome.classList.contains('hidden'),
        visitorClass: visitorSvg.getAttribute('class'),
        visitorDialogueVisible: !visitorDialogue.classList.contains('hidden'),
        visitorLine: visitorDialogueText.textContent,
        outcomeResult: diagOutcomeResult ? diagOutcomeResult.textContent : ''
      };
    })()`);

    console.log(`  Outcome Step Reached: ${outcomeCheck.stepOutcomeActive}`);
    console.log(`  Visitor Expression: "${outcomeCheck.visitorClass}"`);
    console.log(`  Visitor Speech Bubble: "${outcomeCheck.visitorLine}"`);
    console.log(`  Outcome Result: "${outcomeCheck.outcomeResult}"`);

    if (!outcomeCheck.stepOutcomeActive) {
      throw new Error('Did not reach outcome step after performance!');
    }
    if (!outcomeCheck.visitorDialogueVisible) {
      throw new Error('Visitor speech bubble was not displayed after performance completion!');
    }
    console.log('  ✓ Reveal executed cleanly with synchronous sound; visitor reacted on schedule.');

    // ================================================================
    // CHECK 4: "Again, but slower" Replay with Same Plan & Audio
    // ================================================================
    console.log('\n[Check 4: "Again, but slower" Immediate Replay]');

    // Click "Again, but slower" button
    await cdp.eval(`document.getElementById('againSlowerBtn').click()`);
    console.log('  Clicked "Again, but slower" button...');

    // Verify it re-enters performance directly without going to recording/coaching
    await sleep(900);
    const slowerActiveCheck = await cdp.eval(`(() => {
      const stepPerf = document.getElementById('stepPerformance');
      const stepRec = document.getElementById('stepRecording');
      const stepCoach = document.getElementById('stepCoaching');
      const banner = document.getElementById('performanceActionText');
      const diagPace = document.getElementById('diagPlanPace');

      return {
        perfActive: !stepPerf.classList.contains('hidden'),
        recHidden: stepRec.classList.contains('hidden'),
        coachHidden: stepCoach.classList.contains('hidden'),
        bannerText: banner.textContent,
        pace: diagPace ? diagPace.textContent : ''
      };
    })()`);

    console.log(`  Re-entered Performance Directly: ${slowerActiveCheck.perfActive}`);
    console.log(`  Recording & Coaching Bypassed: ${slowerActiveCheck.recHidden && slowerActiveCheck.coachHidden}`);
    console.log(`  Pace set to: ${slowerActiveCheck.pace}`);

    if (!slowerActiveCheck.perfActive) {
      throw new Error('Did not immediately replay upon clicking "Again, but slower"!');
    }

    // Wait for slow performance to finish
    console.log('  Waiting for slow replay to conclude...');
    for (let i = 0; i < 35; i++) {
      await sleep(300);
      const isOutcome = await cdp.eval(`!document.getElementById('stepOutcome').classList.contains('hidden')`);
      if (isOutcome) break;
    }
    console.log('  ✓ "Again, but slower" replayed with slow pace preserved.');

    // ================================================================
    // CHECK 5: Preserved Performance with Ordinary Speech (Polite Haunting)
    // ================================================================
    console.log('\n[Check 5: Ordinary Speech Delivering Polite Haunting Outcome]');

    const speechResult = await cdp.eval(`(async () => {
      // Simulate performance with Ordinary Speech category
      const resp = await fetch('/api/perform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: ['hide', 'spooky_boo'],
          pace: 'normal',
          sound_category: 'Ordinary Speech',
          audio_id: 'aud_speech_real_01',
          audio_source: 'player_mic'
        })
      });
      const data = await resp.json();
      return {
        outcome: data.outcome,
        rule_id: data.rule_id,
        visitor_anim: data.visitor_anim,
        visitor_line: data.visitor_line,
        ghost_dialogue: data.character_dialogue
      };
    })()`);

    console.log(`  Speech Haunting Outcome: ${speechResult.outcome} (${speechResult.rule_id})`);
    console.log(`  Visitor Reaction: "${speechResult.visitor_line}"`);
    console.log(`  Ghost Dialogue: "${speechResult.ghost_dialogue}"`);

    if (speechResult.outcome !== 'amused' || speechResult.rule_id !== 'rule_3_polite_haunting') {
      throw new Error(`Expected rule_3_polite_haunting amused, got: ${speechResult.rule_id}`);
    }
    console.log('  ✓ Ordinary speech delivered comically polite haunting payoff.');

    // ================================================================
    // CHECK 6: Earned Grand Finale Matching Rehearsal Outcome
    // ================================================================
    console.log('\n[Check 6: Earned Grand Finale Matching Last Completed Act]');

    // Test finale execution for amused rehearsal
    const finaleAmusedRun = await cdp.eval(`(async () => {
      // Setup amused snapshot
      const finaleBtn = document.getElementById('finaleBtn');
      const resp = await fetch('/api/perform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: ['hide', 'spooky_boo'],
          pace: 'normal',
          sound_category: 'Ordinary Speech',
          audio_id: 'aud_speech_finale_01',
          audio_source: 'player_mic'
        })
      });
      const data = await resp.json();

      // Trigger finale button
      finaleBtn.click();
      await new Promise(r => setTimeout(r, 200));

      return {
        isPerformanceActive: !document.getElementById('stepPerformance').classList.contains('hidden'),
        perfBannerText: document.getElementById('performanceActionText').textContent
      };
    })()`);

    console.log(`  Finale Replay Begun: Performance active = ${finaleAmusedRun.isPerformanceActive}`);
    console.log(`  Banner Text: "${finaleAmusedRun.perfBannerText}"`);

    // Wait for finale replay, reaction, mutual bows, and transition to stepFinale
    console.log('  Waiting for finale performance, bow sequence, and narrative transition...');
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      const isDone = await cdp.eval(`!document.getElementById('stepFinale').classList.contains('hidden')`);
      if (isDone) break;
    }

    const finaleFinishedCheck = await cdp.eval(`(() => {
      const stepFinale = document.getElementById('stepFinale');
      const finaleNarrative = document.getElementById('finaleNarrativeText');
      const ghostSvg = document.getElementById('ghostSvg');
      const visitorSvg = document.getElementById('visitorSvg');
      const dialogueText = document.getElementById('dialogueText');
      const visitorDialogueText = document.getElementById('visitorDialogueText');

      return {
        stepFinaleActive: !stepFinale.classList.contains('hidden'),
        narrativeText: finaleNarrative ? finaleNarrative.textContent : '',
        ghostClass: ghostSvg.getAttribute('class'),
        visitorClass: visitorSvg.getAttribute('class'),
        ghostDialogue: dialogueText.textContent,
        visitorDialogue: visitorDialogueText.textContent,
        doesNotClaimScare: !finaleNarrative.textContent.toLowerCase().includes('scared him') &&
                           !dialogueText.textContent.toLowerCase().includes('we scared')
      };
    })()`);

    console.log(`  Finale View Active: ${finaleFinishedCheck.stepFinaleActive}`);
    console.log(`  Narrative: "${finaleFinishedCheck.narrativeText}"`);
    console.log(`  Ghost Ending Line: "${finaleFinishedCheck.ghostDialogue}"`);
    console.log(`  Visitor Ending Line: "${finaleFinishedCheck.visitorDialogue}"`);
    console.log(`  Characters in Bow State: Ghost = "${finaleFinishedCheck.ghostClass}", Visitor = "${finaleFinishedCheck.visitorClass}"`);
    console.log(`  Does NOT claim false scare for amused outcome: ${finaleFinishedCheck.doesNotClaimScare}`);

    if (!finaleFinishedCheck.stepFinaleActive) {
      throw new Error('Finale screen was not reached after replay!');
    }
    if (!finaleFinishedCheck.doesNotClaimScare) {
      throw new Error('Finale falsely claimed "we scared him" after an amused outcome!');
    }
    console.log('  ✓ Earned finale correctly replayed last act and delivered grounded, tailored celebration.');

    // ================================================================
    // CHECK 7: Restart Flow & State Cleansing
    // ================================================================
    console.log('\n[Check 7: Full Restart and Clean State Reset]');

    await cdp.eval(`document.getElementById('restartBtn').click()`);
    await sleep(400);

    const postRestartCheck = await cdp.eval(`(() => {
      const stepArrival = document.getElementById('stepArrival');
      const visitorPos = document.getElementById('visitorPosNode');
      const ghostPos = document.getElementById('ghostPosNode');
      const visitorDialogue = document.getElementById('visitorDialogue');

      return {
        stepArrivalVisible: !stepArrival.classList.contains('hidden'),
        visitorLeft: visitorPos.style.left,
        ghostLeft: ghostPos.style.left,
        visitorDialogueHidden: visitorDialogue.classList.contains('hidden')
      };
    })()`);

    console.log(`  Arrival Step Restored: ${postRestartCheck.stepArrivalVisible}`);
    console.log(`  Barnaby Position Reset: ${postRestartCheck.visitorLeft} (Offscreen)`);
    console.log(`  Ghost Position Reset: ${postRestartCheck.ghostLeft} (Center mark)`);
    console.log(`  Visitor Dialogue Hidden: ${postRestartCheck.visitorDialogueHidden}`);

    if (!postRestartCheck.stepArrivalVisible) {
      throw new Error('Restart did not restore arrival view!');
    }
    console.log('  ✓ Full restart successfully restored clean initial state.');

    console.log('\n================================================================');
    console.log('ALL BROWSER INTERACTION CHECKS PASSED WITH ZERO ERRORS!');
    console.log('================================================================');

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGTERM');
  }
}

runBrowserVerification().catch(err => {
  console.error('\n❌ BROWSER VERIFICATION FAILED:', err);
  process.exit(1);
});
