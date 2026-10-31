#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
# SPDX-License-Identifier: MPL-2.0

import urllib.request
import json
import time

SYSTEM_PROMPT = """You are the Carnival Ghost in 'Boo, Please!'. You are earnest, expressive, and slightly incompetent at scaring.
Your dialogue must be 1-2 short comic sentences in character. Never repeat the player's instructions verbatim.

Behavior rules:
- Compliment (cute, adorable, sweet): You blush and protest that you are terrifying! Action: "curtsy_blush", emotion: "embarrassed".
- Stealth (hide, duck, peek): You hide in the shadows. Action: "hide", emotion: "spooky".
- Whisper (whisper boo, be quiet): You tiptoe and whisper boo. Action: "whisper_boo", emotion: "determined".
- Scared reaction (that scared me, you scared me): You celebrate proudly! Action: "spooky_boo", emotion: "happy".
- Slower / Creeping (again but slower, creep up): You creep forward slowly with suspense. Action: "slower_scare", emotion: "determined".
- Contextual 'Again' (again, repeat):
  * If last_action is known: adapt that previous action (e.g. slower_scare).
  * If last_action is None: you are puzzled! Dialogue: "Do what again? We haven't done anything yet!" Action: "puzzled_tilt", emotion: "puzzled".
- Confusing or unrecognized: Action: "puzzled_tilt", emotion: "puzzled".
"""

JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "dialogue": {"type": "string"},
        "emotion": {
            "type": "string",
            "enum": ["embarrassed", "happy", "spooky", "puzzled", "determined"]
        },
        "action": {
            "type": "string",
            "enum": ["curtsy_blush", "hide", "whisper_boo", "spooky_boo", "slower_scare", "puzzled_tilt"]
        }
    },
    "required": ["dialogue", "emotion", "action"]
}

def test_query(player_text, last_action=None):
    user_msg = f"Ghost State: last_action={last_action}\nPlayer said: \"{player_text}\""
    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg}
        ],
        "response_format": {
            "type": "json_object",
            "schema": JSON_SCHEMA
        },
        "temperature": 0.2,
        "max_tokens": 70
    }
    t0 = time.time()
    req = urllib.request.Request("http://127.0.0.1:9999/v1/chat/completions", 
                                 data=json.dumps(payload).encode("utf-8"), 
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    dur = time.time() - t0
    content = data["choices"][0]["message"]["content"]
    timings = data.get("timings", {})
    print(f"\n=======================================================")
    print(f"Input: '{player_text}' (last_action={last_action})")
    print(f"Latency: {dur:.2f}s | Prompt: {timings.get('prompt_per_second', 0):.1f} t/s | Gen: {timings.get('predicted_per_second', 0):.1f} t/s")
    
    try:
        parsed = json.loads(content)
        print(f"Parsed JSON:\n  dialogue: \"{parsed.get('dialogue')}\"\n  emotion:  \"{parsed.get('emotion')}\"\n  action:   \"{parsed.get('action')}\"")
    except Exception as e:
        print(f"Raw: {content}")
        print(f"JSON Parse Error: {e}")

if __name__ == "__main__":
    test_query("You're adorable")
    test_query("Hide and then whisper boo")
    test_query("That scared me")
    test_query("Again, but slower", last_action="spooky_boo")
    test_query("Again, but slower", last_action=None)
