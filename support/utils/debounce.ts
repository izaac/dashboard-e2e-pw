import type { Locator, Page } from '@playwright/test';

/**
 * Standard Vue debounce window used across the dashboard form components
 * (KeyValue, RulePath, port input, …). Components debounce their
 * `update:value` emission for 500 ms; we add 100 ms slack to absorb
 * scheduling jitter on slower CI hosts.
 */
export const VUE_DEBOUNCE_MS = 600;

/**
 * Backoff between retried API calls (e.g. user-create POST that returned 4xx)
 * — gives the controller a tick to settle before the next attempt. Not a
 * documented debounce; just a small spacer so retries don't hammer the API.
 */
export const RETRY_BACKOFF_MS = 1500;

/**
 * Wait for a documented Vue component debounce to flush. Playwright cannot
 * observe the in-flight debounce timer, and blur/Tab/click do NOT flush it
 * — elapsed wall time is the only signal — so this is the agreed escape
 * hatch for Page Objects whose `update:value` emissions are debounced.
 *
 * Centralising the wait here means a single `eslint-disable` annotation
 * covers every PO debounce helper (otherwise each call site needs its own
 * disable comment).
 *
 * Usage:
 *   await waitForVueDebounce(page);  // standard 600 ms
 *   await waitForVueDebounce(page, 1100);  // override when component debounces 1 s
 *
 * Component-specific PO helpers (`waitForKeyValueDebounce`, `waitForRulePathDebounce`,
 * `waitForPortDebounce`, …) should delegate to this util rather than calling
 * `page.waitForTimeout(...)` directly.
 */
export async function waitForVueDebounce(page: Page, ms: number = VUE_DEBOUNCE_MS): Promise<void> {
  // eslint-disable-next-line playwright/no-wait-for-timeout -- documented Vue debounce window; no observable signal to wait on (blur/Tab/click do not flush)
  await page.waitForTimeout(ms);
}

/**
 * Sleep between retried API calls. Use only inside a retry loop where the
 * previous attempt failed and we want to give the server / controller a tick
 * before retrying. Not a substitute for `expect.poll` — only for cases where
 * the next call's success is the signal you'd be polling for anyway, so a
 * short fixed backoff is simpler than wiring poll predicates through
 * arbitrary helper code.
 *
 * Usage:
 *   if (resp.status() !== 201) {
 *     await retryBackoff(page);
 *     return retryFn();
 *   }
 */
export async function retryBackoff(page: Page, ms: number = RETRY_BACKOFF_MS): Promise<void> {
  // eslint-disable-next-line playwright/no-wait-for-timeout -- intentional spacer between API retries; the next retry's response is the actual signal
  await page.waitForTimeout(ms);
}

/**
 * Wait for any in-flight CSS animation/transition on `target` (and its
 * descendants) to finish, replacing fixed `waitForTimeout(N)` sleeps that
 * guess at slide-in / fade durations. Uses the Web Animations API's
 * `Animation.finished` promise so the wait is exactly as long as needed.
 *
 * - `Promise.allSettled` absorbs per-animation cancellations (Vue
 *   <transition> can swap nodes mid-animation, which rejects the promise);
 *   no inner catch needed.
 * - The outer `.catch` logs an `evaluate`-level failure (e.g. element
 *   detached before evaluate ran) so it surfaces in CI rather than being
 *   silently swallowed.
 *
 * Usage:
 *   await waitForAnimationSettle(this.panel());
 *   await waitForAnimationSettle(this.dropdown(), 'panel-toggle');
 */
export async function waitForAnimationSettle(target: Locator, label: string = 'animation'): Promise<void> {
  await target
    .evaluate((el) => Promise.allSettled(el.getAnimations({ subtree: true }).map((a) => a.finished)))
    .catch((err) => console.warn(`[${label} settle] skipped: ${(err as Error)?.message ?? err}`));
}
