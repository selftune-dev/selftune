# selftune Watch Workflow

Monitor post-deploy package performance for regressions. Compares current
pass rates against a baseline within a sliding window of recent sessions.
Watch is the final stage of the package evaluation pipeline: after a
package is published, watch feeds measured evidence back into the accepted
frontier to confirm the package holds under real traffic.

## Default Command

```bash
selftune watch --skill <name> --skill-path <path> [options]
```

## Options

| Flag                    | Description                                      | Default  |
| ----------------------- | ------------------------------------------------ | -------- |
| `--skill <name>`        | Skill name                                       | Required |
| `--skill-path <path>`   | Path to the skill's SKILL.md                     | Required |
| `--window <n>`          | Sliding window size (number of sessions)         | 20       |
| `--threshold <n>`       | Regression threshold (drop from baseline)        | 0.1      |
| `--auto-rollback`       | Automatically rollback on detected regression    | Off      |
| `--sync-first`          | Refresh source-truth telemetry before evaluating | Off      |
| `--sync-force`          | Force a full source rescan during `--sync-first` | Off      |
| `--grade-threshold <n>` | Grade regression threshold (drop from baseline)  | 0.15     |
| `--no-grade-watch`      | Disable grade-based regression monitoring        | Enabled  |
| `--help`                | Show command help                                | Off      |

## Output Format

```json
{
  "snapshot": {
    "timestamp": "2026-04-14T14:00:00Z",
    "skill_name": "pptx",
    "window_sessions": 20,
    "skill_checks": 18,
    "pass_rate": 0.89,
    "false_negative_rate": 0.11,
    "by_invocation_type": {
      "explicit": { "passed": 4, "total": 4 },
      "implicit": { "passed": 8, "total": 9 },
      "contextual": { "passed": 4, "total": 4 },
      "negative": { "passed": 0, "total": 1 }
    },
    "regression_detected": false,
    "baseline_pass_rate": 0.92
  },
  "alert": null,
  "rolledBack": false,
  "recommendation": "Skill \"pptx\" is stable. Pass rate 0.89 is within acceptable range of baseline 0.92.",
  "recommended_command": null,
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
    "delta": 0.2
  }
}
```

### Status Values

Watch does not emit a separate `status` enum anymore. Instead, read:

| Field                          | Meaning                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `snapshot.regression_detected` | Trigger pass rate dropped below baseline minus threshold             |
| `alert`                        | One or more trigger/grade regressions were detected                  |
| `rolledBack`                   | Watch auto-rollback restored the previous version                    |
| `recommended_command`          | Machine-readable follow-up command when watch wants an explicit step |

## Grade Regression Monitoring

In addition to trigger-based regression (pass rate from eval sets), watch now
monitors **grade regression** using grading baselines stored in SQLite.

Grade regression compares the baseline grade pass rate (written when a skill is
deployed) against the average pass rate of recent grading results. If the delta
exceeds `gradeRegressionThreshold` (default 0.15), a `gradeAlert` is raised.

This runs alongside trigger regression:

| Check              | Source                     | Threshold | Field                 |
| ------------------ | -------------------------- | --------- | --------------------- |
| Trigger regression | Eval set pass rates        | 0.10      | `regression_detected` |
| Grade regression   | Grading baseline vs recent | 0.15      | `gradeRegression`     |

Both checks contribute to the overall `alert` field. A grade regression alert
is appended to the watch alert string alongside any trigger regression alert.

Grade watch is enabled by default. Disable it by passing `--no-grade-watch`
if you only want trigger-based monitoring.

## Parsing Instructions

### Check Regression Status

```bash
# Parse: .snapshot.regression_detected (boolean)
# Parse: .alert (string|null)
# Parse: .rolledBack (boolean)
```

### Get Key Metrics

```bash
# Parse: .snapshot.pass_rate vs .snapshot.baseline_pass_rate
# Parse: .snapshot.skill_checks (should be close to .snapshot.window_sessions)
# Parse: .recommended_command for the next machine-readable follow-up
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

| Signal                              | Action                                            |
| ----------------------------------- | ------------------------------------------------- |
| `alert == null`                     | No rollback signal. Continue monitoring.          |
| `alert != null` and `rolledBack`    | Auto-rollback already happened. Confirm recovery. |
| `alert != null` and not rolled back | Investigate and consider `recommended_command`.   |
| low `snapshot.skill_checks`         | Wait for more sessions before calling it stable.  |

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

> Same as above. Focus on `snapshot.regression_detected`, `alert`, and
> `recommended_command`.

**"How is the skill doing?"**

> Run watch. If `insufficient_data`, tell the user to wait for more
> sessions before drawing conclusions.

**"Auto-rollback if it regresses"**

> Use `--auto-rollback`. The command will restore the previous description
> automatically if pass rate drops below baseline minus threshold.

## Trust Scoring and Frontier Feedback

Watch results now feed back into the package search pipeline and orchestrate's
scope selection:

- **Frontier demotion:** When watch detects a regression for a skill that has
  an accepted package frontier candidate, the observed watch evidence is
  written back into that candidate's artifact and SQLite row. This can demote
  the candidate during future frontier parent selection, so the next search
  run compares against a stronger baseline instead of repeating a regressed
  one.
- **Publish blocking:** Watch alerts can block publish when regressions are
  detected. The `create publish --watch` flow attaches structured watch
  evidence directly to the package-evaluation summary. Regressions surface as
  explicit blockers rather than silent degradation.
- **Scope influence:** Orchestrate uses watch evidence when deciding whether a
  skill should go through description-level evolve or package-level search on
  the next run. Skills with observed package regressions may be re-routed to
  package search to address the underlying package-level issue rather than
  only adjusting the description.

### How Watch Evidence Feeds Back to the Frontier

When `selftune publish` runs with watch enabled and the watch result contains
alerts, the publish flow calls `refreshPackageCandidateEvaluationObservation()`
(in `create/package-candidate-state.ts`). This function writes the structured
watch evidence — alert text, regression deltas, and grade regression data —
back into the candidate's SQLite row.

The frontier ranking comparator in `package-candidate-state.ts` uses **watch
rank as the highest-priority signal** in its 15-level sort order:

| Watch rank | Meaning                                    | Effect on frontier position |
| ---------- | ------------------------------------------ | --------------------------- |
| 2          | No issues detected                         | Best — ranked first         |
| 1          | Unknown or insufficient watch data         | Neutral — middle tier       |
| 0          | Alert, rollback, or regression detected    | Worst — ranked last         |

Demoted candidates appear with `watch_demoted: true` in the dashboard frontier
state, making it visible to the operator which candidates were deprioritized by
watch evidence.

On subsequent search runs, the parent selection step picks the highest-ranked
frontier member as the baseline for the next generation of mutations. A
watch-demoted candidate (rank 0) will be deprioritized in favor of candidates
without alerts, so the search continues from a stronger measured baseline
rather than repeating a regressed one.

## Autonomous Mode

When called by `selftune run` (backed by the `selftune orchestrate` runtime),
watch runs automatically on recently evolved skills:

- Checks all skills evolved in the last --recent-window hours (default 24)
- Auto-rollback is enabled by default
- Results are included in the orchestrate run report
- No user notification — regressions are handled silently via rollback
- Watch evidence feeds back into the accepted package frontier for skills
  with package evaluation history, influencing future scope selection
