# Punctuation Markers

## Overview

Punctuation patterns are among the most visible AI fingerprints, though individually they have moderate-to-low reliability. The em dash has become AI's most documented signature.

**Critical Note**: Punctuation markers are highly **context-dependent**. Professionally edited books, technical documentation, and academic papers may show near-perfect consistency that mimics AI patterns. Always consider the publishing context when evaluating these markers.

---

## Context-Dependent Baselines

Different publishing contexts have different expected consistency levels:

| Context | Expected Human Consistency | AI-Suspicious Threshold |
|---------|---------------------------|-------------------------|
| Technical documentation | 90-98% (often logical punctuation) | Not reliable |
| Published books | 95-100% (professionally edited) | Not reliable |
| Academic papers | 90-98% (style guide enforced) | Not reliable |
| Blog posts | 70-85% | >95% |
| Casual/social media | 60-80% | >90% |
| Student essays (unedited) | 75-90% | >98% |
| Business emails | 80-90% | >97% |

**Key insight**: "Too perfect" is only suspicious in contexts where humans are expected to be imperfect.

---

## Em Dash (—) - The Signature Marker

### Pattern

- **GPT-4o uses ~10x more em dashes than GPT-3.5** (GPT-3.5 produced 0 em dashes in comparative tests, GPT-4.1 used 14, GPT-4o used 16)
- GPT-4.1 increased usage further
- The construction "It's not just about X — it's about Y" appears with remarkable frequency

*Source: [Sean Goedecke's analysis "Why do AI models use so many em-dashes?"](https://www.seangoedecke.com/em-dashes/) documents the progression across GPT versions. OpenAI CEO Sam Altman [confirmed](https://techcrunch.com/2025/11/14/openai-says-its-fixed-chatgpts-em-dash-problem/) users can now instruct ChatGPT to avoid em dashes.*

### Quantified Frequency Data

| Source Type | Em-dash Frequency (per 1000 words) | Distribution Pattern |
|-------------|-----------------------------------|----------------------|
| Human academic prose | 0.5–1.5 | Clustered, context-dependent |
| Human journalism | 0.8–2.0 | Moderate clustering in quoted material |
| Human fiction | 0.3–1.0 | Highly clustered in dialogue |
| Human casual writing | 0.1–0.5 | Sparse, irregular |
| GPT-4 generated text | 2.5–5.0 | Relatively uniform |
| Claude generated text | 2.0–4.5 | Moderate uniformity |
| Gemini generated text | 2.5–5.5 | Relatively uniform |

*Note: These frequency ranges are estimated patterns from AI detection literature. No verified primary source data available for exact frequencies—treat as qualitative guidance. See [Pangram Labs](https://www.pangram.com/blog/why-perplexity-and-burstiness-fail-to-detect-ai) for general methodology.*

### Why It Happens

- Training data bias: em dash usage peaked at 0.35% in 1860s English prose
- AI labs digitized substantial 19th-century print material for high-quality training data
- No keyboard constraint for AI (humans default to hyphen because it's on the keyboard)
- Models associate em dashes with "polished, professional" prose

### Syntactic Positioning Patterns

AI deploys em dashes in three primary contexts with statistical regularity:

1. **Parenthetical Insertion** (70-80% of AI usage vs 45-60% human)
   - "The problem—em-dashes specifically—creates distinctive rhythm"

2. **Sentence-Initial Emphasis**
   - "The solution seemed obvious—until it wasn't."

3. **Clause-Connection Without Conjunctions**
   - Splices independent clauses where humans would use semicolons or periods

AI also produces **stacked/nested constructions** humans avoid:
> "The results—while preliminary—suggest—though cautiously—a positive trend."

### Model Differences

| Model | Em-dash Frequency | Characteristics |
|-------|-------------------|-----------------|
| GPT-4/GPT-3.5 | Highest (3-6/1000) | "ChatGPT dash" designation; clustering tendency |
| Claude | Moderate-high (2-4.5/1000) | More varied punctuation; responsive to correction |
| Gemini | High (2.5-5.5/1000) | Genre-dependent variation |

### Detection

```regex
/\u2014/g  # Unicode em dash
```

Threshold: >2.5 per 1000 words in non-literary context = potential AI signal

### Reliability: **Moderate-High**

- Model-specific (GPT-4+ primarily)
- OpenAI has added option to disable via Custom Instructions (Nov 2025)
- May decrease as awareness spreads
- Distribution pattern (uniform vs clustered) is more diagnostic than raw count

---

## Smart Quotes vs Straight Quotes

### Pattern

AI outputs curly quotation marks (" " ' ') instead of straight ASCII quotes (" ')

### Why It Happens

- LLMs train on professionally edited texts where typographic quotes are standard
- No keyboard constraint for AI

### Problems Created

- Breaks code snippets
- Breaks CSV files
- Breaks Markdown formatting

### Detection

```regex
/[\u201C\u201D\u2018\u2019]/g  # Smart quotes
```

### Reliability: **Low-Moderate**

- Context-dependent
- Professional editing also introduces smart quotes

---

## Semicolon and Colon Patterns

### Patterns

- GPT-5's semicolon overuse linked to brevity optimization
- Colons in titles much more common post-ChatGPT
- "Anytime I see an author using colons in their titles several times in a row... it is almost always ChatGPT"

### Detection

- Count semicolon frequency per 1000 words
- Flag repeated colon use in titles/headings

### Reliability: **Low-Moderate**

- Academic writing naturally uses semicolons
- Style guides vary on colon usage

---

## Oxford Comma

### Pattern

AI consistently uses Oxford commas regardless of context or style guide.

ChatGPT confirmed: "I choose to use [the Oxford comma] for the sake of clarity."

### Quantified Data

| Genre | Human Oxford Comma Rate | AI Oxford Comma Rate |
|-------|------------------------|----------------------|
| Academic (American) | 85-90% | ~98% |
| Journalism (American) | 70-80% | ~95% |
| Business communication | 60-75% | ~97% |
| Creative writing | 40-60% | ~90% |
| Informal digital | 30-50% | ~85% |

*Note: These rates are estimated patterns from AI detection literature—no verified primary source data available.*

**Key insight**: AI maintains high application rates even in creative/informal contexts where humans reduce usage.

### Detection

- Check for comma before "and" in series
- Flag if >95% consistent across document in informal contexts
- Variation below 5% within document is suspicious

### Reliability: **Low-Moderate**

- Many humans use consistently
- Some style guides require it
- More useful in informal contexts where humans show variation

---

## Period-Quote Placement

### The Convention Split

**American English**: Periods and commas go INSIDE quotation marks regardless of logical scope
- `"The term is 'artificial intelligence.'"`

**British English**: Periods and commas go OUTSIDE when not part of quoted material
- `'The term is "artificial intelligence".`

**Logical/Technical**: Placement follows the logic of what's being quoted
- Used in programming, technical writing, and some academic contexts
- `The function returns "hello".` (period not part of string)

### AI Behavior

| Convention | Human Consistency | AI Consistency |
|------------|-------------------|----------------|
| American (period inside) | 85-92% | **97-99.5%** |
| British (period outside) | 80-90% | 95-98% when prompted |
| Mixed/inconsistent | 8-15% | **<2%** |

*Note: These rates are estimated patterns—no verified primary source data available.*

### Why This Is a Strong Signal

1. **Hyper-correctness**: AI achieves 97-99.5% consistency while humans average 85-92%

2. **American default bias**: Even when writing British English (British spelling, vocabulary), AI defaults to American punctuation—this mismatch is diagnostic

3. **Intra-document drift**: In longer documents, AI may drift between conventions, producing hybrid forms that violate BOTH standards

4. **Absence of human variability**: Detection works by flagging convention-adherence scores exceeding human baselines

### Context Considerations

**Where this marker FAILS:**
- Technical documentation (logical punctuation is standard)
- Programming content (precision required)
- Professionally edited books (editors enforce consistency)
- Academic papers with style guide enforcement

**Where this marker WORKS:**
- Blog posts and casual writing
- Student essays
- Self-published content
- Business communications

### Detection

- Calculate period-inside-quote rate
- Flag documents with >97% consistency in casual contexts
- Flag American/British convention mismatches (British spelling + American punctuation)

### Reliability: **Moderate** (context-dependent)

- Weak in isolation
- Strong when combined with register/spelling mismatches
- Most useful in informal contexts

---

## Semicolon and Parenthesis Avoidance

### Pattern

AI systematically **underuses** semicolons and parentheses relative to human writing, substituting em dashes instead.

### Quantified Data

| Punctuation | Human (per 1000 words) | AI (per 1000 words) | AI/Human Ratio |
|-------------|------------------------|---------------------|----------------|
| Semicolon | 2.0-4.5 | 0.8-2.0 | **0.35-0.50** |
| Parenthesis (opening) | 3.0-6.0 | 2.0-4.0 | **0.50-0.70** |
| Em-dash | 0.5-2.0 | 2.5-5.5 | **2.5-5.0** |

*Note: These frequency estimates are derived from qualitative observations in AI detection literature. [Pangram Labs](https://www.pangram.com/blog/is-this-ai-a-field-guide-for-detecting-ai-writing-in-the-wild) notes "AI does not often use semicolons, parentheses." Exact quantified ratios not verified.*

### Why It Happens

- Semicolons require nuanced judgment about clause independence
- Models learned them less reliably from training data
- Em dashes serve as "universal connector" substitute

### Substitution Patterns

**Clause joining:**
- Human: "The proposal was accepted; implementation began immediately."
- AI: "The proposal was accepted—implementation began immediately."

**List elaboration:**
- Human: "Three factors matter: cost (which must be minimized), quality, and speed."
- AI: "Three factors matter—cost, quality, and speed."

### Detection

- Calculate semicolon-to-em-dash ratio
- Human ratio: ~1:1 to 2:1
- AI ratio: ~0.3:1 to 0.5:1

### Reliability: **Moderate-High**

- Consistent across model families
- Less susceptible to prompt manipulation

---

## Punctuation Uniformity (Meta-Pattern)

### Pattern

AI applies punctuation rules with **perfect consistency**:

- Uniform comma placement
- Consistent spacing around punctuation
- No variation in formatting choices

### Why It's a Tell

Human writers vary in their punctuation habits. Perfect consistency is itself suspicious.

### What to Look For

- Zero typos
- No missed periods
- Consistent quote style throughout
- Uniform dash usage

### Reliability: **Moderate**

- Typos are human fingerprints
- Professional editing can create uniformity

---

## Horizontal Ellipsis

### Pattern

AI may output Unicode ellipsis character (…, U+2026) rather than three periods (...)

### Detection

```regex
/\u2026/g  # Unicode ellipsis
```

### Reliability: **Low**

- Some word processors auto-convert
- Style-dependent

---

## Summary Table

| Marker | AI Pattern | Human Pattern | Reliability |
|--------|-----------|---------------|-------------|
| Em dash | 2.5-6.0/1000 words, uniform | 0.3-2.0/1000, clustered | **Moderate-High** |
| Semicolon | 0.8-2.0/1000 (underuse) | 2.0-4.5/1000 | **Moderate-High** |
| Parenthesis | 2.0-4.0/1000 (underuse) | 3.0-6.0/1000 | **Moderate** |
| Period-quote | 97-99.5% American | 85-92% American | **Moderate** (context) |
| Oxford comma | 85-98% consistent | 40-90% varies by genre | **Low-Moderate** |
| Smart quotes | Frequent (U+201C/D) | Context-dependent | **Low-Moderate** |
| Ellipsis | Unicode (U+2026) | Often ASCII (...) | **Low** |
| Overall consistency | Near-perfect | 8-15% variation | **Moderate** |

### Punctuation Portfolio Analysis

The **ratio between punctuation types** is more diagnostic than any single marker:

| Ratio | Human | AI | Signal Strength |
|-------|-------|-----|-----------------|
| Semicolon : Em-dash | 1:1 to 2:1 | 0.3:1 to 0.5:1 | **High** |
| Parenthesis : Em-dash | 1.5:1 to 3:1 | 0.5:1 to 1:1 | **Moderate** |

---

## Writer Agent Guidance

To avoid punctuation tells:

### Must Do
1. **Use semicolons** - AI underuses them significantly
2. **Use parentheses** for asides instead of em dashes
3. **Vary em dash density** - cluster them contextually, don't distribute uniformly
4. **Introduce 5-15% inconsistency** in Oxford comma usage (informal contexts)
5. **Mix period-quote placement** occasionally in non-technical writing

### Avoid
1. Em dash frequency >2.5 per 1000 words
2. Stacked em dashes ("X—though Y—suggests Z")
3. 100% Oxford comma consistency in casual writing
4. 100% period-inside-quote consistency
5. Zero punctuation errors in casual contexts

### Context Awareness
- Technical writing: Logical punctuation is fine
- Formal/edited: High consistency expected
- Casual/blog: Variation expected—exploit this
