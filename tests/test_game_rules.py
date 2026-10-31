#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
# SPDX-License-Identifier: MPL-2.0

def evaluate_performance(actions, pace, sound_category):
    """
    Evaluates toy visitor reaction based on documented fictional game rules:
    - Rule 1 (Shock): Stealth/Pause + Spooky sound -> visitor startled, key spins wildly.
    - Rule 2 (Shiver): Stealth/Pause + Whisper sound -> visitor shivers, gears chatter.
    - Rule 3 (Amused): Direct approach without stealth OR ordinary speech -> visitor laughs/applauds.
    - Rule 4 (Oblivious): Silence or uncertain sound -> visitor looks at watch, oblivious.
    """
    has_stealth = any(a in ["hide", "pause"] for a in actions)
    has_vocal = any(a in ["whisper_boo", "spooky_boo"] for a in actions)

    if sound_category in ["Quiet Room / Silence", "Uncertain", "uncertain"]:
        return {
            "outcome": "oblivious",
            "visitor_anim": "visitor-oblivious",
            "visitor_line": "The tin bear checks its pocketwatch, completely oblivious.",
            "ghost_line": "I don't think they even noticed me! Let's make more noise!",
            "ghost_face": "uncertain"
        }

    if sound_category == "Ordinary Speech":
        return {
            "outcome": "amused",
            "visitor_anim": "visitor-laughing",
            "visitor_line": "The tin bear chuckles and claps its paws. 'What polite conversation!'",
            "ghost_line": "Polite?! No, no, no! I am a terror of the night, not a tour guide!",
            "ghost_face": "embarrassed"
        }

    if "spooky_boo" in actions:
        if has_stealth or pace == "slow":
            return {
                "outcome": "shock",
                "visitor_anim": "visitor-shocked",
                "visitor_line": "YAAAH! The tin bear jumps a foot in the air, its winding key spinning wildly!",
                "ghost_line": "IT WORKED! We actually startled a customer! Did you see the springs rattle?!",
                "ghost_face": "spooky"
            }
        else:
            return {
                "outcome": "amused",
                "visitor_anim": "visitor-laughing",
                "visitor_line": "The tin bear saw the ghost coming from a mile away and giggles.",
                "ghost_line": "They saw me coming! We need more surprise next time.",
                "ghost_face": "embarrassed"
            }

    if "whisper_boo" in actions:
        return {
            "outcome": "shiver",
            "visitor_anim": "visitor-shivering",
            "visitor_line": "The tin bear shivers, looking over its shoulder as gears chatter nervously.",
            "ghost_line": "Subtle, refined terror! A phantom chill down the clockwork spine.",
            "ghost_face": "whisper_boo"
        }

    if actions == ["hide", "emerge"]:
        return {
            "outcome": "amused",
            "visitor_anim": "visitor-laughing",
            "visitor_line": "The tin bear applauds the peek-a-boo entrance happily!",
            "ghost_line": "A peek-a-boo pantomime! Cute, but maybe we need a roar next time.",
            "ghost_face": "curtsy_blush"
        }

    return {
        "outcome": "amused",
        "visitor_anim": "visitor-laughing",
        "visitor_line": "The tin bear tilts its head, entertained by the quirky show.",
        "ghost_line": "Well, they're entertained, at least!",
        "ghost_face": "puzzled"
    }

if __name__ == "__main__":
    test_cases = [
        (["hide", "spooky_boo"], "normal", "spooky", "shock"),
        (["pause", "whisper_boo"], "slow", "whisper", "shiver"),
        (["spooky_boo"], "normal", "Ordinary Speech", "amused"),
        (["hide", "spooky_boo"], "normal", "Quiet Room / Silence", "oblivious"),
        (["hide", "emerge"], "normal", "none", "amused")
    ]
    for act, p, snd, expected in test_cases:
        res = evaluate_performance(act, p, snd)
        assert res["outcome"] == expected, f"Failed for {act}: got {res['outcome']}, expected {expected}"
        print(f"✓ {act} ({p}, {snd}) -> {res['outcome']}: {res['visitor_line']}")
    print("All game rules validated!")
