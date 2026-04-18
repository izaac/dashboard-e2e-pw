import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';
import SortableTablePo from '@/e2e/po/components/sortable-table.po';
import ResourceListMastheadPo from '@/e2e/po/components/resource-list-masthead.po';
import CreateEditViewPo from '@/e2e/po/components/create-edit-view.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';

test.describe('Pods', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('List', { tag: ['@noVai', '@adminUser'] }, () => {
    test.skip(true, 'Pagination tests require bulk resource creation infrastructure (createManyNamespacedResources)');

    test('pagination is visible and user is able to navigate through pods data', async () => {});
    test('sorting changes the order of paginated pods data', async () => {});
    test('filter pods', async () => {});
    test('pagination is hidden', async () => {});
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
        const clonePage = new PagePo(page, `/c/local/explorer/pod/${namespace}/${origPodName}`);

        await page.goto(`.${clonePage['path']}?mode=clone`, { waitUntil: 'domcontentloaded' });

        const cruResource = new CreateEditViewPo(page, '.dashboard-root');

        await cruResource.nameNsDescription().name().set(clonePodName);

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/pods') && resp.request().method() === 'POST',
        );

        await cruResource.formSave().click();

        const response = await responsePromise;

        expect(response.status()).toBe(201);

        const podsPage = new PagePo(page, '/c/local/explorer/pod');

        await podsPage.waitForPage();

        const sortableTable = new SortableTablePo(page, '.sortable-table');

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

      const podsPage = new PagePo(page, '/c/local/explorer/pod');

      await podsPage.goTo();
      await podsPage.waitForPage();

      const masthead = new ResourceListMastheadPo(page, ':scope');

      await masthead.create();

      const cruResource = new CreateEditViewPo(page, '.dashboard-root');

      await cruResource.nameNsDescription().name().set(podName);
      await page.getByTestId('input-container-image-0').fill(SMALL_CONTAINER.image);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/pods') && resp.request().method() === 'POST',
      );

      await cruResource.formSave().click();

      const response = await responsePromise;

      expect(response.status()).toBe(201);

      try {
        await podsPage.waitForPage();

        const sortableTable = new SortableTablePo(page, '.sortable-table');

        await expect(sortableTable.rowElementWithPartialName(podName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'pods/default', podName, false);
      }
    });

    test('should properly add container tabs to the tablist', async ({ page, login }) => {
      await login();
      const podsPage = new PagePo(page, '/c/local/explorer/pod');

      await podsPage.goTo();
      await podsPage.waitForPage();

      const masthead = new ResourceListMastheadPo(page, ':scope');

      await masthead.create();

      const addContainerBtn = page.getByTestId('workload-button-add-container');

      await addContainerBtn.click();

      await expect(page.getByTestId('btn-pod')).toContainText('Pod');
      await expect(page.getByTestId('btn-container-0')).toContainText('container-0');
      await expect(page.getByTestId('btn-container-1')).toContainText('container-1');
      await expect(addContainerBtn).toContainText('Add Container');
    });

    test('should remove the correct environment variable from the workload form', async ({ page, login }) => {
      await login();
      const podsPage = new PagePo(page, '/c/local/explorer/pod');

      await podsPage.goTo();
      await podsPage.waitForPage();

      const masthead = new ResourceListMastheadPo(page, ':scope');

      await masthead.create();

      const addEnvVarBtn = page.locator('button').filter({ hasText: 'Add Variable' }).first();

      await addEnvVarBtn.click();
      await addEnvVarBtn.click();
      await addEnvVarBtn.click();

      const keyInputs = page.locator('.key-value-input .kv-item .name input');

      await keyInputs.nth(0).fill('FIRST_VAR');
      await keyInputs.nth(1).fill('SECOND_VAR');
      await keyInputs.nth(2).fill('THIRD_VAR');

      await expect(keyInputs.nth(0)).toHaveValue('FIRST_VAR');
      await expect(keyInputs.nth(1)).toHaveValue('SECOND_VAR');
      await expect(keyInputs.nth(2)).toHaveValue('THIRD_VAR');

      const removeButtons = page.locator('.key-value-input .kv-item button.role-link');

      await removeButtons.nth(1).click();

      await expect(keyInputs.nth(0)).toHaveValue('FIRST_VAR');
      await expect(keyInputs.nth(1)).toHaveValue('THIRD_VAR');
    });

    test.skip(true, 'Footer controls YAML Editor test requires viewport measurement not available in headless');
    test('Footer controls should stick to bottom in YAML Editor', async () => {});
  });
});
