#!/usr/bin/env bash
# SessionStart hook: if this session is inside a container, tell Claude how the
# layout works. Silent (exit 0, no output) when not in a container, so the hook
# costs nothing in unrelated projects.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/hyperdev-lib.sh" 2>/dev/null || exit 0

root="$(find_container_root "$PWD")" || exit 0
name="$(basename "$root")"
layout="$(container_layout "$root" 2>/dev/null)" || layout=bare
wt_abs="$(worktrees_dir "$root" 2>/dev/null)" || wt_abs="$root/worktrees"
wt_rel="${wt_abs#"$root"/}"

# Inside a worktree? Compare against the layout's worktrees directory rather
# than assuming a fixed path, since it differs per layout.
in_worktree=0
if [[ "$PWD" == "$wt_abs"/* ]]; then
  in_worktree=1
  rest="${PWD#"$wt_abs"/}"
  wt_name="${rest%%/*}"
fi

if [[ $in_worktree -eq 1 ]]; then
  cat <<EOF
Worktree \`$wt_name\` of container $name ($root).
Container-level local-only dirs: data/, notes/, scratch/, bin/. Sibling
worktrees are in $wt_abs/. Normal git applies here.
EOF

elif at_container_root && [[ "$layout" == bare ]]; then
  # Bare root: the failure modes are real (committing against a bare repo,
  # dumping loose files), so spend the tokens here.
  cat <<EOF
Project container: $root (cwd is the container ROOT, not a worktree).

The .git here is bare — there is no working tree and nothing at this level is
ever committed. Checkouts live in $wt_rel/<branch>.

- Do not run git commit/add here. cd into $wt_rel/<branch> first.
- Create branches with \`wt switch <branch>\`, not \`git worktree add\`.
- New local-only files go in: data/ (dumps, fixtures), notes/ (briefs, docs),
  scratch/ (disposable), bin/ (helper scripts) — not loose at the root.

See $root/HYPERDEV.md.
EOF

elif at_container_root; then
  # Checkout root: this IS a working tree, so the bare-layout warnings would be
  # wrong. The risk here is the opposite one — local-only dirs are protected
  # only by .gitignore.
  cat <<EOF
Project container: $root (checkout layout — code at the root).

This root is a normal git working tree; commit here as usual. Worktrees for
other branches are in $wt_rel/<branch>, created with \`wt switch\`.

- Local-only dirs (data/, notes/, scratch/, bin/) are kept out of git by
  .gitignore, not by construction — check \`git status\` before committing.
- New local files belong in those dirs rather than loose at the root.

See $root/HYPERDEV.md.
EOF

else
  # Under the container root but not in a worktree — data/, notes/, scratch/.
  rel="${PWD#"$root"/}"
  cat <<EOF
In \`${rel%%/*}/\` of container $name ($root) — a local-only directory, not a
worktree. Nothing here is committed or backed up. Code lives in
$wt_abs/<branch>.
EOF
fi
