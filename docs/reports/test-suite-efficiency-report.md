# Test-suite efficiency audit

Bounded discovery for the November 2, 2026 CI audit. Recommendations only. No test was deleted, merged, skipped or quarantined, and no coverage or project-rule gate changed.

## Evidence and limits

Window: October 3, 2026 12:57:26 UTC through November 2, 2026 12:57:26 UTC. The CI `Full workspace tests` steps consumed **48.45 observed runner minutes** across available attempts. CI as a whole consumed 60.28 observed job minutes. Of those test-step minutes, CI accounts for 27.95 min across 8 executions and Publish for 20.50 min across 5 executions. CI test steps are therefore 46.4% of the 60.28 measured CI job minutes. Setup, builds and parallel jobs are accounted separately in [the CI report](ci-cost-report.md).

The final pre-audit [code CI run](https://github.com/selftune-dev/selftune/actions/runs/41443911708) passed its required test job in 8m05s. Historical jobs include intentional cancellation tests; those are not organic flakiness. Per-test durations, JUnit artifacts, assertion-level failure history, test counts/LOC growth and authorship were not retrieved. No mutation experiment was performed because no individual candidate has yet been identified with sufficient evidence. No claim about generated tests, redundant assertions or agent-created runtime share is supported.

## Recommendations

| Test or shared fixture | Origin and confidence | Runtime per run | Executions in window | Observed failures and history gaps | Mutation evidence and scope | Protected behavior and overlap | Proposal | Estimated runner minutes saved per month and confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Full workspace suite, `bun run test` | Mixed or unknown author origin; high confidence in job-step measurement, no individual test ranking | Individual timing not retrieved; latest required test job 8m05s includes more than this command | 13 executions: 8 CI and 5 Publish; a test-step execution is not the same as run count | One CI suite-step failure and no Publish suite-step failures were observed. The available final code run passes. Per-test historical failure records are not retrieved. Deliberate cancellations are separated from failures. | Not run; no selected candidate | Protects workspace behavior and failure paths. Equivalent coverage from desktop/self-host follow-up commands has not been established. | Keep all assertions. Collect existing per-test timing/report artifacts first, then time-box investigation of the slowest representative suite. | Pending; no defensible reduction estimate |
| Repeated dependency installation across CI/packaging/release jobs | Shared workflow setup, not attributed to agents | Across all workflows, `bun install --frozen-lockfile` steps consumed 23.00 min and ignore-scripts installs 23.30 min; setup command variants have different trust/runtime behavior | Complete job cohort is in the CI report; do not assume all installs are interchangeable | No cache-hit ledger or install-specific failure history retrieved | Not applicable to assertion removal | Installs pinned dependencies and native/runtime build inputs. Separate jobs require isolation; a shared node_modules artifact can change trust boundaries. | Inspect existing cache hit/miss rates and native dependencies. Prefer safe download-cache improvements before test removal. Preserve immutable lockfiles and release isolation. | Pending measurement; these totals are gross setup time, not avoidable savings |

Value card for the workspace suite: it protects observable cross-package behavior; a real runtime or type-contract regression should fail it; overlapping suite coverage is not proven; no production-only-for-test seam was identified. Without individual timings and assertions, a deletion or consolidation recommendation would be speculation.

Value card for dependency setup: it protects reproducible execution of the pinned suite; missing or incompatible dependencies should fail before tests run; repeated setup does not imply redundant behavior coverage; native packages and release isolation justify separate environments.

## Next bounded pass

Retrieve the repo's existing timing/artifact output for one expensive completed test job, separating installation, collection, fixture setup, test execution and teardown. Rank actual expensive test IDs. For any serious candidate, document its protected behavior, a plausible failing regression, overlap for the same boundary inputs, and any test-only production seam. Use a disposable checkout for a targeted fault only when it resolves a real uncertainty. Preserve known bug regressions, authentication and security checks.

A later implementation step would need separate authorization for any test deletion, consolidation or quarantine. This audit does not add a CI stage, mutation tool or new project rule. Two-week remeasurement remains pending request or an authorized schedule.
