import { execFileSync } from 'child_process';

const ENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20'];

export function run(args: string[]): void {
  execFileSync('ffmpeg', ['-y', ...args], {
    stdio: ['ignore', 'ignore', 'inherit']
  });
}

export function probeDurationSec(file: string): number {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' }
  ).trim();
  const dur = Number(out);
  if (!Number.isFinite(dur) || dur <= 0)
    throw new Error(`ffprobe returned "${out}" for ${file}`);
  return dur;
}

export function slowdownArgs(
  inFile: string,
  factor: number,
  outFile: string
): string[] {
  return [
    '-i',
    inFile,
    '-filter:v',
    `setpts=${factor}*PTS`,
    '-an',
    ...ENC,
    outFile
  ];
}

export function splitArgs(
  inFile: string,
  startSec: number,
  endSec: number,
  outFile: string
): string[] {
  return [
    '-ss',
    String(startSec),
    '-to',
    String(endSec),
    '-i',
    inFile,
    ...ENC,
    outFile
  ];
}

export function padVideoArgs(
  inFile: string,
  padSec: number,
  outFile: string
): string[] {
  return [
    '-i',
    inFile,
    '-vf',
    `tpad=stop_mode=clone:stop_duration=${padSec}`,
    ...ENC,
    outFile
  ];
}

export function muxArgs(
  videoFile: string,
  audioFile: string,
  padAudioSec: number,
  outFile: string
): string[] {
  const audioPad =
    padAudioSec > 0 ? ['-af', `apad=pad_dur=${padAudioSec}`] : [];
  return [
    '-i',
    videoFile,
    '-i',
    audioFile,
    ...audioPad,
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    outFile
  ];
}

export function titleCardArgs(
  pngFile: string,
  wavFile: string,
  holdSec: number,
  outFile: string
): string[] {
  return [
    '-loop',
    '1',
    '-t',
    String(holdSec),
    '-i',
    pngFile,
    '-i',
    wavFile,
    '-vf',
    'scale=1280:720,format=yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-tune',
    'stillimage',
    '-c:a',
    'aac',
    '-shortest',
    outFile
  ];
}

export function concatArgs(listFile: string, outFile: string): string[] {
  return ['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outFile];
}

/**
 * Cut a segment out of a clip that has BOTH audio and video (splitArgs is
 * video-only; it predates clips carrying narration). Used to bound each
 * subtitle to its narration window: the clip is cut at the narration end,
 * the pill is overlaid on the first piece only, and the pieces are re-joined.
 */
export function splitAvArgs(
  inFile: string,
  startSec: number,
  endSec: number,
  outFile: string
): string[] {
  return [
    '-ss',
    String(startSec),
    '-to',
    String(endSec),
    '-i',
    inFile,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-c:a',
    'aac',
    outFile
  ];
}

/**
 * Fade the tail of a clip to black (video) and silence (audio), re-encoding
 * with the pipeline's standard codecs so concat -c copy stays valid.
 */
export function fadeOutArgs(
  inFile: string,
  durSec: number,
  fadeSec: number,
  outFile: string
): string[] {
  const start = Math.max(0, durSec - fadeSec);
  return [
    '-i',
    inFile,
    '-vf',
    `fade=t=out:st=${start}:d=${fadeSec}`,
    '-af',
    `afade=t=out:st=${start}:d=${fadeSec}`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-c:a',
    'aac',
    outFile
  ];
}

/**
 * Outro slate clip: the logo card fading in from black, with a silent audio
 * track (anullsrc matched to the narration's 24kHz mono) so concat -c copy
 * keeps a continuous audio stream.
 */
export function outroArgs(
  pngFile: string,
  durSec: number,
  fadeSec: number,
  outFile: string
): string[] {
  return [
    '-loop',
    '1',
    '-t',
    String(durSec),
    '-i',
    pngFile,
    '-f',
    'lavfi',
    '-t',
    String(durSec),
    '-i',
    'anullsrc=r=24000:cl=mono',
    '-vf',
    `scale=1280:720,format=yuv420p,fade=t=in:st=0:d=${fadeSec}`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-tune',
    'stillimage',
    '-c:a',
    'aac',
    '-shortest',
    outFile
  ];
}

/**
 * Burns one subtitle PNG (full-frame, transparent except the cue's pill)
 * over an entire clip - unconditionally, no timeline `enable` gating. The
 * local ffmpeg bottle has no libass/freetype (no `subtitles` or `drawtext`
 * filter) - see the spec amendment - so subtitles are burned via `overlay`
 * instead of the `subtitles` filter. An earlier version tried to overlay all
 * cues onto the single concatenated video with
 * `enable='between(t,start,end)'` windows on this build's `overlay` filter:
 * unescaped commas inside the expression get silently misparsed by the
 * filtergraph parser (no error, overlay just never activates), and this
 * ffmpeg build's timeline gating proved unreliable in general even once
 * that was fixed. Burning per-clip sidesteps timeline gating entirely: the
 * cue's visible window IS the clip's duration, exact by construction, and
 * it also removes any dependency on the take-boundary split being
 * frame-precise.
 */
export function subtitleOverlayArgs(
  videoFile: string,
  pngFile: string,
  outFile: string
): string[] {
  return [
    '-i',
    videoFile,
    '-i',
    pngFile,
    '-filter_complex',
    '[0:v][1:v]overlay=0:0[v]',
    '-map',
    '[v]',
    '-map',
    '0:a',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-c:a',
    'copy',
    outFile
  ];
}

/**
 * Give a video-only clip a silent audio track (anullsrc matched to the
 * narration pipeline's 24kHz mono) so concat -c copy keeps a continuous
 * audio stream when narration is disabled.
 */
export function muxSilentArgs(
  videoFile: string,
  durSec: number,
  outFile: string
): string[] {
  return [
    '-i',
    videoFile,
    '-f',
    'lavfi',
    '-t',
    String(durSec),
    '-i',
    'anullsrc=r=24000:cl=mono',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-shortest',
    outFile
  ];
}

/** Title-card clip with a silent audio track, for narration-off builds. */
export function titleCardSilentArgs(
  pngFile: string,
  holdSec: number,
  outFile: string
): string[] {
  return [
    '-loop',
    '1',
    '-t',
    String(holdSec),
    '-i',
    pngFile,
    '-f',
    'lavfi',
    '-t',
    String(holdSec),
    '-i',
    'anullsrc=r=24000:cl=mono',
    '-vf',
    'scale=1280:720,format=yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-tune',
    'stillimage',
    '-c:a',
    'aac',
    '-shortest',
    outFile
  ];
}

export function finalizeArgs(inFile: string, outFile: string): string[] {
  return [
    '-i',
    inFile,
    '-vf',
    'scale=1280:720',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '26',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outFile
  ];
}

/**
 * Poster frame, downscaled to 960px wide: a full-frame 1280x720 PNG weighs
 * ~250KB and ships to every client before playback; 960 matches the player's
 * max rendered width.
 */
export function posterArgs(
  inFile: string,
  atSec: number,
  outFile: string
): string[] {
  return [
    '-ss',
    String(atSec),
    '-i',
    inFile,
    '-vf',
    'scale=960:-2',
    '-vframes',
    '1',
    outFile
  ];
}
