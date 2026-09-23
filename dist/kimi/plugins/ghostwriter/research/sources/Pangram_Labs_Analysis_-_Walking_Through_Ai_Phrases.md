---
title: "Pangram Labs Analysis - Walking Through Ai Phrases"
source: "https://www.pangram.com/blog/walking-through-ai-phrases"
summary: "AI language models tend to overuse specific phrases and words that can serve as indicators of AI-generated text. The article explores common AI phrases across three categories: self-referential phrases that acknowledge being AI (like 'As an AI language model'), overused phrases unrelated to AI identification (like 'as a poignant' or 'serves as a powerful reminder'), and explains how mode collapse and RLHF training contribute to this phenomenon, with different AI models developing their own distinct phrase preferences."
---

# Walking Through AI's Most Overused Phrases

By Elyas Masrour | February 21st, 2025

As we discussed last week, AI tends to overuse certain words and phrases. You may know a few of these off the top of your head: from "a testament to" to "delve." Seeing enough of these phrases can be solid indicators that a text you are dealing with is AI-generated, but there are far too many to keep track of for any one individual.

To solve this problem, we recently introduced a tool called **"AI phrases"**, where we specifically highlight these phrases. As part of our process building that tool, we built a large dataset of the most commonly used AI phrases. In this article, we'll walk you through some of the most common AI phrases that appear in our dataset and talk about how you can use them to sharpen your own intuition around AI-generated text.

## Part 1: AI Artifacts

We should start with the most obvious: sometimes an AI actually tells you it's an AI! Oftentimes, this happens as a result of a refusal. When a user has asked an AI something it has been instructed not to do, it has to tell the user that it cannot comply with the request, and as part of that, the model will often acknowledge that it is an AI. Many AI refusals begin with the phrase **"As an AI language model…"** It follows that this sort of phrase would be fairly common in AI text and extremely rare in human text. The numbers support this! Many of our most common AI phrases are self-referential.

| Phrase | Times More Common |
|--------|------------------|
| As an AI language model, | 294,000x |
| I do not have personal | 67,000x |
| Unfortunately, I do not have enough | 54,000x |
| language model, I can not | 53,000x |

## Part 2: Overused Phrases

AI artifacts are some of our "most overused" AI phrases, but ultimately are fairly obvious and therefore fairly uninteresting. Now we get to the interesting part: phrases that are indeed overrepresented in AI text but have nothing to do with "being an AI." Here are a couple:

| Phrase | Times More Common |
|--------|------------------|
| as a poignant | 49,000x |
| As a powerful reminder | 43,000x |
| reminder of the enduring | 31,000x |
| faced numerous challenges | 30,000x |
| Our results provide new insights into | 22,000x |
| into the complex interplay | 21,000x |
| serves as a powerful | 10,000x |
| providing valuable insights into | 5,000x |
| serves as a testament | 4,000x |
| newfound sense of purpose | 4,000x |
| even in the face of unimaginable | 3,000x |
| reminder of the potential | 3,000x |

## Part 3: Why Does AI Overuse Phrases?

It's easy to understand why an AI saying "As an AI..." may be much more common in AI text. But what causes the seemingly unrelated phrases in Part 2 to be more common? First of all, there's a phenomenon known as "mode collapse", where AI outputs become overly generic or repetitive by relying on high-probability word sequences.

Additionally, after training, it is standard practice to do RLHF: Reinforcement Learning from Human Feedback. During this process, human annotators rate AI-generated text based on a number of attributes to try to encourage some patterns and discourage others. Throughout this process, if certain answers or phrases are likely to be rewarded by these human annotators, they will become more and more frequent.

As a result, some of these overused phrases can be thought of as a characteristic of specific models, architectures, and training processes, rather than just hallmarks of AI writing itself. Research from Jenna Russell, Marzena Karpinska, and Mohit Iyyer at the University of Maryland shows that different models actually have different preferred phrases, suggesting that different models, trained with different datasets and optimization strategies, can develop their own distinct tendencies in phrase repetition.

## Bonus: Our Team's Favorite N-Grams

As part of our work, our team has spent incalculable hours reading and analyzing AI-generated text. Naturally, we've developed affinities for some of these phrases:

- **Max (CEO):** "In the ever-evolving" (11,000x)
- **Bradley (CTO):** "important to note" (3,000x)
- **Lu (Founding Engineer):** "intricate nature" (6,000x)
- **Elyas (Founding Engineer):** "vibrant tapestry" (17,000x)