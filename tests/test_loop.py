#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
# SPDX-License-Identifier: MPL-2.0

import json
import urllib.request
import urllib.parse
from pathlib import Path

BASE_URL = "http://localhost:8080"
TEST_AUDIO_DIR = Path(__file__).resolve().parent.parent / "test_audio"

def test_health():
    url = f"{BASE_URL}/api/health"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        assert data["status"] == "healthy"
        assert data["model_loaded"] is True
        print("✓ Health Check Passed:", data)

def test_inference(filename, expected_reaction):
    url = f"{BASE_URL}/api/interpret"
    file_path = TEST_AUDIO_DIR / filename
    assert file_path.exists(), f"Missing test file {file_path}"

    with open(file_path, "rb") as f:
        audio_bytes = f.read()

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="audio"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(b"Content-Type: audio/wav\r\n\r\n")
    body.extend(audio_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print(f"✓ [{filename}] -> Reaction: {res['reaction_type']} (Category: {res['recognized_category']}, Latency: {res['diagnostics']['inference_latency_ms']}ms)")
        assert res["reaction_type"] == expected_reaction, f"Expected {expected_reaction}, got {res['reaction_type']}"

if __name__ == "__main__":
    print("Testing Boo, Please! End-to-End Loop on localhost:8080...")
    test_health()
    test_inference("01_silence.wav", "uncertain")
    test_inference("02_ambient_room.wav", "uncertain")
    test_inference("03_speech_neutral.wav", "speech")
    test_inference("06_boo_groan.wav", "spooky")
    print("\nAll End-to-End Tests Passed Successfully!")

