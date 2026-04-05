---
name: analyze
description: Analyze text to determine if it was written by a human or AI
disable-model-invocation: true
argument-hint: <text-file> [config] [--model MODEL]
---

# Analyze Command

Analyzes text to determine if it was written by a human or AI using the slop-detector agent.

## Prerequisites

Before running, ensure:
1. The ghostwriter plugin is loaded (`ghostwriter-env.sh` must be on PATH)
2. Run `/ghostwriter:setup` if `.ghostwriter/config.json` doesn't exist

Set up the plugin root for tool invocations:
```bash
eval "$(ghostwriter-env.sh)"
```

## Usage

```bash
# Basic analysis
/analyze path/to/text.md

# With config (specifies medium/context)
/analyze path/to/text.md path/to/config.yml
```

## Arguments

- `<text-file>` (required): Path to the text file to analyze
- `[config]` (optional): Path to a YAML config file (author, presets, rules)
- `[--model <haiku|sonnet|opus|MODEL_ID>]` (optional): Model to use. Accepts `haiku`, `sonnet`, `opus`, or any valid model ID. Defaults to `sonnet`

## Execution

### Setup

Ensure the temp directory exists before running:

```bash
mkdir -p "$GHOSTWRITER_ROOT/agent/temp"
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
- Write metrics to: $GHOSTWRITER_ROOT/agent/temp/heuristics-scores.json

## Return Format
Return ONLY these three lines:
Classification: {likely_ai|likely_human|uncertain}
AI Signal Score (0.0-1.0): {heuristicsScore}
Confidence: {N}%
```

### Variable Resolution

- `TEXT_FILE`: First argument (required)
- `CONFIG`: Second argument (optional) — path to YAML config file
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

Read `$GHOSTWRITER_ROOT/agent/temp/heuristics-scores.json` to populate the table from `toolResults`. The TOTAL row uses the overall `heuristicsScore` and `classification`.

Extract reasoning from the detector's return or summarize the key factors that led to the classification.
