import * as fs from 'fs';
import * as path from 'path';
import { DemoTimings } from '../../e2e/demo/define';
import { planSlates, SlatePlan } from './narration';

/**
 * Planning for merged demo videos: turning CLI arguments and on-disk
 * recordings into an ordered, validated plan. Everything here is pure or
 * filesystem-read-only - no ffmpeg, no TTS - so the interesting rules
 * (ordering, missing segments, output naming) are covered by fast unit tests.
 *
 * The rendering half lives in build.ts.
 */

/** Output slug rules: lowercase kebab-case, safe as a filename. */
const SLUG_RE = /^[a-z0-9-]+$/;

export interface MergeRequest {
  /** Source demo slugs, in the order they should play. */
  slugs: string[];
  /** Output slug: <assetsDir>/<outSlug>.mp4 */
  outSlug: string;
  /** Re-record each source demo before merging. */
  record: boolean;
}

/**
 * Parse `npm run video:merge -- <slug> <slug> [...] --out <out-slug>`.
 *
 * Order is significant and taken verbatim from the command line: the merge
 * never sorts or de-duplicates behind your back, because "which feature plays
 * first" is an editorial decision, not something a script should guess.
 *
 * `--out` is required. Defaulting it (to a join of the inputs, say) would mint
 * asset filenames nobody chose and that no What's New entry references.
 */
export function parseMergeArgs(argv: string[]): MergeRequest {
  const args = argv.filter((a) => a !== '--');
  const slugs: string[] = [];
  let outSlug: string | undefined;
  let record = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') {
      outSlug = args[++i];
      if (outSlug === undefined || outSlug.startsWith('--')) {
        throw new Error('--out needs a value, e.g. --out release-0-13-0');
      }
    } else if (a === '--record') {
      record = true;
    } else if (a.startsWith('--')) {
      throw new Error(
        `unknown flag ${a} (usage: npm run video:merge -- <slug>... --out <out-slug> [--record])`
      );
    } else {
      slugs.push(a);
    }
  }

  if (slugs.length === 0) {
    throw new Error(
      'usage: npm run video:merge -- <slug>... --out <out-slug> [--record]'
    );
  }
  if (!outSlug) {
    throw new Error(
      'missing --out <out-slug>: the merged video needs its own name, e.g. --out release-0-13-0'
    );
  }
  for (const s of [...slugs, outSlug]) {
    if (!SLUG_RE.test(s)) {
      throw new Error(
        `"${s}" is not a valid slug - lowercase letters, digits and dashes only (the What's New video path regex depends on this)`
      );
    }
  }
  if (slugs.includes(outSlug)) {
    throw new Error(
      `--out ${outSlug} is also a source slug - the merge would overwrite the segment it reads`
    );
  }

  return { slugs, outSlug, record };
}

/** A recorded source demo, located and validated on disk. */
export interface LocatedSegment {
  slug: string;
  feature: string;
  /** demo-output/<slug>/raw.webm */
  raw: string;
  /** demo-output/<slug>/takes.json, already parsed */
  timings: DemoTimings;
}

/** Everything the renderer needs, in play order. */
export interface MergePlan {
  outSlug: string;
  segments: LocatedSegment[];
  /** One slate per segment; exactly one carries the brand intro. */
  slates: SlatePlan[];
}

/**
 * Locate every source recording and build the ordered plan.
 *
 * A merge is only ever as good as its inputs, so a missing or unreadable
 * recording is fatal and names the fix (`npm run video:build -- <slug>`)
 * rather than quietly dropping a feature from the video - a silently short
 * video is far worse than a failed build, because nobody re-watches a merge
 * they already reviewed.
 *
 * `readDir` is injectable so tests can plan against fixtures without a
 * demo-output tree.
 */
export function planMerge(
  request: MergeRequest,
  demoOutputRoot = 'demo-output',
  io: MergeIo = nodeMergeIo
): MergePlan {
  const segments = request.slugs.map((slug) => {
    const dir = path.join(demoOutputRoot, slug);
    const raw = path.join(dir, 'raw.webm');
    const takes = path.join(dir, 'takes.json');
    if (!io.exists(raw) || !io.exists(takes)) {
      throw new Error(
        `no recording for "${slug}" (expected ${raw} and ${takes}) - run \`npm run video:build -- ${slug}\` first, or pass --record`
      );
    }
    const timings = io.readTimings(takes);
    if (timings.slug !== slug) {
      throw new Error(
        `${takes} is a recording of "${timings.slug}", not "${slug}" - stale demo-output directory?`
      );
    }
    if (!timings.takes || timings.takes.length === 0) {
      throw new Error(`${takes} has no takes - re-record "${slug}"`);
    }
    return { slug, feature: timings.feature, raw, timings };
  });

  return {
    outSlug: request.outSlug,
    segments,
    slates: planSlates(segments)
  };
}

/** Filesystem seam, so planMerge is testable without fixtures on disk. */
export interface MergeIo {
  exists(p: string): boolean;
  readTimings(p: string): DemoTimings;
}

export const nodeMergeIo: MergeIo = {
  exists: (p) => fs.existsSync(p),
  readTimings: (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
};
