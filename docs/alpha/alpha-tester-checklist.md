<!-- Verified: 2026-03-29 -->

# Alpha Tester Checklist

Use this during live onboarding. Stop at the first blocker and resolve it
before moving on.

## 0. Pre-check

- Confirm the tester is in the intended cohort: active coding-agent user,
  comfortable with local tools, willing to share alpha telemetry.
- Confirm you have a way to receive the outputs of `selftune status` and
  `selftune doctor` if setup needs debugging.

## 1. Install

- Verify `selftune` is available:

  ```bash
  selftune --help
  ```

- If missing, install it using the current release path.

Success criteria:

- `selftune --help` runs successfully.

## 2. Agent-First Setup

- Ask the tester to tell their agent:

  ```text
  set up selftune
  ```

- Confirm the agent routes to the initialize workflow instead of asking the
  tester to manipulate config files manually.

Success criteria:

- `selftune init` runs through the agent flow.

## 3. Alpha Consent and Enrollment

- During setup, the tester opts into the alpha.
- The agent collects the tester’s email and optional display name.
- The agent runs:

  ```bash
  selftune init --alpha --alpha-email <email> --force
  ```

- The browser opens automatically for device-code approval.

Success criteria:

- enrollment completes without manual config editing
- the tester returns to the local agent flow after browser approval

## 4. Readiness Verification

- Ask the tester to run:

  ```bash
  selftune status
  selftune doctor
  ```

- Confirm all of the following:
  - `Alpha Upload` section is present in status
  - status shows `Status: enrolled`
  - status shows `Cloud link: ready`
  - doctor does not report blocking cloud-link or upload-queue issues

Success criteria:

- machine is upload-ready
- there is a concrete remediation path if it is not

## 5. Initial Upload

- Confirm init triggered an initial upload cycle.
- If needed, ask the tester to run:

  ```bash
  selftune alpha upload
  ```

- Re-check status.

Success criteria:

- `Pending` is zero or actively draining
- `Failed` is zero, or there is a clear non-blocking explanation
- if available, cloud verification shows at least one push

## 6. Local Runtime Sanity

- Ask the tester to use their agent normally for one short task that should
  exercise at least one installed skill.
- Then ask them to run:

  ```bash
  selftune status
  ```

Optional deeper check:

```bash
selftune orchestrate --dry-run
```

Success criteria:

- local sessions are being captured
- at least one skill appears in status
- orchestrate dry-run does not look obviously broken

## 7. First-Day Follow-Up

- Within 24 hours, check whether uploads are still flowing.
- Ask for:
  - one thing that felt smooth
  - one point of confusion
  - any false positives / false negatives / surprising autonomy

## Blocker Playbook

### Browser handoff fails

- Re-run:

  ```bash
  selftune init --alpha --alpha-email <email> --force
  ```

- If it still fails, collect `selftune doctor`.

### Cloud link not ready

- Check status and doctor output.
- Most likely remediation:

  ```bash
  selftune init --alpha --alpha-email <email> --force
  ```

### Upload queue stuck

- Run:

  ```bash
  selftune alpha upload
  selftune doctor
  ```

### Local install is healthy but no sessions show up

- Confirm hooks are installed.
- Confirm the tester actually used the agent after setup.
- Run:

  ```bash
  selftune doctor
  selftune sync
  ```

## Exit Criteria

Mark the tester as onboarded only when all of the following are true:

- installed successfully
- alpha enrolled
- cloud link ready
- first upload succeeded or is clearly draining
- at least one real session is visible locally
