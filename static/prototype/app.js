// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

import { EncounterController, EncounterState } from "./EncounterController.js";
import { BoardApiClient } from "./BoardApiClient.js";
import { PerformancePlan } from "./PerformancePlan.js";
import { CarnivalScene } from "./CarnivalScene.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const phaserContainer = document.getElementById("phaserContainer");
  const modeBadge = document.getElementById("modeBadge");
  const toggleDevModeBtn = document.getElementById("toggleDevModeBtn");

  // Step Panels
  const panelArrival = document.getElementById("panelArrival");
  const panelCoaching = document.getElementById("panelCoaching");
  const panelRecording = document.getElementById("panelRecording");
  const panelTimingTrigger = document.getElementById("panelTimingTrigger");
  const panelOutcome = document.getElementById("panelOutcome");

  // Action Buttons
  const enterCarnivalBtn = document.getElementById("enterCarnivalBtn");
  const quickDevPlayBtn = document.getElementById("quickDevPlayBtn");
  const coachForm = document.getElementById("coachForm");
  const coachInput = document.getElementById("coachInput");
  const coachBtn = document.getElementById("coachBtn");
  const coachChips = document.querySelectorAll(".coach-chip");
  const coachThinking = document.getElementById("coachThinking");

  const recordBtn = document.getElementById("recordBtn");
  const recordBtnText = document.getElementById("recordBtnText");
  const defaultSoundBtn = document.getElementById("defaultSoundBtn");
  const recordingMeter = document.getElementById("recordingMeter");
  const meterFill = document.getElementById("meterFill");

  const booTriggerBtn = document.getElementById("booTriggerBtn");
  const timingStatusText = document.getElementById("timingStatusText");
  const tryAgainBtn = document.getElementById("tryAgainBtn");
  const changeCoachingBtn = document.getElementById("changeCoachingBtn");
  const restartBtn = document.getElementById("restartBtn");

  // Diagnostics & Status
  const outcomeResultBadge = document.getElementById("outcomeResultBadge");
  const outcomeRuleText = document.getElementById("outcomeRuleText");
  const timingResultBadge = document.getElementById("timingResultBadge");
  const toggleDiagBtn = document.getElementById("toggleDiagBtn");
  const closeDiagBtn = document.getElementById("closeDiagBtn");
  const diagnosticsDrawer = document.getElementById("diagnosticsDrawer");
  const diagModelStatus = document.getElementById("diagModelStatus");
  const diagPlanActions = document.getElementById("diagPlanActions");
  const diagTimingEval = document.getElementById("diagTimingEval");
  const errorBanner = document.getElementById("errorBanner");
  const errorBannerText = document.getElementById("errorBannerText");
  const retryErrorBtn = document.getElementById("retryErrorBtn");

  // --- Subsystem Instances ---
  const controller = new EncounterController();
  const apiClient = new BoardApiClient();

  let isDevMode = false;
  let activePlan = null;
  let keptAudio = null;
  let lastFailedAction = null;
  let sceneInstance = null;

  window.controller = controller;
  window.appState = {
    get activePlan() { return activePlan; },
    get sceneInstance() { return sceneInstance; }
  };

  // --- Initialize Phaser 3 Game Instance ---
  const gameConfig = {
    type: Phaser.AUTO,
    parent: "phaserContainer",
    width: 900,
    height: 480,
    backgroundColor: "#080410",
    scene: [CarnivalScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

  const game = new Phaser.Game(gameConfig);
  window.game = game;

  // Retrieve scene instance once Phaser scene boots
  game.events.on("ready", () => {
    sceneInstance = game.scene.getScene("CarnivalScene");
    window.sceneInstance = sceneInstance;
  });

  // --- Error Banner Helpers ---
  function showError(msg, retryFn) {
    if (errorBanner && errorBannerText) {
      errorBannerText.textContent = msg;
      lastFailedAction = retryFn;
      errorBanner.classList.remove("hidden");
    }
  }

  function hideError() {
    if (errorBanner) errorBanner.classList.add("hidden");
    lastFailedAction = null;
  }

  if (retryErrorBtn) {
    retryErrorBtn.addEventListener("click", () => {
      hideError();
      if (typeof lastFailedAction === "function") {
        const fn = lastFailedAction;
        lastFailedAction = null;
        fn();
      }
    });
  }

  // --- Mode Toggle (Checkpoint A vs B) ---
  function setMode(devMode) {
    isDevMode = devMode;
    if (isDevMode) {
      modeBadge.textContent = "⚡ Checkpoint A: Fixed Dev Plan Mode";
      modeBadge.className = "badge badge-dev";
      toggleDevModeBtn.textContent = "Switch to AI Mode (UNO Q)";
    } else {
      modeBadge.textContent = "🤖 Checkpoint B: Live UNO Q Model Mode";
      modeBadge.className = "badge badge-ai";
      toggleDevModeBtn.textContent = "Switch to Dev Mode (Fixed Plan)";
    }
  }

  toggleDevModeBtn.addEventListener("click", () => {
    setMode(!isDevMode);
  });
  setMode(false); // Default to AI mode (with Quick Dev Plan option always ready)

  // --- View Controller (Syncs DOM Panels with Encounter State) ---
  controller.onStateChange((oldState, newState, data) => {
    hideError();

    const panels = [panelArrival, panelCoaching, panelRecording, panelTimingTrigger, panelOutcome];
    panels.forEach(p => { if (p) p.classList.add("hidden"); });

    switch (newState) {
      case EncounterState.IDLE:
        panelArrival.classList.remove("hidden");
        enterCarnivalBtn.disabled = false;
        break;

      case EncounterState.ARRIVAL:
        panelArrival.classList.remove("hidden");
        enterCarnivalBtn.disabled = true;
        break;

      case EncounterState.COACHING:
        panelCoaching.classList.remove("hidden");
        coachBtn.disabled = false;
        coachThinking.classList.add("hidden");
        if (coachInput) coachInput.focus();
        break;

      case EncounterState.RECORDING:
        panelRecording.classList.remove("hidden");
        recordBtn.disabled = false;
        recordingMeter.classList.add("hidden");
        break;

      case EncounterState.PREPARING:
        panelTimingTrigger.classList.remove("hidden");
        booTriggerBtn.disabled = true;
        timingStatusText.textContent = "Ghost is taking up position behind the booth...";
        break;

      case EncounterState.ENCOUNTER_APPROACH:
        panelTimingTrigger.classList.remove("hidden");
        booTriggerBtn.disabled = false;
        timingStatusText.textContent = "Barnaby is walking past! Press 'BOO!' (or Space) when he is at the booth!";
        booTriggerBtn.focus();
        break;

      case EncounterState.REVEALING:
        panelTimingTrigger.classList.remove("hidden");
        booTriggerBtn.disabled = true;
        timingStatusText.textContent = "THE SCARE! Revealing from concealment...";
        break;

      case EncounterState.OUTCOME:
        panelOutcome.classList.remove("hidden");
        if (data.outcome) {
          // Technical diagnostics (inside diagnostics drawer)
          if (outcomeResultBadge) {
            outcomeResultBadge.textContent = data.outcome.outcome.toUpperCase();
            outcomeResultBadge.className = `badge badge-${data.outcome.outcome}`;
          }
          if (outcomeRuleText) {
            outcomeRuleText.textContent = `${data.outcome.rule_name || data.outcome.rule_id}: ${data.outcome.rule_description}`;
          }
          if (timingResultBadge) {
            timingResultBadge.textContent = `TIMING: ${(data.timing || 'well_timed').replace('_', ' ').toUpperCase()}`;
          }

          // Player-facing narrative story response (FIX 4)
          const storyHeading = document.getElementById("outcomeStoryHeading");
          const storyText = document.getElementById("outcomeStoryText");
          if (storyHeading && storyText) {
            if (data.timing === "early") {
              storyHeading.textContent = "A Bit Too Eager!";
              storyText.textContent = "Barnaby spotted your approach ahead of time and chuckled warmly at the enthusiasm.";
            } else if (data.timing === "late") {
              storyHeading.textContent = "Missed the Moment!";
              storyText.textContent = "Barnaby already walked past the booth, happily humming without noticing.";
            } else if (data.timing === "missed") {
              storyHeading.textContent = "A Quiet Stroll...";
              storyText.textContent = "Barnaby strolled past the courtyard uninterrupted into the carnival.";
            } else if (data.outcome.outcome === "shock") {
              storyHeading.textContent = "Splendid Scare!";
              storyText.textContent = "Barnaby jumped into the air, his brass key spun, and he dropped a golden ticket!";
            } else if (data.outcome.outcome === "shiver") {
              storyHeading.textContent = "Chills & Shivers!";
              storyText.textContent = "Barnaby shivered as an eerie phantom whisper chattered his clockwork gears.";
            } else if (data.outcome.outcome === "amused") {
              storyHeading.textContent = "Delightful Etiquette!";
              storyText.textContent = "Barnaby was thoroughly charmed by your polite ghostly manners.";
            } else {
              storyHeading.textContent = "Encounter Finished";
              storyText.textContent = data.outcome.visitor_line || "The clockwork visitor paused for a moment.";
            }
          }
        }
        break;
    }
  });

  // --- Step 1: Arrival Screen ("Enter the carnival") ---
  enterCarnivalBtn.addEventListener("click", async () => {
    controller.transition(EncounterState.ARRIVAL);
    if (!sceneInstance) sceneInstance = game.scene.getScene("CarnivalScene");

    await sceneInstance.playArrivalSequence();
    controller.transition(EncounterState.COACHING);
  });

  // Checkpoint A Quick Play (Fixed hide -> spooky_boo plan)
  quickDevPlayBtn.addEventListener("click", () => {
    activePlan = PerformancePlan.createDefaultFixedPlan();
    if (diagPlanActions) diagPlanActions.textContent = activePlan.actions.join(" → ");
    startEncounterLoopWithPlan(activePlan);
  });

  // --- Step 2: Entrance Coaching Form (UNO Q Qwen 2.5 / Edge LLM) ---
  async function submitCoaching(text) {
    if (!text || text.trim().length === 0) return;
    const cleanText = text.trim();

    coachBtn.disabled = true;
    coachThinking.classList.remove("hidden");

    try {
      const result = await apiClient.planCoaching(cleanText);
      coachThinking.classList.add("hidden");
      coachBtn.disabled = false;

      // Update Diagnostics Drawer with Model vs Rule Plans
      const diagModelPlan = document.getElementById("diagModelPlan");
      const diagRulePlan = document.getElementById("diagRulePlan");
      if (diagModelPlan) {
        const mp = result.diagnostics && result.diagnostics.model_derived_plan;
        diagModelPlan.textContent = mp ? `${JSON.stringify(mp.actions || [])} (supported: ${mp.supported}, pace: ${mp.pace})` : "N/A";
      }
      if (diagRulePlan) {
        const rp = result.diagnostics && result.diagnostics.rule_corrected_plan;
        diagRulePlan.textContent = rp ? `${JSON.stringify(rp.actions || [])} (supported: ${rp.supported}, rule: ${rp.rule_applied || "validated"})` : "N/A";
      }

      if (!result.supported) {
        activePlan = null;
        if (diagPlanActions) {
          const ruleName = (result.diagnostics && result.diagnostics.rule_corrected_plan && result.diagnostics.rule_corrected_plan.rule_applied) || "Unsupported";
          diagPlanActions.textContent = `None (Rejected: ${ruleName})`;
        }
        showError(result.character_dialogue || "Instruction not supported. Try 'Hide behind the booth, then spooky boo'.", () => submitCoaching(cleanText));
        if (sceneInstance && sceneInstance.ghost) {
          sceneInstance.ghost.setTexture("ghost_embarrassed");
          sceneInstance.showGhostBubble(result.character_dialogue, 4500);
        }
        return;
      }

      activePlan = PerformancePlan.fromServerResponse(result, keptAudio);
      if (diagPlanActions) diagPlanActions.textContent = `${activePlan.actions.join(" → ")} (${activePlan.pace})`;

      if (activePlan.needs_sound && !keptAudio) {
        controller.transition(EncounterState.RECORDING, { plan: activePlan });
      } else {
        startEncounterLoopWithPlan(activePlan);
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      coachThinking.classList.add("hidden");
      coachBtn.disabled = false;
      showError(`Board connection paused: ${err.message}`, () => submitCoaching(cleanText));
    }
  }

  coachForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitCoaching(coachInput.value);
  });

  coachChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const text = chip.getAttribute("data-text");
      if (text) {
        coachInput.value = text;
        submitCoaching(text);
      }
    });
  });

  // --- Step 3: Sound Demonstration (Audio Recording & LiteRT YAMNet) ---
  let isRecording = false;
  let mediaStream = null;

  async function startAudioRecording() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false }
      });
    } catch (e) {
      showError("Microphone permission blocked. You can use 'Ghost Squeak' instead.", startAudioRecording);
      return;
    }

    isRecording = true;
    recordBtn.disabled = true;
    recordBtnText.textContent = "Listening (2.5s)...";
    recordingMeter.classList.remove("hidden");
    meterFill.style.width = "0%";

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(mediaStream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    const chunks = [];

    processor.onaudioprocess = (e) => {
      if (!isRecording) return;
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);

    const startTime = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, (elapsed / 2500) * 100);
      meterFill.style.width = `${pct}%`;
      if (elapsed >= 2500) {
        clearInterval(interval);
        finishRecording(chunks, audioCtx.sampleRate, audioCtx);
      }
    }, 50);
  }

  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([view], { type: "audio/wav" });
  }

  async function finishRecording(chunks, sampleRate, audioCtx) {
    isRecording = false;
    recordBtnText.textContent = "Interpreting on UNO Q...";
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    if (audioCtx) audioCtx.close();

    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    const merged = new Float32Array(totalLen);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.length;
    }

    const wavBlob = encodeWav(merged, sampleRate);

    try {
      const interpretRes = await apiClient.interpretAudio(wavBlob);
      keptAudio = {
        audio_id: interpretRes.audio.audio_id,
        audio_source: interpretRes.audio.audio_source,
        player_recording_url: interpretRes.audio.player_recording_url,
        ghost_imitation_url: interpretRes.audio.ghost_imitation_url,
        sound_category: interpretRes.recognized_category,
        reaction_type: interpretRes.reaction_type
      };
      if (activePlan) activePlan.audio = keptAudio;
      startEncounterLoopWithPlan(activePlan);
    } catch (err) {
      showError(`Audio interpretation failed: ${err.message}`, () => finishRecording(chunks, sampleRate, audioCtx));
      recordBtn.disabled = false;
      recordBtnText.textContent = "Record Sound (2.5s)";
    }
  }

  recordBtn.addEventListener("click", startAudioRecording);

  defaultSoundBtn.addEventListener("click", () => {
    keptAudio = {
      audio_id: "default_synth",
      audio_source: "synth",
      sound_category: activePlan && activePlan.isWhisper ? "whisper" : "spooky",
      reaction_type: activePlan && activePlan.isWhisper ? "whisper" : "spooky"
    };
    if (activePlan) activePlan.audio = keptAudio;
    startEncounterLoopWithPlan(activePlan);
  });

  // --- Shared Encounter Cleanup Method (FIX 3) ---
  let currentAttemptGeneration = 0;

  function cleanupEncounter({ keepPlan = false, keepAudio = false } = {}) {
    currentAttemptGeneration++;
    apiClient.cancelActiveRequests();

    if (sceneInstance) {
      sceneInstance.cleanupEncounterState();
    }

    if (!keepPlan) {
      activePlan = null;
      if (diagPlanActions) diagPlanActions.textContent = "—";
    }

    if (!keepAudio) {
      keptAudio = null;
    }

    if (errorBanner) errorBanner.classList.add("hidden");
  }

  // --- Step 4 & 5: Preparation & Core Timing Encounter Loop ---
  async function startEncounterLoopWithPlan(plan) {
    if (!sceneInstance) sceneInstance = game.scene.getScene("CarnivalScene");

    currentAttemptGeneration++;
    const thisAttempt = currentAttemptGeneration;

    // Remove previous ticket, bubbles, and effects before launching the attempt
    sceneInstance.cleanupEncounterState();

    controller.transition(EncounterState.PREPARING, { plan });

    // 1. Ghost prepares (travels to booth & conceals if plan includes 'hide')
    await sceneInstance.playPreparationSequence(plan);
    if (thisAttempt !== currentAttemptGeneration) return;

    // 2. Barnaby begins walking along the path; trigger window opens!
    controller.transition(EncounterState.ENCOUNTER_APPROACH);

    sceneInstance.startEncounterApproach(async (timing, barnabyX) => {
      if (thisAttempt !== currentAttemptGeneration) return;

      // Player triggered the reveal at barnabyX
      controller.transition(EncounterState.REVEALING, { timing });

      // Call server /api/perform with timing parameter
      try {
        const outcome = await apiClient.evaluatePerformance({ plan, timing });
        if (thisAttempt !== currentAttemptGeneration) return;

        if (diagTimingEval) diagTimingEval.textContent = `${timing} (at X=${Math.round(barnabyX)}) -> ${outcome.outcome}`;

        // Animate immediate consequence in Phaser scene (FIX 2: uncluttered, readable payoff)
        await sceneInstance.animateOutcomeReaction(outcome, timing);
        if (thisAttempt !== currentAttemptGeneration) return;

        // Transition to outcome screen
        controller.transition(EncounterState.OUTCOME, { outcome, timing });
      } catch (err) {
        if (thisAttempt !== currentAttemptGeneration) return;
        showError(`Evaluation failed: ${err.message}`, () => startEncounterLoopWithPlan(plan));
      }
    });
  }

  // "BOO!" Action Button click
  booTriggerBtn.addEventListener("click", () => {
    if (sceneInstance) sceneInstance.triggerScareAction();
  });

  // "Try again" (Replays the encounter approach immediately with same plan & audio)
  tryAgainBtn.addEventListener("click", () => {
    if (activePlan) {
      cleanupEncounter({ keepPlan: true, keepAudio: true });
      startEncounterLoopWithPlan(activePlan);
    }
  });

  // "Change my coaching" (Returns to coaching input, resets scene, preserves audio)
  changeCoachingBtn.addEventListener("click", () => {
    cleanupEncounter({ keepPlan: false, keepAudio: true });
    controller.transition(EncounterState.COACHING);
  });

  // Full Restart (Completely resets scene, plan, and audio)
  restartBtn.addEventListener("click", () => {
    cleanupEncounter({ keepPlan: false, keepAudio: false });
    controller.reset();
  });

  // Diagnostics Drawer Toggle
  toggleDiagBtn.addEventListener("click", () => {
    diagnosticsDrawer.classList.toggle("hidden");
  });
  closeDiagBtn.addEventListener("click", () => {
    diagnosticsDrawer.classList.add("hidden");
  });

  // Check initial backend health
  apiClient.checkHealth().then(h => {
    if (diagModelStatus) diagModelStatus.textContent = `${h.status} (${h.board})`;
  }).catch(() => {
    if (diagModelStatus) diagModelStatus.textContent = "Offline / Simulation Mode";
  });
});
