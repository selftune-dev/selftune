# selftune Verify Workflow

Use this when the user wants to know whether a skill is trustworthy enough to
ship or when they ask for the full draft lifecycle without wanting every low-level
command explained upfront.

## What Verify Means

`Verify` is the primary trust-building workflow. The lifecycle entrypoint is:

```bash
selftune verify --skill-path <path> [--agent AGENT] [--eval-set PATH] [--no-auto-fix] [--json]
```

## Options

| Flag | Description |
|------|-------------|
| `--skill-path` | Path to a skill directory or `SKILL.md` file |
| `--agent` | Runtime agent to use for package evaluation once readiness passes |
| `--eval-set` | Override the canonical eval-set path for package evaluation |
| `--no-auto-fix` | Skip automatic evidence generation when readiness checks fail |
| `--json` | Emit readiness plus report data as JSON |
| `--help` | Show command help |

`verify` first runs the same readiness contract as `selftune create check`. If
the draft is missing evidence (evals, unit tests, replay, or baseline), it
automatically runs the corresponding sub-command to generate it, up to 4
iterations. Use `--no-auto-fix` to disable this and get the old behavior of
returning the missing state immediately. If the draft is ready, it then runs
the benchmark-style package report.

## When to Use

- The user asks "can I trust this skill?"
- The user asks "is this ready to ship?"
- The user asks for the full draft lifecycle or uses older "creator loop" wording
- A draft package exists and you need trust evidence before publish

## Default Path

### 1. Read the current state

For draft packages:

```bash
selftune create status --skill-path <path>
```

For a higher-level health summary:

```bash
selftune status
```

### 2. Run verify

```bash
selftune verify --skill-path <path>
```

This is the default trust command because it tells you whether the package
itself is incomplete before you spend time generating more evidence.

### 3. Fill missing trust evidence

When `verify` reports missing readiness or evidence, use only the missing
supporting step.

#### Missing evals or tests

```bash
selftune eval generate --skill <name> --skill-path <path>
selftune eval unit-test --skill <name> --generate --skill-path <path>
```

If the skill is cold-start and has no trusted triggers yet, prefer:

```bash
selftune eval generate --skill <name> --auto-synthetic --skill-path <path>
```

#### Missing runtime proof

```bash
selftune create replay --skill-path <path> --mode package
```

#### Missing no-skill value proof

```bash
selftune create baseline --skill-path <path> --mode package
```

### 4. Re-run verify

```bash
selftune verify --skill-path <path>
```

The skill is verified when it no longer presents missing package/evidence
blockers and the next action becomes publish.

## Outcome

`Verify` should leave the skill in one of these states:

- still `draft`
- one of `needs_spec_validation`, `needs_package_resources`, `needs_evals`, `needs_unit_tests`, `needs_routing_replay`, or `needs_baseline`
- `verified` (`ready_to_publish` in CLI output)

If the result is `verified`, hand off to `Publish`.
If the result is one of the concrete missing-evidence states, run only the missing step.
If the package itself is broken, route back to `Create`.

## Which workflows to load next

- package authoring gaps -> `workflows/Create.md`
- publishing -> `workflows/Publish.md`
- specific low-level evidence work -> `Evals.md`, `UnitTest.md`, `Replay.md`, `Baseline.md`

## Common Patterns

**"How do I know this skill works?"**

> Use `Verify`. Start with `create status` or `status`, then fill only the
> missing evidence step that `verify` reports.

**"Is this ready to ship?"**

> Use `Verify`. If the package is already verified, move directly to `Publish`.

**"Give me the creator loop."**

> Use `Verify` as the primary trust workflow instead of dumping every low-level
> command at once.
