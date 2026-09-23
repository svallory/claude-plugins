# Compound Words and Hyphenation Patterns

## Overview

AI models demonstrate reliable preference for hyphenated compound constructions, creating a subtle formality marker. This conservatism—hyphenating compounds that human writers would render as single words or separate tokens—is detectable through frequency analysis.

---

## Hyphenated Compound Overuse

### Pattern

AI shows elevated rates of hyphenated compounds where open or closed forms predominate in contemporary usage.

### Quantified Data

| Compound Pattern | Human Frequency (per 10,000 words) | AI Frequency (per 10,000 words) | Ratio |
|------------------|-----------------------------------|--------------------------------|-------|
| state-of-the-art | 2–5 | 15–35 | **5–7x** |
| cutting-edge | 3–8 | 20–45 | **5–6x** |
| world-class | 2–6 | 12–28 | **4–5x** |
| well-established | 8–15 | 35–60 | **3–4x** |
| deeply-rooted | 1–3 | 10–20 | **5–10x** |

*Note: These frequency ranges are estimated patterns observed in AI detection discussions. No verified primary source data available—treat as qualitative guidance only.*

### Why It Happens

- Training data composition: Formal, edited prose maintains conservative hyphenation
- AI reproduces formal patterns even in casual contexts where humans code-switch
- No style guide awareness for context-appropriate variation

---

## N-N Compound Elevation

### Pattern

AI overuses noun-noun compounds with hyphenation that function as "lexicalized evaluation markers."

### Common Elevated Compounds

| Compound | Function | AI Tendency |
|----------|----------|-------------|
| thought-provoking | Positive evaluation | Elevated |
| game-changing | Transformation claim | Elevated |
| ground-breaking | Innovation claim | Elevated |
| forward-thinking | Positive attribution | Elevated |
| results-driven | Business speak | Elevated |
| customer-centric | Business speak | Elevated |
| data-driven | Tech/business speak | Elevated |
| best-in-class | Superlative claim | Elevated |

These allow positive assessment through seemingly objective description—a rhetorical strategy that becomes detectable through repetition.

---

## Hyphenation Conservatism

### Pattern

AI hyphenates compounds that contemporary usage renders as open or closed.

### Examples

| AI Preference | Common Human Usage | Notes |
|---------------|-------------------|-------|
| decision-making | decision making | Open form increasingly common |
| well-known | well known (predicative) | Context-dependent in human usage |
| on-line | online | Closed form now standard |
| e-mail | email | Closed form now standard |
| web-site | website | Closed form now standard |

### Why This Matters

AI trained on older or more formal corpora maintains hyphenation conventions that have evolved in contemporary usage. This temporal mismatch creates subtle formality markers.

---

## Detection Approach

### Compound Density Analysis

```python
ELEVATED_COMPOUNDS = [
    'state-of-the-art', 'cutting-edge', 'world-class',
    'well-established', 'deeply-rooted', 'thought-provoking',
    'game-changing', 'ground-breaking', 'forward-thinking',
    'results-driven', 'customer-centric', 'data-driven',
    'best-in-class', 'high-quality', 'long-term', 'real-time'
]

def compound_density(text: str) -> float:
    """
    Calculate elevated compound density per 10,000 words.
    """
    text_lower = text.lower()
    word_count = len(text.split())

    compound_count = sum(
        text_lower.count(compound)
        for compound in ELEVATED_COMPOUNDS
    )

    return (compound_count / word_count) * 10000
```

### Thresholds

| Density (per 10K words) | Interpretation |
|-------------------------|----------------|
| < 5 | Human-typical |
| 5-15 | Ambiguous |
| > 15 | Potential AI signal |

---

## Context Considerations

### Where This Marker Works

- Blog posts and casual content
- Marketing copy
- General business writing

### Where This Marker Fails

- Technical documentation (compounds are standard)
- Academic writing (formal style expected)
- Business/consulting reports (jargon-heavy by nature)

---

## Reliability: **Low-Moderate**

- Not erroneous usage, just elevated concentration
- Context-dependent
- Best used as supporting signal, not primary marker

---

## Writer Agent Guidance

To avoid compound hyphenation tells:

1. **Vary compound forms**: Use "cutting edge" (open) alongside "cutting-edge"
2. **Use contemporary forms**: "email" not "e-mail", "online" not "on-line"
3. **Reduce density**: Don't cluster multiple elevated compounds
4. **Substitute alternatives**: "innovative" instead of "cutting-edge", "excellent" instead of "world-class"
5. **Match register**: Formal compounds in formal contexts only
