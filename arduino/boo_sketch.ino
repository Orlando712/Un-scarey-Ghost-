// SPDX-FileCopyrightText: Copyright (C) 2026 Boo, Please! Project
// SPDX-License-Identifier: MPL-2.0

#include <Arduino_LED_Matrix.h>
#include <Arduino_RouterBridge.h>
#include <vector>

Arduino_LED_Matrix matrix;

const uint8_t FRAME_ROWS = 8;
const uint8_t FRAME_COLS = 13;
const uint8_t FRAME_SIZE = FRAME_ROWS * FRAME_COLS;

uint8_t frame[FRAME_SIZE] = {0};

void draw(std::vector<uint8_t> newFrame) {
    size_t len = min(newFrame.size(), (size_t)FRAME_SIZE);
    memcpy(frame, newFrame.data(), len);
}

void setup() {
    matrix.begin();
    matrix.setGrayscaleBits(3);
    matrix.clear();
    Bridge.begin();
    Bridge.provide("draw", draw);
}

void loop() {
    matrix.draw(frame);
    delay(10);
}

