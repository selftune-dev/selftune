# selftune Create, Test, and Deploy Workflow

Use this when the user wants one guided path from a new or shaky skill to a
safe shipped skill.

This is a composed workflow. It does not replace the atomic `Evals`,
`UnitTest`, `Baseline`, `Evolve`, or `Watch` workflows. It decides which one
comes next and keeps the creator trust loop in order.

## When to Use

- The user says "create, test, and deploy"
- The user wants the full creator loop end to end
- The user asks "how do I know this skill works?" before shipping
- The user asks whether a skill is ready to deploy
- The user wants one recommended path from cold start to live watch

## Default Path

There is no single `selftune create-test-deploy` command yet. Run the loop
step by step:

```bash
selftune eval generate --skill <name> --skill-path <path>
selftune eval unit-test --skill <name> --generate --skill-path <path>
selftune evolve --skill <name> --skill-path <path> --dry-run --validation-mode replay
selftune grade baseline --skill <name> --skill-path <path>
selftune evolve --skill <name> --skill-path <path> --with-baseline
selftune watch --skill <name>
```

## How to Run It

### 1. Resolve the current loop position

Start with one of these surfaces:

```bash
selftune status
```

or

```bash
selftune dashboard
```

Use the readiness summary to find which step is missing:

- missing evals
- missing unit tests
- missing replay validation
- missing baseline
- ready to deploy
- already deployed and under watch

### 2. Run only the next missing step

Do not blindly rerun the whole loop if the dashboard or status already shows a
later step is complete.

#### Missing evals

Run:

```bash
selftune eval generate --skill <name> --skill-path <path>
```

If the skill is cold-start and there are no trusted triggers yet, prefer:

```bash
selftune eval generate --skill <name> --auto-synthetic --skill-path <path>
```

Then continue to `UnitTest`.

#### Missing unit tests

Run:

```bash
selftune eval unit-test --skill <name> --generate --skill-path <path>
```

Then continue to replay dry-run validation.

#### Missing replay validation

Run:

```bash
selftune evolve --skill <name> --skill-path <path> --dry-run --validation-mode replay
```

This is the pre-deploy proof step. It validates against runtime-style routing
without mutating the skill.

Then continue to baseline.

#### Missing baseline

Run:

```bash
selftune grade baseline --skill <name> --skill-path <path>
```

Then continue to live deploy.

#### Ready to deploy

Run:

```bash
selftune evolve --skill <name> --skill-path <path> --with-baseline
```

This is the recommended creator ship command because it deploys only after the
candidate clears the earlier trust gates.

Then continue to watch.

#### Already deployed and under watch

Run:

```bash
selftune watch --skill <name>
```

Use this state to explain whether the skill is stable, regressing, or ready for
another iteration.

## Which workflow to read next

Load the atomic workflow that matches the next missing step:

- eval generation -> `workflows/Evals.md`
- unit tests -> `workflows/UnitTest.md`
- replay dry-run / deploy -> `workflows/Evolve.md`
- baseline -> `workflows/Baseline.md`
- live monitoring -> `workflows/Watch.md`

Use `references/creator-playbook.md` when the user is publishing a skill other
people will install and needs before-ship versus after-ship guidance.

## Common Patterns

**User asks for one end-to-end shipping path**

> Use this workflow. Check the current readiness surface first, then run the
> next missing creator-loop step instead of dumping every command at once.

**User asks whether a skill is safe to ship**

> Use `selftune status` or the dashboard to confirm evals, unit tests, replay
> validation, and baseline exist. If all four are complete, run `selftune
> evolve --with-baseline`. Otherwise run the missing step first.

**User already shipped the skill**

> Do not send them back to eval generation unless the evidence is stale or
> missing. Route to `Watch` and explain whether the skill is stable.

**User wants to understand why the loop is ordered this way**

> Explain the progression:
> router coverage -> workflow correctness -> runtime proof -> no-skill value ->
> live deploy -> watch.
