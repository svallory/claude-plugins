# Narrative and Rhetorical Patterns

## Overview

AI follows predictable narrative formulas and rhetorical structures. These patterns are among the most reliable detection markers, especially conclusion formulas and the tricolon pattern.

---

## The Tricolon (Rule of Three)

### Pattern

AI structures ideas using threes with remarkable consistency:

- "I honed my skills in research, collaboration, and problem-solving."
- "It requires patience, dedication, and perseverance."
- "This approach is efficient, scalable, and maintainable."

### Why It's a Tell

One writing coach identifies this as "the one thing I notice constantly that ChatGPT does."

The pattern appears not just in lists but embedded in sentence structure throughout AI-generated content.

### Detection

```typescript
function tricolonCount(text: string): number {
  // Pattern: X, Y, and Z
  const tricolonPattern = /(\w+),\s*(\w+),?\s*(and|or)\s+(\w+)/gi;
  const matches = text.match(tricolonPattern) || [];
  return matches.length;
}
```

### Reliability: **High**

---

## The "It's not X — it's Y" Construction

### Pattern

This distinctive negation structure appears pervasively:

- "Falling in love isn't just about happiness — it's about intensity."
- "It's not just frustrating — it's insulting."
- "Learning is not just about acquiring knowledge — it's about growing."
- "It's not about the destination — it's about the journey."

### Combined Markers

Often paired with em dashes, making it doubly diagnostic.

### Detection

```typescript
const notXitsYPatterns = [
  /it's not (just )?about .+ — it's about/i,
  /is not (just )?.+ — (it's|it is)/i,
  /isn't (just )?.+ — it's/i,
  /not .+ but rather/i,
];

function detectNotXItsY(text: string): number {
  let count = 0;
  for (const pattern of notXitsYPatterns) {
    const matches = text.match(new RegExp(pattern, "gi")) || [];
    count += matches.length;
  }
  return count;
}
```

### Reliability: **High**

---

## Conclusion Formulas (Very High Reliability)

### Opening Phrases

- "In conclusion..."
- "Overall..."
- "In summary..."
- "To sum up..."
- "To summarize..."
- "In closing..."

### Structure Patterns

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
const conclusionMarkers = [
  /^In conclusion,?/im,
  /^In summary,?/im,
  /^To sum up,?/im,
  /^Overall,?/im,
  /^To summarize,?/im,
  /Whether you're .+ or .+, .+ offers/i,
  /Both sides present valid/i,
  /As (I|we) (progress|move forward|continue) (in|on)/i,
];

interface ConclusionAnalysis {
  hasFormulaicOpener: boolean;
  repetitionScore: number; // how much conclusion repeats body
  length: number; // relative to body paragraphs
}
```

### Reliability: **Very High**

One of the most consistent AI tells.

---

## Emotional Arc Flatness

### Pattern

MDPI research on archetypal storytelling found AI achieves:

- High scores (6.5-8.5) on narrative coherence
- Significantly lower scores on emotional complexity
- Significantly lower scores on lexical originality

### What AI Struggles With

- Subtle psychological depth
- Irony
- Multi-layered emotions
- Character transformation
- Symbolic richness

### Human Story Arcs

Human stories follow six core emotional arc patterns (Vonnegut/Reagan research):

1. **Rags to Riches** - rise
2. **Tragedy** - fall
3. **Man in a Hole** - fall then rise
4. **Icarus** - rise then fall
5. **Cinderella** - rise, fall, rise
6. **Oedipus** - fall, rise, fall

AI tends toward steady arcs rather than the dramatic rises and falls that captivate audiences.

### Detection

Requires sentiment analysis across narrative segments to measure emotional variance.

### Reliability: **Moderate-High** (for creative writing)

---

## Generic Examples

### Pattern

AI produces vague examples lacking specific details.

### Characteristics

- "Tries extremely hard to avoid proper nouns"
- When forced to use names, defaults to most common: **60-70% of names are either "Emily" or "Sarah"** (*Source: [Pangram Labs - Comprehensive Guide to Spotting AI Writing Patterns](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns)*)
- Descriptions "could be slotted in almost anywhere"
- Cannot relate writing to personal experiences "because it has no personal experiences"

### What's Missing

- Sensory details
- Personal anecdotes
- Real-world examples with specifics
- Cultural references
- Humor
- Unexpected tangents

### Detection

```typescript
function genericityScore(text: string): number {
  // Count proper nouns
  const properNouns = text.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g) || [];

  // Check for common AI default names
  const defaultNames = ["emily", "sarah", "john", "michael"];
  const namesUsed = properNouns.filter((n) =>
    defaultNames.includes(n.toLowerCase()),
  );

  // Count specific numbers/dates
  const specifics = text.match(/\b\d{4}\b|\$[\d,]+|\d+%/g) || [];

  // Low proper nouns + default names + few specifics = generic
  return {
    properNounDensity: properNouns.length / (text.split(/\s+/).length / 100),
    defaultNameRatio: namesUsed.length / Math.max(properNouns.length, 1),
    specificityScore: specifics.length / (text.split(/\s+/).length / 100),
  };
}
```

### Reliability: **Moderate-High**

---

## Metaphor Overuse

### Pattern

AI demonstrates preference for certain metaphorical words and phrases.

### Common AI Metaphor Phrases

- "weaving together"
- "rich tapestry of"
- "intricate dance"
- "symphony of"
- "mosaic of experiences"
- "beacon of hope"

*Note: Words like "tapestry," "intricate," "camaraderie," and "palpable" are frequently cited as AI markers in detection literature. Specific frequency multipliers cannot be verified from downloaded sources. See [Pangram Labs](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns) for qualitative vocabulary lists.*

### Reliability: **Moderate-High**

---

## Controversy Avoidance

### Pattern

AI systematically avoids controversy:

- Presents "both sides" equally
- Produces sanitized analysis
- Avoids taking positions
- Uses excessive qualification

### Missing from AI Text

Profanity usage comparison:

- GPT models use obscenities "more than 100 times less often" than humans
- Words like "fucking," "shit," "damn" nearly absent

### Reliability: **High** (for opinion/editorial content)

---

## Summary Table

| Pattern                  | Context           | Reliability   |
| ------------------------ | ----------------- | ------------- |
| Tricolon (rule of three) | All content       | High          |
| "It's not X — it's Y"    | All content       | High          |
| Conclusion formulas      | All content       | Very High     |
| Emotional arc flatness   | Creative writing  | Moderate-High |
| Generic examples         | All content       | Moderate-High |
| Metaphor overuse         | All content       | Moderate-High |
| Controversy avoidance    | Opinion/editorial | High          |

---

## Writer Agent Guidance

To avoid narrative tells:

1. Vary list lengths (2, 4, 5 items - not always 3)
2. Avoid "It's not X — it's Y" construction entirely
3. End without formal conclusion - stop mid-thought or with question
4. Include specific names, dates, places, numbers
5. Use unexpected/unusual examples
6. Take clear positions on topics when appropriate
7. Include emotional peaks and valleys in narratives
8. Add digressions, tangents, personal asides
9. Use humor, irony, sarcasm where appropriate
