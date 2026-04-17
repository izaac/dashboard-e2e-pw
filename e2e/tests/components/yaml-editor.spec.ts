import { test, expect } from '@/support/fixtures';
import { WorkloadsDeploymentsListPagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import ResourceYamlPo from '@/e2e/po/components/resource-yaml.po';

const namespace = 'default';

test.describe('Yaml Editor', () => {
  let name: string;

  test.beforeEach(async ({ login, rancherApi }) => {
    await login();

    name = rancherApi.createE2EResourceName('yaml-editor');

    // Create deployment via API for reliable setup
    await rancherApi.createRancherResource('v1', 'apps.deployments', {
      metadata: { name, namespace },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: { containers: [{ name: 'nginx', image: 'nginx' }] },
        },
      },
    });
  });

  test.describe('Edit mode', () => {
    test(
      'Check if body and footer are visible to human eye',
      { tag: ['@components', '@adminUser'] },
      async ({ page }) => {
        const deploymentsListPage = new WorkloadsDeploymentsListPagePo(page, 'local', { q: name });

        await deploymentsListPage.goTo();
        await expect(deploymentsListPage.listElementWithName(name)).toBeAttached();
        await deploymentsListPage.goToEditYamlPage(name);

        const resourceYaml = new ResourceYamlPo(page);

        await expect(resourceYaml.body()).toBeVisible();
        await expect(resourceYaml.footer()).toBeVisible();
      },
    );
  });

  test.afterEach(async ({ rancherApi }) => {
    // Cleanup via API
    await rancherApi.deleteRancherResource('v1', 'apps.deployments', `${namespace}/${name}`, false);
  });
});
