#!/usr/bin/env bun
/**
 * analyze-pronouns.ts
 *
 * Writer-specific pronoun analysis that identifies sentence groups with high
 * pronoun density and provides actionable data for surgical updates.
 *
 * Unlike simple per-sentence analysis, this tool groups correlated sentences
 * (pronoun + antecedent) so the Writer can make replacements with context.
 *
 * Usage:
 *   bun agent/tools/writer/analyze-pronouns.ts input.md
 *   bun agent/tools/writer/analyze-pronouns.ts input.md --target-density 7.0
 *   bun agent/tools/writer/analyze-pronouns.ts input.md --out analysis.json
 *   echo "text" | bun agent/tools/writer/analyze-pronouns.ts
 *
 * Output:
 *   JSON with sentence groups, metrics, and reduction strategies.
 */

import { extractSentences } from "./extract-sentences";
import { resolve, dirname } from "path";
import { parseArgs, outputResult } from "../lib/cli-utils";
import { DEFAULT_PROSE_TARGETS } from "../config/presets/defaults";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SpaCyPronoun {
  text: string;
  lemma: string;
  charPos: number;
  type: "personal" | "possessive" | "demonstrative" | "relative";
  tag: string;
}

interface SpaCySentence {
  index: number;
  text: string;
  start: number;
  end: number;
  wordCount: number;
  pronouns: SpaCyPronoun[];
  pronounCount: number;
  pronounDensity: number;
  nounChunks: string[];
  nounPropnCount: number;
}

interface SpaCyResult {
  sentences: SpaCySentence[];
  documentStats: {
    totalWords: number;
    totalPronouns: number;
    pronounDensity: number;
    pronounsByType: Record<string, number>;
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
  pronouns: SpaCyPronoun[];
  pronounCount: number;
  pronounDensity: number;
  nounChunks: string[];
  nounPropnCount: number;
  startsWithPronoun: boolean;
}

type GroupPriority = "critical" | "high" | "medium";

interface SentenceGroupEntry {
  id: number;
  text: string;
  role: "antecedent" | "target";
  pronounCount: number;
  pronouns?: SpaCyPronoun[];
}

interface SentenceGroup {
  groupId: number;
  priority: GroupPriority;
  reason: string;
  sentences: SentenceGroupEntry[];
  groupPronounDensity: number;
  suggestedStrategies: string[];
}

interface AnalysisMetrics {
  totalWords: number;
  totalPronouns: number;
  pronounDensity: number;
  targetDensity: number;
  excessPronouns: number;
  pronounsByType: Record<string, number>;
  reduciblePronouns: number;
}

interface AnalysisResult {
  metrics: AnalysisMetrics;
  sentenceGroups: SentenceGroup[];
  summary: {
    totalGroups: number;
    criticalGroups: number;
    highGroups: number;
    mediumGroups: number;
    estimatedReductionIfFixed: string;
  };
}

// ─── spaCy integration ───────────────────────────────────────────────────────

const TOOLS_DIR = resolve(dirname(new URL(import.meta.url).pathname), "..");

async function runSpaCy(filePath: string): Promise<SpaCyResult> {
  const proc = Bun.spawn(
    [resolve(TOOLS_DIR, "run-python.sh"), resolve(TOOLS_DIR, "writer/pos-tag-sentences.py"), filePath],
    { stdout: "pipe", stderr: "pipe" },
  );

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`pos-tag-sentences.py failed (exit ${exitCode}): ${stderr.trim()}`);
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
    pronouns: [],
    pronounCount: 0,
    pronounDensity: 0,
    nounChunks: [],
    nounPropnCount: 0,
    startsWithPronoun: false,
  }));

  // For each spaCy sentence, find the canonical sentence with the most character overlap
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
      // Merge pronoun data (handles spaCy splitting one canonical sentence into multiple)
      e.pronouns = [...e.pronouns, ...ss.pronouns];
      e.pronounCount = e.pronouns.length;
      e.pronounDensity =
        e.wordCount > 0 ? Number(((e.pronounCount / e.wordCount) * 100).toFixed(2)) : 0;
      // Merge noun chunks (deduplicate)
      for (const nc of ss.nounChunks) {
        if (!e.nounChunks.includes(nc)) e.nounChunks.push(nc);
      }
      e.nounPropnCount += ss.nounPropnCount;
    }
  }

  // Mark sentences that start with a pronoun
  const personalPronouns = new Set([
    "i", "me", "my", "mine", "myself",
    "you", "your", "yours", "yourself",
    "he", "him", "his", "himself",
    "she", "her", "hers", "herself",
    "it", "its", "itself",
    "we", "us", "our", "ours", "ourselves",
    "they", "them", "their", "theirs", "themselves",
    "this", "that", "these", "those",
  ]);

  for (const e of enriched) {
    const firstToken = e.text.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, "");
    // Handle contractions: "you'll" → "you", "it's" → "it", "that's" → "that"
    const firstWord = firstToken?.split("'")[0] ?? "";
    e.startsWithPronoun = personalPronouns.has(firstWord);
  }

  return enriched;
}

// ─── Grouping logic ─────────────────────────────────────────────────────────

function findTargetSentences(
  sentences: EnrichedSentence[],
  docAvgDensity: number,
): Set<number> {
  const targets = new Set<number>();

  for (const s of sentences) {
    const isHighDensity = s.pronounDensity > 1.5 * docAvgDensity;
    const hasMultiplePronouns = s.pronounCount >= 2;
    const startsWithPronoun = s.startsWithPronoun;

    if (isHighDensity || hasMultiplePronouns || startsWithPronoun) {
      targets.add(s.id);
    }
  }

  return targets;
}

function findAntecedent(
  targetIdx: number,
  sentences: EnrichedSentence[],
  paragraphs: Array<{ index: number; startSentenceId: number; endSentenceId: number }>,
): number | null {
  const target = sentences[targetIdx];
  const targetPara = paragraphs.find(
    (p) => target.id >= p.startSentenceId && target.id <= p.endSentenceId,
  );

  // Look backward up to 3 sentences
  let bestIdx: number | null = null;
  let bestNounScore = 0;

  for (let offset = 1; offset <= 3; offset++) {
    const checkIdx = targetIdx - offset;
    if (checkIdx < 0) break;

    const candidate = sentences[checkIdx];
    const candPara = paragraphs.find(
      (p) => candidate.id >= p.startSentenceId && candidate.id <= p.endSentenceId,
    );

    // Allow same paragraph, or 1 paragraph back
    if (targetPara && candPara) {
      if (candPara.index < targetPara.index - 1) break;
    }

    // Score: higher noun density = better antecedent
    const nounScore = candidate.nounPropnCount;
    if (nounScore > bestNounScore) {
      bestNounScore = nounScore;
      bestIdx = checkIdx;
    }
  }

  // If no good noun source found, just use the immediately preceding sentence
  if (bestIdx === null && targetIdx > 0) {
    bestIdx = targetIdx - 1;
  }

  return bestIdx;
}

interface RawGroup {
  sentenceIndices: Set<number>;
  targetIndices: Set<number>;
}

function buildGroups(
  sentences: EnrichedSentence[],
  targetIds: Set<number>,
  paragraphs: Array<{ index: number; startSentenceId: number; endSentenceId: number }>,
): RawGroup[] {
  const idToIdx = new Map<number, number>();
  sentences.forEach((s, i) => idToIdx.set(s.id, i));

  // Build initial groups: each target + its antecedent
  const rawGroups: RawGroup[] = [];

  for (const targetId of targetIds) {
    const targetIdx = idToIdx.get(targetId);
    if (targetIdx === undefined) continue;

    const antecedentIdx = findAntecedent(targetIdx, sentences, paragraphs);
    const group: RawGroup = {
      sentenceIndices: new Set([targetIdx]),
      targetIndices: new Set([targetIdx]),
    };
    if (antecedentIdx !== null && antecedentIdx !== targetIdx) {
      group.sentenceIndices.add(antecedentIdx);
    }
    rawGroups.push(group);
  }

  // Merge overlapping groups
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < rawGroups.length; i++) {
      for (let j = i + 1; j < rawGroups.length; j++) {
        const overlap = [...rawGroups[i].sentenceIndices].some((idx) =>
          rawGroups[j].sentenceIndices.has(idx),
        );
        if (overlap) {
          for (const idx of rawGroups[j].sentenceIndices) {
            rawGroups[i].sentenceIndices.add(idx);
          }
          for (const idx of rawGroups[j].targetIndices) {
            rawGroups[i].targetIndices.add(idx);
          }
          rawGroups.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  return rawGroups;
}

// ─── Priority & strategies ──────────────────────────────────────────────────

function classifyPriority(
  group: RawGroup,
  sentences: EnrichedSentence[],
): { priority: GroupPriority; reason: string } {
  const groupSentences = [...group.sentenceIndices].map((i) => sentences[i]);
  const totalPronouns = groupSentences.reduce((s, e) => s + e.pronounCount, 0);
  const totalWords = groupSentences.reduce((s, e) => s + e.wordCount, 0);
  const groupDensity = totalWords > 0 ? (totalPronouns / totalWords) * 100 : 0;
  const initialPronouns = groupSentences.filter((s) => s.startsWithPronoun).length;

  if (groupDensity > 20 || totalPronouns >= 4) {
    return {
      priority: "critical",
      reason:
        groupDensity > 20
          ? `Group pronoun density ${groupDensity.toFixed(1)}% exceeds 20%`
          : `Group has ${totalPronouns} pronouns`,
    };
  }

  if (groupDensity > 15 || initialPronouns >= 2) {
    return {
      priority: "high",
      reason:
        initialPronouns >= 2
          ? `${initialPronouns} sentences start with pronouns`
          : `Group pronoun density ${groupDensity.toFixed(1)}% exceeds 15%`,
    };
  }

  return {
    priority: "medium",
    reason: `Group pronoun density ${groupDensity.toFixed(1)}% above document threshold`,
  };
}

function suggestStrategies(
  group: RawGroup,
  sentences: EnrichedSentence[],
): string[] {
  const strategies: string[] = [];
  const targets = [...group.targetIndices].map((i) => sentences[i]);
  const antecedents = [...group.sentenceIndices]
    .filter((i) => !group.targetIndices.has(i))
    .map((i) => sentences[i]);

  // Check for sentence-initial pronouns
  const initialPronounSentences = targets.filter((t) => t.startsWithPronoun);
  if (initialPronounSentences.length > 0) {
    const antecedentNouns = antecedents.flatMap((a) => a.nounChunks).slice(0, 3);
    if (antecedentNouns.length > 0) {
      strategies.push(
        `Replace sentence-initial pronoun(s) with an antecedent noun (e.g. ${antecedentNouns.map((n) => `'${n}'`).join(", ")})`,
      );
    } else {
      strategies.push(
        "Replace sentence-initial pronoun with the specific noun it references",
      );
    }
  }

  // Check for possessive pronouns
  const possessives = targets.flatMap((t) =>
    t.pronouns.filter((p) => p.type === "possessive"),
  );
  if (possessives.length > 0) {
    strategies.push(
      "Replace possessive pronouns ('its', 'their') with the specific noun + possessive form",
    );
  }

  // Check for 'it' / 'they' chains
  const personalChains = targets.flatMap((t) =>
    t.pronouns.filter(
      (p) => p.type === "personal" && ["it", "they", "them"].includes(p.lemma),
    ),
  );
  if (personalChains.length >= 2) {
    strategies.push(
      "Break pronoun chain by restructuring sentences to use direct nouns or passive voice",
    );
  }

  // Check for demonstratives
  const demonstratives = targets.flatMap((t) =>
    t.pronouns.filter((p) => p.type === "demonstrative"),
  );
  if (demonstratives.length > 0) {
    strategies.push(
      "Replace demonstrative pronouns ('this', 'that') with 'this [noun]' or 'that [noun]'",
    );
  }

  if (strategies.length === 0) {
    strategies.push("Restructure to reduce pronoun count while preserving meaning");
  }

  return strategies;
}

// ─── Main analysis ──────────────────────────────────────────────────────────

export async function analyzePronouns(
  text: string,
  filePath: string | null,
  targetDensity: number = 5.0,
): Promise<AnalysisResult> {
  // Step 1: Extract canonical sentences
  const { sentences: canonicalSentences, paragraphs } = extractSentences(text);

  // Step 2: Run spaCy POS tagging
  let spacyResult: SpaCyResult;

  if (filePath) {
    spacyResult = await runSpaCy(filePath);
  } else {
    // Write to temp file for spaCy
    const tmpPath = `/tmp/analyze-pronouns-${Date.now()}.txt`;
    await Bun.write(tmpPath, text);
    try {
      spacyResult = await runSpaCy(tmpPath);
    } finally {
      try { await Bun.file(tmpPath).exists() && (await Bun.write(tmpPath, "")); } catch {}
    }
  }

  // Step 3: Align sentences
  const enriched = alignSentences(canonicalSentences, spacyResult.sentences);

  // Step 4: Check document-level density gate
  const docAvgDensity = spacyResult.documentStats.pronounDensity;
  const totalWords = spacyResult.documentStats.totalWords;
  const totalPronouns = spacyResult.documentStats.totalPronouns;

  // Relative and indefinite pronouns are usually fine to keep
  const relativePronouns = spacyResult.documentStats.pronounsByType.relative ?? 0;
  const indefinitePronouns = spacyResult.documentStats.pronounsByType.indefinite ?? 0;
  const reduciblePronouns = totalPronouns - relativePronouns - indefinitePronouns;

  // If document density is at or below target, no sentences need fixing
  if (docAvgDensity <= targetDensity) {
    return {
      metrics: {
        totalWords,
        totalPronouns,
        pronounDensity: Number(docAvgDensity.toFixed(1)),
        targetDensity,
        excessPronouns: 0,
        pronounsByType: spacyResult.documentStats.pronounsByType,
        reduciblePronouns,
      },
      sentenceGroups: [],
      summary: {
        totalGroups: 0,
        criticalGroups: 0,
        highGroups: 0,
        mediumGroups: 0,
        estimatedReductionIfFixed: `${docAvgDensity.toFixed(1)}% (at target)`,
      },
    };
  }

  // Step 5: Identify targets (only when over target)
  const targetIds = findTargetSentences(enriched, docAvgDensity);

  // Step 6: Group correlated sentences
  const rawGroups = buildGroups(enriched, targetIds, paragraphs);

  // Step 7: Build output groups with priority
  const excessPronouns = Math.max(
    0,
    Math.round(totalPronouns - (targetDensity / 100) * totalWords),
  );

  const sentenceGroups: SentenceGroup[] = rawGroups
    .map((rg, idx) => {
      const { priority, reason } = classifyPriority(rg, enriched);
      const groupSentences = [...rg.sentenceIndices]
        .sort((a, b) => a - b)
        .map((i) => {
          const s = enriched[i];
          const isTarget = rg.targetIndices.has(i);
          const entry: SentenceGroupEntry = {
            id: s.id,
            text: s.text,
            role: isTarget ? "target" : "antecedent",
            pronounCount: s.pronounCount,
          };
          if (isTarget && s.pronouns.length > 0) {
            entry.pronouns = s.pronouns;
          }
          return entry;
        });

      const totalGroupWords = [...rg.sentenceIndices].reduce(
        (sum, i) => sum + enriched[i].wordCount,
        0,
      );
      const totalGroupPronouns = [...rg.sentenceIndices].reduce(
        (sum, i) => sum + enriched[i].pronounCount,
        0,
      );
      const groupDensity =
        totalGroupWords > 0
          ? Number(((totalGroupPronouns / totalGroupWords) * 100).toFixed(1))
          : 0;

      return {
        groupId: idx + 1,
        priority,
        reason,
        sentences: groupSentences,
        groupPronounDensity: groupDensity,
        suggestedStrategies: suggestStrategies(rg, enriched),
      };
    })
    // Sort by priority: critical > high > medium, then by density desc
    .sort((a, b) => {
      const order: Record<GroupPriority, number> = { critical: 0, high: 1, medium: 2 };
      if (order[a.priority] !== order[b.priority]) {
        return order[a.priority] - order[b.priority];
      }
      return b.groupPronounDensity - a.groupPronounDensity;
    });

  // Re-number after sort
  sentenceGroups.forEach((g, i) => (g.groupId = i + 1));

  // Budget: stop recommending groups once cumulative reduction would bring document below target
  let cumulativeReduction = 0;
  const budgetedGroups: SentenceGroup[] = [];
  for (const group of sentenceGroups) {
    if (cumulativeReduction >= excessPronouns && budgetedGroups.length > 0) break;
    budgetedGroups.push(group);
    // Estimate: each target sentence can lose ~50% of its pronouns
    const groupTargetPronouns = group.sentences
      .filter((s) => s.role === "target")
      .reduce((sum, s) => sum + s.pronounCount, 0);
    cumulativeReduction += Math.ceil(groupTargetPronouns * 0.5);
  }

  const criticalCount = budgetedGroups.filter((g) => g.priority === "critical").length;
  const highCount = budgetedGroups.filter((g) => g.priority === "high").length;
  const mediumCount = budgetedGroups.filter((g) => g.priority === "medium").length;

  // Estimate resulting density
  const estimatedRemoved = Math.min(cumulativeReduction, excessPronouns + 5);
  const estimatedNewDensity =
    totalWords > 0
      ? (((totalPronouns - estimatedRemoved) / totalWords) * 100).toFixed(1)
      : "0.0";

  return {
    metrics: {
      totalWords,
      totalPronouns,
      pronounDensity: Number(docAvgDensity.toFixed(1)),
      targetDensity,
      excessPronouns,
      pronounsByType: spacyResult.documentStats.pronounsByType,
      reduciblePronouns,
    },
    sentenceGroups: budgetedGroups,
    summary: {
      totalGroups: budgetedGroups.length,
      criticalGroups: criticalCount,
      highGroups: highCount,
      mediumGroups: mediumCount,
      estimatedReductionIfFixed: `${docAvgDensity.toFixed(1)}% → ~${estimatedNewDensity}%`,
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
    let targetDensity = config.writing_style?.prose?.pronoun_density
      ?? DEFAULT_PROSE_TARGETS.pronoun_density;
    if (extraArgs["--target-density"]) {
      targetDensity = parseFloat(extraArgs["--target-density"]);
    }

    const result = await analyzePronouns(text, null, targetDensity);
    await outputResult(result, outFile);
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
