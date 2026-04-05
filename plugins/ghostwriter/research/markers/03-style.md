# Stylistic Signatures

## Overview

AI exhibits distinctive vocabulary preferences, hedging patterns, and transition usage that create a recognizable "voice." The word "delve" has become the defining marker of AI writing.

---

## The "Delve" Phenomenon

### Statistics

- **25.2x frequency increase** for "delves" in academic writing post-ChatGPT
- The study of 14 million PubMed abstracts (2010–2024) found "delves" among the most dramatically elevated words
- 280 total excess style words identified in 2024

*Source: [Kobak et al. (2024) "Delving into ChatGPT usage in academic writing through excess vocabulary" (arXiv:2406.07016)](https://arxiv.org/abs/2406.07016)*

### Why "Delve"?

Likely overrepresented in RLHF training data. The word signals "thorough investigation" which AI uses to sound authoritative.

### Reliability: **Moderate-High**

Strong signal but awareness is spreading, may decrease.

---

## AI-Elevated Phrases

Common AI phrases flagged by detection guides (exact frequency multipliers not available from verified sources):

| Phrase/Word                          | Status |
| ------------------------------------ | ------ |
| "Play a significant role in shaping" | Elevated in AI text |
| "Notable works include"              | Elevated in AI text |
| "Today's fast-paced world"           | Elevated in AI text |
| "Aims to explore/enhance"            | Elevated in AI text |
| "Showcasing"                         | Elevated in AI text |

*Source: [Pangram Labs - Comprehensive Guide to Spotting AI Writing Patterns](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns) provides extensive lists of AI-elevated vocabulary.*

---

## AI-Overused Words

Words commonly flagged as AI markers in detection literature:

### High-Signal Words

- Delve, underscore, meticulous, commendable, showcase
- Intricate, tapestry, symphony, realm, cutting-edge
- Prowess, captivate, noteworthy, groundbreaking, unlock
- Leverage, notable, unveil, pivotal, bolster
- Holistic, elevate, unwavering, transformative, pioneer
- Embark, invaluable, testament, nuance, multifaceted

*Note: Specific frequency multipliers (e.g., ">100x human rate") are cited in various detection guides but cannot be verified from downloaded primary sources. [Pangram Labs](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns) provides extensive vocabulary lists. For verified phrase multipliers, see [Pangram Labs N-gram Analysis](https://www.pangram.com/blog/walking-through-ai-phrases) which documents extreme elevations for specific multi-word phrases.*

### Detection Implementation

```typescript
const aiVocabulary: Record<string, number> = {
  delve: 400,
  underscore: 200,
  meticulous: 150,
  tapestry: 147,
  intricate: 125,
  realm: 100,
  showcase: 100,
  pivotal: 80,
  leverage: 75,
  holistic: 50,
  // ... extend with full list
};

function vocabScore(text: string): number {
  const words = text.toLowerCase().split(/\W+/);
  let score = 0;
  for (const word of words) {
    if (aiVocabulary[word]) {
      score += aiVocabulary[word];
    }
  }
  return score / words.length; // normalized
}
```

---

## Hedging Language

### Pattern

AI writing exhibits consistent hedging that creates a risk-averse, non-committal tone.

### Common Hedging Phrases

- "It's important to note that..."
- "It's worth mentioning..."
- "It should be noted..."
- "Based on the information provided..."
- "Can vary depending on..."
- "It is crucial to understand..."
- "While this may be true..."
- "It's essential to consider..."

### Characteristic

AI is "very risk-averse to describing reality in black and white," using phrases like "Some marriages struggle..." rather than definitive statements.

### Detection

```typescript
const hedgingPhrases = [
  /it's (important|worth|essential) to (note|mention|consider)/i,
  /it should be noted/i,
  /based on the information provided/i,
  /can vary depending on/i,
  /while this may be true/i,
  /it's crucial to understand/i,
];

function hedgingScore(text: string): number {
  let count = 0;
  for (const pattern of hedgingPhrases) {
    const matches = text.match(new RegExp(pattern, "gi")) || [];
    count += matches.length;
  }
  return count;
}
```

### Reliability: **Moderate-High**

---

## Transition Word Overuse

### Pattern

AI dramatically overuses formal transitions:

- Furthermore
- Moreover
- Additionally
- Consequently
- Thus
- Subsequently
- Hence
- Therefore

### Key Indicator

Cambridge University research: paragraphs starting with single words like "However," followed by a comma = key AI indicator.

### Creates

An "essay-like" quality regardless of whether formal structure is appropriate.

### Detection

```typescript
const formalTransitions = [
  "furthermore",
  "moreover",
  "additionally",
  "consequently",
  "thus",
  "subsequently",
  "hence",
  "therefore",
  "nonetheless",
];

function transitionDensity(text: string): number {
  const paragraphs = text.split(/\n\n/);
  let transitionStarts = 0;

  for (const p of paragraphs) {
    const firstWord = p.trim().split(/\W/)[0].toLowerCase();
    if (formalTransitions.includes(firstWord)) {
      transitionStarts++;
    }
  }

  return transitionStarts / paragraphs.length;
}
```

### Reliability: **Moderate-High**

---

## Overly Formal Vocabulary

### Pattern

AI prefers formal alternatives where simpler words suffice:

| AI Prefers | Human Alternative |
| ---------- | ----------------- |
| utilize    | use               |
| leverage   | apply, use        |
| endeavor   | try               |
| facilitate | help              |
| implement  | do, start         |
| optimize   | improve           |
| prioritize | focus on          |
| streamline | simplify          |

### "Whimsical" Vocabulary

Words that feel purple or melodramatic:

- realm
- tapestry
- symphony
- labyrinth
- enigma
- odyssey
- mosaic
- beacon

### Detection

```typescript
const formalOveruse: Record<string, string> = {
  utilize: "use",
  leverage: "use",
  endeavor: "try",
  facilitate: "help",
  implement: "do",
  optimize: "improve",
};

function formalityScore(text: string): number {
  const words = text.toLowerCase().split(/\W+/);
  let formalCount = 0;
  for (const word of words) {
    if (formalOveruse[word]) formalCount++;
  }
  return (formalCount / words.length) * 100;
}
```

---

## Dramatically Underused Words (Human Markers)

Words AI uses **more than 100 times less often** than humans:

- yep
- ok / okay
- fucking (and other profanity)
- obviously
- blah
- um
- like (as filler)
- basically
- stuff
- things
- whatever

### Why

Safety training and formality bias remove casual/profane language.

---

## Summary Table

| Marker                     | Type       | Reliability   |
| -------------------------- | ---------- | ------------- |
| "Delve" + associated words | Vocabulary | Moderate-High |
| Hedging phrases            | Pattern    | Moderate-High |
| Transition overuse         | Pattern    | Moderate-High |
| Formal vocabulary          | Vocabulary | Moderate      |
| Missing casual words       | Vocabulary | Moderate      |
| "Whimsical" words          | Vocabulary | Moderate      |

---

## Writer Agent Guidance

To avoid stylistic tells:

1. Never use "delve," "underscore," "tapestry," "realm"
2. Replace formal words: utilize → use, leverage → apply
3. Reduce hedging - make direct statements
4. Use informal transitions: "But," "And," "So"
5. Include casual language appropriate to context
6. Occasionally use contractions and colloquialisms
7. Avoid adverb-heavy constructions
8. Use specific words over abstract ones
