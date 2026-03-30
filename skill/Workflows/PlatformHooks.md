# Platform Hooks Workflow

## Purpose
Install and configure selftune hooks for non-Claude-Code platforms (Codex, OpenCode, Cline).

## When to Use
- User wants selftune on Codex, OpenCode, or Cline
- User asks about multi-platform support
- User wants real-time skill tracking on a non-Claude-Code agent

## Commands

### Install hooks for a platform
```
selftune <platform> install [--dry-run] [--uninstall]
```

Supported platforms: `codex`, `opencode`, `cline`

### Hook handler (called by the agent, not the user)
```
selftune <platform> hook
```

This is called automatically by the agent's hook system. Users don't run this directly.

## Platform Details

### Codex
- Config: `~/.codex/hooks.json`
- Events: SessionStart, PreToolUse, PostToolUse, Stop
- Install creates hooks.json entries pointing to `npx selftune codex hook`

### OpenCode
- Config: `~/.config/opencode/config.json`
- Events: tool.execute.before, tool.execute.after, session.idle
- Install writes a shell shim script

### Cline
- Config: `~/Documents/Cline/Hooks/`
- Events: PostToolUse, TaskComplete, TaskCancel
- Install creates executable shell scripts in the hooks directory

## Examples

Install selftune for Codex:
```
selftune codex install
```

Preview what would be installed:
```
selftune codex install --dry-run
```

Remove selftune hooks:
```
selftune codex install --uninstall
```
