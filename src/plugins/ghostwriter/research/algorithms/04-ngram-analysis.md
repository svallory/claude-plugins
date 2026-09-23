# N-gram Analysis for AI Detection

## Overview

N-gram analysis examines contiguous sequences of n tokens. Higher-order n-grams reveal discriminative patterns between human and AI text.

## Detection Power by N-gram Size

| N-gram | AUROC | Use Case |
|--------|-------|----------|
| n=1 (unigram) | 58% | Vocabulary frequency |
| n=2 (bigram) | 72% | Basic patterns |
| n=3 (trigram) | 81% | Phrase detection |
| n=4 | 89% | Idiom/formula detection |
| n=5 | 94% | Strong discrimination |
| n=6 | **97%** | Near-perfect discrimination |

**Key insight**: 6-gram analysis achieves 97% AUROC because AI produces more predictable sequences at this length.

## DNA-GPT: Divergent N-gram Analysis

### Core Method

DNA-GPT (Divergent N-Gram Analysis) is a training-free detection strategy:

1. **Truncate** the text at midpoint
2. **Regenerate** the second half using an LLM
3. **Compare** n-gram distributions between original and regenerated
4. AI text shows **less divergence** (more predictable continuation)

### Algorithm

```
Input: Text T, LLM M, truncation ratio r (default 0.5)
Output: AI probability score

1. Split T into prefix P (first r*len(T)) and suffix S (remaining)
2. Use M to generate new suffix S' given P as prompt
3. For each n in {2, 3, 4, 5, 6}:
   a. Extract n-grams from S: G_original
   b. Extract n-grams from S': G_regenerated
   c. Calculate overlap: O_n = |G_original ∩ G_regenerated| / |G_original|
4. Compute weighted divergence score
5. Higher overlap = more likely AI (text is predictable)
```

### Divergence Metrics

**Black-box (no model access)**:
- Jaccard similarity of n-gram sets
- N-gram overlap percentage

**White-box (model access)**:
- Probability divergence between original and regenerated
- KL divergence of n-gram distributions

## Implementation

### Basic N-gram Analyzer

```python
from collections import Counter
from typing import List, Dict, Tuple
import nltk

nltk.download('punkt', quiet=True)

def extract_ngrams(text: str, n: int) -> List[Tuple[str, ...]]:
    """Extract n-grams from text."""
    tokens = nltk.word_tokenize(text.lower())
    return list(nltk.ngrams(tokens, n))

def ngram_analysis(text: str, n_values: List[int] = [2, 3, 4, 5, 6]) -> Dict:
    """
    Comprehensive n-gram analysis.

    Returns metrics for each n-gram size.
    """
    results = {}

    for n in n_values:
        ngrams = extract_ngrams(text, n)
        freq_dist = Counter(ngrams)

        total = len(ngrams)
        unique = len(freq_dist)

        if total == 0:
            continue

        # Type-token ratio (vocabulary richness)
        ttr = unique / total

        # Hapax legomena ratio (words appearing once)
        hapax = sum(1 for count in freq_dist.values() if count == 1)
        hapax_ratio = hapax / unique if unique > 0 else 0

        # Repetition rate
        repetitions = total - unique
        repetition_rate = repetitions / total if total > 0 else 0

        # Most common n-grams
        top_ngrams = freq_dist.most_common(10)

        results[f'{n}-gram'] = {
            'total_count': total,
            'unique_count': unique,
            'type_token_ratio': round(ttr, 4),
            'hapax_ratio': round(hapax_ratio, 4),
            'repetition_rate': round(repetition_rate, 4),
            'top_ngrams': [(' '.join(ng), count) for ng, count in top_ngrams]
        }

    return results
```

### DNA-GPT Style Comparison

```python
def dna_gpt_analysis(
    text: str,
    regenerated_text: str,
    n_values: List[int] = [3, 4, 5, 6]
) -> Dict:
    """
    Compare original text suffix with LLM-regenerated suffix.

    Higher overlap = more likely AI-generated.
    """
    results = {}

    for n in n_values:
        original_ngrams = set(extract_ngrams(text, n))
        regen_ngrams = set(extract_ngrams(regenerated_text, n))

        if len(original_ngrams) == 0:
            continue

        # Overlap metrics
        intersection = original_ngrams & regen_ngrams
        union = original_ngrams | regen_ngrams

        overlap_ratio = len(intersection) / len(original_ngrams)
        jaccard = len(intersection) / len(union) if union else 0

        results[f'{n}-gram'] = {
            'original_unique': len(original_ngrams),
            'regenerated_unique': len(regen_ngrams),
            'overlap_count': len(intersection),
            'overlap_ratio': round(overlap_ratio, 4),
            'jaccard_similarity': round(jaccard, 4)
        }

    # Aggregate score (weighted by n)
    if results:
        weights = {3: 0.1, 4: 0.2, 5: 0.3, 6: 0.4}
        weighted_score = sum(
            weights.get(int(k.split('-')[0]), 0) * v['overlap_ratio']
            for k, v in results.items()
        )
        results['aggregate_overlap'] = round(weighted_score, 4)

    return results
```

### Baseline Corpus Comparison

```python
# Note: Requires a human text corpus for comparison
# Options:
# - COCA (Corpus of Contemporary American English): https://www.ngrams.info/
# - WikiText
# - Custom domain-specific corpus

def compare_to_baseline(text: str, baseline_ngrams: Dict[int, Counter]) -> Dict:
    """
    Compare text n-gram distribution to baseline human corpus.

    Args:
        text: Text to analyze
        baseline_ngrams: Pre-computed n-gram frequencies from human corpus

    Returns:
        Divergence scores indicating how AI-like the distribution is
    """
    results = {}

    for n, baseline_freq in baseline_ngrams.items():
        text_ngrams = extract_ngrams(text, n)
        text_freq = Counter(text_ngrams)

        # Normalize to distributions
        total_text = sum(text_freq.values())
        total_baseline = sum(baseline_freq.values())

        if total_text == 0 or total_baseline == 0:
            continue

        # Calculate vocabulary overlap with baseline
        text_vocab = set(text_freq.keys())
        baseline_vocab = set(baseline_freq.keys())

        # In-vocabulary rate
        in_vocab = len(text_vocab & baseline_vocab) / len(text_vocab) if text_vocab else 0

        # Frequency correlation (are common n-grams used at similar rates?)
        common_ngrams = text_vocab & baseline_vocab
        if common_ngrams:
            text_ranks = {ng: i for i, ng in enumerate(
                sorted(text_freq.keys(), key=lambda x: text_freq[x], reverse=True)
            )}
            baseline_ranks = {ng: i for i, ng in enumerate(
                sorted(baseline_freq.keys(), key=lambda x: baseline_freq[x], reverse=True)
            )}

            rank_diffs = [
                abs(text_ranks[ng] - baseline_ranks.get(ng, len(baseline_ranks)))
                for ng in common_ngrams
                if ng in baseline_ranks
            ]
            avg_rank_diff = sum(rank_diffs) / len(rank_diffs) if rank_diffs else 0
        else:
            avg_rank_diff = float('inf')

        results[f'{n}-gram'] = {
            'in_vocabulary_rate': round(in_vocab, 4),
            'average_rank_divergence': round(avg_rank_diff, 2)
        }

    return results
```

## Interpretation Guidelines

### Type-Token Ratio (TTR)

| TTR Range | Interpretation |
|-----------|----------------|
| < 0.3 | Very repetitive (suspicious) |
| 0.3-0.5 | Normal for long texts |
| 0.5-0.7 | Good vocabulary diversity |
| > 0.7 | High diversity (human-like) |

**Note**: TTR decreases with text length. Use MTLD for length-independent analysis.

### Repetition Patterns

| Pattern | Human | AI |
|---------|-------|-----|
| 6-gram repetition | Rare | Common |
| Phrase templates | Organic variation | Formulaic |
| Idiomatic usage | Natural, varied | Overused patterns |

### DNA-GPT Overlap Scores

| Overlap Ratio | Classification |
|---------------|----------------|
| > 0.7 | Highly predictable (strong AI signal) |
| 0.5-0.7 | Moderately predictable |
| 0.3-0.5 | Normal variation |
| < 0.3 | Low predictability (human-like) |

## AI-Specific N-gram Patterns

Common AI n-gram signatures:

### Transition Phrases
- "it's worth noting that"
- "in light of this"
- "it is important to"
- "this approach ensures"

### Opening Formulas
- "in today's digital age"
- "when it comes to"
- "in the realm of"
- "let's dive into"

### Concluding Patterns
- "in conclusion"
- "to sum up"
- "ultimately"
- "all in all"

## Limitations

1. **Length dependence**: Metrics vary with text length
2. **Domain specificity**: Technical text has different baselines
3. **Paraphrasing**: Heavy rewrites reduce n-gram overlap
4. **Mixed authorship**: Partial AI assistance harder to detect

## Sources

- [DNA-GPT Paper (arXiv)](https://arxiv.org/abs/2305.17359)
- [N-Gram Language Models (Stanford)](https://web.stanford.edu/~jurafsky/slp3/3.pdf)
- [COCA N-grams Corpus](https://www.ngrams.info/)
