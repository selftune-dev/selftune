# selftune Signals Dashboard Workflow

View contributor signals, contributor statistics, and skill signal strength
from the hosted selftune cloud dashboard.

This is **not** the same as:
- `selftune dashboard` — the **local** SPA that reads your own SQLite telemetry
- `selftune contribute` — exporting an anonymized **export bundle** for the community
- `selftune contributions` — managing your **sharing preferences** for creator-directed signals
- `selftune creator-contributions` — managing the **creator sharing setup** file (`selftune.contribute.json`)

## When to Use

- The user asks about contributor signals, contributor stats, or aggregated skill health
- The user wants to see how many people are contributing signals for a skill
- The user asks about signal performance, signal strength, or cohort counts
- The user says "show me signals", "show me contributor signals", or "how are signals doing?"

## Where to Find It

The signals dashboard is the hosted web application at the selftune cloud
URL (e.g. `https://selftune.dev/signals` or the locally-running Next.js
dev server at `http://localhost:3000/signals`). The old `/community` path is a
legacy alias.

## What It Shows

| Section | Description |
| --- | --- |
| Overview cards | Total contributors, total signals, active skills |
| Skill list | Per-skill signal counts, distinct cohorts, trigger rates |
| Signal strength | Whether a skill meets the actionable threshold (>=10 signals, >=3 cohorts) |
| Time buckets | Signal volume over time |
| Pending proposals | Skills eligible for contributor-signal-driven evolution proposals |
| Below-threshold skills | Skills that need more data before proposals can be generated |

## Signal Strength Thresholds

A skill is considered **actionable** when it meets both of these thresholds:
- At least **10 total signals** from contributors
- At least **3 distinct contributor cohorts**

Skills below these thresholds appear in the "needs more data" section.
These same thresholds gate proposal generation on the API side.

## Steps

1. Direct the user to the signals dashboard URL
2. If asked about a specific skill, describe its signal strength and contributor count
3. If a skill is below threshold, explain how many more signals or cohorts are needed
4. If the user wants to help a skill reach threshold, route to the **Contribute** workflow
5. If the user is the skill creator, use the Community page as the handoff into proposals and watch

## Creator Loop

For a creator, the after-ship loop is:

1. check whether the skill is low-signal or actionable
2. inspect missed categories and grade distribution
3. create a contributor proposal only when the signal is coherent
4. review/apply the proposal through the normal proposal flow
5. watch outcomes after apply

Read `references/creator-playbook.md` for the full before-ship and after-ship playbook.

## Common Patterns

**User asks "how are contributor signals doing?"**

> Direct them to the signals dashboard. Summarize the overview stats
> (total contributors, total signals, number of actionable skills).

**User asks about a specific skill's contributor signals**

> Look up the skill on the signals dashboard. Report its total signals,
> distinct cohorts, and whether it meets the actionable threshold.

**User wants to help a skill that's below threshold**

> Route to the Contribute workflow (`selftune contribute --skill <name>`)
> to export an anonymized bundle and submit it.

**User confuses signals dashboard with local dashboard**

> Clarify: `selftune dashboard` shows **local** telemetry from your own
> SQLite database. The signals dashboard shows **aggregated** data from
> all contributors across the selftune cloud.
