#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
# SPDX-License-Identifier: MPL-2.0

import urllib.request
import json
import time

SYSTEM_PROMPT = """You are the entrance director for a small carnival ghost.
Translate player instructions into a compact action plan.
Allowed actions (max 2): "hide", "pause", "emerge", "whisper_boo", "spooky_boo".
Pace: "normal" or "slow".

Respond ONLY in valid JSON matching this schema:
{
  "actions": ["action1", "action2"],
  "pace": "normal" | "slow",
  "supported": true | false
}

Examples:
Player: "Hide behind the curtain, then spooky boo"
{"actions": ["hide", "spooky_boo"], "pace": "normal", "supported": true}

Player: "Creep forward very slowly and whisper boo"
{"actions": ["pause", "whisper_boo"], "pace": "slow", "supported": true}

Player: "Pause for suspense, then jump out and emerge"
{"actions": ["pause", "emerge"], "pace": "slow", "supported": true}

Player: "Just spooky boo"
{"actions": ["spooky_boo"], "pace": "normal", "supported": true}

Player: "Turn into a fire dragon and eat the customer"
{"actions": [], "pace": "normal", "supported": false}
"""

def test_plan(user_instruction):
    t0 = time.time()
    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Instruction: {user_instruction}"}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 50
    }
    req = urllib.request.Request(
        "http://127.0.0.1:9999/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        dur = time.time() - t0
        content = data["choices"][0]["message"]["content"]
        timings = data.get("timings", {})
        print(f"\nInstruction: '{user_instruction}' ({dur:.2f}s)")
        print(f"Output: {content.strip()}")
        print(f"Rate: prompt {timings.get('prompt_per_second', 0):.1f} t/s, gen {timings.get('predicted_per_second', 0):.1f} t/s")
    except Exception as e:
        print(f"\nInstruction: '{user_instruction}' failed: {e}")

if __name__ == "__main__":
    test_plan("Hide behind the curtain, then spooky boo")
    test_plan("Pause, then whisper boo")
    test_plan("Just do a giant spooky boo")
    test_plan("Creep up slowly and then emerge")
    test_plan("Shoot laser beams from your eyes")
