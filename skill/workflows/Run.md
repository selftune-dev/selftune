# selftune Run Workflow

Use this when the user wants the full autonomous selftune loop rather than a
single lifecycle step.

## What Run Means

`Run` is the simplified lifecycle name for selftune's autonomy-first runtime.

The lifecycle entrypoint is:

```bash
selftune run [--dry-run] [--review-required] [--auto-approve] [--skill NAME] [--max-skills N] [--recent-window HOURS] [--sync-force] [--max-auto-grade N] [--loop] [--loop-interval SECS]
```

## Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview actions without mutations |
| `--review-required` | Validate candidates but require human review before deploy |
| `--auto-approve` | Deprecated alias; autonomous mode is already the default |
| `--skill` | Scope to a single skill |
| `--max-skills` | Cap skills processed per run |
| `--recent-window` | Hours to look back for watch targets |
| `--sync-force` | Force a full rescan during sync |
| `--max-auto-grade` | Max ungraded skills to auto-grade per run |
| `--loop` | Run continuously |
| `--loop-interval` | Seconds between loop iterations |
| `--help` | Show command help |

`run` delegates to the existing `selftune orchestrate` runtime while keeping
the simpler lifecycle name.

## When to Use

- The user wants the full autonomous loop
- The user says "run selftune", "improve all skills", or "operate continuously"
- The user wants a dry-run of what selftune would do next

## Default Commands

```bash
selftune run
selftune run --dry-run
selftune run --review-required
selftune run --skill <name>
selftune run --loop
```

## How To Explain It

`Run` is not the same as a single improve action. It is the higher-level system
runtime that:

- syncs
- computes status
- grades when needed
- improves selected skills
- watches recent changes
- flushes contribution/upload side effects

For users who ask for one specific skill or one specific trust question, prefer
`Status`, `Verify`, `Publish`, or `Improve` first.

For users who ask for the whole closed loop, use `Run`.

## Which workflow to load next

- exact autonomy details and flags -> `workflows/Orchestrate.md`
- trust questions for one skill -> `workflows/Verify.md`
- package publishing -> `workflows/Publish.md`
