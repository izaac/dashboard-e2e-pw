import path from 'path';
import { type Locator, type Page, type Route } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import { WorkloadsDeploymentsDetailsPagePo } from '@/e2e/po/pages/explorer/workloads/workloads-deployments.po';
import { EXTRA_LONG, LONG } from '@/support/timeouts';

const EVIDENCE_DIR =
  process.env.QA_EVIDENCE_DIR || '/home/izaac/Documents/ui-qa-plans/plans/qa-17913-workload-pods-scale-rocker-evidence';

const GRACE_DEPLOYMENT = 'qa-scale-grace';
const STANDARD_DEPLOYMENT = 'qa-scale-std';
const FAILURE_DEPLOYMENT = 'qa-scale-fail';

function deploymentBody(
  namespace: string,
  name: string,
  replicas: number,
  container: Record<string, unknown>,
  podSpec: Record<string, unknown> = {},
) {
  return {
    type: 'apps.deployment',
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name, namespace },
    spec: {
      replicas,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: { containers: [{ name: 'container-0', ...container }], ...podSpec },
      },
    },
  };
}

/** Pods status card of the workload detail page: the card that hosts the scale rocker */
function podsCard(page: Page, detailsPage: WorkloadsDeploymentsDetailsPagePo): Locator {
  return page.getByTestId('resource-detail-status-card').filter({ has: detailsPage.scaler() });
}

test.describe('Workload Pods Card Scale Rocker (#17913)', { tag: ['@explorer2', '@adminUser'] }, () => {
  let testNamespace = '';

  test.beforeAll(async ({ rancherApi }) => {
    test.setTimeout(EXTRA_LONG);

    testNamespace = rancherApi.createE2EResourceName('qa-17913-scale');
    await rancherApi.createNamespace(testNamespace);

    // Pods ignore SIGTERM and hold for the full grace period, so scale-down leaves them Terminating
    await rancherApi.createRancherResource(
      'v1',
      'apps.deployments',
      deploymentBody(
        testNamespace,
        GRACE_DEPLOYMENT,
        3,
        {
          image: 'busybox:1.37',
          command: ['sh', '-c', 'trap "" TERM; while true; do sleep 1; done'],
        },
        { terminationGracePeriodSeconds: 60 },
      ),
    );

    const pause = { image: 'registry.k8s.io/pause:3.10' };

    await rancherApi.createRancherResource(
      'v1',
      'apps.deployments',
      deploymentBody(testNamespace, STANDARD_DEPLOYMENT, 1, pause),
    );
    // Dedicated workload for the failure scenario so it does not depend on scenario 2 having scaled the standard one
    await rancherApi.createRancherResource(
      'v1',
      'apps.deployments',
      deploymentBody(testNamespace, FAILURE_DEPLOYMENT, 1, pause),
    );

    for (const [name, replicas] of [
      [GRACE_DEPLOYMENT, 3],
      [STANDARD_DEPLOYMENT, 1],
      [FAILURE_DEPLOYMENT, 1],
    ] as const) {
      const ready = await rancherApi.waitForRancherResource(
        'v1',
        'apps.deployments',
        `${testNamespace}/${name}`,
        (resp) => resp.body.status?.readyReplicas === replicas,
        60,
        2000,
      );

      expect(ready, `deployment ${name} should reach ${replicas} ready replicas`).toBe(true);
    }
  });

  test.afterAll(async ({ rancherApi }) => {
    // Namespace deletion also reaps the pods still holding their 60s termination grace period
    try {
      if (testNamespace) {
        await rancherApi.deleteNamespace([testNamespace]);
      }
    } finally {
      testNamespace = '';
    }
  });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('should show desired replicas in the Pods card scale rocker while terminating pods exist', async ({ page }) => {
    const detailsPage = new WorkloadsDeploymentsDetailsPagePo(page, GRACE_DEPLOYMENT, 'local', testNamespace);

    await detailsPage.goTo();
    await detailsPage.waitForPage();
    await expect(detailsPage.mastheadTitle()).toContainText(GRACE_DEPLOYMENT);
    await expect(detailsPage.scalerValue()).toHaveText('3', { timeout: LONG });

    const scaleResp = page.waitForResponse(
      (resp) => resp.url().includes('/v1/apps.deployments/') && ['PUT', 'PATCH'].includes(resp.request().method()),
    );

    await detailsPage.scaleDownButton().click();
    expect((await scaleResp).status()).toBe(200);

    // Rocker tracks spec.replicas immediately, not the observed pod count
    await expect(detailsPage.scalerValue()).toHaveText('2');

    // The extra pod ignores SIGTERM, so it stays Terminating while the rocker keeps showing the desired replicas
    await expect(podsCard(page, detailsPage).getByText('Terminating')).toBeVisible({ timeout: LONG });
    await expect(detailsPage.scalerValue()).toHaveText('2');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-01-terminating-pods-rocker-shows-replicas.png'),
      fullPage: true,
    });
  });

  test('should increment replicas on a standard deployment and block the buttons while in flight', async ({ page }) => {
    const detailsPage = new WorkloadsDeploymentsDetailsPagePo(page, STANDARD_DEPLOYMENT, 'local', testNamespace);
    let releaseRequest!: () => void;
    const released = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const scaleHandler = async (route: Route) => {
      if (['PUT', 'PATCH'].includes(route.request().method())) {
        await released;
      }
      await route.continue();
    };

    await detailsPage.goTo();
    await detailsPage.waitForPage();
    await expect(detailsPage.scalerValue()).toHaveText('1', { timeout: LONG });

    await page.route('**/v1/apps.deployments/**', scaleHandler);

    try {
      const scaleResp = page.waitForResponse(
        (resp) => resp.url().includes('/v1/apps.deployments/') && ['PUT', 'PATCH'].includes(resp.request().method()),
      );

      await detailsPage.scaleUpButton().click();

      // In flight: optimistic target value shown, both buttons blocked but still focusable
      await expect(detailsPage.scalerValue()).toHaveText('2');
      await expect(detailsPage.scaleUpButton()).toHaveAttribute('aria-disabled', 'true');
      await expect(detailsPage.scaleDownButton()).toHaveAttribute('aria-disabled', 'true');

      releaseRequest();
      expect((await scaleResp).status()).toBe(200);
    } finally {
      releaseRequest();
      await page.unroute('**/v1/apps.deployments/**', scaleHandler);
    }

    await expect(detailsPage.scaleUpButton()).toHaveAttribute('aria-disabled', 'false');
    await expect(detailsPage.scaleDownButton()).toHaveAttribute('aria-disabled', 'false');
    await expect(detailsPage.scalerValue()).toHaveText('2');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-02-standard-deployment-scale-rocker.png'),
      fullPage: true,
    });
  });

  test('should roll the rocker back to the previous value when the scale request fails', async ({ page }) => {
    const detailsPage = new WorkloadsDeploymentsDetailsPagePo(page, FAILURE_DEPLOYMENT, 'local', testNamespace);
    let releaseRequest!: () => void;
    const released = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const failHandler = async (route: Route) => {
      if (['PUT', 'PATCH'].includes(route.request().method())) {
        await released;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ type: 'error', code: 'ServerError', message: 'mocked scale failure' }),
        });

        return;
      }
      await route.continue();
    };

    await detailsPage.goTo();
    await detailsPage.waitForPage();
    await expect(detailsPage.scalerValue()).toHaveText('1', { timeout: LONG });

    await page.route('**/v1/apps.deployments/**', failHandler);

    try {
      const failedResp = page.waitForResponse(
        (resp) => resp.url().includes('/v1/apps.deployments/') && ['PUT', 'PATCH'].includes(resp.request().method()),
      );

      await detailsPage.scaleUpButton().click();

      // Optimistic value while the request is pending
      await expect(detailsPage.scalerValue()).toHaveText('2');
      await expect(detailsPage.scaleUpButton()).toHaveAttribute('aria-disabled', 'true');

      releaseRequest();
      expect((await failedResp).status()).toBe(500);
    } finally {
      releaseRequest();
    }

    // Rolled back to the saved value and re-enabled
    await expect(detailsPage.scalerValue()).toHaveText('1');
    await expect(detailsPage.scaleUpButton()).toHaveAttribute('aria-disabled', 'false');

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'scenario-05-scale-failure-rollback.png'),
      fullPage: true,
    });

    await page.unroute('**/v1/apps.deployments/**', failHandler);
  });
});
