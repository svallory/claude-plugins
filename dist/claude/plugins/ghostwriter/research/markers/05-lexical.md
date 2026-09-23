# Lexical and Syntactic Tells

## Overview

Statistical analysis of text provides some of the most quantifiable detection methods. Perplexity, burstiness, and n-gram analysis can achieve high accuracy when properly calibrated.

---

## Perplexity

### Definition

Perplexity quantifies how "surprising" text appears to a language model. It measures how well a probability model predicts a sample.

### Key Insight

- AI-generated text: **Low perplexity** (highly predictable token sequences)
- Human text: **Higher and more variable perplexity** (unexpected word choices, creative flourishes)

### Perplexity Thresholds

| Perplexity Score | Interpretation           |
| ---------------- | ------------------------ |
| PPL < 20         | More likely AI-generated |
| PPL > 20         | More likely human        |

*Source: A study by New York University measured perplexity across large corpora of AI-generated and human texts, identifying PPL = 20 as a decision boundary. [GPTZero](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/) pioneered using perplexity and burstiness for AI detection. Their system achieved 95.7% detection rate with only 1% false positives on the RAID benchmark.*

### Calculation

```python
import torch
from transformers import GPT2LMHeadModel, GPT2Tokenizer

def calculate_perplexity(text: str, model_name: str = 'gpt2') -> float:
    tokenizer = GPT2Tokenizer.from_pretrained(model_name)
    model = GPT2LMHeadModel.from_pretrained(model_name)

    encodings = tokenizer(text, return_tensors='pt')
    max_length = model.config.n_positions

    nlls = []
    for i in range(0, encodings.input_ids.size(1), max_length):
        begin_loc = i
        end_loc = min(i + max_length, encodings.input_ids.size(1))

        input_ids = encodings.input_ids[:, begin_loc:end_loc]
        target_ids = input_ids.clone()

        with torch.no_grad():
            outputs = model(input_ids, labels=target_ids)
            neg_log_likelihood = outputs.loss

        nlls.append(neg_log_likelihood)

    return torch.exp(torch.stack(nlls).mean()).item()
```

### Limitations

- Famous texts (Declaration of Independence) classify as AI - over-represented in training data
- ESL writers produce lower perplexity due to limited vocabulary
- Domain-specific jargon can skew results
- Requires reference model selection (GPT-2 commonly used)

### Reliability: **Moderate-High**

Best used in combination with other metrics.

---

## Burstiness

### Definition

Burstiness measures variation in perplexity/complexity across a document - how much writing patterns fluctuate.

### Calculation

Standard deviation of perplexity scores across sentences.

```python
import numpy as np

def calculate_burstiness(text: str) -> dict:
    sentences = split_into_sentences(text)

    # Calculate per-sentence perplexity
    perplexities = [calculate_perplexity(s) for s in sentences]

    # Calculate burstiness metrics
    mean_ppl = np.mean(perplexities)
    std_ppl = np.std(perplexities)

    # Sentence length variation
    lengths = [len(s.split()) for s in sentences]
    length_std = np.std(lengths)

    # Fano factor (variance/mean)
    fano = np.var(lengths) / np.mean(lengths) if np.mean(lengths) > 0 else 0

    return {
        'burstiness': std_ppl,
        'mean_perplexity': mean_ppl,
        'length_variance': length_std,
        'fano_factor': fano,
    }
```

### Comparison Table

| Characteristic       | Human Writing             | AI Writing                 |
| -------------------- | ------------------------- | -------------------------- |
| Sentence variation   | High (mix of short/long)  | Low (uniform length)       |
| Perplexity variation | Spikes of high/low        | Consistent low             |
| Rhythm               | Natural ebb and flow      | Monotonous/predictable     |
| Paragraph length     | Varied, follows narrative | Balanced, nearly identical |

### Key Insight

**Low burstiness + low perplexity = high probability of AI authorship**

### Reliability: **Moderate-High**

---

## N-gram Analysis

### Definition

Analysis of contiguous sequences of n items (words or characters).

### Detection Power by N-gram Length

Higher-order n-grams reveal more discriminative patterns. AI text shows more predictable n-gram sequences.

*Note: Specific AUROC values by n-gram size previously listed could not be verified from downloaded sources. [Pangram Labs](https://www.pangram.com/blog/pangram-ai-phrases) documents their N-gram analysis methodology, showing that certain phrases appear hundreds or thousands of times more frequently in AI text than human text.*

### Implementation

```python
from collections import Counter
import nltk

def ngram_analysis(text: str, n_values: list = [2, 3, 4, 5, 6]) -> dict:
    words = nltk.word_tokenize(text.lower())

    results = {}
    for n in n_values:
        ngrams = list(nltk.ngrams(words, n))
        freq_dist = Counter(ngrams)

        # Calculate metrics
        total = len(ngrams)
        unique = len(freq_dist)

        # Type-token ratio (higher = more diverse)
        ttr = unique / total if total > 0 else 0

        # Top n-grams
        top_ngrams = freq_dist.most_common(10)

        results[f'n{n}'] = {
            'type_token_ratio': ttr,
            'total': total,
            'unique': unique,
            'top_ngrams': top_ngrams,
        }

    return results
```

### DNA-GPT Method

Divergent N-Gram Analysis for training-free detection:

1. Generate perturbations of candidate text
2. Compare n-gram distributions between original and perturbed
3. AI text shows less divergence (more predictable)

### Reliability: **High** (especially for n≥5)

---

## DetectGPT (Probability Curvature)

### Core Hypothesis

Text sampled from an LLM tends to occupy **negative curvature regions** of the model's log probability function. Human text may have positive or neutral curvature.

### Methodology

1. Generate perturbations of candidate text using a mask-filling model (T5)
2. Compare log probability of original passage vs. perturbed passages
3. If perturbations consistently have lower log probability than original → likely AI-generated

### Performance

- **DetectGPT AUROC**: Improved fake news detection from 0.81 AUROC (baseline) to **0.95 AUROC** for GPT-NeoX 20B
- **Fast-DetectGPT speedup**: Reduces computational cost by a factor of **340x** while improving detection by ~75%

*Sources:*
- *[Mitchell et al. (2023) "DetectGPT: Zero-Shot Machine-Generated Text Detection using Probability Curvature" (arXiv:2301.11305)](https://arxiv.org/abs/2301.11305) - Published at ICML 2023*
- *[Bao et al. (2024) "Fast-DetectGPT" (arXiv:2310.05130)](https://arxiv.org/abs/2310.05130) - Published at ICLR 2024*

### Implementation Concept

```python
def detect_gpt(text: str, model, perturbation_model, num_perturbations: int = 100) -> float:
    # Get log probability of original text
    original_log_prob = get_log_probability(text, model)

    # Generate perturbations
    perturbations = []
    for _ in range(num_perturbations):
        perturbed = perturb_text(text, perturbation_model)
        perturbations.append(perturbed)

    # Get log probabilities of perturbations
    perturbed_log_probs = [get_log_probability(p, model) for p in perturbations]

    # Calculate curvature estimate
    mean_perturbed = np.mean(perturbed_log_probs)

    # Positive value = likely AI (original higher than perturbations)
    # Negative value = likely human
    return original_log_prob - mean_perturbed
```

### Reliability: **High**

Requires significant compute but very accurate.

---

## Zipf's Law Compliance

### Finding: NOT DIAGNOSTIC

LLM-generated text follows Zipf's law with correlation coefficients around -0.96, nearly identical to human text at -0.91 to -0.97.

Research confirms Zipf-like patterns arise from combinatorics of symbols, not deep linguistic structure.

**Not useful as a standalone detection marker.**

---

## Sentence Complexity Patterns

### Metrics Comparison

| Metric                    | Human Writing         | AI Writing                |
| ------------------------- | --------------------- | ------------------------- |
| Average sentence length   | Longer with variation | More uniform              |
| Simple sentences          | 35-50% with variation | 41%+ with high uniformity |
| Compound-complex          | Present throughout    | 60% have none             |
| Length standard deviation | High                  | Low                       |

### AI Syntactic Preferences

- Heavy use of correlative conjunctions ("not only...but also")
- Emphatic contrast phrases ("not just...but")
- Participial phrases (elevated in AI text)

*Note: Specific frequency multipliers for participial clause usage could not be verified from downloaded sources.*

### Detection

```python
import spacy

nlp = spacy.load('en_core_web_sm')

def sentence_complexity_analysis(text: str) -> dict:
    doc = nlp(text)

    sentences = list(doc.sents)
    lengths = [len(sent) for sent in sentences]

    # Classify sentence types
    simple = 0
    compound = 0
    complex_sent = 0
    compound_complex = 0

    for sent in sentences:
        clauses = count_clauses(sent)
        if clauses == 1:
            simple += 1
        elif has_coordination(sent) and clauses == 2:
            compound += 1
        elif has_subordination(sent):
            if has_coordination(sent):
                compound_complex += 1
            else:
                complex_sent += 1

    total = len(sentences)

    return {
        'avg_length': np.mean(lengths),
        'length_std': np.std(lengths),
        'simple_ratio': simple / total,
        'compound_ratio': compound / total,
        'complex_ratio': complex_sent / total,
        'compound_complex_ratio': compound_complex / total,
        'uniformity_score': 1 - (np.std(lengths) / np.mean(lengths)),  # higher = more AI-like
    }
```

### Reliability: **Moderate-High**

---

## Summary Table

| Method              | Detection Performance | Compute Cost | Reliability   |
| ------------------- | --------------------- | ------------ | ------------- |
| Perplexity          | PPL threshold ~20     | Low-Medium   | Moderate-High |
| Burstiness          | CV threshold varies   | Low-Medium   | Moderate-High |
| N-gram analysis     | High (DNA-GPT SOTA)   | Low          | High          |
| DetectGPT           | 0.95 AUROC            | High         | High          |
| Fast-DetectGPT      | 340x faster, ~75% better | Medium    | High          |
| Zipf's Law          | ~0.50 AUROC           | Low          | Not useful    |
| Sentence complexity | Varies                | Low          | Moderate-High |
| NELA features (87)  | 0.99 F1               | Low          | Very High     |

*Sources: DetectGPT ([Mitchell et al. 2023](https://arxiv.org/abs/2301.11305)), Fast-DetectGPT ([Bao et al. 2024](https://arxiv.org/abs/2310.05130)), DNA-GPT ([Yang et al. 2023](https://arxiv.org/abs/2305.17359)), NELA features ([arXiv:2503.22338](https://arxiv.org/abs/2503.22338))*

---

## Research Gaps

1. **Reference model selection**: Which model for perplexity calculation?
2. **Burstiness formula**: Exact calculation needs verification
3. **N-gram baseline corpus**: What's the comparison dataset?
4. **Feature combination**: How to weight and combine metrics?

---

## Writer Agent Guidance

To avoid lexical tells:

1. Intentionally vary sentence length (some very short, some very long)
2. Include unexpected word choices occasionally
3. Use sentence structures that vary in complexity
4. Break predictable patterns with digressions
5. Include some simple/casual sentences among complex ones
6. Avoid repetitive syntactic patterns
7. Use varied transitions (or no transitions)
