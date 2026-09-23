#!/bin/bash
# version-round.sh
# Copies current round files from current/ to rounds/r{N}/ within a session folder
#
# Usage:
#   ./agent/tools/version-round.sh <session-folder>
#
# Copies these files (if they exist) from current/ to rounds/r{N}/:
#   - *.md (chapter text)
#   - heuristics-scores.json
#   - feedback.md

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <session-folder>"
    exit 1
fi

SESSION_PATH="$1"

if [ ! -d "$SESSION_PATH" ]; then
    echo "Error: Session folder not found: $SESSION_PATH"
    exit 1
fi

CURRENT_DIR="$SESSION_PATH/current"

if [ ! -d "$CURRENT_DIR" ]; then
    echo "Error: current/ directory not found in $SESSION_PATH"
    exit 1
fi

ROUNDS_DIR="$SESSION_PATH/rounds"
mkdir -p "$ROUNDS_DIR"

# Determine next round number by scanning existing r* dirs
NEXT_ROUND=1
if [ -d "$ROUNDS_DIR" ]; then
    LAST_ROUND=$(ls -1 "$ROUNDS_DIR" 2>/dev/null | grep -E '^r[0-9]+$' | sed 's/r//' | sort -n | tail -1)
    if [ -n "$LAST_ROUND" ]; then
        NEXT_ROUND=$((LAST_ROUND + 1))
    fi
fi

ROUND_DIR="$ROUNDS_DIR/r$NEXT_ROUND"

# Check if there are files to version
HAS_FILES=false

# Find .md files in current/ that aren't feedback.md (these are chapter text)
for f in "$CURRENT_DIR"/*.md; do
    [ -f "$f" ] && [ "$(basename "$f")" != "feedback.md" ] && HAS_FILES=true && break
done
[ -f "$CURRENT_DIR/heuristics-scores.json" ] && HAS_FILES=true
[ -f "$CURRENT_DIR/feedback.md" ] && HAS_FILES=true

if [ "$HAS_FILES" = false ]; then
    echo "No files to version in $CURRENT_DIR"
    exit 0
fi

# Create round directory
mkdir -p "$ROUND_DIR"

# Copy .md files (chapter text, excluding feedback.md)
for f in "$CURRENT_DIR"/*.md; do
    if [ -f "$f" ] && [ "$(basename "$f")" != "feedback.md" ]; then
        cp "$f" "$ROUND_DIR/"
    fi
done

# Copy standard files
[ -f "$CURRENT_DIR/heuristics-scores.json" ] && cp "$CURRENT_DIR/heuristics-scores.json" "$ROUND_DIR/"
[ -f "$CURRENT_DIR/feedback.md" ] && cp "$CURRENT_DIR/feedback.md" "$ROUND_DIR/"

echo "Versioned round $NEXT_ROUND: $ROUND_DIR"
ls -la "$ROUND_DIR"
