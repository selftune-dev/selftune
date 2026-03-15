# selftune Cron Workflow

Set up scheduled automation for the selftune pipeline. Auto-detects the
platform (system cron, macOS launchd, Linux systemd) or can target
OpenClaw-specific cron integration.

## When to Use

- Setting up selftune automation for the first time
- Checking which cron jobs are registered
- Removing selftune cron jobs (cleanup or reconfiguration)
- Enabling the autonomous observe-grade-evolve-deploy loop

## Commands

### `selftune cron setup`

Auto-detect the current platform and install scheduled jobs.

| Flag | Description | Default |
|------|-------------|---------|
| `--platform <name>` | Force a specific platform (`openclaw`, `cron`, `launchd`, `systemd`) | Auto-detect |
| `--dry-run` | Preview without installing | Off |
| `--tz <timezone>` | IANA timezone for job schedules (OpenClaw only) | Flag > `TZ` env > system timezone |

Platform auto-detection: macOS → launchd, Linux → systemd, other → cron.

### `selftune cron setup --platform openclaw`

Register selftune cron jobs with OpenClaw. Requires OpenClaw installed and on PATH.

```bash
which openclaw    # Must resolve
```

### `selftune cron list`

Show all registered selftune cron jobs. Reads from
`~/.openclaw/cron/jobs.json` and filters for `selftune-*` entries.
No flags.

### `selftune cron remove`

Remove all selftune cron jobs from OpenClaw.

| Flag | Description | Default |
|------|-------------|---------|
| `--dry-run` | Preview which jobs would be removed without deleting | Off |

## Aliases

`selftune schedule` is an alias for `selftune cron`. Existing `selftune schedule`
invocations with flags (e.g. `selftune schedule --format launchd`) continue to work.

## Default Job Schedule

Setup registers these jobs:

| Name | Cron Expression | Schedule | Description |
|------|----------------|----------|-------------|
| `selftune-sync` | `*/30 * * * *` | Every 30 minutes | Sync source-truth telemetry |
| `selftune-status` | `0 8 * * *` | Daily at 8am | Health check — report skills with pass rate below 80% |
| `selftune-orchestrate` | `0 3 * * 0` | Weekly at 3am Sunday | Full evolution pipeline for undertriggering skills |

All jobs run in **isolated session** mode — each execution gets a clean
session with no context accumulation from previous runs.

## Output

- **setup:** Installs platform-appropriate schedule artifacts and activates them
- **setup --platform openclaw:** Registers jobs via `openclaw cron add` and confirms each
- **list:** Prints a formatted table of registered selftune cron jobs (name, schedule, description)
- **remove:** Deletes each selftune cron job via `openclaw cron remove` and confirms

## Steps

1. Run `selftune cron setup --dry-run` to preview what would be installed
2. Run `selftune cron setup` to install scheduled jobs for your platform
3. Verify with `selftune status` after the first scheduled run fires

For OpenClaw specifically:
1. Run `selftune cron setup --platform openclaw --dry-run` to preview
2. Run `selftune cron setup --platform openclaw` to register jobs
3. Run `selftune cron list` to verify jobs are registered

## The Autonomous Evolution Loop

When scheduled jobs are active, selftune operates as a self-correcting system:

```
Scheduled job fires
    |
    v
Agent runs selftune pipeline (sync → status → orchestrate)
    |
    v
Improved SKILL.md written to disk
    |
    v
Next agent turn uses updated description
```

## Safety Controls

| Control | How It Works |
|---------|-------------|
| Dry-run first | `selftune cron setup --dry-run` previews commands before installing |
| Regression threshold | Evolution only deploys if improvement exceeds 5% on existing triggers |
| Auto-rollback | `selftune watch` automatically rolls back if pass rate drops below baseline minus threshold |
| Audit trail | Every evolution recorded in `evolution_audit_log.jsonl` with full history |
| SKILL.md backup | `.bak` file created before every deploy — primary rollback path exists via .bak; fallback depends on audit metadata integrity |
| Human override | `selftune evolve rollback --skill <name> --skill-path <path>` available anytime to manually revert |
| Pin descriptions | Config flag to freeze specific skills and prevent evolution on sensitive skills |

## Common Patterns

**"Set up autonomous skill evolution"**
> Run `selftune cron setup`. Auto-detects your platform and installs
> appropriate scheduled jobs.

**"Set up cron for OpenClaw"**
> Run `selftune cron setup --platform openclaw`.

**"Preview before installing"**
> Run `selftune cron setup --dry-run` to see exactly what would be
> installed without changing anything.

**"Use a specific timezone (OpenClaw)"**
> Run `selftune cron setup --platform openclaw --tz America/New_York`.

**"What jobs are registered?"**
> Run `selftune cron list`. Shows a table of all selftune cron jobs
> with their schedules and descriptions.

**"Remove all cron automation"**
> Run `selftune cron remove`. Preview first with `selftune cron remove --dry-run`.

**"A skill regressed after cron evolution"**
> The watch job should catch this automatically. If not, run
> `selftune evolve rollback --skill <name>` manually. See `Workflows/Rollback.md`.
