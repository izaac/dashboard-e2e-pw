import { test, expect } from '@/support/fixtures/index';
import ExtensionsPagePo from '@/e2e/po/pages/extensions.po';
import ElementalPo from '@/e2e/po/extensions/elemental/elemental.utils';
import { NamespaceFilterPo } from '@/e2e/po/components/namespace-filter.po';
import { buildElementalClusterMock } from '@/e2e/blueprints/extensions/elemental-cluster-mock';

import * as jsyaml from 'js-yaml';
import { SHORT_TIMEOUT_OPT, LONG, PROVISIONING, EXTENSION_OPS, BRIEF } from '@/support/timeouts';

const EXTENSION_NAME = 'elemental';
const EXTENSION_VERSION = '3.0.1';
const EXTENSION_REPO = 'https://github.com/rancher/elemental-ui';
const EXTENSION_BRANCH = 'gh-pages';
const EXTENSION_REPO_NAME = 'elemental-ui-extension';
const EXTENSION_NAMESPACE = 'cattle-ui-plugin-system';

// The `elemental` chart in rancher-charts has annotations that override release names:
// the chart itself releases as `elemental-operator`, and its auto-install CRD chart
// (`elemental-crd`) releases as `elemental-operator-crds`. Pass these explicitly so the
// API install matches what the dashboard UI install creates.
const OPERATOR_REPO = 'rancher-charts';
const OPERATOR_NAMESPACE = 'cattle-elemental-system';
const OPERATOR_CHART = 'elemental';
const OPERATOR_CRD_CHART = 'elemental-crd';
const OPERATOR_RELEASE = 'elemental-operator';
const OPERATOR_CRD_RELEASE = 'elemental-operator-crds';

const REG_ENDPOINT_DEVICE_PATH = '/dev/nvme0n123';
const ELEMENTAL_CLUSTER_BANNER_TEXT = 'Matches all 1 existing Inventory of Machines';
const ELEMENTAL_CLUSTER_MACHINE_CONFIG_REF = 'MachineInventorySelectorTemplate';
const UPDATE_GROUP_IMAGE_PATH = 'some/path';

test.describe('Elemental Extension', { tag: ['@elemental', '@adminUser'] }, () => {
  // Serial: extension + operator + CRDs are installed/uninstalled across tests; finalizers on elemental.cattle.io CRs make parallel runs race the cleanup.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ login }) => {
    await login();
  });

  test.afterAll(async ({ rancherApi }) => {
    try {
      // best-effort cleanup — log failures so they surface in CI but don't abort the chain
      await rancherApi
        .ensureChartUninstalled(OPERATOR_NAMESPACE, OPERATOR_RELEASE, OPERATOR_CRD_RELEASE)
        .catch((err) => console.warn(`[elemental afterAll] operator uninstall failed: ${err?.message ?? err}`));
      // The elemental-crd chart's own resources (managedosversions, etc.) hold
      // finalizers that block CRD GC after uninstall. Without forceCleanStuckCRDs
      // the next install fails the chart's `validate-no-pending-deletions` hook.
      await rancherApi
        .forceCleanStuckCRDs('elemental.cattle.io')
        .catch((err) => console.warn(`[elemental afterAll] forceCleanStuckCRDs failed: ${err?.message ?? err}`));
      await rancherApi
        .ensureChartUninstalled(EXTENSION_NAMESPACE, EXTENSION_NAME)
        .catch((err) => console.warn(`[elemental afterAll] extension uninstall failed: ${err?.message ?? err}`));
    } finally {
      await rancherApi.deleteRancherResource('v1', 'catalog.cattle.io.clusterrepos', EXTENSION_REPO_NAME, false);
    }
  });

  test.describe('extension lifecycle', () => {
    test.beforeEach(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureClusterRepoAdded(EXTENSION_REPO_NAME, EXTENSION_REPO, EXTENSION_BRANCH);
      await rancherApi.ensureChartUninstalled(EXTENSION_NAMESPACE, EXTENSION_NAME);
    });

    test('can install elemental extension via UI', async ({ page }) => {
      test.setTimeout(PROVISIONING);

      const extensionsPo = new ExtensionsPagePo(page);

      await extensionsPo.goTo();
      await extensionsPo.extensionTabAvailableClick();

      await expect(
        extensionsPo.extensionCardTitle(EXTENSION_NAME),
        `Elemental extension '${EXTENSION_NAME}' not visible in Available tab — repo may be missing or incompatible`,
      ).toBeVisible({ timeout: LONG });

      await extensionsPo.extensionCardInstallClick(EXTENSION_NAME);
      await expect(extensionsPo.installModal().self()).toBeVisible();
      await extensionsPo.installModal().selectVersionLabel(EXTENSION_VERSION);
      await extensionsPo.installModal().installButton().click();

      await expect(extensionsPo.extensionReloadBanner()).toBeVisible({ timeout: LONG });
      await extensionsPo.extensionReloadClick();

      await extensionsPo.extensionTabInstalledClick();
      await extensionsPo.extensionCardClick(EXTENSION_NAME);
      await expect(extensionsPo.extensionDetailsTitle()).toContainText(EXTENSION_NAME);
      await extensionsPo.extensionDetailsCloseClick();
    });
  });

  test.describe('operator install', () => {
    test.beforeEach(async ({ page, rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureClusterRepoAdded(EXTENSION_REPO_NAME, EXTENSION_REPO, EXTENSION_BRANCH);
      await rancherApi.ensureChartInstalled(EXTENSION_REPO_NAME, EXTENSION_NAMESPACE, EXTENSION_NAME);
      await rancherApi.ensureChartUninstalled(OPERATOR_NAMESPACE, OPERATOR_RELEASE, OPERATOR_CRD_RELEASE);
      // Force-clear stuck elemental CRDs before re-install — see afterAll comment.
      await rancherApi.forceCleanStuckCRDs('elemental.cattle.io');
      // Reload so the freshly-installed UI extension actually loads in the SPA.
      await page.reload();
    });

    test('can install elemental operator via UI', async ({ page }) => {
      test.setTimeout(PROVISIONING);

      const elementalPo = new ElementalPo(page);
      const namespaceFilter = new NamespaceFilterPo(page);

      await elementalPo.dashboard().goTo();
      await elementalPo.dashboard().waitForReady();

      await expect(
        elementalPo.dashboard().isFailWhaleVisible(),
        'Elemental dashboard failed to load — extension UI did not register',
      ).resolves.toBe(false);

      const installBtn = elementalPo.dashboard().chartsInstallButton();

      await expect(
        installBtn,
        'Operator install button missing — beforeEach should have left a clean slate',
      ).toBeVisible({
        timeout: LONG,
      });

      const installResponsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes(`v1/catalog.cattle.io.clusterrepos/${OPERATOR_REPO}`) &&
          resp.url().includes('action=install') &&
          resp.request().method() === 'POST',
      );

      await installBtn.click();
      await elementalPo.chartInstallPage().waitForChartPage(OPERATOR_REPO, OPERATOR_CHART);

      await namespaceFilter.toggle();
      await namespaceFilter.optionByLabel('All Namespaces').click();
      await namespaceFilter.closeChevron().click();

      await elementalPo.chartInstallPage().nextPage();
      await elementalPo.chartInstallPage().installChart();
      await elementalPo
        .appsPage()
        .waitForInstallCloseTerminal(installResponsePromise, [OPERATOR_CRD_RELEASE, OPERATOR_RELEASE]);

      await elementalPo.dashboard().goTo();
      await expect(elementalPo.dashboard().mainTitle()).toContainText('OS Management Dashboard');
    });
  });

  test.describe('CR management', () => {
    let regEndpointName: string;
    let machineInvName: string;
    let elementalClusterName: string;
    let updateGroupName: string;

    test.beforeAll(async ({ rancherApi }) => {
      regEndpointName = rancherApi.createE2EResourceName('reg-endpoint');
      machineInvName = rancherApi.createE2EResourceName('machine-inv');
      elementalClusterName = rancherApi.createE2EResourceName('elemental-cluster');
      updateGroupName = rancherApi.createE2EResourceName('update-group');
    });

    test.beforeEach(async ({ page, rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureClusterRepoAdded(EXTENSION_REPO_NAME, EXTENSION_REPO, EXTENSION_BRANCH);
      await rancherApi.ensureChartInstalled(EXTENSION_REPO_NAME, EXTENSION_NAMESPACE, EXTENSION_NAME);
      // Force-clear stuck elemental CRDs from a prior run before installing the operator.
      await rancherApi.forceCleanStuckCRDs('elemental.cattle.io');
      await rancherApi.ensureChartInstalled(
        OPERATOR_REPO,
        OPERATOR_NAMESPACE,
        OPERATOR_CHART,
        OPERATOR_CRD_CHART,
        60,
        5000,
        OPERATOR_RELEASE,
        OPERATOR_CRD_RELEASE,
      );
      await page.reload();
    });

    test.afterAll(async ({ rancherApi }) => {
      const resources = [
        { type: 'elemental.cattle.io.managedosimages', id: `fleet-default/${updateGroupName}` },
        { type: 'provisioning.cattle.io.clusters', id: `fleet-default/${elementalClusterName}` },
        { type: 'elemental.cattle.io.machineinventories', id: `fleet-default/${machineInvName}` },
        { type: 'elemental.cattle.io.machineregistrations', id: `fleet-default/${regEndpointName}` },
      ];

      for (const { type, id } of resources) {
        await rancherApi
          .deleteRancherResource('v1', type, id, false)
          .catch((err) => console.warn(`[elemental afterAll] cleanup ${type}/${id} failed: ${err?.message ?? err}`));
      }
    });

    test('can create a registration endpoint', async ({ page, rancherApi }) => {
      const elementalPo = new ElementalPo(page);

      await elementalPo.dashboard().goTo();
      await elementalPo.dashboard().productNav().navToSideMenuEntryByLabel('Registration Endpoints');

      await elementalPo.genericResourceList().masthead().create();
      await elementalPo.genericNameNsDescription().name().set(regEndpointName);

      const yamlValue = await elementalPo.genericCodeMirror().value();
      const json: any = jsyaml.load(yamlValue);

      json.config.elemental.install.device = REG_ENDPOINT_DEVICE_PATH;
      await elementalPo.genericCodeMirror().set(jsyaml.dump(json));

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

      expect(body.metadata).toHaveProperty('name', regEndpointName);
      expect(body.spec.config.elemental.install).toHaveProperty('device', REG_ENDPOINT_DEVICE_PATH);

      // Verify CRD exists via API (idempotent precondition for downstream tests)
      const crdCheck = await rancherApi.getRancherResource(
        'v1',
        'elemental.cattle.io.machineregistrations',
        undefined,
        0,
      );

      expect(crdCheck.status, 'Elemental machineregistrations CRD should be registered').not.toBe(404);
    });

    test('can create a machine inventory via YAML', async ({ page, request }) => {
      const elementalPo = new ElementalPo(page);

      await elementalPo.dashboard().goTo();
      await elementalPo.dashboard().productNav().navToSideMenuEntryByLabel('Inventory of Machines');

      await elementalPo.genericResourceList().masthead().createYaml();

      // Poll for schemaDefinition: the steve schema for newly-registered CRDs is
      // populated lazily; without this wait the YAML editor renders empty.
      await expect
        .poll(
          async () => {
            const resp = await request.get('/v1/schemaDefinitions/elemental.cattle.io.machineinventory', {
              failOnStatusCode: false,
            });

            return resp.status();
          },
          { timeout: EXTENSION_OPS, intervals: [BRIEF] },
        )
        .toBe(200);

      const yamlValue = await elementalPo.genericResourceDetail().resourceYaml().codeMirror().value();
      const json: any = jsyaml.load(yamlValue);

      json.metadata.name = machineInvName;
      await elementalPo.genericResourceDetail().resourceYaml().codeMirror().set(jsyaml.dump(json));
      await elementalPo.genericResourceDetail().resourceYaml().saveOrCreate().click();

      await elementalPo.genericPage('/elemental/c/_/elemental.cattle.io.machineinventory').waitForPage();
      await expect(
        elementalPo.genericResourceList().resourceTable().sortableTable().rowWithName(machineInvName).column(2),
      ).toContainText(machineInvName);
    });

    test('can create an elemental cluster targeting all inventory machines', async ({ page }) => {
      const elementalPo = new ElementalPo(page);

      await elementalPo.dashboard().goTo();
      await elementalPo.dashboard().createElementalCluster();

      await elementalPo.genericNameNsDescription().name().set(elementalClusterName);
      await expect(elementalPo.elementalClusterSelectorTemplateBanner().banner()).toContainText(
        ELEMENTAL_CLUSTER_BANNER_TEXT,
      );

      const clusterCreationPromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );

      await elementalPo.rke2CreateSaveButton().click();

      const response = await clusterCreationPromise;

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.metadata).toHaveProperty('name', elementalClusterName);
      expect(body.spec.rkeConfig.machinePools[0].machineConfigRef).toHaveProperty(
        'kind',
        ELEMENTAL_CLUSTER_MACHINE_CONFIG_REF,
      );
    });

    test('can create an upgrade group targeting the elemental cluster', async ({ page }) => {
      const elementalPo = new ElementalPo(page);

      // Inject a mocked cluster into the target-clusters dropdown so this test
      // can run atomically. The provisioning.cattle.io webhook rejects bare CR
      // creates, so we mock the list response at the UI layer instead — the
      // upstream cypress pattern (see blueprints/manager/v2prov-capi-cluster-mocks.ts).
      // When the cluster-create test ran first in the chain, its real CR is
      // included in the upstream response; the mock just appends our stub if
      // it isn't already there.
      await page.route(/\/v1\/provisioning\.cattle\.io\.clusters/, async (route, request) => {
        if (request.method() !== 'GET') {
          await route.continue();

          return;
        }

        const response = await route.fetch();
        const body = await response.json().catch(() => ({}));
        const data = Array.isArray(body?.data) ? body.data : [];
        const alreadyPresent = data.some(
          (c: { metadata?: { name?: string } }) => c.metadata?.name === elementalClusterName,
        );

        if (!alreadyPresent) {
          data.push(buildElementalClusterMock(elementalClusterName));
        }

        await route.fulfill({
          status: response.status(),
          headers: response.headers(),
          body: JSON.stringify({ ...body, data }),
        });
      });

      await elementalPo.dashboard().goTo();
      await elementalPo.dashboard().createUpdateGroupClick();

      await elementalPo.genericNameNsDescription().name().set(updateGroupName);
      await elementalPo.updateGroupTargetClustersSelect().dropdown().click();
      await elementalPo.updateGroupTargetClustersSelect().clickOptionWithLabel(elementalClusterName);
      await elementalPo.updateGroupImageOption().set(1);

      const imagePathInput = elementalPo.imagePathInput();

      await imagePathInput.set(UPDATE_GROUP_IMAGE_PATH);

      const updateGroupPromise = page.waitForResponse(
        (resp) => resp.url().includes('v1/elemental.cattle.io.managedosimages') && resp.request().method() === 'POST',
        SHORT_TIMEOUT_OPT,
      );

      await elementalPo.genericResourceDetail().cruResource().saveOrCreate().click();

      const response = await updateGroupPromise;

      expect(response.status()).toBe(201);
      const body = await response.json();

      expect(body.metadata).toHaveProperty('name', updateGroupName);
      expect(body.spec.clusterTargets[0]).toHaveProperty('clusterName', elementalClusterName);
      expect(body.spec).toHaveProperty('osImage', UPDATE_GROUP_IMAGE_PATH);
    });
  });

  test.describe('extension uninstall', () => {
    test.beforeEach(async ({ rancherApi }) => {
      test.setTimeout(PROVISIONING);
      await rancherApi.ensureClusterRepoAdded(EXTENSION_REPO_NAME, EXTENSION_REPO, EXTENSION_BRANCH);
      await rancherApi.ensureChartInstalled(EXTENSION_REPO_NAME, EXTENSION_NAMESPACE, EXTENSION_NAME);
    });

    test('can uninstall elemental extension via UI', async ({ page }) => {
      const extensionsPo = new ExtensionsPagePo(page);

      await extensionsPo.goTo();

      await expect(
        extensionsPo.checkForExtensionTab('installed'),
        'Installed tab missing — extension install (beforeEach) must have failed',
      ).resolves.toBe(true);

      await extensionsPo.extensionTabInstalledClick();

      await extensionsPo.extensionCardUninstallClick(EXTENSION_NAME);
      await expect(extensionsPo.extensionUninstallModal()).toBeVisible();
      await extensionsPo.uninstallModalUninstallClick();
      await expect(extensionsPo.extensionReloadBanner()).toBeVisible();
      await extensionsPo.extensionReloadClick();

      await extensionsPo.extensionTabAvailableClick();
      await extensionsPo.extensionCardClick(EXTENSION_NAME);
      await expect(extensionsPo.extensionDetailsTitle()).toContainText(EXTENSION_NAME);
    });
  });
});
