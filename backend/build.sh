#!/bin/bash
# build.sh — Install Chromium for Puppeteer, then build the backend.
# Render runs this as the Build Command for the backend service.

set -e

echo "==> Installing Chromium for Puppeteer..."
apt-get update -qq
apt-get install -y --no-install-recommends \
    chromium \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    fonts-liberation \
    libappindicator3-1

echo "==> Chromium installed at: $(which chromium)"

echo "==> Installing Node packages (including devDependencies for TypeScript)..."
npm install --include=dev

echo "==> Building TypeScript..."
npm run build

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

echo "==> Build complete."
