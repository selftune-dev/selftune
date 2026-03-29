<!-- Verified: 2026-03-29 -->

# Alpha Invite Script

Use this when inviting a tester to the first selftune alpha cohort.

## Short Version

```text
I’m inviting a small group to test selftune, a local-first skill improvement loop for coding agents.

What it does:
- watches real agent sessions locally
- detects where skills undertrigger or regress
- evolves low-risk skill descriptions automatically

What I need from you:
- install selftune
- tell your agent to set it up
- opt into the alpha when prompted
- use your agent normally for a few days
- flag any surprising triggers, regressions, or setup friction

Important:
- this alpha uploads consented telemetry to the selftune cloud for analysis
- enrollment is explicit and happens during `selftune init --alpha`
- the cloud step is just a short browser approval; normal use stays local

If you’re in, I’ll send a 5-minute checklist and stay available during setup.
```

## Slightly Longer Version

```text
I’m running a small alpha for selftune.

selftune is a local-first tool that helps coding-agent skills improve from real usage. It watches sessions, grades how skills are doing, and can evolve low-risk skill descriptions automatically.

This alpha is specifically about learning from real workflows:
- where skills miss obvious triggers
- where they overtrigger
- whether autonomous evolve/watch loops are trustworthy in practice

What participation looks like:
1. install selftune
2. tell your agent to set up selftune
3. opt into the alpha during setup
4. approve one short browser auth step
5. use your agent normally

What gets shared:
- consented telemetry needed to analyze skill behavior and evolution outcomes
- this alpha currently includes raw prompt/query text plus structured session/skill/evolution metadata

What I need back from you:
- setup friction
- anything confusing in the agent flow
- false positives, false negatives, or weird autonomous behavior

Ideal if you use Claude Code regularly and already rely on several local skills.
```

## DM / Email Follow-Up

Send this after the tester agrees:

```text
Thanks. Here’s the setup path:

1. Install selftune if it isn’t already installed.
2. In your agent, say: “set up selftune”.
3. When the agent offers alpha enrollment, say yes.
4. Approve the browser prompt.
5. After setup, ask the agent: “show me selftune status”.

I’ll use that status output to confirm:
- alpha enrolled
- cloud link ready
- pending uploads are draining

If anything looks off, send me the output of:
- `selftune status`
- `selftune doctor`
```

## Operator Notes

- Keep the first cohort hand-held. Do not send a self-serve blast yet.
- Prefer users who already work with Claude Code and a few active skills.
- Do not oversell autonomy. Frame it as “small trusted cohort, local-first,
  explicit enrollment, watching closely.”
