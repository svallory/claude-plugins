import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { DemoTimings } from '../../e2e/demo/define';
import { DEMO_CONFIG } from './config';
import * as ff from './ffmpeg';
import { buildSrt, padPlan, scaleTimings, SrtCue, wrapSubtitle } from './lib';
import { kickerFor, SlatePlan } from './narration';
import { renderOutroCard } from './outro-card';
import { renderSubtitleCard } from './subtitle-card';
import { renderTitleCard } from './title-card';
import { synthesize } from './tts';

/**
 * Assembly stages shared by the single-demo build (`video:build`) and the
 * merged build (`video:merge`).
 *
 * The split exists because of the merge requirement. A finished demo mp4 has
 * an opening slate and a closing outro baked in, so concatenating finished
 * videos would mean cutting narration audio back out. Instead:
 *
 *   buildSegmentBody()  slate + takes -> clips (no outro, no encode)
 *   finalizeVideo()     clips -> fade, outro slate, encode, poster, budget
 *
 * A single-demo build runs one body then finalize. A merge runs N bodies then
 * ONE finalize, so there is one intro and one outro by construction.
 *
 * Feature toggles (features.* in .claude/demo-video-skill.config.json):
 * - narration off: no TTS; every clip gets a silent audio track so
 *   concat -c copy keeps a continuous stream; pacing = footage length.
 * - subtitles off: no pill overlays (cues still land in subs.srt).
 * - titleCards off: no opening/transition slates.
 * - outro off: no fade/outro slate.
 */

export interface SegmentBody {
  clips: string[];
  cues: SrtCue[];
  durationSec: number;
  slateDurationSec: number;
}

/** Re-record a demo through the Playwright runner. */
export function recordDemo(slug: string): void {
  const [bin, ...pre] = DEMO_CONFIG.packageRunner.split(' ');
  execFileSync(
    bin,
    [...pre, 'playwright', 'test', 'e2e/demo/runner.spec.ts'],
    {
      stdio: 'inherit',
      env: { ...process.env, DEMO: slug }
    }
  );
}

/** Load a recording's raw video and take timings, failing loudly if missing. */
export function loadRecording(
  outDir: string
): { raw: string; timings: DemoTimings } {
  const raw = path.join(outDir, 'raw.webm');
  const timingsFile = path.join(outDir, 'takes.json');
  if (!fs.existsSync(raw) || !fs.existsSync(timingsFile)) {
    throw new Error(`missing ${raw} or ${timingsFile} - recording failed?`);
  }
  return { raw, timings: JSON.parse(fs.readFileSync(timingsFile, 'utf8')) };
}

/** Estimated on-screen time for a subtitle when there is no narration wav. */
function readingSec(text: string): number {
  return Math.max(1.5, text.length / 15);
}

/**
 * Render one segment: its slate (if titleCards is on) followed by every take.
 * Produces clips only - no fade, no outro, no encode - so several segments
 * can be concatenated into one video.
 *
 * `startAtSec` offsets the subtitle cue timeline so cues stay correct when
 * this segment is appended after others.
 */
export async function buildSegmentBody(opts: {
  raw: string;
  timings: DemoTimings;
  slate: SlatePlan;
  work: string;
  cacheDir: string;
  startAtSec: number;
  prefix: string;
}): Promise<SegmentBody> {
  const { raw, timings, slate, work, cacheDir, prefix } = opts;
  const { features } = DEMO_CONFIG;
  const p = (name: string) => path.join(work, `${prefix}${name}`);

  const scaled = scaleTimings(timings, DEMO_CONFIG.slowdownFactor);

  // 1. slow the whole recording (at factor 1 this is just webm -> mp4)
  const slow = p('slow.mp4');
  ff.run(ff.slowdownArgs(raw, DEMO_CONFIG.slowdownFactor, slow));
  const slowDur = ff.probeDurationSec(slow);
  const lastEnd = scaled.takes[scaled.takes.length - 1].endSec;
  // Trailing surplus is expected (context-close flush). The dangerous
  // direction is the video being SHORTER than the takes claim.
  if (slowDur < lastEnd - 0.5) {
    throw new Error(
      `${timings.slug}: takes.json end (${lastEnd.toFixed(
        2
      )}s) exceeds the slowed video (${slowDur.toFixed(
        2
      )}s) - refusing to build a desynced video`
    );
  }
  if (slowDur - lastEnd > 1.5) {
    console.log(
      `note: ${timings.slug}: ${(slowDur - lastEnd).toFixed(
        2
      )}s of trailing footage after the last take (context-close flush) - ignored`
    );
  }

  const clips: string[] = [];
  const cues: SrtCue[] = [];
  let cursor = opts.startAtSec;
  let slateDurationSec = 0;

  // 2. the slate: narrated (or silent) title card
  if (features.titleCards) {
    const slatePng = p('title.png');
    await renderTitleCard(slate.feature, slatePng, kickerFor(slate.isOpening));
    const slateClip = p('clip-title.mp4');
    if (features.narration) {
      const slateWav = synthesize(slate.narration, cacheDir);
      const slateHold = Math.max(
        DEMO_CONFIG.titleCardSeconds.min,
        ff.probeDurationSec(slateWav) + 0.5
      );
      ff.run(ff.titleCardArgs(slatePng, slateWav, slateHold, slateClip));
    } else {
      ff.run(
        ff.titleCardSilentArgs(
          slatePng,
          DEMO_CONFIG.titleCardSeconds.min,
          slateClip
        )
      );
    }
    clips.push(slateClip);
    slateDurationSec = ff.probeDurationSec(slateClip);
    cursor += slateDurationSec;
  }

  // 3. per take: split, narrate (or silence), pad, mux, subtitle
  for (const take of scaled.takes) {
    const seg = p(`seg-${take.index}.mp4`);
    ff.run(
      ff.splitArgs(slow, take.startSec, Math.min(take.endSec, slowDur), seg)
    );

    const clip = p(`clip-${take.index}.mp4`);
    let narrationSec: number;
    if (features.narration) {
      const wav = synthesize(take.narration, cacheDir);
      narrationSec = ff.probeDurationSec(wav);
      const plan = padPlan(ff.probeDurationSec(seg), narrationSec);
      let videoIn = seg;
      if (plan.padVideoSec > 0) {
        videoIn = p(`seg-${take.index}-padded.mp4`);
        ff.run(ff.padVideoArgs(seg, plan.padVideoSec, videoIn));
      }
      ff.run(ff.muxArgs(videoIn, wav, plan.padAudioSec, clip));
    } else {
      // Silent track keeps the concat audio stream continuous.
      ff.run(ff.muxSilentArgs(seg, ff.probeDurationSec(seg), clip));
      narrationSec = readingSec(take.narration);
    }
    const clipDur = ff.probeDurationSec(clip);

    // The subtitle shows only while its narration plays (+0.4s to breathe),
    // not through the whole clip's dwell. Timeline-gated overlays are
    // unreliable on some ffmpeg builds, so the window is made physical: cut
    // the clip at the narration end, overlay the pill on the first piece
    // only, and re-join.
    const subWindow = Math.min(clipDur, narrationSec + 0.4);
    cues.push({
      startSec: cursor,
      endSec: cursor + subWindow,
      text: take.narration
    });
    cursor += clipDur;

    if (!features.subtitles) {
      clips.push(clip);
      continue;
    }

    const subPng = p(`sub-${take.index}.png`);
    await renderSubtitleCard(wrapSubtitle(take.narration), subPng);
    if (clipDur - subWindow < 0.25) {
      // Narration spans (nearly) the whole clip: overlay it all.
      const subbedClip = p(`clip-${take.index}-sub.mp4`);
      ff.run(ff.subtitleOverlayArgs(clip, subPng, subbedClip));
      clips.push(subbedClip);
    } else {
      const partA = p(`clip-${take.index}-a.mp4`);
      const partB = p(`clip-${take.index}-b.mp4`);
      ff.run(ff.splitAvArgs(clip, 0, subWindow, partA));
      ff.run(ff.splitAvArgs(clip, subWindow, clipDur, partB));
      const partASub = p(`clip-${take.index}-a-sub.mp4`);
      ff.run(ff.subtitleOverlayArgs(partA, subPng, partASub));
      clips.push(partASub, partB);
    }
  }

  return {
    clips,
    cues,
    durationSec: cursor - opts.startAtSec,
    slateDurationSec
  };
}

/** Write an ffmpeg concat list file for the given clips. */
export function writeConcatList(listFile: string, clips: string[]): void {
  fs.writeFileSync(
    listFile,
    clips.map((c) => `file '${path.resolve(c)}'`).join('\n') + '\n'
  );
}

/**
 * Finish a video: concat every clip, optionally fade to black and append ONE
 * outro slate, encode, check the size budget, extract a poster, and publish
 * into the assets directory. Called exactly once per output video.
 */
export async function finalizeVideo(opts: {
  clips: string[];
  cues: SrtCue[];
  work: string;
  outSlug: string;
  posterAtSec: number;
}): Promise<string> {
  const { clips, cues, work, outSlug } = opts;
  const { features } = DEMO_CONFIG;
  const p = (name: string) => path.join(work, name);

  const listFile = p('concat.txt');
  writeConcatList(listFile, clips);
  const joined = p('joined.mp4');
  ff.run(ff.concatArgs(listFile, joined));

  let assembled = joined;
  if (features.outro) {
    // outro: fade the demo to black, then fade in the outro slate.
    const fadedMain = p('joined-faded.mp4');
    ff.run(
      ff.fadeOutArgs(
        joined,
        ff.probeDurationSec(joined),
        DEMO_CONFIG.outro.fadeSec,
        fadedMain
      )
    );
    const outroPng = p('outro.png');
    await renderOutroCard(outroPng);
    const outroClip = p('clip-outro.mp4');
    ff.run(
      ff.outroArgs(
        outroPng,
        DEMO_CONFIG.outro.seconds,
        DEMO_CONFIG.outro.fadeSec,
        outroClip
      )
    );
    const outroList = p('concat-outro.txt');
    writeConcatList(outroList, [fadedMain, outroClip]);
    assembled = p('joined-outro.mp4');
    ff.run(ff.concatArgs(outroList, assembled));
  }

  // subs.srt is kept as an inspectable timing artifact even though the
  // actual burn-in uses per-clip PNG overlays, not this file.
  fs.writeFileSync(p('subs.srt'), buildSrt(cues));

  // Finalize into the work dir first: the size budget is checked BEFORE
  // anything lands in the tracked assets directory.
  const stagedMp4 = p('final.mp4');
  const stagedPng = p('final-poster.png');
  ff.run(ff.finalizeArgs(assembled, stagedMp4));
  ff.run(ff.posterArgs(stagedMp4, opts.posterAtSec, stagedPng));

  const mb = fs.statSync(stagedMp4).size / 1024 / 1024;
  if (mb > DEMO_CONFIG.sizeBudgetMb) {
    throw new Error(
      `final video is ${mb.toFixed(1)} MB - over the ${
        DEMO_CONFIG.sizeBudgetMb
      } MB budget; shorten the demo (left in ${stagedMp4}, assets untouched)`
    );
  }

  fs.mkdirSync(DEMO_CONFIG.assetsDir, { recursive: true });
  const finalMp4 = path.join(DEMO_CONFIG.assetsDir, `${outSlug}.mp4`);
  fs.copyFileSync(stagedMp4, finalMp4);
  fs.copyFileSync(
    stagedPng,
    path.join(DEMO_CONFIG.assetsDir, `${outSlug}.png`)
  );
  console.log(
    `\nbuilt ${finalMp4} (${mb.toFixed(1)} MB, ${ff
      .probeDurationSec(finalMp4)
      .toFixed(1)}s)`
  );
  return finalMp4;
}

/** Fresh work directory for an output slug. */
export function prepareWorkDir(outDir: string): string {
  const work = path.join(outDir, 'work');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  return work;
}
