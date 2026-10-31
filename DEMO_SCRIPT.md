# Demo Video Script: "Boo, Please!" on Arduino UNO Q

**Target Duration:** 75–90 seconds  
**Resolution:** 1080p (1920x1080) at 60fps  
**Setup:** Picture-in-picture (PiP) or side-by-side shot combining a physical desk camera (showing the Arduino UNO Q) and screen capture (browser running `/prototype`).

---

## Shot-by-Shot Timeline

### Scene 1: The Physical Hardware & Edge Setup (0:00 – 0:15)
* **Visual:** Wide physical shot of the Arduino UNO Q board resting on the workbench, connected via a single USB-C cable to the workstation. Quick cut or split-screen showing a terminal running `adb forward tcp:8080 tcp:8080` and `systemctl status boo-please.service`.
* **Narration (Spoken):**  
  *"This is Boo, Please!—an interactive 2D carnival game running completely on the new Arduino UNO Q microcomputer. All language interpretation and audio classification run 100% on-device on the board's quad-core Linux CPU, with zero cloud APIs."*

---

### Scene 2: Entering the Courtyard & Custom Coaching (0:15 – 0:35)
* **Visual:** Full-screen browser capture at `http://127.0.0.1:8080/prototype` (with UNO Q in a small corner PiP overlay).
* **Action:** Click **"Enter Carnival"**. Barnaby the tin bear walks in. The ghost floats in and says: *"My first customer! Help me get the timing right?"*
* **Action:** The player types a natural instruction into the input box:  
  `"Hide behind the ticket booth, then jump out with a loud boo"`  
  and clicks **"Plan Approach"**.
* **Narration (Spoken):**  
  *"Our player acts as a stage coach to an endearing, completely unsuccessful ghost. We give the ghost a custom entrance instruction. Watch as the on-board Qwen 2.5 model parses our coaching into a structured stage plan."*

---

### Scene 3: On-Board Inference & Audio Demonstration (0:35 – 0:50)
* **Visual:** The "Thinking on UNO Q..." spinner pulses for ~4 seconds. The UI smoothly transitions to the sound demonstration screen.
* **Action:** Click **"Demonstrate Vocal Delivery"** (or use the microphone to whisper or give a spooky roar). Show the classification badge update to `SPOOKY ROAR` via on-board YAMNet.
* **Action:** Click **"Proceed to Staging"** (or use the synthesized test sound).
* **Narration (Spoken):**  
  *"In about four seconds, Qwen maps our natural phrasing to a validated two-step sequence: hide, then spooky boo. Next, we demonstrate how loud or scary to sound—analyzed locally in real-time by YAMNet."*

---

### Scene 4: The Performance & Golden Ticket Payoff (0:50 – 1:10)
* **Visual:** The scene springs into motion.
* **Action:** The ghost floats over to the booth, ducks down, and completely conceals behind the wooden counter sill via Phaser's geometry clipping mask.
* **Action:** Barnaby winds his way across the foreground walkway towards the booth.
* **Action:** As Barnaby steps directly in front of the counter opening, the player strikes the large **"BOO!"** action button!
* **Visual:** The ghost leaps up into the window frame! Barnaby startles high into the air, his brass wind-up key spins frantically, and he drops a gleaming **Golden Ticket** onto the ground! Dialogue bubbles appear: Barnaby says *"Eeeeek! A real phantom!"* and the ghost beams with celebration.
* **Narration (Spoken):**  
  *"The ghost conceals behind the ticket booth. Unlike a canned cutscene, the scare payoff depends on real player agency: we must watch Barnaby's footsteps and hit the 'BOO!' trigger right at the counter. Perfect timing! Barnaby is startled and drops a golden ticket!"*

---

### Scene 5: On-Device Diagnostics & Boundary Handling (1:10 – 1:25)
* **Visual:** Click the **"⚙ Diagnostics"** button in the bottom right corner to open the Diagnostics Drawer.
* **Action:** Highlight the live telemetry:
  * Model Name: `Qwen2.5-0.5B-Instruct-Q4_K_M (469MB Edge LLM)`
  * Inference Latency: `~4110ms`
  * Model-Derived Plan vs. Rule-Corrected Plan
* **Action:** Quickly type an out-of-scope request:  
  `"Turn into a dragon"`  
  Click **"Plan Approach"**. Show the ghost immediately make an embarrassed face (`ghost_embarrassed`) and politely explain its physical limits (*"I can't turn into a dragon—I'm just a small cloth ghost!"*), keeping the player in coaching without executing a broken fallback.
* **Narration (Spoken):**  
  *"The diagnostics drawer shows our live on-board telemetry: inference latency, token speeds, and deterministic rule validation. When players test impossible actions like turning into a dragon, the ghost responds in-character without crashing or faking execution."*

---

### Scene 6: Outro & Hardware Sign-off (1:25 – 1:30)
* **Visual:** Return to the physical camera showing the Arduino UNO Q board with glowing power LEDs.
* **Narration (Spoken):**  
  *"Autonomous edge intelligence, physical computing, and storybook theatre—running entirely on Arduino UNO Q. Thank you!"*

---

## Checklist for Recording

- [ ] Clear desk lighting with Arduino UNO Q centered in the physical camera frame.
- [ ] USB-C cable clearly visible connecting UNO Q to the workstation.
- [ ] Terminal window visible showing active ADB forwarding (`adb forward tcp:8080 tcp:8080`).
- [ ] Browser window sized to $1200\times 900$ for clean aspect ratio.
- [ ] Microphone tested and unmuted for vocal demonstration.
- [ ] Diagnostics drawer verified working and readable on screen.
