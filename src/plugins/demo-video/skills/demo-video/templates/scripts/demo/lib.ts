import { createHash } from 'crypto';
import { DemoTimings } from '../../e2e/demo/define';

export function scaleTimings(t: DemoTimings, factor: number): DemoTimings {
  return {
    ...t,
    takes: t.takes.map((k) => ({
      ...k,
      startSec: k.startSec * factor,
      endSec: k.endSec * factor
    }))
  };
}

export function srtTimestamp(sec: number): string {
  const ms = Math.round(sec * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${pad(Math.floor(ms / 3_600_000))}:` +
    `${pad(Math.floor((ms % 3_600_000) / 60_000))}:` +
    `${pad(Math.floor((ms % 60_000) / 1000))},${pad(ms % 1000, 3)}`
  );
}

export function wrapSubtitle(text: string, maxLine = 42): string {
  const words = text.split(/\s+/);
  const lines: string[] = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length <= maxLine || !cur) lines[lines.length - 1] = cand;
    else lines.push(w);
  }
  if (lines.length <= 2) return lines.join('\n');
  // Rebalance into exactly two lines at the word boundary nearest the middle.
  const mid = Math.ceil(words.length / 2);
  return `${words.slice(0, mid).join(' ')}\n${words.slice(mid).join(' ')}`;
}

export interface SrtCue {
  startSec: number;
  endSec: number;
  text: string;
}

export function buildSrt(cues: SrtCue[]): string {
  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${srtTimestamp(c.startSec)} --> ${srtTimestamp(
          c.endSec
        )}\n${wrapSubtitle(c.text)}\n`
    )
    .join('\n');
}

export function padPlan(
  videoDurSec: number,
  audioDurSec: number
): { padVideoSec: number; padAudioSec: number } {
  const diff = Number((audioDurSec - videoDurSec).toFixed(3));
  return diff >= 0
    ? { padVideoSec: diff, padAudioSec: 0 }
    : { padVideoSec: 0, padAudioSec: -diff };
}

export function cacheKey(engine: string, voice: string, text: string): string {
  return createHash('sha1')
    .update(`${engine}|${voice}|${text}`)
    .digest('hex');
}
