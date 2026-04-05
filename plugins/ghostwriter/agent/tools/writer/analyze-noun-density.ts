#!/usr/bin/env bun
/**
 * analyze-noun-density.ts
 *
 * Writer-specific noun density analysis that identifies sentences where nouns
 * can be increased to raise the document's noun frequency above the 18% threshold.
 *
 * The detector flags "Reduced noun frequency" when NOUN% < 18% (human baseline ~20%).
 * AI text tends to overuse pronouns, auxiliaries, and abstract verbs at the expense
 * of concrete nouns.
 *
 * Fix strategy: identify sentences with low noun density and suggest replacing
 * pronouns, vague references, and nominalizations with specific nouns.
 *
 * Usage:
 *   bun agent/tools/writer/analyze-noun-density.ts input.md
 *   bun agent/tools/writer/analyze-noun-density.ts input.md --target-density 20.0
 *   bun agent/tools/writer/analyze-noun-density.ts input.md --out analysis.json
 *   echo "text" | bun agent/tools/writer/analyze-noun-density.ts
 *
 * Output:
 *   JSON with flagged sentences, metrics, and noun-boosting suggestions.
 */

import { extractSentences } from "./extract-sentences";
import { resolve, dirname } from "path";
import { parseArgs, outputResult } from "../lib/cli-utils";
import { DEFAULT_PROSE_TARGETS } from "../config/presets/defaults";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SpaCyToken {
  text: string;
  lemma: string;
  pos: string;
  tag: string;
  dep: string;
}

interface SpaCySentence {
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount: number;
  nounCount: number;
  nounDensity: number;
  pronounCount: number;
  pronounDensity: number;
  auxCount: number;
  auxDensity: number;
  hasVagueRefs: boolean;
  vagueRefs: string[];
  nounChunks: string[];
}

interface SpaCyResult {
  sentences: SpaCySentence[];
  documentStats: {
    totalWords: number;
    totalNouns: number;
    nounDensity: number;
    totalPronouns: number;
    pronounDensity: number;
    totalAux: number;
    auxDensity: number;
    nounsByLemma: Record<string, number>;
  };
}

interface CanonicalSentence {
  id: number;
  text: string;
  start: number;
  end: number;
  paragraphIndex: number;
}

interface EnrichedSentence extends CanonicalSentence {
  wordCount: number;
  nounCount: number;
  nounDensity: number;
  pronounCount: number;
  pronounDensity: number;
  auxCount: number;
  auxDensity: number;
  hasVagueRefs: boolean;
  vagueRefs: string[];
  nounChunks: string[];
}

type Priority = "critical" | "high" | "medium" | "low";
type IssueType =
  | "low_noun_high_pronoun" // Pronouns displacing nouns
  | "low_noun_high_aux" // Auxiliaries inflating word count
  | "vague_references" // "this", "it", "things" instead of specific nouns
  | "low_noun_general"; // Generally low noun density

interface FlaggedSentence {
  id: number;
  text: string;
  priority: Priority;
  reason: string;
  issueType: IssueType;
  nounDensity: number;
  pronounCount: number;
  auxCount: number;
  vagueRefs: string[];
  nounChunks: string[];
  suggestedActions: string[];
}

interface AnalysisResult {
  metrics: {
    totalWords: number;
    totalNouns: number;
    nounDensity: number;
    targetDensity: number;
    deficitNouns: number;
    pronounDensity: number;
    auxDensity: number;
    topNouns: string[];
  };
  flaggedSentences: FlaggedSentence[];
  summary: {
    totalFlagged: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    estimatedImpactIfFixed: string;
    primaryStrategy: string;
  };
}

// ─── spaCy integration ───────────────────────────────────────────────────────

const TOOLS_DIR = resolve(dirname(new URL(import.meta.url).pathname), "..");

async function runSpaCy(filePath: string): Promise<SpaCyResult> {
  const pythonScript = `
import json
import sys
from pathlib import Path

try:
    import spacy
except ImportError:
    print(json.dumps({"error": "spacy not installed"}), file=sys.stderr)
    sys.exit(1)

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(json.dumps({"error": "spacy model not found"}), file=sys.stderr)
    sys.exit(1)

nlp.max_length = 2_000_000

VAGUE_REFS = {
    "this", "that", "it", "these", "those", "thing", "things",
    "stuff", "something", "everything", "nothing", "anything",
    "aspect", "area", "way", "part", "kind", "type", "sort",
}

def analyze(text):
    doc = nlp(text)
    sentences = []
    total_words = 0
    total_nouns = 0
    total_pronouns = 0
    total_aux = 0
    noun_lemmas = {}

    for idx, sent in enumerate(doc.sents):
        sent_text = sent.text.strip()
        if not sent_text:
            continue

        word_count = 0
        noun_count = 0
        pronoun_count = 0
        aux_count = 0
        vague = []
        noun_chunks = []

        for token in sent:
            if token.is_punct or token.is_space:
                continue
            word_count += 1

            if token.pos_ in ("NOUN", "PROPN"):
                noun_count += 1
                lemma = token.lemma_.lower()
                noun_lemmas[lemma] = noun_lemmas.get(lemma, 0) + 1

                # Check for vague nouns
                if lemma in VAGUE_REFS:
                    vague.append(token.text)

            elif token.pos_ == "PRON":
                pronoun_count += 1
                # Check for vague pronoun references
                if token.lemma_.lower() in VAGUE_REFS:
                    vague.append(token.text)

            elif token.pos_ == "DET" and token.lemma_ in {"this", "that", "these", "those"}:
                # Demonstrative determiners without a noun can be vague
                has_noun_child = any(c.pos_ in ("NOUN", "PROPN") for c in token.children)
                if not has_noun_child and token.dep_ in ("nsubj", "nsubjpass", "dobj", "pobj", "attr"):
                    vague.append(token.text)

            elif token.pos_ == "AUX":
                aux_count += 1

        total_words += word_count
        total_nouns += noun_count
        total_pronouns += pronoun_count
        total_aux += aux_count

        # Extract noun chunks for this sentence
        for chunk in doc.noun_chunks:
            if chunk.start >= sent.start and chunk.end <= sent.end:
                noun_chunks.append(chunk.text)

        sentences.append({
            "index": idx,
            "text": sent_text,
            "start": sent.start_char,
            "end": sent.end_char,
            "wordCount": word_count,
            "nounCount": noun_count,
            "nounDensity": round((noun_count / word_count * 100) if word_count > 0 else 0, 2),
            "pronounCount": pronoun_count,
            "pronounDensity": round((pronoun_count / word_count * 100) if word_count > 0 else 0, 2),
            "auxCount": aux_count,
            "auxDensity": round((aux_count / word_count * 100) if word_count > 0 else 0, 2),
            "hasVagueRefs": len(vague) > 0,
            "vagueRefs": vague,
            "nounChunks": noun_chunks,
        })

    return {
        "sentences": sentences,
        "documentStats": {
            "totalWords": total_words,
            "totalNouns": total_nouns,
            "nounDensity": round((total_nouns / total_words * 100) if total_words > 0 else 0, 2),
            "totalPronouns": total_pronouns,
            "pronounDensity": round((total_pronouns / total_words * 100) if total_words > 0 else 0, 2),
            "totalAux": total_aux,
            "auxDensity": round((total_aux / total_words * 100) if total_words > 0 else 0, 2),
            "nounsByLemma": dict(sorted(noun_lemmas.items(), key=lambda x: -x[1])[:20]),
        },
    }

if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if path and path.is_file():
        text = path.read_text(encoding="utf-8")
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        print(json.dumps({"error": "No input"}), file=sys.stderr)
        sys.exit(1)

    result = analyze(text)
    print(json.dumps(result, indent=2))
`;

  const tmpScript = `/tmp/analyze-nouns-${Date.now()}.py`;
  await Bun.write(tmpScript, pythonScript);

  const proc = Bun.spawn(
    [resolve(TOOLS_DIR, "run-python.sh"), tmpScript, filePath],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Python analysis failed (exit ${exitCode}): ${stderr.trim()}`);
  }

  return JSON.parse(stdout);
}

// ─── Sentence alignment ─────────────────────────────────────────────────────

function alignSentences(
  canonical: CanonicalSentence[],
  spacy: SpaCySentence[],
): EnrichedSentence[] {
  const enriched: EnrichedSentence[] = canonical.map((cs) => ({
    ...cs,
    wordCount: cs.text.split(/\s+/).filter(Boolean).length,
    nounCount: 0,
    nounDensity: 0,
    pronounCount: 0,
    pronounDensity: 0,
    auxCount: 0,
    auxDensity: 0,
    hasVagueRefs: false,
    vagueRefs: [],
    nounChunks: [],
  }));

  for (const ss of spacy) {
    let bestOverlap = 0;
    let bestIdx = -1;

    for (let i = 0; i < canonical.length; i++) {
      const cs = canonical[i];
      const overlapStart = Math.max(ss.start, cs.start);
      const overlapEnd = Math.min(ss.end, cs.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const e = enriched[bestIdx];
      e.nounCount += ss.nounCount;
      e.pronounCount += ss.pronounCount;
      e.auxCount += ss.auxCount;
      e.wordCount = Math.max(e.wordCount, ss.wordCount);
      e.nounDensity = e.wordCount > 0 ? Number(((e.nounCount / e.wordCount) * 100).toFixed(2)) : 0;
      e.pronounDensity = e.wordCount > 0 ? Number(((e.pronounCount / e.wordCount) * 100).toFixed(2)) : 0;
      e.auxDensity = e.wordCount > 0 ? Number(((e.auxCount / e.wordCount) * 100).toFixed(2)) : 0;
      e.hasVagueRefs = e.hasVagueRefs || ss.hasVagueRefs;
      e.vagueRefs = [...e.vagueRefs, ...ss.vagueRefs];
      for (const nc of ss.nounChunks) {
        if (!e.nounChunks.includes(nc)) e.nounChunks.push(nc);
      }
    }
  }

  return enriched;
}

// ─── Flagging logic ──────────────────────────────────────────────────────────

function classifySentence(
  s: EnrichedSentence,
  docNounDensity: number,
  targetDensity: number,
): FlaggedSentence | null {
  // Skip very short sentences
  if (s.wordCount < 4) return null;

  // Skip sentences that already have good noun density
  if (s.nounDensity >= targetDensity) return null;

  const actions: string[] = [];
  let priority: Priority = "low";
  let issueType: IssueType = "low_noun_general";
  let reason = "";

  // Check for specific issue patterns
  const hasHighPronouns = s.pronounDensity > 15;
  const hasHighAux = s.auxDensity > 10;
  const hasVague = s.vagueRefs.length > 0;

  if (s.nounDensity < 10 && hasHighPronouns) {
    priority = "critical";
    issueType = "low_noun_high_pronoun";
    reason = `Very low noun density (${s.nounDensity}%) with high pronoun usage (${s.pronounDensity}%)`;
    actions.push(
      "Replace pronouns (it, they, this, that) with the specific nouns they reference",
    );
    actions.push(
      "Convert pronoun-led constructions to noun-led: 'They implemented it' → 'The engineering team implemented the caching layer'",
    );
  } else if (s.nounDensity < 10 && hasHighAux) {
    priority = "critical";
    issueType = "low_noun_high_aux";
    reason = `Very low noun density (${s.nounDensity}%) inflated by auxiliaries (${s.auxDensity}%)`;
    actions.push(
      "Reduce auxiliary verbs and add specific nouns: 'It was being considered' → 'The committee considered the proposal'",
    );
    actions.push(
      "Convert abstract constructions to concrete: 'There are issues that can be...' → 'Three security vulnerabilities allow...'",
    );
  } else if (hasVague && s.nounDensity < targetDensity) {
    priority = s.vagueRefs.length >= 2 ? "high" : "medium";
    issueType = "vague_references";
    reason = `Vague references [${s.vagueRefs.join(", ")}] instead of specific nouns (noun density: ${s.nounDensity}%)`;
    actions.push(
      `Replace vague references (${s.vagueRefs.join(", ")}) with specific nouns from context`,
    );
    actions.push(
      "Convert 'this approach' → name the approach; 'these things' → list the specific items",
    );
  } else if (s.nounDensity < docNounDensity * 0.7) {
    priority = s.nounDensity < 8 ? "high" : "medium";
    issueType = "low_noun_general";
    reason = `Below-average noun density (${s.nounDensity}% vs doc avg ${docNounDensity.toFixed(1)}%)`;
    actions.push(
      "Add concrete nouns: replace abstract language with specific actors, objects, or concepts",
    );
    actions.push(
      "Convert nominalizations back to noun + verb: 'the implementation of' → 'the team implemented'",
    );
  } else {
    return null;
  }

  return {
    id: s.id,
    text: s.text,
    priority,
    reason,
    issueType,
    nounDensity: s.nounDensity,
    pronounCount: s.pronounCount,
    auxCount: s.auxCount,
    vagueRefs: s.vagueRefs,
    nounChunks: s.nounChunks,
    suggestedActions: actions,
  };
}

// ─── Main analysis ──────────────────────────────────────────────────────────

export async function analyzeNounDensity(
  text: string,
  filePath: string | null,
  targetDensity: number = 20.0,
): Promise<AnalysisResult> {
  // Step 1: Extract canonical sentences
  const { sentences: canonicalSentences } = extractSentences(text);

  // Step 2: Run spaCy analysis
  let spacyResult: SpaCyResult;

  if (filePath) {
    spacyResult = await runSpaCy(filePath);
  } else {
    const tmpPath = `/tmp/analyze-nouns-input-${Date.now()}.txt`;
    await Bun.write(tmpPath, text);
    try {
      spacyResult = await runSpaCy(tmpPath);
    } finally {
      try {
        await Bun.file(tmpPath).exists() && (await Bun.write(tmpPath, ""));
      } catch {}
    }
  }

  // Step 3: Align sentences
  const enriched = alignSentences(canonicalSentences, spacyResult.sentences);

  // Step 4: Calculate metrics
  const stats = spacyResult.documentStats;
  const deficitNouns = Math.max(
    0,
    Math.round((targetDensity / 100) * stats.totalWords - stats.totalNouns),
  );

  const topNouns = Object.entries(stats.nounsByLemma)
    .slice(0, 10)
    .map(([lemma, count]) => `${lemma} (${count})`);

  // Step 5: Flag sentences (only if document is below threshold)
  let flagged: FlaggedSentence[] = [];

  if (stats.nounDensity < targetDensity) {
    // Below detector threshold — flag sentences
    for (const s of enriched) {
      const result = classifySentence(s, stats.nounDensity, targetDensity);
      if (result) flagged.push(result);
    }

    // Sort by priority
    const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    flagged.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.nounDensity - b.nounDensity; // Lowest density first
    });

    // Budget: stop recommending after enough fixes to bring density to target
    // Each flagged sentence fix might add 1-2 nouns
    let cumulativeNouns = 0;
    const budgeted: FlaggedSentence[] = [];
    for (const s of flagged) {
      if (cumulativeNouns >= deficitNouns && budgeted.length > 0) break;
      budgeted.push(s);
      cumulativeNouns += 2; // Estimate 2 new nouns per fixed sentence
    }
    flagged = budgeted;
  }

  // Summary
  const criticalCount = flagged.filter((s) => s.priority === "critical").length;
  const highCount = flagged.filter((s) => s.priority === "high").length;
  const mediumCount = flagged.filter((s) => s.priority === "medium").length;
  const lowCount = flagged.filter((s) => s.priority === "low").length;

  const estimatedNewNouns = flagged.length * 2;
  const estimatedNewDensity =
    stats.totalWords > 0
      ? (((stats.totalNouns + estimatedNewNouns) / stats.totalWords) * 100).toFixed(1)
      : "0.0";

  // Determine primary strategy
  const issueTypeCounts: Record<IssueType, number> = {
    low_noun_high_pronoun: 0,
    low_noun_high_aux: 0,
    vague_references: 0,
    low_noun_general: 0,
  };
  for (const s of flagged) {
    issueTypeCounts[s.issueType]++;
  }
  const dominantIssue = Object.entries(issueTypeCounts).sort((a, b) => b[1] - a[1])[0];

  const strategyMap: Record<IssueType, string> = {
    low_noun_high_pronoun: "Replace pronouns with specific nouns they reference",
    low_noun_high_aux: "Reduce auxiliary verbs and add concrete nouns/subjects",
    vague_references: "Replace vague references (this, that, it, things) with specific nouns",
    low_noun_general: "Add concrete actors, objects, and named concepts throughout",
  };

  return {
    metrics: {
      totalWords: stats.totalWords,
      totalNouns: stats.totalNouns,
      nounDensity: stats.nounDensity,
      targetDensity,
      deficitNouns,
      pronounDensity: stats.pronounDensity,
      auxDensity: stats.auxDensity,
      topNouns,
    },
    flaggedSentences: flagged,
    summary: {
      totalFlagged: flagged.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      estimatedImpactIfFixed: `${stats.nounDensity}% → ~${estimatedNewDensity}%`,
      primaryStrategy: dominantIssue ? strategyMap[dominantIssue[0] as IssueType] : "No action needed",
    },
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  (async () => {
    const { text, outFile, config, extraArgs } = await parseArgs(
      process.argv,
      ["--target-density"],
    );

    // Priority: CLI flag > config > default
    let targetDensity = config.writing_style?.prose?.noun_density
      ?? DEFAULT_PROSE_TARGETS.noun_density;
    if (extraArgs["--target-density"]) {
      targetDensity = parseFloat(extraArgs["--target-density"]);
    }

    const result = await analyzeNounDensity(text, null, targetDensity);
    await outputResult(result, outFile);
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
