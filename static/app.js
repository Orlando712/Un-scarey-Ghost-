// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements: Stage & Actors ---
  const courtyardScene = document.getElementById("courtyardScene");
  const ghostPosNode = document.getElementById("ghostPosNode");
  const ghostViewportNode = document.getElementById("ghostViewportNode");
  const ghostMotionNode = document.getElementById("ghostMotionNode");
  const ghostCharacter = document.getElementById("ghostCharacter");
  const ghostSvg = document.getElementById("ghostSvg");
  const ghostDialogue = document.getElementById("ghostDialogue");
  const dialogueText = document.getElementById("dialogueText");

  const visitorPosNode = document.getElementById("visitorPosNode");
  const visitorMotionNode = document.getElementById("visitorMotionNode");
  const visitorCharacter = document.getElementById("visitorCharacter");
  const visitorSvg = document.getElementById("visitorSvg");
  const visitorDialogue = document.getElementById("visitorDialogue");
  const visitorDialogueText = document.getElementById("visitorDialogueText");

  // --- Step Views ---
  const stepArrival = document.getElementById("stepArrival");
  const stepCoaching = document.getElementById("stepCoaching");
  const stepRecording = document.getElementById("stepRecording");
  const stepPerformance = document.getElementById("stepPerformance");
  const stepOutcome = document.getElementById("stepOutcome");
  const stepFinale = document.getElementById("stepFinale");

  // --- Error Banner ---
  const recoverableErrorBanner = document.getElementById("recoverableErrorBanner");
  const errorMessage = document.getElementById("errorMessage");
  const retryErrorBtn = document.getElementById("retryErrorBtn");

  // --- Buttons & Controls ---
  const startCoachingBtn = document.getElementById("startCoachingBtn");
  const coachForm = document.getElementById("coachForm");
  const coachInput = document.getElementById("coachInput");
  const coachBtn = document.getElementById("coachBtn");
  const coachChips = document.querySelectorAll(".coach-chip");
  const coachingThinking = document.getElementById("coachingThinking");

  const soundPromptText = document.getElementById("soundPromptText");
  const recordingInitialControls = document.getElementById("recordingInitialControls");
  const recordBtn = document.getElementById("recordBtn");
  const recordBtnText = document.getElementById("recordBtnText");
  const reuseAudioBtn = document.getElementById("reuseAudioBtn");
  const defaultSoundBtn = document.getElementById("defaultSoundBtn");
  const recordingFeedback = document.getElementById("recordingFeedback");
  const meterProgress = document.getElementById("meterProgress");
  const meterStatus = document.getElementById("meterStatus");
  const soundDecisionRow = document.getElementById("soundDecisionRow");
  const keepSoundBtn = document.getElementById("keepSoundBtn");
  const retrySoundBtn = document.getElementById("retrySoundBtn");

  const performanceBanner = document.getElementById("performanceBanner");
  const performanceActionText = document.getElementById("performanceActionText");
  const reviseBtn = document.getElementById("reviseBtn");
  const againSlowerBtn = document.getElementById("againSlowerBtn");
  const finaleBtn = document.getElementById("finaleBtn");
  const finaleNarrativeText = document.getElementById("finaleNarrativeText");
  const restartBtn = document.getElementById("restartBtn");

  // --- Diagnostics Drawer ---
  const toggleDiagBtn = document.getElementById("toggleDiagBtn");
  const closeDiagBtn = document.getElementById("closeDiagBtn");
  const diagnosticsPanel = document.getElementById("diagnosticsPanel");
  const diagPlanActions = document.getElementById("diagPlanActions");
  const diagPlanPace = document.getElementById("diagPlanPace");
  const diagPlanSound = document.getElementById("diagPlanSound");
  const diagPlanLatency = document.getElementById("diagPlanLatency");
  const diagPlanTokenSpeed = document.getElementById("diagPlanTokenSpeed");
  const diagPlanDialogue = document.getElementById("diagPlanDialogue");
  const diagOutcomeResult = document.getElementById("diagOutcomeResult");
  const diagOutcomeRule = document.getElementById("diagOutcomeRule");
  const diagRuleExplanation = document.getElementById("diagRuleExplanation");
  const diagPaceEffect = document.getElementById("diagPaceEffect");
  const diagMatrixStatus = document.getElementById("diagMatrixStatus");
  const diagAudioId = document.getElementById("diagAudioId");
  const diagAudioSource = document.getElementById("diagAudioSource");
  const diagInferLatency = document.getElementById("diagInferLatency");
  const diagAudioMetrics = document.getElementById("diagAudioMetrics");
  const diagCategory = document.getElementById("diagCategory");
  const diagTopClassesList = document.getElementById("diagTopClassesList");

  // --- Game State Variables ---
  let currentPlan = null;
  let currentRecording = null;
  let keptAudio = null;
  let lastCompletedSnapshot = null;
  let isPerforming = false;
  let isRecording = false;
  let lastFailedAction = null;

  let activeTimeouts = [];
  let activeIntervals = [];
  let activeAbortController = null;
  let activeAudio = null;
  let activeAudioCtx = null;
  let mediaStream = null;

  const RECORD_DURATION_MS = 2500;

  // --- Async & Activity Management ---
  function sleep(ms) {
    return new Promise(resolve => {
      const id = setTimeout(() => {
        activeTimeouts = activeTimeouts.filter(t => t !== id);
        resolve();
      }, ms);
      activeTimeouts.push(id);
    });
  }

  function safeSetTimeout(fn, ms) {
    const id = setTimeout(() => {
      activeTimeouts = activeTimeouts.filter(t => t !== id);
      fn();
    }, ms);
    activeTimeouts.push(id);
    return id;
  }

  function safeSetInterval(fn, ms) {
    const id = setInterval(fn, ms);
    activeIntervals.push(id);
    return id;
  }

  function cancelAllSceneActivity() {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts = [];
    activeIntervals.forEach(id => clearInterval(id));
    activeIntervals = [];

    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }

    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.src = "";
      } catch (e) {}
      activeAudio = null;
    }

    if (activeAudioCtx) {
      try {
        activeAudioCtx.close();
      } catch (e) {}
      activeAudioCtx = null;
    }

    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      mediaStream = null;
    }

    isRecording = false;
    isPerforming = false;
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function waitForAnimation(element, fallbackMs = 1000) {
    if (!element || prefersReducedMotion()) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      let resolved = false;
      let timer = null;

      function onEnd(e) {
        if (e.target !== element) return;
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      }

      function cleanup() {
        if (timer) clearTimeout(timer);
        element.removeEventListener("transitionend", onEnd);
        element.removeEventListener("animationend", onEnd);
      }

      element.addEventListener("transitionend", onEnd);
      element.addEventListener("animationend", onEnd);

      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      }, Math.max(fallbackMs, 300));
    });
  }

  // --- Recoverable Error Handling ---
  function showRecoverableError(msg, retryFn) {
    if (recoverableErrorBanner && errorMessage) {
      errorMessage.textContent = msg;
      lastFailedAction = retryFn;
      recoverableErrorBanner.classList.remove("hidden");
    }
  }

  function hideRecoverableError() {
    if (recoverableErrorBanner) {
      recoverableErrorBanner.classList.add("hidden");
    }
    lastFailedAction = null;
  }

  if (retryErrorBtn) {
    retryErrorBtn.addEventListener("click", () => {
      hideRecoverableError();
      if (typeof lastFailedAction === "function") {
        const action = lastFailedAction;
        lastFailedAction = null;
        action();
      }
    });
  }

  // --- Reset Characters & Visitor to Neutral ---
  function resetVisitorToNeutral() {
    if (visitorDialogue) visitorDialogue.classList.add("hidden");
    if (visitorDialogueText) visitorDialogueText.textContent = "";
    setVisitorExpression("idle");
  }

  function resetGhostPositionsToDefault() {
    if (ghostPosNode) {
      ghostPosNode.style.left = "35%";
    }
    if (ghostMotionNode) {
      ghostMotionNode.className = "ghost-motion";
      ghostMotionNode.style.transform = "";
    }
    setGhostExpression("embarrassed");
  }

  // --- Expression Helpers ---
  function setGhostExpression(expression, pace = "normal") {
    if (!ghostSvg) return;
    ghostSvg.setAttribute("class", `ghost-svg ghost-${expression}${pace === "slow" ? " slow-pace" : ""}`);
  }

  function setVisitorExpression(expression) {
    if (!visitorSvg) return;
    visitorSvg.setAttribute("class", `visitor-svg visitor-${expression}`);
  }

  // --- State View Controller ---
  function setGameState(stateName) {
    hideRecoverableError();
    const allViews = [
      stepArrival, stepCoaching, stepRecording, 
      stepPerformance, stepOutcome, stepFinale
    ];
    allViews.forEach(view => {
      if (view) view.classList.add("hidden");
    });

    switch (stateName) {
      case "arrival":
        if (stepArrival) stepArrival.classList.remove("hidden");
        resetGhostPositionsToDefault();
        resetVisitorToNeutral();
        if (visitorPosNode) visitorPosNode.style.left = "106%";
        if (startCoachingBtn) startCoachingBtn.disabled = false;
        if (dialogueText) {
          dialogueText.textContent = "“...Boo? *squeak* ...Oh dear. That sounded better in my head. My first customer! Can you coach my entrance?”";
        }
        break;

      case "coaching":
        if (stepCoaching) stepCoaching.classList.remove("hidden");
        resetVisitorToNeutral();
        setGhostExpression("listening");
        if (coachInput) {
          coachInput.value = "";
          coachInput.focus();
        }
        if (coachBtn) coachBtn.disabled = false;
        if (coachingThinking) coachingThinking.classList.add("hidden");
        break;

      case "recording":
        if (stepRecording) stepRecording.classList.remove("hidden");
        resetVisitorToNeutral();
        if (recordingFeedback) recordingFeedback.classList.add("hidden");
        if (soundDecisionRow) soundDecisionRow.classList.add("hidden");
        if (recordingInitialControls) recordingInitialControls.classList.remove("hidden");
        if (recordBtn) {
          recordBtn.disabled = false;
          recordBtn.classList.remove("recording");
        }
        if (recordBtnText) recordBtnText.textContent = "Record Sound (2–3s)";
        if (reuseAudioBtn) {
          if (keptAudio) reuseAudioBtn.classList.remove("hidden");
          else reuseAudioBtn.classList.add("hidden");
        }
        break;

      case "performance":
        if (stepPerformance) stepPerformance.classList.remove("hidden");
        resetVisitorToNeutral();
        break;

      case "outcome":
        if (stepOutcome) stepOutcome.classList.remove("hidden");
        break;

      case "finale":
        if (stepFinale) stepFinale.classList.remove("hidden");
        break;
    }
  }

  // --- Playback & Synchronized Audio ---
  function playSynchronizedAudio(deliveryType) {
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.src = "";
      } catch (e) {}
      activeAudio = null;
    }

    return new Promise(resolve => {
      let resolved = false;
      function done() {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }

      // Check for available audio assets
      const hasPlayerRec = keptAudio && keptAudio.player_recording_url;
      const hasGhostImit = keptAudio && keptAudio.ghost_imitation_url;

      if (hasPlayerRec && deliveryType === "whisper") {
        // Whisper audio processing: soft gain (0.35) and high-pass filter
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          activeAudioCtx = ctx;
          fetch(keptAudio.player_recording_url)
            .then(res => res.arrayBuffer())
            .then(buf => ctx.decodeAudioData(buf))
            .then(decoded => {
              const src = ctx.createBufferSource();
              src.buffer = decoded;
              const filter = ctx.createBiquadFilter();
              filter.type = "highpass";
              filter.frequency.value = 400;
              const gain = ctx.createGain();
              gain.gain.value = 0.35;
              src.connect(filter);
              filter.connect(gain);
              gain.connect(ctx.destination);
              src.onended = done;
              src.start(0);
              // Fallback timeout in case onended doesn't fire
              setTimeout(done, (decoded.duration * 1000) + 400);
            })
            .catch(() => {
              playAudioElement(keptAudio.player_recording_url, 0.35, done);
            });
        } catch (e) {
          playAudioElement(keptAudio.player_recording_url, 0.35, done);
        }
      } else if (hasGhostImit && deliveryType === "spooky") {
        playAudioElement(keptAudio.ghost_imitation_url, 1.0, done);
      } else if (hasPlayerRec) {
        playAudioElement(keptAudio.player_recording_url, 0.9, done);
      } else if (hasGhostImit) {
        playAudioElement(keptAudio.ghost_imitation_url, 1.0, done);
      } else {
        // Default synthesized phantom squeak via oscillator
        playDefaultOscillatorSqueak(deliveryType === "whisper", done);
      }
    });
  }

  function playAudioElement(url, volume, onEnded) {
    const audio = new Audio(url);
    activeAudio = audio;
    audio.volume = volume;
    audio.onended = () => {
      activeAudio = null;
      onEnded();
    };
    audio.onerror = () => {
      activeAudio = null;
      onEnded();
    };
    audio.play().catch(() => {
      activeAudio = null;
      onEnded();
    });
    // Bounded safety timeout
    setTimeout(onEnded, 4000);
  }

  function playDefaultOscillatorSqueak(isWhisper, onEnded) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      activeAudioCtx = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isWhisper ? "sine" : "sawtooth";
      osc.frequency.setValueAtTime(isWhisper ? 440 : 280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isWhisper ? 580 : 160, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(isWhisper ? 0.08 : 0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.onended = () => {
        try { ctx.close(); } catch (e) {}
        activeAudioCtx = null;
        onEnded();
      };
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(onEnded, 550);
    } catch (e) {
      onEnded();
    }
  }

  // --- Step 1: Arrival & Barnaby Entrance Walk-In ---
  if (startCoachingBtn) {
    startCoachingBtn.addEventListener("click", async () => {
      startCoachingBtn.disabled = true;

      // 1. Barnaby walks into courtyard from offscreen right
      if (visitorPosNode && visitorMotionNode) {
        visitorMotionNode.classList.add("walking");
        visitorPosNode.style.left = "67%";
        await waitForAnimation(visitorPosNode, 2800);
        visitorMotionNode.classList.remove("walking");
      }

      // 2. Ghost floats down to stage mark and squeaks
      if (ghostPosNode) {
        ghostPosNode.style.left = "35%";
      }
      setGhostExpression("embarrassed");
      if (dialogueText) {
        dialogueText.textContent = "“...Boo? *squeak*”";
      }
      playDefaultOscillatorSqueak(true, () => {});
      await sleep(1100);

      // 3. Barnaby stops, oblivious smile, checks watch
      if (visitorDialogue && visitorDialogueText) {
        visitorDialogueText.textContent = "“...Tick-tock? What was that rustle?”";
        visitorDialogue.classList.remove("hidden");
      }
      setVisitorExpression("oblivious");
      await sleep(1500);

      // 4. Ghost turns to player with request for help
      if (dialogueText) {
        dialogueText.textContent = "“Oh dear! My first customer! Can you coach my entrance?”";
      }
      await sleep(800);

      // 5. Transition to coaching step
      setGameState("coaching");
    });
  }

  // --- Step 2: Entrance Coaching ---
  async function submitCoaching(text) {
    if (!text || text.trim().length === 0) return;
    const cleanText = text.trim();
    if (coachInput) coachInput.value = cleanText;
    if (coachBtn) coachBtn.disabled = true;
    if (coachingThinking) coachingThinking.classList.remove("hidden");

    setGhostExpression("listening");
    if (dialogueText) {
      dialogueText.textContent = "“Pondering your entrance plan on the UNO Q machine brain...”";
    }

    const t0 = performance.now();
    try {
      activeAbortController = new AbortController();
      const resp = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, session_id: "default_session" }),
        signal: activeAbortController.signal
      });
      activeAbortController = null;
      const clientTurnMs = performance.now() - t0;

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned ${resp.status}`);
      }

      const data = await resp.json();
      handleCoachingResponse(data, clientTurnMs);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Coaching fetch error:", err);
      if (coachBtn) coachBtn.disabled = false;
      if (coachingThinking) coachingThinking.classList.add("hidden");
      showRecoverableError(`Communication paused: ${err.message}`, () => submitCoaching(cleanText));
      if (dialogueText) {
        dialogueText.textContent = "“Oh dear! A cable snag on the board. Can you tell me that again?”";
      }
      setGhostExpression("puzzled_tilt");
    }
  }

  function handleCoachingResponse(data, clientTurnMs) {
    if (coachingThinking) coachingThinking.classList.add("hidden");
    if (coachBtn) coachBtn.disabled = false;

    // Update Diagnostics
    if (diagPlanActions) diagPlanActions.textContent = data.actions.length ? data.actions.join(" → ") : "None";
    if (diagPlanPace) diagPlanPace.textContent = data.pace;
    if (diagPlanSound) diagPlanSound.textContent = data.needs_sound ? `Yes (${data.sound_type})` : "No (Silent)";
    if (diagPlanLatency && data.diagnostics) diagPlanLatency.textContent = `${data.diagnostics.inference_latency_ms || 0} ms (Turn: ${clientTurnMs.toFixed(1)} ms)`;
    if (diagPlanTokenSpeed && data.diagnostics && data.diagnostics.token_stats) {
      const ts = data.diagnostics.token_stats;
      diagPlanTokenSpeed.textContent = ts.predicted_per_second ? `${ts.predicted_per_second} t/s` : "Rule Guard / Context";
    }
    if (diagPlanDialogue) diagPlanDialogue.textContent = `"${data.character_dialogue}"`;

    if (dialogueText) {
      dialogueText.textContent = `“${data.character_dialogue}”`;
    }

    if (!data.supported) {
      setGhostExpression("puzzled_tilt");
      return;
    }

    currentPlan = {
      actions: data.actions,
      pace: data.pace,
      needs_sound: data.needs_sound,
      sound_type: data.sound_type
    };

    if (data.needs_sound) {
      if (soundPromptText) {
        soundPromptText.textContent = `Our ghost needs a ${data.sound_type} sound to rehearse the entrance!`;
      }
      safeSetTimeout(() => {
        setGameState("recording");
      }, 1000);
    } else {
      safeSetTimeout(() => {
        startPerformanceRehearsal();
      }, 1200);
    }
  }

  if (coachForm) {
    coachForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (coachInput) submitCoaching(coachInput.value);
    });
  }

  coachChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const text = chip.getAttribute("data-text");
      if (text) submitCoaching(text);
    });
  });

  // --- Step 3: Sound Demonstration (Audio Recording & Evaluation) ---
  async function startRecording() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: true }
      });
    } catch (err) {
      if (dialogueText) dialogueText.textContent = "“Microphone blocked! Please allow microphone access or choose 'Use Ghost Squeak'.”";
      setGhostExpression("puzzled_tilt");
      return;
    }

    isRecording = true;
    if (recordBtn) {
      recordBtn.disabled = true;
      recordBtn.classList.add("recording");
    }
    if (recordBtnText) recordBtnText.textContent = "Recording...";
    if (recordingFeedback) recordingFeedback.classList.remove("hidden");
    if (soundDecisionRow) soundDecisionRow.classList.add("hidden");

    setGhostExpression("listening");
    if (dialogueText) dialogueText.textContent = "“I'm listening closely with all my cloth! Give me your sound!”";

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(mediaStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const recordedChunks = [];

    processor.onaudioprocess = (e) => {
      if (!isRecording) return;
      recordedChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    const startTime = performance.now();
    if (meterProgress) meterProgress.style.width = "0%";
    const progressInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, (elapsed / RECORD_DURATION_MS) * 100);
      if (meterProgress) meterProgress.style.width = `${pct}%`;
      if (elapsed >= RECORD_DURATION_MS) {
        clearInterval(progressInterval);
        finishRecording(recordedChunks, audioContext.sampleRate, audioContext);
      }
    }, 50);
  }

  function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  async function finishRecording(chunks, sampleRate, audioContext) {
    isRecording = false;
    if (recordBtn) {
      recordBtn.classList.remove("recording");
      recordBtnText.textContent = "Analyzing on UNO Q...";
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (audioContext) {
      audioContext.close();
    }

    let totalLen = 0;
    for (const chunk of chunks) totalLen += chunk.length;
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBlob = encodeWAV(merged, sampleRate);
    const formData = new FormData();
    formData.append("audio", wavBlob, "player_sound.wav");

    if (meterStatus) meterStatus.textContent = "Interpreting audio with LiteRT YAMNet on UNO Q...";

    try {
      activeAbortController = new AbortController();
      const resp = await fetch("/api/interpret", {
        method: "POST",
        body: formData,
        signal: activeAbortController.signal
      });
      activeAbortController = null;
      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }
      const data = await resp.json();
      handleAudioInterpretation(data);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Audio interpretation error:", err);
      showRecoverableError(`Audio analysis failed: ${err.message}`, startRecording);
      if (meterStatus) meterStatus.textContent = "Audio analysis paused.";
      if (recordBtn) recordBtn.disabled = false;
      if (recordBtnText) recordBtnText.textContent = "Record Sound (2–3s)";
    }
  }

  function handleAudioInterpretation(data) {
    currentRecording = {
      audio_id: data.audio.audio_id,
      audio_source: data.audio.audio_source,
      player_recording_url: data.audio.player_recording_url,
      ghost_imitation_url: data.audio.ghost_imitation_url,
      sound_category: data.recognized_category,
      reaction_type: data.reaction_type
    };

    // Update Diagnostics
    if (diagAudioId) diagAudioId.textContent = data.audio.audio_id;
    if (diagAudioSource) diagAudioSource.textContent = data.audio.audio_source;
    if (diagInferLatency && data.diagnostics) diagInferLatency.textContent = `${data.diagnostics.inference_latency_ms} ms`;
    if (diagAudioMetrics && data.diagnostics && data.diagnostics.audio_metrics) {
      const am = data.diagnostics.audio_metrics;
      diagAudioMetrics.textContent = `${am.duration_s.toFixed(2)}s | RMS: ${am.rms.toFixed(3)}`;
    }
    if (diagCategory) diagCategory.textContent = `${data.recognized_category} (${data.reaction_type})`;

    if (diagTopClassesList && data.diagnostics && data.diagnostics.top_classes) {
      diagTopClassesList.innerHTML = "";
      data.diagnostics.top_classes.forEach(c => {
        const li = document.createElement("li");
        li.textContent = `${c.label}: ${(c.score * 100).toFixed(1)}%`;
        diagTopClassesList.appendChild(li);
      });
    }

    if (dialogueText) dialogueText.textContent = `“${data.character_dialogue}”`;
    setGhostExpression(data.reaction_type === "spooky" ? "spooky" : "listening");

    if (recordingInitialControls) recordingInitialControls.classList.add("hidden");
    if (recordingFeedback) recordingFeedback.classList.add("hidden");
    if (soundDecisionRow) soundDecisionRow.classList.remove("hidden");
  }

  if (recordBtn) recordBtn.addEventListener("click", startRecording);

  if (retrySoundBtn) {
    retrySoundBtn.addEventListener("click", () => {
      if (soundDecisionRow) soundDecisionRow.classList.add("hidden");
      if (recordingInitialControls) recordingInitialControls.classList.remove("hidden");
      if (recordBtn) {
        recordBtn.disabled = false;
        recordBtn.classList.remove("recording");
      }
      if (recordBtnText) recordBtnText.textContent = "Record Sound (2–3s)";
      if (dialogueText) dialogueText.textContent = "“Let's try that sound again! Ready when you are!”";
      setGhostExpression("listening");
    });
  }

  if (keepSoundBtn) {
    keepSoundBtn.addEventListener("click", () => {
      keptAudio = currentRecording;
      if (diagAudioId && keptAudio) diagAudioId.textContent = keptAudio.audio_id;
      if (diagAudioSource && keptAudio) diagAudioSource.textContent = keptAudio.audio_source;
      startPerformanceRehearsal();
    });
  }

  if (reuseAudioBtn) {
    reuseAudioBtn.addEventListener("click", () => {
      if (keptAudio) {
        currentRecording = keptAudio;
        if (diagAudioId) diagAudioId.textContent = keptAudio.audio_id;
        if (diagAudioSource) diagAudioSource.textContent = keptAudio.audio_source;
        if (diagCategory) diagCategory.textContent = keptAudio.sound_category;
        if (dialogueText) dialogueText.textContent = `“Reusing your kept ${keptAudio.sound_category} sound!”`;
        safeSetTimeout(startPerformanceRehearsal, 500);
      }
    });
  }

  if (defaultSoundBtn) {
    defaultSoundBtn.addEventListener("click", () => {
      const isWhisper = currentPlan && currentPlan.sound_type === "whisper";
      keptAudio = {
        audio_id: `default_squeak_${Date.now()}`,
        audio_source: "ghost_squeak",
        player_recording_url: "",
        ghost_imitation_url: "",
        sound_category: isWhisper ? "whisper" : "spooky",
        reaction_type: isWhisper ? "whisper" : "spooky"
      };
      if (diagAudioId) diagAudioId.textContent = keptAudio.audio_id;
      if (diagAudioSource) diagAudioSource.textContent = keptAudio.audio_source;
      if (diagCategory) diagCategory.textContent = `${keptAudio.sound_category} (synthesized)`;
      if (dialogueText) dialogueText.textContent = "“Using our standard phantom squeak! Into position!”";
      safeSetTimeout(startPerformanceRehearsal, 500);
    });
  }

  // --- Step 4: Unified Performance Runner (Rehearsal, Slower Replay, & Grand Finale) ---
  function startPerformanceRehearsal() {
    const actions = (currentPlan && currentPlan.actions && currentPlan.actions.length) ? currentPlan.actions : ["hide", "spooky_boo"];
    const pace = (currentPlan && currentPlan.pace) ? currentPlan.pace : "normal";
    const soundCat = keptAudio ? keptAudio.sound_category : (currentPlan && currentPlan.needs_sound ? currentPlan.sound_type : "none");
    const audioId = keptAudio ? keptAudio.audio_id : "none";
    const audioSrc = keptAudio ? keptAudio.audio_source : "none";

    executePerformanceSequence({
      plan: { actions, pace, needs_sound: currentPlan ? currentPlan.needs_sound : true, sound_type: currentPlan ? currentPlan.sound_type : "spooky" },
      audio: keptAudio,
      soundCat,
      audioId,
      audioSrc,
      isFinale: false
    });
  }

  async function executePerformanceSequence({ plan, audio, soundCat, audioId, audioSrc, outcome, isFinale }) {
    if (isPerforming) return;
    isPerforming = true;

    setGameState("performance");
    resetVisitorToNeutral();

    const actions = plan.actions || ["hide", "spooky_boo"];
    const pace = plan.pace || "normal";
    const needsHide = actions.includes("hide");

    if (performanceActionText) {
      if (isFinale) {
        performanceActionText.textContent = "Grand Finale Performance!";
      } else if (pace === "slow") {
        performanceActionText.textContent = "Rehearsing in agonizing slow motion...";
      } else {
        performanceActionText.textContent = "Rehearsing entrance...";
      }
    }

    // Determine Sound Delivery Type
    let deliveryType = "spooky";
    if (audio && (audio.sound_category === "whisper" || audio.reaction_type === "whisper" || plan.sound_type === "whisper")) {
      deliveryType = "whisper";
    } else if (audio && (audio.sound_category === "Ordinary Speech" || audio.reaction_type === "speech")) {
      deliveryType = "speech";
    }

    // --- PHASE 1: Destination / Concealment ---
    if (needsHide) {
      // 1. Ghost travels across courtyard to ticket booth
      if (performanceActionText) performanceActionText.textContent = "Floating across to the ticket booth...";
      if (ghostPosNode) {
        ghostPosNode.style.left = "8.5%";
        await waitForAnimation(ghostPosNode, 1800);
      }

      // 2. Ghost sinks behind opaque ticket booth counter
      if (performanceActionText) performanceActionText.textContent = "Slipping out of sight behind the ticket booth counter...";
      if (dialogueText) dialogueText.textContent = "“*shh... vanishing behind the booth*”";

      if (ghostMotionNode) {
        ghostMotionNode.classList.remove("ghost-emerge", "ghost-slower_scare");
        ghostMotionNode.classList.add("ghost-hide");
        await waitForAnimation(ghostMotionNode, 1000);
      }

      // 3. Anticipation Beat
      if (performanceActionText) {
        performanceActionText.textContent = pace === "slow" ? "Holding breath in agonizing suspense..." : "Holding breath in suspense...";
      }
      if (dialogueText) dialogueText.textContent = "“*holding my cloth breath...*”";
      setGhostExpression("pause", pace);
      await sleep(pace === "slow" ? 1400 : 700);

      // 4. Reveal & Synchronous Sound Delivery
      if (performanceActionText) {
        performanceActionText.textContent = pace === "slow" ? "Creeping reveal from behind the booth... THE SCARE!" : "A sudden reveal from the booth... THE SCARE!";
      }

      if (deliveryType === "speech") {
        if (dialogueText) dialogueText.textContent = "“‘Pardon the intrusion, kind sir... boo?’ ...Etiquette first!”";
        setGhostExpression("spooky", pace);
      } else if (deliveryType === "whisper") {
        if (dialogueText) dialogueText.textContent = "“*whispers softly from the shadows* ...boo!”";
        setGhostExpression("whisper_boo", pace);
      } else {
        if (dialogueText) dialogueText.textContent = "“BOOO! FEAR MY SHEET!”";
        setGhostExpression("spooky", pace);
      }

      if (ghostMotionNode) {
        ghostMotionNode.classList.remove("ghost-hide");
        ghostMotionNode.classList.add(pace === "slow" ? "ghost-slower_scare" : "ghost-emerge");
      }

      // SYNCHRONIZED AUDIO ONSET
      const audioPromise = playSynchronizedAudio(deliveryType);
      const motionPromise = waitForAnimation(ghostMotionNode, pace === "slow" ? 2400 : 1000);
      await Promise.all([audioPromise, motionPromise]);

    } else {
      // Open stage (no hide)
      if (ghostPosNode) ghostPosNode.style.left = "35%";

      if (actions.includes("pause")) {
        if (performanceActionText) performanceActionText.textContent = pace === "slow" ? "Holding breath in agonizing suspense..." : "Holding breath in suspense...";
        if (dialogueText) dialogueText.textContent = "“*holding my cloth breath... building suspense*”";
        setGhostExpression("pause", pace);
        await sleep(pace === "slow" ? 1400 : 700);
      }

      if (performanceActionText) performanceActionText.textContent = pace === "slow" ? "Creeping build-up... THE SCARE!" : "THE SCARE!";
      if (deliveryType === "speech") {
        if (dialogueText) dialogueText.textContent = "“‘Pardon the intrusion, kind sir... boo?’ ...Etiquette first!”";
        setGhostExpression("spooky", pace);
      } else if (deliveryType === "whisper") {
        if (dialogueText) dialogueText.textContent = "“*whispers softly* ...boo!”";
        setGhostExpression("whisper_boo", pace);
      } else {
        if (dialogueText) dialogueText.textContent = "“BOOO! FEAR MY SHEET!”";
        setGhostExpression("spooky", pace);
      }

      const audioPromise = playSynchronizedAudio(deliveryType);
      await Promise.all([audioPromise, sleep(pace === "slow" ? 1600 : 900)]);
    }

    // --- PHASE 2: Outcome Evaluation ---
    let outcomeData = outcome;
    if (!outcomeData) {
      try {
        activeAbortController = new AbortController();
        const resp = await fetch("/api/perform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions: actions,
            pace: pace,
            sound_category: soundCat || (audio ? audio.sound_category : "none"),
            audio_id: audioId || (audio ? audio.audio_id : "none"),
            audio_source: audioSrc || (audio ? audio.audio_source : "none"),
            session_id: "default_session"
          }),
          signal: activeAbortController.signal
        });
        activeAbortController = null;
        if (!resp.ok) {
          throw new Error(`Server returned ${resp.status}`);
        }
        outcomeData = await resp.json();
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Performance evaluation error:", err);
        isPerforming = false;
        showRecoverableError(`Performance evaluation paused: ${err.message}`, () => {
          executePerformanceSequence({ plan, audio, soundCat, audioId, audioSrc, outcome, isFinale });
        });
        return;
      }
    }

    // Update Diagnostics
    if (diagOutcomeResult) diagOutcomeResult.textContent = `${outcomeData.outcome} (${outcomeData.visitor_anim})`;
    if (diagOutcomeRule) diagOutcomeRule.textContent = `${outcomeData.rule_id} — ${outcomeData.rule_name || ''}`;
    if (diagRuleExplanation) diagRuleExplanation.textContent = outcomeData.rule_description || '—';
    if (diagPaceEffect) diagPaceEffect.textContent = outcomeData.pace_effect || '—';
    if (diagAudioId && outcomeData.audio_id) diagAudioId.textContent = outcomeData.audio_id;
    if (diagAudioSource && outcomeData.audio_source) diagAudioSource.textContent = outcomeData.audio_source;
    if (diagMatrixStatus && outcomeData.matrix_status) {
      diagMatrixStatus.textContent = `${outcomeData.matrix_status.status} (${outcomeData.matrix_face})`;
    }

    // Show Visitor Reaction ONLY AFTER PERFORMANCE COMPLETES
    setVisitorExpression(outcomeData.visitor_anim.replace("visitor-", ""));
    if (visitorDialogue && visitorDialogueText) {
      visitorDialogueText.textContent = `“${outcomeData.visitor_line}”`;
      visitorDialogue.classList.remove("hidden");
    }

    // Ghost Dialogue & Face
    if (dialogueText) dialogueText.textContent = `“${outcomeData.character_dialogue}”`;
    setGhostExpression(outcomeData.matrix_face);

    // --- PHASE 3: Branch Finale vs Normal Rehearsal ---
    if (!isFinale) {
      // Save full snapshot of this completed act
      lastCompletedSnapshot = {
        plan: { ...plan },
        audio: audio ? { ...audio } : null,
        soundCat,
        audioId,
        audioSrc,
        outcome: { ...outcomeData }
      };

      setGameState("outcome");
      isPerforming = false;

    } else {
      // Grand Finale: Reaction Beat -> Mutual Curtain Call Bow -> Grand Finale View
      await sleep(2200);

      // Mutual bows
      setVisitorExpression("bowing");
      if (ghostMotionNode) {
        ghostMotionNode.classList.remove("ghost-emerge", "ghost-slower_scare", "ghost-hide");
        ghostMotionNode.classList.add("ghost-curtsy_blush");
      }
      setGhostExpression("curtsy_blush");

      if (outcomeData.outcome === "amusement") {
        if (dialogueText) dialogueText.textContent = "“He liked our polite greeting! A true gentleman of the boardwalk!”";
        if (visitorDialogueText) visitorDialogueText.textContent = "“Splendid performance! You made my clockwork heart tick with joy!”";
        if (finaleNarrativeText) {
          finaleNarrativeText.textContent = "🎉 A delightfully comical haunt! Barnaby chuckles and the old carnival lights twinkle with joy!";
        }
      } else {
        if (dialogueText) dialogueText.textContent = "“We did it! A genuine abandoned-carnival haunting!”";
        if (visitorDialogueText) visitorDialogueText.textContent = "“Bravo! My springs nearly jumped right out of my chassis!”";
        if (finaleNarrativeText) {
          finaleNarrativeText.textContent = "🎉 The Carnival Phantom has found its haunt! Warm bulbs flash and the crowd cheers!";
        }
      }

      await sleep(2600);
      setGameState("finale");
      isPerforming = false;
    }
  }

  // --- Step 5: Outcome Action Buttons ---
  if (reviseBtn) {
    reviseBtn.addEventListener("click", () => {
      resetVisitorToNeutral();
      setGameState("coaching");
    });
  }

  if (againSlowerBtn) {
    againSlowerBtn.addEventListener("click", () => {
      resetVisitorToNeutral();
      const snapshot = lastCompletedSnapshot || {
        plan: currentPlan || { actions: ["hide", "spooky_boo"], pace: "normal", needs_sound: true, sound_type: "spooky" },
        audio: keptAudio,
        soundCat: keptAudio ? keptAudio.sound_category : "spooky",
        audioId: keptAudio ? keptAudio.audio_id : "none",
        audioSrc: keptAudio ? keptAudio.audio_source : "none"
      };

      // 1. Reuse last completed action sequence exactly
      // 2. Set pace to slow
      const slowerPlan = { ...snapshot.plan, pace: "slow" };

      if (diagPlanPace) diagPlanPace.textContent = "slow";
      if (diagPlanActions) diagPlanActions.textContent = slowerPlan.actions.join(" → ");

      if (dialogueText) dialogueText.textContent = "“Taking our time... creeping in agonizing slow motion!”";
      setGhostExpression("pause");

      // 3. Replay immediately at slower pace WITHOUT returning to recording or coaching!
      safeSetTimeout(() => {
        executePerformanceSequence({
          plan: slowerPlan,
          audio: snapshot.audio,
          soundCat: snapshot.soundCat,
          audioId: snapshot.audioId,
          audioSrc: snapshot.audioSrc,
          isFinale: false
        });
      }, 600);
    });
  }

  if (finaleBtn) {
    finaleBtn.addEventListener("click", () => {
      const snapshot = lastCompletedSnapshot || {
        plan: currentPlan || { actions: ["hide", "spooky_boo"], pace: "normal", needs_sound: true, sound_type: "spooky" },
        audio: keptAudio,
        soundCat: keptAudio ? keptAudio.sound_category : "spooky",
        audioId: keptAudio ? keptAudio.audio_id : "none",
        audioSrc: keptAudio ? keptAudio.audio_source : "none",
        outcome: {
          outcome: "amused",
          visitor_anim: "visitor-amused",
          visitor_line: "Haha! How charmingly well-mannered!",
          character_dialogue: "Etiquette first!",
          rule_id: "rule_3_polite_haunting"
        }
      };

      // Replay last completed act directly into earned grand finale (no fake shock fallback!)
      executePerformanceSequence({
        plan: snapshot.plan,
        audio: snapshot.audio,
        soundCat: snapshot.soundCat,
        audioId: snapshot.audioId,
        audioSrc: snapshot.audioSrc,
        outcome: snapshot.outcome,
        isFinale: true
      });
    });
  }

  // --- Step 6: Grand Finale Restart ---
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      cancelAllSceneActivity();
      currentPlan = null;
      currentRecording = null;
      keptAudio = null;
      lastCompletedSnapshot = null;
      setGameState("arrival");
    });
  }

  // --- Diagnostics Drawer Toggles ---
  if (toggleDiagBtn) {
    toggleDiagBtn.addEventListener("click", () => {
      if (!diagnosticsPanel) return;
      const isHidden = diagnosticsPanel.classList.contains("hidden");
      if (isHidden) {
        diagnosticsPanel.classList.remove("hidden");
        toggleDiagBtn.setAttribute("aria-expanded", "true");
      } else {
        diagnosticsPanel.classList.add("hidden");
        toggleDiagBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (closeDiagBtn) {
    closeDiagBtn.addEventListener("click", () => {
      if (diagnosticsPanel) diagnosticsPanel.classList.add("hidden");
      if (toggleDiagBtn) toggleDiagBtn.setAttribute("aria-expanded", "false");
    });
  }

  // Initial Boot
  setGameState("arrival");
});
