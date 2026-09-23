# Syntactic Complexity Metrics

## Overview

Syntactic complexity measures analyze sentence structure, tree depth, and grammatical patterns. These metrics help distinguish human writing (varied, complex) from AI writing (uniform, predictable).

## Key Metrics

### 1. Yngve Depth

Measures depth of **left branching** from the subject in parse trees.

#### Algorithm

1. For each node in parse tree, assign score = number of right siblings
2. Word score = sum of all node scores on path from word to root
3. Sentence score = average of all word scores

#### Formula

```
Yngve_sentence = (1/n) * sum(yngve_word_i) for i in 1..n
```

Where `yngve_word_i` = sum of right sibling counts along path to root.

#### Example

```
Sentence: "The quick brown fox jumps"
Parse tree:
        S
       / \
      NP  VP
     /|\   |
   DT JJ NN VBZ

"The" (DT): path scores = [2 (NP has 1 sibling), 0 (S root)] = 2
"quick" (JJ): path scores = [1, 2, 0] = 3
...
```

### 2. Frazier Depth

Measures syntactic complexity based on path length to root, with special weighting for sentence nodes.

#### Algorithm

1. Each node on path to root gets score = 1 (or 1.5 if S node)
2. Path terminates at first non-leftmost ancestor
3. Word score = sum of path scores
4. Sentence score = max of 3-word window sums (original) or average (Frazier-Roark)

#### Formula

```
Frazier_word = sum(1.5 if S_node else 1 for node in path)
Frazier_sentence = max(sum(frazier_word_i..i+2)) for sliding windows
```

### 3. Dependency Length

Sum of distances between dependent words and their heads.

```
SDL (Syntactic Dependency Length) = sum(|position_head - position_dependent|)
```

## Implementation

### Using spaCy

```python
import spacy
from typing import Dict, List
import statistics

nlp = spacy.load('en_core_web_sm')

def calculate_dependency_depth(doc) -> List[int]:
    """Calculate maximum dependency depth for each sentence."""
    depths = []

    for sent in doc.sents:
        def get_depth(token, current_depth=0):
            if not list(token.children):
                return current_depth
            return max(get_depth(child, current_depth + 1)
                      for child in token.children)

        root = [t for t in sent if t.head == t][0]
        depths.append(get_depth(root))

    return depths

def syntactic_complexity_analysis(text: str) -> Dict:
    """
    Comprehensive syntactic complexity analysis.
    """
    doc = nlp(text)
    sentences = list(doc.sents)

    if not sentences:
        return {'error': 'No sentences found'}

    # Sentence lengths (in tokens)
    sent_lengths = [len(sent) for sent in sentences]

    # Dependency depths
    dep_depths = calculate_dependency_depth(doc)

    # Dependency relations
    dep_relations = [token.dep_ for token in doc]
    relation_freq = {}
    for rel in dep_relations:
        relation_freq[rel] = relation_freq.get(rel, 0) + 1

    # Clause count (approximation via SBAR, ccomp, advcl, etc.)
    clause_markers = ['ccomp', 'xcomp', 'advcl', 'relcl', 'acl', 'csubj']
    clause_count = sum(1 for rel in dep_relations if rel in clause_markers)

    # Branching factor (average children per non-leaf node)
    non_leaf_tokens = [t for t in doc if list(t.children)]
    branching_factors = [len(list(t.children)) for t in non_leaf_tokens]
    avg_branching = statistics.mean(branching_factors) if branching_factors else 0

    return {
        # Sentence-level metrics
        'sentence_count': len(sentences),
        'avg_sentence_length': round(statistics.mean(sent_lengths), 2),
        'sentence_length_std': round(statistics.stdev(sent_lengths), 2) if len(sent_lengths) > 1 else 0,
        'sentence_length_range': max(sent_lengths) - min(sent_lengths),

        # Depth metrics
        'avg_dependency_depth': round(statistics.mean(dep_depths), 2) if dep_depths else 0,
        'max_dependency_depth': max(dep_depths) if dep_depths else 0,
        'depth_variance': round(statistics.variance(dep_depths), 2) if len(dep_depths) > 1 else 0,

        # Structural metrics
        'clause_count': clause_count,
        'clauses_per_sentence': round(clause_count / len(sentences), 2),
        'avg_branching_factor': round(avg_branching, 2),

        # Relation distribution
        'relation_types': len(set(dep_relations)),
        'top_relations': sorted(relation_freq.items(), key=lambda x: -x[1])[:10]
    }
```

### NELA Feature Extraction

The NELA toolkit extracts 87 features across stylistic, complexity, and psychological categories:

```python
# Key complexity features from NELA
NELA_COMPLEXITY_FEATURES = [
    'words_per_sentence',
    'type_token_ratio',
    'noun_phrase_depth',
    'verb_phrase_depth',
    'average_word_length',
    'syllables_per_word',
    'complex_words_ratio',  # 3+ syllables
    'long_sentences_ratio',  # >20 words
]
```

### Sentence Type Classification

```python
def classify_sentence_types(text: str) -> Dict:
    """
    Classify sentences into simple, compound, complex, compound-complex.
    """
    doc = nlp(text)
    sentences = list(doc.sents)

    classifications = {
        'simple': 0,
        'compound': 0,
        'complex': 0,
        'compound_complex': 0
    }

    for sent in sentences:
        # Count clauses and conjunctions
        clause_markers = ['ccomp', 'xcomp', 'advcl', 'relcl', 'acl', 'csubj']
        coord_markers = ['cc', 'conj']

        clauses = sum(1 for t in sent if t.dep_ in clause_markers)
        coordinations = sum(1 for t in sent if t.dep_ in coord_markers)

        has_subordination = clauses > 0
        has_coordination = coordinations > 0

        if not has_subordination and not has_coordination:
            classifications['simple'] += 1
        elif has_coordination and not has_subordination:
            classifications['compound'] += 1
        elif has_subordination and not has_coordination:
            classifications['complex'] += 1
        else:
            classifications['compound_complex'] += 1

    total = len(sentences)
    ratios = {k: round(v / total, 3) for k, v in classifications.items()}

    return {
        'counts': classifications,
        'ratios': ratios,
        'total_sentences': total
    }
```

## AI vs Human Patterns

### Sentence Complexity Distribution

| Type | Human | AI |
|------|-------|-----|
| Simple | 35-50% (varied) | 41%+ (uniform) |
| Compound | 15-25% | 20-25% |
| Complex | 15-30% | 15-20% |
| Compound-Complex | 10-20% | <10% (often 0%) |

**Key finding**: 60% of AI texts have zero compound-complex sentences.

### Dependency Depth

| Metric | Human | AI |
|--------|-------|-----|
| Average depth | 4-8 | 3-5 |
| Depth variance | High | Low |
| Max depth | 10+ occasional | Rarely >7 |

*Sources: Human vs AI dependency depth ranges from syntactic analysis of multiple corpora. Ju, Blix & Williams (2025) "[Domain Regeneration: How well do LLMs match syntactic properties of text domains?](https://arxiv.org/abs/2505.07784)" (ACL 2025) confirmed that LLM-regenerated text consistently shows lower variance and a reduced long tail in parse depth distributions across Wikipedia, CCNews, and ELI5 domains. Their constituency parse depth findings align directionally with spaCy dependency depth observations: LLMs produce syntactically narrower output than humans.*

**Detection threshold rationale:** Given the human range of 4-8 and AI range of 3-5, we set `ai_threshold: 3.5` (midpoint of AI range) and `human_baseline: 6.0` (midpoint of human range). A threshold of 5.0 for the writer tool sits at the boundary where AI and human ranges overlap — text below 5.0 is suspect, above 6.0 is solidly human. Ref: Ju, Blix & Williams 2025 (arXiv:2505.07784).

### AI Syntactic Preferences

- Heavy use of correlative conjunctions ("not only...but also")
- Participial phrases at 2-5x human rates (CMU study)
- Emphatic contrast ("not just...but")
- Consistent clause structure

## Readability Metrics

### Flesch-Kincaid

```python
def flesch_kincaid(text: str) -> Dict:
    """
    Calculate Flesch Reading Ease and Grade Level.
    """
    # Simplified implementation
    words = text.split()
    sentences = text.count('.') + text.count('!') + text.count('?')
    syllables = sum(count_syllables(word) for word in words)

    if sentences == 0 or len(words) == 0:
        return {'error': 'Insufficient text'}

    asl = len(words) / sentences  # Average sentence length
    asw = syllables / len(words)  # Average syllables per word

    # Flesch Reading Ease (0-100, higher = easier)
    fre = 206.835 - (1.015 * asl) - (84.6 * asw)

    # Flesch-Kincaid Grade Level
    fkgl = (0.39 * asl) + (11.8 * asw) - 15.59

    return {
        'flesch_reading_ease': round(fre, 1),
        'flesch_kincaid_grade': round(fkgl, 1),
        'avg_sentence_length': round(asl, 1),
        'avg_syllables_per_word': round(asw, 2)
    }
```

### Readability Interpretation

| FRE Score | Reading Level |
|-----------|---------------|
| 90-100 | 5th grade (very easy) |
| 80-90 | 6th grade (easy) |
| 70-80 | 7th grade (fairly easy) |
| 60-70 | 8th-9th grade (plain English) |
| 50-60 | 10th-12th grade |
| 30-50 | College level |
| 0-30 | College graduate |

**Target for general audience**: 60-70 FRE

## Combined Analysis

```python
def full_syntactic_analysis(text: str) -> Dict:
    """
    Complete syntactic analysis for AI detection.
    """
    complexity = syntactic_complexity_analysis(text)
    sentence_types = classify_sentence_types(text)
    readability = flesch_kincaid(text)

    # Calculate uniformity score (higher = more AI-like)
    if complexity.get('sentence_length_std', 0) > 0:
        uniformity = 1 - (complexity['sentence_length_std'] /
                        complexity['avg_sentence_length'])
    else:
        uniformity = 1.0

    # AI signals
    signals = []

    if sentence_types['ratios'].get('compound_complex', 0) < 0.05:
        signals.append('Missing compound-complex sentences')

    if uniformity > 0.8:
        signals.append('High sentence uniformity')

    if complexity.get('depth_variance', 0) < 1.0:
        signals.append('Low depth variance')

    if complexity.get('avg_dependency_depth', 0) < 5:
        signals.append('Shallow dependency structure')

    return {
        'complexity': complexity,
        'sentence_types': sentence_types,
        'readability': readability,
        'uniformity_score': round(uniformity, 3),
        'ai_signals': signals,
        'ai_signal_count': len(signals)
    }
```

## Template Rate and CR-POS Metrics

### Template Rate

Research using POS sequence analysis demonstrates that AI produces text with substantially higher template redundancy.

| Metric | Human | AI | Ratio |
|--------|-------|-----|-------|
| Template Rate (% texts with ≥1 template) | **38%** | **95%** | 2.5x |

*Source: [ComplexDiscovery - Uncovering Repetition: The Hidden Patterns that Expose AI-Generated Text](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) (January 2025). Note: The study also found that 76% of templates found in model outputs also appear in pre-training data.*

**Key finding**: Near-universal presence of identifiable syntactic templates in AI text (95%) vs minority presence in human writing (38%).

### CR-POS (Compression Ratio of POS)

Measures redundancy of POS-tagged text. Higher values indicate greater syntactic regularity.

| Metric | Human | AI | Interpretation |
|--------|-------|-----|----------------|
| CR-POS | 0.42 | **0.67** | 1.6x more regular |

*Source: [ComplexDiscovery - Uncovering Repetition](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) (January 2025).*

### POS Frequency Differences

| POS Category | Human (%) | AI Range (%) | Pattern |
|--------------|-----------|--------------|---------|
| NOUN | 19.69 | 17.44–17.85 | **Reduced in AI** |
| PUNCT | 11.88 | 10.77–12.14 | Variable |
| ADP (adposition) | 11.36 | 10.30–10.75 | **Reduced in AI** |
| VERB | 9.97 | 9.23–10.37 | Slightly elevated |
| PRON | 5.32 | **6.11–7.33** | **Elevated in AI** |
| AUX (auxiliary) | 3.81 | **5.41–6.02** | **40-58% higher in AI** |
| ADV | 3.26 | 2.61–3.68 | Variable |

*Source: [NIH/PMC Study PMC11422446](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/) - "Large Language Models Produce Responses Perceived to be Empathic" (2024). The study compared human text vs outputs from GPT-4, Llama-2, and Mixtral across multiple linguistic dimensions.*

**Key finding**: Auxiliary verb elevation (40-58% increase) reflects AI preference for periphrastic verbal constructions.

### Specific POS Patterns with AI Elevation

Qualitative patterns observed in AI text (specific frequency data not available from verified sources):

- **Determiner-Adjective-Noun** in subject position
- **Noun-preposition-Determiner-Noun** (nominal prepositional phrases)
- **Adjective-noun clustering**: Multiple adjectives preceding nouns
- **Adverb-verb clustering**: Manner adverbs preceding verbs

---

## Research Performance

| Metric | AUROC for AI Detection | Source |
|--------|------------------------|--------|
| NELA features (87 total) | 0.99 | [SKDU at De-Factify 4.0](https://arxiv.org/html/2503.22338) |

*Note: Other AUROC values previously listed (sentence length variance, syntactic complexity ensemble, sentence type distribution, Template Rate, CR-POS) could not be verified from downloaded sources and have been removed.*

## Sources

- [SKDU at De-Factify 4.0 (arXiv)](https://arxiv.org/html/2503.22338)
- [Yngve/Frazier Complexity (Behavior Research Methods)](https://link.springer.com/article/10.3758/s13428-010-0037-9)
- [CLAS System for Syntactic Analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC12510242/)
- [How AI Detectors Interpret Sentence Structure](https://hastewire.com/blog/how-ai-detectors-interpret-sentence-structure-key-insights)
