# AI Text Detection & Humanization Research - Index

> Comprehensive research for building adversarial Writer and Detector agents.

---

## Quick Navigation

| Section                   | Purpose                               |
| ------------------------- | ------------------------------------- |
| [Markers](#markers)       | AI fingerprint patterns by category   |
| [Algorithms](#algorithms) | Implementation details with code      |
| [Detection](#detection)   | Tool specifications & ensemble design |
| [Agents](#agents)         | Writer/Detector agent strategies      |
| [Research](#research)     | Sources, gaps, model fingerprints     |

---

## Markers

AI fingerprint patterns organized by detection category.

### [01-punctuation.md](./markers/01-punctuation.md)

Punctuation-based detection signals.

- Context-Dependent Baselines
- Em Dash Overuse (quantified frequency data)
- Period-Quote Placement (American vs British)
- Semicolon and Parenthesis Avoidance
- Oxford Comma Consistency
- Smart Quote Detection
- Punctuation Portfolio Analysis

### [02-structure.md](./markers/02-structure.md)

Document structure patterns.

- Paragraph Length Uniformity
- List/Bullet Density
- Heading Hierarchy
- Section Balance

### [03-style.md](./markers/03-style.md)

Writing style and tone markers.

- Vocabulary Choices
- Hedging Language
- Transition Words
- Formality Level

### [04-narrative.md](./markers/04-narrative.md)

Rhetorical and narrative patterns.

- Opening Formulas
- Closing Formulas
- Tricolon Structures
- Self-Referential Artifacts

### [05-lexical.md](./markers/05-lexical.md)

Statistical text analysis markers.

- Perplexity Overview
- Burstiness Overview
- N-gram Analysis Overview
- DetectGPT Overview
- Zipf's Law (Not Diagnostic)
- Sentence Complexity Patterns

### [06-formatting.md](./markers/06-formatting.md)

Technical formatting fingerprints.

- Unicode Characters
- Whitespace Patterns
- Markdown Conventions
- Encoding Artifacts

### [07-content.md](./markers/07-content.md)

Content-level detection signals.

- Over-explanation
- Citation Patterns
- Specificity Issues
- Hedging Density

### [08-narrative.md](./markers/08-narrative.md)

Narrative and discourse markers.

- Narrative Arc Flattening
- Personal Voice Absence
- Specificity Deficits
- Coherence Patterns (Local vs Global)
- Emotional Flatness
- Humor and Irony Absence

### [09-compounds-hyphens.md](./markers/09-compounds-hyphens.md)

Compound words and hyphenation patterns.

- Hyphenated Compound Overuse
- N-N Compound Elevation
- Hyphenation Conservatism

---

## Algorithms

Detailed implementation specifications with formulas and code.

### [01-perplexity.md](./algorithms/01-perplexity.md)

Complete perplexity calculation guide.

- Mathematical Definition
  - Formula: `PPL = exp{-1/t * sum(log p(xi | x<i))}`
- Reference Model Selection
  - GPT-2 variants comparison table
- Implementation
  - Basic Implementation (Python)
  - Sentence-Level Perplexity
- Sliding Window Strategy
  - With/without overlap comparison
- Thresholds for Detection
  - PPL < 20 = AI, PPL > 50 = Human
- Limitations and Caveats
- Libraries

### [02-burstiness.md](./algorithms/02-burstiness.md)

Burstiness and variance calculation guide.

- Core Formulas
  - GPTZero Burstiness: `B = (sigma / mu) * 100`
  - Fano Factor: `F = variance / mean`
  - Perplexity Burstiness
- Complete Implementation (Python)
- Interpretation Thresholds
  - Coefficient of Variation thresholds
  - Fano Factor interpretation
  - Sentence length patterns
- AI Red Flags
- Combined Detection Function
- Example Analysis (Human vs AI)

### [03-detectgpt.md](./algorithms/03-detectgpt.md)

DetectGPT and Fast-DetectGPT implementation.

- Core Hypothesis
- DetectGPT Algorithm
  - Perturbation Discrepancy Formula
  - Decision Rule
  - Algorithm Steps (pseudocode)
  - Perturbation Model (T5)
- Fast-DetectGPT Algorithm
  - Conditional Probability Curvature
  - Sampling Mechanism
  - Algorithm Steps
  - Curvature Interpretation
- Implementation
  - DetectGPT Class (Python)
  - Fast-DetectGPT Class (Python)
- Performance Benchmarks
- Limitations
- Official Implementations (GitHub links)

### [04-ngram-analysis.md](./algorithms/04-ngram-analysis.md)

N-gram analysis for detection.

- Detection Power by N-gram Size
  - Table: 58% (unigram) to 97% (6-gram) AUROC
- DNA-GPT: Divergent N-gram Analysis
  - Core Method
  - Algorithm (pseudocode)
  - Divergence Metrics
- Implementation
  - Basic N-gram Analyzer (Python)
  - DNA-GPT Style Comparison (Python)
  - Baseline Corpus Comparison (Python)
- Interpretation Guidelines
  - Type-Token Ratio thresholds
  - Repetition patterns
  - DNA-GPT overlap scores
- AI-Specific N-gram Patterns
  - Transition phrases list
  - Opening/closing formulas
- Limitations

### [05-vocabulary-metrics.md](./algorithms/05-vocabulary-metrics.md)

Vocabulary analysis metrics.

- Type-Token Ratio (TTR)
  - Formula and variants (RTTR, CTTR, Log TTR)
- MTLD (Measure of Textual Lexical Diversity)
  - Algorithm
  - Implementation (Python)
  - Interpretation thresholds
- MATTR (Moving-Average TTR)
- Hapax Legomena Ratio
  - Research findings
  - Implementation
- Zipf's Law Analysis
  - Why it's not diagnostic
  - Useful deviation features
- AI Detection Vocabulary Features
  - GPTZero markers
  - PubMed excess vocabulary study
  - Implementation with multipliers
- Combined Vocabulary Assessment
- Libraries (lexicalrichness, TRUNAJOD)

### [06-syntactic-complexity.md](./algorithms/06-syntactic-complexity.md)

Syntactic structure analysis.

- Key Metrics
  - Yngve Depth (algorithm and formula)
  - Frazier Depth (algorithm and formula)
  - Dependency Length
- Implementation
  - Using spaCy (Python)
  - NELA Feature Extraction
  - Sentence Type Classification
- AI vs Human Patterns
  - Sentence complexity distribution table
  - Dependency depth comparison
  - AI syntactic preferences
- Readability Metrics
  - Flesch-Kincaid formulas
  - Interpretation table
- Combined Analysis Function
- Research Performance (AUROC by metric)

---

## Detection

Detector agent architecture and tool specifications.

### [tool-specifications.md](./detection/tool-specifications.md)

Complete detection tool suite.

- Architecture Overview (diagram)
- Tool 1: Perplexity Calculator
  - Interface (TypeScript)
  - Thresholds
  - Weight: 0.15
- Tool 2: Burstiness Calculator
  - Interface
  - Thresholds
  - Weight: 0.12
- Tool 3: DetectGPT Scorer
  - Interface
  - Thresholds
  - Weight: 0.20 (highest)
- Tool 4: Vocabulary Fingerprint
  - Interface
  - AI Marker Vocabulary list
  - Thresholds
  - Weight: 0.15
- Tool 5: N-gram Analyzer
  - Interface
  - AI Phrase Patterns
  - Thresholds
  - Weight: 0.12
- Tool 6: Syntactic Complexity Analyzer
  - Interface
  - Thresholds
  - Weight: 0.10
- Tool 7: Unicode & Punctuation Scanner
  - Interface
  - AI Signals
  - Weight: 0.06
- Tool 8: Content Quality Analyzer
  - Interface
  - Thresholds
  - Weight: 0.10
- Ensemble Aggregator
  - Weighting scheme table
  - Aggregation algorithm
  - Scoring formula
  - Confidence intervals
- Implementation Notes
  - Performance optimization
  - Dependencies
  - Minimum text requirements

---

## Agents

Strategies for Writer and Detector agents.

### [humanization-strategies.md](./agents/humanization-strategies.md)

Writer agent guide for producing human-like text.

- Core Principles
  - Embrace Imperfection
  - Create Rhythm Variation
  - Inject Personality
- Sentence-Level Transformations
  - Rule 1: Break Uniform Lengths
  - Rule 2: Disrupt Predictable Openings
  - Rule 3: Vary Transition Density
  - Rule 4: Add Parenthetical Asides
  - Rule 5: Use Contractions Naturally
- Vocabulary Transformations
  - Replace AI Buzzwords (table)
  - Add Colloquialisms
  - Use Specific Over Generic
  - Introduce Hedging Asymmetry
- Structural Transformations
  - Break Tricolon Patterns
  - Disrupt Parallel Structure
  - Use Varied List Formats
  - Create Paragraph Variance
- Punctuation Strategies
  - Em Dash Usage
  - Semicolon Discipline
  - Smart Quotes & Unicode
- Content-Level Strategies
  - Add Specificity
  - Include Personal Perspective
  - Reference Concrete Details
  - Acknowledge Limitations
- Perplexity Manipulation
  - Techniques to increase perplexity
  - Example transformation
- Burstiness Manipulation
  - Sentence length cycling
  - Perplexity spikes
- Anti-Patterns to Avoid (10 items)
- Transformation Checklist (12 items)
- Example: Full Transformation (before/after)

---

## Research

Meta-research, sources, and knowledge gaps.

### [model-fingerprints.md](./model-fingerprints.md)

Model-specific detection signatures.

- Research Findings
  - Fingerprint Detection Accuracy (>99% precision)
  - Cross-Model Relationships
- Claude (Anthropic)
  - Writing Style Characteristics
  - Distinctive Traits
  - Claude vs GPT comparison table
  - Claude-Specific Patterns
- ChatGPT / GPT (OpenAI)
  - Writing Style Characteristics
  - Vocabulary Fingerprint (overused words)
  - Quantified Excess (PubMed study)
  - GPT Structural Patterns
  - GPT-Specific Transitions
  - GPT Version Differences table
- Gemini (Google)
  - Writing Style Characteristics
  - Distinctive Vocabulary Choices
  - Gemini Trigram Signatures
  - Gemini-Specific Patterns
  - Authorship Attribution Scores
- Llama (Meta) - limited data
- Detection Strategies by Model
- Implementation: Model Classifier (Python)
- Limitations

### [gaps.md](./gaps.md)

Remaining research gaps.

- Status Summary Table
- Remaining Gaps
  - Model-Specific Linguistic Features
  - Optimal DetectGPT Threshold
  - Baseline Corpus for N-gram Comparison
  - Mixed Authorship Detection
  - Real-Time Evasion Adaptation
  - Cross-Lingual Detection
  - Multimodal Content
- Data Quality Issues
- Suggested Future Research

### [sources.md](./sources.md)

Complete source bibliography.

- Academic Papers
  - Detection Methods
  - Vocabulary & Linguistics
- Tools & Implementations
  - Official Code Repositories
  - Detection Services
- Technical Documentation
- Industry/Blog Sources
- Key Statistics & Findings
- Citation Format (BibTeX templates)

---

## Key Statistics Reference (Verified)

| Metric                            | Value  | Source               |
| --------------------------------- | ------ | -------------------- |
| DetectGPT AUROC                   | 0.95   | [Mitchell et al. 2023](https://arxiv.org/abs/2301.11305) |
| Fast-DetectGPT speedup            | 340x   | [Bao et al. 2024](https://arxiv.org/abs/2310.05130) |
| NELA features F1                  | 0.99   | [arXiv:2503.22338](https://arxiv.org/abs/2503.22338) |
| "delves" frequency increase       | 25.2x  | [Kobak et al. 2024](https://arxiv.org/abs/2406.07016) |
| "showcasing" frequency increase   | 9.2x   | [Kobak et al. 2024](https://arxiv.org/abs/2406.07016) |
| GPT-4o em dash vs GPT-3.5         | ~10x   | [Goedecke analysis](https://www.seangoedecke.com/em-dashes/) |
| GPT-4o present participles vs human | 527% | [PNAS 2024](https://www.pnas.org/doi/10.1073/pnas.2322689121) |
| GPT-4o nominalizations vs human | 214% | [PNAS 2024](https://www.pnas.org/doi/10.1073/pnas.2322689121) |
| Construction entropy (human) | H=3.342 | [PNAS 2024](https://www.pnas.org/doi/10.1073/pnas.2322689121) |
| Construction entropy (LLM) | H=3.221-3.284 | [PNAS 2024](https://www.pnas.org/doi/10.1073/pnas.2322689121) |
| EditLens mixed authorship F1 | 94.7% | [EditLens 2024](https://arxiv.org/) |
| ESL false positive rate | 97% | [Stanford 2023](https://hai.stanford.edu/) |
| Perplexity threshold (GPTZero)    | PPL=20 | [GPTZero/NYU study](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/) |
| Model fingerprint accuracy        | 97.1%  | [The Prompt Index](https://www.thepromptindex.com/hidden-signatures-how-ai-models-leave-their-digital-fingerprints.html) |
| Template Rate (human vs AI)       | 38% vs 95% | [ComplexDiscovery](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) |
| CR-POS (human vs AI)              | 0.42 vs 0.67 | [ComplexDiscovery](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) |
| "As an AI language model" elevation | 294,000x | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) |
| "vibrant tapestry" elevation      | 17,000x | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) |
| GPTZero RAID benchmark accuracy   | 95.7%  | [GPTZero](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/) |

---

## Quick Start

### For Detector Agent

1. Read [tool-specifications.md](./detection/tool-specifications.md) for architecture
2. Implement tools from [algorithms/](./algorithms/) in priority order:
   - DetectGPT (weight 0.20)
   - Perplexity (weight 0.15)
   - Vocabulary (weight 0.15)
3. Use ensemble aggregation for final classification

### For Writer Agent

1. Read [humanization-strategies.md](./agents/humanization-strategies.md) for techniques
2. Reference [model-fingerprints.md](./model-fingerprints.md) to understand model tells
3. Use transformation checklist before finalizing output
4. Target: CV > 60, Fano > 1.5, no AI vocabulary markers
