import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Uncaught JS errors that are framework noise rather than navigation
 * regressions. The ResizeObserver loop warning fires on benign layout thrash
 * and shows up across unrelated pages, so it would make the crash gate flaky.
 */
const IGNORED_PAGE_ERRORS = [/ResizeObserver loop/i];

/**
 * Attach a `pageerror` listener and return a live buffer of uncaught JS errors
 * (framework noise filtered out). Call once per test, then hand the buffer to
 * `clickNavLinkAndAssertLanding` so each hop can flag errors raised while
 * navigating. This is a *supplement* to the URL/heading assertions, not a
 * substitute: a hop can land on the right page yet still throw.
 */
export function captureNavErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('pageerror', (err) => {
    if (!IGNORED_PAGE_ERRORS.some((re) => re.test(err.message))) {
      errors.push(err.message);
    }
  });

  return errors;
}

/**
 * Side-nav labels carry a trailing count badge ("Nodes 1", "Events 0"); strip
 * it so the label reads cleanly in failure messages.
 */
const labelOf = async (link: Locator): Promise<string> => (await link.innerText()).trim().replace(/\s+\d+$/, '');

/**
 * Options for {@link clickNavLinkAndAssertLanding}.
 */
export interface AssertLandingOptions {
  /**
   * Require a visible, non-empty page `<h1>` as proof that real content (not
   * just chrome) rendered. True (default) for resource pages — the product-nav
   * walk, where every page renders an `<h1>` masthead inside `main`.
   *
   * Set false for product *landing* pages whose title heading is not reliably
   * exposed in the accessibility tree: the Fleet "Continuous Delivery" dashboard
   * renders its `<h1>` outside the `main` landmark and absent from the a11y tree,
   * and the global sections are heterogeneous (resource lists, dashboards,
   * tabbed pages). For those, correct routing + no error page + no uncaught
   * crash is the meaningful "this section loaded" signal.
   */
  requireHeading?: boolean;
}

/**
 * Click a side-nav link and assert it actually landed on a real page — not just
 * that the router fired.
 *
 * `toHaveURL(href)` on its own is circular: href is read from the very link we
 * click, so matching the URL back to it only proves the router fired. We pair it
 * with non-circular health signals: the fail-whale error page is absent, and no
 * uncaught JS error was raised during the hop. When `requireHeading` is set
 * (default), we also assert the destination's own page `<h1>` rendered with text
 * — positive proof that content mounted.
 *
 * That heading check is scoped to the `main` landmark and asserted by count (≥1
 * visible, non-empty), not via `.first()`: a count can't latch onto a single
 * stale heading during the route transition, and it won't trip strict-mode when
 * the outgoing and incoming pages briefly both render an `<h1>`. We settle on
 * the destination URL first, so the check only runs once we are on the new
 * route.
 */
export async function clickNavLinkAndAssertLanding(
  page: Page,
  link: Locator,
  errors: string[],
  { requireHeading = true }: AssertLandingOptions = {},
): Promise<void> {
  const label = await labelOf(link);
  const href = await link.getAttribute('href');
  const errorsBefore = errors.length;

  // eslint-disable-next-line playwright/no-force-option -- nav links can be partially obscured by sticky headers/overlay during scroll; force-click is the only reliable way to walk the full list
  await link.click({ force: true });

  // Settle on the declared destination first, so the render check below cannot
  // latch onto the outgoing page's heading mid-transition.
  if (href) {
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  // A real page rendered (not just a URL change): at least one visible,
  // non-empty `<h1>` is present in the main content region.
  if (requireHeading) {
    const headings = page.getByRole('main').getByRole('heading', { level: 1 }).filter({ hasText: /\S/ });

    await expect(headings, `No non-empty page <h1> rendered after navigating to "${label}"`).not.toHaveCount(0);
  }

  // Not the error page (toBeHidden passes when absent or hidden).
  await expect(
    page.locator('.fail-whale, .main-layout.error'),
    `Landed on the fail-whale error page after navigating to "${label}"`,
  ).toBeHidden();

  // SUPPLEMENT: no uncaught JS error raised during this hop.
  const newErrors = errors.slice(errorsBefore);

  expect(newErrors, `Uncaught JS error navigating to "${label}":\n${newErrors.join('\n')}`).toHaveLength(0);
}
