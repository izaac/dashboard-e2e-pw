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
 * Click a side-nav link and assert it actually landed on a real, rendered page.
 *
 * `toHaveURL(href)` on its own is circular: href is read from the very link we
 * click, so matching the URL back to it only proves the router fired — not that
 * the destination rendered. So we keep the URL check (now meaningful, paired
 * with a real render) and add the non-circular signals: the destination's own
 * page `<h1>` renders with text, and the fail-whale error page is absent. A
 * per-hop crash gate flags any uncaught JS error as a supplement.
 *
 * The "rendered" signal is the role-based main heading rather than the
 * resource-masthead CSS class, because the class is not universal: the Apps
 * chart catalog (and extension-injected pages) render an `<h1>` outside
 * `.title` / `.primaryheader` / `.title-bar`. Every page renders one `<h1>`;
 * not every page uses the masthead component.
 */
export async function clickNavLinkAndAssertLanding(page: Page, link: Locator, errors: string[]): Promise<void> {
  const label = await labelOf(link);
  const href = await link.getAttribute('href');
  const errorsBefore = errors.length;

  // eslint-disable-next-line playwright/no-force-option -- nav links can be partially obscured by sticky headers/overlay during scroll; force-click is the only reliable way to walk the full list
  await link.click({ force: true });

  // A real page rendered (not just a URL change): the main content region shows
  // its page title heading, with text.
  const heading = page.getByRole('main').getByRole('heading', { level: 1 }).first();

  await expect(heading, `No page <h1> rendered after navigating to "${label}"`).toBeVisible();
  await expect(heading, `Empty page <h1> after navigating to "${label}"`).toHaveText(/\S/);

  // URL matches the link's declared destination — meaningful now we know a page rendered.
  if (href) {
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
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
