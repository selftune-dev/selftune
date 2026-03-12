# selftune Sync Workflow

Refresh source-truth telemetry across supported agent CLIs, then rebuild the
repaired skill-usage overlay so status, dashboard, grading, and evolution work
from real transcripts/rollouts instead of stale hook data.

## When to Use

- Before trusting `status`, `dashboard`, `watch`, or `evolve`
- After running a lot of Claude Code, Codex, OpenCode, or OpenClaw sessions
- When host logs are polluted and you need the repaired/source-first view
- Before export to cloud ingest

## Default Command

```bash
selftune sync
```

## Options

| Flag | Description |
|------|-------------|
| `--since <date>` | Only sync sessions modified on/after this date |
| `--dry-run` | Show summary without writing files |
| `--force` | Ignore per-source markers and rescan everything |
| `--no-claude` | Skip Claude transcript replay |
| `--no-codex` | Skip Codex rollout ingest |
| `--no-opencode` | Skip OpenCode ingest |
| `--no-openclaw` | Skip OpenClaw ingest |
| `--no-repair` | Skip rebuilding `skill_usage_repaired.jsonl` |

## Output

Writes/refreshed data:
- `~/.claude/session_telemetry_log.jsonl`
- `~/.claude/all_queries_log.jsonl`
- `~/.claude/skill_usage_log.jsonl`
- `~/.claude/skill_usage_repaired.jsonl`
- per-source marker files

## Steps

1. Run `selftune sync --dry-run` to preview source counts
2. Run `selftune sync`
3. Inspect the JSON summary for source counts and repaired-record totals
4. Then run `selftune status`, `selftune dashboard`, `selftune watch --sync-first`, or `selftune evolve --sync-first`

## Common Patterns

**"Refresh everything from source truth"**
> Run `selftune sync`

**"Only rescan recent sessions"**
> Run `selftune sync --since 2026-03-01`

**"Start from scratch"**
> Run `selftune sync --force`

**"How do I know it worked?"**
> The command prints a JSON summary with per-source `scanned`, `synced`, and
> `skipped` counts plus repaired overlay totals.

**"What should scheduled monitoring/evolution call?"**
> Use `selftune watch --sync-first ...` and `selftune evolve --sync-first ...`
> so the command refreshes source truth before making decisions.
