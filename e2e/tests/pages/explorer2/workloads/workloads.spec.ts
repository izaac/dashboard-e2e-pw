import { test, expect } from '@/support/fixtures';
import PagePo from '@/e2e/po/pages/page.po';

test.describe('Workloads', { tag: ['@noVai', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('creating a simple pod should appear on the workloads list page', async ({ page, rancherApi }) => {
    const podName = `e2e-pod-${Date.now()}`;
    const namespace = 'default';

    await rancherApi.createPod(namespace, podName, 'nginx:alpine');

    try {
      const podDetailPage = new PagePo(page, `/c/local/explorer/pod/${namespace}/${podName}`);

      await podDetailPage.goTo();
      await podDetailPage.waitForPage();

      await expect(podDetailPage.mastheadTitle()).toContainText(podName);
    } finally {
      await rancherApi.deleteRancherResource('v1', `pods/${namespace}`, podName, false);
    }
  });

  test('Validation errors should not be shown when form is just opened', async ({ page }) => {
    const deploymentsCreatePage = new PagePo(page, '/c/local/explorer/apps.deployment/create');

    await deploymentsCreatePage.goTo();
    await deploymentsCreatePage.waitForPage();

    await expect(page.locator('#cru-errors')).not.toBeAttached();
  });
});
