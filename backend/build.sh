#!/bin/bash
# build.sh — Backend build script for Render.
# Order matters: prisma generate BEFORE tsc so the generated types are available.

set -e

echo "==> Installing Node packages (including devDependencies for TypeScript)..."
npm install --include=dev

echo "==> Generating Prisma client (must run before tsc)..."
npx prisma generate

echo "==> Running Prisma migrations..."
npx prisma migrate deploy

echo "==> Building TypeScript..."
npm run build

echo "==> Build complete."
