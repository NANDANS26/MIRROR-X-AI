#!/bin/bash
# build.sh — Backend build script for Render.
# No apt-get — Render free tier has a read-only filesystem.
# Puppeteer has been replaced with axios+cheerio, no Chrome needed.

set -e

echo "==> Installing Node packages (including devDependencies for TypeScript)..."
npm install --include=dev

echo "==> Building TypeScript..."
npm run build

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

echo "==> Build complete."
