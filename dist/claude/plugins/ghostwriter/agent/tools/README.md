# Adversarial Agent Tools

Tools for the AI text detection adversarial training system organized by function. All tools output JSON for easy integration.

## Directory Structure

```
agent/tools/
├── detector/              # Detection tools
│   ├── vocabulary-scan.ts
│   ├── unicode-punctuation-scan.ts
│   ├── structure-analyzer.ts
│   ├── burstiness-calculator.py
│   ├── ngram-analyzer.py
│   ├── content-analyzer.py
│   ├── syntactic-complexity.py
│   ├── perplexity-calculator.py
│   ├── detectgpt.py
│   ├── heuristics.ts        # Aggregates all detectors
│   └── README.md
├── writer/                # (empty - Writer agent generates human-like text directly)
├── lib/                   # Shared utilities
│   └── cli-utils.ts
├── detect-fast.ts        # Fast detectors only (no Python ML)
├── run-python.sh         # Python venv wrapper
├── run-python-with-out.sh # Python wrapper with --out support
├── version-config.sh     # Agent/skill versioning
└── README.md             # This file
```

## Quick Start

```bash
# Detection (direct invocation)
bun agent/tools/detector/vocabulary-scan.ts "text to analyze"
bun agent/tools/detector/heuristics.ts "text to analyze" --out results.json
./agent/tools/run-python.sh agent/tools/detector/burstiness-calculator.py "text to analyze"
```

## Usage Examples

```bash
# Analyze text from file
bun agent/tools/detector/vocabulary-scan.ts input.md

# Save output to file
bun agent/tools/detector/heuristics.ts input.md --out results.json

# Run Python detector
./agent/tools/run-python.sh agent/tools/detector/burstiness-calculator.py "Your text here"
```

## Detection Tools (`detector/`)

See [detector/README.md](detector/README.md) for detailed documentation.

### Phase 1: Quick Wins (No ML)

| Tool | Language | Purpose | Usage |
|------|----------|---------|-------|
| `vocabulary-scan.ts` | TypeScript | Detect AI vocabulary markers | `bun agent/tools/detector/vocabulary-scan.ts "<text>"` |
| `unicode-punctuation-scan.ts` | TypeScript | Em dashes, smart quotes, punctuation ratios | `bun agent/tools/detector/unicode-punctuation-scan.ts "<text>"` |
| `burstiness-calculator.py` | Python | Sentence length uniformity (CV, Fano Factor) | `./run-python.sh agent/tools/detector/burstiness-calculator.py "<text>"` |
| `structure-analyzer.ts` | TypeScript | Paragraph uniformity, formulas, bullet density | `bun agent/tools/detector/structure-analyzer.ts "<text>"` |

### Phase 2: Pattern Matchers (spaCy)

| Tool | Language | Purpose | Usage |
|------|----------|---------|-------|
| `ngram-analyzer.py` | Python | N-gram patterns, TTR, AI phrase detection | `./run-python.sh agent/tools/detector/ngram-analyzer.py "<text>"` |
| `content-analyzer.py` | Python | Hedging, clichés, superlatives, topic coherence | `./run-python.sh agent/tools/detector/content-analyzer.py "<text>"` |
| `syntactic-complexity.py` | Python | Dependency depth, sentence types, POS distribution | `./run-python.sh agent/tools/detector/syntactic-complexity.py "<text>"` |

### Phase 3: Statistical Models

| Tool | Language | Purpose | Usage |
|------|----------|---------|-------|
| `perplexity-calculator.py` | Python | GPT-2 based perplexity analysis | `./run-python.sh agent/tools/detector/perplexity-calculator.py "<text>"` |

### Phase 4: Advanced Detection

| Tool | Language | Purpose | Usage |
|------|----------|---------|-------|
| `detectgpt.py` | Python | Fast-DetectGPT probability curvature | `./run-python.sh agent/tools/detector/detectgpt.py "<text>"` |

## Utility Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `run-python.sh` | Wrapper to run Python tools with venv | `./run-python.sh agent/tools/detector/<script.py> [args]` |
| `version-config.sh` | Backup agents/skills before editing | `./version-config.sh --agent|--skill <name>` |

## Ensemble Weights

For combined detection, use these weights (from research):

| Tool | Weight | Metric Type |
|------|--------|-------------|
| DetectGPT | 0.20 | Probability curvature |
| Perplexity | 0.15 | Token prediction difficulty |
| Vocabulary | 0.15 | AI marker words |
| Burstiness | 0.12 | Sentence length variance |
| N-gram | 0.12 | Phrase patterns |
| Syntactic | 0.10 | Dependency structure |
| Content | 0.10 | Hedging/clichés |
| Punctuation | 0.06 | Em dash/punctuation ratios |

## Key Detection Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| Perplexity | < 20 | > 50 |
| Burstiness CV | < 30 | > 60 |
| Fano Factor | < 0.8 | > 1.5 |
| DetectGPT d_score | > 2.0 | < 0.5 |
| AI Vocab Density | > 15/1000 | < 5/1000 |
| Em Dash Density | > 2.5/1000 | < 1/1000 |
| Hedging Language | > 10/1000 | < 3/1000 |
| Superlatives | > 8/1000 | < 2/1000 |

## Setup

### Python Dependencies

```bash
# Create virtual environment (Python 3.12)
python3 -m venv .venv

# Activate and install dependencies
source .venv/bin/activate
pip install nltk numpy spacy transformers torch
python -m spacy download en_core_web_sm
python -c "import nltk; nltk.download('punkt_tab', quiet=True)"
```

### TypeScript Dependencies

```bash
bun install  # If not already installed
```

## Tool Output Format

All tools output JSON with:
- Metrics specific to the analysis
- `signals`: Array of detected AI/human indicators
- `classification`: `"likely_ai"` | `"likely_human"` | `"uncertain"`
- `confidence`: Float 0-1
- `summary`: Human-readable description

Example:
```json
{
  "metrics": { ... },
  "signals": ["Low CV (<30): uniform sentence lengths"],
  "classification": "likely_ai",
  "confidence": 0.85,
  "summary": "Strong AI indicators detected..."
}
```

## Adding New Tools

### Detection Tools

1. Create the script in `agent/tools/detector/`
2. Follow the output format above (JSON with metrics, signals, classification, confidence)
3. Update `detector/README.md`
4. Test with sample AI and human text
5. Update ensemble weights if needed
