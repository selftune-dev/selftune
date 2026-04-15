# selftune Search-Run Workflow

Use this when the user wants bounded package evolution instead of a single
description, routing, or body mutation. `search-run` explores a minibatch of
package variants, evaluates them through the shared package evaluator, and
records the winner plus provenance in the package frontier.

## Command

```bash
selftune search-run --skill-path <path> [--skill NAME] [--surface routing|body|both] [--max-candidates N] [--agent AGENT] [--eval-set PATH] [--apply-winner] [--json]
```

## Options

| Flag               | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `--skill-path`     | Path to a skill directory or `SKILL.md` file               |
| `--skill`          | Override the inferred skill name for lineage and reporting |
| `--surface`        | Mutation surface to explore: `routing`, `body`, or `both`  |
| `--max-candidates` | Cap the number of variants evaluated in this run           |
| `--agent`          | Runtime agent to use for shared package evaluation         |
| `--eval-set`       | Override the eval set used during package evaluation       |
| `--apply-winner`   | Promote the winning candidate back into the draft package  |
| `--json`           | Emit the full search result as JSON                        |
| `--help`           | Show command help                                          |

## What It Does

1. Resolves the draft package from `--skill-path`
2. Generates reflective variants first when measured failures and an agent are
   available, then eval-informed targeted variants, then deterministic fallback
   variants to fill the minibatch
   - when `--surface both`, selftune biases the routing/body minibatch toward
     the weaker measured surface from the accepted frontier or canonical package
     evaluation
3. Evaluates each candidate through the shared package evaluator
4. If routing and body both produce accepted improvements, evaluates a merged
   candidate built from the complementary surfaces
5. Compares accepted candidates against the measured frontier
6. Persists the search run, selected parent, winner, and provenance

## When To Use

- The package is already verified and you want to explore multiple candidate edits
- You want a measured parent-selection loop instead of a one-shot mutation
- The skill report already shows frontier lineage and you want to expand it

## Recommended Path

Start after the draft passes package verification:

```bash
selftune verify --skill-path <path>
selftune search-run --skill-path <path> --surface both
```

If you want the main lifecycle alias instead of the low-level command, use:

```bash
selftune improve --skill <name> --skill-path <path> --scope package
```

`selftune run` (via the `selftune orchestrate` runtime) auto-selects package
search for eligible skills. During the plan phase, `shouldSelectPackageSearch()`
routes a skill to the package-search action instead of description evolution
when eligibility criteria are met:

- The skill has an **accepted frontier candidate** from a prior search run, OR
- The skill has a **canonical package evaluation artifact**, OR
- The skill has a **draft package plus enough grading evidence** to be treated
  as package-search eligible during orchestrate

Manual invocation via `selftune improve --scope package` or
`selftune search-run` remains available for on-demand use outside the
orchestrate loop.

Plain `selftune improve --skill <name> --skill-path <path>` also auto-selects
this path when the skill already has package evidence or a draft package
manifest.

When `search-run` runs with `--apply-winner`, or when `improve --scope package`
runs without `--dry-run`, the winning candidate is copied back into the draft
package automatically and the canonical package-evaluation artifact is
refreshed. The next step is usually:

```bash
selftune publish --skill-path <path>
```
