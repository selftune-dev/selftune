# Interactive Configuration

Before running mutating workflows (evolve, evolve-body, eval generate, baseline), present
a pre-flight configuration prompt to the user. This gives them control over
execution mode, model selection, and key parameters.

## Pre-Flight Pattern

Each mutating workflow has a **Pre-Flight Configuration** step. Follow this pattern:

1. Present a brief summary of what the command will do
2. Use the `AskUserQuestion` tool to present structured options (max 4 questions per call — split into multiple calls if needed). Mark recommended defaults in option text with `(recommended)`.
3. Parse the user's selections from the tool response
4. Show a confirmation summary of selected options before executing

**IMPORTANT:** Always use `AskUserQuestion` for pre-flight — never present options as inline numbered text. The tool provides a structured UI that is easier for users to interact with. If `AskUserQuestion` is not available, fall back to inline numbered options.

## Model Tier Reference

When presenting model choices, use this table:

| Tier | Model | Speed | Cost | Quality | Best for |
|------|-------|-------|------|---------|----------|
| Fast | `haiku` | ~2s/call | $ | Good | Iteration loops, bulk validation |
| Balanced | `sonnet` | ~5s/call | $$ | Great | Single-pass proposals, gate checks |
| Best | `opus` | ~10s/call | $$$ | Excellent | High-stakes final validation |

## Quick Path

If the user says "use defaults", "just do it", or similar — skip the pre-flight
and run with recommended defaults. The pre-flight is for users who want control,
not a mandatory gate.

## Workflows That Skip Pre-Flight

These read-only or simple workflows run immediately without prompting:
`status`, `last`, `doctor`, `dashboard`, `watch`, `evolve rollback`,
`grade auto`, `ingest *`, `contribute`, `cron`, `eval composability`,
`eval unit-test`, `eval import`.
