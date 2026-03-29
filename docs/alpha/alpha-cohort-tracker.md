<!-- Verified: 2026-03-29 -->

# Alpha Cohort Tracker

Use this as the lightweight internal tracker for the first 3-5 testers.

## Summary

| Tester | Onboarded | Cloud link | Uploads flowing | Last check | Notes |
| ------ | --------- | ---------- | --------------- | ---------- | ----- |
| _name_ | no        | not linked | no              | -          | -     |

## Detailed Tracker

| Tester | Contact | Onboarded date | Primary agent | Main skills | Init complete | Alpha enrolled | Cloud link ready | First upload verified | Uploads active this week | Last status check | Notable failures / wins | Follow-up owner |
| ------ | ------- | -------------- | ------------- | ----------- | ------------- | -------------- | ---------------- | --------------------- | ------------------------ | ----------------- | ---------------------- | --------------- |
| _name_ | _email_ | -              | Claude Code   | -           | no            | no             | no               | no                    | no                       | -                 | -                      | Daniel          |

## Suggested States

Use these exact values to keep the tracker readable:

- `Init complete`: `yes` / `no` / `blocked`
- `Alpha enrolled`: `yes` / `no` / `blocked`
- `Cloud link ready`: `yes` / `no` / `stale`
- `First upload verified`: `yes` / `no`
- `Uploads active this week`: `yes` / `no` / `unknown`

## What To Record

For each tester, keep track of:

- whether setup completed without operator intervention
- whether `selftune status` showed `Alpha Upload` as enrolled and ready
- whether `selftune doctor` surfaced queue or cloud-link warnings
- whether real usage data appears to be flowing
- any notable false positives, false negatives, regressions, or trust breaks

## Weekly Review Prompt

At least once per week, review the tracker and answer:

1. Which testers are fully live?
2. Which testers are enrolled but not actually generating useful data?
3. Which blockers repeat across testers?
4. Which failures are onboarding issues vs product issues?
5. Which wins justify expanding the cohort?
