#!/usr/bin/env bash
# Row B — ensure_gitignored: adds each entry once, is idempotent, and never
# re-adds a path the project already covers via .git/info/exclude.

source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"
source "$SCRIPTS_DIR/hyperdev-lib.sh"
set +eu
set +o pipefail

# B1: fresh checkout — entries added exactly once, second run is a no-op
d="$FIX/b1"; make_checkout "$d"
ensure_gitignored "$d" >/dev/null
gi="$d/.gitignore"
assert_ok "adds /data/"              grep -qxF "/data/" "$gi"
assert_ok "adds /notes/"             grep -qxF "/notes/" "$gi"
assert_ok "adds /scratch/"           grep -qxF "/scratch/" "$gi"
assert_ok "adds /bin/"               grep -qxF "/bin/" "$gi"
assert_ok "adds /.claude/worktrees/" grep -qxF "/.claude/worktrees/" "$gi"
assert_eq "adds /data/ exactly once" 1 "$(grep -cxF '/data/' "$gi")"
before="$(cat "$gi")"
ensure_gitignored "$d" >/dev/null
assert_eq "second run adds nothing" "$before" "$(cat "$gi")"

# B2: a path already covered by .git/info/exclude must not be re-added to
# .gitignore (check-ignore is the source of truth, not a grep of .gitignore)
d="$FIX/b2"; make_checkout "$d"
echo "data/" >> "$d/.git/info/exclude"
ensure_gitignored "$d" >/dev/null
assert_fails "path covered via info/exclude is NOT re-added" \
  grep -qxF "/data/" "$d/.gitignore"
assert_ok "uncovered entries are still added" \
  grep -qxF "/notes/" "$d/.gitignore"

finish
