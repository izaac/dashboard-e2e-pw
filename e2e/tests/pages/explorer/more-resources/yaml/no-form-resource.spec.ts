import { test, expect } from '@/support/fixtures';
import { LeasesPagePo } from '@/e2e/po/pages/explorer/leases.po';

test.describe('No Custom Form Resource', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@adminUser'] }, () => {
    test('can create a resource using the Create from YAML button', async ({ page, login, rancherApi }) => {
      await login();
      const leasesPage = new LeasesPagePo(page, 'local');

      await leasesPage.goTo();
      await leasesPage.waitForPage();

      await leasesPage.clickCreateYaml();

      const createResp = page.waitForResponse(
        (r) => r.url().includes('coordination.k8s.io.lease') && r.request().method() === 'POST',
      );

      await leasesPage.saveYamlButton().click();
      const resp = await createResp;

      expect(resp.status()).toBe(201);

      const body = await resp.json();
      const leaseId = `${body.metadata.namespace}/${body.metadata.name}`;

      try {
        await leasesPage.waitForPage();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'coordination.k8s.io.leases', leaseId, false);
      }
    });
  });
});
