---
name: analyze
description: Analyze text to determine if it was written by a human or AI
disable-model-invocation: true
argument-hint: <text-file> [publication|config] [--model MODEL]
---

# Analyze Command

Analyzes text to determine if it was written by a human or AI using the slop-detector agent.

## Prerequisites

Before running, ensure:
1. The ghostwriter plugin is loaded (`ghostwriter-env.sh` must be on PATH)
2. Run `/ghostwriter:setup` if `.ghostwriter/` directory doesn't exist

Set up the plugin root for tool invocations:
```bash
eval "$(ghostwriter-env.sh)"
```

## Publication Name Resolution

Commands accept a **publication name** instead of a config path. When the last argument matches a directory in `.ghostwriter/publications/`, it's treated as a publication name:

```bash
# Resolve publication config
PUB_NAME="{last argument}"
PUB_DIR=".ghostwriter/publications/$PUB_NAME"
CONFIG="$PUB_DIR/config.yml"
```

If `$PUB_DIR` exists and contains `config.yml`, use it. Otherwise, treat the argument as a literal file path (backwards compatible).

When using a publication name:
- **Content root**: read from `config.content.root` (relative to config file, resolve to absolute)
- **File paths**: relative to the content root
- **Pipeline data**: stored at `$PUB_DIR/pipeline/`
- **Learned patterns**: resolved from `.ghostwriter/` hierarchy

## Usage

```bash
/ghostwriter:analyze path/to/text.md
/ghostwriter:analyze guides/getting-started.md developer-docs
/ghostwriter:analyze path/to/text.md path/to/config.yml
```

## Arguments

- `<text-file>` (required): Path to the text file to analyze (relative to content root when publication name is given)
- `[publication]` (optional): Publication name (directory under `.ghostwriter/publications/`) — or a path to a YAML config file
- `[--model <haiku|sonnet|opus|MODEL_ID>]` (optional): Model to use. Accepts `haiku`, `sonnet`, `opus`, or any valid model ID. Defaults to `sonnet`

## Execution

### Setup

Resolve temp directory based on whether a publication name is used:

```bash
# If publication name resolved:
TEMP_DIR="$PUB_DIR/pipeline/temp"
# Otherwise:
TEMP_DIR="$GHOSTWRITER_ROOT/agent/temp"

mkdir -p "$TEMP_DIR"
```

### Run Detector

Run the `slop-detector` subagent with the following prompt.

Spawn with: `model: {MODEL}`, `subagent_type: slop-detector`

### Prompt Template

```markdown
Analyze this text to determine if it was written by a human or AI.

## Input
File: {TEXT_FILE}
{{#if CONFIG}}
Config: {CONFIG}
{{/if}}

## Output
- Write metrics to: $TEMP_DIR/heuristics-scores.json

## Return Format
Return ONLY these three lines:
Classification: {likely_ai|likely_human|uncertain}
AI Signal Score (0.0-1.0): {heuristicsScore}
Confidence: {N}%
```

### Variable Resolution

- `TEXT_FILE`: First argument (required). If publication name resolved, interpret relative to content root.
- `CONFIG`: Second argument (optional) — publication name (resolved to `.ghostwriter/publications/{name}/config.yml`) or a literal YAML config file path
- `TEMP_DIR`: `$PUB_DIR/pipeline/temp` when publication name resolved; `$GHOSTWRITER_ROOT/agent/temp` otherwise
- `MODEL`: Value of `--model` flag, defaults to `sonnet`

## Output Display

After the detector returns, display results in the format examplified below.

```markdown
Detection Analysis Summary

Category Scores
┌─────────────┬───────┬────────────────┬────────────┬────────┬──────────────┐
│  Category   │ Score │ Classification │ Confidence │ Weight │ Contribution │
├─────────────┼───────┼────────────────┼────────────┼────────┼──────────────┤
│ Vocabulary  │ 0.25  │ likely_human   │ 65%        │ 0.15   │ 0.0375       │
├─────────────┼───────┼────────────────┼────────────┼────────┼──────────────┤
│ Punctuation │ 0.90  │ likely_ai      │ 95%        │ 0.06   │ 0.0540       │
├─────────────┼───────┼────────────────┼────────────┼────────┼──────────────┤
│ Structure   │ 0.25  │ likely_human   │ 75%        │ 0.10   │ 0.0250       │
├─────────────┼───────┼────────────────┼────────────┼────────┼──────────────┤
│ Burstiness  │ 0.10  │ likely_human   │ 95%        │ 0.12   │ 0.0120       │
├─────────────┼───────┼────────────────┼────────────┼────────┼──────────────┤
│ N-gram      │ 0.10  │ likely_human   │ 95%        │ 0.12   │ 0.0120       │
├─────────────┼───────┼────────────────┼────────────┼────────┼──────────────┤
│ Content     │ 0.25  │ likely_human   │ 75%        │ 0.10   │ 0.0250       │
├─────────────┼───────┼────────────────┼────────────┼────────┼──────────────┤
│ Syntactic   │ 0.60  │ uncertain      │ 20%        │ 0.10   │ 0.0600       │
└─────────────┴───────┴────────────────┴────────────┴────────┴──────────────┘

Overall Result
┌──────────────────┬───────────┐
│      Metric      │   Value   │
├──────────────────┼───────────┤
│ Final Score      │ 0.301     │
├──────────────────┼───────────┤
│ Classification   │ uncertain │
├──────────────────┼───────────┤
│ Confidence       │ 73%       │
└──────────────────┴───────────┘
Key Signals

Human Indicators (5/7 categories):
- Exceptional sentence length variation (CV: 61.0, Fano: 2.87)
- Very high phrase diversity (TTR: 0.995, hapax: 0.996)
- Low hedging (3.1/1000 words)
- Variable paragraph structure (Fano: 15.72)
- Punchy, direct style with very short sentences

AI Indicators (1/7 categories):
- Heavy em-dash usage (9.87 per 1000 words)
- Perfect punctuation consistency (100% Oxford comma, 100% period-quote placement)
- Zero semicolons (unusual for book-length writing)

## Reasoning:

[succinct summary from detector's assessment]
```

Read `$TEMP_DIR/heuristics-scores.json` to populate the table from `toolResults`. The TOTAL row uses the overall `heuristicsScore` and `classification`.

Extract reasoning from the detector's return or summarize the key factors that led to the classification.
