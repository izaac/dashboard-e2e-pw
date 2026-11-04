import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import WorkloadSearchPo from '@/e2e/po/components/workload-search.po';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR ||
  '/home/izaac/Documents/ui-qa-plans/plans/qa-19634-workload-search-action-menu-focus-evidence';

const SEARCH_TERM = 'qa-search';
const DEPLOYMENTS = ['qa-search-alpha', 'qa-search-beta'];

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

test.describe('Workload Search Action Menu and Focus (#19634)', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace = '';

  test.beforeAll(async ({ rancherApi }) => {
    testNamespace = rancherApi.createE2EResourceName('qa-19634-ws');
    await rancherApi.createNamespace(testNamespace);

    for (const name of DEPLOYMENTS) {
      await rancherApi.createRancherResource('v1', 'apps.deployments', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name, namespace: testNamespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: name } },
          template: {
            metadata: { labels: { app: name } },
            spec: {
              containers: [{ name: 'pause', image: 'registry.k8s.io/pause:3.10' }],
              terminationGracePeriodSeconds: 0,
            },
          },
        },
      });
    }
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      // Deleting the namespace removes the seeded deployments with it
    } finally {
      if (testNamespace) {
        await rancherApi.deleteNamespace([testNamespace]);
      }
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  /**
   * Opens the workload dashboard and searches for the seeded deployments.
   * Returns the search PO once the dropdown is populated.
   */
  async function searchSeededWorkloads(page: Page): Promise<WorkloadSearchPo> {
    await page.goto('./c/local/explorer/workload-dashboard');
    await new WelcomeDialogPo(page).dismissIfVisible();

    const search = new WorkloadSearchPo(page);

    await expect(search.input()).toBeVisible();
    await search.search(SEARCH_TERM);

    await expect(search.dropdown()).toBeVisible();
    // Results are grouped (Deployments, ReplicaSets, Pods); the first two rows are the seeded Deployments
    await expect(search.options().nth(0)).toContainText(DEPLOYMENTS[0]);
    await expect(search.options().nth(1)).toContainText(DEPLOYMENTS[1]);

    return search;
  }

  test('only one action menu is open at a time and re-clicking the kebab closes it', async ({ page }) => {
    const search = await searchSeededWorkloads(page);
    const menus = search.actionMenus();

    // Open the menu on result 1 (beta)
    await search.kebab(1).click();
    await expect(menus.first()).toBeVisible();

    // Open the menu on result 0 (alpha): the previous menu must not stack
    await search.kebab(0).click();
    await expect(menus.first()).toBeVisible();
    await expect(menus).toHaveCount(1);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-single-active-action-menu.png') });

    // Re-click the same kebab: menu closes
    await search.kebab(0).click();
    await expect(menus).toHaveCount(0);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-reclick-kebab-closes-menu.png') });
  });

  test('kebab button does not keep a focus ring after the menu is closed with the mouse', async ({ page }) => {
    const search = await searchSeededWorkloads(page);
    const menus = search.actionMenus();
    const kebab = search.kebab(0);

    await kebab.click();
    await expect(menus.first()).toBeVisible();

    await kebab.click();
    await expect(menus).toHaveCount(0);

    // A mouse interaction must not leave a keyboard-style (focus-visible) ring on the kebab
    await expect.poll(() => kebab.evaluate((el) => el.matches(':focus-visible'))).toBe(false);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-04-no-focus-ring-on-close.png') });
  });

  test('typing while a result is focused goes to the search input and does not trigger page shortcuts', async ({
    page,
  }) => {
    const search = await searchSeededWorkloads(page);
    const input = search.input();
    const options = search.options();

    // Move focus onto a result element (not the search input)
    await options.nth(0).focus();

    await page.keyboard.press('n');

    // The character lands in the search input and the namespace filter is not opened by a shortcut
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(`${SEARCH_TERM}n`);
    await expect(new NamespaceFilterPo(page).getOptions()).toHaveCount(0);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-05-typing-in-result-focuses-search.png') });
  });
});
