---
name: gw-detector-red-flags
description: AI writing detection patterns and red flags. Load when the slop-detector agent needs to analyze text for AI signals.
user-invocable: false
---

# AI Writing Detection Red Flags

Quick reference for the adversarial detector agent. Use this to identify AI-generated content.

---

## Severity Levels

| Level | Action | Examples |
|-------|--------|----------|
| **Critical** | Definitive AI signal | Self-references, citation hallucinations |
| **High** | Strong AI signal | Closing formulas, "delve", em-dash patterns |
| **Moderate** | Multiple needed for confidence | Hedging, transitions, vocabulary |

---

## 1. Vocabulary Red Flags

### Critical Markers (High Confidence)

**The "Delve" Family** — 25x frequency increase in AI text
- delve, delves, delving
- Always flag; no human justification for this word

**Threshold**: `>2` occurrences in 1000 words = critical

### High-Signal Words (Elevated >10x in AI)

Primary markers:
- showcase, showcasing (9.2x)
- underscore, underscores (9.1x)
- tapestry (10x)
- meticulous (5x)
- robust, pivotal, comprehensive, crucial (5x each)

Secondary markers:
- intricate, symphony, realm, prowess
- captivate, noteworthy, groundbreaking, unlock
- leverage, notable, unveil, bolster
- holistic, elevate, unwavering, transformative
- embark, invaluable, testament, nuance, multifaceted

**Threshold**: AI vocab density >15 per 1000 words = high signal

### Formal Overuse (Moderate Signal)

AI prefers formal where humans use simple:
- utilize → use
- leverage → use/apply
- endeavor → try
- facilitate → help
- implement → do/start

---

## 2. Punctuation Red Flags

### Critical: Em Dash (—) Overuse

**The GPT-4 Signature Pattern**

| Context | Human | AI | Flag Point |
|---------|-------|-----|-----------|
| General prose | 0.3-2.0/1000 | 2.5-6.0/1000 | >2.5/1000 |
| Distribution | Clustered | Uniform | Perfect uniformity |

Special pattern: "It's not just X — it's Y" (extremely common in AI)

**Detection**: Count em dashes (U+2014), flag if >2.5 per 1000 words AND uniform distribution

### High: Punctuation Ratios

**Semicolon to Em-dash Ratio** (strongest signal)
- Human: 1:1 to 2:1
- AI: 0.3:1 to 0.5:1

AI systematically **underuses**:
- Semicolons (0.8-2.0/1000 vs human 2.0-4.5/1000)
- Parentheses (2.0-4.0/1000 vs human 3.0-6.0/1000)

### Moderate: Over-Perfect Consistency

- Oxford comma: >95% consistency in informal contexts
- Period-quote placement: 97-99.5% American style (vs human 85-92%)
- Smart quotes: Consistent use (U+201C/D) in casual writing
- Zero typos or inconsistencies

---

## 3. Structural Red Flags

### Critical: Opening Formulas

Flag immediately if text opens with:
- "In today's [fast-paced/digital/competitive/modern]..."
- "In an era where..."
- "Have you ever wondered..."
- "In the realm of..."
- "When it comes to..."
- "[Topic] is one of the most [superlative]..."

**Reliability**: Very High

### Critical: Closing Formulas

Flag immediately if text closes with:
- "In conclusion..."
- "In summary..."
- "To sum up..."
- "Overall..."
- "Whether you're X or Y, [topic] offers..."
- "Both sides present valid points"
- "As I/we progress/continue..."

**Reliability**: Very High (one of most consistent AI tells)

### High: Paragraph Uniformity

**Fano Factor Test** (variance/mean of paragraph lengths)
- AI: Low variance, similar lengths
- Human: High variance, narrative-driven

Calculate: `variance(paragraph_lengths) / mean(paragraph_lengths)`
- <0.8 = AI signal
- >1.5 = human signal

### High: Bullet Point Density

AI defaults to lists even when prose is more natural.

**Threshold**: >3 bullets per 100 words = suspicious

Look for:
- 3-5 item lists (AI favorite)
- Parallel grammatical structure
- Nested lists with perfect indentation

---

## 4. Style & Hedging Red Flags

### High: Hedging Language Overuse

AI exhibits risk-averse, non-committal tone:
- "It's important to note that..."
- "It's worth mentioning..."
- "It should be noted..."
- "Based on the information provided..."
- "Can vary depending on..."
- "It's crucial to understand..."
- "While this may be true..."

**Threshold**: >3 hedging phrases per 1000 words = high signal

### High: Transition Word Overuse

AI overuses formal transitions:
- Furthermore, moreover, additionally
- Consequently, thus, subsequently
- Hence, therefore, nonetheless

**Key pattern**: Paragraphs starting with single transition word + comma
- "However," + new paragraph = Cambridge AI indicator

**Threshold**: >20% of paragraphs starting with formal transition = high signal

### Moderate: Balanced Perspective Forcing

AI maintains artificial neutrality:
- "While some argue X, others believe Y"
- "Both sides/perspectives have merit"
- "There are pros and cons"
- "It depends/varies"

Flag in: Opinion pieces, reviews, recommendations (contexts requiring stance)

---

## 5. Content Red Flags

### Critical: Self-Referential Artifacts

**Definitive AI markers** (when present):
- "As an AI language model..."
- "I'm Claude/GPT/an AI assistant..."
- "I don't have personal experiences..."
- "I was created/trained by..."
- "My knowledge cutoff..."
- "Certainly!" (opening)
- "I hope this helps!" (closing)
- "Let me know if you have questions!" (closing)

**Reliability**: Very High (but often removed in edited text)

### Critical: Citation Hallucination

Check for:
- Fabricated DOIs (format correct, leads nowhere)
- Non-existent journal names
- Placeholder markers: `[citation needed]`, `citeturn0search0`
- Real paper + wrong journal/date/authors

**Verification**: Query CrossRef, PubMed, DOI.org APIs

**Reliability**: Very High (verifiable)

### High: Safety Caveats

Unnecessary disclaimers:
- "Please consult a professional..."
- "This is not medical/legal/financial advice..."
- "Individual results may vary..."
- "Always do your own research..."

**Threshold**: >1 safety caveat in non-medical/legal content = suspicious

### Moderate: Over-Explanation

AI explains what audience already knows:
- Defining common terms to experts
- Unnecessary background information
- Definition phrases: "which is," "defined as," "meaning that"

### Moderate: Generic Content (Lacks Lived Experience)

Missing:
- Sensory details
- Specific names, dates, places, numbers
- Personal anecdotes
- Cultural references
- Unexpected tangents
- Opinionated asides

---

## 6. Statistical Metrics

### High Confidence Metrics

**Perplexity** (requires model)
- AI: <20 (highly predictable)
- Human: >50 (more surprising word choices)
- Threshold: <20 = likely AI

**DetectGPT d_score** (curvature analysis)
- AI: >2.0 (high confidence)
- Human: <0.5 (likely)
- AUROC: 0.95 (very reliable)

**Burstiness** (sentence length variation)
- Coefficient of Variation (CV): std/mean × 100
  - AI: <30
  - Human: >60
- Fano Factor: variance/mean
  - AI: <0.8
  - Human: >1.5

### Moderate Confidence Metrics

**Lexical Diversity**
- MTLD (Measure of Textual Lexical Diversity)
  - AI: <50
  - Human: >80
- Hapax ratio (words appearing once)
  - AI: <0.4
  - Human: >0.5

**Syntactic Complexity**
- Sentence length std dev
  - AI: <5
  - Human: >10
- Compound-complex ratio
  - AI: <0.05 (60% have none)
  - Human: >0.10

**N-gram Analysis** (6-grams most diagnostic)
- Type-token ratio
  - AI: <0.95
  - Human: >0.98

---

## Detection Workflow

### 1. Quick Scan (30 seconds)

Check for critical markers:
1. Self-referential language?
2. Opening/closing formulas?
3. "Delve" or tapestry/realm/showcase?
4. Em dash count (>2.5/1000)?
5. Citation placeholders?

**If yes to 2+**: Likely AI → proceed to full analysis

### 2. Vocabulary Analysis (2 minutes)

1. Count AI marker words (delve, showcase, underscore, etc.)
2. Calculate AI vocab density (per 1000 words)
3. Check formal overuse (utilize, leverage, facilitate)
4. Count hedging phrases
5. Count transition word overuse

**Threshold**: AI vocab density >15 + hedging >3 = high signal

### 3. Structural Analysis (3 minutes)

1. Calculate paragraph length Fano factor
2. Count bullet density
3. Check heading hierarchy rigidity
4. Measure section length consistency
5. Look for introduction-body-conclusion rigidity

### 4. Punctuation Portfolio (2 minutes)

1. Count em dashes, semicolons, parentheses
2. Calculate semicolon:em-dash ratio
3. Check punctuation consistency (Oxford comma, quote placement)
4. Flag if >97% consistency in casual context

### 5. Statistical Metrics (if needed)

1. Calculate perplexity (GPT-2 reference)
2. Calculate burstiness (sentence length CV)
3. Run n-gram analysis (6-grams)
4. Optional: Run DetectGPT (high compute)

---

## Ensemble Weighting

When combining signals, use these weights:

| Signal | Weight | Justification |
|--------|--------|---------------|
| DetectGPT | 0.20 | Highest AUROC (~95%) |
| Perplexity | 0.15 | Well-validated |
| Vocabulary | 0.15 | Clear markers |
| Burstiness | 0.12 | Good discrimination |
| N-gram | 0.12 | High reliability |
| Syntactic | 0.10 | Moderate signal |
| Content | 0.10 | Supporting |
| Punctuation | 0.06 | Context-dependent |

---

## Final Classification

| Score | Classification | Confidence |
|-------|---------------|------------|
| 85-100 | AI | High |
| 70-85 | AI | Medium |
| 55-70 | Uncertain | Low |
| 30-55 | Human | Medium |
| 0-30 | Human | High |

---

## False Positive Warnings

**Do NOT flag as AI solely based on**:
- Technical documentation (logical punctuation expected)
- Professionally edited books (high consistency expected)
- Academic papers (style guide enforcement)
- Famous texts (over-represented in training data)
- ESL writers (lower perplexity natural)

**Context is critical** — adjust thresholds by publishing context.
