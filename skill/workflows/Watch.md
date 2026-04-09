# selftune Watch Workflow

Monitor post-deploy skill performance for regressions. Compares current
pass rates against a baseline within a sliding window of recent sessions.

## Default Command

```bash
selftune watch --skill <name> --skill-path <path> [options]
```

## Options

| Flag                  | Description                                      | Default  |
| --------------------- | ------------------------------------------------ | -------- |
| `--skill <name>`      | Skill name                                       | Required |
| `--skill-path <path>` | Path to the skill's SKILL.md                     | Required |
| `--window <n>`        | Sliding window size (number of sessions)         | 20       |
| `--threshold <n>`     | Regression threshold (drop from baseline)        | 0.1      |
| `--auto-rollback`     | Automatically rollback on detected regression    | Off      |
| `--sync-first`        | Refresh source-truth telemetry before evaluating | Off      |
| `--sync-force`        | Force a full source rescan during `--sync-first` | Off      |
| `--grade-threshold <n>` | Grade regression threshold (drop from baseline)| 0.15     |
| `--no-grade-watch`      | Disable grade-based regression monitoring        | Enabled  |
| `--help`                | Show command help                               | Off      |

## Output Format

```json
{
  "skill_name": "pptx",
  "window_size": 20,
  "sessions_evaluated": 18,
  "current_pass_rate": 0.89,
  "baseline_pass_rate": 0.92,
  "threshold": 0.1,
  "regression_detected": false,
  "delta": -0.03,
  "status": "healthy",
  "evaluated_at": "2026-02-28T14:00:00Z",
  "gradeAlert": null,
  "gradeRegression": null
}
```

When grade regression is detected, the additional fields are populated:

```json
{
  "gradeAlert": "grade regression detected for \"pptx\": baseline_grade_pass_rate=0.85, recent_avg=0.65, delta=0.20 exceeds threshold=0.15",
  "gradeRegression": {
    "before": 0.85,
    "after": 0.65,
    "delta": 0.20
  }
}
```

### Status Values

| Status              | Meaning                                           |
| ------------------- | ------------------------------------------------- |
| `healthy`           | Current pass rate is within threshold of baseline |
| `warning`           | Pass rate dropped but within threshold            |
| `regression`        | Pass rate dropped below baseline minus threshold  |
| `insufficient_data` | Not enough sessions in the window to evaluate     |

## Grade Regression Monitoring

In addition to trigger-based regression (pass rate from eval sets), watch now
monitors **grade regression** using grading baselines stored in SQLite.

Grade regression compares the baseline grade pass rate (written when a skill is
deployed) against the average pass rate of recent grading results. If the delta
exceeds `gradeRegressionThreshold` (default 0.15), a `gradeAlert` is raised.

This runs alongside trigger regression:

| Check              | Source                      | Threshold | Field               |
| ------------------ | --------------------------- | --------- | ------------------- |
| Trigger regression | Eval set pass rates         | 0.10      | `regression_detected` |
| Grade regression   | Grading baseline vs recent  | 0.15      | `gradeRegression`     |

Both checks contribute to the overall `alert` field. A grade regression alert
is appended to the watch alert string alongside any trigger regression alert.

Grade watch is enabled by default. Disable it by passing `--no-grade-watch`
if you only want trigger-based monitoring.

## Parsing Instructions

### Check Regression Status

```bash
# Parse: .regression_detected (boolean)
# Parse: .status (string)
# Parse: .delta (float, negative = regression)
```

### Get Key Metrics

```bash
# Parse: .current_pass_rate vs .baseline_pass_rate
# Parse: .sessions_evaluated (should be close to .window_size)
```

## Steps

### 0. Read Evolution Context

Read `~/.selftune/memory/context.md` for session context:

- Active evolutions and their current status
- Known issues and regression history
- Last update timestamp

If the file does not exist, proceed normally -- it will be created after
the first watch.

The evolution-guard hook prevents conflicting SKILL.md edits while watch is
evaluating the skill. The auto-activation system uses watch results to
adjust suggestion confidence -- skills showing regressions get flagged for
attention in subsequent prompts.

### 1. Run Watch

```bash
selftune watch --skill pptx --skill-path /path/to/SKILL.md
```

### 2. Check Regression Status

Parse the JSON output. Key decision points:

| Status              | Action                                                    |
| ------------------- | --------------------------------------------------------- |
| `healthy`           | No action needed. Skill is performing well.               |
| `warning`           | Monitor closely. Consider re-running after more sessions. |
| `regression`        | Investigate. Consider rollback.                           |
| `insufficient_data` | Wait for more sessions before evaluating.                 |

### 3. Decide Action

If regression is detected:

- Review recent session transcripts to understand what changed
- Check if the eval set is still representative
- Run `evolve rollback` if the regression is confirmed (see `workflows/Rollback.md`)

If `--auto-rollback` was set, the command automatically restores the
previous description and logs a `rolled_back` entry.

### 4. Report

Summarize the snapshot for the user:

- Current pass rate vs baseline
- Number of sessions evaluated
- Whether regression was detected
- Recommended action

### 5. Update Memory

After watch completes, the memory writer updates
`~/.selftune/memory/context.md` with the current regression status,
pass rates, and recommended next action. This ensures continuity if the
context window resets before the user acts on the results.

## Common Patterns

**"Is the skill performing well after the change?"**

> Run watch with the skill name and path. Report the snapshot.

**"Check for regressions"**

> Same as above. Focus on the `regression_detected` and `delta` fields.

**"How is the skill doing?"**

> Run watch. If `insufficient_data`, tell the user to wait for more
> sessions before drawing conclusions.

**"Auto-rollback if it regresses"**

> Use `--auto-rollback`. The command will restore the previous description
> automatically if pass rate drops below baseline minus threshold.

## Autonomous Mode

When called by `selftune orchestrate`, watch runs automatically on recently
evolved skills:

- Checks all skills evolved in the last --recent-window hours (default 24)
- Auto-rollback is enabled by default
- Results are included in the orchestrate run report
- No user notification — regressions are handled silently via rollback
