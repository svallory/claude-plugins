#!/usr/bin/env bash
# Shared helpers for container init/adopt/audit.
# Sourced, not executed directly.

set -euo pipefail

# The scaffolded directories and what each is for. Order matters for display.
CONTAINER_DIRS=(worktrees data notes scratch bin)

dir_purpose() {
  case "$1" in
    worktrees) echo "git worktrees, one per branch (managed by wt)" ;;
    data)      echo "DB dumps, fixtures, large blobs" ;;
    notes)     echo "briefs, handoffs, working docs" ;;
    scratch)   echo "throwaway files; safe to delete at any time" ;;
    bin)       echo "local helper scripts for this project" ;;
    *)         echo "" ;;
  esac
}

# Two layouts are supported, because both are legitimate and forcing a repo
# from one into the other means re-cloning:
#
#   bare     <root>/.git is bare, no code at the root, checkouts in worktrees/.
#            Local-only dirs sit at the root, which cannot be committed.
#
#   checkout <root> is an ordinary working tree with code at the root and a
#            non-bare .git. Worktrees live in a subdirectory. The root IS the
#            repo, so local-only dirs must be gitignored rather than being
#            uncommittable by construction.
#
# container_layout <dir> prints "bare", "checkout", or nothing.
#
# The bare layout is self-identifying: a bare repo with worktrees beside it is
# unambiguous, and nothing else looks like it. The checkout layout is not —
# it is just an ordinary repository — so it is only recognised once the project
# has opted in by adopting (HYPERDEV.md) or by having .claude/worktrees/.
# Without that gate every git repo on the machine would claim to be a
# container and the session hook would fire everywhere.
container_layout() {
  local d="${1:-$PWD}"
  [[ -e "$d/.git" ]] || return 1

  if [[ -d "$d/.git" ]] \
     && [[ "$(git --git-dir="$d/.git" config --get core.bare 2>/dev/null)" == "true" ]]; then
    echo bare
    return 0
  fi

  # A linked worktree has a .git *file* rather than a directory. It is the top
  # of its own working tree, so --show-toplevel alone would wrongly accept it
  # as a container root and stop the upward walk before reaching the real one.
  [[ -d "$d/.git" ]] || return 1

  # A non-bare repo only counts as a container root when it is the top of the
  # working tree, not a subdirectory of one.
  local top
  top="$(git -C "$d" rev-parse --show-toplevel 2>/dev/null)" || return 1
  [[ "$top" == "$d" ]] || return 1

  # Opt-in gate: an adopted marker, or worktrees already kept in .claude/.
  # An ordinary repository is not a container just for being a repository.
  [[ -f "$d/HYPERDEV.md" || -d "$d/.claude/worktrees" ]] || return 1

  echo checkout
}

# Where worktrees live for a given root. The bare layout uses a top-level
# worktrees/; a checkout cannot, because that directory would be inside the
# working tree and show up as untracked. .claude/worktrees/ is the convention
# already in use, and .claude is typically gitignored.
worktrees_dir() {
  local d="${1:-$PWD}" layout
  layout="$(effective_layout "$d")" || return 1
  case "$layout" in
    bare)     echo "$d/worktrees" ;;
    checkout) echo "$d/.claude/worktrees" ;;
  esac
}

# Like container_layout, but classifies a repository that has not opted in yet.
# Used by the scaffolding paths, which run *during* adoption and therefore
# cannot require the marker they are about to write.
effective_layout() {
  local d="${1:-$PWD}" layout
  if layout="$(container_layout "$d" 2>/dev/null)"; then
    echo "$layout"
    return 0
  fi
  [[ -d "$d/.git" ]] || return 1
  if [[ "$(git --git-dir="$d/.git" config --get core.bare 2>/dev/null)" == "true" ]]; then
    echo bare
  else
    echo checkout
  fi
}

# HYPERDEV.md is the explicit marker; structural detection is the fallback so
# adopt works on projects that predate this plugin.
is_container() {
  local d="${1:-$PWD}"
  # The marker alone is not sufficient: in the checkout layout HYPERDEV.md is a
  # tracked file, so every linked worktree carries a copy. Requiring a real
  # repository root as well keeps worktrees from being mistaken for containers.
  [[ -f "$d/HYPERDEV.md" ]] && [[ -d "$d/.git" ]] && return 0
  container_layout "$d" >/dev/null 2>&1
}

# Walk up from cwd to find the enclosing container root, if any.
#
# Order matters: a linked worktree contains a .git *file* pointing elsewhere,
# so container_layout correctly rejects it and the walk continues to the real
# root. That is what makes detection work from inside a worktree.
find_container_root() {
  local d="${1:-$PWD}"
  while [[ "$d" != "/" ]]; do
    if is_container "$d"; then
      echo "$d"
      return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

# True when cwd is the container root itself rather than inside a worktree.
# In the bare layout this is where the dangerous mistakes happen (committing,
# loose files); in the checkout layout the root is a normal working tree.
at_container_root() {
  local root
  root="$(find_container_root "$PWD")" || return 1
  [[ "$root" == "$PWD" ]]
}

write_hyperdev_md() {
  local root="$1" name="$2"
  local layout wt
  layout="$(effective_layout "$root")" || layout=bare
  wt="$(worktrees_dir "$root")" || wt="$root/worktrees"
  wt="${wt#"$root"/}"

  if [[ "$layout" == bare ]]; then
    cat > "$root/HYPERDEV.md" <<EOF
# $name

Project **container**, bare layout. This directory is not a git worktree —
nothing here is committed. Real checkouts live in \`$wt/\`.

## Layout

| Path | Purpose |
|------|---------|
| \`.git/\` | bare repository (shared object store for all worktrees) |
| \`.claude/\` | Claude settings and memory scoped to this project |
| \`$wt/\` | $(dir_purpose worktrees) |
| \`data/\` | $(dir_purpose data) |
| \`notes/\` | $(dir_purpose notes) |
| \`scratch/\` | $(dir_purpose scratch) |
| \`bin/\` | $(dir_purpose bin) |

## Rules

- Do not run \`git commit\` from the container root; \`cd\` into a worktree first.
- Create worktrees with \`wt switch <branch>\`, never \`git worktree add\` by hand.
- \`scratch/\` is disposable. Anything you would miss belongs in \`data/\` or \`notes/\`.
- Files here never reach the remote. Secrets are local-only by construction,
  but that also means nothing here is backed up.
EOF
  else
    cat > "$root/HYPERDEV.md" <<EOF
# $name

Project **container**, checkout layout. The code lives at this root and this
directory *is* a git working tree, so — unlike the bare layout — files here
**can** be committed. Local-only directories are kept out of the repository by
\`.gitignore\`, not by construction.

## Layout

| Path | Purpose |
|------|---------|
| \`.git/\` | repository for this working tree |
| \`.claude/\` | Claude settings, memory, and worktrees |
| \`$wt/\` | $(dir_purpose worktrees) |
| \`data/\` | $(dir_purpose data) — gitignored |
| \`notes/\` | $(dir_purpose notes) — gitignored |
| \`scratch/\` | $(dir_purpose scratch) — gitignored |
| \`bin/\` | $(dir_purpose bin) — gitignored |

## Rules

- The root is a normal working tree: commit here as usual.
- Create worktrees with \`wt switch <branch>\`, never \`git worktree add\` by hand.
- \`scratch/\` is disposable. Anything you would miss belongs in \`data/\` or \`notes/\`.
- **Check \`git status\` before committing.** The local-only directories are
  protected only by \`.gitignore\`; removing those entries makes them
  committable, and dumps or secrets in \`data/\` would reach the remote.
EOF
  fi
}

# In the checkout layout the local-only directories sit inside the working
# tree, so they must be gitignored. Idempotent, and never rewrites entries the
# user already has.
ensure_gitignored() {
  local root="$1"
  local gi="$root/.gitignore"
  local d added=0

  # git check-ignore consults .gitignore, .git/info/exclude and the global
  # excludesfile alike, so asking git is the only way to avoid re-adding an
  # entry the project already covers elsewhere.
  _already_ignored() {
    git -C "$root" check-ignore -q "$1" 2>/dev/null
  }

  for d in "${CONTAINER_DIRS[@]}"; do
    [[ "$d" == worktrees ]] && continue   # lives under .claude/ in this layout
    _already_ignored "$d/" && continue
    if ! grep -qxF "/$d/" "$gi" 2>/dev/null; then
      if [[ $added -eq 0 ]]; then
        [[ -s "$gi" ]] && printf '\n' >> "$gi"
        printf '# hyperdev local-only directories (never committed)\n' >> "$gi"
        added=1
      fi
      printf '/%s/\n' "$d" >> "$gi"
    fi
  done

  # .claude/worktrees holds entire checkouts; committing them would be a
  # catastrophe, so ensure it is ignored even if .claude itself is tracked.
  if ! _already_ignored '.claude/worktrees/'; then
    [[ $added -eq 0 ]] && { [[ -s "$gi" ]] && printf '\n' >> "$gi"; \
      printf '# hyperdev local-only directories (never committed)\n' >> "$gi"; }
    printf '/.claude/worktrees/\n' >> "$gi"
    added=1
  fi

  [[ $added -eq 1 ]] && echo "  updated  .gitignore"
  return 0
}

# Seed .claude/ with a memory describing the layout, so future sessions in this
# project know the conventions without relying on the hook alone.
write_memory_seed() {
  local root="$1" name="$2"
  local mem="$root/.claude/memory"
  mkdir -p "$mem"

  local layout wt
  layout="$(effective_layout "$root")" || layout=bare
  wt="$(worktrees_dir "$root")" || wt="$root/worktrees"
  wt="${wt#"$root"/}"

  if [[ "$layout" == bare ]]; then
    cat > "$mem/hyperdev-layout.md" <<EOF
---
name: hyperdev-layout
description: $name uses the hyperdev bare container layout; worktrees in $wt/, root is never committed
metadata:
  type: project
---

\`$root\` is a project container, not a checkout. The \`.git\` there is bare and
the working copies are in \`$wt/<branch>\`, created via \`wt switch\`.

Local-only directories at the container root: \`data/\` (dumps, fixtures),
\`notes/\` (briefs, handoffs), \`scratch/\` (disposable), \`bin/\` (helper scripts).
None of it is committed or backed up.

**Why:** keeps a single object store across branches and gives local-only files a
home that cannot accidentally be committed.

**How to apply:** never commit from the container root; put new local files in the
matching directory instead of loose at the root. See \`HYPERDEV.md\`.
EOF
  else
    cat > "$mem/hyperdev-layout.md" <<EOF
---
name: hyperdev-layout
description: $name uses the hyperdev checkout layout; code at the root, worktrees in $wt/, local-only dirs are gitignored
metadata:
  type: project
---

\`$root\` is a normal git working tree with the code at its root. Worktrees for
other branches live in \`$wt/<branch>\`, created via \`wt switch\`.

Local-only directories: \`data/\` (dumps, fixtures), \`notes/\` (briefs, handoffs),
\`scratch/\` (disposable), \`bin/\` (helper scripts).

**Why:** unlike the bare layout, the root *is* the repository, so these
directories are kept out of git by \`.gitignore\` rather than by construction.

**How to apply:** commit from the root as normal, but check \`git status\` first —
if a \`.gitignore\` entry is removed, anything in \`data/\` becomes committable and
a dump or secret could reach the remote. See \`HYPERDEV.md\`.
EOF
  fi

  local index="$root/.claude/MEMORY.md"
  if [[ ! -f "$index" ]]; then
    printf '# Memory index\n\n' > "$index"
  fi
  # Rewrite rather than skip-if-present: an interrupted earlier run can leave
  # an index line pointing at a memory file that was never written, and a
  # plain grep would treat that dangling entry as "already done".
  if grep -q 'hyperdev-layout.md' "$index" 2>/dev/null; then
    grep -v 'hyperdev-layout.md' "$index" > "$index.tmp" && mv "$index.tmp" "$index"
  fi
  printf -- '- [Container layout](memory/hyperdev-layout.md) — worktrees/, local-only dirs, root is never committed\n' >> "$index"
}

# Create the directory set. Idempotent: reports created vs already-present.
#
# The worktrees directory is layout-dependent: top-level for bare, under
# .claude/ for a checkout, where a top-level worktrees/ would sit inside the
# working tree and show up as untracked.
scaffold_dirs() {
  local root="$1"
  local layout wt_abs wt_rel d
  layout="$(effective_layout "$root")" || layout=bare
  wt_abs="$(worktrees_dir "$root")" || wt_abs="$root/worktrees"
  wt_rel="${wt_abs#"$root"/}"

  for d in "${CONTAINER_DIRS[@]}"; do
    local target label
    if [[ "$d" == worktrees ]]; then
      target="$wt_abs"; label="$wt_rel"
    else
      target="$root/$d"; label="$d"
    fi

    if [[ -d "$target" ]]; then
      echo "  exists   $label/"
    else
      mkdir -p "$target"
      # A note beats .gitkeep here: it explains the directory to whoever opens
      # it in six months.
      printf '%s\n' "$(dir_purpose "$d")" > "$target/.what-goes-here"
      echo "  created  $label/"
    fi
  done

  # Only the checkout layout needs gitignore protection; in the bare layout
  # the root is not a working tree at all.
  [[ "$layout" == checkout ]] && ensure_gitignored "$root"
  return 0
}
