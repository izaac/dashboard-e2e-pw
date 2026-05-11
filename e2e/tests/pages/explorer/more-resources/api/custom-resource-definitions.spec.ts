import { test, expect } from '@/support/fixtures';
import { CustomResourceDefinitionsPagePo } from '@/e2e/po/pages/explorer/custom-resource-definitions.po';
import { crdsGetResponseSmallSet } from '@/e2e/blueprints/explorer/more-resources/api/custom-resource-definition-get';
import * as fs from 'fs';
import * as path from 'path';
import * as jsyaml from 'js-yaml';
import { LONG } from '@/support/timeouts';

const cluster = 'local';

test.describe('CustomResourceDefinitions', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    // Serial — every test reads the same /v1/apiextensions list endpoint
    // (some hundreds of rows on a fresh rancher); running them in parallel
    // multiplies the load and surfaces transient API timeouts. The create
    // case must run last in any case.
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ login }) => {
      await login();
    });

    test.afterEach(async ({ rancherApi }) => {
      // Reset per-page user pref in case a test bumped it down (default 100).
      await rancherApi.setUserPreference({ 'per-page': 100 });
    });

    test('pagination is visible and user can navigate through crd data', async ({ page, rancherApi }) => {
      const crdsPage = new CustomResourceDefinitionsPagePo(page, cluster);

      const resp = await rancherApi.getRancherResource('v1', 'apiextensions.k8s.io.customresourcedefinitions');
      const count = resp.body.count;

      test.skip(count < 11, `Need at least 11 CRDs for pagination, have ${count}`);

      // Force small page size so pagination renders even when CRD count is
      // below the dashboard's default per-page (100). afterEach restores it.
      await rancherApi.setUserPreference({ 'per-page': 10 });

      await crdsPage.goTo();
      await crdsPage.waitForPage();
      await crdsPage.sortableTable().checkLoadingIndicatorNotVisible();

      const pagination = crdsPage.sortableTable().pagination();

      await expect(pagination).toBeVisible();

      const beginBtn = crdsPage.sortableTable().paginationBeginButton();
      const leftBtn = crdsPage.sortableTable().paginationPrevButton();
      const rightBtn = crdsPage.sortableTable().paginationNextButton();
      const endBtn = crdsPage.sortableTable().paginationEndButton();

      await expect(beginBtn).toBeDisabled();
      await expect(leftBtn).toBeDisabled();
      await expect(rightBtn).toBeEnabled();
      await expect(endBtn).toBeEnabled();

      await rightBtn.click();
      await expect(beginBtn).toBeEnabled();
      await expect(leftBtn).toBeEnabled();

      await leftBtn.click();
      await expect(beginBtn).toBeDisabled();
      await expect(leftBtn).toBeDisabled();

      await endBtn.scrollIntoViewIfNeeded();
      await endBtn.click();
      await beginBtn.click();
      await expect(beginBtn).toBeDisabled();
      await expect(leftBtn).toBeDisabled();
    });

    test('filter CRDs', async ({ page }) => {
      const crdsPage = new CustomResourceDefinitionsPagePo(page, cluster);

      await crdsPage.goTo();
      await crdsPage.waitForPage();

      await crdsPage.sortableTable().checkVisible();
      await crdsPage.sortableTable().checkLoadingIndicatorNotVisible();

      const filterTerm = 'catalog.cattle.io';

      await crdsPage.sortableTable().filter(filterTerm);

      const rows = crdsPage.sortableTable().rowElementWithPartialName(filterTerm);

      await expect(rows.first()).toBeVisible();
      await expect(rows).not.toHaveCount(0);
    });

    test('sorting changes the order of CRDs data', async ({ page }) => {
      const crdsPage = new CustomResourceDefinitionsPagePo(page, cluster);

      await crdsPage.goTo();
      await crdsPage.waitForPage();

      await crdsPage.sortableTable().checkVisible();
      await crdsPage.sortableTable().checkLoadingIndicatorNotVisible();

      const filter = 'catalog.cattle.io';

      await crdsPage.sortableTable().filter(filter);
      await crdsPage.sortableTable().checkNoRowsNotVisible();

      const firstCell = crdsPage.sortableTable().rowCell(crdsPage.sortableTable().rowElements().first(), 2);

      await expect(firstCell).toBeVisible();
      const firstRowBefore = await firstCell.innerText();

      expect(firstRowBefore.length).toBeGreaterThan(0);

      await crdsPage.sortableTable().sort(2).click();

      // LONG (not STANDARD) — sort re-fetches a large list under serial-API
      // pressure, can take longer than STANDARD allows.
      await expect(crdsPage.sortableTable().rowCell(crdsPage.sortableTable().rowElements().first(), 2)).not.toHaveText(
        firstRowBefore,
        { timeout: LONG },
      );
    });

    test('pagination is hidden with small dataset', async ({ page }) => {
      await page.route(/\/v1\/apiextensions\.k8s\.io\.customresourcedefinitions\?/, async (route) => {
        await route.fulfill({ json: crdsGetResponseSmallSet });
      });

      const crdsPage = new CustomResourceDefinitionsPagePo(page, cluster);

      await crdsPage.goTo();
      await crdsPage.waitForPage();

      await crdsPage.sortableTable().checkVisible();
      await crdsPage.sortableTable().checkLoadingIndicatorNotVisible();
      await crdsPage.sortableTable().checkRowCount(false, 2);
      await expect(crdsPage.sortableTable().pagination()).not.toBeAttached();
    });

    // Last: CRD create/delete taxes the API server — run after read-only tests.
    test('can create a crd and see it in list view', async ({ page, rancherApi }) => {
      const crdName = `e2etests.${Date.now()}.example.com`;
      const crdGroup = `${Date.now()}.example.com`;
      const crdsPage = new CustomResourceDefinitionsPagePo(page, cluster);

      try {
        await crdsPage.goTo();
        await crdsPage.waitForPage();
        await crdsPage.create();

        const crdYamlPath = path.resolve('e2e/blueprints/explorer/more-resources/api/custom-resource-definition.yml');
        const crdYaml = fs.readFileSync(crdYamlPath, 'utf-8');
        const json: any = jsyaml.load(crdYaml);

        json.metadata.name = crdName;
        json.spec.group = crdGroup;

        await crdsPage.yamlEditor().set(jsyaml.dump(json));

        const createResp = page.waitForResponse(
          (r) => r.url().includes('apiextensions.k8s.io.customresourcedefinitions') && r.request().method() === 'POST',
        );

        await crdsPage.saveYamlButton().click();
        const resp = await createResp;

        expect(resp.status()).toBe(201);

        await crdsPage.waitForPage();
        await crdsPage.sortableTable().filter(crdName);
        await expect(crdsPage.sortableTable().rowElementWithName(crdName)).toBeVisible();

        const headers = await crdsPage.sortableTable().headerNames();

        expect(headers).toContain('State');
        expect(headers).toContain('Name');
        expect(headers).toContain('Created At');
      } finally {
        await rancherApi.deleteRancherResource('v1', 'apiextensions.k8s.io.customresourcedefinitions', crdName, false);
        // CRD deletion is async (finalizers run). Wait for the API to return
        // 404 so the next spec doesn't see leftover state.
        const gone = await rancherApi.waitForRancherResource(
          'v1',
          'apiextensions.k8s.io.customresourcedefinitions',
          crdName,
          (resp) => resp.status === 404,
          20,
          1500,
        );

        if (!gone) {
          console.warn(`[crd afterEach] ${crdName} did not finalize within 30s`);
        }
      }
    });
  });
});
