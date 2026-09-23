#!/usr/bin/env bun
/**
 * replace-sentences.ts
 *
 * Applies surgical sentence-level replacements to text by ID.
 * Reads extracted sentence data and applies targeted replacements
 * without affecting surrounding text.
 *
 * Usage:
 *   bun agent/tools/writer/replace-sentences.ts --source input.md --replacements replacements.json
 *   bun agent/tools/writer/replace-sentences.ts --source input.md --replacements replacements.json --out output.md
 *   echo '{"replacements":[{"id":3,"text":"New sentence."}]}' | bun agent/tools/writer/replace-sentences.ts --source input.md
 *
 * Replacements JSON format:
 *   { "replacements": [{ "id": 3, "original": "Old sentence text.", "text": "New sentence text." }] }
 *   The "original" field is optional but recommended — it enables validation and fallback matching.
 *
 * Output:
 *   JSON with updated text, diff summary, and replacement count.
 *   If --out is specified, writes the updated text to the file and returns JSON summary.
 */

import { extractSentences } from "./extract-sentences";

/**
 * Normalize whitespace for fuzzy matching.
 * Collapses multiple spaces/newlines to single space and trims.
 */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

interface Replacement {
  id: number;
  original?: string;
  text: string;
}

interface ReplacementInput {
  replacements: Replacement[];
}

interface ReplacementResult {
  updatedText: string;
  replacementsApplied: number;
  replacementsMissed: number;
  missedIds: number[];
  changes: Array<{
    id: number;
    original: string;
    replacement: string;
    matchMethod: 'id' | 'content_search' | 'fuzzy';
  }>;
  idMismatches: Array<{
    id: number;
    expected: string;
    found: string;
  }>;
}

/**
 * Apply sentence replacements by ID to the original text.
 * Works backwards from the end to preserve character offsets.
 */
export function replaceSentences(
  text: string,
  replacements: Replacement[],
): ReplacementResult {
  // Use raw mode — no markdown filtering — so offsets match the original source exactly
  const { sentences } = extractSentences(text, { raw: true });

  // Build lookup map
  const sentenceMap = new Map(sentences.map((s) => [s.id, s]));

  // Sort replacements by sentence start position (descending)
  // so we replace from end to start, preserving offsets
  const sortedReplacements = [...replacements].sort((a, b) => {
    const sentA = sentenceMap.get(a.id);
    const sentB = sentenceMap.get(b.id);
    if (!sentA || !sentB) return 0;
    return sentB.start - sentA.start;
  });

  let result = text;
  let applied = 0;
  const missedIds: number[] = [];
  const changes: ReplacementResult["changes"] = [];
  const idMismatches: ReplacementResult['idMismatches'] = [];

  for (const replacement of sortedReplacements) {
    const sentence = sentenceMap.get(replacement.id);
    if (!sentence) {
      missedIds.push(replacement.id);
      continue;
    }

    // NEW BEHAVIOR: When replacement.original is provided, validate and use fallbacks
    if (replacement.original !== undefined) {
      // Find the exact position of the sentence text in the source
      const sourceSlice = result.slice(sentence.start, sentence.end);
      const trimmedSource = sourceSlice.trim();

      // Primary: ID match with original validation
      if (trimmedSource === replacement.original) {
        // Calculate the trimmed offsets (preserve leading/trailing whitespace)
        const leadingWS = sourceSlice.length - sourceSlice.trimStart().length;
        const trailingWS = sourceSlice.length - sourceSlice.trimEnd().length;
        const replaceStart = sentence.start + leadingWS;
        const replaceEnd = sentence.end - trailingWS;

        result =
          result.slice(0, replaceStart) +
          replacement.text +
          result.slice(replaceEnd);

        changes.push({
          id: replacement.id,
          original: replacement.original,
          replacement: replacement.text,
          matchMethod: 'id',
        });
        applied++;
      } else {
        // ID mismatch detected
        idMismatches.push({
          id: replacement.id,
          expected: replacement.original,
          found: sentence.text,
        });

        // Fallback 1: Content-based search (exact)
        const idx = result.indexOf(replacement.original);
        if (idx !== -1) {
          result =
            result.slice(0, idx) +
            replacement.text +
            result.slice(idx + replacement.original.length);

          changes.push({
            id: replacement.id,
            original: replacement.original,
            replacement: replacement.text,
            matchMethod: 'content_search',
          });
          applied++;
        } else {
          // Fallback 2: Fuzzy match (normalized whitespace)
          const normalizedOriginal = normalizeWhitespace(replacement.original);
          const normalizedResult = normalizeWhitespace(result);
          const fuzzyIdx = normalizedResult.indexOf(normalizedOriginal);

          if (fuzzyIdx !== -1) {
            // Find the actual position in the non-normalized text
            // This is approximate, but should work for whitespace-only differences
            let charCount = 0;
            let actualIdx = -1;
            for (let i = 0; i < result.length; i++) {
              if (normalizeWhitespace(result.slice(0, i + 1)).length === fuzzyIdx + normalizedOriginal.length) {
                actualIdx = i + 1 - replacement.original.length;
                break;
              }
            }

            if (actualIdx !== -1 && actualIdx >= 0) {
              result =
                result.slice(0, actualIdx) +
                replacement.text +
                result.slice(actualIdx + replacement.original.length);

              changes.push({
                id: replacement.id,
                original: replacement.original,
                replacement: replacement.text,
                matchMethod: 'fuzzy',
              });
              applied++;
            } else {
              missedIds.push(replacement.id);
            }
          } else {
            missedIds.push(replacement.id);
          }
        }
      }
    } else {
      // LEGACY BEHAVIOR: When replacement.original is NOT provided
      // Find the exact position of the sentence text in the source
      const sourceSlice = result.slice(sentence.start, sentence.end);
      const trimmedSource = sourceSlice.trim();

      if (trimmedSource === sentence.text) {
        // Calculate the trimmed offsets (preserve leading/trailing whitespace)
        const leadingWS = sourceSlice.length - sourceSlice.trimStart().length;
        const trailingWS = sourceSlice.length - sourceSlice.trimEnd().length;
        const replaceStart = sentence.start + leadingWS;
        const replaceEnd = sentence.end - trailingWS;

        result =
          result.slice(0, replaceStart) +
          replacement.text +
          result.slice(replaceEnd);

        changes.push({
          id: replacement.id,
          original: sentence.text,
          replacement: replacement.text,
          matchMethod: 'id',
        });
        applied++;
      } else {
        // Offset mismatch (text was already modified or extraction differs)
        // Fallback: find the sentence text in the current result
        const idx = result.indexOf(sentence.text);
        if (idx !== -1) {
          result =
            result.slice(0, idx) +
            replacement.text +
            result.slice(idx + sentence.text.length);

          changes.push({
            id: replacement.id,
            original: sentence.text,
            replacement: replacement.text,
            matchMethod: 'content_search',
          });
          applied++;
        } else {
          missedIds.push(replacement.id);
        }
      }
    }
  }

  return {
    updatedText: result,
    replacementsApplied: applied,
    replacementsMissed: missedIds.length,
    missedIds,
    changes,
    idMismatches,
  };
}

// CLI entry point — only runs when this file is executed directly
if (import.meta.main) {
  (async () => {
    const args = process.argv.slice(2);
    let sourcePath: string | null = null;
    let replacementsPath: string | null = null;
    let outFile: string | null = null;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--source" && args[i + 1]) {
        sourcePath = args[i + 1];
        i++;
      } else if (arg === "--replacements" && args[i + 1]) {
        replacementsPath = args[i + 1];
        i++;
      } else if (arg === "--out" && args[i + 1]) {
        outFile = args[i + 1];
        i++;
      }
    }

    if (!sourcePath) {
      console.error(
        "Usage: bun replace-sentences.ts --source <file.md> --replacements <replacements.json> [--out output.md]",
      );
      console.error(
        '       echo \'{"replacements":[...]}\' | bun replace-sentences.ts --source <file.md>',
      );
      process.exit(1);
    }

    const sourceFile = Bun.file(sourcePath);
    if (!(await sourceFile.exists())) {
      console.error(`Source file not found: ${sourcePath}`);
      process.exit(1);
    }
    const text = await sourceFile.text();

    // Read replacements from file or stdin
    let replacementInput: ReplacementInput;

    if (replacementsPath) {
      const repFile = Bun.file(replacementsPath);
      if (!(await repFile.exists())) {
        console.error(`Replacements file not found: ${replacementsPath}`);
        process.exit(1);
      }
      replacementInput = JSON.parse(await repFile.text());
    } else if (!process.stdin.isTTY) {
      replacementInput = JSON.parse(await Bun.stdin.text());
    } else {
      console.error("No replacements provided. Use --replacements <file.json> or pipe JSON via stdin.");
      process.exit(1);
    }

    const result = replaceSentences(text, replacementInput.replacements);

    if (outFile) {
      // Write updated text to output file
      await Bun.write(outFile, result.updatedText);
      console.error(`Updated text written to: ${outFile}`);
      // Output summary to stdout
      console.log(
        JSON.stringify(
          {
            replacementsApplied: result.replacementsApplied,
            replacementsMissed: result.replacementsMissed,
            missedIds: result.missedIds,
            changes: result.changes,
            idMismatches: result.idMismatches,
            outputFile: outFile,
          },
          null,
          2,
        ),
      );
    } else {
      // Write source file in place if no --out
      await Bun.write(sourcePath, result.updatedText);
      console.error(`Updated text written to: ${sourcePath} (in place)`);
      console.log(
        JSON.stringify(
          {
            replacementsApplied: result.replacementsApplied,
            replacementsMissed: result.replacementsMissed,
            missedIds: result.missedIds,
            changes: result.changes,
            idMismatches: result.idMismatches,
            outputFile: sourcePath,
          },
          null,
          2,
        ),
      );
    }
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
