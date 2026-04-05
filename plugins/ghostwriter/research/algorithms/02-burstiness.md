# Burstiness Calculation Implementation

## Definition

Burstiness measures **variation** in perplexity and sentence structure across a document. It captures the "rhythm" of writing - humans naturally alternate between simple and complex sentences, while AI tends toward uniformity.

## Core Formulas

### 1. GPTZero Burstiness Formula

```
B = (sigma / mu) * 100
```

Where:
- `sigma` = standard deviation of sentence lengths (or perplexities)
- `mu` = mean sentence length (or perplexity)

This is the **Coefficient of Variation (CV)** scaled by 100.

### 2. Fano Factor

```
F = variance / mean = sigma^2 / mu
```

The Fano Factor measures dispersion relative to mean. For text analysis:

| Fano Factor | Interpretation |
|-------------|----------------|
| F < 1 | Underdispersion (very uniform, AI-like) |
| F = 1 | Poisson-like variation |
| F > 1 | Overdispersion (bursty, human-like) |

### 3. Perplexity Burstiness

```
Burstiness_ppl = std_dev(sentence_perplexities)
```

Human text shows **spikes** in per-sentence perplexity; AI text maintains consistent low perplexity.

## Complete Implementation

```python
import numpy as np
import nltk
from typing import List, Dict
from statistics import mean, stdev, variance

nltk.download('punkt', quiet=True)

def calculate_burstiness(text: str, perplexity_scores: List[float] = None) -> Dict:
    """
    Calculate comprehensive burstiness metrics.

    Args:
        text: Input text
        perplexity_scores: Optional pre-calculated per-sentence perplexities

    Returns:
        Dictionary of burstiness metrics
    """
    # Sentence tokenization
    sentences = nltk.sent_tokenize(text)

    if len(sentences) < 2:
        return {'error': 'Insufficient sentences for burstiness calculation'}

    # Sentence length metrics
    lengths = [len(s.split()) for s in sentences]

    length_mean = mean(lengths)
    length_std = stdev(lengths) if len(lengths) > 1 else 0
    length_variance = variance(lengths) if len(lengths) > 1 else 0

    # Coefficient of Variation (GPTZero-style)
    cv = (length_std / length_mean * 100) if length_mean > 0 else 0

    # Fano Factor
    fano = (length_variance / length_mean) if length_mean > 0 else 0

    # Perplexity-based burstiness (if provided)
    ppl_burstiness = None
    ppl_cv = None
    if perplexity_scores and len(perplexity_scores) > 1:
        ppl_mean = mean(perplexity_scores)
        ppl_std = stdev(perplexity_scores)
        ppl_burstiness = ppl_std
        ppl_cv = (ppl_std / ppl_mean * 100) if ppl_mean > 0 else 0

    return {
        # Sentence length metrics
        'sentence_count': len(sentences),
        'length_mean': round(length_mean, 2),
        'length_std': round(length_std, 2),
        'length_variance': round(length_variance, 2),
        'length_min': min(lengths),
        'length_max': max(lengths),
        'length_range': max(lengths) - min(lengths),

        # Burstiness metrics
        'coefficient_of_variation': round(cv, 2),
        'fano_factor': round(fano, 2),

        # Perplexity burstiness (if available)
        'perplexity_burstiness': round(ppl_burstiness, 2) if ppl_burstiness else None,
        'perplexity_cv': round(ppl_cv, 2) if ppl_cv else None,

        # Classification hints
        'uniformity_score': round(1 - (length_std / length_mean), 2) if length_mean > 0 else 1,
    }
```

## Interpretation Thresholds

### Coefficient of Variation

| CV Score | Interpretation |
|----------|----------------|
| CV < 30 | Low burstiness (AI-like uniformity) |
| CV 30-60 | Moderate variation |
| CV > 60 | High burstiness (human-like variation) |

### Fano Factor

| Fano Factor | Interpretation |
|-------------|----------------|
| F < 0.8 | Very uniform (strong AI signal) |
| F 0.8-1.5 | Normal variation |
| F > 1.5 | High variation (human signal) |

### Sentence Length Patterns

| Pattern | Human | AI |
|---------|-------|-----|
| Typical range | 5-40 words | 12-18 words |
| Short sentences | Frequent (emphasis) | Rare |
| Very long sentences | Occasional | Rare |
| Consecutive similar lengths | Rare | Common |

## AI Red Flags

1. **Uniform 12-18 word sentences**: Classic AI pattern
2. **Low variance**: Sentences cluster around a single length
3. **Consistent rhythm**: No natural ebb and flow
4. **Flat perplexity profile**: No spikes or dips

## Combined Detection

```python
def classify_burstiness(metrics: Dict) -> Dict:
    """
    Classify text based on burstiness metrics.
    """
    score = 0
    signals = []

    # Check CV
    if metrics['coefficient_of_variation'] < 30:
        score -= 2
        signals.append('Low CV (uniform sentence lengths)')
    elif metrics['coefficient_of_variation'] > 60:
        score += 2
        signals.append('High CV (varied sentence lengths)')

    # Check Fano Factor
    if metrics['fano_factor'] < 0.8:
        score -= 2
        signals.append('Low Fano factor (underdispersed)')
    elif metrics['fano_factor'] > 1.5:
        score += 2
        signals.append('High Fano factor (bursty)')

    # Check length range
    if metrics['length_range'] < 10:
        score -= 1
        signals.append('Narrow length range')
    elif metrics['length_range'] > 30:
        score += 1
        signals.append('Wide length range')

    # Perplexity burstiness (if available)
    if metrics.get('perplexity_cv'):
        if metrics['perplexity_cv'] < 20:
            score -= 2
            signals.append('Flat perplexity profile')
        elif metrics['perplexity_cv'] > 50:
            score += 2
            signals.append('Variable perplexity profile')

    # Classification
    if score <= -3:
        classification = 'Likely AI'
        confidence = 'High'
    elif score <= -1:
        classification = 'Possibly AI'
        confidence = 'Medium'
    elif score >= 3:
        classification = 'Likely Human'
        confidence = 'High'
    elif score >= 1:
        classification = 'Possibly Human'
        confidence = 'Medium'
    else:
        classification = 'Uncertain'
        confidence = 'Low'

    return {
        'classification': classification,
        'confidence': confidence,
        'score': score,
        'signals': signals
    }
```

## Example Analysis

### Human Text
```
Text: "I went to the store. The rain was relentless, pounding against my
       umbrella with a ferocity I hadn't experienced in years. Forgot milk."

Sentence lengths: [5, 16, 2]
Mean: 7.67
Std: 7.37
CV: 96.1
Fano: 7.09
Classification: High burstiness (human-like)
```

### AI Text
```
Text: "The store was conveniently located nearby. I purchased the necessary
       groceries from the establishment. The weather conditions were unfavorable."

Sentence lengths: [5, 7, 5]
Mean: 5.67
Std: 1.15
CV: 20.3
Fano: 0.24
Classification: Low burstiness (AI-like)
```

## Key Insight

**The combination of low perplexity AND low burstiness is the strongest AI signal.**

Human text shows:
- Variable perplexity (creative spikes)
- Variable sentence structure (rhythm)
- Natural ebb and flow

AI text shows:
- Consistent low perplexity
- Uniform sentence lengths
- Monotonous rhythm

## Sources

- [GPTZero: Perplexity and Burstiness](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/)
- [How AI Detectors Calculate Burstiness](https://hastewire.com/blog/how-ai-detectors-calculate-perplexity-and-burstiness)
- [Fano Factor - Wikipedia](https://en.wikipedia.org/wiki/Fano_factor)
