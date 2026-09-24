import { Page } from '@playwright/test';

export interface DemoTake {
  /** One narration sentence; drives TTS audio and the subtitle cue. */
  narration: string;
  action: (page: Page) => Promise<void>;
}

export interface DemoDefinition {
  /** Human-readable feature name; title card text. */
  feature: string;
  /** kebab-case output name: <assetsDir>/<slug>.mp4 */
  slug: string;
  takes: DemoTake[];
}

export function defineDemo(d: DemoDefinition): DemoDefinition {
  return d;
}

export interface TakeTiming {
  index: number;
  narration: string;
  startSec: number;
  endSec: number;
}

export interface DemoTimings {
  slug: string;
  feature: string;
  takes: TakeTiming[];
}
