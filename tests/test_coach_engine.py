#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
# SPDX-License-Identifier: MPL-2.0

import re
import json
import time
import urllib.request
from typing import Dict, Any, Optional

WHITELISTED_ACTIONS = [
    "spooky_boo",
    "whisper_boo",
    "hide",
    "slower_scare",
    "curtsy_blush",
    "puzzled_tilt"
]

WHITELISTED_EMOTIONS = [
    "embarrassed",
    "happy",
    "spooky",
    "puzzled",
    "determined"
]

ACTION_MATRIX_MAP = {
    "spooky_boo": "spooky",
    "whisper_boo": "listening",
    "hide": "embarrassed",
    "slower_scare": "spooky",
    "curtsy_blush": "embarrassed",
    "puzzled_tilt": "puzzled"
}

# Character lines for deterministic coaching and fallback
GHOST_REACTIONS = {
    "curtsy_blush": [
        "I am NOT adorable! I am a terrible creature of the dark! ...Stop smiling at me, it ruins my dread.",
        "A compliment?! No! You're supposed to cower in terror! ...Though my sheet does look rather crisp.",
    ],
    "hide": [
        "Stealth tactics! Sinking below the curtains... *peeks eyes out* ...boo!",
        "Down into the floorboards I go! You can't see me, right? Right?!",
    ],
    "whisper_boo": [
        "Tiptoeing close... leaned right up to your ear... *shh*... boo!",
        "Quiet mode engaged. Maximum stealth squeak: *whisper*... boo!",
    ],
    "spooky_boo": [
        "It DID?! Ha! I knew I had real teeth! Fear my mighty, terrifying sheet!",
        "Yes! Actual human fright! Take that, mortal realm! I am a true phantom!",
    ],
    "slower_scare": [
        "Slowly... creeping forward... one... agonizing... inch... BOO!",
        "Suspense building... taking my sweet time... don't look... BOO!",
    ],
    "puzzled_tilt": [
        "My little cloth head is tilted sideways! Can you demonstrate how to scare with that?",
        "I didn't quite catch that trick. Show me with a sound or give me another tip!",
    ]
}

def classify_coaching_intent(lower_text: str, last_action: Optional[str]) -> tuple[str, str]:
    """Deterministically extracts semantic coaching intent from player input."""
    # 1. Contextual 'Again' references
    is_again = any(w in lower_text for w in ["again", "repeat", "once more", "do it again", "one more time"])
    is_slower = any(w in lower_text for w in ["slower", "slow", "creep", "suspense", "take your time"])

    if is_again:
        if not last_action:
            # Context is missing! Cannot claim understanding!
            return "puzzled_tilt", "puzzled"
        if is_slower:
            return "slower_scare", "determined"
        return last_action, "determined"

    if is_slower:
        return "slower_scare", "determined"

    # 2. Compliment / Cute
    if any(w in lower_text for w in ["adorable", "cute", "sweet", "pretty", "handsome", "love you"]):
        return "curtsy_blush", "embarrassed"

    # 3. Stealth / Hide
    if any(w in lower_text for w in ["hide", "duck", "sneak", "peek", "disappear", "duck down"]):
        return "hide", "spooky"

    # 4. Whisper
    if any(w in lower_text for w in ["whisper", "quiet", "soft", "shh", "gently"]):
        return "whisper_boo", "determined"

    # 5. Scared / Frightened
    if any(w in lower_text for w in ["scared", "spooked", "terrified", "frightened", "creepy", "horrifying"]):
        return "spooky_boo", "happy"

    return "puzzled_tilt", "puzzled"

def resolve_coaching_turn(
    player_text: str,
    session: Dict[str, Any],
    llm_url: str = "http://127.0.0.1:9999/v1/chat/completions"
) -> Dict[str, Any]:
    """Interprets coaching input with semantic intent classification + edge LLM inference."""
    t0 = time.time()
    text = player_text.strip()
    lower = text.lower()
    last_action = session.get("last_action")
    last_player = session.get("last_player_text")

    # Step A: Intent & Context Resolution
    action, emotion = classify_coaching_intent(lower, last_action)

    # Step B: Check if missing context rule applies
    is_again = any(w in lower for w in ["again", "repeat", "once more", "do it again"])
    if is_again and not last_action:
        dialogue = "Again? But we haven't done that yet! Remind me what I was doing, or show me a sound first!"
        infer_latency_ms = 0.2
        token_stats = {"cached": True, "prompt_per_second": 0, "predicted_per_second": 0}
        raw_llm = "[Direct Context Guard: Missing prior action]"
    else:
        # Step C: Query Edge LLM for dynamic in-character dialogue on UNO Q
        system_prompt = (
            f"You are the small carnival ghost in 'Boo, Please!'. You desperately want to be scary. "
            f"The player just said: \"{text}\". Your intended action is \"{action}\" with emotion \"{emotion}\". "
            f"Write 1 short comic in-character response (10-25 words max). Never repeat the user's sentence."
        )
        user_msg = f"Last action: {last_action}\nPlayer: {text}"
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg}
            ],
            "temperature": 0.4,
            "max_tokens": 45
        }
        
        t_llm = time.time()
        try:
            req = urllib.request.Request(
                llm_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            infer_latency_ms = (time.time() - t_llm) * 1000
            content = data["choices"][0]["message"]["content"].strip().strip('"')
            timings = data.get("timings", {})
            token_stats = {
                "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
                "prompt_per_second": round(timings.get("prompt_per_second", 0), 1),
                "predicted_per_second": round(timings.get("predicted_per_second", 0), 1)
            }
            raw_llm = content
            dialogue = content if len(content) > 5 else GHOST_REACTIONS[action][0]
        except Exception as e:
            infer_latency_ms = (time.time() - t_llm) * 1000
            raw_llm = f"Error/Fallback: {e}"
            token_stats = {}
            dialogue = GHOST_REACTIONS[action][0]

    # Step D: Update Session State
    session["last_action"] = action
    session["last_player_text"] = text
    session["last_dialogue"] = dialogue
    session["last_emotion"] = emotion

    total_latency_ms = (time.time() - t0) * 1000
    matrix_face = ACTION_MATRIX_MAP.get(action, "uncertain")

    return {
        "status": "success",
        "player_text": text,
        "dialogue": dialogue,
        "emotion": emotion,
        "action": action,
        "matrix_face": matrix_face,
        "latency_ms": round(total_latency_ms, 1),
        "infer_latency_ms": round(infer_latency_ms, 1),
        "token_stats": token_stats,
        "raw_llm": raw_llm
    }

if __name__ == "__main__":
    session = {}
    tests = [
        ("You're adorable", "curtsy_blush"),
        ("Hide and then whisper boo", "hide"),
        ("That scared me", "spooky_boo"),
        ("Again, but slower", "slower_scare"),
    ]
    
    print("--- TEST 1: 'Again, but slower' with NO PRIOR ACTION ---")
    empty_sess = {}
    res = resolve_coaching_turn("Again, but slower", empty_sess)
    print(f"Action: {res['action']} (Expected: puzzled_tilt)")
    print(f"Dialogue: {res['dialogue']}")
    print(f"Latency: {res['latency_ms']} ms\n")

    print("--- TEST 2: SEQUENTIAL COACHING CONVERSATION ---")
    for phrase, expected in tests:
        res = resolve_coaching_turn(phrase, session)
        print(f"Input: '{phrase}'")
        print(f"  -> Action: {res['action']} (expected: {expected})")
        print(f"  -> Emotion: {res['emotion']}")
        print(f"  -> Dialogue: {res['dialogue']}")
        print(f"  -> Latency: {res['latency_ms']} ms (LLM: {res['infer_latency_ms']} ms)")
        print(f"  -> Matrix Face: {res['matrix_face']}")
