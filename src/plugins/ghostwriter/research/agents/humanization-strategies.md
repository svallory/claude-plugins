# Humanization Strategies for Writer Agent

## Overview

This document provides actionable strategies for the Writer Agent to produce text that evades AI detection. The goal is to understand what TO do, not just what to avoid.

---

## Core Principles

### 1. Embrace Imperfection

Human writing is messy. Introduce:
- Sentence fragments (intentional)
- Minor grammatical liberties
- Varied formality levels
- Occasional colloquialisms

### 2. Create Rhythm Variation

**Target**: High burstiness (CV > 60, Fano > 1.5)

```
BAD (AI-like):
"The conference was informative. The speakers were knowledgeable.
The venue was appropriate. The networking was valuable."
[Lengths: 4, 4, 4, 4 - Uniform]

GOOD (Human-like):
"What a conference. The keynote speaker—brilliant, if a bit
long-winded—really made you think. Great venue, too."
[Lengths: 3, 17, 4 - Varied]
```

### 3. Inject Personality

Humans reveal personality through:
- Strong opinions
- Humor (even subtle)
- Personal references
- Emotional markers

---

## Sentence-Level Transformations

### Rule 1: Break Uniform Lengths

| AI Pattern | Human Alternative |
|------------|-------------------|
| 15-word sentence | 3-word punch, then 25-word elaboration |
| Consistent medium | Mix very short + very long |
| Always complete | Occasional fragment |

**Technique**: After every 2-3 normal sentences, insert either:
- A very short sentence (2-5 words): "It worked." "So there's that."
- A very long, winding sentence (30+ words)

### Rule 2: Disrupt Predictable Openings

| AI Opening | Human Alternative |
|------------|-------------------|
| "In today's digital age..." | "Here's the thing about digital—" |
| "It is important to note..." | "Look," / "Worth mentioning:" |
| "When it comes to X..." | "X?" / "About X—" |
| "In order to..." | "To..." |

### Rule 3: Vary Transition Density

AI uses too many transitions. Humans sometimes:
- Jump between ideas without warning
- Use informal connectors ("so," "but," "and")
- Omit transitions entirely

```
AI: "Furthermore, this suggests that consequently..."
Human: "Which means—yeah—we've got a problem."
```

### Rule 4: Add Parenthetical Asides

Humans think aloud:
```
"The results were surprising (honestly, I didn't expect them to hold up)."
"This approach works—most of the time, anyway."
```

### Rule 5: Use Contractions Naturally

Mix contractions and full forms unpredictably:
```
"I'm not sure it's the right approach. But I do not think we have better options."
```

Not: "I do not think it is the right approach" (AI formal) or "I don't think it's right" (uniformly casual).

---

## Vocabulary Transformations

### Replace AI Buzzwords

| AI Word | Human Alternatives |
|---------|-------------------|
| delve | dig into, look at, explore, examine |
| comprehensive | full, complete, thorough, detailed |
| crucial | key, important, essential, critical |
| leverage | use, apply, take advantage of |
| utilize | use |
| robust | strong, solid, reliable |
| meticulous | careful, detailed, thorough |
| tapestry | mix, blend, combination |
| realm | area, field, domain |
| harness | use, capture, channel |

### Add Colloquialisms (Sparingly)

- "kind of" / "sort of"
- "pretty much"
- "you know"
- "basically"
- "honestly"

### Use Specific Over Generic

```
AI: "Various studies have shown significant improvements."
Human: "Three studies from MIT showed 40% faster processing."
```

### Introduce Hedging Asymmetry

Humans hedge inconsistently:
```
"This definitely works. I think. Maybe not always, but usually."
```

Not the uniform AI hedging: "It appears that this may potentially work."

---

## Structural Transformations

### Break Tricolon Patterns

AI loves three-part structures. Break them:

```
AI: "This improves efficiency, reduces costs, and enhances quality."
Human: "This improves efficiency. Costs drop. And—bonus—quality goes up too."
```

Or use two items, or four:
- "Speed and accuracy improved."
- "We saw gains in speed, accuracy, user satisfaction, and surprisingly, retention."

### Disrupt Parallel Structure

```
AI: "The team analyzed data, developed models, and tested hypotheses."
Human: "The team dug through the data, built out some models, ran tests."
```

### Use Varied List Formats

Instead of always bullet points:
- Inline lists: "Three things matter: speed, cost, and ease of use."
- Numbered for some, dashed for others
- Occasional prose lists

### Create Paragraph Variance

| AI Pattern | Human Pattern |
|------------|--------------|
| 4-5 sentences per paragraph | Mix 1-sentence + 6-sentence paragraphs |
| Consistent length | Some dense, some sparse |
| Topic sentence always first | Sometimes delayed, sometimes implicit |

---

## Punctuation Strategies

### Em Dash Usage

GPT-4 overuses em dashes. Use sparingly, or substitute:

```
AI: "The solution—which we developed last year—works well."
Human: "The solution (developed last year) works well."
Or: "The solution, which we developed last year, works well."
```

### Semicolon Discipline

AI overuses semicolons. Humans:
- Often use periods instead
- Use "and" or "but"
- Sometimes use run-ons (stylistically)

### Smart Quotes & Unicode

Use straight quotes and simple dashes to avoid AI encoding fingerprints:
- `"quote"` not `"quote"`
- `--` or `-` not `—`
- `...` not `…`

---

## Content-Level Strategies

### Add Specificity

```
AI: "Many experts agree this is important."
Human: "Sarah Chen at Stanford called this 'the most important development since TCP/IP.'"
```

### Include Personal Perspective

```
AI: "The data suggests this approach is effective."
Human: "I've tried three other methods. This one actually works."
```

### Reference Concrete Details

```
AI: "Modern tools have improved productivity."
Human: "Our deploy time dropped from 45 minutes to under 3."
```

### Acknowledge Limitations/Uncertainty

```
AI: "This comprehensive approach addresses all aspects of the problem."
Human: "This covers most of it. Edge cases? Still working on those."
```

---

## Perplexity Manipulation

### Goal: Increase Perplexity

Higher perplexity = less predictable = more human-like.

**Techniques**:

1. **Unusual word choices**: Use less common synonyms occasionally
2. **Unexpected sentence openers**: Start with adverbs, interjections, or subordinate clauses
3. **Non-standard phrasing**: "The why of it matters more than the how"
4. **Domain mixing**: Bring in metaphors from unrelated fields

### Example Transformation

```
Low perplexity (AI):
"The algorithm processes data efficiently and produces accurate results."

Higher perplexity (Human):
"Efficient? Sure. The algorithm churns through data like my coffee maker
through beans—fast, but the real magic is the accuracy on the other end."
```

---

## Burstiness Manipulation

### Goal: Increase Variance

**Technique**: Sentence Length Cycling

```
Pattern: Short → Long → Medium → Very Short → Long

"Start simple. Then, because you need to establish credibility and
context for what comes next, you elaborate with all the relevant
details and supporting evidence your reader might need. Back to
normal length now. Done. Finally, wrap it all up with one more
substantial thought that ties everything together nicely."

Lengths: 2 → 29 → 6 → 1 → 14 = High variance
```

### Perplexity Spikes

Intentionally include 1-2 sentences per paragraph with unusual constructions:
- Questions
- Exclamations
- Fragments
- Unusual metaphors

---

## Anti-Patterns to Avoid

### DO NOT:

1. Use "delve," "tapestry," "comprehensive," "crucial" (GPT markers)
2. Start with "In today's [anything]"
3. Use "It's worth noting that" or "In light of this"
4. Create perfect parallel structures
5. Write uniform-length paragraphs
6. Over-qualify with "may," "might," "potentially," "appears to"
7. Use correlative conjunctions ("not only...but also")
8. End every section with a summary
9. Use consistent heading levels
10. Maintain perfectly formal or perfectly casual tone throughout

---

## Transformation Checklist

Before finalizing text, verify:

- [ ] Sentence lengths vary significantly (check CV > 50)
- [ ] No GPT vocabulary markers
- [ ] Mix of contractions and full forms
- [ ] At least one very short sentence per paragraph
- [ ] No "In today's..." or "It's important to note..." openings
- [ ] Personality/opinion visible
- [ ] Some specific details/examples (not generic)
- [ ] Transitions varied or occasionally omitted
- [ ] No perfect tricolon structures
- [ ] Paragraph lengths vary
- [ ] Straight quotes used (not smart quotes)
- [ ] Em dashes limited or replaced

---

## Example: Full Transformation

### AI Original

```
In today's rapidly evolving digital landscape, it is crucial for
organizations to leverage comprehensive data analytics solutions.
These robust tools enable teams to harness valuable insights, optimize
operations, and drive meaningful business outcomes. Furthermore, by
utilizing advanced machine learning algorithms, companies can unlock
new opportunities for growth and innovation.
```

### Humanized Version

```
Data analytics matters. A lot.

But here's what most "comprehensive solutions" miss: your team
actually has to use them. I've seen million-dollar platforms gather
dust because nobody could figure out the dashboard.

The tools that work? Simple. Fast. Maybe not the fanciest ML under
the hood, but they answer questions people actually ask.

Growth follows. Innovation too—eventually.
```

**Changes Made**:
- Removed GPT markers (comprehensive, robust, leverage, harness, utilize, furthermore)
- Added personality and opinion
- Created sentence length variation
- Used fragments
- Added specific observation (dashboard gathering dust)
- Broke parallel structure
- Informal transitions

---

## Sources

- [Grammarly AI Humanizer](https://www.grammarly.com/ai-humanizer)
- [QuillBot AI Humanizer](https://quillbot.com/ai-humanizer)
- [Netus AI Paraphraser](https://netus.ai/)
- [GPTZero Vocabulary Markers](https://gptzero.me/ai-vocabulary)
