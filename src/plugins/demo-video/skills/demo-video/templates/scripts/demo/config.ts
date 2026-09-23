import * as fs from 'fs';
import * as path from 'path';

/**
 * mlx-audio's generate.py always appends "_NNN" (zero-padded segment index)
 * before the extension, ignoring exactly what you pass to --file_prefix.
 * tts.ts derives the segment path from these pieces - see segmentWavPath.
 */
export const MLX_AUDIO_SEGMENT_PREFIX = '_';
export const MLX_AUDIO_FIRST_SEGMENT_INDEX = '000';
export const MLX_AUDIO_SECOND_SEGMENT_INDEX = '001';

export type TtsEngine = 'gemini-tts' | 'qwen3-tts-mlx';

/**
 * Per-project options. Source of truth is .claude/demo-video-skill.config.json
 * at the repo root; values below are only fallbacks for keys the JSON omits.
 * Edit the JSON, not this file, so the choices survive pipeline updates.
 */
interface DemoProjectConfig {
  branding: {
    /** Product name spoken/printed in the opening slate. */
    productName: string;
    /** Spoken brand line. Spoken exactly once per video, at the start. */
    introPhrase: string;
    /** Kicker printed above the feature name on the opening slate. */
    openingKicker: string;
    /** Kicker for transition slates inside merged videos. */
    intermediaryKicker: string;
    /** Accent color for title-card rule/kicker and click ripples. */
    accentColor: string;
    /**
     * Outro slate: path to an SVG logo (repo-relative), or plain text to
     * render instead. null = no outro slate.
     */
    outroLogoSvg: string | null;
    outroText: string | null;
  };
  features: {
    /** TTS voice narration. Off = silent video paced by fixed holds. */
    narration: boolean;
    /** Burned-in subtitle pills (uses take narration text even when voice is off). */
    subtitles: boolean;
    /** Opening title card slate. */
    titleCards: boolean;
    /** Closing outro slate (needs outroLogoSvg or outroText). */
    outro: boolean;
    /** Injected visual cursor + click ripples. */
    cursorOverlay: boolean;
  };
  ttsEngine: TtsEngine;
  voice: string;
  geminiModel: string;
  /** Where the final <slug>.mp4 and <slug>.png land (repo-relative). */
  assetsDir: string;
  /** Hard cap on the final mp4 size. */
  sizeBudgetMb: number;
  /** Base URL the Playwright runner records against (must be running). */
  baseURL: string;
  /** Command that runs project binaries: 'npx' | 'bunx' | 'pnpm exec' ... */
  packageRunner: string;
  slowdownFactor: number;
  titleCardSeconds: { min: number };
  outro: { seconds: number; fadeSec: number };
}

const DEFAULTS: DemoProjectConfig = {
  branding: {
    productName: 'the app',
    introPhrase: "What's new in the app",
    openingKicker: "WHAT'S NEW",
    intermediaryKicker: 'ALSO IN THIS RELEASE',
    accentColor: '#f36f21',
    outroLogoSvg: null,
    outroText: null
  },
  features: {
    narration: true,
    subtitles: true,
    titleCards: true,
    outro: false,
    cursorOverlay: true
  },
  ttsEngine: 'gemini-tts',
  voice: 'Autonoe',
  geminiModel: 'gemini-3.1-flash-tts-preview',
  assetsDir: path.join('assets', 'demo-videos'),
  sizeBudgetMb: 5,
  baseURL: 'http://localhost:5173',
  packageRunner: 'npx',
  slowdownFactor: 1,
  titleCardSeconds: { min: 3 },
  outro: { seconds: 3, fadeSec: 0.8 }
};

const CONFIG_FILE = path.join('.claude', 'demo-video-skill.config.json');

function loadProjectConfig(): DemoProjectConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    // The path is cwd-relative on purpose (scripts run from the repo root);
    // say so instead of silently ignoring every project choice.
    console.warn(
      `demo-video: no ${CONFIG_FILE} found from ${process.cwd()} - using built-in defaults (run from the repo root?)`
    );
    return DEFAULTS;
  }
  const json = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  return {
    ...DEFAULTS,
    ...json,
    branding: { ...DEFAULTS.branding, ...json.branding },
    features: { ...DEFAULTS.features, ...json.features },
    titleCardSeconds: { ...DEFAULTS.titleCardSeconds, ...json.titleCardSeconds },
    outro: { ...DEFAULTS.outro, ...json.outro }
  };
}

export const DEMO_CONFIG = {
  ...loadProjectConfig(),
  /** argv for the offline qwen3-tts-mlx engine (unused by gemini-tts). */
  ttsArgs(text: string, outWavAbs: string): string[] {
    return [
      'uvx',
      '--python',
      '3.12',
      '--from',
      'mlx-audio',
      'python',
      '-m',
      'mlx_audio.tts.generate',
      '--model',
      'mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16',
      '--text',
      text,
      '--voice',
      DEMO_CONFIG.voice,
      '--file_prefix',
      outWavAbs.replace(/\.wav$/, '')
    ];
  }
};
