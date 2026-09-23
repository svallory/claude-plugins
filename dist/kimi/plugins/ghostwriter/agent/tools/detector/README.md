# Detection Tools

AI text detection tools organized by detection phase. All tools output JSON for easy integration into the heuristics detector.

## Quick Start

```bash
# TypeScript tools
bun agent/tools/detector/vocabulary-scan.ts "text to analyze"
bun agent/tools/detector/structure-analyzer.ts "text to analyze"
bun agent/tools/detector/unicode-punctuation-scan.ts "text to analyze"

# Python tools (use wrapper)
./agent/tools/run-python.sh agent/tools/detector/burstiness-calculator.py "text to analyze"
./agent/tools/run-python.sh agent/tools/detector/ngram-analyzer.py "text to analyze"
./agent/tools/run-python.sh agent/tools/detector/content-analyzer.py "text to analyze"
./agent/tools/run-python.sh agent/tools/detector/syntactic-complexity.py "text to analyze"
./agent/tools/run-python.sh agent/tools/detector/fast-detectgpt-wrapper.py "text to analyze"
./agent/tools/run-python.sh agent/tools/detector/binoculars-wrapper.py "text to analyze"
```

## Phase 1: Quick Wins (No ML)

Fast heuristic detection with no ML dependencies.

### vocabulary-scan.ts

Detects AI vocabulary markers based on frequency multipliers from linguistic analysis.

**Input**: Text to analyze
**Output**: JSON with flagged words, AI vocab score/density, classification

**Key Metrics**:
- `aiVocabDensity`: AI vocabulary markers per 1000 words
- `aiVocabScore`: Normalized contribution score (0-1)
- Threshold: density > 15 = likely_ai, < 5 = likely_human

**Critical Markers** (25x+ frequency in AI text):
- delve/delves/delving
- showcasing
- underscores
- tapestry

**Example**:
```bash
bun agent/tools/detector/vocabulary-scan.ts "Let me delve into this comprehensive topic..."
```

### unicode-punctuation-scan.ts

Analyzes punctuation patterns that differ between human and AI writing.

**Input**: Text to analyze
**Output**: JSON with punctuation metrics and consistency analysis

**Key Metrics**:
- Em dash frequency (threshold: >2.5/1000 = AI)
- Oxford comma consistency
- Period-quote placement consistency
- Semicolon-to-em-dash ratio
- Smart quotes vs straight quotes

**Example**:
```bash
bun agent/tools/detector/unicode-punctuation-scan.ts "This is a test — and a demonstration."
```

### structure-analyzer.ts

Detects structural patterns in text layout and composition.

**Input**: Text to analyze
**Output**: JSON with paragraph, bullet, formula, and transition analysis

**Key Metrics**:
- Paragraph length uniformity (Fano factor < 0.5 = AI)
- Bullet point density
- Opening/closing formulas
- Transition word frequency

**AI Patterns Detected**:
- "In today's fast-paced..." opening formulas
- Very uniform paragraph lengths
- High transition word density

**Example**:
```bash
bun agent/tools/detector/structure-analyzer.ts "In today's digital age, we must understand..."
```

### burstiness-calculator.py

Measures sentence length uniformity using statistical methods.

**Input**: Text to analyze
**Output**: JSON with burstiness metrics

**Key Metrics**:
- Coefficient of Variation (CV): < 30 = AI, > 60 = human
- Fano Factor: < 0.8 = AI, > 1.5 = human
- Mean sentence length
- Variance

**Science**: AI models tend to produce uniform sentence lengths, while human writers vary naturally.

**Example**:
```bash
./agent/tools/run-python.sh agent/tools/detector/burstiness-calculator.py "Text here."
```

## Phase 2: Pattern Matchers (spaCy)

Dependency parsing and NLP-based pattern detection.

### ngram-analyzer.py

Analyzes n-gram patterns and phrase frequency.

**Input**: Text to analyze
**Output**: JSON with n-gram statistics

**Key Metrics**:
- Type-Token Ratio (TTR): low = more repetitive = AI
- Common AI phrase patterns
- Bigram/trigram analysis

### content-analyzer.py

Detects hedging language, clichés, and semantic patterns.

**Input**: Text to analyze
**Output**: JSON with content-level signals

**Key Metrics**:
- Hedging language count (>10/1000 = AI)
- Cliché density
- Superlative frequency (>8/1000 = AI)
- Topic coherence

**Common AI Patterns**:
- "While it's true that..."
- "In a word"
- "The importance of..."
- Overuse of superlatives

### syntactic-complexity.py

Analyzes sentence structure and grammatical complexity.

**Input**: Text to analyze
**Output**: JSON with syntactic metrics

**Key Metrics**:
- Dependency depth
- Sentence type distribution
- POS (Part-of-Speech) distribution
- Clausal complexity

## Phase 3: Statistical Models

Advanced statistical analysis using pre-trained models.

### perplexity-calculator.py

Measures text predictability using GPT-2.

**Input**: Text to analyze
**Output**: JSON with perplexity score

**Key Metrics**:
- Perplexity score (< 20 = AI, > 50 = human)
- Per-token probabilities
- Entropy metrics

**Rationale**: AI-generated text follows training distribution more closely, resulting in lower perplexity.

**Example**:
```bash
./agent/tools/run-python.sh agent/tools/detector/perplexity-calculator.py "Text here."
```

## Phase 4: Advanced Detection

LLM-based detection using Claude CLI (haiku model) to simulate statistical detection methods.

### fast-detectgpt-wrapper.py

Claude CLI-backed detector that performs Fast-DetectGPT-style conditional probability curvature analysis.

**Input**: Text to analyze
**Output**: JSON with probability, classification, confidence, signals, summary

**Key Metrics**:
- `probability`: AI generation probability (0-1). > 0.70 = likely_ai, < 0.30 = likely_human
- `confidence`: Classification confidence (0.3-0.95)
- `signals`: Evidence supporting the classification

**Method**: Prompts Claude (haiku) to analyze text for token predictability, distributional patterns, and structural predictability — the same factors underlying Fast-DetectGPT's curvature metric.

**Example**:
```bash
./agent/tools/run-python.sh agent/tools/detector/fast-detectgpt-wrapper.py "Text here."
```

### binoculars-wrapper.py

Claude CLI-backed detector that performs Binoculars-style cross-perplexity analysis.

**Input**: Text to analyze
**Output**: JSON with binocularsScore, threshold, classification, confidence, signals, summary

**Key Metrics**:
- `binocularsScore`: Cross-perplexity ratio (lower = more AI). < 0.8536 = likely_ai, > 0.9015 = likely_human
- `threshold`: Detection threshold
- `confidence`: Classification confidence (0.3-0.95)

**Method**: Prompts Claude (haiku) to analyze text for cross-perplexity patterns, observer-performer divergence, and distributional signatures — the same factors underlying the Binoculars metric.

**Example**:
```bash
./agent/tools/run-python.sh agent/tools/detector/binoculars-wrapper.py "Text here."
```

## Heuristics Score Weights

For combined detection, use these weights (from research):

| Tool | Weight | Metric Type |
|------|--------|-------------|
| Binoculars | 0.20 | Cross-perplexity ratio |
| Fast-DetectGPT | 0.15 | Conditional probability curvature |
| Vocabulary | 0.15 | AI marker words |
| Burstiness | 0.12 | Sentence length variance |
| N-gram | 0.12 | Phrase patterns |
| Syntactic | 0.10 | Dependency structure |
| Content | 0.10 | Hedging/clichés |
| Punctuation | 0.06 | Em dash/punctuation ratios |

## Key Detection Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| Binoculars score | < 0.8536 | > 0.9015 |
| Fast-DetectGPT prob | > 0.70 | < 0.30 |
| Burstiness CV | < 30 | > 60 |
| Fano Factor | < 0.8 | > 1.5 |
| AI Vocab Density | > 15/1000 | < 5/1000 |
| Em Dash Density | > 2.5/1000 | < 1/1000 |
| Hedging Language | > 10/1000 | < 3/1000 |
| Superlatives | > 8/1000 | < 2/1000 |

## Output Format

All tools output JSON with this structure:

```json
{
  "metrics": { /* tool-specific metrics */ },
  "signals": ["Signal 1", "Signal 2"],
  "classification": "likely_ai|likely_human|uncertain",
  "confidence": 0.75,
  "summary": "Human-readable summary"
}
```

**Fields**:
- `metrics`: Detailed measurements from the analysis
- `signals`: Array of detected AI/human indicators
- `classification`: Overall classification
- `confidence`: Confidence score (0-1)
- `summary`: Human-readable description

## Setup

### Python Dependencies

```bash
# Create virtual environment (Python 3.12)
python3 -m venv ../../.venv

# Activate and install dependencies
source ../../.venv/bin/activate
pip install nltk numpy spacy
python -m spacy download en_core_web_sm
python -c "import nltk; nltk.download('punkt_tab', quiet=True)"
```

### Claude CLI (for Phase 4 tools)

Fast-DetectGPT and Binoculars wrappers require the Claude CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

### TypeScript Dependencies

```bash
bun install  # If not already installed at project root
```

## Adding New Detection Tools

1. **Create the script** in `agent/tools/detector/`
2. **Follow the output format** above (JSON with metrics, signals, classification, confidence)
3. **Update this README** with tool description and thresholds
4. **Test** with sample AI and human text
5. **Update ensemble weights** in research documentation if needed
