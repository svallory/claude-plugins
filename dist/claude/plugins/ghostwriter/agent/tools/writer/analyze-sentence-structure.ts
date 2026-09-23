#!/usr/bin/env bun
/**
 * analyze-sentence-structure.ts
 *
 * Writer-specific sentence structure analysis that identifies syntactic monotony
 * and provides actionable data for surgical updates.
 *
 * Detects four interconnected AI signals from the detector's syntactic-complexity.py:
 * 1. Missing compound-complex sentences (ratio < 0.05)
 * 2. Low depth variance (< 1.0)
 * 3. Shallow dependency structure (avg depth < 4.0)
 * 4. High sentence uniformity (> 0.8)
 *
 * NOTE: The avg_depth threshold (4.0) is set slightly above the detector's
 * ai_threshold (3.5) to give a safety margin without over-flagging text that
 * the detector considers acceptable. The detector's human_baseline is 6.0.
 *
 * The fix strategy: identify the simplest sentences and suggest combining/deepening
 * them to increase structural variety.
 *
 * Usage:
 *   bun agent/tools/writer/analyze-sentence-structure.ts input.md
 *   bun agent/tools/writer/analyze-sentence-structure.ts input.md --out analysis.json
 *   echo "text" | bun agent/tools/writer/analyze-sentence-structure.ts
 *
 * Output:
 *   JSON with flagged sentences, metrics, and restructuring suggestions.
 */

import { extractSentences, stripMarkdownNonProse } from "./extract-sentences";
import { resolve, dirname } from "path";
import { parseArgs, outputResult } from "../lib/cli-utils";
import { DEFAULT_PROSE_TARGETS } from "../config/presets/defaults";
import type { ProseTargets } from "../config/schemas";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SpaCyToken {
  text: string;
  lemma: string;
  pos: string;
  tag: string;
  dep: string;
  head_idx: number;
  children_count: number;
}

interface SpaCySentence {
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount: number;
  depthMax: number;
  type: "simple" | "compound" | "complex" | "compoundComplex";
  clauseCount: number;
  coordCount: number;
  branchingFactor: number;
}

interface SpaCyResult {
  sentences: SpaCySentence[];
  documentStats: {
    totalSentences: number;
    totalWords: number;
    depthMean: number;
    depthVariance: number;
    depthStdDev: number;
    sentenceTypes: {
      simple: number;
      compound: number;
      complex: number;
      compoundComplex: number;
    };
    sentenceTypeRatios: {
      simple: number;
      compound: number;
      complex: number;
      compoundComplex: number;
    };
    uniformityScore: number;
    avgBranchingFactor: number;
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
  depthMax: number;
  type: "simple" | "compound" | "complex" | "compoundComplex";
  clauseCount: number;
  coordCount: number;
  branchingFactor: number;
}

type Priority = "critical" | "high" | "medium" | "low";

interface FlaggedSentence {
  id: number;
  text: string;
  priority: Priority;
  reason: string;
  type: "simple" | "compound" | "complex" | "compoundComplex";
  depthMax: number;
  wordCount: number;
  suggestedActions: string[];
  /** If present, the ID of a neighboring sentence to merge with */
  mergeCandidate?: number;
}

interface SignalStatus {
  name: string;
  value: number;
  threshold: number;
  direction: "below" | "above";
  flagged: boolean;
  description: string;
}

interface AnalysisResult {
  metrics: {
    totalSentences: number;
    totalWords: number;
    depthMean: number;
    depthVariance: number;
    uniformityScore: number;
    compoundComplexRatio: number;
    sentenceTypes: {
      simple: number;
      compound: number;
      complex: number;
      compoundComplex: number;
    };
  };
  signals: SignalStatus[];
  flaggedSentences: FlaggedSentence[];
  summary: {
    totalFlagged: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    primaryIssue: string;
    suggestedFocusArea: string;
  };
}

// ─── spaCy integration ───────────────────────────────────────────────────────

const TOOLS_DIR = resolve(dirname(new URL(import.meta.url).pathname), "..");

async function runSpaCy(filePath: string): Promise<SpaCyResult> {
  const pythonScript = `
import json
import sys
from pathlib import Path
from statistics import mean, stdev, variance

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

CLAUSE_MARKERS = {"ccomp", "xcomp", "advcl", "relcl", "acl", "csubj"}
COORD_MARKERS = {"cc", "conj"}

def get_depth(token, _depth=0):
    """Get max dependency depth from a token."""
    children = list(token.children)
    if not children:
        return _depth
    return max(get_depth(c, _depth + 1) for c in children)

def classify_sentence(sent):
    """Classify a sentence as simple/compound/complex/compoundComplex."""
    clauses = sum(1 for t in sent if t.dep_ in CLAUSE_MARKERS)
    coords = sum(1 for t in sent if t.dep_ in COORD_MARKERS)
    has_sub = clauses > 0
    has_coord = coords > 0
    if has_sub and has_coord:
        return "compoundComplex", clauses, coords
    elif has_sub:
        return "complex", clauses, coords
    elif has_coord:
        return "compound", clauses, coords
    else:
        return "simple", clauses, coords

def get_branching_factor(sent):
    """Average children per non-leaf node in this sentence."""
    non_leaf = [t for t in sent if list(t.children)]
    if not non_leaf:
        return 0.0
    return round(mean(len(list(t.children)) for t in non_leaf), 2)

def analyze(text):
    doc = nlp(text)
    sentences = []
    depths = []
    type_counts = {"simple": 0, "compound": 0, "complex": 0, "compoundComplex": 0}

    for idx, sent in enumerate(doc.sents):
        sent_text = sent.text.strip()
        if not sent_text:
            continue

        word_count = sum(1 for t in sent if not t.is_punct and not t.is_space)
        if word_count == 0:
            continue

        # Find root and compute depth
        roots = [t for t in sent if t.head == t]
        depth = get_depth(roots[0]) if roots else 0
        depths.append(depth)

        stype, clauses, coords = classify_sentence(sent)
        type_counts[stype] += 1

        bf = get_branching_factor(sent)

        sentences.append({
            "index": idx,
            "text": sent_text,
            "start": sent.start_char,
            "end": sent.end_char,
            "wordCount": word_count,
            "depthMax": depth,
            "type": stype,
            "clauseCount": clauses,
            "coordCount": coords,
            "branchingFactor": bf,
        })

    total = len(sentences)
    total_words = sum(s["wordCount"] for s in sentences)

    # Depth stats
    d_mean = round(mean(depths), 2) if depths else 0
    d_var = round(variance(depths), 2) if len(depths) > 1 else 0
    d_std = round(stdev(depths), 2) if len(depths) > 1 else 0

    # Type ratios
    ratios = {k: round(v / total, 4) if total > 0 else 0 for k, v in type_counts.items()}

    # Sentence length uniformity
    lengths = [s["wordCount"] for s in sentences]
    if lengths:
        l_mean = mean(lengths)
        l_std = stdev(lengths) if len(lengths) > 1 else 0
        uniformity = max(0, min(1, round(1.0 - (l_std / l_mean) if l_mean > 0 else 1.0, 3)))
    else:
        uniformity = 1.0

    # Avg branching factor
    bfs = [s["branchingFactor"] for s in sentences if s["branchingFactor"] > 0]
    avg_bf = round(mean(bfs), 2) if bfs else 0

    return {
        "sentences": sentences,
        "documentStats": {
            "totalSentences": total,
            "totalWords": total_words,
            "depthMean": d_mean,
            "depthVariance": d_var,
            "depthStdDev": d_std,
            "sentenceTypes": type_counts,
            "sentenceTypeRatios": ratios,
            "uniformityScore": uniformity,
            "avgBranchingFactor": avg_bf,
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

  const tmpScript = `/tmp/analyze-structure-${Date.now()}.py`;
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
    depthMax: 0,
    type: "simple" as const,
    clauseCount: 0,
    coordCount: 0,
    branchingFactor: 0,
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
      // Take the max depth if multiple spaCy sents map to one canonical
      e.depthMax = Math.max(e.depthMax, ss.depthMax);
      // Take the most complex classification
      const typeOrder = { simple: 0, compound: 1, complex: 2, compoundComplex: 3 } as const;
      if (typeOrder[ss.type] > typeOrder[e.type]) {
        e.type = ss.type;
      }
      e.clauseCount += ss.clauseCount;
      e.coordCount += ss.coordCount;
      e.branchingFactor = Math.max(e.branchingFactor, ss.branchingFactor);
    }
  }

  return enriched;
}

// ─── Signal detection ────────────────────────────────────────────────────────

interface StructureThresholds {
  maxDependencyDepth: number;
  maxUniformity: number;
  minCompoundComplexRatio: number;
  minDepthVariance: number;
}

function detectSignals(
  stats: SpaCyResult["documentStats"],
  thresholds: StructureThresholds,
): SignalStatus[] {
  const signals: SignalStatus[] = [];

  const ccRatio = stats.sentenceTypeRatios.compoundComplex;
  signals.push({
    name: "compound_complex_ratio",
    value: ccRatio,
    threshold: thresholds.minCompoundComplexRatio,
    direction: "below",
    flagged: ccRatio < thresholds.minCompoundComplexRatio,
    description: `Compound-complex sentence ratio: ${(ccRatio * 100).toFixed(1)}% (threshold: ≥${(thresholds.minCompoundComplexRatio * 100).toFixed(0)}%)`,
  });

  signals.push({
    name: "depth_variance",
    value: stats.depthVariance,
    threshold: thresholds.minDepthVariance,
    direction: "below",
    flagged: stats.depthVariance < thresholds.minDepthVariance,
    description: `Depth variance: ${stats.depthVariance} (threshold: ≥${thresholds.minDepthVariance})`,
  });

  // maxDependencyDepth is the writer target — text below this gets flagged
  signals.push({
    name: "avg_depth",
    value: stats.depthMean,
    threshold: thresholds.maxDependencyDepth,
    direction: "below",
    flagged: stats.depthMean < thresholds.maxDependencyDepth,
    description: `Average dependency depth: ${stats.depthMean} (threshold: ≥${thresholds.maxDependencyDepth})`,
  });

  signals.push({
    name: "uniformity",
    value: stats.uniformityScore,
    threshold: thresholds.maxUniformity,
    direction: "above",
    flagged: stats.uniformityScore > thresholds.maxUniformity,
    description: `Sentence uniformity: ${stats.uniformityScore} (threshold: ≤${thresholds.maxUniformity})`,
  });

  return signals;
}

// ─── Flagging logic ──────────────────────────────────────────────────────────

function findMergeCandidate(
  idx: number,
  sentences: EnrichedSentence[],
): number | undefined {
  // Look for adjacent simple sentences in the same paragraph to merge
  const current = sentences[idx];

  // Check next sentence
  if (idx + 1 < sentences.length) {
    const next = sentences[idx + 1];
    if (
      next.type === "simple" &&
      next.paragraphIndex === current.paragraphIndex &&
      next.wordCount + current.wordCount < 40 // Don't create monsters
    ) {
      return next.id;
    }
  }

  // Check previous sentence
  if (idx > 0) {
    const prev = sentences[idx - 1];
    if (
      prev.type === "simple" &&
      prev.paragraphIndex === current.paragraphIndex &&
      prev.wordCount + current.wordCount < 40
    ) {
      return prev.id;
    }
  }

  return undefined;
}

function flagSentences(
  sentences: EnrichedSentence[],
  signals: SignalStatus[],
  stats: SpaCyResult["documentStats"],
): FlaggedSentence[] {
  const flagged: FlaggedSentence[] = [];

  // Only flag sentences if at least one signal is triggered
  const hasIssues = signals.some((s) => s.flagged);
  if (!hasIssues) return flagged;

  const needMoreCC = signals.find((s) => s.name === "compound_complex_ratio")?.flagged ?? false;
  const needMoreDepth = signals.find((s) => s.name === "avg_depth")?.flagged ?? false;
  const needMoreVariance = signals.find((s) => s.name === "depth_variance")?.flagged ?? false;
  const needLessUniformity = signals.find((s) => s.name === "uniformity")?.flagged ?? false;

  // Count simple sentences for budget calculation
  const simpleSentences = sentences.filter((s) => s.type === "simple");
  const totalSimple = simpleSentences.length;

  // How many compound-complex sentences do we need?
  const currentCC = stats.sentenceTypes.compoundComplex;
  const targetCC = Math.ceil(stats.totalSentences * 0.06); // Aim for 6%
  const neededCC = Math.max(0, targetCC - currentCC);

  // Budget: convert this many simple sentences to compound-complex
  const budget = Math.min(neededCC + 3, Math.ceil(totalSimple * 0.3)); // Max 30% of simples

  let budgetUsed = 0;

  for (let i = 0; i < sentences.length; i++) {
    if (budgetUsed >= budget) break;

    const s = sentences[i];
    const actions: string[] = [];
    let priority: Priority = "low";
    let reason = "";

    // Protect short punchy sentences (≤6 words) that contribute to burstiness.
    // Burstiness carries the highest detection weight and is the strongest human signal.
    if (s.wordCount <= 6) continue;

    // Simple sentences with shallow depth are the primary targets
    if (s.type === "simple" && s.depthMax < stats.depthMean) {
      const mergeCandidate = findMergeCandidate(i, sentences);

      if (needMoreCC && mergeCandidate !== undefined) {
        priority = "critical";
        reason = `Simple sentence (depth ${s.depthMax}) — merge with sentence ${mergeCandidate} into compound-complex`;
        actions.push(
          `Combine with sentence ${mergeCandidate} using subordination (because, although, while, since, when, if) + coordination (and, but, yet)`,
        );
        actions.push(
          "Add a dependent clause that deepens the thought (e.g., 'which suggests...', 'even though...', 'where...')",
        );
      } else if (needMoreDepth) {
        priority = s.depthMax <= 2 ? "high" : "medium";
        reason = `Shallow sentence (depth ${s.depthMax}, avg ${stats.depthMean})`;
        actions.push(
          "Add subordinate clause: relative (who, which, that), adverbial (because, although, while), or noun clause",
        );
        actions.push(
          "Expand with prepositional phrases or participial modifiers to deepen structure",
        );
      } else if (needLessUniformity && s.wordCount < 8) {
        priority = "medium";
        reason = `Very short sentence (${s.wordCount} words) contributing to uniformity`;
        actions.push(
          "Expand with detail, context, or merge with adjacent sentence",
        );
      } else if (needLessUniformity || needMoreVariance) {
        priority = "low";
        reason = `Simple sentence contributing to structural monotony`;
        actions.push(
          "Add a qualifying clause or combine with neighbor to vary sentence types",
        );
      } else {
        continue;
      }

      flagged.push({
        id: s.id,
        text: s.text,
        priority,
        reason,
        type: s.type,
        depthMax: s.depthMax,
        wordCount: s.wordCount,
        suggestedActions: actions,
        mergeCandidate,
      });

      budgetUsed++;
    } else if (
      s.type === "compound" &&
      needMoreCC &&
      s.clauseCount === 0 &&
      budgetUsed < budget
    ) {
      // Compound sentences can be upgraded to compound-complex by adding subordination
      flagged.push({
        id: s.id,
        text: s.text,
        priority: "medium",
        reason: `Compound sentence — upgrade to compound-complex by adding subordination`,
        type: s.type,
        depthMax: s.depthMax,
        wordCount: s.wordCount,
        suggestedActions: [
          "Add a subordinate clause (because, although, while, since, if) to one of the coordinated clauses",
          "Replace coordination with subordination + add new coordination elsewhere",
        ],
      });
      budgetUsed++;
    }
  }

  // Sort by priority
  const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  flagged.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.depthMax - b.depthMax; // Shallowest first
  });

  return flagged;
}

// ─── Main analysis ──────────────────────────────────────────────────────────

export async function analyzeSentenceStructure(
  text: string,
  filePath: string | null,
  prose?: ProseTargets,
): Promise<AnalysisResult> {
  // Step 1: Extract canonical sentences (markdown-filtered by default)
  const { sentences: canonicalSentences } = extractSentences(text);

  // Step 2: Run spaCy analysis on filtered text (no headings/code/frontmatter)
  const filteredText = stripMarkdownNonProse(text);
  let spacyResult: SpaCyResult;

  // Always write filtered text to temp file for spaCy
  const tmpPath = `/tmp/analyze-structure-input-${Date.now()}.txt`;
  await Bun.write(tmpPath, filteredText);
  try {
    spacyResult = await runSpaCy(tmpPath);
  } finally {
    try {
      await Bun.file(tmpPath).exists() && (await Bun.write(tmpPath, ""));
    } catch {}
  }

  // Step 3: Align sentences
  const enriched = alignSentences(canonicalSentences, spacyResult.sentences);

  // Step 4: Detect signals
  const stats = spacyResult.documentStats;
  const thresholds: StructureThresholds = {
    maxDependencyDepth: prose?.max_dependency_depth ?? DEFAULT_PROSE_TARGETS.max_dependency_depth,
    maxUniformity: prose?.max_uniformity ?? DEFAULT_PROSE_TARGETS.max_uniformity,
    minCompoundComplexRatio: prose?.min_compound_complex_ratio ?? DEFAULT_PROSE_TARGETS.min_compound_complex_ratio,
    minDepthVariance: prose?.min_depth_variance ?? DEFAULT_PROSE_TARGETS.min_depth_variance,
  };
  const signals = detectSignals(stats, thresholds);

  // Step 5: Flag sentences
  const flaggedSentences = flagSentences(enriched, signals, stats);

  // Determine primary issue and focus area
  const flaggedSignals = signals.filter((s) => s.flagged);
  let primaryIssue = "No structural issues detected";
  let suggestedFocusArea = "No action needed";

  if (flaggedSignals.length > 0) {
    // Rank by impact
    const issueRank: Record<string, number> = {
      compound_complex_ratio: 1,
      avg_depth: 2,
      depth_variance: 3,
      uniformity: 4,
    };
    flaggedSignals.sort(
      (a, b) => (issueRank[a.name] ?? 99) - (issueRank[b.name] ?? 99),
    );
    primaryIssue = flaggedSignals[0].description;

    if (flaggedSignals[0].name === "compound_complex_ratio") {
      suggestedFocusArea =
        "Merge simple sentences into compound-complex structures using subordination + coordination";
    } else if (flaggedSignals[0].name === "avg_depth") {
      suggestedFocusArea =
        "Add subordinate clauses to shallow sentences to increase dependency depth";
    } else if (flaggedSignals[0].name === "depth_variance") {
      suggestedFocusArea =
        "Vary sentence complexity: keep some short/simple, make others deeper/longer";
    } else {
      suggestedFocusArea =
        "Vary sentence lengths and types to reduce structural monotony";
    }
  }

  const criticalCount = flaggedSentences.filter((s) => s.priority === "critical").length;
  const highCount = flaggedSentences.filter((s) => s.priority === "high").length;
  const mediumCount = flaggedSentences.filter((s) => s.priority === "medium").length;
  const lowCount = flaggedSentences.filter((s) => s.priority === "low").length;

  return {
    metrics: {
      totalSentences: stats.totalSentences,
      totalWords: stats.totalWords,
      depthMean: stats.depthMean,
      depthVariance: stats.depthVariance,
      uniformityScore: stats.uniformityScore,
      compoundComplexRatio: stats.sentenceTypeRatios.compoundComplex,
      sentenceTypes: stats.sentenceTypes,
    },
    signals,
    flaggedSentences,
    summary: {
      totalFlagged: flaggedSentences.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      primaryIssue,
      suggestedFocusArea,
    },
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  (async () => {
    const { text, outFile, config } = await parseArgs(process.argv);

    const result = await analyzeSentenceStructure(text, null, config.writing_style?.prose);
    await outputResult(result, outFile);
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
