#!/usr/bin/env bash
# PostToolUse hook: run the project's own checks after an edit and feed
# failures back to the agent immediately.
#
# This implements HyperDev's "Tools Integration" and "Real-time Feedback"
# principles: the agent gets the same linter/typechecker signal a human gets
# from their editor, at the moment the mistake is made rather than at review.
#
# It is OFF unless the project opts in via .claude/hyperdev.json, because the
# correct commands are project-specific and a wrong one is worse than none —
# a check that always fails trains everyone to ignore it.
#
# Config (project .claude/hyperdev.json):
#   {
#     "check": {
#       "enabled": true,
#       "run": "typecheck",            // or an explicit "command"
#       "command": "bun run typecheck",
#       "extensions": [".ts", ".tsx"], // limit to files worth checking
#       "timeout": 60
#     }
#   }

set -uo pipefail

# Hook input arrives as JSON on stdin. No jq dependency: node is already a
# prerequisite for the Node stack, and Go projects that lack it simply skip.
input="$(cat 2>/dev/null || true)"
[[ -z "$input" ]] && exit 0

command -v node >/dev/null 2>&1 || exit 0

# Extract the edited file path. Tolerate every shape the hook payload takes.
file_path="$(node -e '
  let raw = "";
  process.stdin.on("data", d => raw += d);
  process.stdin.on("end", () => {
    try {
      const j = JSON.parse(raw);
      const i = j.tool_input || {};
      process.stdout.write(i.file_path || i.notebook_path || "");
    } catch (e) {}
  });
' <<<"$input" 2>/dev/null)"

[[ -z "$file_path" ]] && exit 0
[[ -f "$file_path" ]] || exit 0

# Walk up from the edited file to find the project config.
dir="$(cd "$(dirname "$file_path")" && pwd)"
cfg=""
probe="$dir"
while [[ "$probe" != "/" ]]; do
  if [[ -f "$probe/.claude/hyperdev.json" ]]; then
    cfg="$probe/.claude/hyperdev.json"
    root="$probe"
    break
  fi
  probe="$(dirname "$probe")"
done

[[ -z "$cfg" ]] && exit 0

# Read config. Any parse error disables the hook rather than guessing.
eval "$(node -e '
  const fs = require("fs");
  try {
    const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).check || {};
    const q = s => "'"'"'" + String(s).replace(/'"'"'/g, "") + "'"'"'";
    console.log("ENABLED=" + (c.enabled ? 1 : 0));
    console.log("RUN=" + q(c.run || ""));
    console.log("CMD=" + q(c.command || ""));
    console.log("TIMEOUT=" + (parseInt(c.timeout, 10) || 60));
    console.log("EXTS=" + q((c.extensions || []).join(" ")));
  } catch (e) {
    console.log("ENABLED=0");
  }
' "$cfg" 2>/dev/null)"

[[ "${ENABLED:-0}" != "1" ]] && exit 0

# Honour the extension filter when present; editing a README should not
# trigger a typecheck.
if [[ -n "${EXTS:-}" ]]; then
  matched=0
  for ext in $EXTS; do
    [[ "$file_path" == *"$ext" ]] && matched=1 && break
  done
  [[ $matched -eq 0 ]] && exit 0
fi

# Resolve the command: an explicit command wins; otherwise use the detected
# package runner plus the configured script name.
cmd="${CMD:-}"
if [[ -z "$cmd" && -n "${RUN:-}" ]]; then
  pm_run="$(bash "$(dirname "${BASH_SOURCE[0]}")/hyperdev-stack.sh" detect "$root" 2>/dev/null \
            | sed -n 's/^PM_RUN=//p')"
  [[ -z "$pm_run" ]] && exit 0   # unknown package manager — do not guess
  cmd="$pm_run $RUN"
fi
[[ -z "$cmd" ]] && exit 0

out="$(cd "$root" && eval "timeout ${TIMEOUT:-60} $cmd" 2>&1)"
status=$?

[[ $status -eq 0 ]] && exit 0

# 124 is timeout's signal. Report it as a timeout rather than a code failure,
# so nobody chases a type error that never happened.
if [[ $status -eq 124 ]]; then
  echo "hyperdev: check timed out after ${TIMEOUT:-60}s: $cmd" >&2
  exit 2
fi

# Exit 2 feeds stderr back to the agent as actionable feedback.
{
  echo "hyperdev: project check failed after editing $file_path"
  echo "command: $cmd"
  echo
  echo "$out" | tail -50
} >&2
exit 2
