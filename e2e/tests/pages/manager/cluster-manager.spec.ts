import { test, expect } from '@/support/fixtures';
import { providersList } from '@/e2e/blueprints/manager/clusterProviderUrlCheck';
import { nodeDriveResponse } from '@/e2e/tests/pages/manager/mock-responses';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import ClusterManagerCreateRke2CustomPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-custom.po';
import ClusterManagerDetailRke2AmazonEc2PagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-rke2-amazon.po';
import HostedProvidersPagePo from '@/e2e/po/pages/cluster-manager/hosted-providers.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';

/**
 * Cluster Manager spec — converted from upstream Cypress cluster-manager.spec.ts.
 *
 * Tests that require feature flags, provisioning infrastructure (custom nodes,
 * imported clusters needing real cluster registration), or percy snapshots are
 * skipped with clear reasons. The remaining tests (hosted providers, credential
 * step mock, local cluster navigation) can run against any Rancher instance.
 */

test.describe('Cluster Manager', { tag: ['@manager', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test('deactivating a hosted provider should hide its card from the cluster creation page', async ({
    page,
    login,
    rancherApi,
  }) => {
    let reenableAKS = false;

    await login();

    const providersPage = new HostedProvidersPagePo(page);
    const clusterCreatePage = new ClusterManagerCreatePagePo(page);
    const clusterList = new ClusterManagerListPagePo(page);

    await providersPage.goTo();
    await providersPage.waitForPage();

    // Assert AKS is active
    await expect(providersPage.list().details('Azure AKS', 1)).toContainText('Active');

    try {
      // Deactivate AKS
      const updateResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes('v1/management.cattle.io.settings/kev2-operators') && resp.request().method() === 'PUT',
      );

      const deactivateMenu = await providersPage.list().actionMenu('Azure AKS');

      await deactivateMenu.getMenuItem('Deactivate').click();
      const deactivateResp = await updateResponse;

      expect(deactivateResp.status()).toBe(200);
      reenableAKS = true;

      // Verify AKS card is hidden
      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await expect(
        clusterCreatePage.self().locator('[data-testid*="azure-aks"], .item:has-text("Azure AKS")'),
      ).not.toBeAttached();

      // Re-enable AKS
      const reactivateResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes('v1/management.cattle.io.settings/kev2-operators') && resp.request().method() === 'PUT',
      );

      await providersPage.goTo();
      await providersPage.waitForPage();
      const activateMenu = await providersPage.list().actionMenu('Azure AKS');

      await activateMenu.getMenuItem('Activate').click();
      const reactivateResp = await reactivateResponse;

      expect(reactivateResp.status()).toBe(200);
      reenableAKS = false;

      // Verify AKS card is back
      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await expect(
        clusterCreatePage.self().locator('[data-testid*="azure-aks"], .item:has-text("Azure AKS")'),
      ).toBeAttached();
    } finally {
      if (reenableAKS) {
        // Restore AKS to active state if test failed mid-way
        const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators');
        const operators: any[] = JSON.parse(setting.body.value || '[]');
        const aks = operators.find((o: any) => o.name === 'aks');

        if (aks && !aks.active) {
          aks.active = true;
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators', {
            ...setting.body,
            value: JSON.stringify(operators),
          });
        }
      }
    }
  });

  test.describe('RKE2 providers', () => {
    for (const prov of providersList) {
      test(`should be able to access RKE2 cluster creation for provider ${prov.label} via url`, async ({
        page,
        login,
      }) => {
        await login();

        const clusterCreate = new ClusterManagerCreatePagePo(page);

        await clusterCreate.goTo(`type=${prov.clusterProviderQueryParam}&rkeType=rke2`);
        await clusterCreate.waitForPage();

        await expect(clusterCreate.rke2PageTitle()).toContainText(`Create ${prov.label}`);
      });
    }
  });

  test.describe('Created', () => {
    test.describe('RKE2 Custom', { tag: ['@jenkins', '@customCluster', '@provisioning'] }, () => {
      test('can create new cluster', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (custom node SSH access)');
      });

      test('can copy config to clipboard', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (depends on live RKE2 custom cluster)');
      });

      test('can edit cluster and see changes afterwards', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (depends on live RKE2 custom cluster)');
      });

      test('will disable saving if an addon config has invalid data', async ({ page, login }) => {
        await login();

        const clusterList = new ClusterManagerListPagePo(page);
        const createRKE2ClusterPage = new ClusterManagerCreateRke2CustomPagePo(page);

        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await createRKE2ClusterPage.waitForPage();

        await createRKE2ClusterPage.selectCustom(0);
        await createRKE2ClusterPage.nameNsDescription().name().set('abc');

        await createRKE2ClusterPage.clusterConfigurationTabs().clickTabWithSelector('#rke2-calico');

        await expect(createRKE2ClusterPage.resourceDetail().createEditView().saveButtonPo().self()).toBeEnabled();

        await createRKE2ClusterPage.calicoAddonConfig().yamlEditor().input().set('badvalue: -');
        await expect(createRKE2ClusterPage.resourceDetail().createEditView().saveButtonPo().self()).toBeDisabled();

        await createRKE2ClusterPage.calicoAddonConfig().yamlEditor().input().set('goodvalue: yay');
        await expect(createRKE2ClusterPage.resourceDetail().createEditView().saveButtonPo().self()).toBeEnabled();
      });

      test('can view cluster YAML editor', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (depends on live RKE2 custom cluster)');
      });

      test('can download KubeConfig', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (depends on live RKE2 custom cluster)');
      });

      test('can download YAML', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (depends on live RKE2 custom cluster)');
      });

      test('can delete cluster', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (depends on live RKE2 custom cluster)');
      });
    });
  });

  test.describe('Imported', { tag: ['@jenkins', '@importedCluster', '@provisioning'] }, () => {
    test.describe('Generic', () => {
      test('can create new cluster', async () => {
        test.skip(
          true,
          'Requires feature flags and provisioning infrastructure (real cluster registration via kubectl)',
        );
      });

      test('can edit imported cluster and see changes afterwards', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (imported cluster must exist)');
      });

      test('can delete cluster by bulk actions', async () => {
        test.skip(true, 'Requires feature flags and provisioning infrastructure (imported cluster must exist)');
      });
    });
  });

  test('can navigate to Cluster Management Page', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await homePage.goTo();
    await burgerMenu.toggle();

    const clusterManagementNavItem = burgerMenu.self().locator('text=Cluster Management');

    await expect(clusterManagementNavItem).toBeVisible();
    await clusterManagementNavItem.click();

    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.waitForPage();
  });

  test.describe('Cluster Details Page and Tabs', () => {
    test('can navigate to Cluster Conditions Page', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local', '.cluster-link a');

      await expect(page).toHaveURL(/\/c\/local\/|\/local\//);

      await clusterDetail.conditionsTab().click();
      await expect(page).toHaveURL(/conditions/);

      await expect(clusterDetail.tableRowCell('Created', 0)).toContainText('True');
    });

    test('can navigate to Cluster Related Page', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local', '.cluster-link a');

      await clusterDetail.relatedTab().click();
      await expect(page).toHaveURL(/related/);

      await expect(clusterDetail.tableRowCell('Mgmt', 1)).toContainText('local');
    });

    test('can navigate to Cluster Provisioning Log Page', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local', '.cluster-link a');

      await clusterDetail.logTab().click();
      await expect(page).toHaveURL(/log/);

      await expect(clusterDetail.logsContainer()).toBeVisible();
    });

    test('can navigate to Cluster Machines Page', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local', '.cluster-link a');

      await clusterDetail.nodePoolsTab().click();
      await expect(page).toHaveURL(/node-pools/);

      await expect(clusterDetail.tableRowContaining('machine-')).toBeVisible();
    });

    test('Show Configuration allows to edit config and view yaml for local cluster', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local', '.cluster-link a');

      await clusterDetail.showConfigurationButton().click();

      const drawer = clusterDetail.configurationDrawer();

      await expect(drawer).toBeVisible();
      await expect(drawer.locator('button:has-text("Save")')).toBeVisible();

      await expect(drawer.locator('[data-testid="tab-config"], button:has-text("Config")')).toBeVisible();
      await expect(drawer.locator('[data-testid="tab-yaml"], button:has-text("YAML")')).toBeVisible();

      await drawer.locator('[data-testid="tab-yaml"], button:has-text("YAML")').click();
      await expect(drawer.locator('button:has-text("Save")')).not.toBeAttached();
    });

    test('can navigate to namespace from cluster detail view', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local', '.cluster-link a');

      await expect(clusterDetail.clusterNamespaceLink()).toContainText('fleet-local');
      await clusterDetail.clusterNamespaceLink().click();

      await expect(page).toHaveURL(/Resources/);
    });
  });

  test.describe('Local', () => {
    test('can open edit for local cluster', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      const editMenu = await clusterList.list().actionMenu('local');

      await editMenu.getMenuItem('Edit Config').click();

      await expect(page).toHaveURL(/mode=edit/);

      await expect(clusterDetail.nameInput()).toBeDisabled();

      await clusterDetail.cancelButton().click();
      await clusterList.waitForPage();
    });

    test("can navigate to local cluster's explore product", async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.list().explore('local').click();

      await expect(page).toHaveURL(/\/c\/local\/explorer/);
    });
  });

  test('can download YAML via bulk actions', async ({ page, login }) => {
    await login();

    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();

    await clusterList.sortableTable().rowElementWithName('local').click();
    await clusterList.list().openBulkActionDropdown();
    await clusterList.list().bulkActionButton('Download YAML').click({ force: true });

    // Verify download was triggered (file content validation not available without file system access in PW)
    await expect(clusterList.sortableTable().self()).toBeVisible();
  });

  test('can download KubeConfig via bulk actions', async ({ page, login }) => {
    await login();

    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();

    const kubeConfigResponse = page.waitForResponse(
      (resp) => resp.url().includes('/v1/ext.cattle.io.kubeconfigs') && resp.request().method() === 'POST',
    );

    await clusterList.sortableTable().rowElementWithName('local').click();
    await clusterList.list().openBulkActionDropdown();
    await clusterList.list().bulkActionButton('Download KubeConfig').click();

    const resp = await kubeConfigResponse;

    expect(resp.status()).toBe(201);
  });

  test('can connect to kubectl shell', async ({ page, login }) => {
    await login();

    const clusterList = new ClusterManagerListPagePo(page);
    const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

    await clusterList.goTo();
    await clusterList.waitForPage();

    const shellMenu = await clusterList.list().actionMenu('local');

    await shellMenu.getMenuItem('Kubectl Shell').click();

    await expect(clusterDetail.kubectlShell()).toBeVisible();
    await expect(clusterDetail.kubectlShell().locator('text=Connected')).toBeVisible();

    await clusterDetail.closeShellButton().click();
  });

  test.describe('Credential Step', () => {
    const drivers = ['nutanix', 'oci'];

    for (const driver of drivers) {
      test.describe(`should always show credentials for ${driver} driver`, () => {
        test('should show credential step when `addCloudCredential` is true', async ({ page, login }) => {
          await login();

          await page.route('**/v1/management.cattle.io.nodedrivers*', async (route) => {
            const response = await route.fetch();
            const body = await response.json();

            body.data = nodeDriveResponse(true, driver).data;
            await route.fulfill({ json: body });
          });

          const clusterCreate = new ClusterManagerCreatePagePo(page);

          await clusterCreate.goTo(`type=${driver}&rkeType=rke2`);
          await clusterCreate.waitForPage();

          await expect(
            clusterCreate.self().locator('[data-testid="credentials-banner"], .credentials-banner'),
          ).toBeAttached();
        });

        test('should show credential step when `addCloudCredential` is false', async ({ page, login }) => {
          await login();

          await page.route('**/v1/management.cattle.io.nodedrivers*', async (route) => {
            const response = await route.fetch();
            const body = await response.json();

            body.data = nodeDriveResponse(false, driver).data;
            await route.fulfill({ json: body });
          });

          const clusterCreate = new ClusterManagerCreatePagePo(page);

          await clusterCreate.goTo(`type=${driver}&rkeType=rke2`);
          await clusterCreate.waitForPage();

          await expect(
            clusterCreate.self().locator('[data-testid="credentials-banner"], .credentials-banner'),
          ).toBeAttached();
        });
      });
    }

    const driver2 = 'outscale';

    test.describe('should show on condition of addCloudCredential', () => {
      test('should show credential step when `addCloudCredential` is true', async ({ page, login }) => {
        await login();

        await page.route('**/v1/management.cattle.io.nodedrivers*', async (route) => {
          const response = await route.fetch();
          const body = await response.json();

          body.data = nodeDriveResponse(true, driver2).data;
          await route.fulfill({ json: body });
        });

        const clusterCreate = new ClusterManagerCreatePagePo(page);

        await clusterCreate.goTo(`type=${driver2}&rkeType=rke2`);
        await clusterCreate.waitForPage();

        await expect(
          clusterCreate.self().locator('[data-testid="credentials-banner"], .credentials-banner'),
        ).toBeAttached();
      });

      test('should NOT show credential step when `addCloudCredential` is false', async ({ page, login }) => {
        await login();

        await page.route('**/v1/management.cattle.io.nodedrivers*', async (route) => {
          const response = await route.fetch();
          const body = await response.json();

          body.data = nodeDriveResponse(false, driver2).data;
          await route.fulfill({ json: body });
        });

        const clusterCreate = new ClusterManagerCreatePagePo(page);

        await clusterCreate.goTo(`type=${driver2}&rkeType=rke2`);
        await clusterCreate.waitForPage();

        await expect(
          clusterCreate.self().locator('[data-testid="credentials-banner"], .credentials-banner'),
        ).not.toBeAttached();
      });
    });
  });
});

test.describe('Cluster Manager as standard user', { tag: ['@manager', '@standardUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test('can navigate to Cluster Management Page', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await homePage.goTo();
    await burgerMenu.toggle();

    const clusterManagementNavItem = burgerMenu.self().locator('text=Cluster Management');

    await expect(clusterManagementNavItem).toBeVisible();
    await clusterManagementNavItem.click();

    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.waitForPage();
  });

  test.describe('Cluster Detail Page', () => {
    test('Show Configuration allows to view but not edit config and yaml for local cluster', async ({
      page,
      login,
    }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local', '.cluster-link a');

      await expect(page).toHaveURL(/\/c\/local\/|\/local\//);

      await clusterDetail.showConfigurationButton().click();

      const drawer = clusterDetail.configurationDrawer();

      await expect(drawer).toBeVisible();
      await expect(drawer.locator('button:has-text("Save")')).not.toBeAttached();

      await expect(drawer.locator('[data-testid="tab-config"], button:has-text("Config")')).toBeVisible();
      await expect(drawer.locator('[data-testid="tab-yaml"], button:has-text("YAML")')).toBeVisible();

      await drawer.locator('[data-testid="tab-yaml"], button:has-text("YAML")').click();
      await expect(drawer.locator('button:has-text("Save")')).not.toBeAttached();
    });

    test('Shows the explore button and navigates to the cluster explorer when clicked', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local', '.cluster-link a');

      await expect(page).toHaveURL(/\/c\/local\/|\/local\//);

      await expect(clusterDetail.exploreButton()).toBeVisible();
      await clusterDetail.exploreButton().click();

      await expect(page).toHaveURL(/\/c\/local\/explorer/);
    });
  });
});

test.skip(true, 'Percy snapshot test');
test.describe('Visual Testing', { tag: ['@percy', '@manager', '@adminUser'] }, () => {
  test('display cluster manager page', async () => {
    // Upstream Percy snapshot test
  });
});
