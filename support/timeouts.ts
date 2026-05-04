/**
 * Named timeout constants — use these instead of magic numbers.
 *
 * Playwright defaults (from playwright.config.ts):
 *   action timeout: 60_000
 *   expect timeout: 10_000
 *
 * Only override when the default is too short or too long for a known reason.
 */

/** Short wait — UI debounce, minor animation (3s) */
export const DEBOUNCE = 3_000;

/** Brief wait — quick spinners, consent banner checks (5s) */
export const BRIEF = 5_000;

/** Standard wait — most page interactions (10s, matches Playwright expect default) */
export const STANDARD = 10_000;

/** Extended wait — slow pages, API reconciliation (15s) */
export const EXTENDED = 15_000;

/** Long wait — cluster operations, large list loads (30s) */
export const LONG = 30_000;

/** Very long wait — provisioning, extension installs (60s, matches Playwright action default) */
export const VERY_LONG = 60_000;

/** Controller churn — feature flag resets, reconciliation (90s) */
export const CONTROLLER_SETTLE = 90_000;

/** Extra long wait — slow provisioning, chart installs (2 min) */
export const EXTRA_LONG = 120_000;

/** Extension operations — install, upgrade, uninstall full cycles (3 min) */
export const EXTENSION_OPS = 180_000;

/** Provisioning wait — cluster create, cloud provisioning (5 min) */
export const PROVISIONING = 300_000;

/** Cluster settle — state transitions after scale/upgrade operations (6 min) */
export const CLUSTER_SETTLE = 360_000;

/** Full provisioning — end-to-end cluster lifecycle including Active wait (15 min) */
export const FULL_PROVISIONING = 900_000;

/** Wrap a millisecond value as `{ timeout: ms }` for Playwright assertions/actions */
export const timeoutOpt = (ms: number) => ({ timeout: ms });

/** 15s — API responses and navigation that may take slightly longer than default */
export const SHORT_TIMEOUT_OPT = { timeout: EXTENDED };
