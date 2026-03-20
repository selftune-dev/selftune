#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
skill_src="$repo_root/skill"
claude_skills_dir="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
claude_skill_path="$claude_skills_dir/selftune"
backup_path="${claude_skill_path}.backup"

next_backup_path() {
  local candidate="$backup_path"
  local suffix=1
  while [ -e "$candidate" ]; do
    candidate="${backup_path}.${suffix}"
    suffix=$((suffix + 1))
  done
  printf '%s\n' "$candidate"
}

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but was not found on PATH." >&2
  exit 1
fi

if [ ! -d "$skill_src" ]; then
  echo "Expected skill directory at $skill_src" >&2
  exit 1
fi

mkdir -p "$claude_skills_dir"

current_target=""
if [ -L "$claude_skill_path" ]; then
  current_target="$(readlink "$claude_skill_path" || true)"
fi

if [ "$current_target" != "$skill_src" ] && [ -e "$claude_skill_path" ]; then
  resolved_backup_path="$(next_backup_path)"
  mv "$claude_skill_path" "$resolved_backup_path"
  echo "Backed up existing Claude selftune skill to $resolved_backup_path"
fi

ln -sfn "$skill_src" "$claude_skill_path"
(cd "$repo_root" && bun link >/dev/null)

resolved_skill_path="$(readlink "$claude_skill_path" || true)"
cli_path="$(command -v selftune || true)"

cat <<EOF
Claude workspace wiring complete.

Workspace: $repo_root
Claude skill link: $claude_skill_path -> $resolved_skill_path
selftune CLI: ${cli_path:-not found on PATH after bun link}

To verify:
  readlink "$claude_skill_path"
  command -v selftune
EOF
