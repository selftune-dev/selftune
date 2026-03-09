# Design Doc: Workflow Support

**Status:** Proposed
**Author:** Daniel Petro
**Date:** 2026-03-08
**Depends on:** Composability v2 (see `composability-v2.md`)

---

## Problem

selftune monitors individual skills. But users don't use skills individually — they chain them. A user asks "write and publish a blog post" and the agent invokes copywriting, marketing, SEO, and blog publishing in sequence. selftune has zero visibility into whether that multi-skill chain worked.

Real example from a March 8 session:
1. MarketingAutomation/Copywriting → drafted blog post with SEO principles
2. Source analysis doc → read competitive analysis for content
3. Content composition → assembled final markdown
4. SelfTuneBlog → published to selftune.dev

The agent orchestrated 4 skills manually. selftune saw 4 individual skill invocations. It couldn't tell:
- Whether the handoff between skills was clean
- Whether the overall workflow succeeded
- Whether a different skill order would have been better
- Whether this pattern recurs (it does)

## First Principle

**Workflows don't need to be authored — they need to be discovered.**

The agent is already the workflow engine. Skills don't call each other. selftune's job isn't to orchestrate — it's to observe multi-skill patterns and improve them.

Key enabler: `SkillUsageRecord` already captures per-invocation `timestamp` + `session_id`. Ordered sequences are recoverable from existing telemetry without any new data collection.

## Design

### Core Concept: Discovered Workflows

A **workflow** is a frequently co-occurring ordered skill sequence with measurable session quality. Workflows are discovered from telemetry, not authored upfront.

```text
Discovery Pipeline:
  skill_usage_log.jsonl
    → group by session_id
    → sort by timestamp within session
    → extract ordered skill sequences
    → find recurring sequences (≥3 occurrences)
    → score by session quality (errors, completion)
    → surface as workflow candidates
```

### Workflow Lifecycle

```text
Phase 1: DETECT    — Find recurring skill sequences in telemetry
Phase 2: SCORE     — Measure workflow-level quality metrics
Phase 3: SUGGEST   — Surface discovered workflows to the user
Phase 4: CODIFY    — User optionally saves as named workflow in SKILL.md
Phase 5: EVOLVE    — Monitor and improve workflow trigger accuracy
Phase 6: WATCH     — Post-deploy regression detection at workflow level
```

### Data Model

#### Discovered Workflow (from telemetry)

```typescript
export interface DiscoveredWorkflow {
  /** Hash of ordered skill names for dedup */
  workflow_id: string;
  /** Ordered skill sequence */
  skills: string[];
  /** How many sessions contained this exact sequence */
  occurrence_count: number;
  /** Average errors across sessions with this workflow */
  avg_errors: number;
  /** Average errors when these skills are used individually (baseline) */
  avg_errors_individual: number;
  /** synergy_score = clamp((errors_individual - errors_workflow) / (errors_individual + 1), -1, 1) */
  synergy_score: number;
  /** Most common user query that initiated the workflow */
  representative_query: string;
  /** Timestamps of first and last occurrence */
  first_seen: string;
  last_seen: string;
}
```

#### Codified Workflow (user-saved)

```typescript
export interface CodifiedWorkflow {
  /** User-chosen name */
  name: string;
  /** Ordered skill sequence */
  skills: string[];
  /** Optional trigger description for the workflow as a whole */
  description?: string;
  /** Source: "discovered" | "authored" */
  source: "discovered" | "authored";
  /** Discovery metadata if source is "discovered" */
  discovered_from?: {
    workflow_id: string;
    occurrence_count: number;
    synergy_score: number;
  };
}
```

### SKILL.md Format Extension

Add an optional `## Workflows` section to SKILL.md:

```markdown
# My Project Skills

## Workflows

### Blog Publishing
- **Skills:** Copywriting → MarketingAutomation → SelfTuneBlog
- **Trigger:** User asks to write and publish a blog post
- **Source:** Discovered from 12 sessions (synergy: 0.72)

### Security Audit
- **Skills:** Recon → WebAssessment → Security
- **Trigger:** User asks for a security assessment
- **Source:** Authored
```

This section is:
- **Optional** — skills work fine without it
- **Informational** — the agent reads it for context, not as a hard execution plan
- **Backwards compatible** — agents that don't understand `## Workflows` simply ignore it
- **Evolvable** — selftune can propose additions based on discovered patterns

### SKILL.md `## Related Skills` Section

Individual skills can reference related skills:

```markdown
# Copywriting

## Related Skills
- **Often followed by:** SelfTuneBlog, SocialContent
- **Often preceded by:** Research, ContentAnalysis
- **Synergy score:** 0.72 with SelfTuneBlog (12 sessions)
```

This helps agents make better routing decisions without hard dependencies.

### Workflow-Level Telemetry

No new log files needed. Workflow analysis is computed from existing `skill_usage_log.jsonl` records:

```text
skill_usage_log.jsonl (existing):
  { timestamp, session_id, skill_name, skill_path, query, triggered }

Computed at analysis time:
  GROUP BY session_id → ORDER BY timestamp → skill sequence per session
```

#### Workflow Quality Metrics

| Metric | Computation | What It Tells You |
|--------|-------------|-------------------|
| **Synergy score** | `(errors_individual - errors_workflow) / (errors_individual + 1)` | Do these skills work better together than apart? |
| **Sequence consistency** | % of occurrences with same skill order | Is the ordering stable or chaotic? |
| **Completion rate** | % of sessions where all skills in sequence fired | Does the full chain execute? |
| **Handoff quality** | Error rate at skill transitions (error in skill N+1 after skill N) | Where do handoffs break? |
| **Workflow trigger rate** | % of queries that should trigger the workflow and do | Same as individual trigger accuracy, but workflow-level |

### CLI Commands

#### `selftune workflows`

Discover and display workflow patterns from telemetry.

```bash
selftune workflows [options]

Options:
  --min-occurrences <n>   Minimum times a sequence must appear (default: 3)
  --window <n>            Only analyze last N sessions
  --skill <name>          Only show workflows containing this skill
```

Output:
```text
Discovered Workflows (from 450 sessions):

  1. Copywriting → MarketingAutomation → SelfTuneBlog
     Occurrences: 12 | Synergy: 0.72 | Completion: 83%
     Common trigger: "write and publish a blog post"

  2. Research → FirstPrinciples → Content
     Occurrences: 8 | Synergy: 0.45 | Completion: 100%
     Common trigger: "research and write about [topic]"

  3. Recon → WebAssessment → Security
     Occurrences: 5 | Synergy: 0.61 | Completion: 60%
     Common trigger: "security assessment of [target]"
     ⚠ Low completion — WebAssessment often fails to trigger after Recon
```

#### `selftune workflows save <name>`

Save a discovered workflow to the project's SKILL.md.

```bash
selftune workflows save "Blog Publishing"
# Appends to ## Workflows section in SKILL.md
```

#### `selftune workflows evolve <name>`

Evolve a codified workflow — improve its trigger description, adjust skill ordering based on session quality, suggest missing skills.

```bash
selftune workflows evolve "Blog Publishing"
# Proposes: Add SEO skill between MarketingAutomation and SelfTuneBlog
# based on sessions where SEO was included showing 40% fewer errors
```

### Workflow Evolution

Workflow evolution extends the existing evolution pipeline:

| Individual Skill Evolution | Workflow Evolution |
|---------------------------|-------------------|
| Evolve description for trigger accuracy | Evolve workflow trigger description |
| Evolve body for execution quality | Suggest skill ordering changes |
| Detect missed triggers | Detect incomplete workflow executions |
| Rollback on regression | Rollback workflow-level changes |

**Workflow-specific evolution actions:**

1. **Trigger evolution** — Improve the workflow's overall trigger description so the agent recognizes when to chain skills
2. **Sequence optimization** — Suggest reordering skills based on error rates at transitions
3. **Gap detection** — Identify sessions where adding a skill to the sequence improved quality
4. **Pruning** — Identify skills in the sequence that don't contribute (no quality difference with/without)

### Rollback Semantics

Workflow evolution changes are reversible:
- Trigger description changes: same backup/rollback as individual skill descriptions
- Sequence changes: stored as named snapshots in `~/.selftune/memory/workflow-snapshots/`
- The `## Workflows` section in SKILL.md is the canonical state — rollback reverts this section

### Cross-Platform Support

Workflow discovery works on any platform that produces `skill_usage_log.jsonl`:
- Claude Code: native hook support
- Codex: via `selftune ingest-codex`
- OpenCode: via `selftune ingest-opencode`
- OpenClaw: via `selftune ingest-openclaw`

No platform-specific logic needed. The analysis operates on the shared log schema.

### Implementation Phases

| Phase | What Ships | Builds On |
|-------|-----------|-----------|
| **v0.3** | `selftune workflows` (discovery + display) | Composability v2 |
| **v0.3** | `selftune workflows save` (codify) | SKILL.md format extension |
| **v0.4** | `selftune workflows evolve` (workflow-level evolution) | Existing evolution pipeline |
| **v0.4** | Handoff quality metrics | Workflow telemetry analysis |
| **v0.5** | `## Related Skills` auto-generation | Discovery data |

### Zero-Dependency Compliance

All workflow analysis is:
- **Pure functions** operating on JSONL arrays (same pattern as composability.ts)
- **No new log files** — computed from existing `skill_usage_log.jsonl` + `session_telemetry_log.jsonl`
- **No runtime dependencies** — standard TypeScript/Bun
- **No agent intervention required** — discovery is automated from telemetry

## Concrete Example

**Scenario:** Daniel uses copywriting + blog publishing together 12 times over two weeks.

**What selftune discovers:**
```text
selftune workflows

  1. Copywriting → SelfTuneBlog
     Occurrences: 12 | Synergy: 0.72 | Completion: 83%
     Common trigger: "write and publish a blog post"

     Handoff analysis:
       Copywriting → SelfTuneBlog: 92% clean (1 error in 12 sessions)

     Suggestion: Sessions that included MarketingAutomation between
     Copywriting and SelfTuneBlog had 40% fewer errors. Consider
     adding it to the workflow.
```

**What Daniel does:**
```bash
selftune workflows save "Blog Publishing"
# Saves: Copywriting → MarketingAutomation → SelfTuneBlog
```

**What selftune monitors going forward:**
- Workflow-level trigger accuracy for "write and publish" queries
- Completion rate (do all 3 skills fire every time?)
- Handoff quality at each transition
- Auto-rollback if workflow quality drops after a model update

## Open Questions

1. Should workflows be project-scoped or user-scoped? (Leaning: project-scoped in SKILL.md, with user-scoped discovery)
2. What's the right minimum occurrence threshold? (Starting: 3, tunable)
3. Should `selftune status` show workflow health alongside individual skill health? (Yes, in v0.3)
4. How do we handle "fuzzy" workflows where skill order varies? (Treat as separate workflows, surface the variation)
