// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

/**
 * EncounterController: State machine governing the carnival encounter loop.
 * Enforces explicit states and legal transitions.
 */
export const EncounterState = Object.freeze({
  IDLE: "IDLE",
  ARRIVAL: "ARRIVAL",
  COACHING: "COACHING",
  RECORDING: "RECORDING",
  PREPARING: "PREPARING",
  ENCOUNTER_APPROACH: "ENCOUNTER_APPROACH",
  REVEALING: "REVEALING",
  OUTCOME: "OUTCOME",
  RESETTING: "RESETTING"
});

export class EncounterController {
  constructor() {
    this.state = EncounterState.IDLE;
    this.currentPlan = null;
    this.keptAudio = null;
    this.lastOutcome = null;
    this.stateListeners = new Set();
    this.transitionGeneration = 0;
  }

  onStateChange(fn) {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  _notify(oldState, newState, data = {}) {
    for (const listener of this.stateListeners) {
      try {
        listener(oldState, newState, data);
      } catch (err) {
        console.error("EncounterController state listener error:", err);
      }
    }
  }

  canTransitionTo(targetState) {
    if (targetState === EncounterState.RESETTING || targetState === EncounterState.IDLE) {
      return true;
    }
    switch (this.state) {
      case EncounterState.IDLE:
        return [EncounterState.ARRIVAL, EncounterState.COACHING, EncounterState.PREPARING].includes(targetState);
      case EncounterState.ARRIVAL:
        return [EncounterState.COACHING, EncounterState.PREPARING].includes(targetState);
      case EncounterState.COACHING:
        return [EncounterState.RECORDING, EncounterState.PREPARING].includes(targetState);
      case EncounterState.RECORDING:
        return [EncounterState.PREPARING, EncounterState.COACHING].includes(targetState);
      case EncounterState.PREPARING:
        return [EncounterState.ENCOUNTER_APPROACH, EncounterState.COACHING].includes(targetState);
      case EncounterState.ENCOUNTER_APPROACH:
        return [EncounterState.REVEALING, EncounterState.COACHING, EncounterState.OUTCOME].includes(targetState);
      case EncounterState.REVEALING:
        return [EncounterState.OUTCOME, EncounterState.COACHING].includes(targetState);
      case EncounterState.OUTCOME:
        return [EncounterState.PREPARING, EncounterState.ENCOUNTER_APPROACH, EncounterState.COACHING].includes(targetState);
      case EncounterState.RESETTING:
        return targetState === EncounterState.IDLE;
      default:
        return false;
    }
  }

  transition(targetState, data = {}) {
    if (!this.canTransitionTo(targetState) && targetState !== EncounterState.RESETTING && targetState !== EncounterState.IDLE) {
      console.warn(`[EncounterController] Illegal state transition attempted: ${this.state} -> ${targetState}`);
      return false;
    }

    const oldState = this.state;
    this.state = targetState;
    this.transitionGeneration++;

    if (data.plan) this.currentPlan = data.plan;
    if (data.audio) this.keptAudio = data.audio;
    if (data.outcome) this.lastOutcome = data.outcome;

    this._notify(oldState, targetState, data);
    return true;
  }

  reset() {
    this.transition(EncounterState.RESETTING);
    this.currentPlan = null;
    this.keptAudio = null;
    this.lastOutcome = null;
    this.transition(EncounterState.IDLE);
  }
}
