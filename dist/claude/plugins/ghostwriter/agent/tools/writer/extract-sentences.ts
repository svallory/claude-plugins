#!/usr/bin/env bun
/**
 * extract-sentences.ts
 *
 * Extracts sentences from text with sequential IDs for surgical updates.
 * Uses sentence-splitter for robust sentence boundary detection that handles
 * abbreviations (Dr., Mr., U.S.A.), decimal numbers, quotes, and ellipses.
 *
 * Usage:
 *   bun agent/tools/writer/extract-sentences.ts input.md
 *   bun agent/tools/writer/extract-sentences.ts input.md --out sentences.json
 *   echo "text" | bun agent/tools/writer/extract-sentences.ts
 *
 * Output:
 *   JSON with sentence array (id, text, start, end) and paragraph boundaries.
 */

import { split, SentenceSplitterSyntax } from "sentence-splitter";

interface Sentence {
  id: number;
  text: string;
  start: number;
  end: number;
  paragraphIndex: number;
}

/**
 * Replace a region of text with spaces of equal length to preserve character offsets.
 */
function blankOut(text: string, start: number, end: number): string {
  return text.slice(0, start) + " ".repeat(end - start) + text.slice(end);
}

/**
 * Strip non-prose markdown elements from text, replacing them with whitespace
 * of equal length so that character offsets remain stable for replace-sentences.ts.
 *
 * Removes:
 * 1. YAML frontmatter (--- delimited blocks at file start)
 * 2. Fenced code blocks (``` ... ```)
 * 3. Headings (lines starting with #)
 * 4. Block quote markers (leading > removed, text kept)
 * 5. Inline code (`...` replaced with placeholder of equal length)
 * 6. Image markdown ![alt](url) → keeps alt text, blanks syntax
 * 7. Link markdown [text](url) → keeps text, blanks syntax
 */
export function stripMarkdownNonProse(text: string): string {
  let result = text;

  // 1. YAML frontmatter at file start
  if (result.startsWith("---")) {
    const endIdx = result.indexOf("\n---", 3);
    if (endIdx !== -1) {
      const fmEnd = endIdx + 4; // include closing ---\n
      result = blankOut(result, 0, fmEnd);
    }
  }

  // 2. Fenced code blocks (``` with optional language)
  const codeBlockRe = /^(`{3,})[^\n]*\n[\s\S]*?\n\1\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRe.exec(result)) !== null) {
    result = blankOut(result, match.index, match.index + match[0].length);
  }

  // 3. Headings (lines starting with # — replace the entire line)
  const headingRe = /^#{1,6}\s+.*$/gm;
  while ((match = headingRe.exec(result)) !== null) {
    result = blankOut(result, match.index, match.index + match[0].length);
  }

  // 4. Block quote markers — remove leading > but keep the text
  // Replace each > (and optional space after) with spaces
  const bqRe = /^(>\s?)/gm;
  while ((match = bqRe.exec(result)) !== null) {
    result = blankOut(result, match.index, match.index + match[0].length);
  }

  // 5. Inline code — replace backtick-wrapped content with spaces
  // Must not match fenced code blocks (already blanked)
  const inlineCodeRe = /`([^`\n]+)`/g;
  while ((match = inlineCodeRe.exec(result)) !== null) {
    result = blankOut(result, match.index, match.index + match[0].length);
  }

  // 6. Image markdown: ![alt](url) → keep alt, blank the rest
  const imgRe = /!\[([^\]]*)\]\([^)]*\)/g;
  while ((match = imgRe.exec(result)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    const alt = match[1];
    // Blank ![ before alt
    result = blankOut(result, fullStart, fullStart + 2);
    // Blank ](url) after alt
    const afterAlt = fullStart + 2 + alt.length;
    result = blankOut(result, afterAlt, fullEnd);
  }

  // 7. Link markdown: [text](url) → keep text, blank the rest
  // Avoid matching images (already handled — the ! is blanked)
  const linkRe = /(?<!!)\[([^\]]*)\]\([^)]*\)/g;
  while ((match = linkRe.exec(result)) !== null) {
    const fullStart = match.index;
    const fullEnd = fullStart + match[0].length;
    const linkText = match[1];
    // Blank [ before text
    result = blankOut(result, fullStart, fullStart + 1);
    // Blank ](url) after text
    const afterText = fullStart + 1 + linkText.length;
    result = blankOut(result, afterText, fullEnd);
  }

  return result;
}

interface ParagraphBoundary {
  index: number;
  startSentenceId: number;
  endSentenceId: number;
  startOffset: number;
  endOffset: number;
}

interface ExtractionResult {
  sentences: Sentence[];
  paragraphs: ParagraphBoundary[];
  totalSentences: number;
  totalParagraphs: number;
}

/**
 * Split text into paragraphs by double newlines, preserving offsets.
 */
function splitParagraphs(text: string): Array<{ text: string; start: number; end: number }> {
  const paragraphs: Array<{ text: string; start: number; end: number }> = [];
  // Split on double newlines (with optional whitespace between)
  const regex = /\n\s*\n/g;
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const paraText = text.slice(lastEnd, match.index);
    if (paraText.trim()) {
      paragraphs.push({
        text: paraText,
        start: lastEnd,
        end: match.index,
      });
    }
    lastEnd = match.index + match[0].length;
  }

  // Last paragraph
  const remaining = text.slice(lastEnd);
  if (remaining.trim()) {
    paragraphs.push({
      text: remaining,
      start: lastEnd,
      end: text.length,
    });
  }

  return paragraphs;
}

/**
 * Extract sentences from text with IDs and paragraph boundaries.
 *
 * By default, markdown non-prose elements (headings, code blocks, frontmatter)
 * are stripped before sentence extraction. Character offsets in the returned
 * sentences still reference the original text, so replace-sentences.ts works.
 *
 * Pass `raw: true` to skip markdown filtering (for tools that need raw output).
 */
export function extractSentences(text: string, opts?: { raw?: boolean }): ExtractionResult {
  const processedText = opts?.raw ? text : stripMarkdownNonProse(text);
  const paragraphs = splitParagraphs(processedText);
  const sentences: Sentence[] = [];
  const paragraphBoundaries: ParagraphBoundary[] = [];
  let sentenceId = 1;

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    const paraStartId = sentenceId;
    const nodes = split(para.text);

    for (const node of nodes) {
      if (node.type === SentenceSplitterSyntax.Sentence) {
        // Reconstruct sentence text from children
        const sentenceText = node.raw || para.text.slice(
          node.range[0],
          node.range[1]
        );
        const trimmed = sentenceText.trim();
        if (!trimmed) continue;

        sentences.push({
          id: sentenceId,
          text: trimmed,
          start: para.start + node.range[0],
          end: para.start + node.range[1],
          paragraphIndex: pIdx,
        });
        sentenceId++;
      }
    }

    paragraphBoundaries.push({
      index: pIdx,
      startSentenceId: paraStartId,
      endSentenceId: sentenceId - 1,
      startOffset: para.start,
      endOffset: para.end,
    });
  }

  return {
    sentences,
    paragraphs: paragraphBoundaries,
    totalSentences: sentences.length,
    totalParagraphs: paragraphs.length,
  };
}

// CLI entry point — only runs when this file is executed directly
if (import.meta.main) {
  (async () => {
    const args = process.argv.slice(2);
    let text: string | null = null;
    let outFile: string | null = null;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--out" && args[i + 1]) {
        outFile = args[i + 1];
        i++;
      } else if (arg && !arg.startsWith("--") && text === null) {
        // Check if file
        const file = Bun.file(arg);
        if (await file.exists()) {
          text = await file.text();
        } else {
          text = arg;
        }
      }
    }

    // Try stdin
    if (text === null && !process.stdin.isTTY) {
      text = await Bun.stdin.text();
    }

    if (!text?.trim()) {
      console.error("Usage: bun extract-sentences.ts <text|file.md> [--out output.json]");
      process.exit(1);
    }

    const result = extractSentences(text);
    const output = JSON.stringify(result, null, 2);

    if (outFile) {
      await Bun.write(outFile, output);
      console.error(`Output written to: ${outFile}`);
    } else {
      console.log(output);
    }
  })().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
