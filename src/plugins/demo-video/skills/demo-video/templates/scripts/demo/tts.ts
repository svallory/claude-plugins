import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEMO_CONFIG,
  MLX_AUDIO_FIRST_SEGMENT_INDEX,
  MLX_AUDIO_SECOND_SEGMENT_INDEX,
  MLX_AUDIO_SEGMENT_PREFIX
} from './config';
import { cacheKey } from './lib';

/**
 * The one place that knows how mlx-audio names its output. `wav` must be the
 * cache path we asked --file_prefix to use (see config.ts's ttsArgs, which
 * strips ".wav" for the prefix). Throws if `wav` doesn't end in ".wav" so a
 * future change to the cache path shape fails loudly here instead of
 * silently producing the wrong segment path.
 */
function segmentWavPath(wav: string, segmentIndex: string): string {
  if (!wav.endsWith('.wav')) {
    throw new Error(
      `segmentWavPath expected a path ending in .wav, got ${wav}`
    );
  }
  const prefix = wav.slice(0, -'.wav'.length);
  return `${prefix}${MLX_AUDIO_SEGMENT_PREFIX}${segmentIndex}.wav`;
}

/**
 * Synthesize one narration line to wav, cached by (engine, voice, text) so
 * re-runs only pay for changed lines and switching engine/voice invalidates
 * everything. Fails loudly on every error path.
 */
export function synthesize(text: string, cacheDir: string): string {
  const wav = path.join(
    cacheDir,
    `${cacheKey(DEMO_CONFIG.ttsEngine, DEMO_CONFIG.voice, text)}.wav`
  );
  if (fs.existsSync(wav)) return wav;
  fs.mkdirSync(cacheDir, { recursive: true });
  if (DEMO_CONFIG.ttsEngine === 'gemini-tts') {
    synthesizeGemini(text, wav);
  } else {
    synthesizeMlx(text, wav);
  }
  return wav;
}

/**
 * The slice of the Gemini generateContent response the pipeline reads.
 * Everything is optional: the validation branches in synthesizeGemini decide
 * what is fatal, with loud errors - the type just names the shape.
 */
interface GeminiTtsResponse {
  error?: { code?: number; message?: string };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  }>;
}

/**
 * Gemini speech API. Kept synchronous via curl (the pipeline is serial); the
 * API key is read from GEMINI_API_KEY and passed to curl as a header ON
 * STDIN (-H @-) so it never appears in argv (visible via `ps`) or on disk.
 * The response carries base64 raw 16-bit PCM; ffmpeg wraps it into the wav
 * the pipeline expects.
 */
function synthesizeGemini(text: string, wav: string): void {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set - required while ttsEngine is 'gemini-tts' (scripts/demo/config.ts). No default is provided on purpose."
    );
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEMO_CONFIG.geminiModel}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: DEMO_CONFIG.voice }
        }
      }
    }
  });

  // The free tier allows very few requests per minute (429 with a suggested
  // retry delay). Back off and retry those; every other error stays loud.
  const MAX_ATTEMPTS = 4;
  let parsed: GeminiTtsResponse | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = execFileSync(
      'curl',
      [
        '-sS',
        '-X',
        'POST',
        url,
        '-H',
        'Content-Type: application/json',
        '-H',
        '@-',
        '--data-binary',
        body
      ],
      {
        input: `x-goog-api-key: ${apiKey}`,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      }
    );

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Gemini TTS returned non-JSON: ${raw.slice(0, 300)}`);
    }
    if (parsed!.error?.code === 429 && attempt < MAX_ATTEMPTS) {
      const suggested = /retry in ([\d.]+)s/i.exec(parsed!.error.message || '');
      const waitSec = Math.ceil(suggested ? Number(suggested[1]) + 1 : 25);
      console.log(
        `Gemini TTS rate-limited (429); retrying in ${waitSec}s (attempt ${attempt}/${MAX_ATTEMPTS})`
      );
      execFileSync('sleep', [String(waitSec)]);
      continue;
    }
    break;
  }
  if (parsed!.error) {
    throw new Error(
      `Gemini TTS error ${parsed!.error.code || ''}: ${parsed!.error.message ||
        JSON.stringify(parsed!.error).slice(0, 300)}`
    );
  }
  parsed = parsed!;
  const parts = parsed?.candidates?.[0]?.content?.parts || [];
  const inlineData = parts.find((p) => p?.inlineData?.data)?.inlineData;
  if (!inlineData || !inlineData.data) {
    throw new Error(
      `Gemini TTS response has no audio part: ${JSON.stringify(parsed).slice(
        0,
        500
      )}`
    );
  }
  const mime: string = inlineData.mimeType || '';
  const rateMatch = mime.match(/rate=(\d+)/);
  if (!/audio\/(l16|pcm)/i.test(mime) || !rateMatch) {
    throw new Error(
      `Gemini TTS returned unexpected mimeType "${mime}" - expected raw 16-bit PCM with a rate= parameter`
    );
  }

  const pcm = path.join(
    os.tmpdir(),
    `${path.basename(wav, '.wav')}-${process.pid}.pcm`
  );
  fs.writeFileSync(pcm, Buffer.from(inlineData.data, 'base64'));
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-f', 's16le', '-ar', rateMatch[1], '-ac', '1', '-i', pcm, wav],
      { stdio: ['ignore', 'ignore', 'inherit'] }
    );
  } finally {
    fs.unlinkSync(pcm);
  }
  if (!fs.existsSync(wav)) {
    throw new Error(
      `ffmpeg reported success but ${wav} was not created from Gemini PCM output`
    );
  }
}

/**
 * Offline engine: Qwen3-TTS via mlx-audio.
 *
 * mlx-audio's generate.py ignores the extension passed via --file_prefix and
 * always writes "<prefix>_000.wav", "<prefix>_001.wav", ... one file per
 * segment it splits the text into (verified by running it directly). We ask
 * for the cache path as the prefix, then rename the first segment's real
 * output into place. If a second segment exists, the text was split and a
 * single wav can't represent it - fail loudly instead of silently returning
 * only the first fragment.
 */
function synthesizeMlx(text: string, wav: string): void {
  const [bin, ...args] = DEMO_CONFIG.ttsArgs(text, wav);
  execFileSync(bin, args, { stdio: ['ignore', 'inherit', 'inherit'] });

  const firstSegment = segmentWavPath(wav, MLX_AUDIO_FIRST_SEGMENT_INDEX);
  const secondSegment = segmentWavPath(wav, MLX_AUDIO_SECOND_SEGMENT_INDEX);

  if (fs.existsSync(secondSegment)) {
    throw new Error(
      `TTS split "${text}" into multiple audio segments (${firstSegment}, ${secondSegment}, ...) ` +
        `- a single wav can't represent that. Shorten the narration line so mlx-audio produces one segment.`
    );
  }
  if (!fs.existsSync(firstSegment)) {
    throw new Error(
      `TTS reported success but ${firstSegment} was not created - check ttsArgs output naming`
    );
  }
  fs.renameSync(firstSegment, wav);
}
