# Agent Tools Quick Reference

## Tool Locations

All tools organized by category:

```
agent/tools/
├── detector/          Detection tools
├── writer/            Humanization tools  
├── run-python.sh      Python wrapper
└── version-config.sh  Versioning utility
```

## Running Detection Tools

### TypeScript Tools (Bun)

```bash
bun agent/tools/detector/vocabulary-scan.ts "text to analyze"
bun agent/tools/detector/structure-analyzer.ts "text to analyze"
bun agent/tools/detector/unicode-punctuation-scan.ts "text to analyze"
```

### Python Tools (with venv wrapper)

```bash
./agent/tools/run-python.sh agent/tools/detector/burstiness-calculator.py "text"
./agent/tools/run-python.sh agent/tools/detector/ngram-analyzer.py "text"
./agent/tools/run-python.sh agent/tools/detector/content-analyzer.py "text"
./agent/tools/run-python.sh agent/tools/detector/syntactic-complexity.py "text"
./agent/tools/run-python.sh agent/tools/detector/perplexity-calculator.py "text"
./agent/tools/run-python.sh agent/tools/detector/detectgpt.py "text"
```

## Documentation

- **General**: [agent/tools/README.md](README.md)
- **Detection Tools**: [agent/tools/detector/README.md](detector/README.md)
- **Writer Tools**: [agent/tools/writer/README.md](writer/README.md)
- **Reorganization Report**: [agent/reports/REORGANIZATION_REPORT.md](../reports/REORGANIZATION_REPORT.md)

## Ensemble Weights (Detection)

| Tool | Weight |
|------|--------|
| DetectGPT | 0.20 |
| Perplexity | 0.15 |
| Vocabulary | 0.15 |
| Burstiness | 0.12 |
| N-gram | 0.12 |
| Syntactic | 0.10 |
| Content | 0.10 |
| Punctuation | 0.06 |

## Key Thresholds

| Metric | AI Signal | Human Signal |
|--------|-----------|--------------|
| Perplexity | < 20 | > 50 |
| Burstiness CV | < 30 | > 60 |
| Fano Factor | < 0.8 | > 1.5 |
| DetectGPT d_score | > 2.0 | < 0.5 |
| AI Vocab Density | > 15/1000 | < 5/1000 |

## Versioning

Back up agents/skills before modifying:

```bash
./agent/tools/version-config.sh --agent writer
./agent/tools/version-config.sh --skill adversarial-loop
```
