---
name: audit
description: Scan all files in a publication for AI signals and report which need work
argument-hint: <publication> [--threshold N] [--format table|detailed] [--force]
---

# Audit Publication

Scans all content files in a publication, runs the detector on each, and produces a prioritized report showing which files need humanization work. Results are cached — unchanged files are skipped on re-runs.

## Usage

```bash
/ghostwriter:audit developer-docs
/ghostwriter:audit developer-docs --threshold 40
/ghostwriter:audit developer-docs --format detailed
/ghostwriter:audit developer-docs --force            # Re-scan all files, ignore cache
```

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `<publication>` | yes | — | Publication slug (directory name in `.ghostwriter/publications/`) |
| `--threshold N` | no | `30` | AI signal score threshold (0-100). Files scoring above this need work. |
| `--format` | no | `table` | Output format: `table` (summary) or `detailed` (per-file breakdown) |
| `--force` | no | — | Re-scan all files, ignoring cached results |

## Prerequisites

```bash
eval "$(ghostwriter-env.sh)"
```

Ensure `.ghostwriter/` exists. If not, run `/ghostwriter:setup` first.

## Process

### Step 1: Resolve Publication

```bash
PUB_NAME="$ARGUMENTS"  # First argument (strip flags)
PUB_DIR=".ghostwriter/publications/$PUB_NAME"
CONFIG="$PUB_DIR/config.yml"
AUDIT_DIR="$PUB_DIR/pipeline/audit"
CACHE_FILE="$AUDIT_DIR/cache.json"
REPORT_FILE="$PUB_DIR/audit-report.md"
```

Verify `$PUB_DIR` exists and contains `config.yml`. If not: "Publication '{PUB_NAME}' not found. Run `/ghostwriter:publications list` to see available publications."

### Step 2: Resolve Content Files

Read `$CONFIG` to get `content.root` and `content.glob` (default: `**/*.md`).

Resolve `CONTENT_ROOT` relative to the config file location:
```bash
CONTENT_ROOT="$(cd "$(dirname "$CONFIG")" && cd "{content.root from config}" && pwd)"
```

Find all matching files. Apply `content.ignore` patterns if defined.

If staged workflow, scan files in the latest stage that has content.

Report: "Found {N} files in {publication name}"

If zero files: "No content files found at {CONTENT_ROOT} matching {glob}." and STOP.

### Step 3: Load Cached Results

```bash
mkdir -p "$AUDIT_DIR"
```

If `$CACHE_FILE` exists and `--force` was NOT given, read it. The file is a JSON object:

```json
{
  "publication": "developer-docs",
  "scanned_at": "2026-04-05T14:30:00Z",
  "threshold": 30,
  "content_root": "/absolute/path/to/content",
  "files": {
    "guides/getting-started.md": {
      "modified_at": "2026-04-05T10:15:00Z",
      "score": 0.41,
      "confidence": 62,
      "classification": "uncertain",
      "top_signal": "Uniform sentence length (CV=28)",
      "scanned_at": "2026-04-05T14:30:00Z"
    },
    "api/authentication.md": {
      "modified_at": "2026-04-04T09:00:00Z",
      "score": 0.58,
      "confidence": 45,
      "classification": "uncertain",
      "top_signal": "Vocabulary: \"comprehensive\" x3",
      "scanned_at": "2026-04-05T14:30:00Z"
    }
  }
}
```

For each content file found in Step 2, compare its current modification time against the cached `modified_at`:
- If the file hasn't changed (same mtime) → **skip** (use cached result)
- If the file is new or modified → **needs scanning**
- If a cached file no longer exists → **remove from cache**

Report:
```
Cache: {N} files cached, {M} need scanning ({K} new, {J} modified), {L} skipped (unchanged)
```

If `--force`: scan all files regardless of cache.

### Step 4: Run Detector on Files Needing Scanning

For each file that needs scanning, run the detection heuristics.

**Parallel batches:** Process up to 5 files concurrently using the Task tool.

For each file, spawn a `slop-detector` subagent:

```markdown
Analyze this text to determine if it was written by a human or AI.

## Input
File: {absolute_path_to_file}
Config: {CONFIG}

## Output
- Write metrics to: {AUDIT_DIR}/{relative_path}.json

## Return Format
Return ONLY these three lines:
Classification: {likely_ai|likely_human|uncertain}
AI Signal Score (0.0-1.0): {heuristicsScore}
Confidence: {N}%
```

Spawn with: `model: haiku`, `subagent_type: slop-detector`

**Alternative (faster for small batches):** Run the heuristics tool directly:

```bash
bun "$GHOSTWRITER_ROOT/agent/tools/detector/heuristics.ts" "$(cat "$FILE")" \
    --config "$CONFIG" \
    --out "$AUDIT_DIR/${RELATIVE_PATH}.json"
```

For publications with 10+ files needing scanning, prefer parallel subagents.

### Step 5: Collect and Cache Results

For each newly scanned file, read the output JSON from `$AUDIT_DIR/{relative_path}.json` and extract:
- `heuristicsScore` (0.0-1.0)
- `classification`
- `topSignals[0]` (first/strongest signal)

Get the file's current modification time:
```bash
stat -f "%m" "$FILE"  # macOS
# or: stat -c "%Y" "$FILE"  # Linux
```

Build the results object combining cached (unchanged) and newly scanned files. Write `$CACHE_FILE`:

```json
{
  "publication": "{PUB_NAME}",
  "scanned_at": "{ISO timestamp}",
  "threshold": {THRESHOLD},
  "content_root": "{CONTENT_ROOT}",
  "files": {
    "{relative_path}": {
      "modified_at": "{ISO timestamp of file mtime}",
      "score": 0.41,
      "confidence": 62,
      "classification": "uncertain",
      "top_signal": "Uniform sentence length (CV=28)",
      "scanned_at": "{ISO timestamp when this file was scanned}"
    }
  }
}
```

### Step 6: Generate Report

Sort files by score descending (worst first).

Write the report to **both** the terminal (displayed to user) AND `$REPORT_FILE` (markdown file in the publication directory). The markdown file is the persistent record; the terminal output is the same content.

#### Table format (default)

```
Ghostwriter Audit: {Publication Name}
Content: {CONTENT_ROOT}
Files scanned: {N total} ({M} new/modified, {L} cached)
Threshold: {THRESHOLD}%
Last full scan: {scanned_at from results}

Score  Conf  Status      Modified             File                                    Top Signal
─────  ────  ──────────  ───────────────────  ──────────────────────────────────────  ─────────────────────────────
0.72    28%  NEEDS WORK  2026-04-05 10:15     guides/advanced-config.md               High em-dash density (5.2/1k)
0.58    45%  NEEDS WORK  2026-04-04 09:00     api/authentication.md                   Vocabulary: "comprehensive" x3
0.41    62%  NEEDS WORK  2026-04-05 10:15     guides/getting-started.md               Uniform sentence length (CV=28)
0.28    72%  OK          2026-04-03 16:30     tutorials/quick-start.md                —
0.19    81%  OK          2026-04-02 11:00     reference/api-keys.md                   —
0.15    85%  OK          2026-04-01 14:20     index.md                                —

Summary:
  Needs work:  3 files (score > 0.30)
  OK:          3 files
  Worst:       guides/advanced-config.md (0.72, 28% human confidence)
  Best:        index.md (0.15, 85% human confidence)
```

- **Score** = AI signal score (0.0-1.0, higher = more AI-like)
- **Conf** = Human confidence (0-100%, higher = more likely human)
- **Status**: score > threshold/100 → `NEEDS WORK`, otherwise `OK`

#### Detailed format

Same table, plus per-category breakdown for each NEEDS WORK file:

```
─── guides/advanced-config.md (score: 0.72, confidence: 28%) ───

  Category     Score  Classification  Weight  Signals
  vocabulary   0.85   likely_ai       0.15    "comprehensive" x3, "leverage" x2
  punctuation  0.90   likely_ai       0.05    em-dash density 5.2/1k (threshold: 4.0)
  burstiness   0.35   uncertain       0.12    CV=38 (threshold: 30)
  structure    0.25   likely_human    0.05    paragraph variation OK
  content      0.60   uncertain       0.08    hedging density 8.2/1k
  syntactic    0.70   uncertain       0.10    low depth variance (0.8)
  ngram        0.45   uncertain       0.10    moderate phrase repetition

  Suggestions:
  - Replace "comprehensive" and "leverage" (vocabulary markers)
  - Reduce em-dash density from 5.2 to ~2.0 per 1k words
  - Increase sentence length variation (CV 38 → 50+)
```

### Step 7: Write Report File

Write the full report (same content displayed to the terminal) to `$REPORT_FILE`:

```markdown
# Audit Report: {Publication Name}

**Date:** {ISO date}
**Content:** {CONTENT_ROOT}
**Files scanned:** {N total} ({M} new/modified, {L} cached)
**Threshold:** {THRESHOLD}%

## Results

| Score | Conf | Status | Modified | File | Top Signal |
|-------|------|--------|----------|------|------------|
| 0.72 | 28% | NEEDS WORK | 2026-04-05 | guides/advanced-config.md | High em-dash density |
| ... | | | | | |

## Summary

- **Needs work:** {N} files (score > {threshold})
- **OK:** {N} files
- **Worst:** {file} ({score}, {confidence}% human confidence)
- **Best:** {file} ({score}, {confidence}% human confidence)

{if detailed format, include per-file breakdowns here}
```

If `--format detailed`, include the per-category breakdown sections for each NEEDS WORK file in the markdown report as well.

### Step 8: Suggest Next Steps

```
Report saved to: {REPORT_FILE}
Cache saved to:  {CACHE_FILE}

Next steps:
  # Fix worst file first
  /ghostwriter:humanize guides/advanced-config.md {publication}

  # Or batch humanize all files needing work
  /ghostwriter:humanize-all {publication}

  # Re-audit after changes (only re-scans modified files)
  /ghostwriter:audit {publication}

  # Force full re-scan
  /ghostwriter:audit {publication} --force
```
