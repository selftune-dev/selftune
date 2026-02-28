# selftune — Skill Observability CLI

Real-usage telemetry for skill trigger evaluation — both positives AND negatives.

Two hooks work together to build a complete eval dataset over time:

| Hook event | Script | Logs to | What it captures |
|---|---|---|---|
| `UserPromptSubmit` | `prompt-log.ts` | `all_queries_log.jsonl` | **Every** user query |
| `PostToolUse` on `Read` | `skill-eval.ts` | `skill_usage_log.jsonl` | Queries that triggered a skill |

`selftune evals` cross-references the two logs:
- **Positives** (`should_trigger: true`) — queries that triggered the skill
- **Negatives** (`should_trigger: false`) — queries that didn't trigger the skill (real prompts Claude handled another way or without any skill)

This captures false negatives — the queries that *should* have triggered a skill
but didn't — which synthetic eval sets can't easily produce.

---

## Files

| File | Purpose |
|---|---|
| `cli/selftune/hooks/prompt-log.ts` | UserPromptSubmit hook — logs every query |
| `cli/selftune/hooks/skill-eval.ts` | PostToolUse hook — logs skill reads with triggering query |
| `cli/selftune/hooks/session-stop.ts` | Stop hook — captures session telemetry |
| `cli/selftune/eval/hooks-to-evals.ts` | Converts both logs → eval set JSON |
| `cli/selftune/grading/grade-session.ts` | Rubric-based session grading |
| `skill/settings_snippet.json` | Hook config to merge into `~/.claude/settings.json` |

---

## Installation

### 1. Install Bun (if not already installed)

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Install dependencies

```bash
bun install
```

### 3. Register hooks in Claude Code

Edit `~/.claude/settings.json`. If you already have a `hooks` block, merge the
entries in — don't replace the whole block.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run /PATH/TO/cli/selftune/hooks/prompt-log.ts",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "bun run /PATH/TO/cli/selftune/hooks/skill-eval.ts",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun run /PATH/TO/cli/selftune/hooks/session-stop.ts",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

You can also use `/hooks` inside Claude Code for an interactive editor.

### 4. Verify hooks are running

Start a Claude Code session, send a message, and check:

```bash
# Should contain every query you've sent
cat ~/.claude/all_queries_log.jsonl

# Should contain entries for skill reads
cat ~/.claude/skill_usage_log.jsonl
```

---

## Usage

### See what's been logged

```bash
bun run cli/selftune/index.ts evals --list-skills
```

Output:
```
Skill triggers in skill_usage_log (42 total records):
  pptx                            18 triggers
  docx                            14 triggers
  xlsx                             7 triggers
  pdf                              3 triggers

All queries in all_queries_log: 381
```

### Generate an eval set for a skill

```bash
bun run cli/selftune/index.ts evals --skill pptx --output pptx_eval.json
```

Output:
```
Wrote 50 eval entries to pptx_eval.json
  Positives (should_trigger=true) : 18  (from 18 logged triggers)
  Negatives (should_trigger=false): 32  (from 381 total logged queries)
```

### Grade a skill session

```bash
bun run cli/selftune/index.ts grade --skill pptx \
  --expectations "SKILL.md was read before any files were created" \
                 "Output is a .pptx file"
```

### Health check

```bash
bun run cli/selftune/index.ts doctor
```

---

## How it works

```
UserPromptSubmit fires
  └── prompt-log.ts logs query → all_queries_log.jsonl

Claude processes the query...
  If a SKILL.md is read:
    PostToolUse fires
      └── skill-eval.ts logs query + skill name → skill_usage_log.jsonl

Session ends:
  Stop fires
    └── session-stop.ts logs process metrics → session_telemetry_log.jsonl

selftune evals cross-references:
  Positives  = skill_usage_log entries for target skill
  Negatives  = all_queries_log entries NOT in positives
               (real queries that didn't trigger the skill)
```

The negatives pool is particularly valuable because it contains:
- Queries that triggered a *different* skill (cross-skill confusion)
- Queries that triggered *no* skill (genuinely off-topic or under-triggering)

Human review of the negatives that seem like they *should* trigger is the
best way to find under-triggering cases.

---

## Tips

- Let the logs accumulate over several days before running evals — more
  diverse real queries = more reliable signal.
- All hooks are silent (exit 0) and take <50ms, negligible overhead.
- The logs are append-only JSONL in `~/.claude/`. Safe to delete to start
  fresh, or archive old files.
- Use `--max 75` to increase the eval set size once you have enough data.
- Use `--seed 123` to get a different random sample of negatives.
