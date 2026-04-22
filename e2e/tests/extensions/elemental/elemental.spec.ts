import { test, expect } from '@/support/fixtures/index';
import ExtensionsPagePo from '@/e2e/po/pages/extensions.po';
import ElementalPo from '@/e2e/po/extensions/elemental/elemental.utils';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';

import * as jsyaml from 'js-yaml';
import { SHORT_TIMEOUT_OPT } from '@/support/utils/timeouts';

const EXTENSION_NAME = 'elemental';
const EXTENSION_VERSION = '3.0.1';
const EXTENSION_REPO = 'https://github.com/rancher/elemental-ui';
const EXTENSION_BRANCH = 'gh-pages';
const EXTENSION_CLUSTER_REPO_NAME = 'elemental-ui-extension';

const REG_ENDPOINT_NAME = 'reg-endpoint-1';
const REG_ENDPOINT_DEVICE_PATH = '/dev/nvme0n123';

const MACHINE_INV_NAME = 'machine-inventory-1';

const ELEMENTAL_CLUSTER_NAME = 'elemental-cluster-1';
const ELEMENTAL_CLUSTER_BANNER_TEXT = 'Matches all 1 existing Inventory of Machines';
const ELEMENTAL_CLUSTER_MACHINE_CONFIG_REF = 'MachineInventorySelectorTemplate';

const UPDATE_GROUP_NAME = 'update-group-1';
const UPDATE_GROUP_IMAGE_PATH = 'some/path';

test.describe('Extensions Compatibility spec', { tag: ['@elemental', '@adminUser'] }, () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('add extension repository', async ({ page, rancherApi }) => {
    const extensionsPo = new ExtensionsPagePo(page);

    await extensionsPo.addExtensionsRepositoryDirectLink(
      EXTENSION_REPO,
      EXTENSION_BRANCH,
      EXTENSION_CLUSTER_REPO_NAME,
      true,
    );
    // Wait for the repo index to be downloaded before proceeding
    await rancherApi.waitForRepositoryDownload('v1', 'catalog.cattle.io.clusterrepos', EXTENSION_CLUSTER_REPO_NAME, 30);
  });

  test('Should install an extension', async ({ page }) => {
    const extensionsPo = new ExtensionsPagePo(page);

    await extensionsPo.goTo();

    // Check if "Installed" tab exists and extension is already there
    const hasInstalledTab = await extensionsPo.checkForExtensionTab('installed');

    if (hasInstalledTab) {
      await extensionsPo.extensionTabInstalledClick();
      const alreadyInstalled = await extensionsPo.checkForExtensionCardWithName(EXTENSION_NAME);

      if (alreadyInstalled) {
        // Already installed — verify it shows in the installed tab
        await extensionsPo.extensionCardClick(EXTENSION_NAME);
        await expect(extensionsPo.extensionDetailsTitle()).toContainText(EXTENSION_NAME);
        await extensionsPo.extensionDetailsCloseClick();

        return;
      }
    }

    await extensionsPo.extensionTabAvailableClick();

    // Check if elemental card exists in available tab — repo may not have compatible version
    const cardAvailable = await extensionsPo.checkForExtensionCardWithName(EXTENSION_NAME);

    if (!cardAvailable) {
      test.skip(true, 'Elemental extension not available — repo may not have compatible version for this Rancher');

      return;
    }

    // click on install button on card
    await extensionsPo.extensionCardInstallClick(EXTENSION_NAME);
    await extensionsPo.installModal().checkVisible();

    // select version and click install
    await extensionsPo.installModal().selectVersionLabel(EXTENSION_VERSION);
    await extensionsPo.installModal().installButton().click();

    // check the extension reload banner and reload the page
    await expect(extensionsPo.extensionReloadBanner()).toBeVisible({ timeout: 30000 });
    await extensionsPo.extensionReloadClick();

    // make sure extension card is in the installed tab
    await extensionsPo.extensionTabInstalledClick();
    await extensionsPo.extensionCardClick(EXTENSION_NAME);
    await expect(extensionsPo.extensionDetailsTitle()).toContainText(EXTENSION_NAME);
    await extensionsPo.extensionDetailsCloseClick();
  });

  test('Should setup all of the needed backend parts', async ({ page }) => {
    const elementalPo = new ElementalPo(page);
    const namespaceFilter = new NamespaceFilterPo(page);

    await elementalPo.dashboard().goTo();

    // Wait for either the elemental title or the error page to appear
    await page
      .waitForSelector('[data-testid="elemental-main-title"], .main-layout.error, .fail-whale', SHORT_TIMEOUT_OPT)
      .catch(() => {});

    // If the elemental extension is not installed, the route will hit fail-whale (404)
    const isFailWhale = await elementalPo.dashboard().isFailWhaleVisible();

    if (isFailWhale) {
      test.skip(true, 'Elemental UI extension is not installed — run "Should install an extension" first');

      return;
    }

    await elementalPo.dashboard().waitForTitle();

    // Check if operator is already installed — if the install button is not visible, operator is set up
    const installBtn = elementalPo.dashboard().chartsInstallButton();
    const operatorNeedsInstall = await installBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!operatorNeedsInstall) {
      // Operator already installed — just verify the dashboard title
      await expect(elementalPo.dashboard().mainTitle()).toContainText('OS Management Dashboard');

      return;
    }

    // Set up waitForResponse BEFORE the action that triggers it
    const installResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('v1/catalog.cattle.io.clusterrepos/rancher-charts') &&
        resp.url().includes('action=install') &&
        resp.request().method() === 'POST',
    );

    await installBtn.click();
    await elementalPo.chartInstallPage().waitForChartPage('rancher-charts', 'elemental');

    // change the namespace picker
    await namespaceFilter.toggle();
    await namespaceFilter.clickOptionByLabel('All Namespaces');
    await namespaceFilter.closeDropdown();

    await elementalPo.chartInstallPage().nextPage();
    await elementalPo.chartInstallPage().installChart();
    await elementalPo
      .appsPage()
      .waitForInstallCloseTerminal(installResponsePromise, ['elemental-operator-crds', 'elemental-operator']);

    await elementalPo.dashboard().goTo();
    await expect(elementalPo.dashboard().mainTitle()).toContainText('OS Management Dashboard');
  });

  test('Should create an Elemental registration endpoint', async ({ page, rancherApi }) => {
    const elementalPo = new ElementalPo(page);

    // Check if elemental CRDs exist (operator must be installed)
    const crdCheck = await rancherApi.getRancherResource(
      'v1',
      'elemental.cattle.io.machineregistrations',
      undefined,
      0,
    );

    if (crdCheck.status === 404) {
      test.skip(true, 'Elemental operator CRDs not installed — requires elemental-operator');

      return;
    }

    // Check if resource already exists via API — if so, verify and skip creation
    const existing = await rancherApi.getRancherResource(
      'v1',
      'elemental.cattle.io.machineregistrations',
      `fleet-default/${REG_ENDPOINT_NAME}`,
      0,
    );

    if (existing.status === 200) {
      expect(existing.body.metadata).toHaveProperty('name', REG_ENDPOINT_NAME);

      return;
    }

    await elementalPo.dashboard().goTo();
    await elementalPo.dashboard().productNav().navToSideMenuEntryByLabel('Registration Endpoints');

    await elementalPo.genericResourceList().masthead().create();
    await elementalPo.genericNameNsDescription().name().set(REG_ENDPOINT_NAME);

    const yamlValue = await elementalPo.genericCodeMirror().value();
    const json: any = jsyaml.load(yamlValue);

    json.config.elemental.install.device = REG_ENDPOINT_DEVICE_PATH;
    await elementalPo.genericCodeMirror().set(jsyaml.dump(json));

    // Set up waitForResponse BEFORE clicking save
    const machineRegPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('v1/elemental.cattle.io.machineregistrations/fleet-default') &&
        resp.request().method() === 'POST',
      SHORT_TIMEOUT_OPT,
    );

    await elementalPo.genericResourceDetail().cruResource().saveOrCreate().click();

    const response = await machineRegPromise;

    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(body.metadata).toHaveProperty('name', REG_ENDPOINT_NAME);
    expect(body.spec.config.elemental.install).toHaveProperty('device', REG_ENDPOINT_DEVICE_PATH);
  });

  test('Should create an Elemental resource via YAML (Inventory of Machines)', async ({
    page,
    request,
    rancherApi,
  }) => {
    const elementalPo = new ElementalPo(page);

    // Check if elemental CRDs exist (operator must be installed)
    const crdCheck = await rancherApi.getRancherResource('v1', 'elemental.cattle.io.machineinventories', undefined, 0);

    if (crdCheck.status === 404) {
      test.skip(true, 'Elemental operator CRDs not installed — requires elemental-operator');

      return;
    }

    // Check if resource already exists via API
    const existing = await rancherApi.getRancherResource(
      'v1',
      'elemental.cattle.io.machineinventories',
      `fleet-default/${MACHINE_INV_NAME}`,
      0,
    );

    if (existing.status === 200) {
      expect(existing.body.metadata).toHaveProperty('name', MACHINE_INV_NAME);

      return;
    }

    const maxPollingRetries = 36;

    await elementalPo.dashboard().goTo();
    await elementalPo.dashboard().productNav().navToSideMenuEntryByLabel('Inventory of Machines');

    await elementalPo.genericResourceList().masthead().createYaml();

    // Poll for schemaDefinition to become available
    for (let i = 0; i < maxPollingRetries; i++) {
      const resp = await request.get('v1/schemaDefinitions/elemental.cattle.io.machineinventory', {
        failOnStatusCode: false,
      });

      if (resp.status() === 200) {
        break;
      }
      if (i === maxPollingRetries - 1) {
        throw new Error('schemaDefinition polling failed');
      }
      // Unavoidable polling delay — waiting for server-side schema registration
      await page.waitForTimeout(5000);
    }

    const yamlValue = await elementalPo.genericResourceDetail().resourceYaml().codeMirror().value();
    const json: any = jsyaml.load(yamlValue);

    json.metadata.name = MACHINE_INV_NAME;
    await elementalPo.genericResourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));
    await elementalPo.genericResourceDetail().resourceYaml().saveOrCreate().click();

    await elementalPo.genericPage('/elemental/c/_/elemental.cattle.io.machineinventory').waitForPage();
    await expect(
      elementalPo.genericResourceList().resourceTable().sortableTable().rowWithName(MACHINE_INV_NAME).column(2),
    ).toContainText(MACHINE_INV_NAME);
  });

  test('Should create an Elemental cluster, targeting all of the inventory of machines', async ({
    page,
    rancherApi,
  }) => {
    const elementalPo = new ElementalPo(page);

    // Check if elemental CRDs exist (operator must be installed)
    const crdCheck = await rancherApi.getRancherResource('v1', 'elemental.cattle.io.machineinventories', undefined, 0);

    if (crdCheck.status === 404) {
      test.skip(true, 'Elemental operator CRDs not installed — requires elemental-operator');

      return;
    }

    // Check if cluster already exists via API
    const existing = await rancherApi.getRancherResource(
      'v1',
      'provisioning.cattle.io.clusters',
      `fleet-default/${ELEMENTAL_CLUSTER_NAME}`,
      0,
    );

    if (existing.status === 200) {
      expect(existing.body.metadata).toHaveProperty('name', ELEMENTAL_CLUSTER_NAME);

      return;
    }

    await elementalPo.dashboard().goTo();
    await elementalPo.dashboard().createElementalCluster();

    await elementalPo.genericNameNsDescription().name().set(ELEMENTAL_CLUSTER_NAME);
    await expect(elementalPo.elementalClusterSelectorTemplateBanner().banner()).toContainText(
      ELEMENTAL_CLUSTER_BANNER_TEXT,
    );

    // Set up waitForResponse BEFORE clicking create
    const clusterCreationPromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
      SHORT_TIMEOUT_OPT,
    );

    await elementalPo.rke2CreateSaveButton().click();

    const response = await clusterCreationPromise;

    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(body.metadata).toHaveProperty('name', ELEMENTAL_CLUSTER_NAME);
    expect(body.spec.rkeConfig.machinePools[0].machineConfigRef).toHaveProperty(
      'kind',
      ELEMENTAL_CLUSTER_MACHINE_CONFIG_REF,
    );
  });

  test('Should create an Upgrade Group', async ({ page, rancherApi }) => {
    const elementalPo = new ElementalPo(page);

    // Check if elemental CRDs exist (operator must be installed)
    const crdCheck = await rancherApi.getRancherResource('v1', 'elemental.cattle.io.managedosimages', undefined, 0);

    if (crdCheck.status === 404) {
      test.skip(true, 'Elemental operator CRDs not installed — requires elemental-operator');

      return;
    }

    // Check if update group already exists via API
    const existing = await rancherApi.getRancherResource(
      'v1',
      'elemental.cattle.io.managedosimages',
      `fleet-default/${UPDATE_GROUP_NAME}`,
      0,
    );

    if (existing.status === 200) {
      expect(existing.body.metadata).toHaveProperty('name', UPDATE_GROUP_NAME);

      return;
    }

    await elementalPo.dashboard().goTo();
    await elementalPo.dashboard().createUpdateGroupClick();

    await elementalPo.genericNameNsDescription().name().set(UPDATE_GROUP_NAME);
    await elementalPo.updateGroupTargetClustersSelect().toggle();
    await elementalPo.updateGroupTargetClustersSelect().clickOptionWithLabel(ELEMENTAL_CLUSTER_NAME);
    await elementalPo.updateGroupImageOption().set(1);

    const imagePathInput = elementalPo.imagePathInput();

    await imagePathInput.set(UPDATE_GROUP_IMAGE_PATH);

    // Set up waitForResponse BEFORE clicking save
    const updateGroupPromise = page.waitForResponse(
      (resp) => resp.url().includes('v1/elemental.cattle.io.managedosimages') && resp.request().method() === 'POST',
      SHORT_TIMEOUT_OPT,
    );

    await elementalPo.genericResourceDetail().cruResource().saveOrCreate().click();

    const response = await updateGroupPromise;

    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(body.metadata).toHaveProperty('name', UPDATE_GROUP_NAME);
    expect(body.spec.clusterTargets[0]).toHaveProperty('clusterName', ELEMENTAL_CLUSTER_NAME);
    expect(body.spec).toHaveProperty('osImage', UPDATE_GROUP_IMAGE_PATH);
  });

  test('Should uninstall the extension', async ({ page }) => {
    const extensionsPo = new ExtensionsPagePo(page);

    await extensionsPo.goTo();

    // If there is no "Installed" tab, the extension is not installed — skip
    const hasInstalledTab = await extensionsPo.checkForExtensionTab('installed');

    if (!hasInstalledTab) {
      test.skip(true, 'Extension is not installed — nothing to uninstall');

      return;
    }

    await extensionsPo.extensionTabInstalledClick();

    // click on uninstall button on card
    await extensionsPo.extensionCardUninstallClick(EXTENSION_NAME);
    await expect(extensionsPo.extensionUninstallModal()).toBeVisible();
    await extensionsPo.uninstallModalUninstallClick();
    await expect(extensionsPo.extensionReloadBanner()).toBeVisible();

    // check the extension reload banner and reload the page
    await expect(extensionsPo.extensionReloadBanner()).toBeVisible();
    await extensionsPo.extensionReloadClick();

    // make sure extension card is in the available tab
    await extensionsPo.extensionTabAvailableClick();
    await extensionsPo.extensionCardClick(EXTENSION_NAME);
    await expect(extensionsPo.extensionDetailsTitle()).toContainText(EXTENSION_NAME);
  });
});
