# Detection Tool Specifications

**Note on Thresholds**: The threshold values in this document are proposed guidelines for implementation. They are derived from the qualitative patterns documented in the research literature but should be validated and calibrated against labeled datasets before production use. Specific numeric thresholds may need adjustment based on your use case, text domain, and target accuracy.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DETECTOR AGENT                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐│
│  │   Statistical    │  │     Lexical      │  │      Structural        ││
│  │      Layer       │  │      Layer       │  │        Layer           ││
│  ├──────────────────┤  ├──────────────────┤  ├────────────────────────┤│
│  │ perplexity       │  │ vocab_fingerprint│  │ sentence_variance      ││
│  │ burstiness       │  │ ngram_analyzer   │  │ paragraph_analyzer     ││
│  │ detectgpt        │  │ phrase_detector  │  │ syntactic_complexity   ││
│  │ zipf_test        │  │ pos_patterns     │  │ list_density           ││
│  └──────────────────┘  └──────────────────┘  └────────────────────────┘│
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐│
│  │   Character      │  │     Content      │  │      Aggregator        ││
│  │      Layer       │  │      Layer       │  │                        ││
│  ├──────────────────┤  ├──────────────────┤  ├────────────────────────┤│
│  │ unicode_scanner  │  │ specificity      │  │ weighted_ensemble      ││
│  │ punctuation      │  │ hedge_detector   │  │ confidence_calibrator  ││
│  │ quote_analyzer   │  │ formula_detector │  │ explanation_generator  ││
│  └──────────────────┘  └──────────────────┘  └────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tool 1: Perplexity Calculator

### Interface

```typescript
interface PerplexityTool {
  input: {
    text: string;
    model?: 'gpt2' | 'gpt2-medium' | 'gpt2-large';
    stride?: number;  // Default 512
  };

  output: {
    overall_perplexity: number;
    per_sentence: Array<{
      sentence: string;
      perplexity: number;
      token_count: number;
    }>;
    mean: number;
    std: number;
    min: number;
    max: number;
    classification: 'likely_ai' | 'likely_human' | 'uncertain';
    confidence: 'high' | 'medium' | 'low';
  };
}
```

### Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| Overall PPL | < 20 | > 50 |
| Mean sentence PPL | < 15 | > 40 |
| PPL std | < 10 | > 25 |

### Weight in Ensemble: **0.15**

---

## Tool 2: Burstiness Calculator

### Interface

```typescript
interface BurstinessTool {
  input: {
    text: string;
    perplexity_scores?: number[];  // Optional pre-computed
  };

  output: {
    // Sentence length metrics
    sentence_count: number;
    length_mean: number;
    length_std: number;
    length_variance: number;
    length_range: number;

    // Burstiness metrics
    coefficient_of_variation: number;  // (std/mean)*100
    fano_factor: number;               // variance/mean

    // Perplexity burstiness (if scores provided)
    perplexity_burstiness?: number;
    perplexity_cv?: number;

    // Classification
    uniformity_score: number;  // 0-1, higher = more uniform (AI-like)
    classification: 'likely_ai' | 'likely_human' | 'uncertain';
  };
}
```

### Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| CV | < 30 | > 60 |
| Fano Factor | < 0.8 | > 1.5 |
| Uniformity | > 0.8 | < 0.5 |

### Weight in Ensemble: **0.12**

---

## Tool 3: DetectGPT Scorer

### Interface

```typescript
interface DetectGPTTool {
  input: {
    text: string;
    source_model?: string;      // Default 'gpt2-medium'
    perturbation_model?: string; // Default 't5-large'
    n_perturbations?: number;   // Default 100
    fast_mode?: boolean;        // Use Fast-DetectGPT
  };

  output: {
    d_score: number;           // Curvature score
    original_log_prob: number;
    mean_perturbed_log_prob: number;
    std_perturbed_log_prob: number;
    n_valid_perturbations: number;
    classification: 'likely_ai' | 'likely_human' | 'uncertain';
    confidence: 'high' | 'medium' | 'low';
  };
}
```

### Thresholds

| d_score | Classification |
|---------|----------------|
| > 2.0 | AI (high confidence) |
| 1.0 - 2.0 | Likely AI |
| 0.5 - 1.0 | Uncertain |
| < 0.5 | Likely Human |
| < -1.0 | Human (high confidence) |

### Weight in Ensemble: **0.20** (highest - most reliable)

---

## Tool 4: Vocabulary Fingerprint

### Interface

```typescript
interface VocabFingerprint {
  input: {
    text: string;
  };

  output: {
    // AI marker detection
    flagged_words: Array<{
      word: string;
      count: number;
      multiplier: number;
      contribution: number;
    }>;
    ai_vocab_score: number;
    ai_vocab_density: number;  // Per 1000 words

    // Lexical diversity
    ttr: number;
    mtld: number;
    mattr: number;

    // Hapax analysis
    hapax_ratio: number;
    vocabulary_size: number;

    // Model fingerprint (if detectable)
    suspected_model?: 'gpt' | 'claude' | 'gemini' | 'unknown';
    model_confidence: 'high' | 'medium' | 'low';
  };
}
```

### AI Marker Vocabulary

```typescript
// Verified frequency multipliers from Kobak et al. (2024) arXiv:2406.07016
// Values represent frequency ratio vs pre-ChatGPT baseline
const AI_VOCAB_MULTIPLIERS: Record<string, number> = {
  // High confidence markers (verified from PubMed study)
  'delve': 25.2, 'delves': 25.2, 'delving': 25.2,
  'showcasing': 9.2, 'underscores': 9.1,
  'tapestry': 10,

  // Medium confidence markers (relative weights)
  'comprehensive': 5, 'crucial': 5, 'meticulous': 5,
  'robust': 5, 'pivotal': 5,

  // Lower confidence markers
  'harness': 3, 'leverage': 3, 'utilize': 3,
  'notably': 3, 'furthermore': 3, 'bustling': 6, 'vibrant': 4
};
```

### Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| AI vocab density | > 15 | < 5 |
| MTLD | < 50 | > 80 |
| Hapax ratio | < 0.4 | > 0.5 |

### Weight in Ensemble: **0.15**

---

## Tool 5: N-gram Analyzer

### Interface

```typescript
interface NGramAnalyzer {
  input: {
    text: string;
    n_values?: number[];  // Default [3, 4, 5, 6]
    baseline_corpus?: string;  // Path to baseline
  };

  output: {
    ngram_metrics: {
      [n: string]: {
        total_count: number;
        unique_count: number;
        type_token_ratio: number;
        hapax_ratio: number;
        repetition_rate: number;
        top_ngrams: Array<[string, number]>;
      };
    };

    // AI-specific phrase detection
    ai_phrases_found: Array<{
      phrase: string;
      category: 'opening' | 'transition' | 'closing' | 'filler';
    }>;
    ai_phrase_count: number;

    // Divergence from baseline (if provided)
    baseline_divergence?: number;
  };
}
```

### AI Phrase Patterns

```typescript
const AI_PHRASES = {
  opening: [
    "in today's digital age",
    "in the realm of",
    "when it comes to",
    "let's dive into"
  ],
  transition: [
    "it's worth noting that",
    "in light of this",
    "furthermore",
    "additionally"
  ],
  closing: [
    "in conclusion",
    "to sum up",
    "ultimately",
    "all in all"
  ]
};
```

### Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| 6-gram TTR | < 0.95 | > 0.98 |
| AI phrase count | > 3 | 0-1 |

### Weight in Ensemble: **0.12**

---

## Tool 6: Syntactic Complexity Analyzer

### Interface

```typescript
interface SyntacticComplexity {
  input: {
    text: string;
  };

  output: {
    // Sentence metrics
    avg_sentence_length: number;
    sentence_length_std: number;
    sentence_length_range: number;

    // Depth metrics
    avg_dependency_depth: number;
    max_dependency_depth: number;
    depth_variance: number;

    // Sentence type distribution
    sentence_types: {
      simple: number;
      compound: number;
      complex: number;
      compound_complex: number;
    };
    sentence_type_ratios: { [type: string]: number };

    // Structural metrics
    avg_branching_factor: number;
    clauses_per_sentence: number;

    // AI signals
    missing_compound_complex: boolean;
    high_uniformity: boolean;
    shallow_structure: boolean;
  };
}
```

### Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| Sentence length std | < 5 | > 10 |
| Depth variance | < 1.0 | > 2.0 |
| Compound-complex ratio | < 0.05 | > 0.10 |

### Weight in Ensemble: **0.10**

---

## Tool 7: Unicode & Punctuation Scanner

### Interface

```typescript
interface UnicodeScanner {
  input: {
    text: string;
  };

  output: {
    // Invisible characters
    invisible_chars: Array<{
      char: string;
      unicode: string;
      count: number;
      positions: number[];
    }>;

    // Quote analysis
    smart_quotes: number;
    straight_quotes: number;
    quote_style: 'smart' | 'straight' | 'mixed';

    // Dash analysis
    em_dashes: number;
    en_dashes: number;
    hyphens: number;
    dash_density: number;  // Per 1000 chars

    // Other punctuation
    unicode_ellipsis: number;
    ascii_ellipsis: number;

    // AI signals
    ai_punctuation_signals: string[];
  };
}
```

### AI Signals

- High em dash density (>5 per 1000 chars) - GPT-4 signature
- Smart quotes (encoding fingerprint)
- Unicode ellipsis (…) vs ASCII (...)
- Zero-width characters

### Weight in Ensemble: **0.06**

---

## Tool 8: Content Quality Analyzer

### Interface

```typescript
interface ContentAnalyzer {
  input: {
    text: string;
  };

  output: {
    // Specificity
    specificity_score: number;  // 0-1
    named_entities: number;
    numeric_data: number;
    quotes: number;

    // Hedging
    hedge_count: number;
    hedge_density: number;
    hedge_words: string[];

    // Formulaic content
    formula_openings: number;
    formula_closings: number;
    formula_transitions: number;

    // Opinion/personality
    first_person: number;
    opinion_markers: number;
    emotional_language: number;
  };
}
```

### Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| Specificity | < 0.3 | > 0.6 |
| Hedge density | > 5% | < 2% |
| Formula count | > 3 | 0 |

### Weight in Ensemble: **0.10**

---

## Ensemble Aggregator

### Weighting Scheme

| Tool | Weight | Justification |
|------|--------|---------------|
| DetectGPT | 0.20 | Highest AUROC (~95%) |
| Perplexity | 0.15 | Strong signal, well-validated |
| Vocabulary | 0.15 | Clear markers, high precision |
| Burstiness | 0.12 | Good discrimination |
| N-gram | 0.12 | High AUROC for 6-grams |
| Syntactic | 0.10 | Moderate reliability |
| Content | 0.10 | Supporting signal |
| Unicode | 0.06 | Low weight but useful |
| **Total** | **1.00** | |

### Aggregation Algorithm

```typescript
interface AggregatedResult {
  input: {
    tool_results: { [tool: string]: ToolOutput };
    weights: { [tool: string]: number };
  };

  output: {
    // Scores
    raw_score: number;          // Weighted average
    calibrated_score: number;   // 0-100 probability
    classification: 'ai' | 'human' | 'uncertain';
    confidence: 'high' | 'medium' | 'low';

    // Evidence
    ai_signals: string[];
    human_signals: string[];
    strongest_signal: string;
    weakest_signal: string;

    // Breakdown
    tool_contributions: { [tool: string]: number };

    // Explanation
    explanation: string;
  };
}
```

### Scoring Formula

```python
def aggregate_scores(tool_results, weights):
    weighted_sum = 0
    total_weight = 0

    for tool, result in tool_results.items():
        if result.classification == 'likely_ai':
            score = 0.8 if result.confidence == 'high' else 0.6
        elif result.classification == 'likely_human':
            score = 0.2 if result.confidence == 'high' else 0.4
        else:
            score = 0.5

        weight = weights.get(tool, 0.1)
        weighted_sum += score * weight
        total_weight += weight

    raw_score = weighted_sum / total_weight if total_weight > 0 else 0.5

    # Classification
    if raw_score > 0.7:
        classification = 'ai'
        confidence = 'high' if raw_score > 0.85 else 'medium'
    elif raw_score < 0.3:
        classification = 'human'
        confidence = 'high' if raw_score < 0.15 else 'medium'
    else:
        classification = 'uncertain'
        confidence = 'low'

    return {
        'raw_score': raw_score,
        'calibrated_score': raw_score * 100,
        'classification': classification,
        'confidence': confidence
    }
```

### Confidence Intervals

| Score Range | Classification | Confidence |
|-------------|---------------|------------|
| 85-100 | AI | High |
| 70-85 | AI | Medium |
| 55-70 | Uncertain | Low |
| 45-55 | Uncertain | Low |
| 30-45 | Human | Medium |
| 15-30 | Human | Medium |
| 0-15 | Human | High |

---

## Implementation Notes

### Performance Optimization

1. **Parallel execution**: Run independent tools concurrently
2. **Caching**: Cache model loads (perplexity, DetectGPT)
3. **Early termination**: If high-weight tools strongly agree, skip others
4. **Batching**: Process multiple texts together for model efficiency

### Dependencies

```
transformers>=4.20.0
torch>=1.12.0
spacy>=3.4.0
nltk>=3.7.0
scipy>=1.9.0
numpy>=1.23.0
```

### Minimum Text Requirements

| Tool | Min Tokens | Min Sentences |
|------|-----------|---------------|
| Perplexity | 50 | 1 |
| Burstiness | 20 | 3 |
| DetectGPT | 100 | 1 |
| Vocabulary | 100 | 1 |
| N-gram | 50 | 1 |
| Syntactic | 30 | 3 |
| Unicode | 10 | 0 |
| Content | 50 | 2 |

---

## Sources

- [GPTZero Technical Overview](https://gptzero.me/news/how-ai-detectors-work/)
- [Fast-DetectGPT](https://arxiv.org/html/2310.05130v3)
- [NELA Feature Extraction](https://arxiv.org/html/2503.22338)
- [Stylometric Fingerprinting](https://arxiv.org/html/2503.01659v1)
