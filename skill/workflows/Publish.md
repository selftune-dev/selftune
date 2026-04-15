# selftune Publish Workflow

Use this when the user wants to ship a skill safely after verification.

## What Publish Means

`Publish` is the lifecycle step that takes a verified skill into live use and
starts post-deploy monitoring. For draft packages, the lifecycle entrypoint is:

```bash
selftune publish --skill-path <path> [--no-watch] [--ignore-watch-alerts] [--json]
```

## Options

| Flag | Description |
|------|-------------|
| `--skill-path` | Path to a skill directory or `SKILL.md` file |
| `--no-watch` | Skip the default watch handoff and return the next watch command instead |
| `--ignore-watch-alerts` | Bypass publish-time watch gate warnings after watch runs |
| `--json` | Emit the publish summary as JSON |
| `--help` | Show command help |

## When to Use

- The user says "publish", "ship", "deploy", or "go live"
- The user already has verification evidence and wants the next step
- The user wants watch to begin immediately after shipping

## Draft Package Path

For a draft package that has already cleared verify:

```bash
selftune publish --skill-path <path>
```

This command:

1. re-runs package replay
2. re-runs package baseline
3. hands the package into watch by default
4. applies a measured publish-time watch gate after watch completes

Use `--ignore-watch-alerts` only when you deliberately want to bypass that
watch-trust gate after reviewing the output.

If verification evidence is missing, do not force publish. Route back to
`Verify`.

## Existing Live Skill Path

If the skill is already deployed and the user is shipping a new measured
improvement, the current surface is still split:

1. run `Improve`
2. if deployed successfully, run:

```bash
selftune watch --skill <name> --skill-path <path>
```

Treat this as the live-skill version of publish until a unified publish command
exists for both draft packages and iterative evolution.

## What To Check Before Publish

- the package or skill is not still blocked on `Create`
- trust evidence is complete enough to be called `verified`
- the next lifecycle step from status/check is publish rather than more prep
- the user is not actually asking for a dry-run or improvement proposal review

## Outcome

`Publish` should leave the skill in one of these states:

- `published`
- `watching`
- back to `Verify` if the draft is still blocked on `needs_spec_validation`, `needs_package_resources`, `needs_evals`, `needs_unit_tests`, `needs_routing_replay`, or `needs_baseline`

## Which workflows to load next

- missing trust proof -> `workflows/Verify.md`
- post-deploy monitoring -> `workflows/Watch.md`
- further iteration after ship -> `workflows/Improve.md`

## Common Patterns

**"Ship this draft skill."**

> Use `selftune publish --skill-path <path>` if verify is green.

**"Deploy and monitor it."**

> Publish includes watch by default. Add `--no-watch` only when you want a
> manual handoff.

**"Can I skip straight to publish?"**

> Only if the skill is already verified. Otherwise route back to `Verify`.
