import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import ResourceQuotaPo from '@/e2e/po/components/resource-quota.po';
import TabbedPo from '@/e2e/po/components/tabbed.po';
import WelcomeDialogPo from '@/e2e/po/prompts/welcome-dialog.po';
import { ProjectsNamespacesListPagePo } from '@/e2e/po/pages/explorer/projects-namespaces.po';

const PROJECT_NAME = 'qa-19072-p';
const BROKEN_NAMESPACE = 'qa-19072-broken';
const HEALTHY_NAMESPACE = 'qa-19072-healthy';
const QUOTA_ANNOTATION = 'field.cattle.io/resourceQuota';
const PROJECT_ANNOTATION = 'field.cattle.io/projectId';
const MALFORMED_QUOTA = '{"limit":{"limitsCpu":"500m"}}"';

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

async function setQuotaAnnotation(rancherApi: RancherApi, name: string, quota: string) {
  const { body } = await rancherApi.getRancherResource('v1', 'namespaces', name);

  body.metadata.annotations = { ...body.metadata.annotations, [QUOTA_ANNOTATION]: quota };

  await rancherApi.updateRancherResource('v1', 'namespaces', name, body);
}

async function openQuotaTab(page: Page, namespace: string) {
  await page.goto(`./c/local/explorer/namespace/${namespace}?mode=edit`, { waitUntil: 'domcontentloaded' });
  await new WelcomeDialogPo(page).dismissIfVisible();
  await new TabbedPo(page).tab('container-resource-quotas').click();
}

async function removeFixtures(rancherApi: RancherApi) {
  await Promise.all(
    [BROKEN_NAMESPACE, HEALTHY_NAMESPACE].map(async (name) => {
      await rancherApi.deleteRancherResource('v1', 'namespaces', name, false);
      await rancherApi.waitForResourceGone('v1', 'namespaces', name);
    }),
  );

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

    await createNamespace(rancherApi, BROKEN_NAMESPACE, project.id, MALFORMED_QUOTA);
    await createNamespace(rancherApi, HEALTHY_NAMESPACE, project.id, '{"limit":{"limitsCpu":"500m"}}');
  });

  test.afterAll(async ({ rancherApi }) => {
    test.setTimeout(120_000);
    await removeFixtures(rancherApi);
  });

  test.beforeEach(async ({ login, rancherApi }) => {
    await setQuotaAnnotation(rancherApi, BROKEN_NAMESPACE, MALFORMED_QUOTA);
    await login();
  });

  test('displays error banner when editing a namespace with malformed resource quota annotation', async ({ page }) => {
    const resourceQuota = new ResourceQuotaPo(page);

    await openQuotaTab(page, BROKEN_NAMESPACE);

    await expect(resourceQuota.invalidAnnotationBanner()).toBeVisible();
    await expect(resourceQuota.bannerContent()).toContainText('malformed');
  });

  test('does not display error banner when editing a sibling namespace with valid resource quota', async ({ page }) => {
    const resourceQuota = new ResourceQuotaPo(page);

    await openQuotaTab(page, HEALTHY_NAMESPACE);

    await expect(resourceQuota.self()).toBeVisible();
    await expect(resourceQuota.invalidAnnotationBanner()).toHaveCount(0);
    await expect(resourceQuota.quotaInputs().first()).toBeVisible();
    await expect(resourceQuota.quotaInputs().first()).toBeEditable();
  });

  test('repairs malformed resource quota annotation and clears banner when saving the namespace', async ({
    page,
    rancherApi,
  }) => {
    const resourceQuota = new ResourceQuotaPo(page);

    await openQuotaTab(page, BROKEN_NAMESPACE);
    await expect(resourceQuota.invalidAnnotationBanner()).toBeVisible();

    await resourceQuota.saveButton().click();

    await expect
      .poll(
        async () => {
          const { body } = await rancherApi.getRancherResource('v1', 'namespaces', BROKEN_NAMESPACE);

          try {
            const parsed = JSON.parse(body.metadata.annotations[QUOTA_ANNOTATION]);

            return !Array.isArray(parsed) && !!parsed.limit;
          } catch {
            return false;
          }
        },
        { timeout: 60000, intervals: [1000] },
      )
      .toBe(true);

    await openQuotaTab(page, BROKEN_NAMESPACE);
    await expect(resourceQuota.self()).toBeVisible();
    await expect(resourceQuota.invalidAnnotationBanner()).toHaveCount(0);

    const { body } = await rancherApi.getRancherResource('v1', 'namespaces', BROKEN_NAMESPACE);

    expect(() => JSON.parse(body.metadata.annotations[QUOTA_ANNOTATION])).not.toThrow();
  });

  test('renders projects and namespaces list without crashing when a namespace has a malformed annotation', async ({
    page,
  }) => {
    const errors: Error[] = [];

    page.on('pageerror', (err) => errors.push(err));

    const listPage = new ProjectsNamespacesListPagePo(page, 'local');

    await listPage.goTo();
    await listPage.waitForPage();
    await new WelcomeDialogPo(page).dismissIfVisible();

    const table = listPage.list().resourceTable().sortableTable();

    await expect(table.self()).toBeVisible();
    // Grouped table renders the project row once per rendered page and exposes the project name in
    // several rows, so assert the first match rather than requiring a single row.
    await expect(table.rowElementWithName(PROJECT_NAME).first()).toBeVisible();
    await expect(table.rowElementWithName(BROKEN_NAMESPACE).first()).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('displays error banner when resource quota annotation contains a non-object json array', async ({
    page,
    rancherApi,
  }) => {
    await setQuotaAnnotation(rancherApi, BROKEN_NAMESPACE, '[]');
    await openQuotaTab(page, BROKEN_NAMESPACE);

    await expect(new ResourceQuotaPo(page).invalidAnnotationBanner()).toBeVisible();
  });
});
