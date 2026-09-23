---
title: "ResearchLeap Analysis - The Disappearing Author Linguistic And Cognitive Markers Of Ai Generated Communication"
source: "https://researchleap.com/the-disappearing-author-linguistic-and-cognitive-markers-of-ai-generated-communication/"
summary: "This article introduces VERMILLION, a ten-signal heuristic framework for detecting AI-generated text through stylometric and linguistic analysis. By examining markers such as vague pronouns, rigid transitions, mechanical punctuation, and absent personal voice, the framework provides an interpretable alternative to black-box detectors. Applied to the White House MAHA Report, VERMILLION identifies substantial AI involvement, while the authors propose disclosure practices, pedagogical applications, and revision strategies to promote responsible authorship in the age of generative AI."
---

# The Disappearing Author: Linguistic and Cognitive Markers of AI-Generated Communication

**Journal of Entrepreneurship and Business Development**, Volume 5, Issue 1, November 2025, Pages 7-25

**DOI:** 10.18775/ijmsba.1849-5664-5419.2014.51.7001

**Author:** Suresh Sood, Industry/Professional Fellow, Australian Artificial Intelligence Institute, University of Technology Sydney

## Abstract

As generative AI permeates professional, educational, and policy communication, distinguishing human from machine-authored text is increasingly consequential for assessment, accountability, and trust. This paper introduces VERMILLION, a ten-signal heuristic framework grounded in stylometry, cognitive linguistics, and AI interpretability, applied to the White House Make America Healthy Again (MAHA) policy report. Paragraph-level annotation reveals recurrent markers consistent with LLM outputs (e.g., echoed sentence structures, rigid transitions, hedging, and absent lived experience), suggesting substantial AI involvement. The paper positions VERMILLION relative to statistical detectors and proposes disclosure practices for responsible authorship.

**Keywords:** AI-generated writing, professional writing, forensic linguistics, machine authorship, computational linguistics, authorship transparency, linguistic markers, heuristic detection, policy document analysis, Large Language Models (LLMs), AI-generated communication

---

## 1. Introduction — Why Authorship Matters

As generative AI becomes more deeply embedded in our communication systems, the ability to differentiate between human and machine-authored text is no longer just technical curiosity but a necessity. Authorship—whether human or machine—touches on the very foundations of trust, authenticity, and intellectual development.

Nowhere is this more apparent than in education. The integrity of academic assessment hinges on knowing who or what authors a piece of work. When students rely on large language models to generate essays or reports, they unconsciously bypass the cognitive challenges fostering learning. Writing is not merely a vehicle for communication but a process for embracing forms of reasoning, synthesis, and personal insight. Without authentic engagement, developing core skills of critical thinking, argumentation, and expression diminish over repeated use of GenAI.

Yet, the implications reach far beyond the classroom. In public domains like policy, journalism, and science, authorship carries weight implying accountability, credibility, and human judgment. Text produced by AI, even when factually correct, may lack context, nuance, or the capacity to interpret ambiguity. Transparency about the use of AI in these contexts is essential not to penalize the usage, but to preserve trust in the human voices behind institutions and decisions.

This concern over voice and responsibility underscores a deeper ethical issue. AI cannot be held morally or legally accountable for the words generated. When automated systems produce misleading or harmful content, assigning responsibility becomes murky—especially important in areas of healthcare, law, or politics. The absence of human attribution raises troubling questions about bias, consent, and misrepresentation.

At the heart of this responsibility lies something profoundly human. Our language and writing reflects memory, culture, emotion, and lived experience. These are elements AI can mimic but not originate. The homogenized outputs of language models often feel polished but empty, missing the quirks, interruptions, and textures marking a genuine voice. To defend the value of human expression, we must learn to recognize the absence.

There is now a newfound sense of urgency. The ease with which AI can now generate persuasive, coherent, and syntactically flawless text poses new risks in the spread of disinformation. In moments of crisis during elections, pandemics, or conflict, generative capability can be weaponized. Tools for identifying machine authorship thus become vital safeguards in an age of algorithmic persuasion.

Distinguishing between human and machine writing is not simply about style—it is about responsibility, authenticity, and the kind of communicative world we desire to build. If we lose sight of the human author, we risk losing more than just the writer; we risk losing the reader.

In light of these challenges, the question becomes not only why authorship matters, but also how we can reliably tell who or what is doing the writing. The subtle erosion of human voice, intentionality, and stylistic variation in AI-generated text often evades detection by casual readers. As AI tools grow more advanced and outputs more polished, identifying linguistic fingerprints becomes both more urgent and complex. This necessitates a systematic approach, one that moves beyond gut feeling and toward a principled framework for detection.

### 1.1 Related Work

Across decades of work, stylometry has shown that an author's "fingerprints" live in small, often unconscious choices of function words, character n-grams, and recurrent syntactic patterns modeled to attribute or verify authorship. In the era of neural networks, complementary detectors mine statistical signatures of generated text: Giant Language Model Test Room (GLTR) visualizes token-probability profiles to surface stretches of unusually low surprisal typical of machine outputs, while DetectGPT leverages probability curvature under perturbations to enable zero-shot detection. Model-side watermarking aims to embed provenance directly into generated text, though important trade-offs remain around robustness and vulnerability to adversarial removal.

Human readers are poor judges of fluent machine prose, especially after light editing or paraphrasing, further minimizing unaided detection accuracy. Taken together, these strands motivate an interpretable, heuristic layer such as VERMILLION to sit alongside statistical detectors and disclosure practices, offering transparent cues capable of being audited and triangulated.

---

## 2. Tell-Tale Signs of AI Writing: VERMILLION Heuristic Framework

The VERMILLION ten cues align with well-established dimensions of writing style studied in stylometry and discourse analysis: lexical choice, syntax, punctuation, structural layout, and metadiscourse. Large-scale authorship research shows that style is recoverable from these levels, and that combining levels improves attribution robustness.

### The Ten VERMILLION Signals

1. **V — Vague 'Their' (Ambiguous Referents)**
   - Pronoun interpretation is tightly coupled to local discourse coherence; ambiguous referents increase processing difficulty and signal weak coherence planning. Texts that repeatedly leave 'they/their' unanchored to salient discourse entities exhibit coherence lapses that VERMILLION flags.

2. **E — Echoed Sentence Structures (Template Reuse)**
   - Neural text generators can produce bland, repetitive phrasing without careful decoding. Over-regular templating across adjacent sentences lowers human-like variation. VERMILLION targets local repetition and overuse of stock frames.

3. **R — Rigid Transitions and Canned Connectives**
   - Metadiscourse resources of connectors, frame markers, and stance devices organize text and project authorial engagement. Uniform, formulaic transitions at fixed intervals are atypical of expert human style and thus diagnostic.

4. **M — Mechanical Punctuation and Rhythm**
   - Punctuation patterns are distinctive style carriers usable for attribution. VERMILLION attends to overly uniform punctuation rhythms or avoidance of expressive marks.

5. **I — Inflexible Paragraphing and Layout**
   - Structural features—paragraph counts and average sentence/paragraph lengths—encode stable aspects of style and improve attribution. VERMILLION treats highly uniform paragraph blocks as a weak-signal heuristic.

6. **L — Lack of Short, Emphatic Paragraphs**
   - Human-authored expository writing typically mixes paragraph lengths for rhetorical effect. Flat distributions can indicate templated generation.

7. **L — Lack of Personal Voice / Authorial Presence**
   - Authorial identity and the strategic use (or avoidance) of first-person reference are central to credibility and stance. Persistent impersonality where disciplinary norms permit self-mention suggests machine assistance.

8. **I — Imprecise Abstraction and Nominalizations**
   - Overreliance on complex noun phrases and nominalizations reduces clarity and specificity. VERMILLION flags cascades of abstract nouns that mask agency and evidence chains.

9. **O — Overuse of Hedging**
   - Hedging is a legitimate resource for epistemic caution and varies by register. Excessive or patterned hedging contributes to the overall signal.

10. **N — No Lived Experience or Concrete Provenance**
    - Absence of experiential anchors (where genre permits) can support a machine-assistance hypothesis when co-occurring with other cues.

---

## 3. Methodology: Applying the VERMILLION Framework

The VERMILLION framework emphasizes human interpretability and textual transparency, allowing for qualitative analysis based on well-established linguistic indicators. While no single sign is conclusive, the co-occurrence of multiple VERMILLION features within a document significantly strengthens the inference of AI assistance or authorship.

### Dictionary of Heuristics for AI-Generated Writing

| Heuristic | Definition | Detection Tip |
|-----------|-----------|---------------|
| V – Vague "Their" Usage | Frequent third-person possessives without a clear noun antecedent | Search for "their" and check if the noun it refers to is clear |
| E – Echoed Sentence Structures | Sentences that follow the same rhythm and length | Read aloud for "drumbeat" cadence; similar lengths signal AI templating |
| R – Rigid Transitions | Use of generic connectors like "Moreover," "Furthermore," "In conclusion" | Scan paragraph starts for stock transitions; consistency suggests automation |
| M – Mechanical Punctuation | Excessive em dashes that interrupt sentence flow | Count em dashes (—); if frequent and awkward, flag for revision |
| I – Inflexible Paragraphing | Paragraphs follow uniform length or pacing without natural variation | Highlight paragraph lengths; if most are the same, flag for review |
| L – Lack of Short Paragraphs | No use of one-line paragraphs for emphasis or pacing | Search for 1-line paragraphs; if none, flag as non-human rhythm control |
| L – Lack of Personal Voice | Text lacks subjective tone, emotional cues, or anecdotal elements | Ask: "Could this have been written by anyone?" If yes, flag personal voice |
| I – Imbalanced Apostrophes | Overuse or uniform use of contractions | Count contractions; overly balanced usage may signal unnatural stylization |
| O – Overuse of Em Dashes | Em dashes used mid-sentence to simulate dramatic pauses | Count em dashes; if frequent and awkward, revise or replace |
| N – Nominalizations | Excessive use of noun forms that obscure who is doing what | Replace with active verbs |

### Manual Application: Guided Forensic Reading

1. Print or display the heuristics table alongside the document under review
2. Read paragraph-by-paragraph, annotating each with potential heuristic markers
3. Tally and cluster markers, noting how many signs appear per section
4. Apply judgment with caution: accumulation of stylistic and structural signs over a long passage provides pattern-based justification for suspicion

### Automated Application: NLP Integration

1. **Tokenization and POS Tagging:** Use NLP libraries to segment text and apply part-of-speech tagging
2. **Rule-Based Flags:** Implement detection rules (e.g., if >30% of sentences begin with the same 3 transition words, flag for Mechanical Transitions)
3. **Score Accumulation and Thresholding:** Score each heuristic 0–1 and sum to create a VERMILLION Score; use thresholds to suggest probable AI authorship
4. **Hybrid AI-Human Workflow:** Use detection as pre-screening; documents with high VERMILLION scores are reviewed manually

---

## 4. Analysis and Key Findings Using VERMILLION Framework

The White House Make America Healthy Again (MAHA) Report was systematically reviewed using the framework. The MAHA Report was selected due to public scrutiny concerning factual inaccuracies and questionable citations. Multiple media outlets report the White House acknowledges errors in the report, including references to non-existent studies and misattributions related to vaccine and chronic illness research.

Given the policy significance of the report originating from the Executive Office of the President and its intended role in shaping national health strategy, we would not typically expect AI-generated content, which raises further concerns regarding the production process. The combination of factual missteps, bureaucratic authorship, and stylistic anomalies make the MAHA Report an ideal candidate for evaluating VERMILLION's efficacy.

### MAHA Report Key Findings

**V — Vague Use of "Their"**
- The report frequently uses "their efforts," "their health," and "their communities" without clear antecedents
- Example pages: 54, 63, 67 lack subject clarity
- Implication: AI-generated tendency to generalize audiences without specifying actors

**E — Echoed Sentence Structures (Repetitive Syntax)**
- Multiple paragraphs exhibit uniform clause length and mirror grammatical rhythm
- Example (Page 46, ¶3): "An analysis of a common pesticide... An analysis of 115 studies..."
- Implication: Drumbeat pacing reflects template-based generation common in LLMs

**R — Rigid/Mechanical Transitions**
- Transitional phrases such as "Moreover," "In addition," and "It is important to note that" are overused, especially at paragraph openings
- Example (Page 9, ¶1): Begins with "Furthermore," followed by sequences of "Moreover" and "In conclusion"
- Implication: Reliance on generic cohesion strategies common to LLMs

**M — Mid-Sentence Dash Overload**
- Notable use of em dashes for interruption where commas or full stops serve better
- Example (Page 6, ¶2): "The strategy — while ambitious — was necessary"
- Implication: Stylistic quirk found in AI-authored text attempting emphasis

**I — Indecisive Hedging**
- Frequent use of qualifiers like "may," "could," "possibly," and "arguably," avoiding commitment
- Example (Page 8, ¶1): "This may suggest a pathway to improvement..."
- Implication: AI systems hedge statements to minimize error or liability

**L — Lingo-Heavy Buzzword Flood**
- Corporate and bureaucratic buzzwords present throughout without concrete explanation
- Examples: "Data-driven outcomes," "cross-sector synergy," "impactful interventions"
- Implication: AI tends to inflate language for authority without added meaning

**L — Lack of Paragraph Variability**
- Paragraphs across the report are consistently 3–5 lines long, regardless of subject complexity
- Implication: Human reports typically show more natural variation reflecting rhetorical pacing

**I — Infrequent Short Paragraphs**
- Punchy, one-line paragraphs—which human writers often use for emphasis—are almost entirely absent
- Implication: Text lacks cadence variation, contributing to monotony

**O — Overuse of Apostrophes (Contractions)**
- Extensive use of contractions like "it's," "we've," "they're" uniformly applied
- Example (Page 5, ¶3): "It's clear that we've made progress"
- Implication: AI-generated text sometimes inserts contractions uniformly

**N — No Personal Voice or Lived Experience**
- Report lacks anecdotes, quotes, or grounded human experiences
- Even when discussing community health interventions, no personal stories are included
- Implication: Absence of emotional grounding typical of LLM outputs

### Summary of Findings

Taken individually, none of the signs offer definitive proof of AI authorship. However, their accumulation and repetition across the entire document strongly suggest the involvement of generative AI tools. The report exhibits nearly every marker in the VERMILLION framework with moderate to high frequency, including structural rigidity, vague referents, hedging, and impersonal tone. The language lacks the spontaneous irregularity, anecdotal inclusion, and rhetorical nuance found in human-authored professional communication.

---

## 5. Future Possibilities

### 5.1 Toward a Scalable Detection System

As the volume of machine-generated content increases, scalable and systematic detection becomes urgent. The structured, checklist nature of VERMILLION makes it suitable for computational implementation. Future research may translate the VERMILLION indicators into NLP features, enabling semi-automated screening of documents at scale. Such systems could flag passages matching known AI writing patterns and support human reviewers with visual dashboards showing frequency and clustering of linguistic cues.

### 5.2 Disclosure Protocols and AI Authorship Policy

The findings underscore the importance of transparent authorship attribution, particularly in public-facing policy documents. If generative AI models such as GPT-4 are used in report drafting, this involvement should be clearly disclosed. Institutions including governments, universities, and think tanks should develop AI authorship disclosure protocols, similar to citation standards in academic research.

**Example AI Authorship Disclosure:**

> Portions of this report were drafted using the assistance of the GPT-4 language model developed by OpenAI. The AI was employed to generate initial drafts of sections 2 and 4, provide structural suggestions, and summarize background literature. All AI-generated content was subsequently reviewed, edited, and validated by the human authors to ensure accuracy, appropriateness, and adherence to disciplinary standards. The authors accept full responsibility for the final content.

### 5.3 Curriculum Design and Pedagogical Applications

The VERMILLION framework holds pedagogical value. Educators can use it to help students develop critical literacy skills by analyzing how AI-generated text differs from human-authored prose. Assignments might include comparing documents, rewriting AI passages to restore human voice, or conducting VERMILLION-guided assessments of peer work. Instructors can also use the checklist to identify overreliance on generative tools and initiate conversations about authorship, originality, and ethical writing practices.

### 5.4 AI Writing Assistants with Human in the Loop Feedback

By embedding stylistic detectors based on VERMILLION indicators, AI platforms could highlight when a draft appears overly mechanical, hedged, or impersonal, offering writers the option to revise or "humanize" their outputs. This encourages more thoughtful co-creation, where users remain aware of the stylistic and ethical implications of outsourcing authorship.

### 5.5 AI Cross-Disciplinary Research Opportunities

The intersectional nature of VERMILLION, drawing on cognitive psychology, computational linguistics, and AI interpretability, invites collaboration across fields. Scholars in behavioral economics, media studies, forensic linguistics, and computer science may apply the model to explore deeper questions about how AI alters rhetorical structure, what biases persist in machine-generated narratives, and whether humans can detect synthetic authorship unaided.

### 5.6 From Detection to Revision: Humanizing AI-Generated Text

Detecting AI-authored writing provides a diagnostic lens, but true value lies in the next steps. Once tell-tale signs are identified, writers, educators, and editors need practical tools for transformation.

### Heuristics for Humanizing AI-Generated Writing

| Tell-Tale Sign | Humanizing Heuristic | AI Generated | Humanized |
|---|---|---|---|
| Dash Overload | Replace em dashes with commas, periods, or ellipses | "The policy—despite criticism—was implemented swiftly." | "The policy, despite criticism, was implemented swiftly." |
| Repetitive Sentence Structure | Vary sentence length and openers | "It was tested. It was revised. It was implemented." | "After testing and revision, the team finally implemented it." |
| Mechanical Transitions | Drop or revise formulaic openers | "Moreover, the findings were consistent." | "The findings held steady—adding weight to the earlier results." |
| Vague Use of "Their" | Replace vague pronouns with specific nouns | "Their decision was unexpected." | "The board's decision was unexpected." |
| No Short Paragraphs | Insert punchy 1-line paragraphs for impact | (Wall of text) | "That was the turning point." |
| Uniform Paragraph Size | Break up content with variable-length paragraphs | (All ~3–4 lines) | Mix longer analysis with brief interjections |
| Buzzword Flood | Swap vague terms with concrete words | "The cutting-edge initiative aimed to leverage synergy." | "The pilot project aimed to connect teams through shared goals." |
| Heavy Hedging | Reduce "could," "might," "potentially" | "This might suggest a possible impact." | "This suggests a clear impact." |
| Overuse of Apostrophes | Remove excessive contractions | "It's clear. We're sure. You'll see." | "It is clear. We are confident. You will see." |
| No Personal Voice | Add anecdotes, questions, or opinions | "The event was well received." | "I remember the applause—it echoed long after the final speech." |
| Lack of Lived Experience | Add sensory details or emotional observations | "Attendees enjoyed the session." | "Many attendees smiled, nodding through the speaker's story." |

### 5.7 Temporal Erosion of Detectability

Detection power weakens over time for two reasons:

1. **Revision/Humanization:** Each editorial pass by a person or a "humanizer" paraphraser tends to smooth the very surface cues that VERMILLION flags. Paraphrasing specifically degrades detector accuracy.

2. **Model Version Drift:** As newer models are released, their default style shifts toward more human-like conventions, reducing distinctiveness in punctuation regularities and transitional habits.

**Practical Recommendation:** When provenance matters, archive and timestamp the earliest public draft and direct VERMILLION assessment to that first-available version; treat later revisions as progressively harder to attribute.

---

## 6. Limitations and Discussion

Our analysis is probabilistic and heuristic rather than definitive. Genre conventions (e.g., policy prose), copy-editing processes, and paraphrasing tools can attenuate or erase surface cues. VERMILLION should be used in conjunction with statistical detectors and transparent disclosure practices; no single method suffices in isolation.

The heuristics for humanizing text are not just cosmetic—they restore human rhythm, agency, and emotion to otherwise mechanical prose. By embedding variation, context, and reflection, revised texts move beyond the flatness of AI outputs and regain the literary and cognitive qualities defining human writing. In educational contexts, such revision strategies offer a powerful bridge to guide students from passive consumption of AI outputs toward conscious, ethical, and expressive authorship.

---

## 7. Conclusion: Toward Responsible Authorship in the Age of AI

As generative AI tools increasingly mediate the creation of professional, academic, and policy documents, the distinction between human and machine authorship has become both technically and ethically urgent. This article introduces the VERMILLION framework, an interpretive, heuristic method for identifying linguistic and cognitive markers typical of AI-generated text.

Through detailed application to the MAHA Report, we demonstrate how specific stylistic indicators such as mechanical transitions, repetitive structure, hedging, and absence of personal voice can cumulatively signal probable AI involvement.

Importantly, this approach does not aim to vilify AI authorship but to encourage transparency, accountability, and informed critique. As the boundaries of collaboration between humans and machines continue to blur, the responsibility lies with writers, educators, publishers, and policymakers to establish norms that preserve clarity about authorship. Detection frameworks like VERMILLION can be integrated into editorial review processes, educational curricula, and AI-assisted writing platforms to maintain epistemic trust and safeguard human originality.

---

## References

- Abbasi, A., & Chen, H. (2008). Writeprints: A stylometric approach to identity-level identification and similarity detection in cyberspace. *ACM Transactions on Information Systems*, 26(2), Article 7.
- Al Jazeera. (2025, May 30). White House to amend flagship health report citing phantom studies. https://www.aljazeera.com/news/2025/5/30/white-house-to-amend-flagship-health-report-citing-phantom-studies
- Associated Press. (2025, May 30). White House acknowledges problems in RFK Jr.'s 'Make America Healthy Again' report. https://apnews.com/article/maha-report-errors-rfk-health-studies-f382af8552dbc1729329a13e58f1f3c4
- Bao, G., Zhao, Y., Teng, Z., Yang, L., & Zhang, Y. (2023). Fast-DetectGPT: Efficient zero-shot detection of machine-generated text via probability curvature. https://arxiv.org/abs/2310.05130
- Biber, D. (2006). Stance in spoken and written university registers. *Journal of English for Academic Purposes*, 5(2), 97–116.
- Biber, D., & Barbieri, F. (2007). Lexical bundles in university spoken and written registers. *English for Specific Purposes*, 26(3), 263–286.
- Biber, D., & Gray, B. (2010). Challenging stereotypes about academic writing: Complexity, elaboration, explicitness. *Journal of English for Academic Purposes*, 9(1), 2–20.
- COPE (Committee on Publication Ethics). (2022). *AI and authorship ethics: A position statement*. https://publicationethics.org
- Darmon, A. N. M., et al. (2019). Pull out all the stops: Textual analysis via punctuation sequences. https://arxiv.org/abs/1901.00519
- Gehrmann, S., Strobelt, H., & Rush, A. M. (2019). GLTR: Statistical detection and visualization of generated text. In *Proceedings of the 57th Annual Meeting of the Association for Computational Linguistics: System Demonstrations* (pp. 111–116).
- Grosz, B. J., Joshi, A. K., & Weinstein, S. (1995). Centering: A framework for modeling the local coherence of discourse. *Computational Linguistics*, 21(2), 203–225.
- Holtzman, A., Buys, J., Du, L., Forbes, M., & Choi, Y. (2020). The curious case of neural text degeneration. In *International Conference on Learning Representations (ICLR)*.
- Hyland, K. (1998). *Hedging in scientific research articles*. John Benjamins.
- Hyland, K. (2002). Authority and invisibility: Authorial identity in academic writing. *Journal of Pragmatics*, 34(8), 1091–1112.
- Hyland, K. (2005). *Metadiscourse: Exploring interaction in writing*.
- Hyland, K. (2008). As can be seen: Lexical bundles and disciplinary variation. *English for Specific Purposes*, 27(1), 4–21.
- Ippolito, D., Duckworth, D., Callison-Burch, C., & Eck, D. (2020). Automatic detection of generated text is easiest when humans are involved? https://arxiv.org/abs/1911.00650
- Jafariakinabad, F., & Hua, K. A. (2021). Unifying lexical, syntactic, and structural representations of written language for authorship attribution. *SN Computer Science*, 2, 481.
- Jafariakinabad, F., Tarnpradab, S., & Hua, K. A. (2020). Syntactic neural model for authorship attribution. In *Proceedings of FLAIRS-33*.
- Kirchenbauer, J., Geiping, J., Wen, Y., Katz, J., Miers, I., & Goldstein, T. (2023). A watermark for large language models. https://arxiv.org/abs/2301.10226
- Koppel, M., Schler, J., & Argamon, S. (2009). Computational methods in authorship attribution. *Journal of the American Society for Information Science and Technology*, 60(1), 9–26.
- Krishna, K., Song, Y., Karpinska, M., Wieting, J., & Iyyer, M. (2023). Paraphrasing evades detectors of AI-generated text, but retrieval is an effective defense. In *Advances in Neural Information Processing Systems (NeurIPS)*.
- MAHA Commission. (2025, May 22). *Make America Healthy Again report*. White House. https://www.whitehouse.gov/wp-content/uploads/2025/05/MAHA-Report-The-White-House.pdf
- Masrour, E., Emi, B., & Spero, M. (2025). DAMAGE: Detecting adversarially modified AI-generated text. https://arxiv.org/abs/2501.03437
- Mitchell, E., Lee, Y. T., Lin, C., Han, J., Manning, C. D., & Finn, C. (2023). DetectGPT: Zero-shot machine-generated text detection using probability curvature. https://arxiv.org/abs/2301.11305
- Stamatatos, E. (2009). A survey of modern authorship attribution methods. *Journal of the American Society for Information Science and Technology*, 60(3), 538–556.
- Stamatatos, E. (2016). Authorship verification: A review of recent work. In *CLEF 2016 Working Notes* (pp. 1–13).
- Wolf, F., Gibson, E., & Desmet, T. (2004). Discourse coherence and pronoun resolution. *Language and Cognitive Processes*, 19(6), 665–675.
