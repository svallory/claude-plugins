#!/usr/bin/env bash
# SessionStart hook: if this session is inside a space, tell Claude how the
# layout works. Silent (exit 0, no output) when not in a space, so the hook
# costs nothing in unrelated projects.

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/hyperdev-lib.sh" 2>/dev/null || exit 0

root="$(find_space_root "$PWD")" || exit 0
name="$(basename "$root")"
layout="$(space_layout "$root" 2>/dev/null)" || layout=bare
wt_abs="$(worktrees_dir "$root" 2>/dev/null)" || wt_abs="$root/worktrees"
wt_rel="${wt_abs#"$root"/}"

# Recommend wt only when it is actually installed; otherwise show the raw
# command so the advice is followable as printed.
if command -v wt >/dev/null 2>&1; then
  wt_make="\`wt switch <branch>\`, not \`git worktree add\`"
else
  wt_make="\`git worktree add $wt_rel/<branch> <branch>\` (worktrunk's \`wt switch\` automates this)"
fi

# Inside a worktree? Compare against the layout's worktrees directory rather
# than assuming a fixed path, since it differs per layout.
in_worktree=0
if [[ "$PWD" == "$wt_abs"/* ]]; then
  in_worktree=1
  rest="${PWD#"$wt_abs"/}"
  wt_name="${rest%%/*}"
fi

# The directory to run toolchain detection against. Only set when cwd maps to
# exactly one working tree: a bare root has none, and picking one of its
# worktrees to scan would report an arbitrary branch's toolchain.
tree=""

if [[ $in_worktree -eq 1 ]]; then
  tree="$wt_abs/$wt_name"
  cat <<EOF
Worktree \`$wt_name\` of space $name ($root).
Space-level local-only dirs: data/, notes/, scratch/, bin/. Sibling
worktrees are in $wt_abs/. Normal git applies here.
EOF

elif at_space_root && [[ "$layout" == bare ]]; then
  # Bare root: the failure modes are real (committing against a bare repo,
  # dumping loose files), so spend the tokens here.
  cat <<EOF
Project space: $root (cwd is the space ROOT, not a worktree).

The .git here is bare — there is no working tree and nothing at this level is
ever committed. Worktrees live in $wt_rel/<branch>.

- Do not run git commit/add here. cd into $wt_rel/<branch> first.
- Create branches with $wt_make.
- New local-only files go in: data/ (dumps, fixtures), notes/ (briefs, docs),
  scratch/ (disposable), bin/ (helper scripts) — not loose at the root.

See $root/HYPERDEV.md.
EOF

elif at_space_root; then
  # Checkout root: this IS a working tree, so the bare-layout warnings would be
  # wrong. The risk here is the opposite one — local-only dirs are protected
  # only by .gitignore.
  tree="$root"
  cat <<EOF
Project space: $root (checkout layout — code at the root).

This root is a normal git working tree; commit here as usual. Worktrees for
other branches are in $wt_rel/<branch>, created with $wt_make.

- Local-only dirs (data/, notes/, scratch/, bin/) are kept out of git by
  .gitignore, not by construction — check \`git status\` before committing.
- New local files belong in those dirs rather than loose at the root.

See $root/HYPERDEV.md.
EOF

else
  # Under the space root but not in a worktree. In the bare layout that can
  # only be a local-only directory (data/, notes/, scratch/). In the checkout
  # layout the root working tree extends into every subdirectory, so the same
  # message would falsely call tracked source disposable — ask git whether
  # this directory is actually kept out of the repo before saying so.
  rel="${PWD#"$root"/}"
  top="${rel%%/*}"
  if [[ "$layout" == checkout ]]; then
    if git -C "$root" check-ignore -q "$top" 2>/dev/null; then
      cat <<EOF
In \`$rel/\` of space $name ($root) — inside \`$top/\`, a local-only directory
kept out of git by .gitignore. Nothing here is committed or backed up. The
code is the working tree at $root.
EOF
    else
      tree="$root"
      cat <<EOF
In \`$rel/\` of space $name ($root, checkout layout) — inside the root
working tree. Normal git applies here. Worktrees for other branches are in
$wt_abs/<branch>.
EOF
    fi
  else
    cat <<EOF
In \`$rel/\` of space $name ($root) — a local-only directory, not a
worktree. Nothing here is committed or backed up. Code lives in
$wt_abs/<branch>.
EOF
  fi
fi

# Reactive Context: also say HOW to build/lint/test, not just where things
# live. Everything below is best-effort — a detection failure must never break
# session start, and unknown keys are omitted rather than guessed.
if [[ -n "$tree" ]]; then
  facts="$(bash "$(dirname "${BASH_SOURCE[0]}")/hyperdev-stack.sh" detect "$tree" 2>/dev/null)" || facts=""
  stack="$(sed -n 's/^STACK=//p' <<<"$facts")"
  if [[ -n "$stack" && "$stack" != unknown ]]; then
    pm="$(sed -n 's/^PM=//p' <<<"$facts")"
    [[ "$pm" == unknown ]] && pm=""
    lint_tool="$(sed -n 's/^LINT_TOOL=//p' <<<"$facts")"

    # Node stacks report script names; Go reports full commands. Label the
    # list accordingly so nobody runs `pnpm run go test ./...`.
    entries="" label="Scripts"
    for key in LINT FORMAT TYPECHECK TEST; do
      v="$(sed -n "s/^$key=//p" <<<"$facts")"
      [[ -z "$v" ]] && continue
      [[ "$v" == *" "* ]] && label="Checks"
      entries+="${entries:+, }$v"
    done

    line="Toolchain: $stack${pm:+ ($pm)}."
    [[ -n "$entries" ]] && line+=" $label: $entries."
    [[ -n "$lint_tool" ]] && line+=" Lint tool: $lint_tool."
    echo
    echo "$line"

    # Check-hook status, from the same config the PostToolUse hook reads,
    # with the same precedence: nearest tree first, then the space root.
    cfg=""
    [[ -f "$tree/.claude/hyperdev.json" ]] && cfg="$tree/.claude/hyperdev.json"
    [[ -z "$cfg" && -f "$root/.claude/hyperdev.json" ]] && cfg="$root/.claude/hyperdev.json"
    if [[ -z "$cfg" ]]; then
      echo "No check hook configured — run /hyperdev:tools to set one up."
    elif command -v node >/dev/null 2>&1; then
      # Summarizes the effective checks only when the hook would actually run
      # something; disabled, command-less, or unparseable configs stay silent.
      # Same precedence as hyperdev-check.sh: a "checks" array wins over the
      # legacy "check" object, and array entries are on unless enabled:false.
      desc="$(node -e '
        try {
          const cfg = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
          let list = [];
          if (Array.isArray(cfg.checks) && cfg.checks.length) {
            list = cfg.checks.filter(c => c && typeof c === "object" && c.enabled !== false);
          } else if (cfg.check && cfg.check.enabled) {
            list = [cfg.check];
          }
          const names = list.map(c => c.run || c.command).filter(Boolean).map(String);
          if (names.length === 1) process.stdout.write(names[0]);
          else if (names.length > 1)
            process.stdout.write(names.length + " checks: " + names.join(", "));
        } catch (e) {}
      ' "$cfg" 2>/dev/null)" || desc=""
      [[ -n "$desc" ]] && echo "Check hook: ON ($desc)."
    fi
  fi
fi

exit 0
