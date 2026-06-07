#!/bin/bash
# build.sh — Install system dependencies then Python packages
# Render runs this as the Build Command for the AI service.

set -e

echo "==> Installing system dependencies (Tesseract OCR + OpenCV libs)..."
apt-get update -qq
apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libglib2.0-0 \
    libgl1-mesa-glx \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgomp1

echo "==> System dependencies installed."
echo "==> Installing Python packages..."
pip install -r requirements.txt

echo "==> Build complete."
