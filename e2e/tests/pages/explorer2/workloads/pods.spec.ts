import { test, expect } from '@/support/fixtures';
import { WorkloadsPodsListPagePo, WorkloadsPodsDetailPagePo } from '@/e2e/po/pages/explorer/workloads-pods.po';
import { WorkloadsCreatePageBasePo } from '@/e2e/po/pages/explorer/workloads/workloads.po';
import { SMALL_CONTAINER } from '@/e2e/tests/pages/explorer2/workloads/workload.utils';

test.describe('Pods', { tag: ['@explorer2', '@adminUser'] }, () => {
  test.describe('When cloning a pod', () => {
    test('Should have same spec as the original pod', async ({ page, login, rancherApi }) => {
      await login();
      const origPodName = `e2e-pod-orig-${Date.now()}`;
      const clonePodName = `e2e-pod-clone-${Date.now()}`;
      const namespace = 'default';

      await rancherApi.createPod(namespace, origPodName, 'nginx:alpine');

      try {
        const detailPage = new WorkloadsPodsDetailPagePo(page, namespace, origPodName);

        await page.goto(`.${detailPage['path']}?mode=clone`, { waitUntil: 'domcontentloaded' });

        const cruResource = detailPage.createEditView();

        await cruResource.nameNsDescription().name().set(clonePodName);

        const responsePromise = page.waitForResponse(
          (resp) => resp.url().includes('/v1/pods') && resp.request().method() === 'POST',
        );

        await cruResource.formSave().click();

        const response = await responsePromise;

        expect(response.status()).toBe(201);

        const podsPage = new WorkloadsPodsListPagePo(page);

        await podsPage.goTo();
        await expect(podsPage.sortableTable().self()).toBeVisible();

        await podsPage.filterBySearchBox(clonePodName);
        await expect(podsPage.sortableTable().rowElementWithPartialName(clonePodName)).toBeVisible();
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

      const podsPage = new WorkloadsPodsListPagePo(page);

      await podsPage.goTo();
      await podsPage.waitForPage();

      await podsPage.masthead().create();

      const cruResource = podsPage.createEditView();

      await cruResource.nameNsDescription().name().set(podName);
      await cruResource.nameNsDescription().selectNamespace('default');
      const createPage = new WorkloadsCreatePageBasePo(page, 'local', 'pods');

      await createPage.containerImage().set(SMALL_CONTAINER.image);

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/v1/pods') && resp.request().method() === 'POST',
      );

      await cruResource.formSave().click();

      const response = await responsePromise;

      expect(response.status()).toBe(201);

      try {
        await podsPage.waitForPage();

        await expect(podsPage.sortableTable().rowElementWithPartialName(podName)).toBeVisible();
      } finally {
        await rancherApi.deleteRancherResource('v1', 'pods/default', podName, false);
      }
    });

    test('should properly add container tabs to the tablist', async ({ page, login }) => {
      await login();
      const podsPage = new WorkloadsPodsListPagePo(page);

      await podsPage.goTo();
      await podsPage.waitForPage();

      await podsPage.masthead().create();

      const createPage = new WorkloadsCreatePageBasePo(page, 'local', 'pods');
      const addContainerBtn = createPage.addContainerButton();

      await addContainerBtn.click();

      await expect(createPage.podTab()).toContainText('Pod');
      await expect(createPage.containerTab(0)).toContainText('container-0');
      await expect(createPage.containerTab(1)).toContainText('container-1');
      await expect(addContainerBtn).toContainText('Add Container');
    });

    test('should remove the correct environment variable from the workload form', async ({ page, login }) => {
      await login();
      const podsPage = new WorkloadsPodsListPagePo(page);

      await podsPage.goTo();
      await podsPage.waitForPage();

      await podsPage.masthead().create();

      const createPage = new WorkloadsCreatePageBasePo(page, 'local', 'pods');

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
  });
});
