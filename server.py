#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
# SPDX-License-Identifier: MPL-2.0

import csv
import io
import json
import logging
import os
import re
import sys
import time
import wave
import base64
import urllib.request
from pathlib import Path
from typing import Dict, Any, Optional

import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("BooPleaseServer")

# Configuration paths
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
MODEL_DIR = Path("/home/arduino/models/yamnet")
if not MODEL_DIR.exists():
    MODEL_DIR = BASE_DIR / "models" / "yamnet"

MODEL_PATH = MODEL_DIR / "yamnet.tflite"
MAP_PATH = MODEL_DIR / "yamnet_class_map.csv"

# Global state
app = FastAPI(title="Boo, Please! Backend", version="1.0.0")
interpreter = None
input_idx = None
output_idx = None
class_map: Dict[int, str] = {}
bridge_available = False

# 8x13 LED Matrix Ghost Faces (0-7 brightness)
# Format: 8 rows x 13 cols numpy arrays
GHOST_FRAMES = {
    "idle": np.array([
        [0, 0, 0, 2, 4, 4, 4, 4, 4, 2, 0, 0, 0],
        [0, 0, 3, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0],
        [0, 2, 5, 7, 7, 5, 5, 5, 7, 7, 5, 2, 0],
        [0, 2, 5, 7, 7, 5, 5, 5, 7, 7, 5, 2, 0],
        [0, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 0],
        [0, 2, 5, 5, 6, 0, 0, 0, 6, 5, 5, 2, 0],
        [0, 0, 3, 5, 0, 6, 6, 6, 0, 5, 3, 0, 0],
        [0, 0, 0, 2, 0, 2, 0, 2, 0, 2, 0, 0, 0]
    ], dtype=np.uint8),

    "listening": np.array([
        [0, 0, 2, 4, 5, 5, 5, 5, 5, 4, 2, 0, 0],
        [0, 2, 6, 7, 7, 6, 6, 6, 7, 7, 6, 2, 0],
        [0, 4, 7, 0, 7, 7, 7, 7, 7, 0, 7, 4, 0],
        [0, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 4, 0],
        [0, 2, 6, 6, 6, 6, 6, 6, 6, 6, 6, 2, 0],
        [0, 0, 3, 5, 0, 0, 7, 0, 0, 5, 3, 0, 0],
        [0, 0, 2, 4, 5, 5, 5, 5, 5, 4, 2, 0, 0],
        [0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0]
    ], dtype=np.uint8),

    "embarrassed": np.array([
        [0, 0, 0, 2, 4, 4, 4, 4, 4, 2, 0, 0, 0],
        [0, 0, 3, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0],
        [0, 2, 4, 0, 0, 4, 4, 4, 0, 0, 4, 2, 0],
        [0, 2, 7, 7, 7, 4, 4, 4, 7, 7, 7, 2, 0],
        [0, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 0],
        [0, 2, 5, 5, 5, 0, 7, 0, 5, 5, 5, 2, 0],
        [0, 0, 3, 4, 5, 5, 5, 5, 5, 4, 3, 0, 0],
        [0, 0, 0, 2, 0, 2, 0, 2, 0, 2, 0, 0, 0]
    ], dtype=np.uint8),

    "spooky": np.array([
        [0, 0, 3, 5, 6, 6, 6, 6, 6, 5, 3, 0, 0],
        [0, 3, 7, 7, 7, 7, 7, 7, 7, 7, 7, 3, 0],
        [0, 4, 7, 0, 7, 7, 7, 7, 7, 0, 7, 4, 0],
        [0, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 4, 0],
        [0, 2, 6, 7, 7, 0, 0, 0, 7, 7, 6, 2, 0],
        [0, 2, 5, 7, 7, 0, 0, 0, 7, 7, 5, 2, 0],
        [0, 0, 3, 5, 6, 7, 7, 7, 6, 5, 3, 0, 0],
        [0, 0, 0, 3, 0, 3, 0, 3, 0, 3, 0, 0, 0]
    ], dtype=np.uint8),

    "puzzled": np.array([
        [0, 0, 0, 2, 4, 4, 4, 4, 4, 2, 0, 0, 0],
        [0, 0, 3, 7, 7, 7, 5, 5, 5, 5, 3, 0, 0],
        [0, 2, 5, 0, 0, 5, 5, 7, 0, 7, 5, 2, 0],
        [0, 2, 5, 7, 7, 5, 5, 7, 7, 7, 5, 2, 0],
        [0, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 0],
        [0, 2, 5, 6, 6, 0, 0, 6, 6, 5, 5, 2, 0],
        [0, 0, 3, 5, 0, 6, 6, 0, 0, 5, 3, 0, 0],
        [0, 0, 0, 2, 0, 2, 0, 2, 0, 2, 0, 0, 0]
    ], dtype=np.uint8),

    "uncertain": np.array([
        [0, 0, 0, 2, 4, 4, 4, 4, 4, 2, 0, 0, 0],
        [0, 0, 3, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0],
        [0, 2, 4, 7, 4, 4, 4, 4, 7, 4, 4, 2, 0],
        [0, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2, 0],
        [0, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 0],
        [0, 2, 5, 5, 0, 6, 6, 6, 0, 5, 5, 2, 0],
        [0, 0, 3, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0],
        [0, 0, 0, 2, 0, 2, 0, 2, 0, 2, 0, 0, 0]
    ], dtype=np.uint8),

    "curtsy_blush": np.array([
        [0, 0, 0, 2, 4, 4, 4, 4, 4, 2, 0, 0, 0],
        [0, 0, 3, 5, 5, 5, 5, 5, 5, 5, 3, 0, 0],
        [0, 2, 5, 0, 0, 5, 5, 5, 0, 0, 5, 2, 0],
        [0, 2, 5, 7, 7, 5, 5, 5, 7, 7, 5, 2, 0],
        [0, 2, 7, 7, 5, 5, 5, 5, 5, 7, 7, 2, 0],
        [0, 2, 5, 5, 6, 0, 0, 0, 6, 5, 5, 2, 0],
        [0, 0, 3, 5, 0, 6, 6, 6, 0, 5, 3, 0, 0],
        [0, 0, 0, 2, 0, 2, 0, 2, 0, 2, 0, 0, 0]
    ], dtype=np.uint8),

    "hide": np.array([
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 2, 4, 5, 5, 5, 5, 5, 4, 2, 0, 0],
        [0, 2, 6, 7, 7, 6, 6, 6, 7, 7, 6, 2, 0],
        [0, 3, 7, 0, 7, 7, 7, 7, 7, 0, 7, 3, 0],
        [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7]
    ], dtype=np.uint8),

    "whisper_boo": np.array([
        [0, 0, 2, 4, 5, 5, 5, 5, 5, 4, 2, 0, 0],
        [0, 2, 6, 7, 7, 6, 6, 6, 7, 7, 6, 2, 0],
        [0, 4, 7, 0, 7, 7, 7, 7, 7, 0, 7, 4, 0],
        [0, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 4, 0],
        [0, 2, 6, 6, 6, 6, 6, 6, 6, 6, 6, 2, 0],
        [0, 0, 3, 5, 0, 7, 7, 7, 0, 5, 3, 0, 0],
        [0, 0, 2, 4, 5, 5, 5, 5, 5, 4, 2, 0, 0],
        [0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0]
    ], dtype=np.uint8),

    "slower_scare": np.array([
        [0, 0, 0, 2, 4, 4, 4, 4, 4, 2, 0, 0, 0],
        [0, 0, 3, 6, 6, 6, 6, 6, 6, 6, 3, 0, 0],
        [0, 2, 6, 0, 0, 6, 6, 6, 0, 0, 6, 2, 0],
        [0, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 4, 0],
        [0, 2, 6, 7, 7, 0, 0, 0, 7, 7, 6, 2, 0],
        [0, 2, 5, 7, 7, 0, 0, 0, 7, 7, 5, 2, 0],
        [0, 0, 3, 5, 6, 7, 7, 7, 6, 5, 3, 0, 0],
        [0, 0, 0, 2, 0, 2, 0, 2, 0, 2, 0, 0, 0]
    ], dtype=np.uint8),

    "spooky_boo": np.array([
        [0, 0, 3, 5, 6, 6, 6, 6, 6, 5, 3, 0, 0],
        [0, 3, 7, 7, 7, 7, 7, 7, 7, 7, 7, 3, 0],
        [0, 4, 7, 0, 7, 7, 7, 7, 7, 0, 7, 4, 0],
        [0, 4, 7, 7, 7, 7, 7, 7, 7, 7, 7, 4, 0],
        [0, 2, 6, 7, 7, 0, 0, 0, 7, 7, 6, 2, 0],
        [0, 2, 5, 7, 7, 0, 0, 0, 7, 7, 5, 2, 0],
        [0, 0, 3, 5, 6, 7, 7, 7, 6, 5, 3, 0, 0],
        [0, 0, 0, 3, 0, 3, 0, 3, 0, 3, 0, 0, 0]
    ], dtype=np.uint8),

    "puzzled_tilt": np.array([
        [0, 0, 0, 2, 4, 4, 4, 4, 4, 2, 0, 0, 0],
        [0, 0, 3, 7, 7, 7, 5, 5, 5, 5, 3, 0, 0],
        [0, 2, 5, 0, 0, 5, 5, 7, 0, 7, 5, 2, 0],
        [0, 2, 5, 7, 7, 5, 5, 7, 7, 7, 5, 2, 0],
        [0, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 0],
        [0, 2, 5, 6, 6, 0, 0, 6, 6, 5, 5, 2, 0],
        [0, 0, 3, 5, 0, 6, 6, 0, 0, 5, 3, 0, 0],
        [0, 0, 0, 2, 0, 2, 0, 2, 0, 2, 0, 0, 0]
    ], dtype=np.uint8)
}

def load_yamnet_model():
    """Initializes the YAMNet LiteRT interpreter and class mapping."""
    global interpreter, input_idx, output_idx, class_map
    if interpreter is not None:
        return

    logger.info("Loading YAMNet model from %s", MODEL_PATH)
    t0 = time.time()
    
    # 1. Load class mapping
    if MAP_PATH.exists():
        with open(MAP_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                class_map[int(row["index"])] = row["display_name"]
    else:
        logger.warning("Class map not found at %s", MAP_PATH)

    # 2. Load LiteRT Interpreter
    try:
        from ai_edge_litert.interpreter import Interpreter
        interpreter = Interpreter(model_path=str(MODEL_PATH))
        interpreter.allocate_tensors()
        input_idx = interpreter.get_input_details()[0]["index"]
        output_idx = interpreter.get_output_details()[0]["index"]
        logger.info("YAMNet loaded successfully in %.1f ms", (time.time() - t0) * 1000)
    except Exception as e:
        logger.error("Failed to load LiteRT interpreter: %s", e)
        raise e

def send_matrix_frame(expression_name: str) -> Dict[str, Any]:
    """Updates the UNO Q physical LED matrix via Bridge RPC if available."""
    global bridge_available
    arr = GHOST_FRAMES.get(expression_name)
    if arr is None:
        return {"status": "error", "message": f"Unknown expression: {expression_name}"}

    # Convert 8x13 frame to 104 bytes scaled to 0-255
    scale_factor = 255.0 / 7.0
    scaled = (arr.astype(float) * scale_factor).round().astype(np.uint8)
    frame_bytes = scaled.flatten().tolist()

    try:
        from arduino.app_utils import Bridge
        # Call draw with 400ms timeout so matrix failure never blocks web stage
        Bridge.call("draw", frame_bytes, timeout=0.4)
        bridge_available = True
        return {"status": "updated", "expression": expression_name}
    except Exception as e:
        bridge_available = False
        logger.debug("Matrix update skipped/failed: %s", e)
        return {"status": "skipped", "reason": str(e), "expression": expression_name}

def transform_audio_for_ghost(samples: np.ndarray, sr: int = 16000) -> str:
    """Transforms player recording into a squeaky ethereal ghost imitation.
    Returns base64 data URI of the resulting WAV."""
    if len(samples) == 0:
        return ""

    # 1. Pitch shift up ~4 semitones by linear resampling (1.26x speedup)
    speed_factor = 1.26
    out_len = int(len(samples) / speed_factor)
    orig_indices = np.linspace(0, len(samples) - 1, len(samples))
    resampled_indices = np.linspace(0, len(samples) - 1, out_len)
    shifted = np.interp(resampled_indices, orig_indices, samples)

    # 2. Ethereal ghost echo (120ms delay, decaying)
    delay_samples = int(0.12 * sr)
    echo_buf = np.zeros(len(shifted) + delay_samples, dtype=np.float32)
    echo_buf[:len(shifted)] += shifted
    echo_buf[delay_samples:] += 0.35 * shifted
    echo_buf = np.clip(echo_buf, -1.0, 1.0)

    # 3. Encode to 16-bit PCM WAV in memory
    pcm16 = (echo_buf * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm16.tobytes())

    encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:audio/wav;base64,{encoded}"

@app.on_event("startup")
async def startup_event():
    load_yamnet_model()
    # Try initial idle face
    send_matrix_frame("idle")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return HTMLResponse(content=index_file.read_text(encoding="utf-8"))

@app.get("/prototype", response_class=HTMLResponse)
async def serve_prototype():
    proto_file = STATIC_DIR / "prototype.html"
    if not proto_file.exists():
        raise HTTPException(status_code=404, detail="prototype.html not found")
    return HTMLResponse(content=proto_file.read_text(encoding="utf-8"))

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "board": "Arduino UNO Q (Linux aarch64 + STM32U585xx)",
        "model": "YAMNet (15.3MB, 521 AudioSet classes, LiteRT CPU XNNPACK)",
        "model_loaded": interpreter is not None,
        "classes_count": len(class_map),
        "bridge_active": bridge_available
    }

@app.post("/api/matrix/preview")
async def matrix_preview(expression: str = Form(...)):
    res = send_matrix_frame(expression)
    return res

@app.post("/api/interpret")
async def interpret_audio(audio: UploadFile = File(...)):
    start_time = time.time()
    
    # 1. Read input bytes and enforce size limits (max 5 MB)
    raw_bytes = await audio.read()
    if len(raw_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file exceeds 5MB limit.")
    if len(raw_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio file is empty or too short.")

    # 2. Parse WAV container
    try:
        with wave.open(io.BytesIO(raw_bytes), "rb") as w:
            n_channels = w.getnchannels()
            sampwidth = w.getsampwidth()
            framerate = w.getframerate()
            n_frames = w.getnframes()
            audio_data = w.readframes(n_frames)
    except wave.Error as e:
        raise HTTPException(status_code=400, detail=f"Invalid WAV format: {e}. Browser must submit PCM WAV.")

    # 3. Unpack to float32 [-1.0, 1.0]
    if sampwidth == 2:
        samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
    elif sampwidth == 1:
        samples = (np.frombuffer(audio_data, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif sampwidth == 4:
        samples = np.frombuffer(audio_data, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported sample width: {sampwidth}")

    if n_channels > 1:
        samples = samples[::n_channels]

    # Enforce duration bounds (0.5s to 8.0s)
    duration_s = len(samples) / float(framerate)
    if duration_s < 0.5:
        raise HTTPException(status_code=400, detail="Audio recording too short (< 0.5s). Hold to record 2-3 seconds.")

    # 4. Resample to 16,000 Hz if needed
    t_resample_start = time.time()
    if framerate != 16000:
        target_len = int(duration_s * 16000)
        orig_times = np.linspace(0, duration_s, len(samples), endpoint=False)
        target_times = np.linspace(0, duration_s, target_len, endpoint=False)
        samples = np.interp(target_times, orig_times, samples).astype(np.float32)
        framerate = 16000
    resample_latency_ms = (time.time() - t_resample_start) * 1000

    # 5. Measure Signal Characteristics
    rms = float(np.sqrt(np.mean(samples**2)))
    peak = float(np.max(np.abs(samples)))

    # 6. Run YAMNet Inference on UNO Q
    t_infer_start = time.time()
    interpreter.resize_tensor_input(input_idx, [len(samples)], strict=False)
    interpreter.allocate_tensors()
    interpreter.set_tensor(input_idx, samples)
    interpreter.invoke()
    scores = interpreter.get_tensor(output_idx) # (N_frames, 521)
    infer_latency_ms = (time.time() - t_infer_start) * 1000

    # 7. Aggregate Scores Across Evaluated Frames
    mean_scores = np.mean(scores, axis=0)
    peak_scores = np.max(scores, axis=0)
    top_indices = np.argsort(mean_scores)[::-1][:6]

    top_predictions = [
        {
            "class_id": int(i),
            "label": class_map.get(int(i), f"Class {i}"),
            "mean_confidence": round(float(mean_scores[i]), 4),
            "peak_confidence": round(float(peak_scores[i]), 4)
        }
        for i in top_indices
    ]

    top_label = top_predictions[0]["label"]
    top_mean = top_predictions[0]["mean_confidence"]

    # 8. Character Reaction Logic (Strict Category Classification)
    # Target spooky classes verified in empirical testing
    SPOOKY_LABELS = {
        "Howl", "Groan", "Grunt", "Animal", "Roar", "Screaming", "Shout",
        "Whispering", "Laughter", "Giggle", "Snicker", "Sigh"
    }

    spooky_matches = [p for p in top_predictions if p["label"] in SPOOKY_LABELS]
    speech_score = float(mean_scores[0]) if 0 in class_map else 0.0 # class 0 is Speech
    silence_score = float(mean_scores[494]) if 494 in class_map else 0.0

    reaction_type = "uncertain"
    character_dialogue = ""
    recognized_category = ""
    matrix_face = "uncertain"

    # Decision Path 1: Silence or Near-Zero Background
    if silence_score > 0.40 or rms < 0.010 or (top_mean < 0.20 and peak < 0.04):
        reaction_type = "uncertain"
        recognized_category = "Quiet Room / Silence"
        character_dialogue = "Hmm... was that the wind whistling through the tent slats, or were you just being shy? Give me your best spooky sound!"
        matrix_face = "uncertain"

    # Decision Path 2: Recognizable Spooky Vocalization
    elif spooky_matches and (spooky_matches[0]["peak_confidence"] >= 0.28 or spooky_matches[0]["mean_confidence"] >= 0.18) and speech_score < 0.65:
        spooky_match = spooky_matches[0]
        reaction_type = "spooky"
        recognized_category = spooky_match["label"]
        matrix_face = "spooky"
        character_dialogue = f"Eek! Oh my cloth, that had actual teeth! That was a genuine {spooky_match['label'].lower()}! Gather courage, little sheet... watch my imitation!"

    # Decision Path 3: Ordinary Conversational Speech
    elif top_label in ["Speech", "Narration, monologue", "Conversation"] or speech_score >= 0.45:
        reaction_type = "speech"
        recognized_category = "Ordinary Speech"
        matrix_face = "curtsy_blush"
        character_dialogue = "“Human conversation! How delightfully civilized. Let's see if Barnaby appreciates some fine carnival etiquette!”"

    # Decision Path 4: Unrecognized / Background / Low Confidence
    else:
        reaction_type = "uncertain"
        recognized_category = f"Uncertain ({top_label})"
        matrix_face = "uncertain"
        character_dialogue = f"I heard something like '{top_label}', but I couldn't quite catch the scare! Can you demonstrate it once more?"

    # 9. Trigger Physical Matrix Expression
    matrix_result = send_matrix_frame(matrix_face)

    # 10. Generate Transformed Imitation Audio for Ghost
    ghost_audio_uri = ""
    if reaction_type == "spooky":
        ghost_audio_uri = transform_audio_for_ghost(samples, sr=16000)

    # Player original audio as data URI for playback
    player_audio_uri = f"data:audio/wav;base64,{base64.b64encode(raw_bytes).decode('utf-8')}"

    end_to_end_ms = (time.time() - start_time) * 1000

    audio_id = f"aud_{int(time.time()*1000)}_{reaction_type}"

    # Update default session state with audio turn
    default_sess = SESSION_STATE.setdefault("default_session", {
        "last_plan": None, "last_audio": None, "history": []
    })
    default_sess["last_audio"] = {
        "audio_id": audio_id,
        "audio_source": "player_mic",
        "player_recording_url": player_audio_uri,
        "ghost_imitation_url": ghost_audio_uri,
        "reaction_type": reaction_type,
        "recognized_category": recognized_category,
        "duration_s": round(duration_s, 2)
    }
    default_sess["last_dialogue"] = character_dialogue

    return JSONResponse(content={
        "status": "success",
        "reaction_type": reaction_type,
        "character_dialogue": character_dialogue,
        "recognized_category": recognized_category,
        "matrix_face": matrix_face,
        "matrix_status": matrix_result,
        "audio": {
            "audio_id": audio_id,
            "audio_source": "player_mic",
            "player_recording_url": player_audio_uri,
            "ghost_imitation_url": ghost_audio_uri,
            "duration_s": round(duration_s, 2),
            "peak_amplitude": round(peak, 3),
            "rms_amplitude": round(rms, 4)
        },
        "diagnostics": {
            "model_name": "YAMNet (AudioSet TFLite)",
            "frames_evaluated": int(scores.shape[0]),
            "inference_latency_ms": round(infer_latency_ms, 1),
            "resample_latency_ms": round(resample_latency_ms, 1),
            "end_to_end_latency_ms": round(end_to_end_ms, 1),
            "top_predictions": top_predictions
        }
    })

# --- Game Engine & Semantic Coaching Architecture ---

SESSION_STATE: Dict[str, Dict[str, Any]] = {}

WHITELISTED_ACTIONS = [
    "hide",
    "pause",
    "emerge",
    "whisper_boo",
    "spooky_boo"
]

ACTION_MATRIX_MAP = {
    "hide": "hide",
    "pause": "listening",
    "emerge": "idle",
    "whisper_boo": "whisper_boo",
    "spooky_boo": "spooky_boo",
    "slower_scare": "slower_scare",
    "puzzled_tilt": "puzzled_tilt",
    "curtsy_blush": "curtsy_blush"
}

ENTRANCE_PLANNING_SYSTEM_PROMPT = """You are the entrance director for a small carnival ghost.
Translate player coaching into a validated plan using ONLY these 5 allowed actions:
- "hide": stay out of sight, conceal behind booth/trunk, duck down
- "pause": wait for a moment, wait, hold still, freeze, bide time
- "emerge": pop up, appear, reveal without sound
- "whisper_boo": whisper boo, soft whisper, chilly whisper
- "spooky_boo": jump out with a loud boo, loud boo, spooky boo, roar, shout boo

Pace: "normal" or "slow".
Allowed actions list can have at most 2 actions in order.
Actions must be sequential, NOT simultaneous (e.g. ghost cannot make sounds while hiding).
Ghost cannot trigger itself based on visitor position (player controls reveal timing).
If the instruction cannot be done using these 5 ghost actions or requests simultaneous actions or visitor position conditions, output "actions": [] and "supported": false.

Respond ONLY in valid JSON matching this schema:
{
  "actions": ["action1", "action2"],
  "pace": "normal" | "slow",
  "supported": true | false
}

Examples:
Player: "Hide behind the ticket booth, then spooky boo"
{"actions": ["hide", "spooky_boo"], "pace": "normal", "supported": true}

Player: "Stay out of sight, then jump out with a loud boo"
{"actions": ["hide", "spooky_boo"], "pace": "normal", "supported": true}

Player: "Wait for a moment, then whisper boo"
{"actions": ["pause", "whisper_boo"], "pace": "normal", "supported": true}

Player: "Hide, then emerge without making a sound"
{"actions": ["hide", "emerge"], "pace": "normal", "supported": true}

Player: "Make sounds while hiding, then emerge when the visitor reaches the counter"
{"actions": [], "pace": "normal", "supported": false}

Player: "dosoundswhilehidingandemergewhenitisatcounter"
{"actions": [], "pace": "normal", "supported": false}

Player: "Turn into a dragon"
{"actions": [], "pace": "normal", "supported": false}
"""

def parse_and_validate_coaching(text: str, qwen_parsed: Optional[dict] = None) -> Dict[str, Any]:
    """
    Validates and normalizes coaching input against the ghost's physical capability set:
    - Supported actions: "hide", "pause", "emerge", "whisper_boo", "spooky_boo"
    - Supported pace: "normal", "slow"
    - Never silently substitutes a default performance for unsupported instructions.
    - Explicitly explains limitations when simultaneous actions or visitor-position conditions are requested.
    """
    lower = text.lower().strip()

    # 0. Check for simultaneous actions and visitor-position conditions
    simultaneous_patterns = [
        r'\bwhile\s+(hiding|hidden|concealed|ducked|pausing|waiting)\b',
        r'\b(sound|sounds|noise|noises)\s+while\b',
        r'whilehiding',
        r'dosound(s)?while',
        r'sound(s)?while',
        r'\bat\s+the\s+same\s+time\b',
        r'\bsimultaneous(ly)?\b',
        r'\bmake\s+(a\s+)?(sound|sounds)\s+while\b'
    ]
    is_simultaneous = any(re.search(pat, lower) for pat in simultaneous_patterns)

    visitor_trigger_patterns = [
        r'\bwhen\s+(the\s+)?(visitor|bear|barnaby|customer|he|she|it)\s+(reaches|is\s+at|gets\s+to|approaches|crosses)\s+(the\s+)?counter\b',
        r'\bwhen\s+(the\s+)?(visitor|bear|barnaby|customer|he|she|it)\s+(reaches|is\s+at|gets\s+to|approaches)\b',
        r'whenitisatcounter',
        r'when.*at.*counter',
        r'when.*reach.*counter',
        r'\bonce\s+(the\s+)?(visitor|bear|barnaby|customer|he|she|it)\s+(reaches|is\s+at|gets\s+to)\b',
        r'\bwhen\s+at\s+(the\s+)?counter\b'
    ]
    is_visitor_condition = any(re.search(pat, lower) for pat in visitor_trigger_patterns)

    if is_simultaneous or is_visitor_condition:
        limitations = []
        if is_simultaneous:
            limitations.append("simultaneous_actions")
        if is_visitor_condition:
            limitations.append("visitor_position_trigger")

        if is_simultaneous and is_visitor_condition:
            dialogue = (
                "I can only perform actions one at a time in sequence (not make sounds while hiding), "
                "and I can't watch the counter myself—you have to press the 'BOO!' timing button when Barnaby reaches the counter! "
                "Try coaching me with sequential steps like 'Hide behind the booth, then spooky boo'."
            )
            rule_applied = "rule_reject_simultaneous_and_visitor_position_condition"
        elif is_simultaneous:
            dialogue = (
                "I can only perform actions one at a time in sequence, not simultaneously! "
                "I can't make sounds while hiding. Try coaching me with sequential steps like 'Hide behind the booth, then spooky boo'."
            )
            rule_applied = "rule_reject_simultaneous_actions"
        else:
            dialogue = (
                "I can't watch the counter or trigger myself! You have to press the 'BOO!' timing button "
                "when Barnaby reaches the counter. Try coaching my physical entrance like 'Hide behind the booth, then emerge'."
            )
            rule_applied = "rule_reject_visitor_position_condition"

        return {
            "supported": False,
            "actions": [],
            "pace": "normal",
            "needs_sound": False,
            "sound_type": "none",
            "dialogue": dialogue,
            "rule_applied": rule_applied,
            "limitations_explained": limitations
        }

    # 1. Reject clearly unsupported fantasy/unrelated concepts
    unsupported_patterns = [
        r'\b(dragon|monster|dinosaur|zombie|vampire|werewolf|robot|beast|alien)\b',
        r'\b(turn into|transform into|become a|morph into|shapeshift)\b',
        r'\b(laser|cannon|gun|weapon|chainsaw|bomb|explode|lightning|fireball|sword)\b',
        r'\b(fly to|fly away|rocket|spaceship|orbit)\b',
        r'\b(eat|consume|bite|kill|destroy|attack)\b',
        r'\b(bake|cake|cook|juggle|backflip|cartwheel|sing|dance|guitar|piano)\b'
    ]
    for pattern in unsupported_patterns:
        match = re.search(pattern, lower)
        if match:
            concept = match.group(0)
            if concept in ["dragon", "monster", "dinosaur", "zombie", "vampire", "werewolf", "robot", "beast", "alien"]:
                diag_msg = f"I can't turn into a {concept}—I'm just a small cloth ghost! Try coaching me to hide, pause, emerge, whisper boo, or do a spooky boo."
            else:
                diag_msg = f"I can't do that ({concept})—I'm just a small cloth ghost! Try coaching me to hide, pause, emerge, whisper boo, or do a spooky boo."
            return {
                "supported": False,
                "actions": [],
                "pace": "normal",
                "needs_sound": False,
                "sound_type": "none",
                "dialogue": diag_msg,
                "rule_applied": "rule_reject_fantasy_concept",
                "limitations_explained": ["unsupported_concept"]
            }

    # 2. Extract pacing
    is_slow = bool(re.search(r'\b(slow|slower|slowly|creep|creeping|suspense|take your time|gradual)\b', lower))
    pace = "slow" if is_slow else "normal"

    # 3. Extract silence modifier
    is_silent = bool(re.search(r'\b(without( making)? a sound|silently|quietly|no sound|silent|pantomime)\b', lower))

    # 4. Action detection from semantic paraphrases
    parts = re.split(r'\bthen\b|,|\band then\b', lower)

    def detect_part_action(p: str) -> Optional[str]:
        p = p.strip()
        if not p:
            return None
        # Loud boo / Spooky boo
        if re.search(r'\b(loud boo|jump out with a loud boo|spooky boo|spooky|scare|startle|roar|shout boo|big boo)\b', p):
            return "spooky_boo"
        # Whisper boo
        if re.search(r'\b(whisper boo|whisper|chilly whisper|soft boo|quiet boo|murmur)\b', p):
            return "whisper_boo"
        # Hiding
        if re.search(r'\b(hide|hiding|stay out of sight|out of sight|duck down|take cover|behind the booth|conceal)\b', p):
            return "hide"
        # Pausing / waiting
        if re.search(r'\b(pause|wait for a moment|wait a bit|wait|hold still|freeze|bide)\b', p):
            return "pause"
        # Emerge
        if re.search(r'\b(emerge|pop up|appear|reveal|come out)\b', p):
            return "emerge"
        return None

    actions = []
    if len(parts) > 1:
        for pt in parts:
            act = detect_part_action(pt)
            if act and act not in actions and len(actions) < 2:
                actions.append(act)

    if not actions:
        # Check whole-string occurrences in order of appearance
        spans = []
        m_hide = re.search(r'\b(hide|stay out of sight|out of sight|behind the booth|conceal)\b', lower)
        if m_hide: spans.append((m_hide.start(), "hide"))
        m_pause = re.search(r'\b(pause|wait for a moment|wait a bit|wait|hold still|freeze)\b', lower)
        if m_pause: spans.append((m_pause.start(), "pause"))
        m_emerge = re.search(r'\b(emerge|pop up|appear|reveal)\b', lower)
        if m_emerge: spans.append((m_emerge.start(), "emerge"))
        m_whisper = re.search(r'\b(whisper boo|whisper|soft boo|chilly whisper)\b', lower)
        if m_whisper: spans.append((m_whisper.start(), "whisper_boo"))
        m_spooky = re.search(r'\b(loud boo|jump out with a loud boo|spooky boo|spooky|roar|shout boo|big boo)\b', lower)
        if m_spooky: spans.append((m_spooky.start(), "spooky_boo"))

        spans.sort(key=lambda x: x[0])
        actions = [s[1] for s in spans[:2]]

    # 5. Cross-check with Qwen's parsed output if Qwen gave whitelisted actions
    if qwen_parsed and isinstance(qwen_parsed, dict):
        qwen_supported = qwen_parsed.get("supported", True)
        if not qwen_supported and not actions:
            return {
                "supported": False,
                "actions": [],
                "pace": pace,
                "needs_sound": False,
                "sound_type": "none",
                "dialogue": "I don't know how to do that! I can hide behind the booth, pause for suspense, emerge quietly, whisper boo, or do a spooky boo.",
                "rule_applied": "rule_reject_model_unsupported",
                "limitations_explained": ["model_unsupported"]
            }
        qwen_actions = [a for a in qwen_parsed.get("actions", []) if a in WHITELISTED_ACTIONS][:2]
        if not actions and qwen_actions:
            actions = qwen_actions
        if qwen_parsed.get("pace") in ["normal", "slow"]:
            pace = qwen_parsed.get("pace") if not is_slow else "slow"

    # 6. If no valid actions could be identified, reject cleanly!
    if not actions:
        return {
            "supported": False,
            "actions": [],
            "pace": pace,
            "needs_sound": False,
            "sound_type": "none",
            "dialogue": "I don't know how to do that! I can hide behind the booth, pause for suspense, emerge quietly, whisper boo, or do a spooky boo.",
            "rule_applied": "rule_reject_unrecognized_instruction",
            "limitations_explained": ["unrecognized_instruction"]
        }

    # 7. Supported plan resolution
    needs_sound = any(a in ["spooky_boo", "whisper_boo"] for a in actions) and not is_silent
    sound_type = "spooky" if "spooky_boo" in actions else ("whisper" if "whisper_boo" in actions else "none")
    dialogue = generate_authored_plan_dialogue(actions, pace, needs_sound, sound_type)

    return {
        "supported": True,
        "actions": actions,
        "pace": pace,
        "needs_sound": needs_sound,
        "sound_type": sound_type,
        "dialogue": dialogue,
        "rule_applied": "validated_supported_plan",
        "limitations_explained": []
    }

UNSUPPORTED_KEYWORDS = [
    "laser", "dragon", "cannon", "gun", "kill", "eat customer", 
    "fly to moon", "rocket", "backflip", "explode", "chainsaw"
]

def generate_authored_plan_dialogue(actions: list, pace: str, needs_sound: bool, sound_type: str) -> str:
    """Carefully authored, in-character ghost lines based on the validated plan."""
    if actions == ["hide", "spooky_boo"]:
        if pace == "slow":
            return "Hide in the shadows, wait for the suspense to build, then deliver a mighty boo? Brilliant! Can you show me the roar?"
        return "Hide in the shadows, then jump out with a mighty boo? Classic ambush! Can you show me how terrifying it should sound?"
    elif actions == ["pause", "whisper_boo"] or actions == ["hide", "whisper_boo"]:
        return "Creeping stealth, then a chilly whisper right behind their ear? Deliciously eerie! Show me how soft to whisper."
    elif actions == ["hide", "emerge"]:
        return "A silent phantom entrance! Sinking into the shadows, then popping up with theatrical flair! No sound needed for this one!"
    elif actions == ["pause", "emerge"]:
        return "A dramatic pause until they look away, then appearing out of thin air! Pure pantomime magic!"
    elif actions == ["spooky_boo"]:
        return "Direct and bold! Flying right in with full ghostly fury! Give me your best spooky roar!"
    elif actions == ["whisper_boo"]:
        return "Tiptoeing close for a subtle, icy whisper. Demonstrate the sound for me!"
    elif actions == ["hide"]:
        return "Just vanishing behind the ticket booth? Simple and sneaky! Let's rehearse the hide!"
    elif actions == ["pause"]:
        return "Freezing like a forgotten statue? The suspense will be unbearable!"
    else:
        return "Ooh, an interesting entrance plan! Let's get into position!"

def evaluate_game_rules(actions: list, pace: str, sound_category: str, audio_source: str = "none", audio_id: str = "none", timing: Optional[str] = None) -> Dict[str, Any]:
    """
    Evaluates toy visitor reaction based on documented carnival game rules:
    - Timing Early: Triggered before encounter zone -> visitor spots setup, amused.
    - Timing Late: Triggered after visitor passes -> visitor oblivious, walks on.
    - Timing Missed: No trigger -> visitor strolls past quietly.
    - Timing Well-timed / Default:
      - Rule 1A (Stealth Ambush): Hide/Pause + Spooky sound (normal pace) -> visitor shocked, key spins wildly.
      - Rule 1B (Creeping Suspense): Spooky sound (slow pace) -> creeping suspense builds tension, startling visitor.
      - Rule 1C (Telegraphed Charge): Spooky sound without stealth (normal pace) -> visitor tracks approach, amused.
      - Rule 2 (Chills & Shiver): Whisper sound -> phantom chill, clockwork gears chatter.
      - Rule 3 (Polite Haunting): Ordinary human speech -> comically polite etiquette charms visitor.
      - Rule 3B (Peek-a-boo Pantomime): Hide + Emerge without sound -> cheerful carnival mime.
      - Rule 4 (Oblivious): Silence or uncertain sound -> visitor winds watch, oblivious.
    """
    # Authored Timing Rules (Phaser Playable Prototype)
    if timing == "early":
        return {
            "outcome": "amused",
            "rule_id": "rule_timing_early",
            "rule_name": "Timing Rule: Early Reveal (Premature Ambush)",
            "visitor_anim": "visitor-laughing",
            "visitor_line": "The tin bear spots the ghost fidgeting behind the counter and chuckles warmly. 'A bit eager, little friend!'",
            "ghost_line": "Oh dear! I jumped out before he even reached the booth! He saw the whole setup coming!",
            "ghost_face": "curtsy_blush",
            "rule_description": "Timing Rule: The scare was triggered too early while Barnaby was still approaching; the element of surprise was spoiled.",
            "pace_effect": "Triggering early eliminated anticipation."
        }
    elif timing == "late":
        return {
            "outcome": "oblivious",
            "rule_id": "rule_timing_late",
            "rule_name": "Timing Rule: Late Reveal (Missed Window)",
            "visitor_anim": "visitor-oblivious",
            "visitor_line": "The tin bear keeps strolling along the walkway, totally missing the delayed spook behind him.",
            "ghost_line": "Too late! He was already past the counter. I was booing at empty air!",
            "ghost_face": "embarrassed",
            "rule_description": "Timing Rule: The scare was triggered after Barnaby had already walked past the booth's encounter zone.",
            "pace_effect": "Triggering late left Barnaby out of range."
        }
    elif timing == "missed":
        return {
            "outcome": "oblivious",
            "rule_id": "rule_timing_missed",
            "rule_name": "Timing Rule: Missed Stroll (No Trigger)",
            "visitor_anim": "visitor-oblivious",
            "visitor_line": "The tin bear strolls quietly past the ticket booth, humming a pleasant carnival tune.",
            "ghost_line": "We missed our moment completely! Barnaby strolled right on by without noticing me.",
            "ghost_face": "puzzled_tilt",
            "rule_description": "Timing Rule: The player never triggered the scare; Barnaby strolled completely past.",
            "pace_effect": "No trigger occurred."
        }

    has_stealth = any(a in ["hide", "pause"] for a in actions)
    has_spooky_vocal = sound_category in [
        "spooky", "Animal", "Howl", "Groan", "Grunt", "Roar", "Screaming", "Shout"
    ]
    has_whisper_vocal = sound_category in [
        "whisper", "Whispering", "Laughter", "Giggle", "Snicker", "Sigh"
    ]

    # Rule 4: Silence or Uncertain Audio
    if sound_category in ["Quiet Room / Silence", "Uncertain", "uncertain", "Silence"]:
        return {
            "outcome": "oblivious",
            "rule_id": "rule_4_oblivious",
            "rule_name": "Rule 4: Inaudible / Oblivious",
            "visitor_anim": "visitor-oblivious",
            "visitor_line": "The tin bear winds its pocketwatch, completely oblivious to the quiet breeze.",
            "ghost_line": "Did they even look up from their watch? We need a real sound demonstration next time!",
            "ghost_face": "puzzled_tilt",
            "rule_description": "Rule 4: Inaudible or uncertain sound fails to register over booth noise; visitor remains oblivious.",
            "pace_effect": "Pace had no effect because the sound was inaudible."
        }

    # Rule 3: Ordinary Conversational Speech (Comically Polite Haunting)
    if sound_category in ["Ordinary Speech", "Speech", "Conversation"]:
        pace_note = "Slow pace gave our polite greeting an aristocratic, dignified cadence." if pace == "slow" else "Normal pace kept the polite greeting crisp and courteous."
        return {
            "outcome": "amused",
            "rule_id": "rule_3_polite_haunting",
            "rule_name": "Rule 3: The Polite Haunting (Ordinary Speech)",
            "visitor_anim": "visitor-laughing",
            "visitor_line": "The tin bear tips its brass ear and chuckles with delight. 'What splendid ghostly manners!'",
            "ghost_line": "‘Pardon the intrusion, kind sir... boo?’ ...See? We have carnival etiquette!",
            "ghost_face": "curtsy_blush",
            "rule_description": "Rule 3: Conversational speech becomes an impeccably polite haunting; the clockwork visitor is charmed by the etiquette.",
            "pace_effect": pace_note
        }

    # Rule 1: Spooky Vocalization / Boo Scare
    if "spooky_boo" in actions:
        if has_stealth and pace != "slow":
            return {
                "outcome": "shock",
                "rule_id": "rule_1a_stealth_ambush",
                "rule_name": "Rule 1A: Stealth Ambush (Concealment + Scare)",
                "visitor_anim": "visitor-shocked",
                "visitor_line": "YAAAH! The tin bear jumps into the air, its brass winding key spinning at top speed!",
                "ghost_line": "IT WORKED! Barnaby's winding key is spinning like a pinwheel!",
                "ghost_face": "spooky_boo",
                "rule_description": "Rule 1A: Physical concealment behind the trunk followed by a sudden reveal and loud sound achieves maximum surprise.",
                "pace_effect": "Normal pace provided a snappy, startling jump-scare from concealment."
            }
        elif pace == "slow":
            return {
                "outcome": "shock",
                "rule_id": "rule_1b_creeping_suspense",
                "rule_name": "Rule 1B: Creeping Suspense (Slow Pacing + Scare)",
                "visitor_anim": "visitor-shocked",
                "visitor_line": "EEP! The tin bear jumps backwards as the agonizingly slow creep suddenly erupts!",
                "ghost_line": "The agonizing slow creep worked! They were frozen in suspense before the scare!",
                "ghost_face": "spooky_boo",
                "rule_description": "Rule 1B: Slow pacing builds dramatic suspense; the prolonged anticipation catches the visitor completely off guard even without concealment.",
                "pace_effect": "CRITICAL: Slow pace transformed this approach into high-suspense creeping, producing shock instead of amusement!"
            }
        else:
            return {
                "outcome": "amused",
                "rule_id": "rule_1c_telegraphed_charge",
                "rule_name": "Rule 1C: Telegraphed Charge (No Stealth + Normal Pace)",
                "visitor_anim": "visitor-laughing",
                "visitor_line": "The tin bear saw the ghost coming from a mile away and giggles happily.",
                "ghost_line": "They saw me coming from a mile away! Without hiding first, I'm just a floating napkin!",
                "ghost_face": "curtsy_blush",
                "rule_description": "Rule 1C: Charging directly without concealment at normal speed telegraphs the scare; visitor perceives the floating ghost as harmless and cute.",
                "pace_effect": "Normal pace allowed the visitor to track the ghost's approach throughout the stage."
            }

    # Rule 2: Whisper Boo
    if "whisper_boo" in actions:
        pace_note = "Slow pace prolonged the eerie phantom chill." if pace == "slow" else "Normal pace delivered a crisp phantom whisper."
        return {
            "outcome": "shiver",
            "rule_id": "rule_2_chills_and_shiver",
            "rule_name": "Rule 2: Chills & Shiver (Whisper Sound)",
            "visitor_anim": "visitor-shivering",
            "visitor_line": "The tin bear shivers, clutching its clockwork chest as little gears chatter nervously.",
            "ghost_line": "Subtle, refined terror! A phantom chill straight down the clockwork spine.",
            "ghost_face": "whisper_boo",
            "rule_description": "Rule 2: Whisper sound creates an eerie chill and nervous gear chatter.",
            "pace_effect": pace_note
        }

    # Rule 3B: Non-verbal Pantomime (Hide + Emerge)
    if actions == ["hide", "emerge"]:
        pace_note = "Slow pace gave the pantomime dramatic comedic timing." if pace == "slow" else "Normal pace kept the peek-a-boo lively."
        return {
            "outcome": "amused",
            "rule_id": "rule_3b_peekaboo_pantomime",
            "rule_name": "Rule 3B: Peek-a-boo Pantomime (Silent Acting)",
            "visitor_anim": "visitor-laughing",
            "visitor_line": "The tin bear applauds the cheerful peek-a-boo performance with glee!",
            "ghost_line": "A peek-a-boo pantomime! Entertaining, but maybe we add teeth next round?",
            "ghost_face": "curtsy_blush",
            "rule_description": "Rule 3B: Non-verbal pantomime without sound results in friendly carnival applause.",
            "pace_effect": pace_note
        }

    return {
        "outcome": "amused",
        "rule_id": "rule_default_amused",
        "rule_name": "Default Rule: Entertaining Carnival Attempt",
        "visitor_anim": "visitor-laughing",
        "visitor_line": "The tin bear tilts its head, thoroughly entertained by the quirky ghost.",
        "ghost_line": "Well, they're entertained! A true phantom always refines their technique.",
        "ghost_face": "puzzled_tilt",
        "rule_description": "Default Rule: Visitor is amused by the ghost's earnest attempt.",
        "pace_effect": "Standard performance pacing."
    }

@app.post("/api/coach")
async def coach_ghost(request: Request):
    """Interprets entrance coaching instruction into at most two supported actions."""
    start_time = time.time()
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    text = body.get("text", "").strip()
    session_id = body.get("session_id", "default_session")

    if not text:
        raise HTTPException(status_code=400, detail="Text coaching input is required")
    if len(text) > 200:
        raise HTTPException(status_code=400, detail="Coaching input too long (max 200 chars)")

    if session_id not in SESSION_STATE:
        SESSION_STATE[session_id] = {
            "last_plan": None,
            "last_audio": None,
            "history": []
        }
    session = SESSION_STATE[session_id]
    lower = text.lower()
    last_plan = session.get("last_plan")

    # Guard 1: "Again, but slower" context resolution
    is_again = any(w in lower for w in ["again", "repeat", "once more", "do it again", "one more time"])
    is_slower = any(w in lower for w in ["slower", "slow", "creep", "suspense", "take your time"])

    if is_again:
        if not last_plan:
            # Context is missing! Cannot claim understanding
            return JSONResponse(content={
                "status": "clarification_needed",
                "supported": False,
                "player_text": text,
                "character_dialogue": "Again? But we haven't rehearsed an entrance yet! How should our ghost make its first move?",
                "actions": [],
                "pace": "normal",
                "needs_sound": False,
                "sound_type": "none",
                "diagnostics": {
                    "strategy": "context_guard_missing_plan",
                    "latency_ms": round((time.time() - start_time) * 1000, 1),
                    "model": "Rule Guard (UNO Q)"
                }
            })
        else:
            # Repeat previous sequence more slowly
            prev_actions = last_plan.get("actions", ["hide", "spooky_boo"])
            prev_sound_type = last_plan.get("sound_type", "spooky")
            prev_needs_sound = last_plan.get("needs_sound", True)
            dialogue = "Taking our time... creeping in slow motion to build unbearable suspense!"
            plan = {
                "actions": prev_actions,
                "pace": "slow",
                "needs_sound": prev_needs_sound,
                "sound_type": prev_sound_type,
                "supported": True
            }
            session["last_plan"] = plan
            return JSONResponse(content={
                "status": "success",
                "supported": True,
                "player_text": text,
                "character_dialogue": dialogue,
                "actions": prev_actions,
                "pace": "slow",
                "needs_sound": prev_needs_sound,
                "sound_type": prev_sound_type,
                "has_kept_audio": session.get("last_audio") is not None,
                "diagnostics": {
                    "strategy": "context_resolution_repeated_slower",
                    "latency_ms": round((time.time() - start_time) * 1000, 1),
                    "model": "Rule Guard (UNO Q)"
                }
            })

    # Step 2: Call Qwen 2.5 on UNO Q for Semantic Action Planning
    payload = {
        "messages": [
            {"role": "system", "content": ENTRANCE_PLANNING_SYSTEM_PROMPT},
            {"role": "user", "content": f"Instruction: {text}"}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
        "max_tokens": 50
    }

    t_llm = time.time()
    token_stats = {}
    raw_llm = ""
    llm_success = False
    qwen_parsed = None

    try:
        req = urllib.request.Request(
            "http://127.0.0.1:9999/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        infer_latency_ms = (time.time() - t_llm) * 1000
        content = data["choices"][0]["message"]["content"]
        timings = data.get("timings", {})
        token_stats = {
            "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
            "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
            "prompt_per_second": round(timings.get("prompt_per_second", 0), 1),
            "predicted_per_second": round(timings.get("predicted_per_second", 0), 1)
        }
        raw_llm = content
        qwen_parsed = json.loads(content)
        llm_success = True
    except Exception as e:
        infer_latency_ms = (time.time() - t_llm) * 1000
        raw_llm = f"LLM Error/Timeout: {e}"
        qwen_parsed = None

    # Step 3: Validate and normalize action plan against supported capability set
    validation = parse_and_validate_coaching(text, qwen_parsed)
    total_latency_ms = (time.time() - start_time) * 1000

    model_derived_plan = {
        "actions": qwen_parsed.get("actions", []) if isinstance(qwen_parsed, dict) else [],
        "pace": qwen_parsed.get("pace", "normal") if isinstance(qwen_parsed, dict) else "normal",
        "supported": qwen_parsed.get("supported", False) if isinstance(qwen_parsed, dict) else False
    }

    rule_corrected_plan = {
        "actions": validation["actions"],
        "pace": validation["pace"],
        "supported": validation["supported"],
        "needs_sound": validation["needs_sound"],
        "sound_type": validation["sound_type"],
        "rule_applied": validation.get("rule_applied", "validated_supported_plan"),
        "limitations_explained": validation.get("limitations_explained", [])
    }

    if not validation["supported"]:
        # Unsupported request receives clear explanation and remains in coaching
        return JSONResponse(content={
            "status": "unsupported",
            "supported": False,
            "player_text": text,
            "character_dialogue": validation["dialogue"],
            "actions": [],
            "pace": validation["pace"],
            "needs_sound": False,
            "sound_type": "none",
            "has_kept_audio": session.get("last_audio") is not None,
            "diagnostics": {
                "strategy": "semantic_unsupported_rejection",
                "model_name": "Qwen2.5-0.5B-Instruct-Q4_K_M (469MB Edge LLM)",
                "llm_success": llm_success,
                "inference_latency_ms": round(infer_latency_ms, 1),
                "end_to_end_latency_ms": round(total_latency_ms, 1),
                "token_stats": token_stats,
                "raw_llm_output": raw_llm,
                "model_derived_plan": model_derived_plan,
                "rule_corrected_plan": rule_corrected_plan
            }
        })

    # Step 4: Validated supported action plan
    plan = {
        "actions": validation["actions"],
        "pace": validation["pace"],
        "needs_sound": validation["needs_sound"],
        "sound_type": validation["sound_type"],
        "supported": True
    }
    session["last_plan"] = plan

    return JSONResponse(content={
        "status": "success",
        "supported": True,
        "player_text": text,
        "character_dialogue": validation["dialogue"],
        "actions": validation["actions"],
        "pace": validation["pace"],
        "needs_sound": validation["needs_sound"],
        "sound_type": validation["sound_type"],
        "has_kept_audio": session.get("last_audio") is not None,
        "diagnostics": {
            "strategy": "qwen_validated_semantic_plan",
            "model_name": "Qwen2.5-0.5B-Instruct-Q4_K_M (469MB Edge LLM)",
            "llm_success": llm_success,
            "inference_latency_ms": round(infer_latency_ms, 1),
            "end_to_end_latency_ms": round(total_latency_ms, 1),
            "token_stats": token_stats,
            "raw_llm_output": raw_llm,
            "model_derived_plan": model_derived_plan,
            "rule_corrected_plan": rule_corrected_plan
        }
    })

@app.post("/api/perform")
async def perform_act(request: Request):
    """Executes the coached act and evaluates visitor outcome based on game rules."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    actions = body.get("actions", ["hide", "spooky_boo"])
    pace = body.get("pace", "normal")
    sound_category = body.get("sound_category", "none")
    audio_id = body.get("audio_id", "none")
    audio_source = body.get("audio_source", "none")
    session_id = body.get("session_id", "default_session")
    timing = body.get("timing", None)
    if timing and timing not in ["early", "well_timed", "late", "missed"]:
        timing = "well_timed"

    # Evaluate game rules
    outcome = evaluate_game_rules(actions, pace, sound_category, audio_source, audio_id, timing=timing)

    # Coordinate physical matrix expression
    matrix_face = outcome["ghost_face"]
    matrix_result = send_matrix_frame(matrix_face)

    return JSONResponse(content={
        "status": "success",
        "outcome": outcome["outcome"],
        "rule_id": outcome["rule_id"],
        "rule_name": outcome.get("rule_name", outcome["rule_id"]),
        "rule_description": outcome["rule_description"],
        "pace_effect": outcome.get("pace_effect", ""),
        "visitor_anim": outcome["visitor_anim"],
        "visitor_line": outcome["visitor_line"],
        "character_dialogue": outcome["ghost_line"],
        "matrix_face": matrix_face,
        "matrix_status": matrix_result,
        "audio_id": audio_id,
        "audio_source": audio_source,
        "timing": timing
    })

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080, log_level="info")

