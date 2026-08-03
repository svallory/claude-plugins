#!/usr/bin/env bash
# Row A — layout detection (hyperdev-lib.sh: space_layout / is_space /
# find_space_root). The opt-in gate is the safety property under test:
# nothing counts as a space unless the structure or the marker says so.

source "$(dirname "${BASH_SOURCE[0]}")/helpers.sh"
# hyperdev-lib.sh turns on strict mode when sourced; the harness must not
# abort on the first failing assertion, so switch it back off.
source "$SCRIPTS_DIR/hyperdev-lib.sh"
set +eu
set +o pipefail

# A1: bare .git + worktrees/ — self-identifying
d="$FIX/a1"; make_bare_space "$d"
assert_eq "bare + worktrees/ -> bare" "bare" "$(space_layout "$d")"
assert_ok "bare + worktrees/ is a space" is_space "$d"

# A2: bare .git + HYPERDEV.md marker, no worktrees/
d="$FIX/a2"; mkdir -p "$d"; git init -q --bare "$d/.git"
touch "$d/HYPERDEV.md"
assert_eq "bare + marker -> bare" "bare" "$(space_layout "$d")"

# A3: plain bare repo (a mirror / hosting remote) — no worktrees, no marker
d="$FIX/a3"; mkdir -p "$d"; git init -q --bare "$d/.git"
assert_fails "plain bare repo rejected by space_layout" space_layout "$d"
assert_fails "plain bare repo is not a space" is_space "$d"

# A4: checkout + marker
d="$FIX/a4"; make_checkout "$d"
touch "$d/HYPERDEV.md"
assert_eq "checkout + marker -> checkout" "checkout" "$(space_layout "$d")"

# A5: checkout with .claude/worktrees/ only (structural opt-in, no marker)
d="$FIX/a5"; make_checkout "$d"
mkdir -p "$d/.claude/worktrees"
assert_eq ".claude/worktrees/ alone opts a checkout in" "checkout" "$(space_layout "$d")"

# A6: ordinary repo, no marker, no .claude/worktrees — must NOT be a space
d="$FIX/a6"; make_checkout "$d"
assert_fails "plain checkout rejected by space_layout" space_layout "$d"
assert_fails "plain checkout is not a space" is_space "$d"

# A7: linked worktree (.git is a file). Even though HYPERDEV.md is tracked and
# therefore present inside the worktree, the worktree itself must be rejected,
# and find_space_root must walk past it to the real root.
d="$FIX/a7"; make_checkout "$d"
touch "$d/HYPERDEV.md"
git -C "$d" add HYPERDEV.md
git -C "$d" commit -qm marker
mkdir -p "$d/.claude/worktrees"
git -C "$d" worktree add -q "$d/.claude/worktrees/feat" -b feat
wt="$d/.claude/worktrees/feat"
assert_ok "fixture sanity: worktree carries the tracked marker" test -f "$wt/HYPERDEV.md"
assert_fails "linked worktree rejected by space_layout" space_layout "$wt"
assert_fails "linked worktree is not a space" is_space "$wt"
mkdir -p "$wt/sub"
assert_eq "find_space_root from inside the worktree reaches the real root" \
  "$d" "$(find_space_root "$wt/sub")"

# A8: subdirectory of an adopted checkout — not itself a space root
d="$FIX/a8"; make_checkout "$d"
touch "$d/HYPERDEV.md"
mkdir -p "$d/src"
assert_fails "subdirectory of a checkout rejected" space_layout "$d/src"
assert_eq "find_space_root from the subdirectory finds the root" \
  "$d" "$(find_space_root "$d/src")"

finish
