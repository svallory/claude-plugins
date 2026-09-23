import * as path from 'path';
import {
  buildSegmentBody,
  finalizeVideo,
  loadRecording,
  prepareWorkDir,
  recordDemo
} from './assemble';
import { openingNarration } from './narration';

/**
 * Assemble a demo video from a recording. Usage: npm run video:build -- <slug>
 * Records first (via the Playwright runner) unless demo-output/<slug> already
 * has a fresh raw.webm and --no-record is passed.
 *
 * To combine several demos into one video (one intro, one outro, a transition
 * slate between features) use `npm run video:merge` instead - see
 * scripts/demo/merge-build.ts and docs/demo-videos.md.
 */
async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const positionals = args.filter((a) => !a.startsWith('--'));
  if (positionals.length !== 1) {
    throw new Error(
      `usage: npm run video:build -- <slug> [--no-record] (got ${
        positionals.length
      } slugs: ${positionals.join(', ') || 'none'})`
    );
  }
  const slug = positionals[0];
  const outDir = path.join('demo-output', slug);
  const cacheDir = path.join('scripts', 'demo', '.cache');

  if (!args.includes('--no-record')) {
    recordDemo(slug);
  }

  const { raw, timings } = loadRecording(outDir);
  const work = prepareWorkDir(outDir);

  const body = await buildSegmentBody({
    raw,
    timings,
    slate: {
      slug,
      feature: timings.feature,
      narration: openingNarration(timings.feature),
      isOpening: true
    },
    work,
    cacheDir,
    startAtSec: 0,
    prefix: ''
  });

  await finalizeVideo({
    clips: body.clips,
    cues: body.cues,
    work,
    outSlug: slug,
    posterAtSec: body.slateDurationSec + 0.5
  });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
