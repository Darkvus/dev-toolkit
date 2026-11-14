#!/usr/bin/env bash
# Install dev-toolkit into OpenCode (https://opencode.ai).
#
# Usage:
#   scripts/install-opencode.sh              # global: ~/.config/opencode
#   scripts/install-opencode.sh --project    # current project: ./.opencode
#   scripts/install-opencode.sh --target DIR # custom OpenCode config dir
#
# Skills are copied as-is (same SKILL.md format as Claude Code).
# Agents and commands are converted: Claude-only frontmatter (model, tools,
# color, name, argument-hint) is dropped or translated to OpenCode's format.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"

while [ $# -gt 0 ]; do
  case "$1" in
    --project) TARGET="$PWD/.opencode" ;;
    --target) TARGET="${2:?--target needs a directory}"; shift ;;
    -h|--help) sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

# Print the body of a markdown file without its YAML frontmatter.
body() { awk 'NR==1 && $0!="---"{print; infm=0; next} NR==1{infm=1; next} infm && $0=="---"{infm=0; next} !infm{print}' "$1"; }
# Print one frontmatter value (single-line) from a markdown file.
fm() { awk -v k="$2" 'NR==1&&$0=="---"{infm=1;next} infm&&$0=="---"{exit} infm&&index($0,k":")==1{sub(k": *","");print;exit}' "$1"; }

mkdir -p "$TARGET/skills" "$TARGET/agents" "$TARGET/commands"

# Skills: identical format, copy directories.
for d in "$ROOT"/skills/*/; do
  name="$(basename "$d")"
  rm -rf "$TARGET/skills/$name"
  cp -R "$d" "$TARGET/skills/$name"
done

# Agents: file name becomes the agent name.
for f in "$ROOT"/agents/*.md; do
  name="$(basename "$f" .md)"
  desc="$(fm "$f" description)"
  {
    echo "---"
    echo "description: $desc"
    echo "mode: subagent"
    echo "permission:"
    echo "  edit: allow"
    echo "  bash: allow"
    echo "---"
    body "$f"
  } > "$TARGET/agents/$name.md"
done

# Commands: keep description, drop argument-hint ($ARGUMENTS works in both).
for f in "$ROOT"/commands/*.md; do
  name="$(basename "$f")"
  desc="$(fm "$f" description)"
  {
    if [ -n "$desc" ]; then
      echo "---"
      echo "description: $desc"
      echo "---"
    fi
    body "$f"
  } > "$TARGET/commands/$name"
done

echo "dev-toolkit installed for OpenCode in: $TARGET"
echo "  skills:   $(ls "$TARGET/skills" | wc -l | tr -d ' ')"
echo "  agents:   $(ls "$TARGET/agents" | wc -l | tr -d ' ')"
echo "  commands: $(ls "$TARGET/commands" | wc -l | tr -d ' ')"
