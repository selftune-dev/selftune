# CI execution policy

Superseded pull-request runs cancel earlier runs for the same PR in CI, Desktop and Self-Host Image. Main pushes and merge-queue runs get distinct concurrency groups, so another push cannot cancel a full verification run. Release candidates retain per-tag serialization without cancelling an in-progress release.

CI runs on pull requests, including stacked PRs, and keeps the required `lint` and `test` names. Documentation-only PRs skip heavy jobs. Both required jobs fail if change selection fails; `test` also fails if lint fails. A mixed code and documentation PR runs normal validation. Unknown paths and an empty changed-file list select normal validation. Renames retain their source and destination names.

Desktop and Self-Host Image keep PR path selection because only `lint` and `test` are required by the current main ruleset. Markdown and `docs/` are excluded from those PR triggers. Workflow and selection-script changes trigger validation.

Desktop PRs package and smoke-test Linux and Windows. Pushes to main, merge queues and immutable release builds retain macOS ARM64, macOS Intel, Linux and Windows. All three workflows run their full checks on main pushes and merge queues even when only documentation changed. Release publishing, signing, image provenance and smoke gates are unchanged.

Local checks:

```sh
node --test .github/scripts/ci-policy.test.mjs
bun test tests/scripts/release-workflows.test.ts
```

Before merging CI changes, verify a stacked documentation-only PR and the implementation PR in GitHub Actions. Confirm job conclusions, selected platforms and superseded-run cancellation. Local selection tests do not establish hosted runner results.

Concurrency groups use a distinct prefix per workflow. A newer CI run cannot cancel Desktop or Self-Host Image, and PR cancellation cannot cancel an immutable release candidate.
