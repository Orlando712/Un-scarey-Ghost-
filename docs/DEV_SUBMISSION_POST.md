---
title: "Teaching an Unscary Ghost to Be Scary! (on Arduino UNO Q)"
published: false
description: "How we used on-device LLM planning and audio classification on an Arduino UNO Q to teach an adorable, timid carnival ghost how to scare its first visitor."
tags: hf26challenge, devchallenge, arduino, ai
canonical_url: 
cover_image: https://raw.githubusercontent.com/Orlando712/Un-scarey-Ghost-/main/docs/assets/scare_payoff_cover.png
---

> **DEV Hacktoberfest 2026: *Ghost in the Machine* Entry**  
> **Prize Track:** Best Use of Arduino  
> *(Built with AI pair-programming assistance; tested and validated on physical hardware.)*

---

## What We Built

Meet our ghost: an endearing, completely harmless spirit made of cloth and good intentions, haunting an abandoned moonlit carnival ticket booth. There's just one problem—**they don't know how to scare anyone.**

When their very first customer—a curious wind-up tin bear named Barnaby—waddles onto the fairgrounds, the ghost completely freezes and turns to you, the stage coach, pleading:  
> *"My first customer! Help me get the timing right?"*

**Boo, Please!** is an interactive theatrical 2D game running on the new **Arduino UNO Q** microcomputer. Instead of pressing canned action buttons, you coach the ghost using natural conversational English and live vocal demonstrations:

1. **Conversational Coaching:** Type advice in plain English (*"Hide behind the booth, then jump out with a loud boo"* or *"Wait for a moment, then whisper boo"*). An on-board language model plans the ghost's choreography in real time.
2. **Vocal Demonstration:** Show the ghost how it's done by shouting or whispering into your microphone. An on-board acoustic neural network listens and rates your delivery.
3. **Stagecraft & Full Concealment:** The ghost follows your staging, floating behind the ticket booth counter (with pixel-perfect SVG masking so not even a hem protrudes) or hesitating in the shadows.
4. **Player-Controlled Scare Timing:** As Barnaby winds along the path, you watch his mechanical footsteps. When he hits the sweet spot, you strike the **"BOO!"** trigger!

If your timing is sharp (80px to 255px), the ghost leaps out, Barnaby jumps into the air with spinning brass gears, and drops a shimmering **Golden Ticket**! If you trigger too early or speak politely, Barnaby chuckles and keeps waddling, letting you refine your coaching for the next attempt.

---

## Demo Video & Art

> 🎥 **Watch the Demo Walkthrough (1m 32s):**  
> **[Direct Video Stream on GitHub](https://github.com/Orlando712/Un-scarey-Ghost-/raw/main/docs/demo_gameplay.mp4)**

*(Captures the full loop: natural-language coaching, on-device Qwen 2.5 inference, microphone acoustic test, full concealment behind the counter, manual "BOO!" scare timing, Barnaby's startled jump, Golden Ticket drop, and live on-device diagnostics.)*

### Gameplay Screenshots

![Figure 1: Barnaby the tin bear jumping in shock with spinning brass key as the ghost emerges from the booth window](https://raw.githubusercontent.com/Orlando712/Un-scarey-Ghost-/main/docs/assets/scare_payoff_cover.png)  
*Figure 1: The Golden Ticket Payoff — Barnaby startled in mid-air with spinning key, dropping the prize.*

![Figure 2: The ghost fully concealed behind the booth counter with zero downward hem protrusion](https://raw.githubusercontent.com/Orlando712/Un-scarey-Ghost-/main/docs/assets/hidden_concealment.png)  
*Figure 2: Complete Hiding Concealment — Ghost masked behind the opaque counter sill with zero downward body protrusion.*

---

## Code & Architecture

> 📦 **GitHub Repository:**  
> **[https://github.com/Orlando712/Un-scarey-Ghost-](https://github.com/Orlando712/Un-scarey-Ghost-)**

The project is structured into three clean layers:
* `server.py`: Asynchronous Python backend (`aiohttp`) managing model orchestration, session state, context resolution (*"Again, but slower"*), and physical stage validation.
* `static/prototype/`: 2D Phaser 3.87 client with custom SVG-rendered characters, geometry clipping masks, tween controllers, and interactive control dock.
* `tests/`: Automated end-to-end verification suites exercising both the canvas DOM and on-board model inference via Chrome DevTools Protocol (CDP).

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
 │  │  - Stage Rule Validator (Filters fantasy / simultaneous actions)      │  │
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

## How It Works

Running generative and acoustic models directly on edge hardware requires lean, deterministic engineering. The Arduino UNO Q features a quad-core ARM Cortex-A53 running 64-bit Linux alongside an STM32 coprocessor.

### Dual-Tier Edge Planning
Small edge language models (0.5B parameters) can occasionally hallucinate or drift on edge cases. We solved this with a two-tier approach:
* **Tier 1 (Qwen 2.5 0.5B Instruct):** Runs quantized (`Q4_K_M` GGUF) via `llama-server` on CPU threads, inferencing in ~4.1s. It translates player instructions into candidate structured tags (`hide`, `pause`, `emerge`, `whisper_boo`, `spooky_boo`).
* **Tier 2 (Physical Stage Validator):** The server cross-examines the candidate plan against physical stage rules:
  * **Simultaneous Action Guard:** Detects and politely rejects impossible requests (*"make sounds while hiding"*), explaining that actions must be sequential.
  * **Visitor-Position Condition Guard:** Detects autonomous trigger requests (*"emerge when the visitor reaches the counter"*), reminding the player that they hold the timing trigger.
  * **Out-of-Scope Fantasy Guard:** Rejects absurd inputs (*"turn into a dragon"*), keeping the player in coaching mode with an in-character explanation instead of silently substituting a default scare.

### Real-Time Voice Classification
Microphone audio is captured via Web Audio at 16 kHz PCM and transmitted to `/api/detect`. On the UNO Q, Google's **LiteRT YAMNet** (15.3 MB, 521 AudioSet classes) analyzes the waveform in ~180 ms:
* Screams, roars, and shouts are classified as high-intensity scares.
* Whispers and quiet breathing are classified as subtle, chilling sounds.
* Ordinary conversational speech produces a comical, polite haunting outcome.

### Masked 2D Stagecraft
Earlier CSS-based attempts had z-index clipping issues where the ghost's hem protruded below the counter. In our Phaser implementation:
* An exact `Phaser.Display.Masks.GeometryMask` is attached to the ticket booth counter.
* The ghost floats down to coordinates (X=135, Y=405) behind the opaque woodwork, guaranteeing 100% concealment at both normal and slow animation speeds.
* On scare trigger, the ghost emerges cleanly into the open window aperture (Y=246.5).

### Scare Timing Mechanics
Rather than relying on an automated cutscene, the scare payoff gives the player complete agency:
* **Early Zone (X > 255px):** Barnaby is too far away. He pauses, chuckles, and continues.
* **Well-Timed Zone (80px to 255px):** Barnaby is right at the counter opening. He jumps in surprise and drops the Golden Ticket!
* **Late Zone (X < 75px):** Barnaby has already walked past the window.

---

## Why Open Innovation Matters

Open innovation is what made this project possible within the strict constraints of a standalone edge development board:

1. **Open-Weight Edge Models:** Without openly licensed, efficient small models like **Qwen 2.5 0.5B** and **YAMNet**, running natural-language comprehension and audio classification directly on an ARM Cortex-A53 without cloud APIs would have been impossible.
2. **Transparent, Hackable Tooling:** The open-source `llama.cpp` runtime allowed compiling optimized NEON binaries specifically tailored for the UNO Q's Linux environment, achieving sub-5-second inference on bare CPU.
3. **Privacy & Longevity:** An interactive toy or physical installation built with open, local software never breaks because of an API deprecation, billing surge, or cloud outage. It operates entirely on the hardware in your hands.

---

## Prize Categories

### Primary Category: Best Use of Arduino
* **Target Hardware:** Arduino UNO Q (Linux aarch64 + STM32 coprocessor).
* **Why It Qualifies:**
  * Demonstrates the full potential of the UNO Q as an **autonomous edge AI microcomputer**, running both a quantized LLM and an audio CNN concurrently on-device.
  * Combines physical computing hardware, local network services, and a polished browser gaming experience.
  * Integrates robust fallback handling, real-time diagnostics monitoring, and responsive 2D canvas animation directly from the board's web server.

---

## What Do You Think? Let's Discuss! 💬

Building this project made me realize how much warmth and charm small edge models can bring to interactive hardware. Rather than treating AI as an oracle or a text search engine, it can act as the whimsical brain for an insecure little carnival ghost.

I would love to hear your thoughts and get your feedback:
- **What coaching instructions would you give our ghost?** Would you go for dramatic tension, sudden jump-scares, or polite whispering?
- **What's your experience running quantized LLMs on edge hardware like Raspberry Pi or Arduino?** How does your latency compare?
- **What other physical toys or Halloween installations would you love to see powered by local edge AI?**

Please leave your thoughts and questions in the comments below! I'll be hanging out to answer any questions about the Arduino UNO Q setup, `llama.cpp` NEON compilation, or Phaser stagecraft. Happy Hacktoberfest! 🎃👻
