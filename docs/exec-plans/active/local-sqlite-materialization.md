# Execution Plan: Local SQLite Materialization and App Data Layer

<!-- Verified: 2026-03-20 -->

**Status:** Active  
**Created:** 2026-03-12  
**Goal:** Finish the SQLite-first local runtime transition so the local app, CLI, and operator surfaces read from one operational store, while JSONL is reduced to capture, rebuild, export, and recovery roles.

---

## Executive Summary

This plan predates the current SQLite-first runtime cutover and should now be read as a migration-completion plan, not as justification for JSONL-first local reads.

JSONL still matters for:

- telemetry capture
- transcript/source replay
- repair overlays
- append-only local durability

They are not the right structure for serving a good local product experience directly.

SQLite via `bun:sqlite` is the right local operational store because it gives us:

- fast indexed reads
- a simple single-file local store
- WAL-backed write safety
- zero extra network services
- a much cleaner foundation for overview/report queries

The target local architecture is now:

- **SQLite = operational local runtime/query truth**
- **JSONL = append-only capture plus rebuild/export/recovery input during migration**
- **SPA = local operator experience**

---

## Why SQLite Is Now Justified

The old dashboard path showed the limits of raw-log-first serving:

- repeated large file scans and joins
- poor cold-start performance
- heavy live payloads
- fragile drilldown UX

SQLite solves the UX/product problem without replacing the telemetry model.

This is not a move to “database-first cloud telemetry.” It is a move to one operational local runtime store, with JSONL retained only where capture, replay, or recovery still require it.

---

## What Has Already Landed

`#42` introduced the first SQLite local materialization layer.

Since then:

- `#39` made the SPA the real local dashboard UI
- `#44` removed the legacy embedded-HTML runtime and v1 dashboard routes
- the shared dashboard payload contract now lives in `cli/selftune/dashboard-contract.ts`

That means the work now is not “decide whether to use SQLite.”  
The work now is:

1. stabilize the local DB schema and materialization flow
2. make overview/report queries first-class
3. move the local app to those queries
4. finish migrating the remaining dashboard-adjacent surfaces onto the same v2 contracts

---

## Data Model Role

SQLite should hold the structured local data needed for:

- overview page
- per-skill report page
- evolution evidence and version history
- summary/report payloads consumed by the local app

Likely source domains:

- sessions
- prompts
- skill invocations
- execution facts
- evidence
- optional materialized aggregates for overview/report

The exact schema can evolve, but its role should stay clear:

- operational local runtime store
- local query surface
- rebuildable from append-only capture where legacy bridges still exist

---

## Architectural Rules

### 1. Local runtime reads are SQLite-first

Dashboard, status, doctor, and other operator-facing local reads should treat SQLite as the operational source of truth.

### 2. JSONL remains capture/export/recovery input until the migration is fully closed

If rebuild/export paths still depend on JSONL, keep them honest and explicit. Do not reintroduce JSONL as a first-class live query surface.

### 3. Local app queries should be explicit

Do not let the app depend on giant generic payloads. Prefer query helpers and routes that match the UX:

- `OverviewPayload`
- `SkillReportPayload`

### 4. SQLite should stay local-only for now

Do not make the local DB the cloud contract. Cloud stays based on canonical telemetry + DB projections.

---

## Immediate Work

### 1. Stabilize overview/report query helpers

The local data layer should explicitly support:

- overview KPI/status/skill-card payload
- single-skill report payload

### 2. Finish the SQLite-backed local app path

The React local app already reads SQLite-backed payloads. The remaining work is to remove legacy freshness bridges and leftover JSONL-dependent dashboard helpers.

### 3. Remove remaining non-v2 dashboard paths

The legacy HTML runtime is gone. The remaining follow-through is to keep migrating:

- report HTML
- badge/status projections
- any leftover JSONL-only dashboard helpers

onto the same SQLite-backed payload semantics where appropriate.

### 4. Keep sync and rebuild semantics honest

Any rebuild/materialization flow must make it obvious when JSONL is still being used as import/recovery input, and which streams are already SQLite-primary.

---

## Open Questions

### How incremental should local materialization be?

Short term:

- correctness and simplicity matter more than perfect incrementalism

Later:

- add incremental rebuilds/checkpoints where safe and justified

### How much of the old dashboard server should remain?

Short term:

- enough to serve the SPA, report HTML, badges, and action endpoints

Long term:

- only the SPA/v2 contract, plus explicitly supported adjunct routes like badges and reports

---

## What This Enables

If this path is completed, selftune gains:

- fast local overview loads
- fast skill drilldowns
- simpler local UX architecture
- cleaner alignment between local and cloud payload semantics
- a better demo path on real machine data

That is why this work is now core to shipping, not optional polish.
