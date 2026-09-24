#!/usr/bin/env bash
#
# team-status.sh — one-shot status snapshot for a team lead running dev agents in Herdr.
#
# Reads a markdown status table whose FIRST column is the task ref, e.g.
#   | ref | title | model | state | worktree | notes |
# Only the first column is parsed, so extra columns (a tracker id, etc.) are fine.
# Looks up each ref's Herdr agent (named "<prefix><ref>"), optionally checks
# elapsed time against a per-ref time budget, and checks whether a report file
# exists for the ref. Also reports basic machine load (CPU load average, memory
# pressure, and count of heavy build/test processes) so the lead can tell when
# the machine is oversubscribed.
#
# Usage:
#   team-status.sh --table <path> --prefix <agent-name-prefix> \
#                   [--budgets <path>] [--reports <dir>] \
#                   [--alerts-only] [--state <file>] [--json]
#
# Options:
#   --table PATH      Markdown file containing the status table (required).
#   --prefix PREFIX   Agent name prefix, e.g. "campaigns-" (required).
#                      Agents are looked up in Herdr as "<prefix><ref>".
#   --budgets PATH    Optional JSON file: { "<ref>": { "started": "<ISO8601>", "budget_min": <N> } }
#   --reports DIR     Optional directory containing "<ref>.md" report files.
#                      The first line of a report is expected to look like
#                      "STATUS: <value>"; that value is shown/checked.
#   --alerts-only     Print only alert lines (see below) instead of the full table.
#   --state FILE      Used with --alerts-only: persist alert state in FILE.
#                      On each run, print only NEW alerts and CLEARED alerts.
#                      LOAD and HEAVY alerts compare by keyword only (numbers ignored).
#   --json            Emit machine-readable JSON instead of the text table.
#                      (Ignored together with --alerts-only; alerts stay plain text
#                      since they are meant for quick scanning / grep / logging.)
#
# Default output:
#   A table:  ref  status  elapsed/budget  report  note
#   followed by one machine-status line.
#
# --alerts-only output (one line per condition that is currently true):
#   OVER-BUDGET <ref> <elapsed>m/<budget>m
#   BLOCKED <ref>
#   DONE <ref>
#   MISSING <ref>
#   LOAD <load1>/<ncpu>
#   HEAVY <n> processes
#
# --state output (when used with --alerts-only):
#   NEW alert lines that were not in the previous run.
#   CLEARED alert-keyword lines for alerts that disappeared.
#
# Exit status is always 0 (this script is meant to run unattended in a loop).
#
# Example: watch loop that only prints when something needs attention.
#
#   while true; do
#     /path/to/team-status.sh --table notes/team-lead.md --prefix campaigns- \
#       --budgets scratch/budgets.json --reports scratch/reports --alerts-only
#     sleep 180
#   done
#
# Or with state tracking, print only new/cleared alerts:
#   until /path/to/team-status.sh --table T --prefix P --alerts-only \
#       --state /tmp/state.txt | grep -q .; do sleep 180; done
#
# Or drive it from Monitor's until-loop pattern to get a single notification
# once something interesting happens:
#   until /path/to/team-status.sh --table T --prefix P --alerts-only \
#       --state /tmp/state.txt | grep -q .; do sleep 180; done

set -euo pipefail

TABLE=""
PREFIX=""
BUDGETS=""
REPORTS_DIR=""
ALERTS_ONLY=0
JSON_OUT=0
STATE_FILE=""

usage() {
  grep '^#' "$0" | sed '1d;s/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --table) TABLE="${2:-}"; shift 2 ;;
    --prefix) PREFIX="${2:-}"; shift 2 ;;
    --budgets) BUDGETS="${2:-}"; shift 2 ;;
    --reports) REPORTS_DIR="${2:-}"; shift 2 ;;
    --alerts-only) ALERTS_ONLY=1; shift ;;
    --state) STATE_FILE="${2:-}"; shift 2 ;;
    --json) JSON_OUT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$TABLE" ] || [ -z "$PREFIX" ]; then
  echo "error: --table and --prefix are required" >&2
  usage >&2
  exit 2
fi

if [ ! -f "$TABLE" ]; then
  echo "error: table file not found: $TABLE" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 2
fi

if ! command -v herdr >/dev/null 2>&1; then
  echo "error: herdr is required" >&2
  exit 2
fi

# ---- parse refs from the markdown table ----
# Rows look like: | ref | title | model | state | worktree | notes |  (only column 1 is read)
# Only rows starting with "| " whose second cell isn't the "---" separator,
# and whose first cell isn't literally "ref" (header), are considered.
refs=()
while IFS= read -r line; do
  case "$line" in
    '| '*) ;;
    *) continue ;;
  esac
  # second field (between 1st and 2nd pipe after the leading one) used to skip separator rows
  second=$(printf '%s\n' "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3}')
  case "$second" in
    *---*) continue ;;
  esac
  ref=$(printf '%s\n' "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$2); print $2}')
  [ -z "$ref" ] && continue
  [ "$ref" = "ref" ] && continue
  refs+=("$ref")
done < "$TABLE"

if [ "${#refs[@]}" -eq 0 ]; then
  echo "warning: no refs parsed from $TABLE" >&2
fi

now_epoch=$(date +%s)

# ---- per-ref lookups ----
declare -a OUT_REF OUT_STATUS OUT_ELAPSED OUT_BUDGET OUT_REPORT OUT_NOTE

for ref in "${refs[@]}"; do
  agent_name="${PREFIX}${ref}"

  status="unknown"
  note=""

  agent_json=$(herdr agent get "$agent_name" 2>/dev/null || true)
  if [ -z "$agent_json" ]; then
    status="missing"
  else
    status=$(printf '%s' "$agent_json" | jq -r '.result.agent.agent_status // "unknown"' 2>/dev/null || echo "unknown")
    [ -z "$status" ] && status="unknown"
  fi

  # elapsed / budget
  elapsed_min=""
  budget_min=""
  if [ -n "$BUDGETS" ] && [ -f "$BUDGETS" ]; then
    started=$(jq -r --arg r "$ref" '.[$r].started // empty' "$BUDGETS" 2>/dev/null || true)
    budget_min=$(jq -r --arg r "$ref" '.[$r].budget_min // empty' "$BUDGETS" 2>/dev/null || true)
    if [ -n "$started" ]; then
      started_epoch=$(date -j -f '%Y-%m-%dT%H:%M:%S%z' "$started" '+%s' 2>/dev/null || true)
      if [ -z "$started_epoch" ]; then
        # GNU date fallback (Linux)
        started_epoch=$(date -d "$started" '+%s' 2>/dev/null || true)
      fi
      if [ -n "$started_epoch" ]; then
        elapsed_min=$(( (now_epoch - started_epoch) / 60 ))
      fi
    fi
  fi

  # report file
  report_state="-"
  if [ -n "$REPORTS_DIR" ]; then
    report_file="${REPORTS_DIR%/}/${ref}.md"
    if [ -f "$report_file" ]; then
      first_line=$(head -n 1 "$report_file" 2>/dev/null || true)
      report_status=$(printf '%s' "$first_line" | sed -n 's/^STATUS: *//p')
      if [ -n "$report_status" ]; then
        report_state="$report_status"
      else
        report_state="present"
      fi
    else
      report_state="none"
    fi
  fi

  OUT_REF+=("$ref")
  OUT_STATUS+=("$status")
  if [ -n "$elapsed_min" ] && [ -n "$budget_min" ]; then
    OUT_ELAPSED+=("${elapsed_min}m/${budget_min}m")
  elif [ -n "$elapsed_min" ]; then
    OUT_ELAPSED+=("${elapsed_min}m/-")
  else
    OUT_ELAPSED+=("-")
  fi
  OUT_BUDGET+=("$budget_min")
  OUT_REPORT+=("$report_state")
  OUT_NOTE+=("$note")
done

# ---- machine status ----
ncpu=""
if command -v sysctl >/dev/null 2>&1; then
  ncpu=$(sysctl -n hw.ncpu 2>/dev/null || true)
fi
if [ -z "$ncpu" ] && command -v nproc >/dev/null 2>&1; then
  ncpu=$(nproc 2>/dev/null || true)
fi
[ -z "$ncpu" ] && ncpu="?"

load1=""
if command -v uptime >/dev/null 2>&1; then
  load1=$(uptime | sed -n 's/.*load averages\{0,1\}:\{0,1\} *\([0-9.]*\).*/\1/p')
fi
[ -z "$load1" ] && load1="?"

mem_summary=""
if command -v memory_pressure >/dev/null 2>&1; then
  mem_line=$(memory_pressure 2>/dev/null | grep -m1 -i 'memory free percentage' || true)
  if [ -n "$mem_line" ]; then
    mem_summary="$mem_line"
  fi
fi
if [ -z "$mem_summary" ] && command -v vm_stat >/dev/null 2>&1; then
  free_pages=$(vm_stat 2>/dev/null | awk '/Pages free/{gsub("\\.","",$3); print $3}')
  [ -n "$free_pages" ] && mem_summary="free pages: ${free_pages}"
fi
if [ -z "$mem_summary" ] && command -v free >/dev/null 2>&1; then
  mem_summary=$(free -m 2>/dev/null | awk '/^Mem:/{printf "free: %sMB / total: %sMB", $4, $2}')
fi
[ -z "$mem_summary" ] && mem_summary="unavailable"

if command -v pgrep >/dev/null 2>&1; then
  heavy_count=$(pgrep -f -- 'vitest|karma|ng build|tsc |turbo|jest|playwright|headless' 2>/dev/null | wc -l | tr -d ' ')
else
  # shellcheck disable=SC2009 # pgrep unavailable; fall back to ps+grep, excluding grep itself
  heavy_count=$(ps -Ao command= 2>/dev/null | grep -E 'vitest|karma|ng build|tsc |turbo|jest|playwright|headless' | grep -vc 'grep' || true)
fi
[ -z "$heavy_count" ] && heavy_count=0

# ---- alerts ----
alerts=()
for i in "${!OUT_REF[@]}"; do
  ref="${OUT_REF[$i]}"
  status="${OUT_STATUS[$i]}"
  budget_min="${OUT_BUDGET[$i]}"
  elapsed_field="${OUT_ELAPSED[$i]}"
  report_state="${OUT_REPORT[$i]}"

  if [ "$status" = "missing" ]; then
    alerts+=("MISSING $ref")
    continue
  fi

  if [ "$status" = "blocked" ]; then
    alerts+=("BLOCKED $ref")
  fi

  if [ -n "$budget_min" ] && [ "$budget_min" != "null" ]; then
    elapsed_only="${elapsed_field%%m/*}"
    if [ "$elapsed_only" != "-" ] && [ -n "$elapsed_only" ]; then
      if [ "$elapsed_only" -gt "$budget_min" ] 2>/dev/null; then
        alerts+=("OVER-BUDGET $ref ${elapsed_only}m/${budget_min}m")
      fi
    fi
  fi

  if { [ "$status" = "done" ] || [ "$status" = "idle" ]; } && [ "$report_state" != "-" ] && [ "$report_state" != "none" ]; then
    alerts+=("DONE $ref")
  fi
done

if [ "$load1" != "?" ] && [ "$ncpu" != "?" ]; then
  load1_int=${load1%%.*}
  if [ "$load1_int" -gt "$ncpu" ] 2>/dev/null; then
    alerts+=("LOAD ${load1}/${ncpu}")
  fi
fi

if [ "$heavy_count" -gt 2 ] 2>/dev/null; then
  alerts+=("HEAVY ${heavy_count} processes")
fi

# ---- state tracking for alerts ----
output_alerts=("${alerts[@]}")

if [ "$ALERTS_ONLY" -eq 1 ] && [ -n "$STATE_FILE" ]; then
  # Read previous state
  declare -a prev_alerts
  if [ -f "$STATE_FILE" ]; then
    while IFS= read -r line; do
      prev_alerts+=("$line")
    done < "$STATE_FILE"
  fi

  # Function to extract alert keyword (e.g., "LOAD" from "LOAD 1.5/4")
  extract_keyword() {
    local alert="$1"
    printf '%s' "$alert" | awk '{print $1}'
  }

  # Function to match alert by keyword only (for LOAD/HEAVY which have changing numbers)
  alert_matches_by_keyword() {
    local current="$1"
    local previous="$2"
    local curr_keyword prev_keyword
    curr_keyword=$(extract_keyword "$current")
    prev_keyword=$(extract_keyword "$previous")
    if [ "$curr_keyword" = "LOAD" ] || [ "$curr_keyword" = "HEAVY" ]; then
      [ "$curr_keyword" = "$prev_keyword" ]
    else
      [ "$current" = "$previous" ]
    fi
  }

  # Find new alerts (in current but not in previous)
  declare -a new_alerts
  for curr in "${alerts[@]}"; do
    found=0
    for prev in "${prev_alerts[@]}"; do
      if alert_matches_by_keyword "$curr" "$prev"; then
        found=1
        break
      fi
    done
    if [ "$found" -eq 0 ]; then
      new_alerts+=("$curr")
    fi
  done

  # Find cleared alerts (in previous but not in current)
  declare -a cleared_alerts
  for prev in "${prev_alerts[@]}"; do
    found=0
    for curr in "${alerts[@]}"; do
      if alert_matches_by_keyword "$curr" "$prev"; then
        found=1
        break
      fi
    done
    if [ "$found" -eq 0 ]; then
      keyword=$(extract_keyword "$prev")
      cleared_alerts+=("CLEARED $keyword")
    fi
  done

  # Output new and cleared alerts
  output_alerts=()
  for alert in "${new_alerts[@]}"; do
    output_alerts+=("$alert")
  done
  for alert in "${cleared_alerts[@]}"; do
    output_alerts+=("$alert")
  done

  # Update state file with current alerts
  {
    for alert in "${alerts[@]}"; do
      printf '%s\n' "$alert"
    done
  } > "$STATE_FILE"
fi

# ---- output ----
if [ "$ALERTS_ONLY" -eq 1 ]; then
  for line in "${output_alerts[@]}"; do
    printf '%s\n' "$line"
  done
  exit 0
fi

if [ "$JSON_OUT" -eq 1 ]; then
  {
    printf '{'
    printf '"refs":['
    for i in "${!OUT_REF[@]}"; do
      [ "$i" -gt 0 ] && printf ','
      jq -nc \
        --arg ref "${OUT_REF[$i]}" \
        --arg status "${OUT_STATUS[$i]}" \
        --arg elapsed "${OUT_ELAPSED[$i]}" \
        --arg report "${OUT_REPORT[$i]}" \
        '{ref:$ref,status:$status,elapsed:$elapsed,report:$report}'
    done
    printf '],'
    printf '"machine":'
    jq -nc \
      --arg load1 "$load1" \
      --arg ncpu "$ncpu" \
      --arg mem "$mem_summary" \
      --argjson heavy "$heavy_count" \
      '{load1:$load1,ncpu:$ncpu,mem:$mem,heavy_processes:$heavy}'
    printf ','
    printf '"alerts":['
    for i in "${!alerts[@]}"; do
      [ "$i" -gt 0 ] && printf ','
      jq -nc --arg a "${alerts[$i]}" '$a'
    done
    printf ']'
    printf '}\n'
  }
  exit 0
fi

printf '%-24s %-10s %-14s %-10s %s\n' "ref" "status" "elapsed/budget" "report" "note"
for i in "${!OUT_REF[@]}"; do
  printf '%-24s %-10s %-14s %-10s %s\n' \
    "${OUT_REF[$i]}" "${OUT_STATUS[$i]}" "${OUT_ELAPSED[$i]}" "${OUT_REPORT[$i]}" "${OUT_NOTE[$i]}"
done

printf 'machine: load1=%s ncpu=%s heavy_procs=%s mem: %s\n' "$load1" "$ncpu" "$heavy_count" "$mem_summary"

exit 0
