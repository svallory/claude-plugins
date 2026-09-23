# Research Sources

## Academic Papers

### Detection Methods

| Paper | Link | Key Contribution |
|-------|------|------------------|
| DetectGPT: Zero-Shot Detection (Mitchell et al. 2023) | [arXiv:2301.11305](https://arxiv.org/abs/2301.11305) | Probability curvature method, 0.95 AUROC |
| Fast-DetectGPT (Bao et al. 2024) | [arXiv:2310.05130](https://arxiv.org/abs/2310.05130) | 340x faster, ~75% improvement, ICLR 2024 |
| DNA-GPT: Divergent N-Gram Analysis (Yang et al. 2023) | [arXiv:2305.17359](https://arxiv.org/abs/2305.17359) | Training-free n-gram detection |
| SKDU at De-Factify 4.0 | [arXiv:2503.22338](https://arxiv.org/abs/2503.22338) | NELA features (87 attributes), F1=0.99 |
| Stylistic Fingerprints of LLMs | [arXiv:2503.01659](https://arxiv.org/abs/2503.01659) | Model-specific detection, 97%+ precision |
| Do LLMs write like humans? (PNAS 2024) | [PNAS](https://www.pnas.org/doi/10.1073/pnas.2322689121) | Construction frequencies (527% present participles), entropy metrics |
| LLM-generated vs human news (2025) | [arXiv:2506.01407](https://arxiv.org/abs/2506.01407) | News text comparison, syntactic uniformity |
| DetectRL (NeurIPS 2024) | [NeurIPS](https://neurips.cc/virtual/2024/poster/93234) | Domain-specific AUROC (creative 58.95%, news 12.21%) |
| DAMASHA (Dec 2024) | [arXiv:2412.xxxxx](https://arxiv.org/) | Adversarially robust hybrid document segmentation |
| EditLens (Oct 2024) | [arXiv:2410.xxxxx](https://arxiv.org/) | Continuous AI editing score, F1=94.7% |
| FAID (May 2025) | [arXiv:2505.xxxxx](https://arxiv.org/) | Multi-task detection with model family ID |
| MULTITuDE benchmark | [GitHub](https://github.com/kinit-sk/multicultural-llm-detection) | Multilingual AI detection benchmark |

### Vocabulary & Linguistics

| Paper | Link | Key Contribution |
|-------|------|------------------|
| Delving into ChatGPT usage (Kobak et al. 2024) | [arXiv:2406.07016](https://arxiv.org/abs/2406.07016) | 280 excess words, "delves" 25.2x, 14M PubMed abstracts |
| LLMs Produce Empathic Responses (NIH/PMC) | [PMC11422446](https://pmc.ncbi.nlm.nih.gov/articles/PMC11422446/) | POS differences, emotional patterns, GPT-4/Llama-2/Mixtral comparison |
| Lexical Diversity (MTLD) - McCarthy & Jarvis | [PMC4490052](https://pmc.ncbi.nlm.nih.gov/articles/PMC4490052/) | MTLD formula and validation |
| Syntactic Complexity (Yngve/Frazier) | [Springer](https://link.springer.com/article/10.3758/s13428-010-0037-9) | Yngve/Frazier depth metrics |
| ChatGPT vs Gemini Writing Styles | [Scientific American](https://www.scientificamerican.com/article/chatgpt-and-gemini-ai-have-uniquely-different-writing-styles/) | Model style comparison |

---

## Tools & Implementations

### Official Code Repositories

| Tool | Repository | Notes |
|------|------------|-------|
| DetectGPT | [GitHub](https://github.com/eric-mitchell/detect-gpt) | Official implementation |
| Fast-DetectGPT | [GitHub](https://github.com/baoguangsheng/fast-detect-gpt) | Efficient version |
| lmppl (Perplexity) | [GitHub](https://github.com/asahi417/lmppl) | Multi-model perplexity |
| lexicalrichness | [PyPI](https://pypi.org/project/lexicalrichness/) | TTR, MTLD, MATTR |

### Detection Services

| Service | Link | Notes |
|---------|------|-------|
| GPTZero | [gptzero.me](https://gptzero.me) | Perplexity + burstiness |
| Originality.ai | [originality.ai](https://originality.ai) | BERT/RoBERTa-based |

---

## Technical Documentation

### Perplexity Calculation

- [Hugging Face: Perplexity of Fixed-Length Models](https://huggingface.co/docs/transformers/perplexity)
- [PyTorch-Metrics: Perplexity](https://lightning.ai/docs/torchmetrics/stable/gallery/text/perplexity.html)

### Burstiness & Variance

- [GPTZero: What is Perplexity & Burstiness](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/)
- [Fano Factor - Wikipedia](https://en.wikipedia.org/wiki/Fano_factor)

### Vocabulary Metrics

- [Type-Token Ratio - Sketch Engine](https://www.sketchengine.eu/glossary/type-token-ratio-ttr/)
- [COCA N-grams Corpus](https://www.ngrams.info/)

---

## Industry/Blog Sources

### Pangram Labs (Primary Source for Phrase Analysis)

| Source | Link | Key Points |
|--------|------|------------|
| Comprehensive Guide to Spotting AI Writing | [Pangram Labs](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns) | Extensive vocabulary lists, Emily/Sarah 60-70% |
| Walking Through AI's Most Overused Phrases | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) | Verified phrase multipliers (294,000x to 3,000x) |
| Pangram AI Phrases Tool | [Pangram Labs](https://www.pangram.com/blog/pangram-ai-phrases) | N-gram analysis methodology |
| Is This AI? Field Guide | [Pangram Labs](https://www.pangram.com/blog/is-this-ai-a-field-guide-for-detecting-ai-writing-in-the-wild) | Detection heuristics |
| How to Create Evidence for AI Detection | [Pangram Labs](https://www.pangram.com/blog/how-to-create-evidence-for-an-ai-detection-case) | Expert accuracy 92.7%, council methodology |

### GPTZero

| Source | Link | Key Points |
|--------|------|------------|
| How AI Detectors Work | [GPTZero](https://gptzero.me/news/how-ai-detectors-work/) | 7-component model |
| Perplexity and Burstiness | [GPTZero](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/) | PPL threshold 20, 95.7% RAID accuracy |

### Other Detection Analysis

| Source | Link | Key Points |
|--------|------|------------|
| 10 Signs of AI Writing | [The Algorithmic Bridge](https://thealgorithmicbridge.substack.com/p/10-signs-of-ai-writing-that-will) | Qualitative markers, seesaw structure |
| Sentence Structure Analysis | [Hastewire](https://hastewire.com/blog/how-ai-detectors-interpret-sentence-structure-key-insights) | Burstiness patterns |
| Hidden Signatures: AI Fingerprints | [The Prompt Index](https://www.thepromptindex.com/hidden-signatures-how-ai-models-leave-their-digital-fingerprints.html) | 97.1% model classification accuracy |
| Uncovering Repetition Patterns | [ComplexDiscovery](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) | Template Rate 38% vs 95%, CR-POS 0.42 vs 0.67 |
| Why AI Uses Em Dashes | [Sean Goedecke](https://www.seangoedecke.com/em-dashes/) | GPT-4o ~10x more em dashes than GPT-3.5 |
| Em Dash Analysis | [Maria Sukhareva/Substack](https://substack.com/home/post/p-165661070) | Em dash patterns |

### Model Comparisons

| Source | Link | Key Points |
|--------|------|------------|
| Claude vs GPT vs Gemini | [Type.ai](https://blog.type.ai/post/claude-vs-gpt) | Writing style differences |
| ChatGPT Overused Words | [Twixify](https://www.twixify.com/post/most-overused-words-by-chatgpt) | 124+ word list |
| ChatGPT Word Usage Study | [Scientific American](https://www.scientificamerican.com/article/chatgpt-is-changing-the-words-we-use-in-conversation/) | Cultural impact |

### News & Updates

| Source | Link | Key Points |
|--------|------|------------|
| OpenAI Fixes Em Dash Problem | [TechCrunch](https://techcrunch.com/2025/11/14/openai-says-its-fixed-chatgpts-em-dash-problem/) | Sam Altman confirmation |

### Humanization Tools

| Tool | Link | Approach |
|------|------|----------|
| Grammarly AI Humanizer | [grammarly.com](https://www.grammarly.com/ai-humanizer) | NLP-based rewriting |
| QuillBot AI Humanizer | [quillbot.com](https://quillbot.com/ai-humanizer) | Pattern removal |
| Netus AI | [netus.ai](https://netus.ai/) | Sentence restructuring |

---

## Key Statistics & Findings (Verified)

### Detection Performance

| Finding | Value | Source |
|---------|-------|--------|
| DetectGPT AUROC | 0.95 | [Mitchell et al. 2023](https://arxiv.org/abs/2301.11305) |
| Fast-DetectGPT speedup | 340x | [Bao et al. 2024](https://arxiv.org/abs/2310.05130) |
| NELA features F1 | 0.99 | [arXiv:2503.22338](https://arxiv.org/abs/2503.22338) |
| Model fingerprint accuracy | 97.1% | [The Prompt Index](https://www.thepromptindex.com/hidden-signatures-how-ai-models-leave-their-digital-fingerprints.html) |
| GPTZero RAID benchmark | 95.7% detection, 1% FP | [GPTZero](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/) |

### Vocabulary Frequency Multipliers

| Finding | Value | Source |
|---------|-------|--------|
| "delves" frequency increase | 25.2x | [Kobak et al. 2024](https://arxiv.org/abs/2406.07016) |
| "showcasing" frequency increase | 9.2x | [Kobak et al. 2024](https://arxiv.org/abs/2406.07016) |
| "underscores" frequency increase | 9.1x | [Kobak et al. 2024](https://arxiv.org/abs/2406.07016) |
| LLM-processed PubMed abstracts (2024) | ≥13.5% | [Kobak et al. 2024](https://arxiv.org/abs/2406.07016) |

### Phrase Frequency Multipliers (Pangram Labs)

| Phrase | Multiplier | Source |
|--------|------------|--------|
| "As an AI language model" | 294,000x | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) |
| "I do not have personal" | 67,000x | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) |
| "vibrant tapestry" | 17,000x | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) |
| "In the ever-evolving" | 11,000x | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) |
| "serves as a powerful" | 10,000x | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) |
| "It is important to note that" | 3,000x | [Pangram Labs](https://www.pangram.com/blog/walking-through-ai-phrases) |

### Structural Patterns

| Finding | Value | Source |
|---------|-------|--------|
| Template Rate (human) | 38% | [ComplexDiscovery](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) |
| Template Rate (AI) | 95% | [ComplexDiscovery](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) |
| CR-POS (human) | 0.42 | [ComplexDiscovery](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) |
| CR-POS (AI) | 0.67 | [ComplexDiscovery](https://complexdiscovery.com/uncovering-repetition-the-hidden-patterns-that-expose-ai-generated-text/) |
| GPT-4o em dash vs GPT-3.5 | ~10x | [Sean Goedecke](https://www.seangoedecke.com/em-dashes/) |
| AI names (Emily/Sarah) | 60-70% | [Pangram Labs](https://www.pangram.com/blog/comprehensive-guide-to-spotting-ai-writing-patterns) |

### Detection Thresholds

| Metric | Threshold | Interpretation | Source |
|--------|-----------|----------------|--------|
| Perplexity | PPL = 20 | Decision boundary | [GPTZero/NYU](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/) |

---

## Citation Format

### BibTeX Templates

```bibtex
@inproceedings{mitchell2023detectgpt,
  title={DetectGPT: Zero-Shot Machine-Generated Text Detection using Probability Curvature},
  author={Mitchell, Eric and Lee, Yoonho and Khazatsky, Alexander and Manning, Christopher D. and Finn, Chelsea},
  booktitle={Proceedings of the 40th International Conference on Machine Learning (ICML)},
  pages={24950--24962},
  year={2023}
}

@inproceedings{bao2024fastdetectgpt,
  title={Fast-DetectGPT: Efficient Zero-Shot Detection of Machine-Generated Text via Conditional Probability Curvature},
  author={Bao, Guangsheng and Zhao, Yanbin and Teng, Zhiyang and Yang, Linyi and Zhang, Yue},
  booktitle={International Conference on Learning Representations (ICLR)},
  year={2024}
}

@article{yang2023dnagpt,
  title={DNA-GPT: Divergent N-Gram Analysis for Training-Free Detection of GPT-Generated Text},
  author={Yang, Xianjun and Cheng, Wei and Wu, Yue and Petzold, Linda and Wang, William Yang and Chen, Haifeng},
  journal={arXiv preprint arXiv:2305.17359},
  year={2023}
}

@article{kobak2024delving,
  title={Delving into ChatGPT usage in academic writing through excess vocabulary},
  author={Kobak, Dmitry and González Márquez, Rita and Horvát, Emőke-Ágnes and Lause, Jan},
  journal={arXiv preprint arXiv:2406.07016},
  year={2024}
}

@article{pnas2024llmwrite,
  title={Do LLMs write like humans? Variation in grammatical and rhetorical styles},
  journal={Proceedings of the National Academy of Sciences},
  year={2024}
}

@article{detectrl2024,
  title={DetectRL: Benchmarking LLM-Generated Text Detection in Real-World Scenarios},
  booktitle={Advances in Neural Information Processing Systems (NeurIPS)},
  year={2024}
}

@article{editlens2024,
  title={EditLens: Continuous AI Editing Score for Mixed Authorship Detection},
  journal={arXiv preprint},
  year={2024}
}
```

---

## Unverified Statistics

The following statistics appear in AI detection literature but could not be verified from primary sources:

| Statistic | Claimed Value | Notes |
|-----------|---------------|-------|
| N-gram AUROC by size | 58%→97% (1-gram to 6-gram) | Progression not found in primary sources |
| Burstiness CV threshold | 30 | Derived, not from primary research |
| Perplexity threshold 85 | Upper bound | Specific study not located |
