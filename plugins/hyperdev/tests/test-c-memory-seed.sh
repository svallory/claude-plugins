#!/usr/bin/env bash
# Row C — write_memory_seed idempotency: repeated runs keep exactly one index
# line, leave no .tmp litter, and an index consisting of ONLY the hyperdev
# line survives the rewrite (the grep -v of everything must not kill the run).

source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"
source "$SCRIPTS_DIR/hyperdev-lib.sh"
set +eu
set +o pipefail

d="$FIX/c1"; make_checkout "$d"

write_memory_seed "$d" proj
write_memory_seed "$d" proj
write_memory_seed "$d" proj

idx="$d/.claude/MEMORY.md"
assert_ok "memory file written" test -f "$d/.claude/memory/hyperdev-layout.md"
assert_ok "index written" test -f "$idx"
assert_eq "exactly one index line after 3 consecutive runs" \
  1 "$(grep -c 'hyperdev-layout.md' "$idx")"
assert_eq "no .tmp litter left behind" \
  0 "$(find "$d/.claude" -name '*.tmp' | wc -l | tr -d ' ')"

# Index containing ONLY the hyperdev line: grep -v filters everything out and
# exits 1; the rewrite must still complete and end with exactly one line.
# Run under the same strict mode as the real caller (adopt is set -euo
# pipefail), so a bare failing grep aborts the run instead of being shrugged
# off by this harness.
printf -- '- [Space layout](memory/hyperdev-layout.md) — old entry\n' > "$idx"
(
  set -euo pipefail
  source "$SCRIPTS_DIR/hyperdev-lib.sh"
  write_memory_seed "$d" proj
)
rc=$?
assert_eq "run succeeds when index holds only the hyperdev line" 0 "$rc"
assert_eq "still exactly one index line" 1 "$(grep -c 'hyperdev-layout.md' "$idx")"
assert_eq "index has no other content" 1 "$(wc -l < "$idx" | tr -d ' ')"

finish
