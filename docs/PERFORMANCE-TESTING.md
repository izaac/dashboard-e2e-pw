# Performance Testing

The suite carries a small set of **performance probes**: specs that measure real
UI timing (load, filter, main-thread blocking) rather than assert pass/fail
behaviour. They live apart from the functional suite so they never run by
accident and never gate a normal test run.

- **Location:** `e2e/tests/performance/`
- **Tag:** `@performance`
- **Opt-in flag:** `TEST_PERF=1`
- **Output:** `perf-out/perf-<label>.json` (git-ignored)

---

## How isolation works

The `performance` folder is not part of the default `testDirs` in
`playwright.config.ts`, so a normal run never discovers it. Setting `TEST_PERF=1`
swaps the test match over to `e2e/tests/performance/**` only, mirroring the
`TEST_A11Y` accessibility opt-in. The `@performance` tag lets you narrow further
with `GREP_TAGS` and keeps these specs out of tag-filtered functional runs.

Because probes measure raw timing, they intentionally break two functional-suite
rules: raw CSS selectors (the settle observers run inside `page.evaluate`, where
a Playwright `Locator` cannot be used) and fixed `waitForTimeout` settle delays.
This is documented with a file-level `eslint-disable` in each probe.

---

## Running a probe

```bash
# Native (against an already-running Rancher)
TEST_PERF=1 GREP_TAGS=@performance TEST_SKIP=setup \
  npx playwright test --reporter=line

# Containerized muster runner
TEST_PERF=1 GREP_TAGS=@performance \
  bash scripts/local.sh test
```

Setup and auth projects still run first so the probe has an authenticated
session; add `TEST_SKIP=setup` when Rancher is already configured.

---

## Tuning knobs

All are environment variables read at probe start; defaults shown.

| Variable | Default | Purpose |
|---|---|---|
| `PERF_LABEL` | `unknown` | Names the output file (`perf-<label>.json`) |
| `PERF_REPEATS` | `3` | Iterations per metric; medians are reported |
| `PERF_QUIET_MS` | `750` | Main-thread quiet window that marks "settled" |
| `PERF_CAP_MS` | `120000` | Hard cap per measurement so a hang still records |
| `PERF_SERVER_VERSION` | — | Recorded in the report for cross-run comparison |
| `PERF_SSP_MODE` | — | Recorded: server-side pagination on/off |
| `PERF_CLUSTER_COUNT` | — | Recorded: dataset size the probe ran against |

The last three are metadata only; they label the run for later comparison and do
not change what the probe does.

---

## Output

Each run writes `perf-out/perf-<label>.json` with per-trial numbers plus a median
summary for the load and filter metrics, and is also attached to the Playwright
report. Probes report measurements; they do not fail on a threshold, so compare
`perf-out` files across versions or pagination modes to spot regressions.

---

## Adding a probe

1. Put the spec in `e2e/tests/performance/` and tag the `describe` with
   `@performance`.
2. Add a file-level comment and `eslint-disable` justifying any raw selectors or
   `waitForTimeout` the measurement needs.
3. Write results to `perf-out/` so they stay git-ignored.

See `e2e/tests/performance/cluster-list-filter.perf.spec.ts` (issue #11994,
cluster-list churn at scale) as the reference probe.
