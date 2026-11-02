| Workflow | Issue | Evidence | Estimated runner minutes saved per 30 days |
| --- | --- | --- | --- |
| `.github/workflows/desktop.yml` | macOS on every relevant PR | Excluding this task's verification branches, 5 Desktop PR runs consumed 129.67 min; macOS accounts for 65.38 min across retry attempts. | Gross upper bound 65.38 min at the same PR mix. Extra full main/merge runs offset this, so net savings are not yet measured. |
| `ci.yml`, `desktop.yml`, `selfhost-image.yml` | Superseded PR work was not consistently cancelled | Automatic cancellation is demonstrated by runs 41443628010, 41443628016 and 41443628019. These controlled runs are excluded from historical forecasts. | Not extrapolated from intentionally induced cancellations. |
| `ci.yml` / `publish.yml` | A new CI push trigger would duplicate the existing full post-merge workspace suite | Publish already runs lint, architecture checks, full workspace typecheck/tests, desktop/self-host runtime checks on each main push. The first CI patch added another push run; this audit removes that new duplicate trigger. | Avoided additional usage, not historical savings. Publish main coverage remains; CI covers the merge queue. |
| `codeql.yml` + `dynamic/github-code-quality/codeql` | Overlapping scanners merit scope comparison | Explicit CodeQL used 43.97 min; dynamic code-quality runs used 33.05 min. Coverage equivalence is not established. | No scanner removed or coverage reduction proposed. |
| `ci.yml` | Workspace tests consume a substantial share of CI time | CI workspace test steps consumed 27.95 of 60.28 CI min; Publish test steps add 20.50 min. Per-test timings are not retrieved. See the bounded test-suite report. | No test deletion, merge or quarantine; savings pending profiling. |

# CI cost report

Repository: [selftune-dev/selftune](https://github.com/selftune-dev/selftune). Implementation: [PR #183](https://github.com/selftune-dev/selftune/pull/183). Baseline ref: `5335ce6a6e5469b2adf57bdb8035a6f3461a76a4`. Audit date: November 2, 2026.

## Measurement and limits

Window: **October 3, 2026 12:57:26 UTC through November 2, 2026 12:57:26 UTC**. All repo workflow-run pages were retrieved, splitting date ranges below GitHub's 1,000-result cap and deduplicating by run ID. Job lists use `filter=all`, paginate, and include retried jobs/matrix targets. No job-list requests failed.

Retrieved **76 run records**, with **81 summed attempt ordinals**, and **547.50 observed runner minutes**. Attempt ordinals count rerun events, not proof that every job reran. Per-job attempt numbers are retained in the source data. Job durations count only jobs with a nonzero runner ID and completed timestamps; skipped, unassigned and unfinished work does not become zero-cost execution proof. Totals include the complete duration of retrieved attempts whose parent run was created in the window. A retry after the cutoff can therefore extend beyond the window; parent runs created before the window but retried inside it are not captured by this created-date query. This is a run-cohort measurement, not a billing-period export.

Runner minutes sum job start-to-completion durations and include parallel jobs and retry work. They are **not billed minutes or dollar spend**; billing usage, rounding, multipliers, included allowances and runner pricing were not retrieved. Workflow elapsed proxies use latest `run_started_at → updated_at`, include queue/metadata effects, and cannot be added to or substituted for runner minutes. Previous-attempt workflow elapsed time is not available from that proxy. Failures count failure/timed_out/startup_failure/action_required; cancellations are separate. Pending work has no final outcome at the snapshot.

[Run ledger](ci-cost-runs.csv) records ID, workflow, duration, actor/type, branch, revision, event and outcome for each run. Bot identities are taken from GitHub actor type; a user account is not evidence of human authorship. Agent authorship and historical draft state were not retrieved. This task's `codex/trim-actions-usage`, `codex/verify-docs-only-actions` and SelfTune PR 183 dynamic runs are marked verification work. Totals show them; historical forecasts exclude them. Never extrapolate the intentionally cancelled verification runs as organic savings.

## Workflow totals

| Workflow | Runs / attempt ordinals | Failure / cancelled runs | Observed runner min | Share | Latest-attempt elapsed proxy min |
| --- | ---: | ---: | ---: | ---: | ---: |
| `.github/workflows/ci.yml` | 11 / 11 | 1 (9.1%) / 3 | 60.28 | 11.0% | 56.28 |
| `.github/workflows/auto-bump-cli-version.yml` | 9 / 9 | 0 (0.0%) / 0 | 2.83 | 0.5% | 3.50 |
| `.github/workflows/codeql.yml` | 15 / 15 | 0 (0.0%) / 0 | 43.97 | 8.0% | 56.78 |
| `.github/workflows/selfhost-image.yml` | 9 / 9 | 0 (0.0%) / 3 | 35.87 | 6.6% | 40.33 |
| `.github/workflows/desktop.yml` | 9 / 11 | 1 (11.1%) / 4 | 149.45 | 27.3% | 61.12 |
| `dynamic/github-code-quality/codeql` | 15 / 15 | 0 (0.0%) / 0 | 33.05 | 6.0% | 34.47 |
| `.github/workflows/scorecard.yml` | 4 / 4 | 0 (0.0%) / 0 | 3.00 | 0.5% | 25.33 |
| `.github/workflows/sync-skill-to-site.yml` | 2 / 2 | 0 (0.0%) / 0 | 0.08 | 0.0% | 0.22 |
| `.github/workflows/publish.yml` | 2 / 5 | 0 (0.0%) / 0 | 218.97 | 40.0% | 1.75 |

Failure rates can be calculated as the failure column divided by run count; the ledger preserves each outcome. Observed runner-OS shares are retained below. Missing/deleted workflows and externally managed dynamic workflows appear in totals when observed; their current repository configuration cannot be inventoried from an absent file.

Representative run evidence for each workflow:

- `.github/workflows/ci.yml`: [run 41444025277](https://github.com/selftune-dev/selftune/actions/runs/41444025277).
- `.github/workflows/auto-bump-cli-version.yml`: [run 41443911622](https://github.com/selftune-dev/selftune/actions/runs/41443911622).
- `.github/workflows/codeql.yml`: [run 41443911465](https://github.com/selftune-dev/selftune/actions/runs/41443911465).
- `.github/workflows/selfhost-image.yml`: [run 41443911471](https://github.com/selftune-dev/selftune/actions/runs/41443911471).
- `.github/workflows/desktop.yml`: [run 41443911448](https://github.com/selftune-dev/selftune/actions/runs/41443911448).
- `dynamic/github-code-quality/codeql`: [run 41443905824](https://github.com/selftune-dev/selftune/actions/runs/41443905824).
- `.github/workflows/scorecard.yml`: [run 40351274034](https://github.com/selftune-dev/selftune/actions/runs/40351274034).
- `.github/workflows/sync-skill-to-site.yml`: [run 40073451186](https://github.com/selftune-dev/selftune/actions/runs/40073451186).
- `.github/workflows/publish.yml`: [run 40073451157](https://github.com/selftune-dev/selftune/actions/runs/40073451157).

## Execution gaps and access

One zero-job run is a cancelled superseded verification run, not proof of runner or billing failure. The current self-hosted runner API lists no registered runners and cannot describe historical hosted availability. The main ruleset requires `lint` and `test`; classic protection returns branch-not-protected because this policy is in rulesets. Required names remain unchanged. A failed selector reports failures through both required jobs, rather than silently skipping them. No protection rule was changed.

## Ranked implementation and compute decision

1. Cancel superseded PR runs with distinct per-workflow groups. Keep running release candidates and unrelated branches isolated. Required failure gates use !cancelled() so cancellation works.
2. Skip verified docs-only PR heavy jobs while preserving required statuses and failing closed on selector errors. Optional Desktop/Image workflows retain PR path filters.
3. Keep Linux/Windows PR package smoke tests; run all four desktop targets on merge queue/main/release. Keep full post-merge workspace coverage in Publish instead of duplicating it with a CI push run. Full main Desktop/Image runs add cost versus the old baseline; report the net tradeoff after merging rather than summing gross PR savings.
4. Transfer dynamic matrix fields through quoted environment variables instead of shell-source expressions. All signed-release, image-digest and smoke gates remain.
5. Investigate explicit versus dynamic CodeQL scope before any consolidation; no scanner or test was removed. See [test-suite efficiency](test-suite-efficiency-report.md).

Keep GitHub-hosted runners for now. No self-hosted migration, paid runner service, infrastructure benchmark or Bazel rollout is proposed from this small cohort. Billing access is incomplete and the volume changes have not been re-measured after merge. No compute was purchased and no benchmark was performed. Any later runner recommendation needs current primary-source pricing and a representative authorized benchmark.

Do not total the findings-table estimates: draft/docs filtering, consolidation and cancellation overlap, while full main/merge coverage adds work. **Measured post-merge savings: not retrieved. Net estimated savings: not established.**

## Validation and security

Whole-workflow actionlint passes after edits. Baseline zizmor findings by rule: `{'artipacked': 7, 'adhoc-packages': 4, 'use-trusted-publishing': 2, 'template-injection': 3, 'secrets-inherit': 1, 'self-repository': 2}`. Current findings: `{'artipacked': 7, 'adhoc-packages': 4, 'template-injection': 3, 'secrets-inherit': 1, 'self-repository': 2}`. Zizmor does not pass cleanly; remaining existing findings are recorded, not suppressed. New dynamic-matrix shell interpolation findings in the first SelfTune patch were fixed by quoting environment values. Touched third-party action pins were resolved through GitHub tag/commit APIs on November 2; action versions were not upgraded. No secret values or references changed.

23 parsed release/workflow tests and 9 selector tests pass, along with changed-file oxlint/oxfmt and commit hooks. [Code CI](https://github.com/selftune-dev/selftune/actions/runs/41443911708), [Desktop](https://github.com/selftune-dev/selftune/actions/runs/41443911448) and [Self-Host Image](https://github.com/selftune-dev/selftune/actions/runs/41443911471) all passed. Only Linux/Windows PR targets were allocated. [Docs-only run](https://github.com/selftune-dev/selftune/actions/runs/41444025277) passed changes and skipped lint/test/build-dashboard; Desktop/Image did not trigger. Superseded runs 41443628010/016/019 cancelled automatically without a cancellation API. An older always()-based verification run needed manual cleanup; it is not counted as automatic cancellation proof.

The [implementation PR description](https://github.com/selftune-dev/selftune/pull/183) is the live verification ledger for the final pinned/security revision, additional deliberate-failure checks, and temporary PR cleanup. Pre-pin passing runs above establish the original code path, not a claim that a later commit already passed. Temporary tests are closed without merging. No implementation PR has been merged by this task.

Merge-group selection is covered locally with the actual selector and workflow graph. **Live merge-queue verification is pending**: no queue was configured or exercised, and changing protection/queue settings is outside scope. Main/release builds on the final revision remain pending merge/release; local matrix/graph tests do not establish a live signed release.

## Two-week follow-up

Pending request or an authorized schedule. Fourteen days after actual merge, retrieve the next complete run cohort and all job attempts using the same method. Compare total runner minutes, minutes per relevant code PR and completed main/merge candidate, failure/execution-gap rates, docs/draft skips, cancellations, OS share and actual schedule count. Separate tests from setup/builds and normalize for run volume, matrix targets, release frequency and incomplete jobs. Confirm required checks still block relevant failures. Report billed usage separately only if retrieved. No follow-up automation was created.

## Current workflow inventory

All current repository workflow files are recorded below: triggers, branches/path filters, concurrency, matrices, OS, explicit/default timeouts and cache-related setup. Missing cache keys are not assumed effective. A missing timeout uses GitHub's normal six-hour job limit; reusable jobs may inherit caller limits. Historical workflow definitions can differ from this final-review snapshot.

```json
{
  "auto-bump-cli-version.yml": {
    "name": "Changeset Required",
    "on": {
      "pull_request": {
        "types": [
          "opened",
          "synchronize",
          "reopened",
          "ready_for_review"
        ],
        "branches": [
          "main"
        ],
        "paths": [
          ".dockerignore",
          ".npmignore",
          ".github/scripts/smoke-selfhost-image.sh",
          ".github/workflows/auto-bump-cli-version.yml",
          ".github/workflows/ci.yml",
          ".github/workflows/desktop.yml",
          ".github/workflows/publish.yml",
          ".github/workflows/selfhost-image.yml",
          "CHANGELOG.md",
          "README.md",
          "apps/desktop/**",
          "apps/cli/**",
          "apps/local/**",
          "apps/local-dashboard/**",
          "apps/selfhost/**",
          "assets/**",
          "bin/**",
          "bun.lock",
          "cli/selftune/**",
          "package.json",
          "packages/control-plane/**",
          "packages/dashboard-core/**",
          "packages/harnesses/**",
          "packages/orchestration/**",
          "packages/runtime/**",
          "packages/telemetry-contract/**",
          "packages/ui/**",
          "scripts/pack-package.ts",
          "scripts/publish-package-json.cjs",
          "scripts/smoke-packed-package.ts",
          "scripts/release-version.ts",
          "scripts/release-plan.ts",
          "scripts/render-release-notes.ts",
          "scripts/sync-skill-version.ts",
          "scripts/validate-release-ref.ts",
          "skill/**",
          "templates/**",
          "lint-architecture.ts",
          "turbo.json"
        ]
      }
    },
    "concurrency": {
      "group": "changeset-required-${{ github.event.pull_request.number }}",
      "cancel-in-progress": true
    },
    "jobs": {
      "changeset-required": {
        "runner": "ubuntu-latest",
        "timeout": 10,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          }
        ],
        "if": null
      }
    }
  },
  "publish.yml": {
    "name": "Publish",
    "on": {
      "push": {
        "branches": [
          "main"
        ]
      },
      "workflow_dispatch": {
        "inputs": {
          "repair_release": {
            "description": "Rebuild and re-promote an existing release from its verified source tag",
            "required": false,
            "default": false,
            "type": "boolean"
          },
          "release_tag": {
            "description": "Existing vX.Y.Z tag to repair; required when repair_release is true",
            "required": false,
            "type": "string"
          }
        }
      }
    },
    "concurrency": {
      "group": "publish-selftune",
      "cancel-in-progress": false
    },
    "jobs": {
      "test": {
        "runner": "ubuntu-latest",
        "timeout": 30,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          }
        ],
        "if": null
      },
      "prepare-release": {
        "runner": "ubuntu-latest",
        "timeout": 15,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          },
          {
            "action": "actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f",
            "with": {
              "node-version": "24",
              "registry-url": "https://registry.npmjs.org"
            }
          }
        ],
        "if": "always() && needs.test.result == 'success'"
      },
      "desktop-candidate": {
        "runner": null,
        "timeout": "default 360",
        "matrix": null,
        "cache": [],
        "if": "always() && needs.prepare-release.result == 'success' && needs.prepare-release.outputs.should_release == 'true'"
      },
      "selfhost-candidate": {
        "runner": null,
        "timeout": "default 360",
        "matrix": null,
        "cache": [],
        "if": "always() && needs.prepare-release.result == 'success' && needs.prepare-release.outputs.should_release == 'true'"
      },
      "publish-npm": {
        "runner": "ubuntu-latest",
        "timeout": 20,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          },
          {
            "action": "actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f",
            "with": {
              "node-version": "24",
              "registry-url": "https://registry.npmjs.org"
            }
          }
        ],
        "if": "always() && needs.prepare-release.outputs.should_release == 'true' && needs.desktop-candidate.result == 'success' && needs.selfhost-candidate.result == 'success'"
      },
      "promote-release": {
        "runner": "ubuntu-latest",
        "timeout": 15,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          },
          {
            "action": "actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f",
            "with": {
              "node-version": "24",
              "registry-url": "https://registry.npmjs.org"
            }
          }
        ],
        "if": "always() && needs.prepare-release.outputs.should_release == 'true' && needs.desktop-candidate.result == 'success' && needs.selfhost-candidate.result == 'success' && needs.publish-npm.result == 'success'"
      }
    }
  },
  "codeql.yml": {
    "name": "CodeQL",
    "on": {
      "push": {
        "branches": [
          "main"
        ]
      },
      "pull_request": {
        "branches": [
          "main"
        ]
      },
      "schedule": [
        {
          "cron": "0 9 * * 1"
        }
      ]
    },
    "concurrency": null,
    "jobs": {
      "analyze": {
        "runner": "ubuntu-latest",
        "timeout": "default 360",
        "matrix": null,
        "cache": [],
        "if": null
      }
    }
  },
  "sync-skill-to-site.yml": {
    "name": "Sync skill to marketing site",
    "on": {
      "push": {
        "branches": [
          "main"
        ],
        "paths": [
          "skill/**"
        ]
      },
      "workflow_dispatch": null
    },
    "concurrency": null,
    "jobs": {
      "trigger-rebuild": {
        "runner": "ubuntu-latest",
        "timeout": "default 360",
        "matrix": null,
        "cache": [],
        "if": null
      }
    }
  },
  "selfhost-image.yml": {
    "name": "Self-Host Image",
    "on": {
      "workflow_call": {
        "inputs": {
          "release_tag": {
            "description": "Existing draft GitHub release tag for the immutable image candidate",
            "required": true,
            "type": "string"
          },
          "source_sha": {
            "description": "Immutable 40-character source commit for the release tag",
            "required": true,
            "type": "string"
          }
        },
        "outputs": {
          "image_ref": {
            "description": "Immutable version-tagged self-host image reference",
            "value": "${{ jobs.publish-release-manifest.outputs.image_ref }}"
          },
          "manifest_digest": {
            "description": "Digest of the proven multi-architecture image manifest",
            "value": "${{ jobs.publish-release-manifest.outputs.manifest_digest }}"
          }
        }
      },
      "workflow_dispatch": {
        "inputs": {
          "release_tag": {
            "description": "Existing release tag to publish as a multi-architecture image",
            "required": true,
            "type": "string"
          },
          "source_sha": {
            "description": "Immutable 40-character source commit for the release tag",
            "required": true,
            "type": "string"
          }
        }
      },
      "push": {
        "branches": [
          "main"
        ]
      },
      "merge_group": null,
      "pull_request": {
        "paths": [
          "apps/selfhost/**",
          "apps/cli/**",
          "apps/local/**",
          "apps/local-dashboard/**",
          "cli/selftune/**",
          "packages/control-plane/**",
          "packages/harnesses/**",
          "packages/orchestration/**",
          "packages/runtime/**",
          ".github/scripts/smoke-selfhost-image.sh",
          ".github/workflows/selfhost-image.yml",
          "scripts/release-version.ts",
          "scripts/validate-release-ref.ts",
          "package.json",
          "bun.lock",
          ".dockerignore",
          ".github/scripts/ci-policy.mjs",
          ".github/scripts/ci-policy.test.mjs",
          "!**/*.md",
          "!docs/**"
        ]
      }
    },
    "concurrency": {
      "group": "selfhost-image-${{ inputs.release_tag || github.event.pull_request.number || github.run_id }}",
      "cancel-in-progress": "${{ github.event_name == 'pull_request' }}"
    },
    "jobs": {
      "changes": {
        "runner": "ubuntu-latest",
        "timeout": 3,
        "matrix": null,
        "cache": [],
        "if": null
      },
      "verify": {
        "runner": "ubuntu-latest",
        "timeout": 15,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          }
        ],
        "if": "needs.changes.outputs.run_heavy == 'true'"
      },
      "build-validation": {
        "runner": "ubuntu-latest",
        "timeout": 30,
        "matrix": null,
        "cache": [],
        "if": "inputs.release_tag == ''"
      },
      "build-release-digest": {
        "runner": "ubuntu-latest",
        "timeout": 45,
        "matrix": {
          "include": [
            {
              "platform": "linux/amd64",
              "artifact": "amd64"
            },
            {
              "platform": "linux/arm64",
              "artifact": "arm64"
            }
          ]
        },
        "cache": [],
        "if": "inputs.release_tag != ''"
      },
      "publish-release-manifest": {
        "runner": "ubuntu-latest",
        "timeout": 10,
        "matrix": null,
        "cache": [],
        "if": "inputs.release_tag != ''"
      }
    }
  },
  "desktop.yml": {
    "name": "Desktop",
    "on": {
      "workflow_call": {
        "inputs": {
          "release_tag": {
            "description": "Existing draft GitHub release tag to attach desktop artifacts to",
            "required": true,
            "type": "string"
          },
          "source_sha": {
            "description": "Immutable 40-character source commit for the release tag",
            "required": true,
            "type": "string"
          }
        },
        "secrets": {
          "DESKTOP_APPLE_API_ISSUER": {
            "required": false
          },
          "DESKTOP_APPLE_API_KEY": {
            "required": false
          },
          "DESKTOP_APPLE_API_KEY_ID": {
            "required": false
          },
          "DESKTOP_CSC_KEY_PASSWORD": {
            "required": false
          },
          "DESKTOP_CSC_LINK": {
            "required": false
          },
          "RELEASE_PAT": {
            "required": false
          }
        }
      },
      "workflow_dispatch": {
        "inputs": {
          "release_tag": {
            "description": "Existing GitHub release tag to build and attach signed desktop artifacts to",
            "required": true,
            "type": "string"
          },
          "source_sha": {
            "description": "Immutable 40-character source commit for the release tag",
            "required": true,
            "type": "string"
          }
        }
      },
      "push": {
        "branches": [
          "main"
        ]
      },
      "merge_group": null,
      "pull_request": {
        "paths": [
          "apps/desktop/**",
          "apps/cli/**",
          "apps/local/**",
          "apps/local-dashboard/**",
          "scripts/smoke-windows-service.ps1",
          "cli/selftune/**",
          "packages/control-plane/**",
          "packages/dashboard-core/**",
          "packages/harnesses/**",
          "packages/orchestration/**",
          "packages/runtime/**",
          "packages/telemetry-contract/**",
          "packages/ui/**",
          "skill/settings_snippet.json",
          ".github/workflows/desktop.yml",
          ".changeset/**",
          "package.json",
          "bun.lock",
          "scripts/release-version.ts",
          "scripts/release-plan.ts",
          "scripts/validate-release-ref.ts",
          "tests/scripts/release-workflows.test.ts",
          ".github/scripts/ci-policy.mjs",
          ".github/scripts/ci-policy.test.mjs",
          "!**/*.md",
          "!docs/**"
        ]
      }
    },
    "concurrency": {
      "group": "desktop-${{ inputs.release_tag || github.event.pull_request.number || github.run_id }}",
      "cancel-in-progress": "${{ github.event_name == 'pull_request' }}"
    },
    "jobs": {
      "changes": {
        "runner": "ubuntu-latest",
        "timeout": 3,
        "matrix": null,
        "cache": [],
        "if": null
      },
      "build-windows-sidecar": {
        "runner": "ubuntu-latest",
        "timeout": 20,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          }
        ],
        "if": "needs.changes.outputs.run_heavy == 'true'"
      },
      "build": {
        "runner": "${{ matrix.os }}",
        "timeout": 60,
        "matrix": "${{ fromJSON(needs.changes.outputs.desktop_matrix) }}",
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          },
          {
            "action": "actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f",
            "with": {
              "node-version": "24"
            }
          }
        ],
        "if": null
      },
      "attach-release": {
        "runner": "ubuntu-latest",
        "timeout": 15,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          }
        ],
        "if": "inputs.release_tag != ''"
      }
    }
  },
  "ci.yml": {
    "name": "CI",
    "on": {
      "merge_group": null,
      "pull_request": null,
      "workflow_dispatch": {}
    },
    "concurrency": {
      "group": "ci-${{ github.event.pull_request.number || github.run_id }}",
      "cancel-in-progress": "${{ github.event_name == 'pull_request' }}"
    },
    "jobs": {
      "changes": {
        "runner": "ubuntu-latest",
        "timeout": 3,
        "matrix": null,
        "cache": [],
        "if": null
      },
      "lint": {
        "runner": "ubuntu-latest",
        "timeout": "default 360",
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          },
          {
            "action": "actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830",
            "with": {
              "path": "~/.bun/install/cache",
              "key": "bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}",
              "restore-keys": "bun-${{ runner.os }}-"
            }
          }
        ],
        "if": "${{ !cancelled() && (needs.changes.result != 'success' || needs.changes.outputs.run_heavy == 'true') }}"
      },
      "build-dashboard": {
        "runner": "ubuntu-latest",
        "timeout": 20,
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          },
          {
            "action": "actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830",
            "with": {
              "path": "~/.bun/install/cache",
              "key": "bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}",
              "restore-keys": "bun-${{ runner.os }}-"
            }
          },
          {
            "action": "actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f",
            "with": {
              "node-version": "24"
            }
          }
        ],
        "if": "needs.changes.outputs.run_heavy == 'true'"
      },
      "test": {
        "runner": "ubuntu-latest",
        "timeout": "default 360",
        "matrix": null,
        "cache": [
          {
            "action": "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6",
            "with": {
              "bun-version": "1.3.14"
            }
          },
          {
            "action": "actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830",
            "with": {
              "path": "~/.bun/install/cache",
              "key": "bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}",
              "restore-keys": "bun-${{ runner.os }}-"
            }
          }
        ],
        "if": "${{ !cancelled() && (needs.changes.result != 'success' || needs.changes.outputs.run_heavy == 'true') }}"
      }
    }
  },
  "scorecard.yml": {
    "name": "OpenSSF Scorecard",
    "on": {
      "schedule": [
        {
          "cron": "0 9 * * 1"
        }
      ]
    },
    "concurrency": null,
    "jobs": {
      "analysis": {
        "runner": "ubuntu-latest",
        "timeout": "default 360",
        "matrix": null,
        "cache": [],
        "if": null
      }
    }
  }
}
```

## Runner-OS totals

```json
{
  ".github/workflows/ci.yml": {
    "Linux": 60.28333333333334
  },
  ".github/workflows/auto-bump-cli-version.yml": {
    "Linux": 2.8333333333333335
  },
  ".github/workflows/codeql.yml": {
    "Linux": 43.96666666666667
  },
  ".github/workflows/selfhost-image.yml": {
    "Linux": 35.86666666666667
  },
  ".github/workflows/desktop.yml": {
    "Linux": 39.45,
    "Windows": 44.61666666666667,
    "macOS": 65.38333333333333
  },
  "dynamic/github-code-quality/codeql": {
    "Linux": 33.05
  },
  ".github/workflows/scorecard.yml": {
    "Linux": 2.9999999999999996
  },
  ".github/workflows/sync-skill-to-site.yml": {
    "Linux": 0.08333333333333334
  },
  ".github/workflows/publish.yml": {
    "Linux": 104.51666666666668,
    "macOS": 81.93333333333334,
    "Windows": 32.516666666666666
  }
}
```
