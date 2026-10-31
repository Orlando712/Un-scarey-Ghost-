// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9349;
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
      this.ws.onmessage = evt => {
        const msg = JSON.parse(evt.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      };
    });
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

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buf);
    console.log(`  [Saved Screenshot] -> ${filename} (${(buf.length / 1024).toFixed(1)} KB)`);
    return outPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getOrLaunchChrome() {
  try {
    const version = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    console.log('[Browser Connected] Existing Chrome instance found.');
    return null;
  } catch (err) {
    console.log('[Browser] Launching Headless Chrome on port', DEBUG_PORT);
    const proc = spawn(CHROME_PATH, [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1200,900',
      'about:blank'
    ], { stdio: 'ignore' });

    for (let i = 0; i < 20; i++) {
      await sleep(250);
      try {
        await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
        return proc;
      } catch (e) {}
    }
    throw new Error('Could not launch Chrome with remote debugging');
  }
}

async function runSimultaneousAndConditionVerification() {
  console.log('================================================================');
  console.log('VERIFYING ACTUAL USER FAILURE THROUGH /PROTOTYPE UI');
  console.log('1. "Make sounds while hiding, then emerge when the visitor reaches the counter."');
  console.log('2. "dosoundswhilehidingandemergewhenitisatcounter"');
  console.log('================================================================\n');

  const proc = await getOrLaunchChrome();

  try {
    const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    let target = targets.find(t => t.type === 'page');
    if (!target) {
      await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`);
      const updated = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      target = updated.find(t => t.type === 'page');
    }

    const cdp = new CDPClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log(`Navigating to ${TARGET_URL}...`);
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2000);

    // Boot & Enter Carnival
    console.log('Entering Carnival...');
    await cdp.eval(`document.getElementById('enterCarnivalBtn').click()`);

    // Await Coaching Screen
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      const isCoaching = await cdp.eval(`!document.getElementById('panelCoaching').classList.contains('hidden')`);
      if (isCoaching) break;
    }
    console.log('Arrived at Coaching Screen!\n');

    // Open Diagnostics Drawer so diagModelPlan and diagRulePlan are visible
    await cdp.eval(`(() => {
      const drawer = document.getElementById('diagnosticsDrawer');
      if (drawer && drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
      }
    })()`);

    const testInputs = [
      {
        id: 'A',
        label: 'Input with spaces',
        input: 'Make sounds while hiding, then emerge when the visitor reaches the counter.',
        screenshot: 'verify_simultaneous_condition_input_a.png'
      },
      {
        id: 'B',
        label: 'Screenshot input without spaces',
        input: 'dosoundswhilehidingandemergewhenitisatcounter',
        screenshot: 'verify_simultaneous_condition_input_b.png'
      }
    ];

    const results = [];

    for (const item of testInputs) {
      console.log(`----------------------------------------------------------------`);
      console.log(`TEST ${item.id} [${item.label}]: "${item.input}"`);
      console.log(`----------------------------------------------------------------`);

      // Ensure we are in Coaching screen
      let onCoaching = await cdp.eval(`!document.getElementById('panelCoaching').classList.contains('hidden')`);
      if (!onCoaching) {
        throw new Error('Test not on coaching panel!');
      }

      // Fill in input and submit via real DOM button
      await cdp.eval(`(() => {
        const inp = document.getElementById('coachInput');
        inp.value = ${JSON.stringify(item.input)};
      })()`);

      console.log(`  Submitting coaching form... awaiting Qwen & rule validation on board...`);
      await cdp.eval(`document.getElementById('coachBtn').click()`);

      // Wait for completion
      for (let i = 0; i < 50; i++) {
        await sleep(300);
        const thinkingHidden = await cdp.eval(`document.getElementById('coachThinking').classList.contains('hidden')`);
        const btnEnabled = await cdp.eval(`!document.getElementById('coachBtn').disabled`);
        if (thinkingHidden && btnEnabled) break;
      }
      await sleep(600);

      // Query server directly for complete diagnostics
      const serverReport = await new Promise(resolve => {
        const postData = JSON.stringify({ text: item.input, session_id: 'verification_session_' + item.id });
        const req = http.request({
          hostname: '127.0.0.1',
          port: 8080,
          path: '/api/coach',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, res => {
          let buf = '';
          res.on('data', d => buf += d);
          res.on('end', () => {
            try { resolve(JSON.parse(buf)); } catch (e) { resolve({}); }
          });
        });
        req.write(postData);
        req.end();
      });

      // Inspect client DOM and Phaser state
      const clientState = await cdp.eval(`(() => {
        const scene = (window.sceneInstance || (window.game && window.game.scene.getScene('CarnivalScene')));
        const errorBanner = document.getElementById('errorBanner');
        const errorText = document.getElementById('errorBannerText');
        const panelCoaching = document.getElementById('panelCoaching');
        const panelRecording = document.getElementById('panelRecording');
        const coachBtn = document.getElementById('coachBtn');
        const diagModelPlan = document.getElementById('diagModelPlan');
        const diagRulePlan = document.getElementById('diagRulePlan');
        const diagPlanActions = document.getElementById('diagPlanActions');

        const activePlan = (window.appState && window.appState.activePlan) || scene.currentPlan;

        return {
          currentPanel: !panelCoaching.classList.contains('hidden') ? 'panelCoaching' :
                        (!panelRecording.classList.contains('hidden') ? 'panelRecording' : 'other'),
          coachBtnDisabled: coachBtn.disabled,
          errorBannerVisible: !errorBanner.classList.contains('hidden'),
          errorBannerText: errorText ? errorText.textContent : '',
          ghostBubbleVisible: scene.ghostBubble.visible,
          ghostBubbleText: scene.ghostBubbleText ? scene.ghostBubbleText.text : '',
          ghostTexture: scene.ghost.texture.key,
          activePlanActions: activePlan ? activePlan.actions : [],
          diagModelPlanText: diagModelPlan ? diagModelPlan.textContent : '',
          diagRulePlanText: diagRulePlan ? diagRulePlan.textContent : '',
          diagPlanActionsText: diagPlanActions ? diagPlanActions.textContent : ''
        };
      })()`);

      const diag = serverReport.diagnostics || {};
      const modelPlan = diag.model_derived_plan || {};
      const rulePlan = diag.rule_corrected_plan || {};

      const testResult = {
        id: item.id,
        input: item.input,
        rawModelResponse: diag.raw_llm_output || 'N/A',
        modelDerivedPlan: modelPlan,
        finalValidatedPlan: {
          supported: serverReport.supported,
          actions: serverReport.actions || [],
          pace: serverReport.pace,
          dialogue: serverReport.character_dialogue
        },
        ruleCorrection: rulePlan.rule_applied || 'None',
        limitationsExplained: rulePlan.limitations_explained || [],
        observedUIBehavior: {
          remainedInCoaching: clientState.currentPanel === 'panelCoaching',
          coachBtnReEnabled: !clientState.coachBtnDisabled,
          errorBannerVisible: clientState.errorBannerVisible,
          errorBannerText: clientState.errorBannerText,
          ghostBubbleVisible: clientState.ghostBubbleVisible,
          ghostBubbleText: clientState.ghostBubbleText,
          ghostExpression: clientState.ghostTexture,
          scenePlanActions: clientState.activePlanActions,
          drawerModelPlan: clientState.diagModelPlanText,
          drawerRulePlan: clientState.diagRulePlanText,
          drawerActivePlan: clientState.diagPlanActionsText
        },
        passed: (clientState.currentPanel === 'panelCoaching') &&
                (serverReport.supported === false) &&
                (clientState.activePlanActions.length === 0) &&
                (clientState.errorBannerVisible) &&
                (rulePlan.rule_applied === 'rule_reject_simultaneous_and_visitor_position_condition')
      };

      await cdp.captureScreenshot(item.screenshot);
      results.push(testResult);

      console.log(`  Raw Qwen Response:\n${diag.raw_llm_output}`);
      console.log(`  Model-Derived Plan: ${JSON.stringify(modelPlan)}`);
      console.log(`  Final Validated Plan: ${JSON.stringify(testResult.finalValidatedPlan)}`);
      console.log(`  Rule Correction: ${testResult.ruleCorrection} (Limitations: ${JSON.stringify(testResult.limitationsExplained)})`);
      console.log(`  UI State: panel=${clientState.currentPanel}, ghostTexture=${clientState.ghostTexture}`);
      console.log(`  Explanation Shown: "${clientState.errorBannerText}"`);
      console.log(`  Active Actions: ${JSON.stringify(clientState.activePlanActions)} (Zero reduction to hide->spooky_boo: ${clientState.activePlanActions.length === 0})`);
      console.log(`  TEST ${item.id} PASSED: ${testResult.passed}\n`);
    }

    console.log('================================================================');
    console.log('SUMMARY OF ACTUAL USER FAILURE VERIFICATION:');
    console.log('================================================================');
    for (const r of results) {
      console.log(`[Input ${r.id}] "${r.input}"`);
      console.log(`  - Raw Qwen Output: ${r.rawModelResponse.replace(/\n/g, ' ')}`);
      console.log(`  - Model-Derived Plan: actions=${JSON.stringify(r.modelDerivedPlan.actions)}, supported=${r.modelDerivedPlan.supported}`);
      console.log(`  - Final Validated Plan: actions=${JSON.stringify(r.finalValidatedPlan.actions)}, supported=${r.finalValidatedPlan.supported}`);
      console.log(`  - Rule Correction: ${r.ruleCorrection}`);
      console.log(`  - Limitations Explained: ${JSON.stringify(r.limitationsExplained)}`);
      console.log(`  - Observed UI Behavior: Remained in coaching (${r.observedUIBehavior.remainedInCoaching}), Ghost expression ${r.observedUIBehavior.ghostExpression}, Error shown: "${r.observedUIBehavior.errorBannerText}"`);
      console.log(`  - Verified No Silent Reduction: ${r.observedUIBehavior.scenePlanActions.length === 0}`);
      console.log(`  - Overall Pass: ${r.passed}\n`);
    }

    const allPassed = results.every(r => r.passed);
    if (!allPassed) {
      throw new Error('Not all verification requirements passed!');
    }

    cdp.close();
  } finally {
    if (proc) proc.kill();
  }
}

runSimultaneousAndConditionVerification()
  .then(() => {
    console.log('VERIFICATION COMPLETED SUCCESSFULLY.');
    process.exit(0);
  })
  .catch(err => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  });
