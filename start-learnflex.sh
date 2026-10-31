#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
node --version >/dev/null 2>&1 || { echo "Install Node.js 18 or later first."; exit 1; }
npm start
