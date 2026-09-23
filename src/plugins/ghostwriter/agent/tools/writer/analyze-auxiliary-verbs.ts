#!/usr/bin/env bun
/**
 * analyze-auxiliary-verbs.ts
 *
 * Writer-specific auxiliary verb analysis that identifies sentences with high
 * auxiliary verb density and provides actionable data for surgical updates.
 *
 * Auxiliary verbs flagged by detection: is, are, was, were, be, been, being,
 * have, has, had, do, does, did, will, would, shall, should, can, could, may,
 * might, must.
 *
 * Usage:
 *   bun agent/tools/writer/analyze-auxiliary-verbs.ts input.md
 *   bun agent/tools/writer/analyze-auxiliary-verbs.ts input.md --target-density 5.0
 *   bun agent/tools/writer/analyze-auxiliary-verbs.ts input.md --out analysis.json
 *   echo "text" | bun agent/tools/writer/analyze-auxiliary-verbs.ts
 *
 * Output:
 *   JSON with flagged sentences, metrics, and replacement suggestions.
 */

import { extractSentences } from "./extract-sentences";
import { resolve, dirname } from "path";
import { parseArgs, outputResult } from "../lib/cli-utils";
import { DEFAULT_PROSE_TARGETS } from "../config/presets/defaults";

// --- Types ---

interface SpaCyToken {
  text: string;
  lemma: string;
  pos: string;
  tag: string;
  dep: string;
  charPos: number;
}

interface SpaCySentence {
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount: number;
  tokens: SpaCyToken[];
  auxiliaryVerbs: SpaCyToken[];
  auxiliaryCount: number;
  auxiliaryDensity: number;
}

interface SpaCyResult {
  sentences: SpaCySentence[];
  documentStats: {
    totalWords: number;
    totalAuxiliaries: number;
    auxiliaryDensity: number;
    auxiliariesByLemma: Record<string, number>;
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
  auxiliaryVerbs: SpaCyToken[];
  auxiliaryCount: number;
  auxiliaryDensity: number;
  patterns: AuxiliaryPattern[];
}

type PatternType =
  | "progressive"      // is/was/are/were + -ing
  | "passive"          // is/was/are/were + past participle
  | "perfect"          // has/have/had + past participle
  | "modal"            // will/would/can/could/may/might/must/shall/should
  | "modal_perfect"    // modal + have + past participle
  | "do_emphasis"      // do/does/did for emphasis or questions
  | "other";

interface AuxiliaryPattern {
  type: PatternType;
  auxiliaries: string[];
  fullPhrase: string;
  suggestion: string;
}

type Priority = "critical" | "high" | "medium" | "low";

interface FlaggedSentence {
  id: number;
  text: string;
  priority: Priority;
  reason: string;
  auxiliaryCount: number;
  auxiliaryDensity: number;
  auxiliaries: string[];
  patterns: AuxiliaryPattern[];
  suggestedRewrites: string[];
}

interface AnalysisMetrics {
  totalWords: number;
  totalAuxiliaries: number;
  auxiliaryDensity: number;
  targetDensity: number;
  excessAuxiliaries: number;
  auxiliariesByLemma: Record<string, number>;
  topOffenders: string[];
}

interface AnalysisResult {
  metrics: AnalysisMetrics;
  flaggedSentences: FlaggedSentence[];
  summary: {
    totalFlagged: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    estimatedReductionIfFixed: string;
  };
}

// --- spaCy integration ---

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

# Auxiliary verb lemmas
AUX_LEMMAS = {
    "be", "have", "do", "will", "would", "shall", "should",
    "can", "could", "may", "might", "must"
}

def analyze(text):
    doc = nlp(text)
    sentences = []
    total_aux = 0
    total_words = 0
    by_lemma = {}

    for idx, sent in enumerate(doc.sents):
        sent_text = sent.text.strip()
        if not sent_text:
            continue

        tokens = []
        auxiliaries = []
        word_count = 0

        for token in sent:
            if token.is_punct or token.is_space:
                continue
            word_count += 1

            tok_data = {
                "text": token.text,
                "lemma": token.lemma_.lower(),
                "pos": token.pos_,
                "tag": token.tag_,
                "dep": token.dep_,
                "charPos": token.idx - sent.start_char,
            }
            tokens.append(tok_data)

            # Check if it's an auxiliary verb
            if token.pos_ == "AUX" or (token.lemma_.lower() in AUX_LEMMAS and token.dep_ == "aux"):
                auxiliaries.append(tok_data)
                lemma = token.lemma_.lower()
                by_lemma[lemma] = by_lemma.get(lemma, 0) + 1

        total_words += word_count
        total_aux += len(auxiliaries)

        sentences.append({
            "index": idx,
            "text": sent_text,
            "start": sent.start_char,
            "end": sent.end_char,
            "wordCount": word_count,
            "tokens": tokens,
            "auxiliaryVerbs": auxiliaries,
            "auxiliaryCount": len(auxiliaries),
            "auxiliaryDensity": round((len(auxiliaries) / word_count * 100) if word_count > 0 else 0.0, 2),
        })

    return {
        "sentences": sentences,
        "documentStats": {
            "totalWords": total_words,
            "totalAuxiliaries": total_aux,
            "auxiliaryDensity": round((total_aux / total_words * 100) if total_words > 0 else 0.0, 2),
            "auxiliariesByLemma": by_lemma,
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

  // Write temp Python script
  const tmpScript = `/tmp/analyze-aux-${Date.now()}.py`;
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

// --- Pattern detection ---

function detectPatterns(sentence: SpaCySentence): AuxiliaryPattern[] {
  const patterns: AuxiliaryPattern[] = [];
  const tokens = sentence.tokens;
  const auxVerbs = sentence.auxiliaryVerbs;

  for (const aux of auxVerbs) {
    const auxIdx = tokens.findIndex(t => t.charPos === aux.charPos);
    if (auxIdx < 0) continue;

    const nextToken = tokens[auxIdx + 1];
    const nextNextToken = tokens[auxIdx + 2];
    const lemma = aux.lemma.toLowerCase();

    // Progressive: be + -ing
    if (["be", "is", "are", "was", "were", "am"].includes(lemma)) {
      if (nextToken?.tag === "VBG") {
        patterns.push({
          type: "progressive",
          auxiliaries: [aux.text],
          fullPhrase: `${aux.text} ${nextToken.text}`,
          suggestion: `Use simple tense: "${convertProgressiveToSimple(aux.text, nextToken.text)}"`,
        });
        continue;
      }
      // Passive: be + past participle
      if (nextToken?.tag === "VBN") {
        patterns.push({
          type: "passive",
          auxiliaries: [aux.text],
          fullPhrase: `${aux.text} ${nextToken.text}`,
          suggestion: `Use active voice or simple past: consider restructuring`,
        });
        continue;
      }
    }

    // Perfect: have + past participle
    if (["have", "has", "had"].includes(lemma)) {
      if (nextToken?.tag === "VBN") {
        patterns.push({
          type: "perfect",
          auxiliaries: [aux.text],
          fullPhrase: `${aux.text} ${nextToken.text}`,
          suggestion: `Use simple past: "${convertPerfectToSimple(nextToken.text)}"`,
        });
        continue;
      }
    }

    // Modal
    if (["will", "would", "can", "could", "may", "might", "must", "shall", "should"].includes(lemma)) {
      // Modal + have + past participle
      if (nextToken?.lemma === "have" && nextNextToken?.tag === "VBN") {
        patterns.push({
          type: "modal_perfect",
          auxiliaries: [aux.text, nextToken.text],
          fullPhrase: `${aux.text} ${nextToken.text} ${nextNextToken.text}`,
          suggestion: `Simplify: consider past tense or direct assertion`,
        });
        continue;
      }
      // Plain modal
      patterns.push({
        type: "modal",
        auxiliaries: [aux.text],
        fullPhrase: aux.text + (nextToken ? ` ${nextToken.text}` : ""),
        suggestion: getModalSuggestion(lemma, nextToken?.text),
      });
      continue;
    }

    // Do emphasis/question
    if (["do", "does", "did"].includes(lemma)) {
      patterns.push({
        type: "do_emphasis",
        auxiliaries: [aux.text],
        fullPhrase: aux.text + (nextToken ? ` ${nextToken.text}` : ""),
        suggestion: `Remove "do" auxiliary if not needed for emphasis`,
      });
      continue;
    }

    // Other
    patterns.push({
      type: "other",
      auxiliaries: [aux.text],
      fullPhrase: aux.text,
      suggestion: `Review auxiliary usage`,
    });
  }

  return patterns;
}

function convertProgressiveToSimple(aux: string, verb: string): string {
  // "is running" -> "runs", "was running" -> "ran"
  const base = verb.replace(/ing$/, "");
  if (["was", "were"].includes(aux.toLowerCase())) {
    return base + "ed"; // Simplified
  }
  return base + "s";
}

function convertPerfectToSimple(pastParticiple: string): string {
  // "has completed" -> "completed"
  return pastParticiple;
}

function getModalSuggestion(modal: string, nextVerb?: string): string {
  const suggestions: Record<string, string> = {
    would: "Use simple past or present for direct assertion",
    could: "Use 'can' or make direct statement",
    might: "Consider 'may' or direct assertion",
    should: "Use imperative or direct statement",
    will: "Use present tense for immediacy",
    can: "Consider if modal is necessary",
    may: "Use direct statement if certainty exists",
    must: "Appropriate for strong necessity",
  };
  return suggestions[modal] || "Review modal necessity";
}

// --- Sentence alignment ---

function alignSentences(
  canonical: CanonicalSentence[],
  spacy: SpaCySentence[],
): EnrichedSentence[] {
  const enriched: EnrichedSentence[] = canonical.map((cs) => ({
    ...cs,
    wordCount: cs.text.split(/\s+/).filter(Boolean).length,
    auxiliaryVerbs: [],
    auxiliaryCount: 0,
    auxiliaryDensity: 0,
    patterns: [],
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
      e.auxiliaryVerbs = [...e.auxiliaryVerbs, ...ss.auxiliaryVerbs];
      e.auxiliaryCount = e.auxiliaryVerbs.length;
      e.auxiliaryDensity =
        e.wordCount > 0 ? Number(((e.auxiliaryCount / e.wordCount) * 100).toFixed(2)) : 0;
      e.patterns = [...e.patterns, ...detectPatterns(ss)];
    }
  }

  return enriched;
}

// --- Priority classification ---

function classifyPriority(sentence: EnrichedSentence, docAvgDensity: number): { priority: Priority; reason: string } {
  const density = sentence.auxiliaryDensity;
  const count = sentence.auxiliaryCount;

  if (density > 15 || count >= 4) {
    return {
      priority: "critical",
      reason: density > 15
        ? `Auxiliary density ${density}% exceeds 15%`
        : `${count} auxiliaries in single sentence`,
    };
  }

  if (density > 10 || count >= 3) {
    return {
      priority: "high",
      reason: density > 10
        ? `Auxiliary density ${density}% exceeds 10%`
        : `${count} auxiliaries in sentence`,
    };
  }

  if (density > docAvgDensity * 1.5 || count >= 2) {
    return {
      priority: "medium",
      reason: density > docAvgDensity * 1.5
        ? `Auxiliary density ${density}% is 1.5x document average`
        : `Multiple auxiliaries (${count})`,
    };
  }

  return {
    priority: "low",
    reason: `Single auxiliary, density ${density}%`,
  };
}

// --- Generate rewrite suggestions ---

function generateSuggestions(sentence: EnrichedSentence): string[] {
  const suggestions: string[] = [];

  const patternTypes = new Set(sentence.patterns.map(p => p.type));

  if (patternTypes.has("progressive")) {
    suggestions.push("Convert progressive to simple tense (e.g., 'is running' -> 'runs')");
  }
  if (patternTypes.has("passive")) {
    suggestions.push("Convert passive to active voice (e.g., 'was broken by X' -> 'X broke')");
  }
  if (patternTypes.has("perfect")) {
    suggestions.push("Use simple past instead of perfect (e.g., 'has occurred' -> 'occurred')");
  }
  if (patternTypes.has("modal")) {
    suggestions.push("Replace modal with direct assertion (e.g., 'would fail' -> 'fails')");
  }
  if (patternTypes.has("modal_perfect")) {
    suggestions.push("Simplify modal perfect construction (e.g., 'could have been' -> 'was')");
  }
  if (patternTypes.has("do_emphasis")) {
    suggestions.push("Remove do-support if not needed for emphasis");
  }

  if (suggestions.length === 0) {
    suggestions.push("Review and restructure to reduce auxiliary verb usage");
  }

  return suggestions;
}

// --- Main analysis ---

export async function analyzeAuxiliaryVerbs(
  text: string,
  filePath: string | null,
  targetDensity: number = 3.0,
): Promise<AnalysisResult> {
  // Step 1: Extract canonical sentences
  const { sentences: canonicalSentences } = extractSentences(text);

  // Step 2: Run spaCy analysis
  let spacyResult: SpaCyResult;

  if (filePath) {
    spacyResult = await runSpaCy(filePath);
  } else {
    const tmpPath = `/tmp/analyze-aux-input-${Date.now()}.txt`;
    await Bun.write(tmpPath, text);
    try {
      spacyResult = await runSpaCy(tmpPath);
    } finally {
      try { await Bun.file(tmpPath).exists() && (await Bun.write(tmpPath, "")); } catch {}
    }
  }

  // Step 3: Align sentences
  const enriched = alignSentences(canonicalSentences, spacyResult.sentences);

  // Step 4: Calculate metrics
  const totalWords = spacyResult.documentStats.totalWords;
  const totalAux = spacyResult.documentStats.totalAuxiliaries;
  const docDensity = spacyResult.documentStats.auxiliaryDensity;
  const excessAux = Math.max(0, Math.round(totalAux - (targetDensity / 100) * totalWords));

  // Find top offending lemmas
  const byLemma = spacyResult.documentStats.auxiliariesByLemma;
  const topOffenders = Object.entries(byLemma)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lemma, count]) => `${lemma} (${count})`);

  // Step 5: Flag sentences ONLY if document exceeds target density
  const budgeted: FlaggedSentence[] = [];
  let cumulativeReduction = 0;

  if (docDensity > targetDensity) {
    // Sort candidates by contribution: highest auxiliary count first, then density
    const candidates = enriched
      .filter(s => s.auxiliaryCount > 0)
      .sort((a, b) => {
        if (b.auxiliaryCount !== a.auxiliaryCount) return b.auxiliaryCount - a.auxiliaryCount;
        return b.auxiliaryDensity - a.auxiliaryDensity;
      });

    for (const sentence of candidates) {
      if (cumulativeReduction >= excessAux && budgeted.length > 0) break;

      const { priority, reason } = classifyPriority(sentence, docDensity);
      budgeted.push({
        id: sentence.id,
        text: sentence.text,
        priority,
        reason,
        auxiliaryCount: sentence.auxiliaryCount,
        auxiliaryDensity: sentence.auxiliaryDensity,
        auxiliaries: sentence.auxiliaryVerbs.map(a => a.text),
        patterns: sentence.patterns,
        suggestedRewrites: generateSuggestions(sentence),
      });
      cumulativeReduction += Math.min(sentence.auxiliaryCount, 2);
    }

    // Sort output by priority then density
    const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    budgeted.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.auxiliaryDensity - a.auxiliaryDensity;
    });
  }

  // Summary counts
  const criticalCount = budgeted.filter(s => s.priority === "critical").length;
  const highCount = budgeted.filter(s => s.priority === "high").length;
  const mediumCount = budgeted.filter(s => s.priority === "medium").length;
  const lowCount = budgeted.filter(s => s.priority === "low").length;

  // Estimate new density
  const estimatedRemoved = Math.min(cumulativeReduction, excessAux + 3);
  const estimatedNewDensity = totalWords > 0
    ? (((totalAux - estimatedRemoved) / totalWords) * 100).toFixed(1)
    : "0.0";

  return {
    metrics: {
      totalWords,
      totalAuxiliaries: totalAux,
      auxiliaryDensity: Number(docDensity.toFixed(2)),
      targetDensity,
      excessAuxiliaries: excessAux,
      auxiliariesByLemma: byLemma,
      topOffenders,
    },
    flaggedSentences: budgeted,
    summary: {
      totalFlagged: budgeted.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      estimatedReductionIfFixed: `${docDensity.toFixed(1)}% -> ~${estimatedNewDensity}%`,
    },
  };
}

// --- CLI ---

if (import.meta.main) {
  (async () => {
    const { text, outFile, config, extraArgs } = await parseArgs(
      process.argv,
      ["--target-density"],
    );

    // Priority: CLI flag > config > default
    let targetDensity = config.writing_style?.prose?.auxiliary_density
      ?? DEFAULT_PROSE_TARGETS.auxiliary_density;
    if (extraArgs["--target-density"]) {
      targetDensity = parseFloat(extraArgs["--target-density"]);
    }

    const result = await analyzeAuxiliaryVerbs(text, null, targetDensity);
    await outputResult(result, outFile);
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
