#!/usr/bin/env bash
# Install dev-toolkit into OpenAI Codex CLI (https://developers.openai.com/codex).
#
# Usage:
#   scripts/install-codex.sh                # user scope: ~/.agents/skills + ~/.codex/agents
#   scripts/install-codex.sh --project      # current repo: ./.agents/skills + ./.codex/agents
#   scripts/install-codex.sh --skills-dir D --agents-dir D   # custom locations
#
# Codex mapping:
#   skills   -> skills (copied as-is, same SKILL.md format)
#   commands -> skills (custom prompts are deprecated in Codex); invoke with $name
#   agents   -> custom subagents in TOML (name, description, developer_instructions)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$HOME/.agents/skills"
AGENTS_DIR="$HOME/.codex/agents"

while [ $# -gt 0 ]; do
  case "$1" in
    --project) SKILLS_DIR="$PWD/.agents/skills"; AGENTS_DIR="$PWD/.codex/agents" ;;
    --skills-dir) SKILLS_DIR="${2:?--skills-dir needs a directory}"; shift ;;
    --agents-dir) AGENTS_DIR="${2:?--agents-dir needs a directory}"; shift ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

body() { awk 'NR==1 && $0!="---"{print; infm=0; next} NR==1{infm=1; next} infm && $0=="---"{infm=0; next} !infm{print}' "$1"; }
fm() { awk -v k="$2" 'NR==1&&$0=="---"{infm=1;next} infm&&$0=="---"{exit} infm&&index($0,k":")==1{sub(k": *","");print;exit}' "$1"; }
# Escape a value for a TOML basic (double-quoted) string.
toml_str() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

mkdir -p "$SKILLS_DIR" "$AGENTS_DIR"

# Skills: identical format.
for d in "$ROOT"/skills/*/; do
  name="$(basename "$d")"
  rm -rf "$SKILLS_DIR/$name"
  cp -R "$d" "$SKILLS_DIR/$name"
done

# Commands -> skills. Codex has no $ARGUMENTS placeholder, so the text the user
# writes after "$name" is what the instructions call the arguments.
fallback_desc() {
  case "$1" in
    create-new-gh-issue) echo "Create a new GitHub issue for a feature from a context session file" ;;
    explore-plan) echo "Explore, select a team/agent, plan, and iterate on a user request" ;;
    update-docstrings) echo "Replace legacy header docstrings with descriptive module documentation" ;;
    update-permissions) echo "Synchronize the permissions definition YAML into a microservice" ;;
    *) echo "$1" ;;
  esac
}
for f in "$ROOT"/commands/*.md; do
  name="$(basename "$f" .md)"
  desc="$(fm "$f" description)"
  [ -n "$desc" ] || desc="$(fallback_desc "$name")"
  mkdir -p "$SKILLS_DIR/$name"
  {
    echo "---"
    echo "name: $name"
    echo "description: \"$(toml_str "$desc")\""
    echo "---"
    body "$f" | sed 's/\$ARGUMENTS/<the text the user wrote after the skill name>/g'
  } > "$SKILLS_DIR/$name/SKILL.md"
done

# Agents -> TOML custom subagents.
for f in "$ROOT"/agents/*.md; do
  name="$(basename "$f" .md)"
  desc="$(fm "$f" description)"
  {
    echo "name = \"$name\""
    echo "description = \"$(toml_str "$desc")\""
    echo 'sandbox_mode = "workspace-write"'
    echo "developer_instructions = '''"
    body "$f"
    echo "'''"
  } > "$AGENTS_DIR/$name.toml"
done

echo "dev-toolkit installed for Codex:"
echo "  skills (incl. commands): $SKILLS_DIR ($(ls "$SKILLS_DIR" | wc -l | tr -d ' '))"
echo "  agents:                  $AGENTS_DIR ($(ls "$AGENTS_DIR" | wc -l | tr -d ' '))"
echo "Invoke a command-skill with: \$technical-plan <spec>"
