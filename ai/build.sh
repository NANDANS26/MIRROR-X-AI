#!/bin/bash
# build.sh — AI service build script for Render.
# No apt-get — Render free tier has a read-only filesystem.
# pytesseract (needs Tesseract binary) has been replaced with easyocr (pure Python).

set -e

echo "==> Installing Python packages..."
pip install -r requirements.txt

echo "==> Build complete."
