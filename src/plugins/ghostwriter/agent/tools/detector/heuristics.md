# Heuristics Detector

The heuristics detector (`heuristics.ts`) runs all detection tools in parallel and combines their scores using research-validated weights to produce a unified AI detection result.

## Usage

```bash
# From project root
echo "text to analyze" | bun agent/tools/detector/heuristics.ts
bun agent/tools/detector/heuristics.ts "text to analyze"
```

## How It Works

1. **Parallel Execution**: All detection tools run simultaneously using `Promise.allSettled`
2. **Weighted Scoring**: Each tool's result is converted to a 0-1 score and multiplied by its heuristics weight
3. **Aggregation**: Weighted scores are summed and normalized to produce the final heuristics score
4. **Classification**: Score thresholds determine if text is "likely_ai", "likely_human", or "uncertain"

## Heuristics Weights

Based on research documented in `/research/detection/tool-specifications.md`:

| Tool | Weight | Purpose |
|------|--------|---------|
| Binoculars | 0.20 | Cross-perplexity ratio (best published accuracy) |
| Fast-DetectGPT | 0.15 | Conditional probability curvature |
| Vocabulary | 0.15 | AI marker word detection |
| Burstiness | 0.12 | Sentence length variance |
| N-gram | 0.12 | Phrase pattern analysis |
| Syntactic | 0.10 | Structural complexity |
| Content | 0.10 | Specificity and hedging |
| Punctuation | 0.06 | Character-level patterns |

## Output Structure

```json
{
  "heuristicsScore": 0.459,
  "classification": "likely_ai" | "likely_human" | "uncertain",
  "confidence": 0.5,
  "toolResults": {
    "vocabulary": {
      "score": 0.6,
      "classification": "likely_ai",
      "confidence": 0.5,
      "weight": 0.15,
      "weightedContribution": 0.09,
      "signals": ["array of detected signals"],
      "error": "optional error message"
    },
    // ... other tools
  },
  "topSignals": ["top 10 signals ranked by weight"],
  "summary": "Human-readable summary"
}
```

## Classification Thresholds

- **likely_ai**: heuristics score > 0.70
- **likely_human**: heuristics score < 0.30
- **uncertain**: 0.30 ≤ heuristics score ≤ 0.70

## Error Handling

- If a tool fails, it's excluded from the weighted calculation
- Weights are recalculated to sum to 1.0 for available tools
- Analysis continues with partial results
- Claude CLI tools (Fast-DetectGPT, Binoculars) have 30s timeout

## Performance

- TypeScript tools: ~100-500ms each
- Python tools: ~1-5s each
- Fast-DetectGPT / Binoculars: ~5-15s each (Claude CLI calls, no local model loading)
- Total runtime: ~5-20s depending on text length

## Integration

The Detector agent can invoke this tool to get a comprehensive analysis without needing to call each tool individually:

```typescript
// In agent logic
const result = await runTool("bun agent/tools/detector/heuristics.ts", text);
// Result contains pre-computed analysis from all tools
```

## Files in This Directory

### Detection Tools

- `vocabulary-scan.ts` - AI vocabulary markers (weight: 0.15)
- `unicode-punctuation-scan.ts` - Punctuation patterns (weight: 0.06)
- `structure-analyzer.ts` - Structural patterns (part of content: 0.10)
- `burstiness-calculator.py` - Sentence length variance (weight: 0.12)
- `ngram-analyzer.py` - N-gram patterns (weight: 0.12)
- `content-analyzer.py` - Content quality signals (weight: 0.10)
- `syntactic-complexity.py` - Syntax analysis (weight: 0.10)
- `binoculars-wrapper.py` - Cross-perplexity ratio detection (weight: 0.20)
- `fast-detectgpt-wrapper.py` - Conditional probability curvature (weight: 0.15)

### Orchestration

- `heuristics.ts` - Main ensemble detector

### Documentation

- `README.md` - Individual tool documentation
- `ENSEMBLE.md` - This file
