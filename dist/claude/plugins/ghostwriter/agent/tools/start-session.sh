#!/bin/bash
# start-session.sh
# Creates a new training session from a test fixture
#
# Usage:
#   ./agent/tools/start-session.sh <fixture-name>
#   ./agent/tools/start-session.sh blog-post
#
# Creates: agent/state/<fixture-name>-<timestamp>/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -z "$1" ]; then
    echo "Usage: $0 <fixture-name>"
    echo "Example: $0 blog-post"
    echo ""
    echo "Available fixtures:"
    ls -1 "$PROJECT_ROOT/test/fixtures/" 2>/dev/null || echo "  (none found)"
    exit 1
fi

FIXTURE_NAME="$1"
FIXTURE_PATH="$PROJECT_ROOT/test/fixtures/$FIXTURE_NAME"

if [ ! -d "$FIXTURE_PATH" ]; then
    echo "Error: Fixture not found: $FIXTURE_PATH"
    exit 1
fi

if [ ! -f "$FIXTURE_PATH/config.yml" ]; then
    echo "Error: Missing config.yml in fixture"
    exit 1
fi

if [ ! -f "$FIXTURE_PATH/draft.md" ]; then
    echo "Error: Missing draft.md in fixture"
    exit 1
fi

# Create timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SESSION_NAME="${FIXTURE_NAME}-${TIMESTAMP}"
SESSION_PATH="$PROJECT_ROOT/agent/state/$SESSION_NAME"

# Create session directory
mkdir -p "$SESSION_PATH/current"
mkdir -p "$SESSION_PATH/rounds"
mkdir -p "$SESSION_PATH/debug"

# Copy fixture files
cp "$FIXTURE_PATH/config.yml" "$SESSION_PATH/"
cp "$FIXTURE_PATH/draft.md" "$SESSION_PATH/input.md"

echo "CASE=\"$FIXTURE_NAME\""
echo "SESSION_PATH=\"$SESSION_PATH\""
echo "CONFIG=\"$SESSION_PATH/config.yml\""
echo "INPUT=\"$SESSION_PATH/input.md\""
