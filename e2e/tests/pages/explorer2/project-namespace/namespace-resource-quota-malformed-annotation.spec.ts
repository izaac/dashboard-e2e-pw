import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import ResourceQuotaPo from '@/e2e/po/components/resource-quota.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';

const PROJECT_NAME = 'qa-19072-p';
const BROKEN_NAMESPACE = 'qa-19072-broken';
const HEALTHY_NAMESPACE = 'qa-19072-healthy';
const QUOTA_ANNOTATION = 'field.cattle.io/resourceQuota';
const PROJECT_ANNOTATION = 'field.cattle.io/projectId';

async function createNamespace(rancherApi: RancherApi, name: string, projectId: string, quota: string) {
  await rancherApi.createRancherResource('v1', 'namespaces', {
    type: 'namespace',
    metadata: {
      name,
      annotations: {
        [PROJECT_ANNOTATION]: projectId,
        [QUOTA_ANNOTATION]: quota,
      },
    },
  });
}

async function removeFixtures(rancherApi: RancherApi) {
  for (const name of [BROKEN_NAMESPACE, HEALTHY_NAMESPACE]) {
    await rancherApi.deleteRancherResource('v1', 'namespaces', name, false);
    await rancherApi.waitForResourceGone('v1', 'namespaces', name);
  }

  const { body } = await rancherApi.getRancherResource('v3', `projects?name=${PROJECT_NAME}&clusterId=local`);

  for (const project of body.data ?? []) {
    await rancherApi.deleteRancherResource('v3', 'projects', project.id, false);
  }
}

test.describe('Namespace resource quota malformed annotation', { tag: ['@generic', '@adminUser'] }, () => {
  test.beforeAll(async ({ rancherApi }) => {
    await removeFixtures(rancherApi);

    const { body: project } = await rancherApi.createRancherResource('v3', 'projects', {
      type: 'project',
      name: PROJECT_NAME,
      clusterId: 'local',
      resourceQuota: { limit: { limitsCpu: '2000m', limitsMemory: '2048Mi' } },
      namespaceDefaultResourceQuota: { limit: { limitsCpu: '500m', limitsMemory: '512Mi' } },
    });

    await rancherApi.expectResourceState('v3', 'projects', project.id, (resp) => resp.body.state === 'active');

    await createNamespace(rancherApi, BROKEN_NAMESPACE, project.id, '{"limit":{"limitsCpu":"500m"}}"');
    await createNamespace(rancherApi, HEALTHY_NAMESPACE, project.id, '{"limit":{"limitsCpu":"500m"}}');
  });

  test.afterAll(async ({ rancherApi }) => {
    await removeFixtures(rancherApi);
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('displays error banner when editing a namespace with malformed resource quota annotation', async ({ page }) => {
    const resourceQuota = new ResourceQuotaPo(page);

    await page.goto(`./c/local/explorer/namespace/${BROKEN_NAMESPACE}?mode=edit`, { waitUntil: 'domcontentloaded' });
    await new WelcomeDialogPo(page).dismissIfVisible();
    await new TabbedPo(page).tab('container-resource-quotas').click();

    await expect(resourceQuota.invalidAnnotationBanner()).toBeVisible();
    await expect(resourceQuota.bannerContent()).toContainText('malformed');
  });

  test('does not display error banner when editing a sibling namespace with valid resource quota', async ({ page }) => {
    const resourceQuota = new ResourceQuotaPo(page);

    await page.goto(`./c/local/explorer/namespace/${HEALTHY_NAMESPACE}?mode=edit`, { waitUntil: 'domcontentloaded' });
    await new WelcomeDialogPo(page).dismissIfVisible();
    await new TabbedPo(page).tab('container-resource-quotas').click();

    await expect(resourceQuota.self()).toBeVisible();
    await expect(resourceQuota.invalidAnnotationBanner()).toHaveCount(0);
    await expect(resourceQuota.quotaInputs().first()).toBeVisible();
    await expect(resourceQuota.quotaInputs().first()).toBeEditable();
  });
});
