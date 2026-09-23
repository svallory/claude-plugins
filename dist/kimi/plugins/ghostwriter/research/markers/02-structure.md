# Structural Patterns

## Overview

AI-generated text exhibits measurable structural uniformity. These patterns are among the most reliable detection markers, especially paragraph uniformity and formulaic openings/closings.

---

## Paragraph Uniformity

### Pattern

AI "balances paragraphs, structuring them nearly identical in length" while humans "focus on informational flow and storytelling narrative."

### Measurable Differences

| Metric                      | Human    | AI      |
| --------------------------- | -------- | ------- |
| Fano Factor (variance/mean) | Higher   | Lower   |
| Paragraph length std dev    | High     | Low     |
| Section length consistency  | Variable | Uniform |

### Research Finding

2025 MDPI study: AI-generated essays exhibited "a high degree of structural uniformity" with "identical introductions to concluding sections across all ChatGPT essays."

### Detection Method

```typescript
function paragraphUniformity(text: string): number {
  const paragraphs = text.split(/\n\n+/);
  const lengths = paragraphs.map((p) => p.length);
  const mean = lengths.reduce((a, b) => a + b) / lengths.length;
  const variance =
    lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length;
  return variance / mean; // Fano factor - lower = more AI-like
}
```

### Reliability: **Moderate-High**

---

## Bullet Points and Lists

### Pattern

LLMs default to list formatting even when not explicitly requested.

"Bullet points are everywhere in GPT-generated content. Whether you're asking for a summary, a comparison, or even creative writing, the AI often resorts to structured formats."

### Characteristics

- Lists appear in contexts where prose would be more natural
- 3-5 items is most common
- Nested lists with consistent indentation
- Parallel grammatical structure across items

### Detection

```typescript
function bulletDensity(text: string): number {
  const bulletPatterns = /^[\s]*[-*•]\s|^\d+\.\s/gm;
  const matches = text.match(bulletPatterns) || [];
  const wordCount = text.split(/\s+/).length;
  return matches.length / (wordCount / 100); // bullets per 100 words
}
```

### Reliability: **High**

---

## Heading Hierarchy

### Pattern

AI follows rigid hierarchical document organization:

- H1 → H2 → H3 cascading logically
- Predictable internal structure
- Section titles follow naming conventions

### Blog Post Template (AI Default)

1. Catchy opening question
2. Brief introduction
3. 3-5 subheaded sections
4. Bullet points for takeaways
5. Conclusion with call-to-action

### Reliability: **High**

---

## Opening Formulas

### Common AI Opening Phrases

| Phrase                                           | Notes |
| ------------------------------------------------ | ----- |
| "In today's [fast-paced/competitive/digital]..." | Commonly flagged in AI detection guides |
| "In an era where..."                             | Elevated in AI text |
| "Have you ever wondered..."                      | Elevated in AI text |
| "[Topic] is one of the most [superlative]..."    | Elevated in AI text |
| "In the realm of..."                             | Elevated in AI text |
| "When it comes to..."                            | Elevated in AI text |

*Note: Specific frequency multipliers not available from verified sources. These patterns are qualitatively documented in [The Algorithmic Bridge](https://thealgorithmicbridge.substack.com/p/10-signs-of-ai-writing-that-will) and [Pangram Labs](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns) detection guides.*

### Detection

```typescript
const openingFormulas = [
  /^In today's (fast-paced|competitive|digital|modern)/i,
  /^In an era where/i,
  /^Have you ever wondered/i,
  /^In the realm of/i,
  /^When it comes to/i,
  /is one of the most (important|significant|crucial)/i,
];

function detectOpeningFormula(text: string): boolean {
  const firstParagraph = text.split(/\n\n/)[0];
  return openingFormulas.some((regex) => regex.test(firstParagraph));
}
```

### Reliability: **High**

---

## Closing Formulas

### Common AI Closing Patterns

**Openers:**

- "In conclusion..."
- "In summary..."
- "Overall..."
- "To sum up..."

**Structures:**

- "Whether you're X or Y, [topic] offers..."
- Balanced neutral: "Both sides present valid points"
- "By [implementing X], your [subject] [will/can]..."
- Reflection: "As I progress in my journey, I will continue to embrace these values."

### Characteristics

- AI conclusions are "often very long" compared to human writing
- "Repeat most of what was already written"
- Same point restated "three ways in one paragraph"

### Detection

```typescript
const closingFormulas = [
  /In conclusion,?/i,
  /In summary,?/i,
  /To sum up,?/i,
  /Whether you're .+ or .+, .+ offers/i,
  /Both sides present valid/i,
  /As (I|we) (progress|move forward|continue)/i,
];

function detectClosingFormula(text: string): boolean {
  const paragraphs = text.split(/\n\n/);
  const lastParagraph = paragraphs[paragraphs.length - 1];
  return closingFormulas.some((regex) => regex.test(lastParagraph));
}
```

### Reliability: **Very High**

One of the most consistent AI tells.

---

## Introduction-Body-Conclusion Rigidity

### Pattern

AI rigidly adheres to three-part document structure regardless of content type:

- Sequential transitions ("Firstly...secondly...finally")
- Topic sentences at paragraph starts
- Parallel structure between sections
- Similar-length body paragraphs

### Human Variation (Missing in AI)

- Front-loaded conclusions
- Circular structures
- Digressions and tangents
- Abandonment of formal organization when appropriate
- Varying emphasis across sections

### Reliability: **High**

---

## Summary Table

| Pattern                    | Detection Method        | Reliability   |
| -------------------------- | ----------------------- | ------------- |
| Paragraph uniformity       | Fano factor calculation | Moderate-High |
| Bullet point overuse       | Bullet density ratio    | High          |
| Heading hierarchy          | Template matching       | High          |
| Opening formulas           | Regex matching          | High          |
| Closing formulas           | Regex matching          | Very High     |
| Rigid structure            | Structural analysis     | High          |
| Consistent section lengths | Variance calculation    | High          |

---

## Writer Agent Guidance

To avoid structural tells:

1. Vary paragraph lengths intentionally (some very short, some long)
2. Use prose instead of bullet points when possible
3. Avoid "In today's...", "In conclusion..." formulas
4. Skip the formal introduction occasionally
5. End mid-thought or with a question rather than summary
6. Include digressions and tangential thoughts
7. Break hierarchical heading patterns
8. Make some sections much longer/shorter than others
