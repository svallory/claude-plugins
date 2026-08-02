#!/usr/bin/env bash
# Stack registry and dispatcher.
#
# Usage: hyperdev-stack.sh detect [dir]   — print KEY=VALUE toolchain facts
#        hyperdev-stack.sh list           — list registered stacks
#
# Adding a stack is intentionally mechanical: drop a directory under stacks/
# containing detect.sh that defines stack_matches() and stack_detect(). No
# change to this file is required — stacks are discovered, not enumerated.
#
# Detection reports only what is verifiable in the project. It never guesses a
# command. Absence of a key means "unknown", and callers must ask the user
# rather than inventing a default, because a wrong lint command fails silently
# and trains everyone to ignore the hook.

set -uo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACKS_DIR="$PLUGIN_DIR/stacks"

cmd="${1:-detect}"
dir="${2:-$PWD}"
dir="$(cd "$dir" 2>/dev/null && pwd)" || { echo "no such directory: ${2:-$PWD}" >&2; exit 1; }

list_stacks() {
  local s
  for s in "$STACKS_DIR"/*/detect.sh; do
    [[ -f "$s" ]] || continue
    basename "$(dirname "$s")"
  done
}

case "$cmd" in
  list)
    list_stacks
    ;;

  detect)
    found=0
    for detect_file in "$STACKS_DIR"/*/detect.sh; do
      [[ -f "$detect_file" ]] || continue

      # Each stack runs in a subshell so the sourced stack_matches/stack_detect
      # definitions cannot leak into the next iteration.
      (
        # shellcheck source=/dev/null
        source "$detect_file"
        if declare -f stack_matches >/dev/null && stack_matches "$dir"; then
          stack_detect "$dir"
          exit 0
        fi
        exit 1
      ) && found=1
    done

    if [[ $found -eq 0 ]]; then
      echo "STACK=unknown"
      echo "# No registered stack matched. Registered: $(list_stacks | tr '\n' ' ')"
      exit 0
    fi
    ;;

  *)
    echo "usage: $(basename "$0") {detect|list} [dir]" >&2
    exit 2
    ;;
esac
