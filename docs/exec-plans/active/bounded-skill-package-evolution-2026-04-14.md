<!-- Verified: 2026-04-15 -->

# Execution Plan: Bounded Skill Package Evolution

**Status:** Completed  
**Created:** 2026-04-14  
**Goal:** Move selftune from description-first mutation toward bounded skill-package evolution grounded in replay, baseline, grading, and post-deploy observability.

## Executive Summary

PR #62 gives selftune a strong package lifecycle:

- `create init`
- `create scaffold`
- `create check`
- `create replay`
- `create baseline`
- `create publish`
- `create status`

The remaining mismatch is architectural, not cosmetic:

- the creator flow is package-shaped
- the validation loop is increasingly package-shaped
- but the mutation story is still centered on description evolution and
  confidence-gated proposal selection

This plan closes that gap without reopening arbitrary repo mutation.

The target is **bounded full-skill evolution**, meaning selftune can optimize
the allowed surfaces of a skill package:

- `SKILL.md` frontmatter and top-level instructions
- workflow routing
- workflow body/instruction sections
- bounded references, scripts, and assets when they are explicitly declared and
  evaluator-visible

The target is **not** generalized full-directory evolution across arbitrary
files in a repository.

## Why This Exists

Current selftune already has:

- runtime replay
- no-skill baseline measurement
- session grading
- body evolution
- routing evolution
- creator-loop readiness tracking

What it does not yet have is one measured package evaluator that can serve as
the source of truth for mutation acceptance and post-deploy trust.

That gap shows up in two places:

1. `create publish` has historically handed draft packages into the old
   description-evolve flow.
2. the evolutionary loop still relies too much on proposal confidence and
   one-shot candidate ranking instead of persistent, evidence-backed search.

## Scope

### In scope

- package-first publish gates
- unified evaluator contract for routing, package replay, unit tests, baseline,
  grading, and efficiency
- bounded package candidate state with lineage and cached evaluations
- post-deploy observational gates and rollback triggers
- GEPA-style search only after the evaluator contract is real

### Out of scope

- arbitrary mutation of any file in the repo
- confidence-only gating as the primary acceptance mechanism
- shipping a Python GEPA adapter before the TypeScript evaluator contract is
  stable
- replacing creator review for high-risk mutations

## Product Principles

1. **Evidence before mutation**
   - replay, baseline, tests, and grades decide whether a change helped

2. **Bounded surfaces only**
   - selftune may evolve declared skill-package surfaces, not arbitrary repo
     state

3. **Package truth over description truth**
   - the unit of optimization is the skill package as experienced by the host
     runtime

4. **Observability is part of the optimizer**
   - watch, rollback, and post-deploy grading are part of the search loop, not
     separate nice-to-have reporting

5. **Confidence is metadata, not proof**
   - model self-reported confidence can inform UI and review priority, but it
     is not the primary deploy gate

## Immediate Change

The first concrete step was to make `create publish` a package gate instead of
a description-evolution handoff:

1. re-run `create replay --mode package`
2. re-run `create baseline --mode package`
3. hand the validated package into `watch`

This is intentionally conservative. It makes publishing measured and
package-first before expanding mutation scope.

## Progress update (2026-04-15)

This plan is now complete.

### Landed in code

- `create publish` is now package-first and no longer hands draft packages
  straight into description-only `evolve`
- a shared package-evaluation summary now exists for draft publish flows,
  covering:
  - package replay
  - baseline lift
  - publish/watch handoff
- creator-loop readiness now keeps draft packages blocked on `create check` or
  package-resource fixes until those gates actually pass
- the overview, skill report, and `selftune status` now tell the same draft
  package story instead of mixing generic replay/baseline readiness with
  package-specific blockers
- dashboard actions now support `create check` directly
- dashboard actions now support `create report` directly for draft packages
- `create check` now emits structured live-run progress for:
  - draft package load
  - Agent Skills spec validation
  - selftune readiness computation
- overview creator-loop priorities are now executable from the dashboard for
  actionable steps, not only descriptive
- the live-run screen now renders measured package-evaluation evidence and
  efficiency directly, including:
  - replay-failure samples
  - baseline-win and baseline-regression samples
  - with-skill vs without-skill runtime aggregates
  - recommended next commands from package report/publish/watch flows
  - structured post-deploy watch signal, including:
    - watch snapshot counts
    - invocation-type pass/fail totals
    - regression/rollback status
    - grade-watch deltas when present

### What this means

The product surface is now meaningfully closer to bounded package evolution
than description-first mutation:

- publish is package-gated
- readiness is package-aware
- dashboard actions are package-aware
- live-run observability is package-aware for the first draft-package gate
- direct `watch` and `create publish --watch` now expose measured watch
  snapshots, alerts, and rollback recommendations through a structured result
  surface instead of a coarse "watch started" handoff
- the shared package-evaluation summary now carries runtime efficiency and
  representative evidence from replay/baseline instead of collapsing the result
  down to pass-rate only
- `create publish --watch` now attaches structured watch evidence directly to
  the shared package-evaluation summary, so publish/report/watch consumers can
  read one measured contract instead of stitching watch data on the side
- the shared package-evaluation summary now carries grading baseline and recent
  grading deltas when that evidence exists, so draft-package report/publish JSON
  can compare replay/baseline results against observed execution quality without
  routing grading through watch only
- the shared package-evaluation summary now also carries deterministic unit-test
  results and representative failing tests when that evidence exists, so
  draft-package report/publish flows can keep replay/baseline evidence tied to
  the latest stored test run instead of treating unit tests as a separate,
  implicit gate
- the shared package-evaluation summary now also carries current routing replay
  validation and current body validation, so draft-package report/publish/live
  review can compare package replay, routing fitness, and body quality from one
  measured summary instead of stitching those checks together out of band
- the dashboard live-run summary now parses and renders that shared grading
  block, so measured grading movement is visible in draft package report/publish
  runs without dropping to raw JSON
- the dashboard live-run summary now also renders routing replay results and
  body validation rationale directly from the shared package summary, so
  reviewers no longer need to inspect raw package-report JSON to see whether
  the current routing table or body text is the weak link
- readiness and `create check` now honor the latest failed deterministic
  unit-test run when one is recorded, so stored test failures can keep a draft
  blocked on `run_unit_tests` instead of surfacing a false-ready state from test
  file presence alone
- the shared package-evaluation summary is now stored canonically in SQLite and
  mirrored to `~/.selftune/package-evaluations/<skill>.json`, so draft
  publish/report/watch flows can reuse one measured artifact instead of
  recomputing or scraping stdout
- stored package-evaluation artifacts now carry a bounded package fingerprint,
  and readiness only trusts a stored package replay/baseline result when that
  fingerprint still matches the current draft tree, so stale measurements stop
  blocking edited packages by skill name alone
- the package evaluator now also persists a canonical full-evaluation artifact
  beside the summary, and it reuses that artifact when the requested package
  fingerprint and request shape still match, so report/publish flows stop
  repaying replay, routing validation, baseline, and body validation
  unnecessarily for unchanged drafts
- fresh package evaluations now also register a durable package candidate keyed
  by bounded package fingerprint, with parent linkage to the prior evaluated
  draft for that skill and a candidate-specific archived evaluation artifact, so
  later search can anchor lineage and evaluator reuse on more than a single
  "latest package report" file
- those candidate records now also store a measured acceptance decision against
  the parent candidate, with explicit replay/lift/body/unit-test deltas and a
  human-readable rationale, so package history can distinguish accepted vs
  rejected measured mutations instead of only recording lineage
- fresh candidate acceptance now compares against the latest accepted frontier
  member instead of blindly inheriting the most recent rejected draft as its
  measurement baseline, so search-state reuse starts to preserve a real
  accepted frontier instead of only a chronological chain
- package evaluation can now also reuse a matching accepted-candidate artifact
  by package fingerprint when the canonical latest artifact points at some other
  draft, so returning to an already-accepted frontier member does not repay the
  full replay/baseline/body evaluation cost
- accepted-frontier parent selection is now ranked by measured package outcomes
  rather than simple recency, so future candidates compare against the strongest
  accepted draft we have evidence for instead of whichever accepted run happened
  most recently
- `create publish --watch` now also refreshes the matching package-candidate
  artifact and registry row with structured watch evidence, so post-deploy
  health can influence future frontier selection instead of living only in the
  canonical latest package report
- creator readiness and `create check` now honor the latest stored package
  evaluation status, so draft packages stay blocked on replay or baseline when
  the last measured package report already failed those gates instead of
  surfacing a false `ready_to_publish` state from artifact presence alone
- description and body evolution no longer hard-reject proposals before
  validation just because model self-reported confidence is below threshold;
  confidence now acts as review metadata and adaptive-gate risk input rather
  than a primary stop/deploy gate
- review-ready package reports are now available from the dashboard, not only
  the CLI
- the skill report backend now emits real `frontier_state` data with accepted,
  rejected, and pending package candidates plus the latest persisted search-run
  provenance, so the frontier panel is backed by measured state instead of a
  dormant UI field
- bounded package search is now executable end to end through
  `selftune search-run`, with:
  - a top-level CLI command
  - dashboard action routing and live action streaming
  - skill/workflow/docs/help coverage
  - draft-package action affordances in the skill report
- bounded package search is now also reachable through the primary lifecycle
  alias via `selftune improve --scope package`, with:
  - package-evaluator `--eval-set` passthrough
  - package-scope validation-mode normalization onto replay-backed search
  - expert `--candidates` alias normalization onto `--max-candidates`
  - automatic winner promotion back into the draft package unless `--dry-run`
- `search-run` can now optionally promote the winning candidate back into the
  draft package and refresh the canonical package-evaluation artifact from the
  accepted candidate cache instead of leaving search as read-only provenance
- when `search-run --surface both` is used, candidate budgeting now biases the
  minibatch toward the weaker measured surface from the accepted frontier or
  canonical package evaluation instead of always splitting routing/body
  variants evenly
- that measured surface-plan decision is now persisted into search provenance
  and rendered in the live-run and skill-report frontier views, so search can
  explain not only which parent won but why routing/body candidate budget was
  allocated the way it was
- bounded search now evaluates temp package variants against the canonical skill
  name rather than the temp directory name, so candidate lineage, frontier
  reads, and winner selection all attach to the intended skill instead of a
  throwaway variant path
- search-run winner selection now follows the accepted frontier over the full
  evaluator contract instead of replay-only improvement, so candidates can win
  on measured baseline/body/routing/unit-test gains when replay stays flat
- orchestrate candidate preparation now actually marks skills as package-search
  eligible from the accepted frontier and canonical package-evaluation
  artifacts, so package search can be selected during normal orchestrate and
  `run` flows instead of only through explicit `improve --scope package`
- the orchestrate package-search phase now uses the current mutation and
  winner-application contracts, including the live candidate path fields and
  `applySearchRunWinner` response shape, so applied winners are recorded
  correctly in package-search summaries instead of only in direct `search-run`
  flows
- targeted routing/body mutations are now consumed by the orchestrate
  package-search runtime rather than sitting unused beside the deterministic
  generators, so measured replay/grading weaknesses can influence the actual
  variant minibatch instead of only test-only helpers
- direct `search-run` now uses that same eval-informed targeted-routing/body
  generation path, falling back to deterministic variants only when the
  measured targeted minibatch does not fill the requested routing/body budget
- `create publish --watch` now surfaces a measured publish-time watch gate
  directly in the
  publish payload, including `watch_gate_passed`, `watch_gate_warnings`, and
  `watch_trust_score`, plus an explicit `--ignore-watch-alerts` bypass for
  deliberate expert override cases
- bounded package search now also supports reflective routing/body proposals
  derived from measured replay, routing, and grading failures rather than only
  deterministic or keyword-targeted mutations
- accepted routing/body improvements can now be merged into a complementary
  package candidate and evaluated before final winner selection, so the
  frontier is no longer forced to choose between compatible single-surface
  wins
- plain `selftune improve` now auto-selects package search for package-shaped
  skills with draft manifests or existing package evidence instead of forcing
  `--scope package` to reach the bounded package path
- there is now an end-to-end package lifecycle test covering `verify` auto-fix,
  bounded package search, winner promotion, and `publish --watch`

## Workstream A: Unified Package Evaluator

**Goal:** one evaluator contract that every mutation path uses.

### Progress

Completed.

`create publish` and the dashboard now share a measured package summary for
draft-package replay and baseline, including runtime efficiency and
representative replay/baseline evidence. That contract now also carries
structured post-deploy watch signal when publish runs with `--watch`, and it
now includes deterministic unit-test results, grading context, current routing
replay validation, and current body validation.

The stored summary now also includes a bounded package fingerprint, and
readiness/status only reuse that summary when it still matches the current
draft package tree.

That same shared summary is now surfaced directly in the dashboard live-run
screen and can be invoked explicitly through a first-class `create report`
dashboard action, which means draft-package review no longer depends on reading
raw JSON or terminal output.

Readiness consumers now also use the canonical stored package-evaluation
summary, which means measured `replay_failed` and `baseline_failed` results can
override naive artifact-presence checks in `status` and `create check`.

The evaluator now also writes and reuses a canonical full-evaluation artifact
when the package fingerprint still matches the current draft and the request
shape has not changed, which gives `create report` and publish-time package
gates a real measured cache instead of recomputing every replay/baseline/body
check blindly.

That reuse is now surfaced explicitly as fresh vs cached evaluation provenance
in the package result itself, so artifact reuse stays auditable instead of
becoming an invisible optimization.
The dashboard live-run summary now carries the same provenance flag, so
measured reuse is visible in the main review surface instead of only in CLI
JSON or benchmark-report text.

Fresh package evaluations now also create a durable candidate registry entry
keyed by package fingerprint, with parent linkage to the last evaluated draft
for that skill and a candidate-specific archived evaluation artifact. That is
the first concrete package-lineage substrate for Workstreams B and C.
That candidate lineage is now surfaced in benchmark reports, publish summaries,
and the dashboard live-run view, so package history is inspectable in normal
review flows instead of only in archived JSON artifacts.

Candidate persistence now also records a measured acceptance decision per
candidate comparison. Re-evaluated candidates keep their original parent
relationship, fresh candidates compare against the prior measured draft, and
cache reuse now requires acceptance metadata in the stored artifact so older
lineage-only reports automatically refresh once before they participate in
candidate-aware reuse.

### Required outputs

- routing metrics
- package replay pass/fail and per-entry evidence
- current routing replay validation
- current body validation
- deterministic unit-test results
- no-skill vs with-skill lift
- post-run grade deltas
- efficiency metrics:
  - tokens
  - tool calls
  - turns
  - errors
- failure-side evidence:
  - traces
  - failing assertions
  - replay evidence
  - grade rationale

### Primary files

- `cli/selftune/create/replay.ts`
- `cli/selftune/create/baseline.ts`
- `cli/selftune/evolution/validate-body.ts`
- `cli/selftune/evolution/validate-routing.ts`
- `cli/selftune/grading/`
- `cli/selftune/monitoring/watch.ts`

### Exit criteria

- every mutation target consumes the same evaluator summary shape
- replay, baseline, and grading evidence are available without custom parsing
- confidence thresholds are no longer the main accept/reject gate

## Workstream B: Bounded Package Mutation

**Goal:** treat the candidate as a package snapshot, not only a description
string.

### Progress

Completed.

Package snapshots are now durable and reviewable: each measured evaluation can
be stored as a fingerprinted candidate with parent linkage, candidate-specific
artifacts, and a measured acceptance decision derived from replay, routing,
baseline, body, and unit-test deltas.

Bounded mutation primitives now also exist for routing and body variants, so
the repo has the first deterministic package-level mutation substrate for a
search runner to call. That said, this layer is still only partially complete:
the current primitives are deterministic transforms, not yet the full bounded
package mutation policy the plan ultimately calls for, and they still need
stronger integration with the measured search loop.

### Candidate surfaces

- frontmatter description
- `Workflow Routing`
- top-level skill body
- bounded workflow/reference/script/asset surfaces declared in
  `selftune.create.json`

### Constraints

- each mutable surface must have:
  - an evaluator-visible effect
  - a bounded patch shape
  - rollback support
- mutation of scripts/assets must stay opt-in and deterministic

### Exit criteria

- a package candidate can be stored, diffed, replayed, and rolled back
- package evolution is still bounded enough to audit and explain

## Workstream C: Search State And Acceptance

**Goal:** replace one-shot Pareto ranking with persistent measured search.

### Progress

Completed.

The first acceptance substrate is now in place. Candidate history no longer
only answers "what was evaluated"; it now also records whether a candidate was
accepted, rejected, or treated as the root baseline, plus the measured deltas
that justified that outcome. That state is visible in benchmark reports,
publish summaries, and dashboard live-run review.

Fresh candidates also now compare against the latest accepted frontier member
when such a baseline exists, while keeping chronological lineage separate via
the raw parent link. That is the first concrete step toward parent selection
from a maintained frontier rather than only replaying a linear evaluation
history.

The evaluator can now also reuse accepted frontier artifacts by fingerprint,
even when the one canonical "latest package report" file points at a different
draft. That means the candidate registry is no longer only historical context;
it now actively reduces evaluation cost when the current draft matches an
accepted frontier member.

Accepted-frontier reads now also sort the frontier by measured package quality
instead of timestamp alone. Selection prefers healthy observed candidates, then
grading movement, replay/routing performance, lift, body quality, unit-test
health, and efficiency. That keeps the raw parent link chronological while
moving actual comparison-baseline selection toward a maintained measured
frontier.

`create publish --watch` now writes that observed watch state back into the
matching package-candidate artifact and SQLite row without inventing a new
evaluation event. That closes the loop between deployment observation and
frontier reuse: observed regressions can demote an accepted candidate during
later parent selection while preserving the original measured evaluation count
and lineage.

The bounded package search runner is now executable end to end: it has a real
CLI command, dashboard action routing, live-run summaries, and skill-report
frontier state backed by real stored data. Winner selection now follows the
accepted frontier over the full evaluator contract instead of replay-only
deltas, and package-search evaluations normalize temp variants back onto the
canonical skill identity so frontier reuse and winner selection attach to the
correct skill.

Orchestrate and `run` now also build real package-search eligibility from
accepted-frontier and canonical package-evaluation evidence, so the
package-search branch is no longer dead code. The orchestrate package-search
phase has been aligned to the live package-search contracts and now consumes
targeted routing/body mutations in addition to the deterministic fallback
generators, which means measured replay/grading weaknesses can influence the
actual runtime minibatch instead of only helper-level tests.

That deeper integration and algorithmic depth is now landed: `improve` auto-
selects package search for package-backed skills, the mutation policy now
prefers reflective proposals before targeted/deterministic fallback, and the
search loop can evaluate a merged candidate when routing and body both improve.

### Requirements

- candidate pool with lineage
- cached candidate/example evaluations
- minibatch candidate selection
- acceptance on measured improvement
- ancestor-aware merge
- explicit provenance for every accepted mutation

### Exit criteria

- the optimizer can explain why a candidate was selected
- repeated runs do not re-pay the full evaluation cost blindly
- accepted candidates improve measured evaluator outputs, not only model scores
- `search-run` or its successor is part of the main improvement loop instead of
  an isolated expert command, and later extends into `run`/automatic package
  improvement selection

## Workstream D: Post-Deploy Observability

**Goal:** make deployment a monitored experiment.

### Progress

Completed.

Draft-package publish now hands into `watch`, and `create check` has live-run
step progress, but the post-deploy watch loop is still more mature for the
older evolution surfaces than for the full package story this plan targets.

The watch surface is now partially normalized for package flows:

- `watch` emits a machine-readable `recommended_command`
- `create publish --watch` carries the nested `watch_result` through directly
- dashboard/live-run summaries can now show measured watch deltas for both
  direct watch runs and package publish-with-watch runs
- watch now also reads the current package-evaluation artifact when available
  and computes an efficiency regression signal against the draft-package
  baseline, so post-deploy monitoring can flag token/turn inflation even when
  trigger pass rate stays stable
- that efficiency regression signal is now part of the structured watch result
  and package watch summary, so rollback recommendations can be driven by
  measured efficiency regressions instead of only trigger or grade regressions
- `create publish --watch` now also surfaces a measured publish-time watch gate
  in the publish payload itself, with pass/fail, warning text, trust score, and
  an explicit bypass knob, so publish surfaces can expose post-watch trust
  without forcing downstream consumers to reconstruct it from raw watch JSON

### Required signals

- grade distribution before vs after deploy
- trigger precision/recall deltas where measurable
- token and tool efficiency
- error-rate shifts
- rollback criteria for regressions

### Exit criteria

- `watch` can explain whether the deployed package is helping
- rollback decisions can be tied to measured post-deploy evidence

## Workstream E: GEPA-Style Integration

**Goal:** add true reflective search only after the evaluator is stable.

### Requirements

- reflective dataset built from runtime evidence, not only prompt summaries
- parent selection from a maintained frontier
- acceptance based on measured evaluator outcomes
- merge based on common ancestry and complementary improvements

### Decision rule

- do not integrate the external GEPA implementation until the evaluator
  contract and package candidate model are stable enough to adapt cleanly

### Completion note

The TypeScript search loop now satisfies the plan's reflective-search
requirements without pulling in an external Python adapter:

- reflective proposals are built from measured runtime evidence
- parent selection comes from the maintained accepted frontier
- acceptance is based on measured evaluator outcomes
- complementary routing/body wins can be merged and re-evaluated

## Relationship To Existing Plans

This plan refines the earlier creator-trust constraint that rejected
"generalized full-directory evolution."

That constraint remains correct for arbitrary repo mutation.

What changes now is scope clarity:

- **bounded package evolution is in scope**
- **arbitrary full-directory evolution remains out of scope**

It also serves as the package-evolution successor to the package lifecycle work
in PR #62: package creation is no longer the end state; package evaluation and
measured evolution become the next layer.

It now also depends on the companion simplification plan being mostly landed:

- top-level lifecycle aliases for `verify`, `publish`, `improve`, and `run`
- `skill/SKILL.md` and workflow docs rewritten around the smaller lifecycle
- dashboard/live-run/status/recommended-command surfaces normalized around the
  lifecycle-first vocabulary
- major CLI/docs cleanup so stage-heavy creator-loop wording is demoted instead
  of taught as the default product surface

That means the cross-plan state has changed:

- the **surface simplification slice is largely complete**
- the **remaining critical work is now architectural**

In practice, this bounded package plan is now the pacing item. The biggest open
items are no longer naming or workflow-surface cleanup; they are the real
package search runner, candidate selection loop, and measured mutation flow
that should sit underneath the already-simplified surface.

## Suggested PR Sequence

1. Completed: package-first `create publish` gate
2. Completed: package-aware creator readiness and dashboard execution for
   `create check`, replay, baseline, publish, and watch
3. Completed: structured watch summaries and recommendations for direct watch
   and package publish-with-watch
4. Completed: runtime efficiency and representative evidence in the shared
   package evaluator contract
5. Completed: expand that evaluator to include body/routing validation and
   grading deltas
6. Completed: bounded package candidate state + cache
7. Completed: measured package candidate acceptance + broader search-state reuse
8. Completed: accepted-frontier comparison, artifact reuse, and watch-fed
   frontier updates
9. Completed: companion command/skill-surface simplification to the point where
   lifecycle aliases and docs are no longer the primary blocker
10. Completed: route/report integration gaps, canonical skill attribution, and
    winner selection aligned with the full measured evaluator contract
11. Completed: bounded package search runner, deterministic mutation
    primitives, frontier/search provenance surfaces, and `improve --scope
    package` lifecycle integration
12. Completed: winner promotion back into the draft package and canonical
    package-artifact refresh from accepted candidate state
13. Completed: orchestrate scope selection routes candidates to package
    search when evidence supports it; workflow/skill docs normalized to
    reflect the new package-search-in-orchestrate truth; watch trust scoring
    documented as feeding back into scope selection and frontier demotion
14. Completed: review follow-through fixes for package evolution semantics:
    `verify` auto-fix now runs the real evidence-generation commands, targeted
    mutations now read the real grading schema instead of a fake `summary_json`
    fixture shape, publish-with-watch now blocks if watch fails to return
    structured output, and lifecycle docs now describe the actual readiness
    states/flags instead of stale `needs_evidence` shorthand
15. Completed: reflective parent/minibatch selection now prefers runtime-
    evidence-backed proposals before targeted and deterministic fallback
16. Completed: GEPA-style reflective search elements now sit on top of the
    TypeScript evaluator and candidate frontier, including complementary merge

## Exit Condition

This plan is complete when selftune can say, with evidence, that it evolves a
skill package because measured package behavior improved, not because a model
preferred a rewritten description.

That exit condition is now satisfied. Package mutation, candidate selection,
acceptance, merge, publish gating, and post-deploy observation all flow through
measured evaluator outputs, and the lifecycle is covered by an end-to-end test.
