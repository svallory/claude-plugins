import { execFileSync } from 'child_process';
import { DEMO_CONFIG } from './config';
import { synthesize } from './tts';

/** Verifies every external tool the demo pipeline needs. Exit 1 with hints. */
const checks: Array<{ name: string; run: () => void; hint: string }> = [
  {
    name: 'ffmpeg',
    run: () => execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }),
    hint: 'brew install ffmpeg'
  },
  {
    name: 'ffprobe',
    run: () => execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }),
    hint: 'brew install ffmpeg'
  }
];

if (!DEMO_CONFIG.features.narration) {
  // Narration disabled: no TTS engine to verify.
} else if (DEMO_CONFIG.ttsEngine === 'gemini-tts') {
  checks.push(
    {
      name: 'GEMINI_API_KEY set',
      run: () => {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error('missing');
        }
      },
      hint: 'export GEMINI_API_KEY=<key> in your shell (never commit it)'
    },
    {
      name: `gemini-tts synthesis (${DEMO_CONFIG.geminiModel}, voice ${DEMO_CONFIG.voice})`,
      run: () => synthesize('Demo pipeline check.', 'scripts/demo/.cache'),
      hint:
        'the API error above has the reason; model/voice live in scripts/demo/config.ts'
    }
  );
} else {
  checks.push(
    {
      name: 'uvx',
      run: () => execFileSync('uvx', ['--version'], { stdio: 'ignore' }),
      hint: 'brew install uv'
    },
    {
      name: 'qwen3-tts synthesis (downloads model on first run)',
      run: () => synthesize('Demo pipeline check.', 'scripts/demo/.cache'),
      hint:
        'see ttsArgs in scripts/demo/config.ts; run the command by hand to see the real error'
    }
  );
}

let failed = false;
for (const c of checks) {
  try {
    c.run();
    console.log(`ok   ${c.name}`);
  } catch (e) {
    failed = true;
    console.error(`FAIL ${c.name} -> ${c.hint}`);
  }
}
process.exit(failed ? 1 : 0);
