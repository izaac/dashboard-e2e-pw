/**
 * Timeout constants matching upstream Cypress convention.
 * Import these instead of scattering raw numbers in specs.
 *
 * Playwright's default expect/action timeout is 10s (set in playwright.config.ts).
 * Only use these when a specific operation genuinely needs longer.
 */

/** 15s — API responses and navigation that may take slightly longer than default */
export const SHORT_TIMEOUT_OPT = { timeout: 15_000 };

/** 30s — UI transitions, chart installs, resource list loading */
export const MEDIUM_TIMEOUT_OPT = { timeout: 30_000 };

/** 60s — Extension installs, helm operations, long-running API calls */
export const LONG_TIMEOUT_OPT = { timeout: 60_000 };

/** 90s — Controller churn, feature flag resets */
export const EXTRA_LONG_TIMEOUT_OPT = { timeout: 90_000 };

/** 120s — Rancher restarts, bootstrap, major state transitions */
export const RESTART_TIMEOUT_OPT = { timeout: 120_000 };

/** 2s — Per-iteration ceiling for polling loops (e.g. virtual-scroll render) */
export const POLL_ITERATION_TIMEOUT = { timeout: 2_000 };
