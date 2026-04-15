# selftune Create Workflow

## When to Use

When the user wants to author a brand-new skill package, bootstrap a clean draft
skill, or start from a package skeleton instead of mutating an existing skill.

## Overview

`Create` is the beginning of the lifecycle for first-class package drafts.

Today the command surface is still split:

- `selftune create init` starts from a blank package
- `selftune create scaffold` starts from a discovered workflow
- `selftune create status` tells you where the draft is in the lifecycle

After authoring, move to `Verify` rather than staying in low-level `create`
subcommands longer than necessary.

## Primary Commands

```bash
selftune create init --name <name> --description <text> [--output-dir <path>] [--force] [--json]
selftune create scaffold --from-workflow <id|index> [--output-dir <path>] [--skill-name <name>] [--description <text>] [--write] [--force] [--json]
selftune create status --skill-path <path> [--json]
selftune verify --skill-path <path> [--json]
selftune create check --skill-path <path> [--json]
selftune create replay --skill-path <path> [--mode routing|package] [--agent AGENT] [--eval-set PATH] [--json]
selftune create baseline --skill-path <path> [--mode routing|package] [--agent AGENT] [--eval-set PATH] [--json]
selftune create report --skill-path <path> [--agent AGENT] [--eval-set PATH] [--json]
selftune publish --skill-path <path> [--json]
selftune create publish --skill-path <path> [--watch] [--ignore-watch-alerts] [--json]
```

## Options

- `--name <name>`: Display name for the new skill package. Required.
- `--description <text>`: Short routing description for the draft skill.
  Required.
- `--output-dir <path>`: Parent directory for the new package. Default: the
  repo-root `.agents/skills` directory.
- `--from-workflow <id|index>`: Workflow ID or 1-based index from
  `selftune workflows`. Required for `scaffold`.
- `--skill-name <name>`: Override the generated scaffolded skill name.
- `--force`: Overwrite scaffold files if the package directory already exists.
- `--write`: Persist the workflow-derived scaffold to disk. Without this flag,
  `scaffold` previews the package only.
- `--min-occurrences <n>`: Minimum workflow frequency to consider while
  resolving `--from-workflow`.
- `--skill <name>`: Restrict workflow discovery to chains containing the named
  skill during `scaffold`.
- `--json`: Emit the created package summary as JSON.
- `--skill-path <path>`: Path to a skill directory or `SKILL.md`. Required for
  `status`, `check`, `replay`, `baseline`, `report`, and `publish`.
- `--mode routing|package`: Replay or baseline only the router, or the full
  package tree.
- `--agent AGENT`: Runtime agent for replay, baseline, or report execution.
- `--eval-set PATH`: Override the canonical eval-set path for replay,
  baseline, or report.
- `--watch`: Start watch immediately after `create publish` succeeds.
- `--ignore-watch-alerts`: Bypass the publish-time watch gate after watch
  runs.
- `-h, --help`: Show command help.

## Generated Layout

```text
<skill-name>/
├── SKILL.md
├── workflows/
│   └── default.md
├── references/
│   └── overview.md
├── scripts/
├── assets/
└── selftune.create.json
```

## What Each File Is For

- `SKILL.md`: The trigger surface and top-level routing contract.
- `workflows/default.md`: The first execution path once the skill triggers.
- `references/overview.md`: Background context that should be loaded on demand.
- `scripts/`: Deterministic helpers you want the agent to reuse.
- `assets/`: Static templates or seed artifacts.
- `selftune.create.json`: selftune-specific package metadata for readiness and
  future package replay.

## Examples

```bash
selftune create init --name "Research Assistant" --description "Use when the user needs structured research help."
selftune create status --skill-path .agents/skills/research-assistant
selftune verify --skill-path .agents/skills/research-assistant
selftune create scaffold --from-workflow 1
selftune create replay --skill-path .agents/skills/research-assistant --mode package
selftune create baseline --skill-path .agents/skills/research-assistant --mode package
selftune create report --skill-path .agents/skills/research-assistant
selftune publish --skill-path .agents/skills/research-assistant
selftune create scaffold --from-workflow "Copywriting→MarketingAutomation→SelfTuneBlog" --skill-name "blog publisher" --write
selftune create init --name "Release Note Writer" --description "Use when the user needs changelog-ready release notes." --output-dir .agents/skills
selftune create init --name "Internal Docs Helper" --description "Use when the user needs internal documentation updates." --json
```

## Common Patterns

- "Start a brand-new skill package"
  `selftune create init --name "Research Assistant" --description "Use when the user needs structured research help."`
- "Write the scaffold into a different local registry"
  `selftune create init --name "Research Assistant" --description "Use when the user needs structured research help." --output-dir ~/skills`
- "Replace an older draft with a fresh scaffold"
  `selftune create init --name "Research Assistant" --description "Use when the user needs structured research help." --force`
- "Preview a package scaffold from telemetry"
  `selftune create scaffold --from-workflow 1`
- "Write a workflow-derived package draft"
  `selftune create scaffold --from-workflow 1 --output-dir .agents/skills --write`
- "See where the draft is in the lifecycle"
  `selftune create status --skill-path .agents/skills/research-assistant`
- "Run the lifecycle-first draft verification step"
  `selftune verify --skill-path .agents/skills/research-assistant`
- "Run the low-level draft readiness check"
  `selftune create check --skill-path .agents/skills/research-assistant`
- "Replay-validate the whole draft package"
  `selftune create replay --skill-path .agents/skills/research-assistant --mode package`
- "Measure draft-package lift versus no-skill"
  `selftune create baseline --skill-path .agents/skills/research-assistant --mode package`
- "Render the benchmark-style package report"
  `selftune create report --skill-path .agents/skills/research-assistant`
- "Ship the draft through the lifecycle-first surface"
  `selftune publish --skill-path .agents/skills/research-assistant`
- "Ship the draft through the legacy create surface"
  `selftune create publish --skill-path .agents/skills/research-assistant --watch`

## Follow-on Workflows

After the draft exists:

- use `workflows/Verify.md` to build trust evidence
- use `workflows/Publish.md` to ship the draft safely

## Notes

- The generated package is intentionally sparse. It is a draft, not a published
  skill.
- Replace the placeholder routing and workflow text before distribution.
- `Create` only owns draft authoring and local draft state.
- `Verify` owns trust evidence.
- `Publish` owns shipping + watch handoff.
- Lower-level `create check`, `create replay`, `create baseline`, `create report`,
  and `create publish` still exist, but they are no longer the primary teaching
  path in the skill surface.
- `create publish --watch --json` now returns both the raw nested `watch_result`
  payload and a normalized `package_evaluation.watch` block, so agents can read
  post-deploy pass rates, invocation totals, rollback state, and grade-watch
  deltas from the same measured package-evaluation contract they already use for
  replay and baseline evidence.
- The publish payload now also surfaces `watch_gate_passed`,
  `watch_gate_warnings`, and `watch_trust_score`, so agents can tell whether the
  latest watch signal cleared the advisory trust gate without parsing prose.
- `create report` and `create publish --json` now also surface
  `package_evaluation.grading` when grading baselines and recent grading runs
  exist, so agents can compare draft-package replay/baseline results against
  observed execution quality instead of treating grading as a separate watch-only
  signal.
- selftune now stores the latest measured package-evaluation summary
  canonically in SQLite and mirrors it to
  `~/.selftune/package-evaluations/<skill>.json`, so later publish/report/watch
  steps can reuse one measured artifact instead of treating package evaluation
  as stdout-only output.
- `selftune workflows scaffold` now writes the same package shape for backward
  compatibility, but `selftune create scaffold` is the primary authoring
  surface.
