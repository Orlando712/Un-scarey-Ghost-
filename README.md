# Boo, Please!

<div align="center">

**Coaching an Unscary Ghost with On-Device AI on the Arduino UNO Q**

[![Platform](https://img.shields.io/badge/Platform-Arduino%20UNO%20Q%20(Linux%20aarch64)-008184?logo=arduino&logoColor=white)](https://www.arduino.cc/)
[![LLM](https://img.shields.io/badge/LLM-Qwen%202.5%200.5B%20Instruct%20(GGUF)-blue?logo=huggingface&logoColor=white)](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF)
[![Audio](https://img.shields.io/badge/Audio-LiteRT%20YAMNet%20(15.3MB)-orange?logo=tensorflow&logoColor=white)](https://tfhub.dev/google/lite-model/yamnet/tflite/1)
[![Engine](https://img.shields.io/badge/Engine-Phaser%203.87.0-d4380d?logo=html5&logoColor=white)](https://phaser.io/)
[![License](https://img.shields.io/badge/License-MPL%202.0-brightgreen.svg)](LICENSE)

*An interactive physical-computing game where you act as an acting coach to a lovable cloth ghost haunting an abandoned carnival ticket booth. Built for DEV Hacktoberfest 2026: Ghost in the Machine.*

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Project Directory Structure](#project-directory-structure)
- [System Architecture](#system-architecture)
- [Hardware & Software Prerequisites](#hardware--software-prerequisites)
- [Quick Start Guide](#quick-start-guide)
- [How to Play: The Encounter Loop](#how-to-play-the-encounter-loop)
- [On-Device Edge Models](#on-device-edge-models)
- [REST API Reference](#rest-api-reference)
- [Automated Verification & Testing](#automated-verification--testing)
- [Technical Limitations & Boundaries](#technical-limitations--boundaries)
- [License & Acknowledgments](#license--acknowledgments)

---

## Overview

In **Boo, Please!**, you coach an endearing, completely unsuccessful ghost haunting a weathered ticket booth in a moonlit carnival courtyard. When the ghost's first visitor—a wind-up tin bear named Barnaby—arrives on stage, the ghost freezes and asks for your guidance: *"My first customer! Help me get the timing right?"*

You guide the ghost through natural conversational coaching, demonstrate vocal delivery into your microphone, watch the ghost position and conceal itself behind the booth counter, and strike the manual **BOO!** action button as the visitor walks into the encounter zone.

The entire backend—including **natural language planning** and **acoustic audio event classification**—runs **100% locally on the Arduino UNO Q microcomputer's Cortex-A53 CPU**, with zero cloud dependencies or external API subscriptions.

---

## Key Features

- **100% On-Device Edge AI:** Zero cloud calls. Both the 469 MB instruction LLM and the 15.3 MB audio classification CNN execute on the Arduino UNO Q's Linux application processor.
- **Dual-Tier Coaching Interpretation:** Combines quantized Qwen 2.5 0.5B Instruct for flexible natural-language intent parsing with a strict server-side physical stage validator that prevents broken outputs or silent fallbacks.
- **Real-Time Acoustic Sensing:** Google LiteRT YAMNet analyzes 16 kHz microphone input in under 200 ms, distinguishing scary roars and subtle whispers from polite conversational speech.
- **60 FPS Canvas Stagecraft:** Developed with Phaser 3.87 using original inline SVG artwork, custom character tweens, and strict `GeometryMask` clipping to guarantee complete concealment behind the counter.
- **Interactive Player Agency:** Scares are never automated cutscenes. The player must judge Barnaby's footsteps and strike the timing trigger to achieve the golden ticket reward.
- **Live Diagnostics Drawer:** Real-time telemetry monitoring model inference latency (ms), token generation speeds, and explicit labeling of *Model-Derived Plans* versus *Rule-Corrected Plans*.

---

## Project Directory Structure

```
.
├── arduino/
│   └── boo_sketch.ino                     # Arduino STM32 coprocessor sketch (bridge template)
│
├── docs/
│   ├── DEMO_SCRIPT.md                     # 75–90 second structured demo video recording plan
│   └── DEV_SUBMISSION_POST.md             # Authoritative text draft for DEV.to challenge submission
│
├── scripts/
│   ├── capture_prototype_screenshots.js   # Automated headless Chrome screenshot utility
│   └── record_gameplay_loop.js            # Video loop verification harness
│
├── server.py                              # Async aiohttp server, edge model orchestrator & rule engine
│
├── static/                                # Web client assets served directly by UNO Q
│   ├── assets/                            # Original illustrated SVG vector artwork
│   │   ├── background.svg                 # Moonlit carnival silhouette and weathered bunting
│   │   ├── booth_back.svg                 # Distant ticket booth interior and window framing
│   │   ├── booth_counter.svg              # Opaque weathered wooden booth counter sill
│   │   ├── barnaby_idle.svg               # Tin bear resting sprite
│   │   ├── barnaby_walk.svg               # Mechanical walking stride sprite
│   │   ├── barnaby_shocked.svg            # Startled mid-air recoil animation sprite
│   │   ├── barnaby_laughing.svg           # Amused chuckle reaction sprite
│   │   ├── barnaby_bowing.svg             # Polite curtsy / bow reaction sprite
│   │   ├── ghost_idle.svg                 # Floating cloth ghost default pose
│   │   ├── ghost_nervous.svg              # Timid glance before entering position
│   │   ├── ghost_spooky.svg               # Dramatic spooky lunge sprite
│   │   ├── ghost_whisper.svg              # Chilly forward lean whisper sprite
│   │   ├── ghost_celebrate.svg            # Joyful curtsy and celebration sprite
│   │   ├── ghost_embarrassed.svg          # Polite blushing sprite for out-of-scope requests
│   │   └── ticket.svg                     # Dropped carnival Golden Ticket prop
│   │
│   ├── prototype/                         # Modular Phaser 3 2D Game Architecture
│   │   ├── app.js                         # Application bootstrapper, DOM bindings & audio recording
│   │   ├── BoardApiClient.js              # REST client communicating with UNO Q backend
│   │   ├── CarnivalScene.js               # Phaser 3 scene, coordinate tweens, masks & visual payoffs
│   │   ├── EncounterController.js         # Finite State Machine (Intro, Arrival, Coach, Record, Stage, Outcome)
│   │   ├── PerformancePlan.js             # Data model validating action sequences, pace, and sound rules
│   │   └── style.css                      # Control dock, responsive layout, and diagnostics drawer styles
│   │
│   ├── vendor/
│   │   └── phaser.min.js                  # Pinned Phaser 3.87.0 runtime (served locally, 100% offline)
│   │
│   ├── prototype.html                     # Primary interactive game entry point (/prototype)
│   ├── index.html                         # Fallback web stage entry point (/)
│   ├── app.js                             # Legacy web stage script
│   └── style.css                          # Legacy web stage styling
│
├── test_audio/                            # Standardized 16 kHz WAV reference clips for audio CI
│   ├── 01_silence.wav                     # Baseline silence
│   ├── 02_ambient_room.wav                # Low-level background noise
│   ├── 03_speech_neutral.wav              # Neutral conversational speech
│   ├── 05_whisper_ghost.wav               # Ghostly whispering sample
│   ├── 06_boo_groan.wav                   # Spooky vocal groan sample
│   └── 07_laughter.wav                    # Amused visitor chuckle sample
│
├── tests/                                 # Automated test suites executed via Chrome CDP & Pytest
│   ├── test_ui_custom_coaching.js         # End-to-end browser test for 5 core custom coaching inputs
│   ├── test_ui_simultaneous_and_condition.js # Verification of simultaneous and position-condition rejection
│   ├── test_phaser_polish.js              # Visual regression test verifying geometry masking & payoffs
│   ├── test_coach_engine.py               # Unit tests for rule validator & LLM output sanitization
│   └── test_loop.py                       # Backend integration loop verification
│
├── .gitignore                             # Git exclusion rules (ignores virtualenvs, models, raw WAVs)
├── LICENSE                                # Mozilla Public License Version 2.0
└── README.md                              # This document
```

---

## System Architecture

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                    BROWSER CLIENT (Desktop / Mobile)                        │
 │  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐  │
 │  │   Phaser 3.87 Canvas Scene      │   │     Contextual Control Dock     │  │
 │  │  - Weathered Ticket Booth SVG   │   │  - Natural Text Coaching Input  │  │
 │  │  - Geometry Mask Hiding Bounding│   │  - Audio Recording & Synth Test │  │
 │  │  - Barnaby Tin Bear Animation   │   │  - Manual "BOO!" Timing Button  │  │
 │  │  - Golden Ticket Drop Payoff    │   │  - Real-time Diagnostics Drawer │  │
 │  └────────────────┬────────────────┘   └────────────────┬────────────────┘  │
 └───────────────────┼─────────────────────────────────────┼───────────────────┘
                     │ HTTP / JSON API Calls               │
                     ▼                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                      ARDUINO UNO Q (Linux aarch64)                          │
 │                                                                             │
 │  ┌───────────────────────────────────────────────────────────────────────┐  │
 │  │ aiohttp Server (`server.py` on Port 8080)                             │  │
 │  │  - Static Asset Delivery (`/static/vendor/phaser.min.js`, SVGs)       │  │
 │  │  - Session State & Context Resolution ("Again, but slower")          │  │
 │  │  - Deterministic Game Rule Validator (Filters fantasy/simultaneous)   │  │
 │  │  - Encounter Scorer (Calculates Well-Timed, Early, Late zones)        │  │
 │  └───────────────────────┬──────────────────────┬────────────────────────┘  │
 │                          │                      │                           │
 │                          ▼                      ▼                           │
 │  ┌──────────────────────────────┐        ┌──────────────────────────────┐   │
 │  │ llama-server (Port 9999)     │        │ LiteRT (Python XNNPACK)      │   │
 │  │ Model: Qwen 2.5 0.5B GGUF    │        │ Model: YAMNet (15.3 MB)      │   │
 │  │ Task: Semantic Action Tagging│        │ Task: Audio Event Extraction │   │
 │  │ Latency: ~4.1s (Cortex-A53)  │        │ Latency: ~180ms              │   │
 │  └──────────────────────────────┘        └──────────────────────────────┘   │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## Hardware & Software Prerequisites

### Hardware
* **Target Board:** Arduino UNO Q (Qualcomm Snapdragon quad-core Cortex-A53 CPU @ 1.8 GHz, 4 GB LPDDR4 RAM, 16 GB eMMC storage).
* **Workstation:** Mac, Linux, or Windows PC connected to the UNO Q via USB-C.

### Software on Board
* **Operating System:** Linux Lumi 6.16.7 aarch64.
* **Python Runtime:** Python 3.12+ with `aiohttp`, `numpy`, and `tflite-runtime` / `ai_edge_litert`.
* **LLM Engine:** `llama-server` compiled for Linux aarch64 with NEON optimizations.

### Software on Workstation
* **Android Debug Bridge (`adb`)**: Used to forward local networking ports across the USB-C link.
* **Modern Web Browser**: Google Chrome, Mozilla Firefox, or Apple Safari supporting WebGL and Web Audio.

---

## Quick Start Guide

### Step 1: Forward Networking Ports via ADB
With your Arduino UNO Q connected to your computer via USB-C, forward the web and model server ports:

```bash
adb forward tcp:8080 tcp:8080
adb forward tcp:9999 tcp:9999
```

### Step 2: Verify Board Services
Verify that the server and model instances are active on the board:

```bash
# Verify backend service
adb shell "systemctl status boo-please.service"

# Verify model server
adb shell "ps aux | grep llama-server"
```

If not already running, the backend service can be started directly:
```bash
adb shell "/home/arduino/audio_env/bin/python /home/arduino/boo_please/server.py"
```

### Step 3: Launch the Game
Open your web browser and navigate to:
```
http://127.0.0.1:8080/prototype
```

---

## How to Play: The Encounter Loop

```
  [1. Arrival] ───> [2. Coaching Input] ───> [3. Edge Interpretation]
                                                       │
                                                       ▼
  [6. Payoff] <─── [5. Manual BOO! Timing] <─── [4. Staging & Masking]
```

1. **Arrival Phase:** Barnaby the tin bear enters the scene from the right and pauses. The ghost asks for your coaching.
2. **Coaching Phase:** Type a natural coaching direction into the input box:
   - *"Hide behind the ticket booth, then jump out with a loud boo"*
   - *"Wait for a moment, then whisper boo"*
   - *"Hide, then emerge without making a sound"*
3. **Sound Demonstration:** For vocal performances, record audio through your microphone or use the synthesized sound previews. (Silent requests automatically bypass this step).
4. **Staging & Concealment:** The ghost travels to the booth and lowers itself behind the counter sill at $(X=135, Y=405)$ clipped completely by a Phaser geometry mask, or pauses on stage to build suspense.
5. **The Timing Trigger (Player Agency):** Barnaby resumes his mechanical walk across the walkway. When Barnaby steps in front of the window, click the large **"BOO!"** action button:
   - **Well-Timed ($80\text{px} \le X \le 255\text{px}$):** Barnaby startles high into the air, his brass wind-up key spins frantically, and he drops a gleaming **Golden Ticket**!
   - **Too Early ($X > 255\text{px}$):** Barnaby stops short and laughs at the ghost's premature attempt.
   - **Too Late ($X < 75\text{px}$):** Barnaby passes the window and turns back in mild amusement.
6. **Repetition & Iteration:** Click **"Try Timing Again"** to immediately replay the same plan with identical audio, or click **"Change My Coaching"** to try a new combination.

---

## On-Device Edge Models

| Property | Language Model | Audio Event Classifier |
| :--- | :--- | :--- |
| **Model Name** | Qwen 2.5 0.5B Instruct | LiteRT YAMNet |
| **Architecture** | Transformer Decoder | MobileNetV1 CNN |
| **Quantization / Format** | GGUF Q4_K_M | FP32 TFLite |
| **File Size** | 469 MB | 15.3 MB |
| **Inference Engine** | `llama-server` (4 CPU threads) | Google LiteRT (XNNPACK) |
| **Target Task** | Translating coaching text into action tags | Classifying vocal intensity & style |
| **Average Latency** | ~4.1 seconds | ~180 milliseconds |
| **Source & License** | [Alibaba Cloud / Qwen](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF) (Apache 2.0) | [Google Research](https://tfhub.dev/google/lite-model/yamnet/tflite/1) (Apache 2.0) |

---

## REST API Reference

The backend exposes a clean JSON REST API on port `8080`:

| Method | Endpoint | Description | Request Payload | Response Attributes |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & board status | None | `status`, `board`, `model`, `classes_count` |
| `POST` | `/api/coach` | Semantic coaching interpretation | `{"text": string, "session_id": string}` | `supported`, `actions`, `pace`, `needs_sound`, `character_dialogue`, `diagnostics` |
| `POST` | `/api/detect` | Audio waveform classification | Raw 16 kHz WAV multipart audio | `detected_class`, `confidence`, `sound_category`, `reaction_type` |
| `POST` | `/api/perform` | Evaluates timing and outcome | `{"plan": object, "timing": string}` | `outcome`, `rule_id`, `visitor_line`, `ghost_line`, `golden_ticket` |

---

## Automated Verification & Testing

The repository includes complete automated test suites executed against the live browser UI and board models via the Chrome DevTools Protocol (CDP):

```bash
# 1. Verify custom coaching inputs & semantic translation (5 core test cases)
node tests/test_ui_custom_coaching.js

# 2. Verify simultaneous action and conditional trigger rejection
node tests/test_ui_simultaneous_and_condition.js

# 3. Verify visual polish, masking, ticket drop payoff & repeat cleanup
node tests/test_phaser_polish.js

# 4. Run backend Python unit tests
python3 -m unittest discover -s tests -p "test_*.py"
```

All automated verification checks run with 100% success against the running Arduino UNO Q hardware.

---

## Technical Limitations & Boundaries

To preserve strict technical honesty regarding edge microcomputer hardware:

1. **Whitelisted Physical Repertoire:** The ghost can perform up to two actions chosen strictly from 5 physical verbs: `hide`, `pause`, `emerge`, `whisper_boo`, and `spooky_boo`. Arbitrary natural-language generation is not supported.
2. **No Simultaneous Actions:** The ghost executes actions sequentially. Requests to do two things at once (e.g. *"make sounds while hiding"*) are rejected in-character with a clear explanation.
3. **No Autonomous Conditional Triggers:** The ghost cannot watch the walkway and trigger itself (e.g. *"emerge when the visitor reaches the counter"*). In accordance with the game design, timing agency is reserved for the player via the manual **"BOO!"** action button.
4. **Pre-Trained Inference Only:** Models run zero-shot and few-shot edge inference using open pre-trained weights. No fine-tuning or training was performed on the device.
5. **LED Matrix Integration:** The hardware bridge call to the onboard LED matrix is bypassed in the prototype mode (`bridge_active: false`) to ensure web frame rates and inference latencies remain deterministic.

---

## License & Acknowledgments

- **Codebase:** Licensed under the [Mozilla Public License Version 2.0 (MPL-2.0)](LICENSE).
- **Phaser 3:** Developed by Richard Davey / [Photon Storm Ltd](https://phaser.io/) (MIT License).
- **Qwen 2.5:** Developed by the [Qwen Team / Alibaba Cloud](https://github.com/QwenLM/Qwen2.5) (Apache 2.0).
- **YAMNet:** Developed by [Google Research](https://github.com/tensorflow/models/tree/master/research/audioset/yamnet) (Apache 2.0).
- **llama.cpp:** Developed by Georgi Gerganov and contributors (MIT License).
