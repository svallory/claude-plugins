#!/usr/bin/env bash
# Resolves GHOSTWRITER_ROOT from this script's location.
# Usage: eval "$(ghostwriter-env.sh)"
#
# Since this script lives in ghostwriter/bin/, the plugin root is one level up.
# Claude Code adds plugin bin/ directories to PATH automatically.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
export GHOSTWRITER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "export GHOSTWRITER_ROOT=\"$GHOSTWRITER_ROOT\""
