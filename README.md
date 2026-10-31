# Boo, Please! — Coaching an Unscary Ghost with AI on Arduino UNO Q

> **DEV Hacktoberfest 2026: *Ghost in the Machine* Entry**  
> **Prize Category:** Best Use of Arduino  
> **Live Prototype Route:** `http://127.0.0.1:8080/prototype`

*Boo, Please!* is a 2D physical-computing theatrical game running entirely on an **Arduino UNO Q** microcomputer. The player acts as an acting coach to a small, lovable cloth ghost haunting a forgotten carnival ticket booth, teaching it how to properly scare a walking tin bear visitor named Barnaby.

The project pairs **on-device language understanding** (Qwen 2.5 0.5B Instruct) and **on-device audio event classification** (LiteRT YAMNet) running on the UNO Q's Linux application processor with a lightweight, 60fps **Phaser 3** canvas interface served directly to the player's browser.

---

## Architecture Overview

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

## Hardware & System Requirements

* **Board:** Arduino UNO Q (Linux aarch64, Qualcomm Snapdragon / Cortex-A53 quad-core CPU @ 1.8GHz, 4GB RAM, STM32U585xx MCU coprocessor).
* **OS:** Linux Lumi 6.16.7 aarch64.
* **Storage:** 16GB `/home/arduino` partition.
* **Host Machine:** Mac / Linux / Windows PC with Android Debug Bridge (`adb`) installed.
* **Browser:** Any modern Chromium, Firefox, or Safari browser supporting WebGL and Web Audio.

---

## Quick Start: Running `/prototype`

### 1. Establish ADB Port Forwarding
Connect the Arduino UNO Q to your computer via USB-C. Run the following commands on your host workstation:

```bash
# Forward the game backend (8080) and local model server (9999)
adb forward tcp:8080 tcp:8080
adb forward tcp:9999 tcp:9999
```

### 2. Verify Background Services on UNO Q
Ensure the local services are running on the board:

```bash
# Check status of the Boo Please backend
adb shell "systemctl status boo-please.service"

# Check status of the Qwen llama-server
adb shell "ps aux | grep llama-server"
```

If the service is not active, it can be launched via:
```bash
adb shell "/home/arduino/audio_env/bin/python /home/arduino/boo_please/server.py"
```

### 3. Open the Playable Prototype
In your browser on your host machine, navigate to:
```
http://127.0.0.1:8080/prototype
```

---

## How to Play (Encounter Flow)

1. **Arrival:** Click **"Enter Carnival"**. Barnaby the tin bear walks into the moonlit courtyard. The ghost confesses: *"My first customer! Help me get the timing right?"*
2. **Coaching:** Type a coaching instruction in the text box (or select a quick chip), for example:
   * `"Hide behind the ticket booth, then spooky boo"`
   * `"Wait for a moment, then whisper boo"`
   * `"Hide, then emerge without making a sound"`
3. **Sound Demonstration:**
   * For vocal scares, provide audio using your microphone or click **"Use Synthesized Spooky Sound"** / **"Use Synthesized Whisper"**.
   * For silent pantomimes (`needs_sound: false`), this step is automatically bypassed.
4. **Preparation:** The ghost glides across the courtyard and conceals itself behind the weathered counter sill using a Phaser geometry clipping mask (or freezes on stage to build suspense).
5. **The Timing Trigger (Player Agency):** Barnaby resumes his mechanical walk across the walkway. As he approaches the booth, click the large **"BOO!"** action button:
   * **Well-Timed ($80\text{px} \le X \le 255\text{px}$):** The ghost pops into the open window! Barnaby startles, his brass wind-up key spins wildly, and he drops a **Golden Ticket**!
   * **Early ($X > 255\text{px}$):** The ghost reveals itself too soon. Barnaby stops and chuckles at the overeager spirit.
   * **Late ($X < 75\text{px}$):** Barnaby passes the window before the scare occurs, turning back in mild confusion.
6. **Iteration & Pacing:** Use **"Try Timing Again"** to replay the rehearsal with the same plan, or **"Change My Coaching"** to try a new sequence.

---

## Exact Model Sources

All models run 100% locally on the Arduino UNO Q CPU with **zero cloud dependencies**:

| Model | Architecture | File Size | Precision / Format | Source & License |
| :--- | :--- | :--- | :--- | :--- |
| **Qwen 2.5 0.5B Instruct** | Transformer Decoder | ~469 MB | GGUF Q4_K_M | [Qwen Team / Alibaba Cloud](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF) (Apache 2.0) |
| **LiteRT YAMNet** | MobileNetV1 CNN | 15.3 MB | TFLite FP32 | [Google Research / TensorFlow Hub](https://tfhub.dev/google/lite-model/yamnet/tflite/1) (Apache 2.0) |

* **LLM Engine:** `llama.cpp` (`llama-server`) compiled for aarch64 NEON CPU with 4 worker threads.
* **Audio Engine:** Google LiteRT runtime with XNNPACK acceleration for Python 3.12.

---

## Third-Party Libraries & Licences

| Dependency | Purpose | Licence |
| :--- | :--- | :--- |
| **Phaser 3.87.0** | 2D Canvas rendering, tweens, clipping masks, and audio management | [MIT Licence](https://github.com/phaserjs/phaser/blob/master/LICENSE.txt) |
| **aiohttp 3.9+** | Asynchronous HTTP server and static file serving on Linux | [Apache 2.0](https://github.com/aio-libs/aiohttp/blob/master/LICENSE.txt) |
| **llama.cpp** | Local CPU inference runtime for quantized GGUF models | [MIT Licence](https://github.com/ggerganov/llama.cpp/blob/master/LICENSE) |
| **LiteRT / TFLite** | Lightweight audio classification runtime | [Apache 2.0](https://github.com/tensorflow/tensorflow/blob/master/LICENSE) |
| **Project Source Code** | Game logic, artwork, rule engine, and integration | [MPL-2.0](https://www.mozilla.org/MPL/2.0/) |

---

## Honest Limitations & Boundaries

To ensure complete transparency regarding the edge microcomputer's capabilities:

1. **Whitelisted Physical Repertoire:** The ghost is constrained to 5 discrete physical actions (`hide`, `pause`, `emerge`, `whisper_boo`, `spooky_boo`) combined in sequences of up to two. The game does **not** support unrestricted natural-language action execution.
2. **No Simultaneous Execution:** The ghost is a sequential performer. Requests to perform concurrent actions (such as *"make sounds while hiding"*) are detected and rejected with an in-character explanation.
3. **No Autonomous Conditional Triggers:** The ghost cannot track the visitor's coordinates to self-trigger (e.g. *"emerge when the visitor reaches the counter"*). In accordance with the game design, the player retains timing agency via the manual **"BOO!"** button.
4. **No On-Board Training or Fine-Tuning:** All models use pre-trained open weights. Qwen and YAMNet run pure zero-shot/few-shot edge inference.
5. **LED Matrix Integration Status:** Hardware bridge calls to the Arduino matrix display (`Bridge.call("draw")`) are bypassed in the prototype mode (`bridge_active: false`) to ensure web frame rates and inference latencies remain fully deterministic.

---

## Repository & Publication Checklist

- [ ] Public GitHub repository created and pushed: `<!-- TODO: Insert public GitHub repository URL once pushed -->`
- [ ] 60–90 second demo video recorded and uploaded: `<!-- TODO: Insert YouTube / Loom demo video link once recorded -->`
- [ ] Published to DEV under `#devchallenge` and `#hf26challenge`.
