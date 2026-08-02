#!/usr/bin/env bash
# SessionStart hook: if this session is inside a container, tell Claude how the
# layout works. Silent (exit 0, no output) when not in a container, so the hook
# costs nothing in unrelated projects.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/hyperdev-lib.sh" 2>/dev/null || exit 0

root="$(find_container_root "$PWD")" || exit 0
name="$(basename "$root")"

if at_container_root; then
  # At the root, the failure modes are real: committing from a bare repo,
  # dumping loose files. Spend the tokens here.
  cat <<EOF
Project container: $root (cwd is the container ROOT, not a worktree).

The .git here is bare — there is no working tree and nothing at this level is
ever committed. Checkouts live in worktrees/<branch>.

- Do not run git commit/add here. cd into worktrees/<branch> first.
- Create branches with \`wt switch <branch>\`, not \`git worktree add\`.
- New local-only files go in: data/ (dumps, fixtures), notes/ (briefs, docs),
  scratch/ (disposable), bin/ (helper scripts) — not loose at the root.

See $root/HYPERDEV.md.
EOF
else
  # Inside a worktree everything behaves normally; one line of orientation is
  # enough, and it prevents "where do I put this file" guesses.
  # Path is <root>/worktrees/<branch>/..., so the worktree name is the second
  # segment. Anything else under the root (data/, notes/) has no branch name.
  rel="${PWD#"$root"/}"
  if [[ "$rel" == worktrees/* ]]; then
    rest="${rel#worktrees/}"
    cat <<EOF
Worktree \`${rest%%/*}\` of container $name ($root).
Container-level local-only dirs: data/, notes/, scratch/, bin/. Sibling
worktrees are in $root/worktrees/. Normal git applies here.
EOF
  else
    # Under the container root but not in a worktree — data/, notes/, scratch/.
    # No git working tree here, so say so rather than implying one.
    cat <<EOF
In \`${rel%%/*}/\` of container $name ($root) — a local-only directory, not a
worktree. Nothing here is committed or backed up. Code lives in
$root/worktrees/<branch>.
EOF
  fi
fi
