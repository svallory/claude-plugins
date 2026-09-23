import { DEMO_CONFIG } from './config';

/**
 * Narration text for the slates that top and join demo segments.
 *
 * This module is pure string assembly on purpose. The one rule a merged video
 * must obey - **the brand intro is spoken exactly once, at the very start** -
 * is enforced here, in code that runs in unit tests, rather than discovered
 * by watching a 90-second render.
 *
 * Every line produced here is also a TTS cache key (see tts.ts), so the text
 * must be deterministic: same features in, same words out, no timestamps, no
 * randomness. That is what makes a merge cheap - re-merging the same set of
 * demos re-uses every wav already in the cache.
 */

/** The spoken brand line, from project config. */
export const INTRO_PHRASE = DEMO_CONFIG.branding.introPhrase;

export const OPENING_KICKER = DEMO_CONFIG.branding.openingKicker;
export const INTERMEDIARY_KICKER = DEMO_CONFIG.branding.intermediaryKicker;

/** The kicker a slate should print, given whether it opens the video. */
export function kickerFor(isOpening: boolean): string {
  return isOpening ? OPENING_KICKER : INTERMEDIARY_KICKER;
}

/** Narration for the FIRST slate of a video: brand line + first feature. */
export function openingNarration(feature: string): string {
  return `${INTRO_PHRASE}: ${feature}.`;
}

/**
 * Narration for an intermediary slate inside a merged video. Deliberately
 * does NOT repeat INTRO_PHRASE - hearing the brand line once per feature is
 * the exact defect this module exists to prevent.
 *
 * `position` is 1-based over the *transitions*; the wording is a fixed table,
 * not a generator, so a reviewer can read every line a merge can ever speak.
 */
export function transitionNarration(feature: string, position: number): string {
  if (position < 1) {
    throw new Error(
      `transitionNarration position must be 1-based (got ${position})`
    );
  }
  return `${connective(position)} ${feature}.`;
}

const CONNECTIVES = ['Next up:', 'Then:', 'Also:'] as const;

function connective(position: number): string {
  return CONNECTIVES[Math.min(position, CONNECTIVES.length) - 1];
}

/** One slate in a merged video, with the narration that plays over it. */
export interface SlatePlan {
  slug: string;
  feature: string;
  narration: string;
  isOpening: boolean;
}

export interface SegmentSource {
  slug: string;
  feature: string;
}

/**
 * Build the ordered slate plan for a merged video. First segment keeps the
 * opening intro; every later segment gets a transition slate. Throws on an
 * empty list and on duplicate slugs.
 */
export function planSlates(segments: SegmentSource[]): SlatePlan[] {
  if (segments.length === 0) {
    throw new Error('a merged video needs at least one segment');
  }
  const seen = new Set<string>();
  for (const s of segments) {
    if (seen.has(s.slug)) {
      throw new Error(`duplicate segment slug in merge: ${s.slug}`);
    }
    seen.add(s.slug);
  }

  const slates = segments.map((s, i) => ({
    slug: s.slug,
    feature: s.feature,
    narration:
      i === 0 ? openingNarration(s.feature) : transitionNarration(s.feature, i),
    isOpening: i === 0
  }));

  assertSingleIntro(slates);
  return slates;
}

/** Fails loudly if more than one slate speaks the brand intro, or if the video does not open with it. */
export function assertSingleIntro(slates: SlatePlan[]): void {
  const withIntro = slates.filter((s) => s.narration.includes(INTRO_PHRASE));
  if (withIntro.length !== 1) {
    throw new Error(
      `merged narration must speak "${INTRO_PHRASE}" exactly once, found ${
        withIntro.length
      }: ${withIntro.map((s) => s.slug).join(', ') || 'none'}`
    );
  }
  if (!slates[0] || !slates[0].narration.includes(INTRO_PHRASE)) {
    throw new Error(
      `the "${INTRO_PHRASE}" intro must be the FIRST slate, not "${slates[0] &&
        slates[0].slug}"`
    );
  }
}
