# Vocabulary Metrics for AI Detection

## Type-Token Ratio (TTR)

### Formula

```
TTR = Types (unique words) / Tokens (total words)
```

| TTR Value | Interpretation |
|-----------|----------------|
| Close to 1 | No repetition, high diversity |
| Close to 0 | Infinite repetition, low diversity |

### Limitations

TTR decreases with text length (longer texts require word reuse).

### Variants

| Metric | Formula | Notes |
|--------|---------|-------|
| TTR | Types / Tokens | Length-dependent |
| RTTR (Root TTR) | Types / sqrt(Tokens) | Partially corrected |
| CTTR (Corrected TTR) | Types / sqrt(2 * Tokens) | Partially corrected |
| Log TTR | log(Types) / log(Tokens) | Better for long texts |

## MTLD (Measure of Textual Lexical Diversity)

### Definition

MTLD reflects the average number of consecutive words for which a certain TTR threshold is maintained.

### Algorithm

```
1. Start with first word, TTR = 1.0
2. Add words sequentially, recalculating TTR after each
3. When TTR drops below threshold (default 0.72), increment factor count, reset
4. Continue until end of text
5. MTLD = total_tokens / factor_count
6. Run forward and backward, average the two scores
```

### Threshold

McCarthy and Jarvis (2010) recommend factor threshold in range [0.660, 0.750], with 0.72 commonly used.

### Implementation

```python
def calculate_mtld(text: str, threshold: float = 0.72) -> float:
    """
    Calculate MTLD (Measure of Textual Lexical Diversity).

    Higher MTLD = higher lexical diversity.
    """
    tokens = text.lower().split()

    if len(tokens) < 10:
        return 0.0

    def mtld_one_direction(word_list):
        factor_count = 0
        factor_lengths = []
        types = set()
        factor_start = 0

        for i, word in enumerate(word_list):
            types.add(word)
            ttr = len(types) / (i - factor_start + 1)

            if ttr <= threshold:
                factor_count += 1
                factor_lengths.append(i - factor_start + 1)
                types = set()
                factor_start = i + 1

        # Handle remaining partial factor
        if len(types) > 0:
            remaining_ttr = len(types) / (len(word_list) - factor_start)
            # Partial factor contribution
            partial = (1 - remaining_ttr) / (1 - threshold) if threshold < 1 else 0
            factor_count += partial

        return len(word_list) / factor_count if factor_count > 0 else len(word_list)

    # Run forward and backward
    forward = mtld_one_direction(tokens)
    backward = mtld_one_direction(tokens[::-1])

    return (forward + backward) / 2
```

### Interpretation

| MTLD Score | Interpretation |
|------------|----------------|
| < 50 | Low diversity (potential AI signal) |
| 50-100 | Moderate diversity |
| > 100 | High diversity (human-like) |

## MATTR (Moving-Average TTR)

### Algorithm

```
1. Choose window size (e.g., 10 words)
2. Calculate TTR for words 1-10
3. Calculate TTR for words 2-11
4. Continue sliding to end
5. Average all TTR values
```

### Implementation

```python
def calculate_mattr(text: str, window_size: int = 50) -> float:
    """
    Calculate Moving-Average Type-Token Ratio.

    Less sensitive to text length than standard TTR.
    """
    tokens = text.lower().split()

    if len(tokens) < window_size:
        return len(set(tokens)) / len(tokens) if tokens else 0

    ttrs = []
    for i in range(len(tokens) - window_size + 1):
        window = tokens[i:i + window_size]
        ttr = len(set(window)) / window_size
        ttrs.append(ttr)

    return sum(ttrs) / len(ttrs)
```

## Hapax Legomena Ratio

### Definition

Words appearing exactly once in a text. Higher ratio indicates richer vocabulary.

### Formula

```
Hapax Ratio = Hapax Legomena / Total Unique Words
```

### Research Findings

- **AI text**: Smaller vocabulary, lower hapax ratio
- **Human text**: More unique word usage
- Using hapax ratio with top-4 word frequencies enables confident AI classification

### Implementation

```python
from collections import Counter

def hapax_analysis(text: str) -> dict:
    """
    Analyze hapax legomena and word frequency distribution.
    """
    tokens = text.lower().split()
    freq = Counter(tokens)

    hapax = [w for w, c in freq.items() if c == 1]
    dis_legomena = [w for w, c in freq.items() if c == 2]  # Words appearing twice

    total_types = len(freq)
    total_tokens = len(tokens)

    return {
        'total_tokens': total_tokens,
        'total_types': total_types,
        'hapax_count': len(hapax),
        'hapax_ratio': len(hapax) / total_types if total_types > 0 else 0,
        'dis_legomena_count': len(dis_legomena),
        'ttr': total_types / total_tokens if total_tokens > 0 else 0,
        'top_4_frequencies': freq.most_common(4)
    }
```

## Zipf's Law Analysis

### Background

Zipf's law: word frequency is inversely proportional to rank.

**Key finding**: Both human and AI text follow Zipf's law with similar correlation (~0.96), so Zipf compliance alone is NOT diagnostic.

### Useful Features

While Zipf compliance isn't diagnostic, **deviations** from expected Zipf distribution can be:

1. **Vocabulary size relative to text length**: AI uses smaller vocabulary
2. **Rare word ratio**: AI uses fewer rare words
3. **Top-4 word frequency ratios**: Pattern differs between human/AI

### Implementation

```python
import numpy as np
from scipy import stats

def zipf_analysis(text: str) -> dict:
    """
    Analyze Zipf's law compliance and deviations.
    """
    tokens = text.lower().split()
    freq = Counter(tokens)

    # Sort by frequency
    sorted_freq = sorted(freq.values(), reverse=True)
    ranks = np.arange(1, len(sorted_freq) + 1)

    # Log-log regression
    log_ranks = np.log(ranks)
    log_freqs = np.log(sorted_freq)

    slope, intercept, r_value, _, _ = stats.linregress(log_ranks, log_freqs)

    return {
        'zipf_exponent': abs(slope),  # Should be ~1 for natural language
        'r_squared': r_value ** 2,    # Fit quality
        'vocabulary_size': len(freq),
        'tokens': len(tokens),
        'vocab_token_ratio': len(freq) / len(tokens)
    }
```

## AI Detection Vocabulary Features

### AI Vocabulary Markers

Words and phrases that appear significantly more often in AI-generated text than human text:

| Category | Examples |
|----------|----------|
| Verbs | delve, showcase, underscore, explore, harness, navigate, foster, leverage |
| Adjectives | comprehensive, crucial, meticulous, robust, pivotal, vibrant, seamless |
| Transitions | furthermore, notably, consequently, additionally, moreover |
| Phrases | "it's worth noting", "in light of", "when it comes to", "a testament to" |
| Nouns | tapestry, landscape, realm, journey, endeavor |

*Source: [Pangram Labs - Comprehensive Guide to Spotting AI Writing Patterns](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns) provides an extensive vocabulary list.*

### Extreme Phrase Frequency Multipliers

Pangram Labs N-gram analysis identifies phrases with extreme frequency elevation in AI text compared to human baselines:

| Phrase | Times More Common in AI |
|--------|------------------------|
| "As an AI language model" | 294,000x |
| "I do not have personal" | 67,000x |
| "Unfortunately, I do not have enough" | 54,000x |
| "language model, I can not" | 53,000x |
| "as a poignant" | 49,000x |
| "As a powerful reminder" | 43,000x |
| "reminder of the enduring" | 31,000x |
| "faced numerous challenges" | 30,000x |
| "Our results provide new insights into" | 22,000x |
| "into the complex interplay" | 21,000x |
| "vibrant tapestry" | 17,000x |
| "In the ever-evolving" | 11,000x |
| "serves as a powerful" | 10,000x |
| "intricate nature" | 6,000x |
| "providing valuable insights into" | 5,000x |
| "serves as a testament" | 4,000x |
| "newfound sense of purpose" | 4,000x |
| "It is important to note that" | 3,000x |
| "even in the face of unimaginable" | 3,000x |
| "reminder of the potential" | 3,000x |

*Source: [Pangram Labs - Walking Through AI's Most Overused Phrases](https://www.pangram.com/blog/walking-through-ai-phrases) (February 2025). Multipliers represent relative frequency vs human baseline in Pangram's internal dataset of tens of millions of documents.*

**Key insight**: These extreme elevations make phrase-level detection highly effective. The first category (AI artifacts like "As an AI language model") are self-referential phrases from refusals, while the rest are stylistic preferences that emerge from mode collapse and RLHF training.

### Excess Vocabulary Research (arXiv Study)

Post-ChatGPT excess words in academic writing from analysis of 14 million PubMed abstracts (2010–2024):

| Word | Frequency Ratio (r) |
|------|---------------------|
| delves | 25.2x |
| showcasing | 9.2x |
| underscores | 9.1x |

| Word | Frequency Gap (δ) |
|------|-------------------|
| potential | +0.041 |
| findings | +0.027 |
| crucial | +0.026 |

*Source: [Kobak et al. (2024) "Delving into ChatGPT usage in academic writing through excess vocabulary" (arXiv:2406.07016)](https://arxiv.org/abs/2406.07016). The study identified 280 excess style words in 2024 and estimated at least 13.5% of 2024 abstracts were processed with LLMs, reaching 40% for some subcorpora.*

### Implementation

```python
# Verified frequency multipliers from Kobak et al. (2024) arXiv:2406.07016
# Values represent frequency ratio vs pre-ChatGPT baseline in PubMed abstracts
AI_VOCAB_MULTIPLIERS = {
    'delve': 25.2, 'delves': 25.2, 'delved': 25.2, 'delving': 25.2,
    'showcasing': 9.2, 'showcase': 9.0, 'showcases': 9.0,
    'underscore': 9.1, 'underscores': 9.1, 'underscored': 9.1,
    # Additional markers (relative weights, less precisely quantified)
    'comprehensive': 5.0, 'crucial': 5.0, 'meticulous': 5.0,
    'robust': 4.0, 'pivotal': 4.0, 'realm': 4.0,
    'harness': 3.0, 'leverage': 3.0, 'utilize': 3.0,
    'notably': 3.0, 'furthermore': 3.0, 'consequently': 3.0,
    'tapestry': 10.0, 'bustling': 6.0, 'vibrant': 4.0,
}

def ai_vocabulary_score(text: str) -> dict:
    """
    Score text based on AI vocabulary markers.
    """
    tokens = text.lower().split()
    token_count = len(tokens)

    flagged = []
    total_multiplier = 0

    for token in set(tokens):
        if token in AI_VOCAB_MULTIPLIERS:
            count = tokens.count(token)
            multiplier = AI_VOCAB_MULTIPLIERS[token]
            flagged.append({
                'word': token,
                'count': count,
                'multiplier': multiplier,
                'contribution': count * multiplier
            })
            total_multiplier += count * multiplier

    # Density (weighted score per 1000 words)
    density = (total_multiplier / token_count * 1000) if token_count > 0 else 0

    return {
        'flagged_words': flagged,
        'total_score': total_multiplier,
        'density_per_1000': round(density, 2),
        'word_count': token_count
    }
```

## Combined Vocabulary Assessment

```python
def comprehensive_vocabulary_analysis(text: str) -> dict:
    """
    Full vocabulary analysis combining all metrics.
    """
    return {
        'ttr_metrics': {
            'standard_ttr': calculate_ttr(text),
            'mtld': calculate_mtld(text),
            'mattr': calculate_mattr(text)
        },
        'hapax_analysis': hapax_analysis(text),
        'zipf_analysis': zipf_analysis(text),
        'ai_vocabulary': ai_vocabulary_score(text)
    }
```

## Interpretation Thresholds

| Metric | Human-like | AI-like |
|--------|-----------|---------|
| MTLD | > 80 | < 50 |
| MATTR | > 0.7 | < 0.6 |
| Hapax Ratio | > 0.5 | < 0.4 |
| AI Vocab Density | < 5 | > 15 |

## Libraries

| Library | Install | Features |
|---------|---------|----------|
| [lexicalrichness](https://pypi.org/project/lexicalrichness/) | `pip install lexicalrichness` | TTR, MTLD, MATTR, CTTR |
| [TRUNAJOD](https://trunajod20.readthedocs.io/) | `pip install TRUNAJOD` | Spanish+English metrics |
| [quanteda](https://quanteda.io/) | R package | Full lexical diversity |

## Sources

- [Type-Token Ratio - Sketch Engine](https://www.sketchengine.eu/glossary/type-token-ratio-ttr/)
- [MTLD Paper - McCarthy & Jarvis 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC4490052/)
- [Excess Vocabulary in ChatGPT (arXiv)](https://arxiv.org/html/2406.07016v1)
- [lexicalrichness PyPI](https://pypi.org/project/lexicalrichness/)
