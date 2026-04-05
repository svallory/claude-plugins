#!/bin/bash
#
# version-config.sh - Create a versioned backup of a Claude Code agent or skill
#
# Usage:
#   version-config.sh --agent AGENT_NAME
#   version-config.sh --skill SKILL_NAME
#
# Examples:
#   version-config.sh --agent writer
#   version-config.sh --skill adversarial-loop
#
# Creates a numbered backup in .versions/<name>/{number}/
#
# Structure:
#   Agents: .claude/agents/<name>.md (single file)
#   Skills: .claude/skills/<name>/SKILL.md (directory with supporting files)

set -e

# Parse arguments
TYPE=""
NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --agent|-a)
            TYPE="agent"
            shift
            ;;
        --skill|-s)
            TYPE="skill"
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            NAME="$1"
            shift
            ;;
    esac
done

if [ -z "$TYPE" ] || [ -z "$NAME" ]; then
    echo "Usage: version-config.sh --agent|--skill NAME"
    echo ""
    echo "Options:"
    echo "  --agent, -a    Version a Claude Code agent (.claude/agents/<name>.md)"
    echo "  --skill, -s    Version a Claude Code skill (.claude/skills/<name>/)"
    echo ""
    echo "Examples:"
    echo "  version-config.sh --agent writer"
    echo "  version-config.sh --skill adversarial-loop"
    exit 1
fi

# Find the .claude directory (walk up from current directory)
find_claude_dir() {
    local dir="$PWD"
    while [ "$dir" != "/" ]; do
        if [ -d "$dir/.claude" ]; then
            echo "$dir/.claude"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    return 1
}

CLAUDE_DIR=$(find_claude_dir)

if [ -z "$CLAUDE_DIR" ]; then
    echo "Error: Could not find .claude directory"
    exit 1
fi

# Set paths based on type
if [ "$TYPE" = "skill" ]; then
    SOURCE_DIR="$CLAUDE_DIR/skills/$NAME"
    VERSIONS_DIR="$CLAUDE_DIR/skills/.versions/$NAME"
    FILE_CHECK="$SOURCE_DIR/SKILL.md"
else
    # Agents are single files, not directories
    SOURCE_FILE="$CLAUDE_DIR/agents/$NAME.md"
    VERSIONS_DIR="$CLAUDE_DIR/agents/.versions/$NAME"
    FILE_CHECK="$SOURCE_FILE"
fi

# Check source exists
if [ ! -f "$FILE_CHECK" ]; then
    echo "Error: $TYPE '$NAME' not found at: $FILE_CHECK"
    exit 1
fi

# Create .versions directory if it doesn't exist
mkdir -p "$VERSIONS_DIR"

# Find the next version number
NEXT_VERSION=1
if [ -d "$VERSIONS_DIR" ]; then
    HIGHEST=$(ls -1 "$VERSIONS_DIR" 2>/dev/null | grep -E '^[0-9]+$' | sort -n | tail -1)
    if [ -n "$HIGHEST" ]; then
        NEXT_VERSION=$((HIGHEST + 1))
    fi
fi

# Create the new version directory
NEW_VERSION_DIR="$VERSIONS_DIR/$NEXT_VERSION"
mkdir -p "$NEW_VERSION_DIR"

# Copy files based on type
if [ "$TYPE" = "skill" ]; then
    # Skills are directories - copy all files except .versions
    cd "$SOURCE_DIR"
    find . -maxdepth 1 -type f -exec cp {} "$NEW_VERSION_DIR/" \;

    # Copy subdirectories except .versions
    for dir in */; do
        if [ "$dir" != ".versions/" ] && [ -d "$dir" ]; then
            cp -r "$dir" "$NEW_VERSION_DIR/"
        fi
    done
else
    # Agents are single files
    cp "$SOURCE_FILE" "$NEW_VERSION_DIR/$NAME.md"
fi

echo "Created backup: $NEW_VERSION_DIR"
echo "Files backed up:"
ls -la "$NEW_VERSION_DIR"
