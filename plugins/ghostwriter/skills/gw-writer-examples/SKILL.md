---
name: gw-writer-examples
description: Good vs bad examples for humanizing AI text. Load when the writer agent needs transformation examples.
user-invocable: false
---

# Writer Agent Examples

Quick reference for adversarial humanization. Good vs Bad examples for each transformation type.

---

## Sentence Length Variation

### Bad (AI-like — Uniform)
> The conference was informative. The speakers were knowledgeable. The venue was appropriate. The networking was valuable.

**Problem**: All sentences 4 words. Zero burstiness.

### Good (Human-like — Varied)
> What a conference. The keynote speaker—brilliant, if a bit long-winded—really made you think. Great venue, too.

**Why**: Lengths 3, 17, 4. High variance creates natural rhythm.

---

## Sentence Openings

### Bad (AI patterns)
- "In today's digital age..."
- "It is important to note that..."
- "When it comes to security..."
- "In order to achieve..."

### Good (Human alternatives)
- "Here's the thing about digital—"
- "Look," / "Worth mentioning:"
- "Security?" / "About security—"
- "To achieve..."

---

## Vocabulary: AI Buzzwords

### Bad (AI markers)
> The comprehensive solution leverages robust algorithms to delve into the crucial data, providing a meticulous analysis of this complex tapestry.

**Red flags**: delve, comprehensive, leverage, robust, meticulous, tapestry, crucial

### Good (Human alternatives)
> The solution uses solid algorithms to dig into the key data, giving you a detailed analysis of how everything fits together.

**Changes**: use (not leverage), solid (not robust), dig into (not delve), key (not crucial), detailed (not meticulous), how everything fits (not tapestry)

---

## Hedging & Confidence

### Bad (Over-hedged AI)
> It appears that this may potentially work in certain contexts, though it might possibly depend on various factors.

**Problem**: Every claim wrapped in uncertainty. Reads like legal boilerplate.

### Good (Asymmetric Human)
> This works. I think. Maybe not always, but usually.

**Why**: Confident claim followed by genuine uncertainty. Humans hedge inconsistently.

---

## Structural Patterns: Lists

### Bad (Perfect tricolon)
> This improves efficiency, reduces costs, and enhances quality.

**Problem**: AI loves three-part parallel structures.

### Good (Broken structure)
> This improves efficiency. Costs drop. And—bonus—quality goes up too.

**Or**: Use 2 or 4 items instead: "Speed and accuracy improved" or "We saw gains in speed, accuracy, retention, and user satisfaction."

---

## Transitions

### Bad (Over-formal)
> Furthermore, this suggests that consequently, the implementation should proceed. Moreover, it is evident that...

### Good (Natural connectors)
> Which means—yeah—we've got a problem. So here's what we do next.

**Technique**: Use informal connectors ("so," "but," "and"), or just jump between ideas.

---

## Parenthetical Asides

### Bad (Formal, no personality)
> The results were surprising and exceeded initial expectations based on prior research findings.

### Good (Think-aloud)
> The results were surprising (honestly, I didn't expect them to hold up). This approach works—most of the time, anyway.

**Technique**: Show your mental process. Humans think aloud when writing.

---

## Perplexity: Predictability

### Bad (Low perplexity)
> The algorithm processes data efficiently and produces accurate results.

**Problem**: Every word is exactly what you'd expect next. Too predictable.

### Good (Higher perplexity)
> Efficient? Sure. The algorithm churns through data like my coffee maker through beans—fast, but the real magic is the accuracy on the other end.

**Techniques**: Unusual metaphors, unexpected phrasing, domain mixing, questions.

---

## Paragraph Length

### Bad (Uniform 4-5 sentences)
> Each paragraph contains four or five sentences. They are all roughly the same length. This creates a monotonous rhythm. Readers start to tune out. AI loves this pattern.

### Good (Varied)
> Short punchy paragraph.

> Then a longer one with more detail, explanation, and breathing room. Maybe six or seven sentences that actually dig into something worth exploring. You can stretch it out when the idea needs it.

> Back to short.

---

## Punctuation: Em Dashes

### Bad (GPT-4 overuse)
> The solution—which we developed last year—works well. The team—including several experts—reviewed it. The results—surprisingly positive—exceeded expectations.

**Problem**: Em dashes everywhere. Classic GPT-4 fingerprint.

### Good (Varied)
> The solution (developed last year) works well. The team, including several experts, reviewed it. The results? Surprisingly positive—exceeded expectations.

**Technique**: Mix parentheses, commas, question marks. Use em dashes sparingly.

---

## Specificity vs Generics

### Bad (Vague)
> Various studies have shown significant improvements. Many experts agree this is important.

### Good (Concrete)
> Three studies from MIT showed 40% faster processing. Sarah Chen at Stanford called this "the most important development since TCP/IP."

**Technique**: Name names, cite numbers, reference real details.

---

## Personal Perspective

### Bad (Detached)
> The data suggests this approach is effective. Analysis indicates positive outcomes.

### Good (Personal)
> I've tried three other methods. This one actually works. Your mileage may vary, but in my experience, it holds up.

**Technique**: Use "I've," "we've," "in my experience." Show you were there.

---

## Acknowledging Limitations

### Bad (Overconfident)
> This comprehensive approach addresses all aspects of the problem and provides a complete solution for every scenario.

### Good (Honest)
> This covers most of it. Edge cases? Still working on those. But for 90% of what you'll encounter, it's solid.

**Technique**: Humans know their limits. Show yours.

---

## Contractions

### Bad (Uniformly formal)
> I do not think it is the right approach. We should not proceed without additional data.

### Bad (Uniformly casual)
> I don't think it's right. We shouldn't do it without more data.

### Good (Mixed)
> I'm not sure it's the right approach. But I do not think we have better options. We'll need to decide.

**Technique**: Mix contracted and full forms unpredictably.

---

## Full Transformation Example

### AI Original
> In today's rapidly evolving digital landscape, it is crucial for organizations to leverage comprehensive data analytics solutions. These robust tools enable teams to harness valuable insights, optimize operations, and drive meaningful business outcomes. Furthermore, by utilizing advanced machine learning algorithms, companies can unlock new opportunities for growth and innovation.

**Red flags**: "In today's," comprehensive, robust, leverage, harness, utilize, furthermore, tricolon structure, uniform sentences.

### Humanized Version
> Data analytics matters. A lot.

> But here's what most "comprehensive solutions" miss: your team actually has to use them. I've seen million-dollar platforms gather dust because nobody could figure out the dashboard.

> The tools that work? Simple. Fast. Maybe not the fanciest ML under the hood, but they answer questions people actually ask.

> Growth follows. Innovation too—eventually.

**Changes**:
- Removed all AI buzzwords
- Created sentence length variation (2, 2, 31, 16, 4)
- Added personality and opinion
- Used fragments intentionally
- Specific observation (dashboard gathering dust)
- Broke parallel structure
- Informal transitions
- Mixed punctuation styles

---

## Anti-Pattern Checklist

Before finalizing text, ensure you've avoided:

- [ ] "Delve," "tapestry," "comprehensive," "crucial," "leverage," "utilize"
- [ ] "In today's [anything]"
- [ ] "It's worth noting that" / "In light of this"
- [ ] Perfect three-part lists with parallel structure
- [ ] Uniform sentence/paragraph lengths
- [ ] Overuse of "may," "might," "potentially," "appears to"
- [ ] "Not only...but also" constructions
- [ ] Em dashes everywhere
- [ ] Smart quotes (use straight quotes: " not ")
- [ ] Perfectly consistent formality level

---

## Quick Quality Check

**High perplexity?** → Includes unusual phrasing, unexpected metaphors, varied structure
**High burstiness?** → Sentence lengths vary significantly (some 2-5 words, some 25+)
**Human voice?** → Personality visible, opinions present, limitations acknowledged
**Specific?** → Names, numbers, concrete details instead of generic claims

---

## Remember

Humans are messy, inconsistent, and occasionally break grammar rules on purpose. They mix formal and casual. They contradict themselves. They use fragments. They change topics without warning.

Your goal: write text that feels like a smart human had something to say and wrote it down—not text that was optimized to sound correct.
