import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import ClusterResourceDetailPagePo from '@/e2e/po/pages/cluster-manager/cluster-resource-detail.po';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-17827-cluster-config-form-padding-evidence';

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

async function waitForContentSettled(page: Page) {
  await expect(page.locator('.loading, .data-loading, div:text-is("Loading...")')).toHaveCount(0, { timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('Cluster Configuration Form Padding (#17827)', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('cluster configuration view mode (as=config) renders inside .outlet with 24px padding', async ({ page }) => {
    const clusterPage = new ClusterResourceDetailPagePo(page);

    await clusterPage.goTo('mode=view&as=config');
    await clusterPage.waitForPage('mode=view&as=config');

    const outlet = clusterPage.outlet();

    await expect(outlet).toBeVisible();
    await expect(clusterPage.mastheadTitle()).toBeVisible();
    await expect(outlet).toHaveCSS('padding-left', '24px');
    await expect(outlet).toHaveCSS('padding-top', '24px');

    await waitForContentSettled(page);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-01-standard-user-cluster-config-padding.png') });
  });

  test('cluster configuration edit mode (mode=edit) retains 24px padding', async ({ page }) => {
    const clusterPage = new ClusterResourceDetailPagePo(page);

    await clusterPage.goTo('mode=edit');
    await clusterPage.waitForPage('mode=edit');

    const outlet = clusterPage.outlet();

    await expect(outlet).toBeVisible();
    await expect(clusterPage.mastheadTitle()).toBeVisible();
    await expect(outlet).toHaveCSS('padding-left', '24px');
    await expect(outlet).toHaveCSS('padding-top', '24px');

    await waitForContentSettled(page);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-02-admin-cluster-edit-padding.png') });
  });

  test('cluster detail dashboard (as=detail) full page override renders properly', async ({ page }) => {
    const clusterPage = new ClusterResourceDetailPagePo(page);

    await clusterPage.goTo('as=detail');
    await clusterPage.waitForPage('as=detail');

    await expect(clusterPage.mainLayout()).toBeVisible();
    await expect(clusterPage.outlet()).toBeVisible();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'scenario-03-cluster-detail-dashboard-override.png') });
  });
});
