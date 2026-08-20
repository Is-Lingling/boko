#!/bin/bash
# Local development startup script for Boko.
#
# In local mode:
#   - Database is stored at ./data/boko.db (current directory)
#   - Demo seed data (articles, feeds, etc.) is loaded on first run
#   - Static files are served from the project root (..)
#
# Usage:
#   ./run-local.sh              # start with default port 8287
#   BOKO_PORT=3000 ./run-local.sh  # custom port
#
# Prerequisites:
#   cargo build --release --manifest-path backend/Cargo.toml

set -eu

cd "$(dirname "$0")"

export BOKO_LOCAL_MODE=true
export BOKO_PORT="${BOKO_PORT:-8287}"
export BOKO_STATIC_DIR="."
# BOKO_DB_PATH intentionally unset — default_db_path() will resolve ./data/boko.db

echo "============================================"
echo "  Boko — Local Development Mode"
echo "  Database : ./data/boko.db"
echo "  Port     : ${BOKO_PORT}"
echo "  Frontend : . (project root)"
echo "============================================"

BIN="./backend/target/release/boko-backend"
if [ ! -x "$BIN" ]; then
    echo "Binary not found. Building..."
    cargo build --release --manifest-path backend/Cargo.toml
    cp backend/target/release/boko-backend "$BIN" 2>/dev/null || true
fi

exec "$BIN"
