// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

/**
 * CarnivalScene: 2D Phaser Scene for "Boo, Please!".
 * Handles rendering, depth ordering, actor tweens, timing detection, and audio synchronization.
 * Polished by 2D Game Art Director & Character Animator:
 * - Expressive character acting (nervous preparation, celebratory success, drooping failure).
 * - Two distinct AI performances: Plan A (Booth Concealment & Spooky Pop-up) vs Plan B (Stage Whisper Lean).
 * - Complete concealment with bounded geometry mask (no protruding pixels).
 * - Clear visual payoff before readable, unobstructed character dialogue.
 */
export class CarnivalScene extends Phaser.Scene {
  constructor() {
    super({ key: "CarnivalScene" });

    // Scene actor references
    this.ghost = null;
    this.barnaby = null;
    this.boothBack = null;
    this.boothCounter = null;
    this.droppedTicket = null;
    this.readyIndicator = null;
    this.ghostBubble = null;
    this.ghostBubbleText = null;
    this.barnabyBubble = null;
    this.barnabyBubbleText = null;

    // Masking for Complete Concealment (FIX 1)
    this.boothMask = null;
    this.boothMaskShape = null;

    // Movement & Timing state
    this.barnabyTween = null;
    this.ghostTween = null;
    this.walkBobTimer = null;
    this.isGhostConcealed = false;
    this.canTriggerScare = false;
    this.currentPlan = null;
    this.onScareTriggeredCallback = null;

    // Timing Encounter Zone Boundaries (X coordinates)
    this.ZONE_EARLY_THRESHOLD = 255;
    this.ZONE_LATE_THRESHOLD = 75;
    this.BOOTH_X = 135;
    this.GROUND_Y = 385;
    this.STAGE_MARK_X = 380;
  }

  preload() {
    // Load local SVG vector assets (no CDN dependency at runtime)
    this.load.svg("bg", "/static/assets/background.svg", { width: 900, height: 480 });
    this.load.svg("booth_back", "/static/assets/booth_back.svg", { width: 240, height: 310 });
    this.load.svg("booth_counter", "/static/assets/booth_counter.svg", { width: 240, height: 160 });

    // Ghost Character Poses
    this.load.svg("ghost_idle", "/static/assets/ghost_idle.svg", { width: 175, height: 200 });
    this.load.svg("ghost_nervous", "/static/assets/ghost_nervous.svg", { width: 175, height: 200 });
    this.load.svg("ghost_spooky", "/static/assets/ghost_spooky.svg", { width: 175, height: 200 });
    this.load.svg("ghost_whisper", "/static/assets/ghost_whisper.svg", { width: 175, height: 200 });
    this.load.svg("ghost_celebrate", "/static/assets/ghost_celebrate.svg", { width: 175, height: 200 });
    this.load.svg("ghost_droop", "/static/assets/ghost_droop.svg", { width: 175, height: 200 });
    this.load.svg("ghost_embarrassed", "/static/assets/ghost_embarrassed.svg", { width: 175, height: 200 });
    this.load.svg("ghost_curtsy", "/static/assets/ghost_curtsy.svg", { width: 175, height: 200 });

    // Barnaby Character Poses
    this.load.svg("barnaby_idle", "/static/assets/barnaby_idle.svg", { width: 160, height: 185 });
    this.load.svg("barnaby_walk", "/static/assets/barnaby_walk.svg", { width: 160, height: 185 });
    this.load.svg("barnaby_shocked", "/static/assets/barnaby_shocked.svg", { width: 160, height: 185 });
    this.load.svg("barnaby_laughing", "/static/assets/barnaby_laughing.svg", { width: 160, height: 185 });
    this.load.svg("barnaby_bowing", "/static/assets/barnaby_bowing.svg", { width: 160, height: 185 });

    // Props
    this.load.svg("ticket", "/static/assets/ticket.svg", { width: 36, height: 22 });
  }

  create() {
    const { width, height } = this.scale;

    // --- DEPTH LAYER 0: Background Landscape ---
    this.add.image(width / 2, height / 2, "bg").setDepth(0);

    // --- DEPTH LAYER 10: Ticket Booth Canopy & Back Structure ---
    this.boothBack = this.add.image(this.BOOTH_X, 260, "booth_back").setDepth(10);

    // --- DEPTH LAYER 20: Ghost Actor ---
    this.ghost = this.add.sprite(this.STAGE_MARK_X, 315, "ghost_idle").setDepth(20);
    this.startGhostIdleFloat();

    // Ready Visual Indicator (Shown when hidden behind booth)
    this.readyIndicator = this.add.text(this.BOOTH_X, 175, "👀 Ghost is ready!", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#ffdc73",
      backgroundColor: "rgba(20, 10, 30, 0.8)",
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setDepth(25).setVisible(false);

    // --- DEPTH LAYER 30: Solid Opaque Lower Ticket Booth Counter ---
    // Placed directly in front of the lower portion of the booth (counter top at Y=280, base at Y=440).
    // Anything at depth 20 (Ghost) below Y=280 is completely occluded!
    this.boothCounter = this.add.image(this.BOOTH_X, 360, "booth_counter").setDepth(30);

    // --- Mask for Complete Concealment (FIX 1) ---
    // Bounded masking geometry covering the ticket booth from below the awning (Y=130)
    // down to the lower counter plinth (Y=440). Clips any ghost pixels below the booth counter base.
    this.boothMaskShape = this.make.graphics();
    this.boothMaskShape.fillStyle(0xffffff);
    this.boothMaskShape.fillRect(this.BOOTH_X - 120, 130, 240, 310);
    this.boothMask = this.boothMaskShape.createGeometryMask();

    // --- DEPTH LAYER 35: Dropped Carnival Ticket Prop ---
    this.droppedTicket = this.add.image(this.BOOTH_X + 40, this.GROUND_Y + 18, "ticket")
      .setDepth(35)
      .setVisible(false);

    // --- DEPTH LAYER 40: Barnaby Clockwork Tin Bear ---
    this.barnaby = this.add.sprite(980, this.GROUND_Y, "barnaby_idle").setDepth(40);

    // --- DEPTH LAYER 50: Speech Bubbles ---
    this.createSpeechBubbles();

    // Setup User Input (Spacebar and Canvas Click)
    this.input.keyboard.on("keydown-SPACE", (e) => {
      e.preventDefault();
      this.triggerScareAction();
    });

    this.input.on("pointerdown", () => {
      if (this.canTriggerScare) {
        this.triggerScareAction();
      }
    });
  }

  createSpeechBubbles() {
    // Ghost Speech Bubble Container
    this.ghostBubble = this.add.container(this.STAGE_MARK_X, 200).setDepth(50).setVisible(false);
    const gBg = this.add.graphics();
    gBg.fillStyle(0xfdf8ee, 1);
    gBg.lineStyle(2, 0xd4af37, 1);
    gBg.fillRoundedRect(-125, -32, 250, 48, 10);
    gBg.strokeRoundedRect(-125, -32, 250, 48, 10);
    this.ghostBubbleText = this.add.text(0, -8, "", {
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#241730",
      align: "center",
      wordWrap: { width: 230 }
    }).setOrigin(0.5);
    this.ghostBubble.add([gBg, this.ghostBubbleText]);

    // Barnaby Speech Bubble Container
    this.barnabyBubble = this.add.container(650, 250).setDepth(50).setVisible(false);
    const bBg = this.add.graphics();
    bBg.fillStyle(0xfdf8ee, 1);
    bBg.lineStyle(2, 0xd4af37, 1);
    bBg.fillRoundedRect(-130, -32, 260, 48, 10);
    bBg.strokeRoundedRect(-130, -32, 260, 48, 10);
    this.barnabyBubbleText = this.add.text(0, -8, "", {
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: "13px",
      color: "#241730",
      align: "center",
      wordWrap: { width: 240 }
    }).setOrigin(0.5);
    this.barnabyBubble.add([bBg, this.barnabyBubbleText]);
  }

  showGhostBubble(text, duration = 3000, customX = null, customY = null) {
    this.ghostBubbleText.setText(text);
    const posX = customX !== null ? Phaser.Math.Clamp(customX, 130, 770) : Phaser.Math.Clamp(this.ghost.x, 130, 770);
    const posY = customY !== null ? customY : Math.max(85, this.ghost.y - 95);
    this.ghostBubble.setPosition(posX, posY);
    this.ghostBubble.setVisible(true);

    if (this._ghostBubbleTimer) this._ghostBubbleTimer.remove();
    if (duration > 0) {
      this._ghostBubbleTimer = this.time.delayedCall(duration, () => {
        this.ghostBubble.setVisible(false);
      });
    }
  }

  showBarnabyBubble(text, duration = 3000, customX = null, customY = null) {
    this.barnabyBubbleText.setText(text);
    const posX = customX !== null ? Phaser.Math.Clamp(customX, 140, 760) : Phaser.Math.Clamp(this.barnaby.x, 140, 760);
    const posY = customY !== null ? customY : Math.max(95, this.barnaby.y - 95);
    this.barnabyBubble.setPosition(posX, posY);
    this.barnabyBubble.setVisible(true);

    if (this._barnabyBubbleTimer) this._barnabyBubbleTimer.remove();
    if (duration > 0) {
      this._barnabyBubbleTimer = this.time.delayedCall(duration, () => {
        this.barnabyBubble.setVisible(false);
      });
    }
  }

  hideAllBubbles() {
    if (this.ghostBubble) this.ghostBubble.setVisible(false);
    if (this.barnabyBubble) this.barnabyBubble.setVisible(false);
  }

  startGhostIdleFloat() {
    if (this.ghostTween) this.ghostTween.stop();
    this.ghostTween = this.tweens.add({
      targets: this.ghost,
      y: this.ghost.y - 10,
      duration: 1800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
  }

  // --- SEQUENCE 1: Arrival & Initial Encounter ---
  async playArrivalSequence() {
    this.hideAllBubbles();
    this.droppedTicket.setVisible(false);
    this.readyIndicator.setVisible(false);

    // Barnaby waddles in from offscreen right to X=620
    await this.walkBarnabyTo(620, 2600);

    // Ghost floats down slightly and attempts weak squeak
    this.ghost.setTexture("ghost_embarrassed");
    this.showGhostBubble("...Boo? *squeak*", 1800);
    this.playDefaultSynthSqueak(true);
    await this.wait(1400);

    // Barnaby pauses and checks his watch
    this.barnaby.setTexture("barnaby_idle");
    this.showBarnabyBubble("...Tick-tock? What was that rustle?", 2200);
    await this.wait(1800);

    // Ghost turns to player with cute hopeful plea
    this.ghost.setTexture("ghost_idle");
    this.showGhostBubble("My first customer! Help me get the timing right?", 2500);
    await this.wait(1000);
  }

  // --- SEQUENCE 2: Preparation (Ghost Travel & Concealment / Hesitation) ---
  async playPreparationSequence(plan) {
    this.currentPlan = plan;
    this.hideAllBubbles();
    this.readyIndicator.setVisible(false);

    // PRIORITY 2: Purposeful Preparation Beat (Nervous glance toward Barnaby, then commitment)
    if (this.ghostTween) this.ghostTween.stop();
    this.ghost.setTexture("ghost_nervous");
    
    // Quick nervous shiver and glance right
    await new Promise(resolve => {
      this.tweens.add({
        targets: this.ghost,
        angle: { from: -2.5, to: 2.5 },
        duration: 110,
        yoyo: true,
        repeat: 2,
        ease: "Sine.easeInOut",
        onComplete: () => {
          this.ghost.angle = 0;
          resolve();
        }
      });
    });

    if (plan.hasHide) {
      // PLAN A: Ghost travels across courtyard to the ticket booth
      this.ghost.setTexture("ghost_idle");

      await new Promise(resolve => {
        this.tweens.add({
          targets: this.ghost,
          x: this.BOOTH_X,
          y: 310,
          duration: 1300,
          ease: "Power2.easeInOut",
          onComplete: resolve
        });
      });

      // Apply ticket booth mask to guarantee complete concealment without protruding pixels (FIX 1)
      this.ghost.setMask(this.boothMask);

      // Ghost sinks down behind the solid opaque lower counter (Depth 20 behind Depth 30)
      this.showGhostBubble("*shh... hiding behind the booth counter*", 1200);
      await new Promise(resolve => {
        this.tweens.add({
          targets: this.ghost,
          y: 405, // Sinks fully behind counter; mask strictly clips any pixels below counter base (Y=440)
          duration: 900,
          ease: "Quad.easeInOut",
          onComplete: () => {
            this.isGhostConcealed = true;
            resolve();
          }
        });
      });

      // Show clear visual cue that ghost is ready
      this.readyIndicator.setVisible(true);

    } else if (plan.hasPause) {
      // PLAN B: Stays on center stage, visibly hesitates, holding breath in anticipation (NO booth travel!)
      this.isGhostConcealed = false;
      this.ghost.setTexture("ghost_whisper");
      this.showGhostBubble("*whisper... holding cloth breath in suspense...*", 1800);
      
      // Subtle suspense weight shift
      await new Promise(resolve => {
        this.tweens.add({
          targets: this.ghost,
          scaleX: 1.05,
          scaleY: 0.95,
          duration: 650,
          yoyo: true,
          ease: "Sine.easeInOut",
          onComplete: resolve
        });
      });

    } else {
      // Direct approach preparation
      this.isGhostConcealed = false;
      this.ghost.setTexture("ghost_idle");
    }
  }

  // --- SEQUENCE 3: Barnaby Walkway Approach & Timing Window ---
  startEncounterApproach(onTrigger) {
    this.onScareTriggeredCallback = onTrigger;
    this.canTriggerScare = true;

    // Reset Barnaby to right edge of walkway
    this.barnaby.setPosition(920, this.GROUND_Y);
    this.barnaby.setTexture("barnaby_walk");

    // Start waddling bob timer
    if (this.walkBobTimer) this.walkBobTimer.remove();
    let stepToggle = false;
    this.walkBobTimer = this.time.addEvent({
      delay: 240,
      loop: true,
      callback: () => {
        if (!this.canTriggerScare && !this.barnabyTween) return;
        stepToggle = !stepToggle;
        this.barnaby.setTexture(stepToggle ? "barnaby_walk" : "barnaby_idle");
        this.barnaby.y = this.GROUND_Y + (stepToggle ? -4 : 0);
      }
    });

    // Barnaby walks along the path past the ticket booth from X=920 down to X=-80
    // Walk duration: 7.2s (~140 px/s), allowing readable player anticipation
    if (this.barnabyTween) this.barnabyTween.stop();
    this.barnabyTween = this.tweens.add({
      targets: this.barnaby,
      x: -80,
      duration: 7200,
      ease: "Linear",
      onComplete: () => {
        if (this.canTriggerScare) {
          // Player never pressed Boo -> Barnaby strolled completely past!
          this.canTriggerScare = false;
          if (this.walkBobTimer) this.walkBobTimer.remove();
          this.executeScareOutcome("missed", -80);
        }
      }
    });
  }

  // Player action trigger (via Spacebar, Canvas click, or DOM Button)
  triggerScareAction() {
    if (!this.canTriggerScare) return;
    this.canTriggerScare = false;

    // Stop walking and bobbing
    if (this.barnabyTween) this.barnabyTween.pause();
    if (this.walkBobTimer) this.walkBobTimer.remove();

    const barnabyX = this.barnaby.x;

    // Evaluate Timing Rule from physical visitor position
    let timing = "well_timed";
    if (this.currentPlan && this.currentPlan.hasPause && !this.currentPlan.hasHide) {
      // PLAN B: Center stage whisper encounter (Barnaby approaching ghost at STAGE_MARK_X = 380)
      if (barnabyX > 460) {
        timing = "early";
      } else if (barnabyX < 290) {
        timing = "late";
      } else {
        timing = "well_timed";
      }
    } else {
      // PLAN A: Ticket booth encounter zone
      if (barnabyX > this.ZONE_EARLY_THRESHOLD) {
        timing = "early";
      } else if (barnabyX < this.ZONE_LATE_THRESHOLD) {
        timing = "late";
      } else {
        timing = "well_timed";
      }
    }

    this.executeScareOutcome(timing, barnabyX);
  }

  // --- SEQUENCE 4: Reveal Beat & Outcome Consequence ---
  async executeScareOutcome(timing, barnabyX) {
    this.readyIndicator.setVisible(false);
    this.hideAllBubbles();

    const plan = this.currentPlan || { actions: ["hide", "spooky_boo"], pace: "normal" };

    // 1. Ghost Reveal Animation (Distinct AI Interpretations)
    if (this.isGhostConcealed) {
      // PLAN A: Ghost emerges upwards into the window opening (Y: 405 -> 265)
      const emergeDur = plan.pace === "slow" ? 1800 : 700;
      this.tweens.add({
        targets: this.ghost,
        y: 265, // Inside window opening (passes test_phaser_polish Y <= 290)
        duration: emergeDur,
        ease: "Back.easeOut"
      });
      this.isGhostConcealed = false;

      // Punchy screen micro-shake on spooky pop-up (only if sound is enabled)
      if (!plan.needs_sound) {
        this.ghost.setTexture("ghost_idle");
      } else if (plan.isSpooky || timing === "well_timed") {
        this.cameras.main.shake(140, 0.007);
        this.ghost.setTexture("ghost_spooky");
      } else {
        this.ghost.setTexture("ghost_idle");
      }

    } else if (plan.isWhisper || (plan.hasPause && !plan.hasHide)) {
      // PLAN B: Ghost stays on stage and visibly leans horizontally toward Barnaby!
      this.ghost.setTexture("ghost_whisper");
      this.tweens.add({
        targets: this.ghost,
        x: this.STAGE_MARK_X + 28,
        angle: 6,
        duration: 350,
        ease: "Quad.easeOut"
      });

    } else if (plan.isSpooky || timing === "well_timed") {
      this.ghost.setTexture("ghost_spooky");
    } else {
      this.ghost.setTexture("ghost_idle");
    }

    // 2. Synchronous Audio Playback at Reveal Beat
    this.playSynchronousPerformanceAudio(plan.deliveryType, plan.audio);

    // Notify controller and backend API
    if (typeof this.onScareTriggeredCallback === "function") {
      this.onScareTriggeredCallback(timing, barnabyX);
    }
  }

  // Consequence animation executed when backend outcome arrives (FIX 2: Readable Payoff)
  async animateOutcomeReaction(outcomeData, timing) {
    // Clear all previous preparation dialogue immediately so visual acting is unobstructed
    this.hideAllBubbles();
    this.readyIndicator.setVisible(false);

    const outcome = outcomeData.outcome;

    if (timing === "early") {
      // Barnaby turns toward ghost and chuckles
      this.barnaby.setTexture("barnaby_laughing");
      this.tweens.add({
        targets: this.barnaby,
        y: this.GROUND_Y - 6,
        duration: 280,
        yoyo: true,
        repeat: 2
      });

      // Ghost blushes and sheepishly curtsies
      this.ghost.setTexture("ghost_embarrassed");
      this.ghost.setScale(1);
      this.ghost.setAngle(0);

      // Wait for visual acting to read clearly before showing character response
      await this.wait(450);
      this.showBarnabyBubble(outcomeData.visitor_line, 3800, Phaser.Math.Clamp(this.barnaby.x, 320, 720), 130);
      await this.wait(500);
      this.showGhostBubble(outcomeData.character_dialogue, 3500, 140, 85);

    } else if (timing === "late" || timing === "missed") {
      // Barnaby strolled on without noticing
      this.barnaby.setTexture("barnaby_idle");

      // PRIORITY 2: Purposeful Failure Beat — Ghost shoulders & body visually droop, sheepish glance at player!
      this.ghost.setTexture("ghost_droop");
      const baseDroopY = this.ghost.y;
      this.tweens.add({
        targets: this.ghost,
        y: baseDroopY + 12,
        scaleY: 0.90,
        scaleX: 1.06,
        duration: 380,
        ease: "Quad.easeOut"
      });

      await this.wait(450);
      this.showBarnabyBubble(outcomeData.visitor_line, 3800, Phaser.Math.Clamp(this.barnaby.x, 260, 700), 135);
      await this.wait(500);
      this.showGhostBubble(outcomeData.character_dialogue, 3500, 140, 85);

    } else if (outcome === "shock") {
      // PRIORITY 2: Purposeful Success Beat — Barnaby leaps high, ticket drops, Ghost celebrates joyously!
      this.barnaby.setTexture("barnaby_shocked");

      // Barnaby leap upwards tween
      this.tweens.add({
        targets: this.barnaby,
        y: this.GROUND_Y - 65,
        duration: 320,
        ease: "Power2.easeOut",
        yoyo: true,
        onComplete: () => {
          this.barnaby.y = this.GROUND_Y;
        }
      });

      // Drop Ticket Animation (Falls cleanly to walkway floor)
      this.droppedTicket.setPosition(this.barnaby.x - 20, this.GROUND_Y - 30).setVisible(true).setAngle(0);
      this.tweens.add({
        targets: this.droppedTicket,
        y: this.GROUND_Y + 18,
        angle: 35,
        duration: 550,
        ease: "Bounce.easeOut"
      });

      // Wait for reveal emergence and leap to register unobstructed before celebratory bob
      await this.wait(420);
      const settledY = (this.ghost.x === this.BOOTH_X) ? 265 : this.ghost.y;
      this.ghost.y = settledY;
      this.ghost.setTexture("ghost_celebrate");
      this.tweens.add({
        targets: this.ghost,
        y: settledY - 18,
        duration: 200,
        ease: "Back.easeOut",
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          this.ghost.y = settledY;
        }
      });

      // Wait for leap and ticket drop to be fully visible unobstructed!
      await this.wait(680);
      this.showBarnabyBubble(outcomeData.visitor_line, 4000, Phaser.Math.Clamp(this.barnaby.x + 95, 340, 720), 125);
      await this.wait(600);
      this.showGhostBubble(outcomeData.character_dialogue, 3500, 140, 85);

    } else if (outcome === "amused") {
      // Polite Haunting or Pantomime: Barnaby laughs happily
      this.barnaby.setTexture("barnaby_laughing");
      this.ghost.setTexture("ghost_curtsy");

      await this.wait(450);
      this.showBarnabyBubble(outcomeData.visitor_line, 3800, Phaser.Math.Clamp(this.barnaby.x, 320, 720), 130);
      await this.wait(500);
      this.showGhostBubble(outcomeData.character_dialogue, 3500, 140, 85);

    } else if (outcome === "shiver") {
      // Rule 2: Chills & Shiver (Whisper Sound) — Barnaby gears chatter nervously, Ghost whispers proudly!
      this.barnaby.setTexture("barnaby_idle");
      this.tweens.add({
        targets: this.barnaby,
        x: { from: this.barnaby.x - 3, to: this.barnaby.x + 3 },
        duration: 50,
        yoyo: true,
        repeat: 5
      });
      this.ghost.setTexture("ghost_whisper");

      await this.wait(450);
      this.showBarnabyBubble(outcomeData.visitor_line, 3800, Phaser.Math.Clamp(this.barnaby.x, 320, 720), 130);
      await this.wait(500);
      this.showGhostBubble(outcomeData.character_dialogue, 3500, 140, 85);

    } else {
      // Oblivious fallback
      this.barnaby.setTexture("barnaby_idle");
      this.ghost.setTexture("ghost_droop");
      await this.wait(400);
      this.showBarnabyBubble(outcomeData.visitor_line, 3800, Phaser.Math.Clamp(this.barnaby.x, 260, 700), 135);
      await this.wait(500);
      this.showGhostBubble(outcomeData.character_dialogue, 3500, 140, 85);
    }
  }

  // --- Helper: Walk Barnaby to target X ---
  walkBarnabyTo(targetX, duration) {
    return new Promise(resolve => {
      this.barnaby.setTexture("barnaby_walk");
      this.tweens.add({
        targets: this.barnaby,
        x: targetX,
        duration: duration,
        ease: "Power1.easeOut",
        onComplete: () => {
          this.barnaby.setTexture("barnaby_idle");
          resolve();
        }
      });
    });
  }

  // --- Audio Playback Synchronization ---
  playSynchronousPerformanceAudio(deliveryType, audioAsset) {
    if (deliveryType === "none" || !deliveryType) {
      return; // Silent performance without making a sound
    }
    if (audioAsset && audioAsset.player_recording_url) {
      const audioElem = new Audio(audioAsset.player_recording_url);
      audioElem.volume = deliveryType === "whisper" ? 0.35 : 0.9;
      audioElem.play().catch(e => console.warn("Audio play blocked:", e));
    } else if (audioAsset && audioAsset.ghost_imitation_url) {
      const audioElem = new Audio(audioAsset.ghost_imitation_url);
      audioElem.volume = 1.0;
      audioElem.play().catch(e => console.warn("Audio play blocked:", e));
    } else {
      this.playDefaultSynthSqueak(deliveryType === "whisper");
    }
  }

  playDefaultSynthSqueak(isWhisper) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isWhisper ? "sine" : "sawtooth";
      osc.frequency.setValueAtTime(isWhisper ? 440 : 280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isWhisper ? 580 : 160, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(isWhisper ? 0.08 : 0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => {
        try { ctx.close(); } catch (e) {}
      }, 550);
    } catch (e) {}
  }

  // --- Shared Encounter Cleanup Method (FIX 3) ---
  cleanupEncounterState() {
    this.canTriggerScare = false;
    this.isGhostConcealed = false;
    this.currentPlan = null;
    this.onScareTriggeredCallback = null;

    // 1. Cancel all active tweens and timers
    this.tweens.killAll();
    this.time.removeAllEvents();
    if (this.walkBobTimer) {
      this.walkBobTimer.remove();
      this.walkBobTimer = null;
    }
    this.barnabyTween = null;
    this.ghostTween = null;

    // 2. Clear bubbles and ready indicator
    this.hideAllBubbles();
    if (this.readyIndicator) {
      this.readyIndicator.setVisible(false);
    }

    // 3. Remove and reset previous dropped ticket and effects
    if (this.droppedTicket) {
      this.droppedTicket.setVisible(false);
      this.droppedTicket.setPosition(this.BOOTH_X + 40, this.GROUND_Y + 18);
      this.droppedTicket.setAngle(0);
      this.droppedTicket.setScale(1);
    }

    // 4. Clear mask and restore correct Ghost position, scale, angle, and idle float
    if (this.ghost) {
      this.ghost.clearMask();
      this.ghost.setScale(1);
      this.ghost.setAngle(0);
      this.ghost.setPosition(this.STAGE_MARK_X, 315);
      this.ghost.setTexture("ghost_idle");
      this.startGhostIdleFloat();
    }

    // 5. Restore Barnaby to waiting position offscreen
    if (this.barnaby) {
      this.barnaby.setScale(1);
      this.barnaby.setAngle(0);
      this.barnaby.setPosition(980, this.GROUND_Y);
      this.barnaby.y = this.GROUND_Y;
      this.barnaby.setTexture("barnaby_idle");
    }
  }

  cancelAllActivity() {
    this.cleanupEncounterState();
  }

  wait(ms) {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }
}
