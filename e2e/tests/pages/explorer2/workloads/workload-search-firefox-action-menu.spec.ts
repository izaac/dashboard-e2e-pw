import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import WorkloadSearchPo from '@/e2e/po/components/workload-search.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR ||
  '/home/izaac/Documents/ui-qa-plans/plans/qa-19631-workload-search-firefox-action-menu-evidence';

const SEARCH_TERM = 'qa-ff';
const DEPLOYMENTS = ['qa-ff-alpha', 'qa-ff-beta'];
const WIDTH_TOLERANCE = 5;

test.describe('Workload Search Firefox Action Menu & Width (#19631)', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace = '';

  test.beforeAll(async ({ rancherApi }) => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    testNamespace = rancherApi.createE2EResourceName('qa-19631-ff');
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
    // Deleting the namespace removes the seeded deployments with it
    if (testNamespace) {
      await rancherApi.deleteNamespace([testNamespace]);
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  /**
   * Opens the workload dashboard, searches for the seeded deployments and waits for the dropdown options.
   */
  async function searchWorkloads(page: Page): Promise<WorkloadSearchPo> {
    await page.goto('./c/local/explorer/workload-dashboard');
    await new WelcomeDialogPo(page).dismissIfVisible();

    const search = new WorkloadSearchPo(page);

    await expect(search.input()).toBeVisible();
    await search.search(SEARCH_TERM);

    await expect(search.dropdown()).toBeVisible();
    await expect(search.options().first()).toBeVisible();

    return search;
  }

  async function expectFullWidth(search: WorkloadSearchPo): Promise<void> {
    const inputWidth = (await search.self().boundingBox())?.width;
    const menuWidth = (await search.dropdown().boundingBox())?.width;

    expect(inputWidth).toBeDefined();
    expect(menuWidth).toBeGreaterThan(200);
    expect(menuWidth).toBeGreaterThanOrEqual(inputWidth! - WIDTH_TOLERANCE);
  }

  test('search results dropdown matches full input width', async ({ page }) => {
    const search = await searchWorkloads(page);

    const display = await page.evaluate(() => {
      const el = document.querySelector('.v-select.inline:has(> .vs__dropdown-menu)');

      return el ? window.getComputedStyle(el).display : null;
    });

    expect(display).toBe('block');

    const inputWidth = (await search.self().boundingBox())?.width;
    const menuWidth = (await search.dropdown().boundingBox())?.width;

    expect(menuWidth).toBeGreaterThanOrEqual(inputWidth! - WIDTH_TOLERANCE);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-firefox-search-results-full-width.png') });
  });

  test('search results dropdown remains open and fully sized when opening a result action menu', async ({ page }) => {
    const search = await searchWorkloads(page);

    await search.kebab(0).click();
    await expect(search.actionMenus().first()).toBeVisible();

    await expect(search.dropdown()).toBeVisible();
    await expectFullWidth(search);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-firefox-search-results-action-menu-open.png') });
  });

  test('pressing Escape closes the action menu while search results remain visible and sized', async ({ page }) => {
    const search = await searchWorkloads(page);

    await search.kebab(0).click();
    await expect(search.actionMenus().first()).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(search.actionMenus().first()).toBeHidden();
    await expect(search.dropdown()).toBeVisible();
    await expectFullWidth(search);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-03-firefox-search-results-after-escape.png') });
  });

  test('clicking the three dots button a second time closes the action menu without collapsing results', async ({
    page,
  }) => {
    const search = await searchWorkloads(page);

    await search.kebab(0).click();
    await expect(search.actionMenus().first()).toBeVisible();

    await search.kebab(0).click();

    await expect(search.actionMenus().first()).toBeHidden();
    await expect(search.dropdown()).toBeVisible();
    await expectFullWidth(search);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-04-firefox-action-menu-toggle-closed.png') });
  });
});
