import { test, expect } from '@/support/fixtures';
import ClusterDashboardPagePo from '@/e2e/po/pages/explorer/cluster-dashboard.po';
import { eventsGetEmptyEventsSet } from '@/e2e/blueprints/explorer/cluster/events';
import { HeaderPo } from '@/e2e/po/components/header.po';

const configMapYaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: e2e-test-${+new Date()}
  annotations:
    {}
  labels:
    {}
  namespace: default
__clone: true`;

test.describe('Cluster Dashboard', { tag: ['@explorer', '@adminUser'] }, () => {
  test('can navigate to cluster dashboard', async ({ page, login }) => {
    await login();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage(undefined, 'cluster-events');
  });

  test('has the correct title', async ({ page, login, rancherApi }) => {
    await login();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();

    const version = await rancherApi.getRancherVersion();
    const expectedTitle =
      version.RancherPrime === 'true'
        ? 'Rancher Prime - local - Cluster Dashboard'
        : 'Rancher - local - Cluster Dashboard';

    await expect(page).toHaveTitle(expectedTitle);
  });

  test('shows fleet controller status', async ({ page, login }) => {
    await login();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();

    await expect(clusterDashboard.fleetStatus()).toBeAttached();
  });

  test('can import a YAML successfully', async ({ page, login }) => {
    await login();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();

    const header = new HeaderPo(page);

    await header.importYamlHeaderAction().click();
    await header.importYaml().importYamlEditor().set(configMapYaml);
    await header.importYaml().importYamlImportClick();
    await header.importYaml().importYamlSuccessTitleCheck();

    await expect(
      header.importYaml().importYamlSortableTable().tableHeaderRowElementWithPartialName('State'),
    ).not.toBeAttached();
    await expect(header.importYaml().importYamlSortableTable().subRows()).not.toBeAttached();

    await header.importYaml().importYamlCloseClick();
  });

  test('can open the kubectl shell from header', async ({ page, login }) => {
    await login();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();

    const header = new HeaderPo(page);

    await header.kubectlShell().openAndExecuteCommand('get no');
    await header.kubectlShell().closeTerminal();
  });

  test('can copy the kubeconfig to clipboard', async ({ page, login }) => {
    await login();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();

    const header = new HeaderPo(page);
    const copyResponse = page.waitForResponse(
      (resp) => resp.url().includes('/v1/ext.cattle.io.kubeconfigs') && resp.request().method() === 'POST',
    );

    await header.copyKubeconfig().click();
    await copyResponse;
    await expect(header.copyKubeConfigCheckmark()).toBeVisible();
  });

  test('can view deployments', async ({ page, login, rancherApi }) => {
    await login();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();

    const deploymentsResult = await rancherApi.getRancherResource(
      'v1',
      'apps.deployments',
      '?exclude=metadata.managedFields',
    );
    const count = deploymentsResult.body.count;

    await expect(clusterDashboard.deploymentsBox()).toContainText(String(count));

    await clusterDashboard.deploymentsBox().click();
    await expect(page).toHaveURL(/apps\.deployment/);
  });

  test('can view nodes', async ({ page, login, rancherApi }) => {
    await login();

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage();

    const nodesResult = await rancherApi.getRancherResource('v1', 'nodes', '?exclude=metadata.managedFields');
    const count = nodesResult.body.count;
    const text = count > 1 ? 'Nodes' : 'Node';

    await expect(clusterDashboard.nodesBox(text)).toContainText(String(count));
    await clusterDashboard.nodesBox(text).click();
    await expect(page).toHaveURL(/node$/);
  });

  test('can view events table empty if no events', { tag: ['@noVai'] }, async ({ page, login }) => {
    await login();

    await page.route('**/v1/events?*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(eventsGetEmptyEventsSet) });
    });

    const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

    await clusterDashboard.goTo();
    await clusterDashboard.waitForPage(undefined, 'cluster-events');

    await clusterDashboard.eventsList().sortableTable().checkRowCount(true, 1);
  });

  test.describe('Cluster dashboard with limited permissions', () => {
    test.skip(true, 'Requires creating standard user with specific project roles — complex setup skipped');

    test('does not show fleet controller status for standard user', async () => {
      // requires std user creation and login
    });
  });

  test.describe('Cluster dashboard - Fleet agent', () => {
    test('does not show fleet controller status if a 403 is returned by the API', async ({ page, login }) => {
      await login();

      const forbiddenResponse = {
        type: 'error',
        code: 'Forbidden',
        message: 'deployments.apps is forbidden',
        status: 403,
      };

      await page.route('**/v1/apps.deployments/cattle-fleet-system/fleet-controller?*', (route) => {
        route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify(forbiddenResponse) });
      });
      await page.route('**/v1/apps.deployments/cattle-fleet-local-system/fleet-agent?*', (route) => {
        route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify(forbiddenResponse) });
      });

      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      await expect(clusterDashboard.fleetStatus()).toBeAttached();
      await expect(clusterDashboard.fleetStatus()).toBeHidden();
      await expect(clusterDashboard.etcdStatus()).toBeAttached();
      await expect(clusterDashboard.schedulerStatus()).toBeAttached();
      await expect(clusterDashboard.controllerManagerStatus()).toBeAttached();
    });

    test('does not show fleet controller status if a 404 is returned by the API', async ({ page, login }) => {
      await login();

      await page.route('**/v1/apps.deployments/cattle-fleet-system/fleet-controller?*', (route) => {
        route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({}) });
      });
      await page.route('**/v1/apps.deployments/cattle-fleet-local-system/fleet-agent?*', (route) => {
        route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({}) });
      });

      const clusterDashboard = new ClusterDashboardPagePo(page, 'local');

      await clusterDashboard.goTo();
      await clusterDashboard.waitForPage();

      await expect(clusterDashboard.fleetStatus()).toBeAttached();
      await expect(clusterDashboard.fleetStatus()).toBeHidden();
      await expect(clusterDashboard.etcdStatus()).toBeAttached();
      await expect(clusterDashboard.schedulerStatus()).toBeAttached();
      await expect(clusterDashboard.controllerManagerStatus()).toBeAttached();
    });
  });
});
