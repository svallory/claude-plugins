#!/bin/bash
# Wrapper script to run Python tools with --out support
# Usage: ./run-python-with-out.sh <script.py> <text|file.md> [--out output.json]
#
# If the input argument ends with .md or .txt, reads from that file.
# If --out is provided, writes output to that file instead of stdout.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VENV_PYTHON="$PROJECT_ROOT/.venv/bin/python3"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: Virtual environment not found. Run: python3 -m venv .venv && .venv/bin/pip install nltk numpy spacy transformers torch" >&2
    exit 1
fi

# Parse arguments
SCRIPT="$1"
shift

INPUT_TEXT=""
OUT_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --out)
            OUT_FILE="$2"
            shift 2
            ;;
        *)
            if [[ -z "$INPUT_TEXT" ]]; then
                # Check if it's a file path
                if [[ -f "$1" && ("$1" == *.md || "$1" == *.txt) ]]; then
                    INPUT_TEXT=$(cat "$1")
                else
                    INPUT_TEXT="$1"
                fi
            fi
            shift
            ;;
    esac
done

if [[ -z "$INPUT_TEXT" ]]; then
    # Try reading from stdin
    if [[ ! -t 0 ]]; then
        INPUT_TEXT=$(cat)
    else
        echo "Error: No text provided. Pass text as argument, file path, or via stdin." >&2
        exit 1
    fi
fi

# Run the Python script
if [[ -n "$OUT_FILE" ]]; then
    "$VENV_PYTHON" "$SCRIPT" "$INPUT_TEXT" > "$OUT_FILE"
    echo "Output written to: $OUT_FILE" >&2
else
    "$VENV_PYTHON" "$SCRIPT" "$INPUT_TEXT"
fi
