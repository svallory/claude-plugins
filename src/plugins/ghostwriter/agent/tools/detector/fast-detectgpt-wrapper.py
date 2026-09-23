#!/usr/bin/env python3
"""
Fast-DetectGPT wrapper for AI text detection.

Uses Claude CLI (haiku) to perform conditional probability curvature analysis,
replacing the original falcon-7b local model inference.

Usage:
    python fast-detectgpt-wrapper.py "text to analyze"
    echo "text to analyze" | python fast-detectgpt-wrapper.py
"""

import sys
import json
import subprocess
import argparse
from pathlib import Path

# Add lib dirs to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lib"))
sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))

# Try to import config loader
try:
    from config_loader import get_config_from_env
    from threshold import get_threshold
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False

# JSON schema for structured output
OUTPUT_SCHEMA = json.dumps({
    "type": "object",
    "properties": {
        "probability": {
            "type": "number",
            "description": "AI generation probability from 0.0 to 1.0"
        },
        "classification": {
            "type": "string",
            "enum": ["likely_ai", "likely_human", "uncertain"],
            "description": "Classification based on probability"
        },
        "confidence": {
            "type": "number",
            "description": "Confidence in the classification from 0.0 to 1.0"
        },
        "signals": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Evidence supporting the classification"
        },
        "summary": {
            "type": "string",
            "description": "Brief one-line summary of the analysis"
        }
    },
    "required": ["probability", "classification", "confidence", "signals", "summary"]
})

PROMPT_TEMPLATE = """You are a Fast-DetectGPT-style AI text detector. Analyze the following text for signs of AI generation using conditional probability curvature reasoning.

Consider these factors:
- Token predictability: Does the text follow highly predictable token sequences?
- Conditional probability curvature: Are the token choices consistently within the top-probability band, or do they show human-like surprises?
- Distributional patterns: Does the text match the statistical distribution of LLM output (smooth, uniform perplexity) or human writing (variable perplexity with genuine uncertainty)?
- Lexical diversity: Does the text show genuine vocabulary variation or AI-typical word choices?
- Structural predictability: Are transitions and paragraph structures templatic?

Classification thresholds:
- probability > {ai_threshold}: "likely_ai"
- probability < {human_baseline}: "likely_human"
- otherwise: "uncertain"

Confidence should reflect how certain you are (0.3 to 0.95 range).
Provide 1-3 specific signals as evidence.

Text to analyze:
---
{text}
---"""


def run_detection(text: str) -> dict:
    """Run Fast-DetectGPT-style detection via Claude CLI."""
    if len(text) < 50:
        return {
            "error": "Text too short for analysis (minimum 50 characters)",
            "textLength": len(text),
        }

    # Determine thresholds
    ai_threshold = 0.70
    human_baseline = 0.30

    if CONFIG_AVAILABLE:
        config = get_config_from_env()
        thresh = get_threshold("fast_detectgpt", "probability", config)
        if thresh:
            ai_threshold = thresh.get("ai_threshold", ai_threshold)
            human_baseline = thresh.get("human_baseline", human_baseline)

    prompt = PROMPT_TEMPLATE.format(
        text=text,
        ai_threshold=ai_threshold,
        human_baseline=human_baseline,
    )

    try:
        result = subprocess.run(
            [
                "claude",
                "-p",
                "--model", "haiku",
                "--output-format", "json",
                "--json-schema", OUTPUT_SCHEMA,
                "--allowedTools", "",
                "--no-session-persistence",
            ],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=25,
        )

        if result.returncode != 0:
            return {
                "error": f"Claude CLI failed (exit {result.returncode}): {result.stderr.strip()}",
            }

        response = json.loads(result.stdout)

        # Claude --output-format json returns structured_output when --json-schema is used
        parsed = response.get("structured_output")
        if parsed is None:
            # Fallback: try parsing the result field as JSON
            result_text = response.get("result", "")
            if isinstance(result_text, str):
                parsed = json.loads(result_text)
            else:
                parsed = result_text

    except subprocess.TimeoutExpired:
        return {"error": "Claude CLI timed out after 25s"}
    except json.JSONDecodeError as e:
        return {"error": f"Failed to parse Claude response: {e}"}
    except FileNotFoundError:
        return {"error": "Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code"}
    except Exception as e:
        return {"error": f"Fast-DetectGPT inference failed: {e}"}

    probability = float(parsed.get("probability", 0.5))
    classification = parsed.get("classification", "uncertain")
    confidence = float(parsed.get("confidence", 0.5))
    signals = parsed.get("signals", [])
    summary = parsed.get("summary", f"Fast-DetectGPT: {classification} (probability={probability:.3f})")

    # Clamp values
    probability = max(0.0, min(1.0, probability))
    confidence = max(0.3, min(0.95, confidence))

    return {
        "probability": round(probability, 3),
        "classification": classification,
        "confidence": round(confidence, 3),
        "signals": signals,
        "summary": summary,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Fast-DetectGPT: AI text detection using conditional probability curvature (Claude CLI backend)"
    )
    parser.add_argument(
        "text",
        nargs="?",
        help="Text to analyze (reads from stdin if not provided)",
    )
    args = parser.parse_args()

    if args.text:
        text = args.text
    else:
        text = sys.stdin.read()

    if not text.strip():
        print(json.dumps({"error": "No text provided"}), file=sys.stderr)
        sys.exit(1)

    result = run_detection(text.strip())
    print(json.dumps(result, indent=2))

    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
