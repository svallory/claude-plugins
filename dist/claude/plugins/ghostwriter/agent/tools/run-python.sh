#!/bin/bash
# Wrapper script to run Python tools with the project's virtual environment
# Usage: ./run-python.sh <script.py> [args...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VENV_PYTHON="$PROJECT_ROOT/.venv/bin/python3"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: Virtual environment not found. Run: python3 -m venv .venv && .venv/bin/pip install nltk numpy spacy transformers torch" >&2
    exit 1
fi

exec "$VENV_PYTHON" "$@"
