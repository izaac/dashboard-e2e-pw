import { test, expect } from '@/support/fixtures';
import { LeasesPagePo } from '@/e2e/po/pages/explorer/leases.po';
import ResourceYamlPo from '@/e2e/po/components/resource-yaml.po';

test.describe('No Custom Form Resource', { tag: ['@explorer', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@adminUser'] }, () => {
    test('can create a resource using the Create from YAML button', async ({ page, login, rancherApi }) => {
      await login();
      const leasesPage = new LeasesPagePo(page, 'local');

      await leasesPage.goTo();
      await leasesPage.waitForPage();

      await leasesPage.clickCreateYaml();

      // Make the lease name unique for idempotency
      const resourceYaml = new ResourceYamlPo(page);
      const yaml = await resourceYaml.codeMirror().value();
      const uniqueName = `e2e-lease-${Date.now()}`;
      const updatedYaml = yaml.replace(/name:\s*\S+/, `name: ${uniqueName}`);

      await resourceYaml.codeMirror().set(updatedYaml);

      const createResp = page.waitForResponse(
        (r) => r.url().includes('coordination.k8s.io.lease') && r.request().method() === 'POST',
      );

      await leasesPage.saveYamlButton().click();
      const resp = await createResp;
      const body = await resp.json();
      const leaseId = body.metadata?.namespace
        ? `${body.metadata.namespace}/${body.metadata.name}`
        : body.metadata?.name;

      try {
        expect(resp.status()).toBe(201);
        await leasesPage.waitForPage();
      } finally {
        if (leaseId) {
          await rancherApi.deleteRancherResource('v1', 'coordination.k8s.io.leases', leaseId, false);
        }
      }
    });
  });
});
