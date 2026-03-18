# Execution Plan: Alpha Rollout and Data Loop Activation

<!-- Verified: 2026-03-18 -->

**Status:** Planned  
**Created:** 2026-03-18  
**Goal:** Move selftune from “mechanics built” to “confidence building” by shipping a consent-based alpha rollout and a real multi-user data loop, while only fixing the dashboard/data-integrity issues that block trustworthy testing.

---

## Executive Summary

The office-hours synthesis changes the priority order.

The main problem is not “build more product surface.” The main problem is that selftune still lacks enough real-world data to know what good looks like across users, skills, and workflows.

That means the next move should **not** be “start the entire dashboard-data-integrity-recovery plan end-to-end.” That plan is valid, but only part of it is a prerequisite for alpha.

The right sequence is:

1. Land the **minimum trust fixes** required to make alpha data believable.
2. Build a **consentful alpha onboarding flow** that assigns a stable user ID.
3. Build the **remote data pipeline** for opted-in alpha users.
4. Create a **tight operator loop** for Daniel to inspect marginal cases and learn from them.
5. Then return to the deeper dashboard/runtime cleanup that is not blocking alpha.

---

## Recommendation on the Existing Recovery Plan

**Do not start the full** [dashboard-data-integrity-recovery.md](/Users/danielpetro/conductor/workspaces/selftune/miami/docs/exec-plans/active/dashboard-data-integrity-recovery.md) **first.**

Start only the parts of it that are direct alpha prerequisites:

- Phase 0: runtime identity and dev-server truth
- Phase 1: hermetic tests / proof harnesses
- Phase 2: lossy-rebuild guardrails and backup honesty

Defer the rest until after alpha data collection is live:

- WAL-based SSE freshness cleanup
- broader dashboard semantic cleanup
- deeper documentation realignment beyond what alpha needs

Reason: Ray’s synthesis says the bottleneck is confidence from data, not more mechanics. But alpha data is only useful if the data path is trustworthy.

---

## Planning Inputs

- [office-hours-2026-03-18-synthesis.md](/Users/danielpetro/Documents/Projects/FOSS/selftune/strategy/office-hours-2026-03-18-synthesis.md)
- [dashboard-data-integrity-recovery.md](/Users/danielpetro/conductor/workspaces/selftune/miami/docs/exec-plans/active/dashboard-data-integrity-recovery.md)

---

## Target State

- Daniel can onboard 3-5 alpha users with explicit consent in minutes.
- Each alpha user has a stable local identity stored in `~/.selftune/`.
- Opted-in alpha data uploads to a shared backend with enough fidelity to analyze false positives, false negatives, and marginal cases.
- Local dashboards and stores are trustworthy enough that Daniel can validate what happened during alpha sessions.
- Tests and proofs cannot pollute the real operator store.
- Rebuild/backfill cannot silently drop recent data.

---

## Execution Order

### Phase A: Alpha Trust Floor

**Priority:** Critical  
**Effort:** Medium  
**Risk:** Low

This phase is the minimum cut of the dashboard recovery work required before recruiting testers.

**Scope:**

1. Expose runtime identity in `/api/health` and the dashboard UI.
2. Fix the `bun run dev` backend-health probe and startup race.
3. Make test/proof runs hermetic with environment-overridable storage roots.
4. Add rebuild preflight/guardrails so recent SQLite-only rows cannot be silently discarded.

**Why this phase exists:**

- alpha data is useless if Daniel cannot tell which workspace/server he is looking at
- alpha data is dangerous if tests can leak into the real store
- alpha confidence collapses if rebuild can delete recent rows

**Completion criteria:**

- Daniel can identify workspace, DB path, log path, and watcher mode from the running dashboard
- `bun run dev` and `selftune dashboard` no longer create mystery backend mismatches
- proof/test runs leave `~/.selftune` and `~/.claude` untouched
- destructive rebuild aborts when it would be lossy

---

### Phase B: Consentful Alpha Onboarding

**Priority:** Critical  
**Effort:** Medium  
**Risk:** Medium

**Primary outcome:** `selftune init` becomes the alpha enrollment point.

**Files likely involved:**

- `cli/selftune/init.ts`
- `cli/selftune/types.ts`
- `cli/selftune/constants.ts`
- `skill/Workflows/Initialize.md`
- `skill/SKILL.md`
- config/helpers under `cli/selftune/`

**Changes:**

1. Add an explicit alpha-consent flow during init:
   - explain that this is an alpha
   - explain what data is shared
   - explain that the purpose is improving selftune
2. Collect:
   - email
   - display name or optional label
   - consent timestamp
   - alpha participation flag
3. Persist a stable local user identity in `~/.selftune/`.
4. Keep the flow simple and skippable:
   - opted-in alpha user
   - local-only user
5. Update the agent-facing init docs to reflect the exact flow.

**Non-goals:**

- full public-launch anonymization
- enterprise-grade privacy workflows

**Completion criteria:**

- a new alpha user can complete init and enrollment in under 5 minutes
- identity and consent are stored locally and inspectable
- the skill docs tell the agent how to explain the alpha clearly

---

### Phase C: Remote Alpha Data Pipeline

**Priority:** Critical  
**Effort:** Large  
**Risk:** Medium

**Primary outcome:** opted-in alpha data reaches a shared backend Daniel can analyze.

**Likely design direction:**

- use the existing Cloudflare/D1 direction from the synthesis
- upload from opted-in clients only
- treat local SQLite as source-of-truth cache, remote as analysis sink

**Files likely involved:**

- new remote sync/upload module under `cli/selftune/`
- `cli/selftune/orchestrate.ts` or a dedicated uploader command/scheduler
- `cli/selftune/contribute/` if reused
- `cli/selftune/types.ts`
- docs and init workflow

**Changes:**

1. Define the alpha upload contract:
   - user ID
   - agent/platform metadata
   - skill invocation facts
   - prompt/query references needed for false positive / false negative analysis
   - evolution outcomes where relevant
2. Decide upload timing:
   - immediate best-effort
   - periodic batch
   - explicit sync
3. Add local queueing / retry behavior for failed uploads.
4. Add a simple operator view or CLI for upload status.
5. Keep consent enforcement local and explicit.

**Completion criteria:**

- Daniel can query remote data by user, time window, and skill
- failed uploads are visible and retryable
- an opted-out user sends nothing upstream

---

### Phase D: Analysis Loop for Marginal Cases

**Priority:** High  
**Effort:** Medium  
**Risk:** Medium

**Primary outcome:** Daniel can turn alpha data into learning, not just storage.

**Changes:**

1. Build the four-quadrant analysis view around:
   - true positive
   - false positive
   - false negative
   - true negative
2. Prioritize operator views for:
   - likely false negatives
   - likely false positives
   - ambiguous/marginal cases
3. Add a lightweight review mechanism for marginal cases:
   - thumbs up/down
   - accepted/rejected label
   - optional note
4. Store those labels so future eval/evolution work can use them.

**Important note:**

This does **not** need to be a polished end-user product first. A Daniel-only operator surface is enough for the first cohort.

**Completion criteria:**

- Daniel can review and label marginal cases from alpha users
- labels are stored with enough context to feed later eval/evolution improvements

---

### Phase E: Alpha Cohort Operations

**Priority:** High  
**Effort:** Small  
**Risk:** Low

**Primary outcome:** the first 3-5 testers are actually live.

**Changes:**

1. Prepare a short alpha invite script and install script.
2. Create a tester checklist:
   - install
   - init
   - consent
   - verify upload
   - run normal work
3. Add a simple internal tracker:
   - who is active
   - when they were onboarded
   - whether uploads are flowing
   - notable skill failures or wins
4. Respond to Ray and any other volunteers with the alpha setup flow.

**Completion criteria:**

- 3-5 alpha users are onboarded
- at least 2 are generating real data regularly
- Daniel can inspect their uploads without custom debugging

---

### Phase F: Return to the Deferred Recovery Work

**Priority:** Medium  
**Effort:** Medium  
**Risk:** Medium

After alpha data is flowing, resume the deferred parts of the dashboard recovery plan:

- WAL-driven SSE freshness
- broader dashboard semantic cleanup
- final documentation alignment

This work still matters, but it should follow the data loop, not precede it.

---

## Suggested Immediate Ticket Split

If you want parallel work, split it this way:

1. **Agent 1:** Alpha trust floor
   - runtime identity
   - dev probe fix
   - hermetic test storage
   - rebuild guardrails
2. **Agent 2:** Alpha onboarding
   - init consent flow
   - local user ID/config
   - docs updates
3. **Agent 3:** Remote data contract spike
   - D1 schema
   - upload payload
   - queue/retry model

Do not give one agent “the whole alpha system.” The concerns are distinct and easy to muddle.

---

## Acceptance Criteria for Starting Alpha

Alpha is ready to begin when all of the following are true:

- Daniel can trust which runtime/store he is looking at
- tests cannot contaminate real data
- rebuild cannot silently lose fresh rows
- init can enroll a user with explicit consent
- opted-in data can reach the shared backend
- Daniel can inspect marginal cases from at least one non-Daniel user

Until then, the product is still in internal mechanics mode, not alpha-learning mode.
