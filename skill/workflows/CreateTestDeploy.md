# selftune Create, Test, and Deploy Workflow

Use this when the user wants one guided path from a new or shaky skill to a
safe shipped package.

This is a composed workflow. It does not replace the atomic `Evals`,
`UnitTest`, `Baseline`, `Evolve`, or `Watch` workflows. It decides which one
comes next and keeps the package evaluation pipeline in order.

## When to Use

- The user says "create, test, and deploy"
- The user wants the full package evaluation pipeline end to end
- The user asks "how do I know this skill works?" before shipping
- The user asks whether a skill is ready to deploy
- The user wants one recommended path from cold start to live watch

## Default Path

Prefer the newer lifecycle:

```bash
# author or inspect the draft
selftune create status --skill-path <path>

# build trust evidence
selftune verify --skill-path <path>

# ship safely
selftune publish --skill-path <path>
```

## How to Run It

### 1. Resolve the current lifecycle position

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
selftune create replay --skill-path <path> --mode package
```

This is the runtime proof step behind `verify`.

Then continue to baseline.

#### Missing baseline

Run:

```bash
selftune create baseline --skill-path <path> --mode package
```

Then re-run `verify`.

#### Ready to deploy

Run:

```bash
selftune publish --skill-path <path>
```

This is the recommended creator ship command because it re-runs the draft
package validation gates and starts watch automatically.

Then continue to watch.

#### Already deployed and under watch

Run:

```bash
selftune watch --skill <name>
```

Use this state to explain whether the skill is stable, regressing, or ready for
another iteration.

## Which workflow to read next

Prefer the newer primary workflows:

- authoring -> `workflows/Create.md`
- trust-building -> `workflows/Verify.md`
- shipping -> `workflows/Publish.md`

Load the lower-level workflows only when the user explicitly wants the details:

- `workflows/Evals.md`
- `workflows/UnitTest.md`
- `workflows/Replay.md`
- `workflows/Baseline.md`
- `workflows/Watch.md`

Use `references/creator-playbook.md` when the user is publishing a skill other
people will install and needs before-ship versus after-ship guidance.

## Common Patterns

**User asks for one end-to-end shipping path**

> Use this workflow. Check the current readiness surface first, then run the
> next missing pipeline step instead of dumping every command at once.

**User asks whether a skill is safe to ship**

> Use `Verify` first. If the skill is already verified, move to `Publish`.

**User already shipped the skill**

> Do not send them back to eval generation unless the evidence is stale or
> missing. Route to `Watch` and explain whether the skill is stable.

**User wants to understand why the loop is ordered this way**

> Explain the progression:
> router coverage -> workflow correctness -> runtime proof -> no-skill value ->
> live deploy -> watch.
