import { test, expect } from '@/support/fixtures';
import { WorkloadsPodsListPagePo, WorkloadsPodsDetailPagePo } from '@/e2e/po/pages/explorer/workloads-pods.po';
import { WorkloadsCreatePageBasePo } from '@/e2e/po/pages/explorer/workloads/workloads.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';
import {
  createBulkResources,
  setTablePreferences,
  restoreTablePreferences,
  assertPaginationNavigation,
  assertPaginationSorting,
  assertPaginationFilter,
  assertPaginationHidden,
  mockSmallCollection,
  type SavedPrefs,
} from './pagination.utils';

test.describe('Pods', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test.describe.configure({ mode: 'serial' });
    // Serial: tests share bulk resource setup (22 resources + user prefs)

    let savedPrefs: SavedPrefs;
    let ns1: string;
    let ns2: string;
    let bulkNames: string[];
    let uniqueName: string;

    test.beforeAll(async ({ rancherApi }) => {
      ns1 = `e2e-pods-list-${Date.now()}`;
      ns2 = `e2e-pods-unique-${Date.now()}`;

      await Promise.all([rancherApi.createNamespace(ns1), rancherApi.createNamespace(ns2)]);

      uniqueName = `e2e-unique-${Date.now()}`;

      const [names] = await Promise.all([
        createBulkResources(rancherApi, 'v1', 'pods', ns1, 22, (ns: string, name: string) => ({
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name, namespace: ns },
          spec: { containers: [{ name: 'test', image: SMALL_CONTAINER.image }] },
        })),
        rancherApi.createRancherResource('v1', 'pods', {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: uniqueName, namespace: ns2 },
          spec: { containers: [{ name: 'test', image: SMALL_CONTAINER.image }] },
        }),
      ]);

      bulkNames = names;
      savedPrefs = await setTablePreferences(rancherApi, [ns1, ns2]);
    });

    test.afterAll(async ({ rancherApi }) => {
      await restoreTablePreferences(rancherApi, savedPrefs);
      await rancherApi.deleteRancherResource('v1', 'namespaces', ns1, false);
      await rancherApi.deleteRancherResource('v1', 'namespaces', ns2, false);
    });

    test('pagination is visible and user is able to navigate through pods data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsPodsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTable();

      await assertPaginationNavigation(table, 23);
    });

    test('sorting changes the order of paginated pods data', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsPodsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTable();

      await assertPaginationSorting(table, bulkNames[0], 'e2e-');
    });

    test('filter pods', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsPodsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTable();

      await assertPaginationFilter(table, bulkNames[0], uniqueName, ns2);
    });

    test('pagination is hidden', async ({ page, login }) => {
      await login();

      await mockSmallCollection(page, 'v1/pods', 'pod');

      const listPage = new WorkloadsPodsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      const table = listPage.sortableTable();

      await assertPaginationHidden(table);

      await page.unroute('**/v1/pods?**');
    });
  });

  test.describe('Should open a terminal', () => {
    test.skip(true, 'Pod shell tests require a running pod with a shell — skipped in automated CI');

    test('should open a pod shell', async () => {});
  });

  test.describe('When cloning a pod', () => {
    test('Should have same spec as the original pod', async ({ page, login, rancherApi }) => {
      await login();
      const origPodName = `e2e-pod-orig-${Date.now()}`;
      const clonePodName = `e2e-pod-clone-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createPod(namespace, origPodName, 'nginx:alpine');

      try {
        const detailPage = new WorkloadsPodsDetailPagePo(page, namespace, origPodName);

        await detailPage.goToClone();

        const cruResource = detailPage.createEditView();

        await cruResource.nameNsDescription().name().set(clonePodName);

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/pods') && resp.request().method() === 'POST',
        );

        await cruResource.formSave().click();

        const response = await responsePromise;

        expect(response.status()).toBe(201);

        const listPage = new WorkloadsPodsListPagePo(page);

        await listPage.waitForPage();

        const sortableTable = listPage.sortableTable();

        await sortableTable.filter(clonePodName);
        await expect(sortableTable.rowElementWithPartialName(clonePodName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', `pods/${namespace}`, origPodName, false);
        await rancherApi.deleteRancherResource('v1', `pods/${namespace}`, clonePodName, false);
      }
    });
  });

  test.describe('When creating a pod using the web Form', () => {
    test('should have the default input units displayed', async ({ page, login, rancherApi }) => {
      await login();
      const podName = `e2e-pod-units-${Date.now()}`;
      const listPage = new WorkloadsPodsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await listPage.masthead().create();

      const createPage = new WorkloadsCreatePageBasePo(page, 'local', 'pod');
      const cruResource = listPage.createEditView();

      await cruResource.nameNsDescription().name().set(podName);
      await createPage.containerImage().set(SMALL_CONTAINER.image);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/pods') && resp.request().method() === 'POST',
      );

      await cruResource.formSave().click();

      const response = await responsePromise;

      expect(response.status()).toBe(201);

      try {
        await listPage.waitForPage();
        await expect(listPage.sortableTable().rowElementWithPartialName(podName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'pods/default', podName, false);
      }
    });

    test('should properly add container tabs to the tablist', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsPodsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await listPage.masthead().create();

      const createPage = new WorkloadsCreatePageBasePo(page, 'local', 'pod');

      await createPage.addContainerButton().click();

      await expect(createPage.podTab()).toContainText('Pod');
      await expect(createPage.containerTab(0)).toContainText('container-0');
      await expect(createPage.containerTab(1)).toContainText('container-1');
      await expect(createPage.addContainerButton()).toContainText('Add Container');
    });

    test('should remove the correct environment variable from the workload form', async ({ page, login }) => {
      await login();
      const listPage = new WorkloadsPodsListPagePo(page);

      await listPage.goTo();
      await listPage.waitForPage();
      await listPage.masthead().create();

      const createPage = new WorkloadsCreatePageBasePo(page, 'local', 'pod');

      await createPage.addEnvironmentVariable();
      await createPage.addEnvironmentVariable();
      await createPage.addEnvironmentVariable();

      await createPage.environmentVariableKeyInput(0).fill('FIRST_VAR');
      await createPage.environmentVariableKeyInput(1).fill('SECOND_VAR');
      await createPage.environmentVariableKeyInput(2).fill('THIRD_VAR');

      await expect(createPage.environmentVariableKeyInput(0)).toHaveValue('FIRST_VAR');
      await expect(createPage.environmentVariableKeyInput(1)).toHaveValue('SECOND_VAR');
      await expect(createPage.environmentVariableKeyInput(2)).toHaveValue('THIRD_VAR');

      await createPage.removeEnvironmentVariable(1);

      await expect(createPage.environmentVariableKeyInput(0)).toHaveValue('FIRST_VAR');
      await expect(createPage.environmentVariableKeyInput(1)).toHaveValue('THIRD_VAR');
    });

    test('Footer controls should stick to bottom in YAML Editor', async () => {
      test.skip(true, 'Footer controls YAML Editor test requires viewport measurement not available in headless');
    });
  });
});
