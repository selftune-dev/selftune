<!-- Reviewed against transcript: 2026-04-09 -->

# State Change Skills Call: SelfTune Insights

**Status:** Reference  
**Source:** External transcript at `/Users/danielpetro/Documents/Projects/FOSS/selftune/transcripts/state-change-skills-call-selftune-04-09-2026.md`  
**Goal:** Capture the transcript-grounded product and workflow insights from the 2026-04-09 State Change skills call, and separate them from maintainer synthesis, so they become versioned repo knowledge instead of call-only lore.

## Reading Guide

- "Transcript-grounded" means the point was discussed directly in the call.
- "Maintainer synthesis" means the point is an interpretation or follow-on
  recommendation, not a direct claim from the transcript.

## Executive Summary

The transcript supports four clear takeaways:

- routing and skill-level observability, not generic LLM tracing
- a router plus workflows plus deterministic tooling, not one giant prompt blob
- a system that helps creators iterate on real user language, not imagined trigger phrases
- a creator workflow that separates judgment from deterministic code and tools

The strongest friction points in the call were:

- make creator best practices easier to learn from repo artifacts
- make skill evaluation and runtime trust easier to reason about
- clarify what belongs in the skill versus workflows, references, scripts, and tools
- fix the basic install/discovery path so people can actually try selftune

Maintainer synthesis from those points:

1. finish stabilization and convergence already in flight
2. package the creator playbook and examples
3. produce a routing-first proof slice
4. do a smaller packaging/discoverability cleanup
5. keep any broader authoring-model design narrow and grounded in shipped behavior

## What Landed Well In The Call

### 1. Router-first skill structure

The clearest moment of comprehension came when selftune was shown as a small
top-level skill that routes into workflow files rather than trying to keep the
entire operating manual in one prompt surface.

Implication:

- selftune should keep reinforcing the "skill is a folder" model
- router plus workflows should remain a first-class teaching pattern

### 2. Deterministic scaffolding around AI judgment

The call landed well when selftune was described as putting "if-then",
classification, checks, and command steering into deterministic surfaces while
keeping judgment with the model.

Implication:

- deterministic, repeated execution belongs in CLI/scripts/tools
- judgment, interpretation, and proposal generation stay with the model
- this matches `docs/golden-principles.md` and should be made more explicit for creators

### 3. Skill-specific observability is still a real gap

The conversation repeatedly circled back to the same pain: people can build
skills, but they do not know whether those skills actually triggered, helped,
or degraded in real usage.

Implication:

- selftune's positioning around skill observability remains strong
- the product should continue to distinguish itself from generic trace tools
- evaluation and watch correctness are not infrastructure polish; they are the product

### 4. Routing-first thinking creates momentum

The practical "aha" from the call was that creators should solve selection
before deep body logic. In the financial-model example, the useful first step
was deciding which model to build, not immediately optimizing the cell-level
mechanics.

Implication:

- selftune should package a routing-first benchmark/demo
- body/routing evolution should be taught as separate layers of maturity

## Problems And Friction Surfaced By The Call

### 1. Creator guidance is still too implicit

People asked directly about:

- when to split into new files
- whether to build skills within skills
- whether logic belongs in markdown, references, scripts, or tools
- how much context should live in the skill versus be loaded on demand

The repo contains many of the answers, but they are still too distributed
across implementation artifacts and lived practice.

### 2. Evaluation and runtime trust are still underspecified

The call spent more time on "how do I know this skill is actually working?" than
on any one missing feature. The recurring issues were:

- skills are hard to test against real user phrasing
- current eval tools still feel like black boxes
- creators need clearer evidence about whether they are improving or guessing

### 3. Discoverability and install need a basic fix

One participant explicitly said they searched for selftune and could not find
it. That is real signal, but it is a narrower point than the routing/trust
discussion above.

### 4. The "what belongs where?" boundary is still a product question

The call surfaced a recurring creator question:

- what lives in the skill
- what lives in a workflow or reference file
- what should become deterministic code or a CLI tool

This boundary should eventually become a first-class authoring model, not just
oral tradition.

## Maintainer Synthesis

### 1. Keep selftune centered on the runtime loop

selftune resonated most when described as:

- observe
- detect
- evaluate
- evolve
- watch

It was less compelling when it was inferred to be "mostly discoverability." The
runtime loop should remain the center of the story.

### 2. Treat creator education as product work

For selftune, examples, workflow docs, and authoring patterns are not secondary
docs. They are part of the product surface because the product is agent-first
and creator-facing.

### 3. Teach routing-first before generalized skill-body evolution

Routing is the lowest-friction proof of value and the easiest concept for skill
creators to understand quickly. The product should exploit that.

### 4. Keep future authoring-model work narrow until the current system is easier to teach and trust

The call supports a sharper explanation of skill/workflow/reference/tool
boundaries. It does not by itself justify a broad creator-platform rewrite.

## What Is Already In Flight

The following active work already addresses the most urgent runtime issues and
should not be duplicated by a new effort:

- `docs/exec-plans/active/eval-system-gap-closure.md`
- `docs/exec-plans/active/repo-convergence-refactor-program.md`

The following deferred work already covers part of the creator-guidance side
and should be treated as an input, not ignored:

- `docs/exec-plans/deferred/advanced-skill-patterns-adoption.md`

## Recommended Follow-On

Maintainer recommendation after the current stabilization wave:

1. creator playbook and examples
2. routing-first benchmark/demo
3. basic packaging/discoverability repair
4. a smaller authoring-boundary note if it is still needed after the first three

That follow-on is captured in:

- `docs/exec-plans/deferred/post-stabilization-creator-adoption-plan.md`
