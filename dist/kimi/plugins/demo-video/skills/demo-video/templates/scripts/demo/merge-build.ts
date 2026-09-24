import * as path from 'path';
import {
  buildSegmentBody,
  finalizeVideo,
  prepareWorkDir,
  recordDemo
} from './assemble';
import { parseMergeArgs, planMerge } from './merge';
import { assertSingleIntro } from './narration';

/**
 * Combine several demo recordings into ONE video.
 *
 *   npm run video:merge -- audit-logs transaction-notes --out release-0-13-0
 *
 * Produces <assetsDir>/<out-slug>.mp4 (+ .png poster) with:
 *   - one opening slate speaking "<introPhrase>: <first feature>"
 *   - a transition slate before every later feature ("Next up: <feature>"),
 *     which deliberately does NOT repeat the brand intro
 *   - one optional outro slate, at the very end
 *
 * Source recordings are read from demo-output/<slug>/ and are NOT re-recorded
 * unless --record is passed, so merging is cheap once each demo has been
 * built at least once. Narration wavs are cached by text, so re-merging the
 * same demos in a new order costs only the transition lines that changed.
 */
async function main() {
  const request = parseMergeArgs(process.argv.slice(2));

  if (request.record) {
    for (const slug of request.slugs) {
      recordDemo(slug);
    }
  }

  const plan = planMerge(request);
  // planMerge already guarantees this; re-checking here is the cheap
  // insurance that the thing actually being synthesized is the thing that
  // was validated.
  assertSingleIntro(plan.slates);

  console.log(
    `merging ${plan.segments.length} demo(s) into ${plan.outSlug}:\n` +
      plan.slates
        .map((s, i) => `  ${i + 1}. ${s.slug} - "${s.narration}"`)
        .join('\n')
  );

  const outDir = path.join('demo-output', plan.outSlug);
  const work = prepareWorkDir(outDir);
  const cacheDir = path.join('scripts', 'demo', '.cache');

  const clips: string[] = [];
  const cues = [];
  let cursor = 0;
  let posterAtSec = 0;

  for (let i = 0; i < plan.segments.length; i++) {
    const segment = plan.segments[i];
    const body = await buildSegmentBody({
      raw: segment.raw,
      timings: segment.timings,
      slate: plan.slates[i],
      work,
      cacheDir,
      startAtSec: cursor,
      prefix: `s${i}-`
    });
    clips.push(...body.clips);
    cues.push(...body.cues);
    cursor += body.durationSec;
    if (i === 0) {
      posterAtSec = body.slateDurationSec + 0.5;
    }
  }

  await finalizeVideo({
    clips,
    cues,
    work,
    outSlug: plan.outSlug,
    posterAtSec
  });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
