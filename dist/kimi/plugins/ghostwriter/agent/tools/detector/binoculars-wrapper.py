#!/usr/bin/env python3
"""
Binoculars wrapper for AI text detection.

Uses Claude CLI (haiku) to perform cross-perplexity analysis,
replacing the original falcon-7b local model inference.

Usage:
    python binoculars-wrapper.py "text to analyze"
    echo "text to analyze" | python binoculars-wrapper.py
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

# Published thresholds from the Binoculars paper
BINOCULARS_FPR_THRESHOLD = 0.8536432310785527
BINOCULARS_ACCURACY_THRESHOLD = 0.9015310749276843

# JSON schema for structured output
OUTPUT_SCHEMA = json.dumps({
    "type": "object",
    "properties": {
        "binocularsScore": {
            "type": "number",
            "description": "Cross-perplexity ratio score. Lower values indicate AI-generated text. Range roughly 0.5 to 1.5."
        },
        "classification": {
            "type": "string",
            "enum": ["likely_ai", "likely_human", "uncertain"],
            "description": "Classification based on the score"
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
    "required": ["binocularsScore", "classification", "confidence", "signals", "summary"]
})

PROMPT_TEMPLATE = """You are a Binoculars-style AI text detector. Analyze the following text for cross-perplexity patterns that distinguish AI from human writing.

The Binoculars method works by comparing how predictable text is under two different model perspectives. Simulate this analysis by considering:

- Cross-perplexity patterns: Does the text show uniform predictability (AI) or variable predictability (human)?
- Observer vs performer divergence: Would different models agree on token predictions? High agreement = likely AI.
- Token-level surprises: Are there genuinely unexpected word choices, or is everything within the expected distribution?
- Fluency vs naturalness tradeoff: AI text is often more fluent but less natural than human writing.
- Distributional signatures: Does the text sit in the "too perfect" zone of language model output?

Output a binocularsScore where:
- Score < {fpr_threshold}: "likely_ai" (low cross-perplexity ratio = AI)
- Score > {accuracy_threshold}: "likely_human" (high ratio = human)
- Between thresholds: "uncertain"

Typical ranges: AI text scores 0.6-0.85, human text scores 0.9-1.3.
Confidence should reflect how certain you are (0.3 to 0.95 range).
Provide 1-3 specific signals as evidence.

Text to analyze:
---
{text}
---"""


def run_detection(text: str) -> dict:
    """Run Binoculars-style detection via Claude CLI."""
    if len(text) < 50:
        return {
            "error": "Text too short for analysis (minimum 50 characters)",
            "textLength": len(text),
        }

    threshold = BINOCULARS_FPR_THRESHOLD

    # Override thresholds from config if available
    if CONFIG_AVAILABLE:
        config = get_config_from_env()
        thresh = get_threshold("binoculars", "score", config)
        if thresh:
            cfg_threshold = thresh.get("ai_threshold")
            if cfg_threshold is not None:
                threshold = cfg_threshold

    prompt = PROMPT_TEMPLATE.format(
        text=text,
        fpr_threshold=f"{threshold:.4f}",
        accuracy_threshold=f"{BINOCULARS_ACCURACY_THRESHOLD:.4f}",
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
        return {"error": f"Binoculars inference failed: {e}"}

    score = float(parsed.get("binocularsScore", 0.85))
    classification = parsed.get("classification", "uncertain")
    confidence = float(parsed.get("confidence", 0.5))
    signals = parsed.get("signals", [])
    summary = parsed.get("summary", f"Binoculars: {classification} (score={score:.4f})")

    # Clamp confidence
    confidence = max(0.3, min(0.95, confidence))

    return {
        "binocularsScore": round(score, 4),
        "threshold": threshold,
        "classification": classification,
        "confidence": round(confidence, 3),
        "signals": signals,
        "summary": summary,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Binoculars: AI text detection using cross-perplexity ratio (Claude CLI backend)"
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
