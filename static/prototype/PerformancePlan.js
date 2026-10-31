// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

/**
 * Validated Supported Actions and Performance Plan representation.
 * Separates data specification from scene rendering and execution.
 */
export const WHITELISTED_ACTIONS = Object.freeze([
  "hide",
  "pause",
  "emerge",
  "whisper_boo",
  "spooky_boo"
]);

export class PerformancePlan {
  constructor({
    actions = ["hide", "spooky_boo"],
    pace = "normal",
    needs_sound = true,
    sound_type = "spooky",
    character_dialogue = "",
    audio = null,
    is_development_mode = false
  } = {}) {
    this.actions = actions.filter(a => WHITELISTED_ACTIONS.includes(a)).slice(0, 2);
    if (this.actions.length === 0 && is_development_mode) {
      this.actions = ["hide", "spooky_boo"];
    }
    this.pace = (pace === "slow") ? "slow" : "normal";
    this.needs_sound = Boolean(needs_sound);
    this.sound_type = this.actions.includes("whisper_boo") ? "whisper" : (this.actions.includes("spooky_boo") ? "spooky" : "none");
    this.character_dialogue = character_dialogue || "";
    this.audio = audio; // { audio_id, audio_source, player_recording_url, ghost_imitation_url, sound_category }
    this.is_development_mode = Boolean(is_development_mode);
  }

  get hasHide() {
    return this.actions.includes("hide");
  }

  get hasPause() {
    return this.actions.includes("pause");
  }

  get hasEmerge() {
    return this.actions.includes("emerge");
  }

  get isWhisper() {
    return this.actions.includes("whisper_boo") || (this.audio && this.audio.sound_category === "whisper");
  }

  get isSpooky() {
    return this.actions.includes("spooky_boo") && (!this.audio || this.audio.sound_category !== "Ordinary Speech");
  }

  get isSpeech() {
    return Boolean(this.audio && (this.audio.sound_category === "Ordinary Speech" || this.audio.reaction_type === "speech"));
  }

  get deliveryType() {
    if (this.isSpeech) return "speech";
    if (this.isWhisper) return "whisper";
    if (this.actions.includes("spooky_boo")) return "spooky";
    return "none";
  }

  static createDefaultFixedPlan() {
    return new PerformancePlan({
      actions: ["hide", "spooky_boo"],
      pace: "normal",
      needs_sound: true,
      sound_type: "spooky",
      character_dialogue: "Hide behind the booth, then jump out with a mighty boo! (Fixed Dev Plan)",
      audio: {
        audio_id: "dev_default_squeak",
        audio_source: "built_in_synth",
        sound_category: "spooky",
        reaction_type: "spooky"
      },
      is_development_mode: true
    });
  }

  static fromServerResponse(data, keptAudio = null) {
    return new PerformancePlan({
      actions: data.actions || [],
      pace: data.pace || "normal",
      needs_sound: data.needs_sound !== undefined ? data.needs_sound : false,
      sound_type: data.sound_type || "none",
      character_dialogue: data.character_dialogue || "",
      audio: keptAudio,
      is_development_mode: false
    });
  }
}
