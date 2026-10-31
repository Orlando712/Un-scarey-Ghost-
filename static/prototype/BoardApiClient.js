// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

/**
 * Client for interacting with UNO Q backend model endpoints:
 * - /api/coach (Qwen 2.5 instruction parsing)
 * - /api/interpret (LiteRT YAMNet audio classification)
 * - /api/perform (Game rules evaluation with timing extension)
 * - /api/health (Server status)
 */
export class BoardApiClient {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
    this.activeController = null;
  }

  cancelActiveRequests() {
    if (this.activeController) {
      try {
        this.activeController.abort();
      } catch (e) {}
      this.activeController = null;
    }
  }

  async checkHealth() {
    const resp = await fetch(`${this.baseUrl}/api/health`);
    if (!resp.ok) throw new Error(`Health check returned ${resp.status}`);
    return await resp.json();
  }

  async planCoaching(text, sessionId = "prototype_session") {
    this.cancelActiveRequests();
    this.activeController = new AbortController();

    const t0 = performance.now();
    try {
      const resp = await fetch(`${this.baseUrl}/api/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), session_id: sessionId }),
        signal: this.activeController.signal
      });
      this.activeController = null;

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${resp.status}`);
      }

      const data = await resp.json();
      data._clientLatencyMs = performance.now() - t0;
      return data;
    } catch (err) {
      this.activeController = null;
      throw err;
    }
  }

  async interpretAudio(audioBlob) {
    this.cancelActiveRequests();
    this.activeController = new AbortController();

    const formData = new FormData();
    formData.append("audio", audioBlob, "prototype_recording.wav");

    try {
      const resp = await fetch(`${this.baseUrl}/api/interpret`, {
        method: "POST",
        body: formData,
        signal: this.activeController.signal
      });
      this.activeController = null;

      if (!resp.ok) {
        throw new Error(`Audio interpretation failed with ${resp.status}`);
      }
      return await resp.json();
    } catch (err) {
      this.activeController = null;
      throw err;
    }
  }

  async evaluatePerformance({ plan, timing = "well_timed", sessionId = "prototype_session" }) {
    this.cancelActiveRequests();
    this.activeController = new AbortController();

    const audio = plan.audio;
    const body = {
      actions: plan.actions,
      pace: plan.pace,
      sound_category: audio ? audio.sound_category : (plan.needs_sound ? plan.sound_type : "none"),
      audio_id: audio ? audio.audio_id : "none",
      audio_source: audio ? audio.audio_source : "none",
      timing: timing,
      session_id: sessionId
    };

    try {
      const resp = await fetch(`${this.baseUrl}/api/perform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: this.activeController.signal
      });
      this.activeController = null;

      if (!resp.ok) {
        throw new Error(`Performance evaluation failed with ${resp.status}`);
      }
      return await resp.json();
    } catch (err) {
      this.activeController = null;
      throw err;
    }
  }
}
