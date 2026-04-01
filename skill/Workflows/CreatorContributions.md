# selftune Creator-Contributions Workflow

Manage the creator-side `selftune.contribute.json` file bundled with a skill.

This is **not** the same as:
- `selftune contributions` — end-user opt-in / opt-out preferences
- `selftune contribute` — community export bundle

## When to Use

- The user is a skill creator and wants to enable creator-directed contribution for one skill
- The user wants to inspect or remove a bundled `selftune.contribute.json`
- The user wants to prepare a skill package for the future creator ← user relay pipeline

## Default Commands

```bash
selftune creator-contributions
selftune creator-contributions status --skill <name>
selftune creator-contributions enable --skill <name> [--skill-path <path>] [--creator-id <id>]
selftune creator-contributions disable --skill <name> [--skill-path <path>]
```

## Options

| Flag | Description |
| --- | --- |
| `--skill <name>` | Skill name to inspect or configure |
| `--skill-path <path>` | Explicit path to the skill's `SKILL.md` when auto-discovery is ambiguous |
| `--creator-id <id>` | Explicit creator ID. If omitted, selftune uses `alpha.cloud_user_id` from local config when available |
| `--signals <csv>` | Comma-separated signal list for the generated config |
| `--message <text>` | Custom opt-in note stored in the config |
| `--privacy-url <url>` | Optional creator privacy URL stored in the config |

## What It Does Today

- Discovers installed skills that already ship `selftune.contribute.json`
- Creates or removes that config file locally for a creator-owned skill
- Uses a static JSON config only — no executable creator code

## Notes

- This is local packaging/setup only. It does **not** upload creator-directed signals yet.
- The creator ID is currently sourced from `--creator-id` or the local alpha identity's `cloud_user_id`.
- Use this workflow when the user is preparing a skill package.

## Common Patterns

**User wants to see which of their skills already request creator contributions**

> Run `selftune creator-contributions` and summarize the discovered configs.

**User wants to enable creator contributions for one skill**

> Run `selftune creator-contributions enable --skill <name>`.
> If auto-discovery fails, rerun with `--skill-path /path/to/SKILL.md`.
> If no creator identity is available locally, rerun with `--creator-id <id>`.

**User wants to stop bundling creator contribution config**

> Run `selftune creator-contributions disable --skill <name>`.
