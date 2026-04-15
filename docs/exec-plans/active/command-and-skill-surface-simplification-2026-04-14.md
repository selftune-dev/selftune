<!-- Verified: 2026-04-15 -->

# Execution Plan: Command And Skill Surface Simplification

**Status:** Completed
**Created:** 2026-04-14
**Goal:** Simplify selftune's primary product surface so agents and users think in lifecycle outcomes rather than internal pipeline stages.

## Executive Summary

selftune currently has enough capability to prove value, but too much of that
capability is exposed as pipeline-stage commands:

- `create init`
- `create scaffold`
- `create status`
- `create check`
- `eval generate`
- `eval unit-test`
- `create replay`
- `create baseline`
- `create publish`
- `watch`
- `evolve`
- `evolve body`
- `orchestrate`

That command surface is coherent for maintainers. It is not yet the simplest
surface for users' agents.

The product should teach one smaller lifecycle:

- create a draft
- verify trust
- publish safely
- improve with evidence
- run the autonomous loop

This plan does **not** replace the bounded package-evolution plan. It depends on
it. The bounded package-evolution plan is about the evaluator, candidate model,
and evidence contract. This plan is about what product surface sits on top of
that foundation.

## Progress Update (2026-04-15)

Completed so far:

- landed top-level lifecycle aliases for `verify`, `publish`, `improve`, and
  `run`
- rewrote `skill/SKILL.md` around the smaller lifecycle model and explicit
  lifecycle states
- added primary workflow docs for `Verify`, `Publish`, `Improve`, and `Run`
- reframed `Create`, demoted the older `CreateTestDeploy` path, and updated
  docs/reference surfaces to teach the simplified lifecycle first
- aligned dashboard action streaming and dashboard-triggered publish/evolve
  paths with the new aliases where behavior is preserved
- normalized the local dashboard overview, skill report, live action feed, and
  CLI docs so draft-package surfaces teach `verify`, `publish`, and live
  monitoring before lower-level stage commands
- normalized `selftune status`, dashboard recommended commands, README, quick
  reference, and the main authoring guides so legacy aliases like
  `create check`, `create publish`, and `orchestrate` are demoted to advanced
  wording instead of being taught as the default lifecycle vocabulary
- normalized automation and scheduling surfaces so `run` is now the default
  taught entrypoint for cron, schedule, monitoring, alpha-enrollment, and
  orchestration-report guidance, while `orchestrate` remains as the underlying
  advanced/runtime name
- cleaned up the remaining high-signal authoring guides and CLI docs so
  `create`, `verify`, `publish`, and `run` are taught first, `create.mdx` is
  valid again, and package-report docs now cover routing/body validation and
  the lifecycle-oriented publish handoff
- normalized the secondary advanced workflow docs and README so evals,
  unit-test, baseline, evolve, evolve-body, dashboard live-run, create-test-
  deploy, and watch guidance now distinguish draft-package lifecycle work from
  already-published skill iteration instead of teaching the older creator-loop
  chain as the default mental model
- cleaned up the remaining lifecycle wording in `status`, `eval`, and `create`
  CLI docs plus the shipped `SKILL.md` reference table so "creator loop"
  remains only as a compatibility/search synonym instead of the default product
  label
- documented package candidate lineage in the public `create` and `dashboard`
  CLI docs so the new `candidate_id`, parent, and generation fields are
  inspectable in the main review surfaces, not only in changelog entries or
  archived JSON artifacts
- corrected package-search lifecycle docs so `search-run` and
  `improve --scope package` are taught as explicit shipped surfaces, without
  incorrectly claiming that `run` / `orchestrate` already auto-select bounded
  package search
- normalized the remaining package-search and publish docs/help so
  `search-run` is described as bounded local package search with measured
  targeted variants, and publish surfaces now describe the real blocking
  watch-trust gate instead of the earlier advisory wording

Completion update:

- `verify` now consolidates the creator trust loop behind the shared package
  evaluator instead of acting as a thin alias over disparate stage commands
- `status`, dashboard guidance, and lifecycle normalization now point to the
  same primary commands rather than stage-level defaults
- `improve` now auto-selects bounded package search for package-backed skills,
  which means the primary lifecycle surface no longer requires agents to know
  the old `search-run` staging detail just to improve a draft package
- the shipped docs/help/skill surface now consistently demote stage-level
  commands to advanced usage while teaching `create`, `verify`, `publish`,
  `improve`, and `run` as the default product story

## Relationship To The Bounded Package Plan

This plan is a companion to:

- [bounded-skill-package-evolution-2026-04-14.md](./bounded-skill-package-evolution-2026-04-14.md)

Boundary:

- the bounded package plan owns evaluator unification, package-state, lineage,
  measured acceptance, and post-deploy trust
- this plan owns primary command naming, lifecycle abstraction, and the
  `skill/SKILL.md` mental model

Dependency:

- `verify` is only a real first-class product command once replay, baseline,
  grading, efficiency, and watch evidence can be summarized through one
  canonical evaluator shape

Until then, some simplification work will necessarily be aliasing and routing
discipline rather than deep behavioral consolidation.

## Why This Exists

selftune is agent-first:

- the CLI is the agent API
- `skill/SKILL.md` is the shipped product surface
- `skill/workflows/*.md` is the agent's operating manual

That means command complexity leaks directly into the product. Even if the
underlying code is correct, the surface is still too instruction-heavy when the
skill teaches a seven-step creator loop and many overlapping workflow choices.

The core usability problem is not just command count. It is that selftune still
teaches implementation stages rather than lifecycle outcomes.

## Product Principles

1. **Outcome-first, not stage-first**
   - users should ask whether a skill is ready, shipped, improving, or broken
     rather than whether replay or baseline has been run

2. **One lifecycle, many internals**
   - internal subcommands may remain, but the default surface should collapse
     around one lifecycle model

3. **Skill surface and CLI must match**
   - command simplification without `skill/SKILL.md` simplification is not a
     real product improvement

4. **Status must always point to one next action**
   - every primary surface should converge on the same lifecycle state and the
     same recommended next step

5. **Advanced commands remain available**
   - replay, baseline, eval generation, and other primitives still matter for
     debugging, CI, and expert operation

## Proposed Primary Surface

The intended primary commands are:

- `selftune create`
- `selftune verify`
- `selftune publish`
- `selftune improve`
- `selftune status`
- `selftune run`

### Intended meanings

- `create`
  - create a draft skill package from scratch or from workflow history
- `verify`
  - build or reuse trust evidence and tell the user whether the skill is ready
- `publish`
  - ship a verified package and attach watch automatically
- `improve`
  - run bounded improvement against measured evidence
- `status`
  - show lifecycle state, evidence summary, and one recommended next action
- `run`
  - autonomous loop alias for the current `orchestrate`

## Lifecycle Model

The product and the skill should explain skills in one of these states:

- `draft`
- `verify_blocked` (expressed concretely as `needs_spec_validation`, `needs_package_resources`, `needs_evals`, `needs_unit_tests`, `needs_routing_replay`, or `needs_baseline`)
- `verified`
- `published`
- `watching`
- `needs_improvement`
- `unhealthy`

This state model should become the common vocabulary across:

- CLI summaries
- dashboard CTA labels
- `next_command` / guidance payloads
- `skill/SKILL.md`
- workflow docs

## Mapping From Current Surface

### Keep as primary

- `status`
- `doctor`

### Collapse into primary lifecycle commands

- `create init` + `create scaffold` -> `create`
- `create check` + `eval generate` + `eval unit-test` + `create replay` +
  `create baseline` -> `verify`
- `create publish` + watch handoff -> `publish`
- `evolve` + `evolve body` -> `improve`
- `orchestrate` -> `run`

### Demote to advanced / expert / CI surface

- `eval generate`
- `eval unit-test`
- `create replay`
- `create baseline`
- `watch`
- `evolve body --target ...`
- `grade baseline`
- `sync`
- `ingest`
- `recover`
- `export`

## Skill Package Impact

The simplification only works if `skill/SKILL.md` changes with it.

### Current issues in the skill surface

- the top-level description still emphasizes description evolution
- the creator loop is taught as explicit pipeline stages
- workflow routing contains overlapping concepts that force the agent to reason
  about product internals

### Required `skill/SKILL.md` changes

1. Reframe the description around bounded skill-package lifecycle management:
   - verification
   - publishing
   - monitoring
   - improvement

2. Replace the seven-step creator loop with a smaller primary lifecycle:
   - `status`
   - `verify`
   - `publish`
   - `improve`
   - `run`

3. Teach lifecycle states explicitly, not just command sequences.

4. Make routing default to intention-level workflows before advanced internals.

## Proposed Skill Workflow Model

### Primary workflows

- `Create`
- `Verify`
- `Publish`
- `Improve`
- `Run`
- `Status`
- `Doctor`

### Advanced/supporting workflows

- `Evals`
- `UnitTest`
- `Baseline`
- `Replay`
- `Watch`
- `EvolveBody`
- `Composability`
- `ImportSkillsBench`

### Proposed merges

- `CreateTestDeploy.md` -> replace with `Verify.md` + `Publish.md`
- `Evolve.md` + `EvolveBody.md` -> merge conceptually under `Improve.md`
- `Orchestrate.md` -> keep for compatibility, but teach it as `Run`

## Workstream A: Primary Command Model

**Goal:** define a smaller first-class command vocabulary without deleting
expert primitives.

### Tasks

- add aliases or new command wrappers for:
  - `create`
  - `verify`
  - `publish`
  - `improve`
  - `run`
- define which current commands remain public but are documented as advanced
- make command help teach lifecycle intent before listing sub-flags

### Exit criteria

- help output can be understood from lifecycle terms rather than pipeline terms
- dashboard and `status` can recommend primary commands only
- existing low-level primitives remain available for power users

## Workstream B: Skill Surface Rewrite

**Goal:** make `skill/SKILL.md` and workflow routing match the simplified
product surface.

### Tasks

- rewrite `skill/SKILL.md` top-level positioning
- replace the seven-step creator trust loop with the lifecycle model
- reduce routing-table overlap in favor of:
  - `Create`
  - `Verify`
  - `Publish`
  - `Improve`
  - `Run`
- move stage-level commands and workflows into an advanced/supporting section

### Exit criteria

- the skill routes first by user intention, not by internal evaluator stage
- a user asking "can I trust this skill?" reaches `Verify`, not a chain of
  subcommands
- a user asking "make this skill better" reaches `Improve`, not a forced choice
  between description and body workflows

## Workstream C: Workflow Doc Migration

**Goal:** restructure workflow docs without losing advanced operational detail.

### Tasks

- add:
  - `skill/workflows/Verify.md`
  - `skill/workflows/Publish.md`
  - `skill/workflows/Improve.md`
- rewrite:
  - `skill/workflows/Create.md`
  - `skill/workflows/Orchestrate.md` or add a `Run.md` alias concept
- demote or cross-link:
  - `Evals.md`
  - `UnitTest.md`
  - `Baseline.md`
  - `Replay.md`
  - `Watch.md`
- retire or heavily reduce:
  - `CreateTestDeploy.md`

### Exit criteria

- there is a one-to-one match between primary product concepts and primary
  workflow docs
- advanced docs are still available without being the default teaching path

## Workstream D: State-Driven Guidance

**Goal:** make `status`, dashboard CTAs, and machine-readable guidance all point
to the same next action.

### Tasks

- formalize lifecycle state names
- ensure `status`, dashboard surfaces, and guidance payloads recommend the same
  primary command
- stop recommending stage-level commands in default surfaces once primary
  aliases/wrappers exist

### Exit criteria

- `status` always returns:
  - state
  - evidence summary
  - one next action
  - one primary next command
- dashboard primary CTAs align with the same state machine

## Sequencing

Recommended order:

1. land the unified evaluator contract from the bounded package plan
2. add primary command aliases/wrappers
3. rewrite `skill/SKILL.md` and workflow routing
4. update docs/help/dashboard CTAs to prefer the simplified surface
5. demote older stage-level commands to advanced documentation

## Milestone Checkpoint

### Completed

- Workstream A: primary lifecycle aliases/wrappers landed
- Workstream B: `skill/SKILL.md` rewrite landed
- Workstream C: primary workflow-doc migration landed
- dashboard alias recognition and dashboard-triggered lifecycle routing landed

### Remaining

None. Workstream D and the remaining demotion/deprecation cleanup are now
complete.

## Parallelization Guidance

Safe to do in parallel with bounded package-evolution work:

- draft or land companion docs for command simplification
- rewrite `skill/SKILL.md`
- add `Verify.md`, `Publish.md`, and `Improve.md`
- update routing, examples, and workflow docs

Not safe to do in parallel without coordination:

- editing the same exec-plan file
- editing the same CLI help surface files
- changing command names and dashboard CTA logic while another agent is editing
  those exact files

## Non-Goals

- deleting expert primitives
- pretending aliases alone solve evaluator fragmentation
- opening generalized arbitrary-file evolution
- replacing `doctor` or low-level observability tools with a single opaque
  command

## Success Criteria

- a user can understand selftune through:
  - `create`
  - `verify`
  - `publish`
  - `improve`
  - `run`
- the shipped skill teaches lifecycle outcomes instead of internal stages
- agents no longer need to reason about replay vs baseline vs eval generation
  unless the default path fails or the user asks for depth

Those success criteria are now satisfied.
