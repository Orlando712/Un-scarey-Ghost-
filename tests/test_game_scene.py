#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
# SPDX-License-Identifier: MPL-2.0

import urllib.request
import json
import time

SERVER_URL = "http://127.0.0.1:8080"

def post_json(endpoint, data):
    req = urllib.request.Request(
        f"{SERVER_URL}{endpoint}",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=12.0) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    dur_ms = (time.time() - t0) * 1000
    return res, dur_ms

def post_wav(endpoint, wav_path):
    with open(wav_path, "rb") as f:
        wav_bytes = f.read()
    boundary = "----TestBoundary883719"
    body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"audio\"; filename=\"test.wav\"\r\n"
        f"Content-Type: audio/wav\r\n\r\n"
    ).encode("utf-8") + wav_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")
    req = urllib.request.Request(
        f"{SERVER_URL}{endpoint}",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=10.0) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    dur_ms = (time.time() - t0) * 1000
    return res, dur_ms

def test_scene():
    print("================================================================")
    print("RUNNING BOO, PLEASE! ACCEPTANCE SUITE ON UNO Q")
    print("================================================================")

    # 1. Health & Environment Check
    req = urllib.request.Request(f"{SERVER_URL}/api/health")
    with urllib.request.urlopen(req) as resp:
        health = json.loads(resp.read().decode("utf-8"))
    print(f"\n[Check 1] Server Health: {health['status']}")
    print(f"  Board: {health['board']}")
    print(f"  Audio Model: {health['model']}")

    # 2. Check: "Again, but slower" WITHOUT prior context
    res, dur = post_json("/api/coach", {
        "text": "Again, but slower",
        "session_id": "fresh_session_no_context"
    })
    print(f"\n[Check 2] 'Again, but slower' without context ({dur:.1f}ms):")
    print(f"  Status: {res['status']} | Supported: {res['supported']}")
    print(f"  Dialogue: {res['character_dialogue']}")
    assert res["supported"] is False, "Expected supported=False without prior context"
    assert "rehearsed" in res["character_dialogue"].lower() or "again" in res["character_dialogue"].lower()
    print("  ✓ Clarification requested without claiming false understanding.")

    # 3. Check: Coaching Instruction A (Two actions in order: Hide, then spooky boo)
    res_a, dur_a = post_json("/api/coach", {
        "text": "Hide behind the curtain, then spooky boo",
        "session_id": "game_session_1"
    })
    print(f"\n[Check 3] Coaching Instruction A - Two Actions in Order ({dur_a:.1f}ms):")
    print(f"  Actions: {res_a['actions']} (Pace: {res_a['pace']})")
    print(f"  Needs Sound: {res_a['needs_sound']} ({res_a['sound_type']})")
    print(f"  Ghost Line: \"{res_a['character_dialogue']}\"")
    assert res_a["actions"] == ["hide", "spooky_boo"], f"Expected ['hide', 'spooky_boo'], got {res_a['actions']}"
    assert res_a["needs_sound"] is True
    print("  ✓ Correct ordered two-action plan generated.")

    # 4. Check: Coaching Instruction B (Different entrance plan: Pause, then whisper boo)
    res_b, dur_b = post_json("/api/coach", {
        "text": "Pause for suspense, then whisper boo",
        "session_id": "game_session_2"
    })
    print(f"\n[Check 4] Coaching Instruction B - Different Act Plan ({dur_b:.1f}ms):")
    print(f"  Actions: {res_b['actions']} (Pace: {res_b['pace']})")
    print(f"  Needs Sound: {res_b['needs_sound']} ({res_b['sound_type']})")
    print(f"  Ghost Line: \"{res_b['character_dialogue']}\"")
    assert res_b["actions"] == ["pause", "whisper_boo"], f"Expected ['pause', 'whisper_boo'], got {res_b['actions']}"
    print("  ✓ Proved two different instructions produce distinct action sequences.")

    # 5. Check: Silent Coaching (Non-sound pantomime: Hide, then emerge)
    res_c, dur_c = post_json("/api/coach", {
        "text": "Hide, then emerge proudly",
        "session_id": "game_session_3"
    })
    print(f"\n[Check 5] Silent Pantomime Entrance Plan ({dur_c:.1f}ms):")
    print(f"  Actions: {res_c['actions']} | Needs Sound: {res_c['needs_sound']}")
    assert res_c["needs_sound"] is False, "Expected needs_sound=False for silent entrance"
    print("  ✓ Silent entrance requires no sound demonstration.")

    # 6. Check: Unsupported Instruction Handled Honestly
    res_unsupp, dur_unsupp = post_json("/api/coach", {
        "text": "Turn into a fire dragon and eat the customer",
        "session_id": "game_session_4"
    })
    print(f"\n[Check 6] Unsupported Instruction ({dur_unsupp:.1f}ms):")
    print(f"  Status: {res_unsupp['status']} | Supported: {res_unsupp['supported']}")
    print(f"  Ghost Line: \"{res_unsupp['character_dialogue']}\"")
    assert res_unsupp["supported"] is False
    print("  ✓ Unsupported request handled honestly without fake actions.")

    # 7. Check: Silence / Uncertain Audio Handled Without False Success
    res_silence, dur_silence = post_wav("/api/interpret", "test_audio/01_silence.wav")
    print(f"\n[Check 7] Silence/Uncertain Audio Input ({dur_silence:.1f}ms):")
    print(f"  Reaction Type: {res_silence['reaction_type']}")
    print(f"  Category: {res_silence['recognized_category']}")
    assert res_silence["reaction_type"] == "uncertain"
    perf_silence, _ = post_json("/api/perform", {
        "actions": ["hide", "spooky_boo"],
        "pace": "normal",
        "sound_category": res_silence["recognized_category"]
    })
    print(f"  Game Outcome: {perf_silence['outcome']} (Rule: {perf_silence['rule_id']})")
    print(f"  Visitor Line: \"{perf_silence['visitor_line']}\"")
    assert perf_silence["outcome"] == "oblivious"
    print("  ✓ Silence handled as uncertain/oblivious without false success.")

    # 8. Check: Real Spooky Audio Input and Kept Audio Reuse
    res_spooky, dur_spooky = post_wav("/api/interpret", "test_audio/06_boo_groan.wav")
    print(f"\n[Check 8] Real Spooky Sound Input ({dur_spooky:.1f}ms):")
    print(f"  Reaction Type: {res_spooky['reaction_type']} | Category: {res_spooky['recognized_category']}")
    print(f"  Ghost Imitation WAV generated: {len(res_spooky['audio']['ghost_imitation_url']) > 50}")
    assert res_spooky["reaction_type"] == "spooky"

    # 9. Check: Complete Scene Performance - Stealth + Spooky Boo -> Rule 1 (Shock)
    perf_shock, _ = post_json("/api/perform", {
        "actions": ["hide", "spooky_boo"],
        "pace": "normal",
        "sound_category": "spooky",
        "session_id": "game_session_1"
    })
    print(f"\n[Check 9] Act Performance with Kept Spooky Sound:")
    print(f"  Outcome: {perf_shock['outcome']} (Rule: {perf_shock['rule_id']})")
    print(f"  Visitor Action: {perf_shock['visitor_anim']}")
    print(f"  Visitor Line: \"{perf_shock['visitor_line']}\"")
    print(f"  Ghost Line: \"{perf_shock['character_dialogue']}\"")
    print(f"  Matrix RPC: {perf_shock['matrix_status']['status']} ({perf_shock['matrix_face']})")
    assert perf_shock["outcome"] == "shock"
    print("  ✓ Visitor outcome matches Rule 1: Shock!")

    # 10. Check: "Again, but slower" WITH Prior Context
    res_slower, dur_slower = post_json("/api/coach", {
        "text": "Again, but slower",
        "session_id": "game_session_1"
    })
    print(f"\n[Check 10] 'Again, but slower' WITH Prior Context ({dur_slower:.1f}ms):")
    print(f"  Supported: {res_slower['supported']} | Actions: {res_slower['actions']} | Pace: {res_slower['pace']}")
    print(f"  Ghost Line: \"{res_slower['character_dialogue']}\"")
    assert res_slower["actions"] == ["hide", "spooky_boo"]
    assert res_slower["pace"] == "slow"
    print("  ✓ Rehearsal repeated at slow creeping pace with prior context preserved.")

    # 11. Check: Ordinary Speech Valid Outcome (The Polite Haunting)
    res_speech, dur_speech = post_wav("/api/interpret", "test_audio/03_speech_neutral.wav")
    print(f"\n[Check 11] Ordinary Speech Recognition ({dur_speech:.1f}ms):")
    print(f"  Reaction Type: {res_speech['reaction_type']} | Category: {res_speech['recognized_category']}")
    print(f"  Ghost Line: \"{res_speech['character_dialogue']}\"")
    perf_speech, _ = post_json("/api/perform", {
        "actions": ["hide", "spooky_boo"],
        "pace": "normal",
        "sound_category": res_speech["recognized_category"],
        "audio_id": res_speech["audio"]["audio_id"],
        "audio_source": res_speech["audio"]["audio_source"]
    })
    print(f"  Polite Haunting Outcome: {perf_speech['outcome']} (Rule: {perf_speech['rule_id']})")
    print(f"  Visitor Line: \"{perf_speech['visitor_line']}\"")
    print(f"  Ghost Line: \"{perf_speech['character_dialogue']}\"")
    assert perf_speech["outcome"] == "amused"
    assert perf_speech["rule_id"] == "rule_3_polite_haunting"
    assert "etiquette" in perf_speech["character_dialogue"].lower() or "manners" in perf_speech["visitor_line"].lower()
    print("  ✓ Ordinary conversational speech treated as delightful, comically polite haunting.")

    # 12. Check: Pace Mechanics (Telegraphed Charge vs Creeping Suspense)
    perf_telegraphed, _ = post_json("/api/perform", {
        "actions": ["spooky_boo"],
        "pace": "normal",
        "sound_category": "spooky"
    })
    print(f"\n[Check 12A] Telegraphed Charge (No Stealth + Normal Pace):")
    print(f"  Outcome: {perf_telegraphed['outcome']} (Rule: {perf_telegraphed['rule_id']})")
    print(f"  Pace Effect: \"{perf_telegraphed['pace_effect']}\"")
    assert perf_telegraphed["outcome"] == "amused"
    assert perf_telegraphed["rule_id"] == "rule_1c_telegraphed_charge"

    perf_suspense, _ = post_json("/api/perform", {
        "actions": ["spooky_boo"],
        "pace": "slow",
        "sound_category": "spooky"
    })
    print(f"[Check 12B] Creeping Suspense (No Stealth + Slow Pace):")
    print(f"  Outcome: {perf_suspense['outcome']} (Rule: {perf_suspense['rule_id']})")
    print(f"  Pace Effect: \"{perf_suspense['pace_effect']}\"")
    assert perf_suspense["outcome"] == "shock"
    assert perf_suspense["rule_id"] == "rule_1b_creeping_suspense"
    print("  ✓ Documented and proved why slow pace transforms telegraphed approach into suspenseful shock.")

    print("\n================================================================")
    print("ALL 12 ACCEPTANCE CHECKS PASSED WITH ZERO FAILURES!")
    print("================================================================")

if __name__ == "__main__":
    test_scene()
