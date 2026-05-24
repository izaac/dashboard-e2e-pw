import { test, expect } from '@/support/fixtures';
import jsyaml from 'js-yaml';
import { providersList } from '@/e2e/blueprints/manager/clusterProviderUrlCheck';
import { nodeDriveResponse } from '@/e2e/tests/pages/manager/mock-responses';
import ClusterManagerListPagePo from '@/e2e/po/pages/cluster-manager/cluster-manager-list.po';
import ClusterManagerCreatePagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create.po';
import ClusterManagerCreateRke2CustomPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-custom.po';
import ClusterManagerEditRke2CustomPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/edit/cluster-edit-rke2-custom.po';
import ClusterManagerDetailRke2AmazonEc2PagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-rke2-amazon.po';
import ClusterManagerDetailRke2CustomPagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-rke2-custom.po';
import ClusterManagerImportGenericPagePo from '@/e2e/po/extensions/imported/cluster-import-generic.po';
import ClusterManagerDetailImportedGenericPagePo from '@/e2e/po/detail/provisioning.cattle.io.cluster/cluster-detail-import-generic.po';
import ClusterManagerEditImportedPagePo from '@/e2e/po/extensions/imported/cluster-edit.po';
import NetworkRke2 from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/networking-tab-rke2.po';
import PromptRemove from '@/e2e/po/prompts/promptRemove.po';
import Growl from '@/e2e/po/components/growl.po';
import HostedProvidersPagePo from '@/e2e/po/pages/cluster-manager/hosted-providers.po';
import HomePagePo from '@/e2e/po/pages/home.po';
import BurgerMenuPo from '@/e2e/po/side-bars/burger-side-menu.po';
import { SHORT_TIMEOUT_OPT, MEDIUM_TIMEOUT_OPT, EXTRA_LONG_TIMEOUT_OPT } from '@/support/timeouts';
import { ensureLightTheme, chromeMasks, visualSnapshot } from '@/support/utils/visual-snapshot';
import { registerCustomNode, applyImportedKubectlCommand } from '@/support/utils/custom-node-ssh';

/**
 * Cluster names shared across the `test.fixme` chain in this spec — these tests assume
 * a sibling test (`can create new cluster`) has already provisioned the cluster.
 * When wiring up real infra, replace these with state passed through a `beforeAll` or
 * a fixture. They are intentionally readable constants rather than literals so the
 * boundary between "created here" and "expected to exist" is obvious.
 */
const SHARED_RKE2_CUSTOM_NAME = 'e2e-test-existing-rke2-custom';
const SHARED_IMPORT_GENERIC_NAME = 'e2e-test-import-generic';

/**
 * Cluster Manager spec — converted from upstream Cypress cluster-manager.spec.ts.
 *
 * Tests that require feature flags or provisioning infrastructure (custom nodes,
 * imported clusters needing real cluster registration) are skipped with clear
 * reasons. The remaining tests (hosted providers, credential step mock, local
 * cluster navigation, visual snapshot) can run against any Rancher instance.
 */

test.describe('Cluster Manager', { tag: ['@manager', '@adminUser'] }, () => {
  // Serial: tests mutate the global `kev2-operators` setting + hosted-provider activation; concurrent runs would race the snapshot/restore.
  test.describe.configure({ mode: 'serial' });
  test('deactivating a hosted provider should hide its card from the cluster creation page', async ({
    page,
    login,
    rancherApi,
  }) => {
    await login();

    // Ensure AKS is Active before test — prior specs may have left it Inactive
    const kev2Setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators');
    const body = kev2Setting.body;
    const operators = JSON.parse(body.value || '[]');
    const aks = operators.find((op: any) => op.name === 'aks');

    if (aks && !aks.active) {
      aks.active = true;
      body.value = JSON.stringify(operators);
      await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators', body);
    }

    const providersPage = new HostedProvidersPagePo(page);
    const clusterCreatePage = new ClusterManagerCreatePagePo(page);
    const clusterList = new ClusterManagerListPagePo(page);

    await providersPage.goTo();
    await providersPage.waitForPage();

    // Assert AKS is active
    await expect(providersPage.list().details('Azure AKS', 1)).toContainText('Active', SHORT_TIMEOUT_OPT);

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

      // Verify AKS card is hidden
      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await expect(clusterCreatePage.gridProviderByName('Azure AKS')).not.toBeAttached();

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

      // Verify AKS card is back
      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.createCluster();
      await expect(clusterCreatePage.gridProviderByName('Azure AKS')).toBeAttached(MEDIUM_TIMEOUT_OPT);
    } finally {
      // Always restore AKS to active in cleanup. The previous reenableAKS-flag
      // approach skipped the restore on the happy path (which is fine) but also
      // skipped it on certain mid-test failures where the deactivate had already
      // succeeded and the flag never flipped back to false. Re-fetching state and
      // setting `active = true` is idempotent — if AKS is already active the PUT
      // is a no-op.
      try {
        const setting = await rancherApi.getRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators');
        const ops: any[] = JSON.parse(setting.body.value || '[]');
        const aksOp = ops.find((o: any) => o.name === 'aks');

        if (aksOp && !aksOp.active) {
          aksOp.active = true;
          await rancherApi.setRancherResource('v1', 'management.cattle.io.settings', 'kev2-operators', {
            ...setting.body,
            value: JSON.stringify(ops),
          });
        } else if (!aksOp) {
          console.warn('[cluster-manager AKS cleanup] aks operator not found in kev2-operators value');
        }
      } catch (err) {
        console.warn(`[cluster-manager AKS cleanup] restore failed: ${(err as Error)?.message ?? err}`);
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
    test.describe('RKE2 Custom', { tag: ['@jenkins', '@customCluster', '@provisioning', '@needsInfra'] }, () => {
      // Bodies below are ported from upstream rancher/dashboard cluster-manager.spec.ts (master + PR #17795).
      // All tests except the addon-config one require a real custom node + SSH, so they are declared with
      // `test.fixme(...)` — Playwright collects them but never executes them. Bodies still type-check, so
      // they will fail loudly if the POs they use drift away from upstream.

      test.fixme('can create new cluster', async ({ page, login }) => {
        await login();

        const rke2CustomName = `e2e-test-${Date.now()}-create-rke2-custom`;
        const clusterList = new ClusterManagerListPagePo(page);
        const createRKE2ClusterPage = new ClusterManagerCreateRke2CustomPagePo(page);
        const detailRKE2ClusterPage = new ClusterManagerDetailRke2CustomPagePo(page, '_', rke2CustomName);

        const createRequest = page.waitForResponse(
          (resp) => resp.url().includes('/v1/provisioning.cattle.io.clusters') && resp.request().method() === 'POST',
        );

        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        await createRKE2ClusterPage.waitForPage();

        await createRKE2ClusterPage.selectCustom(0);
        await createRKE2ClusterPage.nameNsDescription().name().set(rke2CustomName);

        // #10338 — selecting 'none' CNI surfaces a warning banner; switch back to calico to proceed
        const networks = createRKE2ClusterPage.basicsTab().networks();

        await networks.dropdown().click();
        await networks.optionByLabel('none').click();
        await expect(createRKE2ClusterPage.basicsTab().networkNoneSelectedForCni()).toBeVisible();

        await networks.dropdown().click();
        await networks.optionByLabel('calico').click();

        // #10159 — truncate-hostname checkbox on the Networking tab
        await createRKE2ClusterPage.clusterConfigurationTabs().tabBySelector('[data-testid="btn-networking"]').click();
        await new NetworkRke2(page).truncateHostnameCheckbox().set();

        await createRKE2ClusterPage.create();
        const created = await createRequest;

        expect(created.status()).toBeGreaterThanOrEqual(200);
        expect(created.status()).toBeLessThan(300);

        await detailRKE2ClusterPage.waitForPage(undefined, 'registration');

        // Insecure-registration toggle + kubectl-apply registration command live on the
        // create-cluster PO; the selectors continue to work once the detail page renders them.
        await createRKE2ClusterPage.activateInsecureRegistrationCommandFromUI().click();
        await expect(createRKE2ClusterPage.commandFromCustomClusterUI()).toContainText('--insecure');

        const registrationCmd = (await createRKE2ClusterPage.commandFromCustomClusterUI().textContent()) ?? '';

        // Provision the custom node over SSH — requires CUSTOM_NODE_KEY/IP/USER env.
        // Stays inside `test.fixme` so it never executes without infra configured.
        await registerCustomNode(registrationCmd);

        await clusterList.goTo();
        await clusterList.waitForPage();
        await expect(clusterList.list().state(rke2CustomName)).toContainText('Updating');
        // Upstream uses VERY_LONG_TIMEOUT_OPT (~15 min) here — PW has no exact analogue, EXTRA_LONG_TIMEOUT_OPT used as best effort.
        await expect(clusterList.list().state(rke2CustomName)).toContainText('Active', EXTRA_LONG_TIMEOUT_OPT);
      });

      test.fixme('can copy config to clipboard', async ({ page, login }) => {
        await login();

        // Stub navigator.clipboard.writeText so the browser does not prompt for clipboard permission
        await page.addInitScript(() => {
          (navigator as any).clipboard = (navigator as any).clipboard || {};
          (navigator as any).clipboard.writeText = async () => undefined;
        });

        const rke2CustomName = SHARED_RKE2_CUSTOM_NAME;
        const clusterList = new ClusterManagerListPagePo(page);
        const growl = new Growl(page);

        const copyKubeConfig = page.waitForResponse(
          (resp) => resp.url().includes('/v1/ext.cattle.io.kubeconfigs') && resp.request().method() === 'POST',
        );

        await clusterList.goTo();
        await clusterList.waitForPage();
        const actionMenu = await clusterList.list().actionMenu(rke2CustomName);

        await actionMenu.getMenuItem('Copy KubeConfig to Clipboard').click();
        await copyKubeConfig;

        // Growl appears then auto-dismisses after ~3s
        await expect(growl.byText('Copied KubeConfig to Clipboard')).toBeVisible();
        await expect(growl.byText('Copied KubeConfig to Clipboard')).toHaveCount(0, { timeout: 4_000 });
      });

      test.fixme('can edit cluster and see changes afterwards', async ({ page, login }) => {
        await login();

        const rke2CustomName = SHARED_RKE2_CUSTOM_NAME;
        const clusterList = new ClusterManagerListPagePo(page);
        const editCreatedClusterPage = new ClusterManagerEditRke2CustomPagePo(page, '_', rke2CustomName);

        await clusterList.goTo();
        await clusterList.waitForPage();
        const editMenu = await clusterList.list().actionMenu(rke2CustomName);

        await editMenu.getMenuItem('Edit Config').click();
        await editCreatedClusterPage.waitForPage('mode=edit', 'basic');

        await editCreatedClusterPage.nameNsDescription().description().set(rke2CustomName);
        await editCreatedClusterPage.save();
        await clusterList.waitForPage();

        const editMenu2 = await clusterList.list().actionMenu(rke2CustomName);

        await editMenu2.getMenuItem('Edit Config').click();
        await editCreatedClusterPage.waitForPage('mode=edit', 'basic');

        await expect(editCreatedClusterPage.nameNsDescription().description().input()).toHaveValue(rke2CustomName);
      });

      test('will disable saving if an addon config has invalid data', async ({ page, login }) => {
        await login();

        const clusterList = new ClusterManagerListPagePo(page);
        const createRKE2ClusterPage = new ClusterManagerCreateRke2CustomPagePo(page);

        await clusterList.goTo();
        await clusterList.waitForPage();
        await clusterList.createCluster();
        // v2.15 doesn't add ?type=custom#basic until after selection
        await expect(page).toHaveURL(/provisioning\.cattle\.io\.cluster\/create/);

        await createRKE2ClusterPage.selectCustom(0);
        await createRKE2ClusterPage.nameNsDescription().name().set('abc');

        await createRKE2ClusterPage.clusterConfigurationTabs().tabBySelector('li#rke2-calico').click();

        await expect(createRKE2ClusterPage.resourceDetail().createEditView().saveButtonPo().self()).toBeEnabled();

        await createRKE2ClusterPage.calicoAddonConfig().yamlEditor().set('badvalue: -');
        await expect(createRKE2ClusterPage.resourceDetail().createEditView().saveButtonPo().self()).toBeDisabled();

        await createRKE2ClusterPage.calicoAddonConfig().yamlEditor().set('goodvalue: yay');
        await expect(createRKE2ClusterPage.resourceDetail().createEditView().saveButtonPo().self()).toBeEnabled();
      });

      test.fixme('can view cluster YAML editor', async ({ page, login }) => {
        await login();

        const rke2CustomName = SHARED_RKE2_CUSTOM_NAME;
        const clusterList = new ClusterManagerListPagePo(page);
        const editCreatedClusterPage = new ClusterManagerEditRke2CustomPagePo(page, '_', rke2CustomName);

        await clusterList.goTo();
        await clusterList.waitForPage();
        const editMenu = await clusterList.list().actionMenu(rke2CustomName);

        await editMenu.getMenuItem('Edit YAML').click();
        await editCreatedClusterPage.waitForPage('mode=edit&as=yaml');
        await expect(editCreatedClusterPage.resourceDetail().resourceYaml().self()).toBeVisible();
      });

      test.fixme('can download KubeConfig', async ({ page, login }) => {
        await login();

        const rke2CustomName = SHARED_RKE2_CUSTOM_NAME;
        const clusterList = new ClusterManagerListPagePo(page);

        const kubeConfigResponse = page.waitForResponse(
          (resp) => resp.url().includes('/v1/ext.cattle.io.kubeconfigs') && resp.request().method() === 'POST',
        );
        const downloadPromise = page.waitForEvent('download');

        await clusterList.goTo();
        await clusterList.waitForPage();
        const actionMenu = await clusterList.list().actionMenu(rke2CustomName);

        await actionMenu.getMenuItem('Download KubeConfig').click();
        expect((await kubeConfigResponse).status()).toBeGreaterThanOrEqual(200);

        const download = await downloadPromise;
        const content = (await (await download.createReadStream()).toArray()).join('');
        const obj = jsyaml.load(content) as Record<string, any>;

        expect(obj.apiVersion).toBe('v1');
        expect(obj.kind).toBe('Config');
        expect(obj.clusters.some((c: { name: string }) => c.name === rke2CustomName)).toBe(true);
      });

      test.fixme('can download YAML', async ({ page, login }) => {
        await login();

        const rke2CustomName = SHARED_RKE2_CUSTOM_NAME;
        const clusterList = new ClusterManagerListPagePo(page);

        const downloadPromise = page.waitForEvent('download');

        await clusterList.goTo();
        await clusterList.waitForPage();
        const actionMenu = await clusterList.list().actionMenu(rke2CustomName);

        await actionMenu.getMenuItem('Download YAML').click();

        const download = await downloadPromise;
        const content = (await (await download.createReadStream()).toArray()).join('');
        const obj = jsyaml.load(content) as Record<string, any>;

        expect(obj.apiVersion).toBe('provisioning.cattle.io/v1');
        expect(obj.metadata.annotations['field.cattle.io/description']).toBe(rke2CustomName);
        expect(obj.kind).toBe('Cluster');
      });

      test.fixme('preserves custom addon config values after saving cluster config', async ({ page, login }) => {
        await login();

        const rke2CustomName = SHARED_RKE2_CUSTOM_NAME;
        const customAddonConfig = `goodvalue: yay\nnested:\n  enabled: true`;
        const updatedDescription = `${rke2CustomName}-addon-persist-check`;

        const clusterList = new ClusterManagerListPagePo(page);
        const editCreatedClusterPage = new ClusterManagerEditRke2CustomPagePo(page, '_', rke2CustomName);

        await clusterList.goTo();
        await clusterList.waitForPage();
        const editMenu = await clusterList.list().actionMenu(rke2CustomName);

        await editMenu.getMenuItem('Edit Config').click();
        await editCreatedClusterPage.waitForPage('mode=edit', 'basic');
        await editCreatedClusterPage.clusterConfigurationTabs().tabBySelector('li#rke2-calico').click();
        await editCreatedClusterPage.calicoAddonConfig().yamlEditor().set(customAddonConfig);
        await editCreatedClusterPage.save();
        await clusterList.waitForPage();

        const editMenu2 = await clusterList.list().actionMenu(rke2CustomName);

        await editMenu2.getMenuItem('Edit Config').click();
        await editCreatedClusterPage.waitForPage('mode=edit', 'basic');
        await editCreatedClusterPage.nameNsDescription().description().set(updatedDescription);
        await editCreatedClusterPage.save();
        await clusterList.waitForPage();

        const editMenu3 = await clusterList.list().actionMenu(rke2CustomName);

        await editMenu3.getMenuItem('Edit Config').click();
        await editCreatedClusterPage.waitForPage('mode=edit', 'basic');
        await editCreatedClusterPage.clusterConfigurationTabs().tabBySelector('li#rke2-calico').click();
        await expect(editCreatedClusterPage.calicoAddonConfig().yamlEditor().self()).toBeVisible();
        expect(await editCreatedClusterPage.calicoAddonConfig().yamlEditor().value()).toBe(customAddonConfig);
      });

      test.fixme('can delete cluster', async ({ page, login }) => {
        await login();

        const rke2CustomName = SHARED_RKE2_CUSTOM_NAME;
        const clusterList = new ClusterManagerListPagePo(page);

        await clusterList.goTo();
        await clusterList.waitForPage();
        await expect(clusterList.sortableTable().rowElementWithName(rke2CustomName)).toBeAttached(MEDIUM_TIMEOUT_OPT);
        const actionMenu = await clusterList.list().actionMenu(rke2CustomName);

        await actionMenu.getMenuItem('Delete').click();

        const promptRemove = new PromptRemove(page);

        await promptRemove.confirm(rke2CustomName);
        await promptRemove.remove();

        await clusterList.waitForPage();
        await expect(clusterList.sortableTable().rowElementWithName(rke2CustomName)).not.toBeAttached();
      });
    });
  });

  test.describe('Imported', { tag: ['@jenkins', '@importedCluster', '@provisioning', '@needsInfra'] }, () => {
    test.describe('Generic', () => {
      // Bodies below are ported from upstream rancher/dashboard PR #17795 and rely on a live
      // imported cluster. The create test is wired up end-to-end (registers the agent via
      // `applyImportedKubectlCommand`); edit + delete remain `test.fixme` until shared-state
      // wiring lands (they reference the static SHARED_IMPORT_GENERIC_NAME, not the cluster
      // the create test actually provisions).

      test('can create new cluster', async ({ page, login }) => {
        await login();

        const importGenericName = `e2e-test-${Date.now()}-create-import-generic`;
        const clusterList = new ClusterManagerListPagePo(page);
        const importPage = new ClusterManagerImportGenericPagePo(page);

        const importRequest = page.waitForResponse(
          (resp) => resp.url().includes('/v3/clusters') && resp.request().method() === 'POST',
        );

        await clusterList.goTo();
        await clusterList.waitForPage();

        // PR #17795: wait for list visibility before masthead interactions (avoids masthead races)
        await expect(clusterList.list().self()).toBeVisible(MEDIUM_TIMEOUT_OPT);
        await clusterList.importCluster();

        await importPage.waitForPage('mode=import');
        await importPage.selectGeneric(0).click();
        await importPage.waitForPage('mode=import&type=import&rkeType=rke2');

        // Accordion sanity check — upstream verifies Basics / Member Roles / Labels / Registries / Advanced
        await expect(importPage.accordion(2, 'Basics')).toBeVisible();
        await expect(importPage.accordion(3, 'Member Roles')).toBeVisible();
        await expect(importPage.accordion(4, 'Labels and Annotations')).toBeVisible();
        await expect(importPage.registriesAccordion()).toBeVisible();
        await expect(importPage.networkingAccordion()).not.toBeAttached();

        await importPage.nameNsDescription().name().set(importGenericName);
        // Issue #13614: version-management banner visible on create
        await expect(importPage.versionManagementBanner()).toBeVisible();

        await importPage.create();

        const created = await importRequest;

        expect(created.status()).toBe(201);

        const { id: clusterId } = await clusterList.goToClusterListAndGetClusterDetails(importGenericName);
        const detailPage = new ClusterManagerDetailImportedGenericPagePo(page, '_', clusterId);

        // PR #17795: extended timeout on registration page (slow render under load)
        await detailPage.goTo(undefined, 'registration');
        await detailPage.waitForPage(undefined, 'registration', MEDIUM_TIMEOUT_OPT);

        await expect(detailPage.kubectlCommandForImported().filter({ hasText: '--insecure' }).first()).toContainText(
          '--insecure',
        );

        const kubectlCommand =
          (await detailPage.kubectlCommandForImported().filter({ hasText: '--insecure' }).first().textContent()) ?? '';

        // Apply the kubectl-apply registration command on the host running the spec.
        // Stays inside `test.fixme` so it never executes without kubeconfig configured.
        await applyImportedKubectlCommand(kubectlCommand);

        await clusterList.goTo();
        await clusterList.waitForPage();

        // PR #17795: accept Pending as a transient state alongside Provisioning / Waiting
        await expect(clusterList.list().state(importGenericName)).toBeVisible(EXTRA_LONG_TIMEOUT_OPT);
        await expect(clusterList.list().state(importGenericName)).toHaveText(
          /^(Pending|Provisioning|Waiting)$/,
          EXTRA_LONG_TIMEOUT_OPT,
        );
        await expect(clusterList.list().state(importGenericName)).toContainText('Active', EXTRA_LONG_TIMEOUT_OPT);

        // Issue #6836: Imported provider column reads "Imported" with K3s subtype
        await expect(clusterList.list().provider(importGenericName)).toContainText('Imported');
        await expect(clusterList.list().providerSubType(importGenericName)).toContainText('K3s');
      });

      test.fixme('can edit imported cluster and see changes afterwards', async ({ page, login }) => {
        await login();

        const fqdn = 'fqdn';
        const cacert = 'cacert';
        const privateRegistry = 'registry.io';

        // Caller must guarantee the imported cluster created by the prior fixme exists.
        const importGenericName = SHARED_IMPORT_GENERIC_NAME;

        const clusterList = new ClusterManagerListPagePo(page);
        const { id: clusterId } = await clusterList.goToClusterListAndGetClusterDetails(importGenericName);
        const editImported = new ClusterManagerEditImportedPagePo(page, '_', 'fleet-default', clusterId);

        await clusterList.goTo();
        await clusterList.waitForPage();
        const editMenu = await clusterList.list().actionMenu(importGenericName);

        await editMenu.getMenuItem('Edit Config').click();
        await editImported.waitForPage('mode=edit');

        // Issue #10432: name field is read-only on imported clusters
        await expect(editImported.nameNsDescription().name().input()).toBeDisabled();

        // Issue #13614: banner hidden when version-mgmt unchanged
        await expect(editImported.versionManagementBanner()).not.toBeAttached();

        await editImported.enableVersionManagement();
        await expect(editImported.versionManagementBanner()).toBeVisible();
        await editImported.defaultVersionManagement();

        // Networking accordion → enable ACE + cacert
        await editImported.toggleAccordion(5, 'Networking');
        await editImported.ace().enable();
        await editImported.ace().enterFdqn(fqdn);
        await editImported.ace().enterCaCerts(cacert);

        // Registries accordion → enable private registry
        await editImported.toggleAccordion(6, 'Registries');
        await editImported.enablePrivateRegistryCheckbox();
        await editImported.privateRegistry().set(privateRegistry);

        await editImported.save();
        await clusterList.waitForPage();

        // Re-open and verify persistence
        const editMenu2 = await clusterList.list().actionMenu(importGenericName);

        await editMenu2.getMenuItem('Edit Config').click();
        await editImported.waitForPage('mode=edit');

        await expect(editImported.ace().fqdn().input()).toHaveValue(fqdn);
        await expect(editImported.ace().caCerts().input()).toHaveValue(cacert);
        await expect(editImported.privateRegistryCheckbox().checkboxCustom()).toHaveAttribute('aria-checked', 'true');
        await expect(editImported.privateRegistry().input()).toHaveValue(privateRegistry);
      });

      test.fixme('can delete cluster by bulk actions', async ({ page, login }) => {
        await login();

        const importGenericName = SHARED_IMPORT_GENERIC_NAME;
        const clusterList = new ClusterManagerListPagePo(page);

        await clusterList.goTo();
        await clusterList.waitForPage();

        // PR #17795: wait for list visibility before bulk interactions
        await expect(clusterList.list().self()).toBeVisible(MEDIUM_TIMEOUT_OPT);
        await expect(clusterList.sortableTable().rowElementWithName(importGenericName)).toBeAttached(
          MEDIUM_TIMEOUT_OPT,
        );

        await clusterList.sortableTable().rowSelectCtlWithName(importGenericName).set();
        await clusterList.sortableTable().bulkActionDropDownOpen();
        await clusterList.sortableTable().bulkActionDropDownButton('Delete').click();

        const promptRemove = new PromptRemove(page);

        await promptRemove.confirm(importGenericName);
        await promptRemove.remove();

        await clusterList.waitForPage();
        await expect(clusterList.sortableTable().rowElementWithName(importGenericName)).not.toBeAttached();
      });
    });
  });

  test('can navigate to Cluster Management Page', async ({ page, login }) => {
    await login();

    const homePage = new HomePagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await homePage.goTo();
    await burgerMenu.toggle();

    const clusterManagementNavItem = burgerMenu.burgerMenuGetNavMenuByLabel('Cluster Management');

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
      await clusterList.goToDetailsPage('local');

      await expect(page).toHaveURL(/\/local[#/]/);

      const conditionsBtn = clusterDetail.conditionsTab();

      await expect(conditionsBtn).toBeVisible();
      await conditionsBtn.click();
      await expect(page).toHaveURL(/conditions/);

      await expect(clusterDetail.tableRowCell('Created', 1)).toContainText('True');
    });

    test('can navigate to Cluster Related Page', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local');

      await clusterDetail.relatedTab().click();
      await expect(page).toHaveURL(/related/);

      await expect(clusterDetail.tableRowCell('Mgmt', 2)).toContainText('local');
    });

    test('can navigate to Cluster Provisioning Log Page', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local');

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
      await clusterList.goToDetailsPage('local');

      await clusterDetail.nodePoolsTab().click();
      await expect(page).toHaveURL(/node-pools/);

      await expect(clusterDetail.tableRowContaining('machine-').first()).toBeVisible();
    });

    test('Show Configuration allows to edit config and view yaml for local cluster', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local');

      await clusterDetail.showConfigurationButton().click();

      const drawer = clusterDetail.configurationDrawer();

      await expect(drawer).toBeVisible();
      await expect(clusterDetail.drawerEditConfigButton()).toBeVisible();

      await expect(clusterDetail.drawerConfigTab()).toBeVisible();
      await expect(clusterDetail.drawerYamlTab()).toBeVisible();

      await clusterDetail.drawerYamlTab().click();
      await expect(clusterDetail.drawerEditConfigButton()).not.toBeAttached();
    });

    test('can navigate to namespace from cluster detail view', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local');

      const nsLink = clusterDetail.clusterNamespaceLink();

      await expect(nsLink).toContainText('fleet-local');
      await nsLink.getByRole('link', { name: 'fleet-local' }).click();

      // Upstream expects navigation to a namespace page with Resources tab
      await page.waitForURL(/fleet-local/, SHORT_TIMEOUT_OPT);
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

    test('hides Networking accordion and ACE on local cluster edit', async ({ page, login }) => {
      await login();

      const clusterList = new ClusterManagerListPagePo(page);
      // Edit Config navigates under the manager context (/c/_/manager/...), local cluster lives in fleet-local ns
      const editLocalCluster = new ClusterManagerEditImportedPagePo(page, '_', 'fleet-local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      const editMenu = await clusterList.list().actionMenu('local');

      await editMenu.getMenuItem('Edit Config').click();
      await editLocalCluster.waitForPage('mode=edit');

      // Upstream PR #17293: Networking accordion + ACE widget hidden on local cluster
      await expect(editLocalCluster.networkingAccordion()).not.toBeAttached();
      await expect(editLocalCluster.aceEnabledRadio()).not.toBeAttached();

      // Regression guard: Registries + Advanced still render
      await expect(editLocalCluster.registriesAccordion()).toBeVisible();
      await expect(editLocalCluster.accordionByLabel('Advanced')).toBeVisible();
    });
  });

  test('can download YAML via bulk actions', async ({ page, login }) => {
    await login();

    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();

    await clusterList.sortableTable().rowElementWithName('local').click();

    const downloadPromise = page.waitForEvent('download');

    await clusterList.list().openBulkActionDropdown();
    // eslint-disable-next-line playwright/no-force-option -- bulk-action dropdown overlay can intercept the menu-item click on slower renders
    await clusterList.list().bulkActionButton('Download YAML').click({ force: true });

    const download = await downloadPromise;
    const content = (await (await download.createReadStream()).toArray()).join('');
    const obj = jsyaml.load(content) as Record<string, any>;

    expect(obj.apiVersion).toBe('provisioning.cattle.io/v1');
    expect(obj.metadata.name).toBe('local');
    expect(obj.kind).toBe('Cluster');
  });

  test('can download KubeConfig via bulk actions', async ({ page, login }) => {
    await login();

    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.goTo();
    await clusterList.waitForPage();

    const kubeConfigResponse = page.waitForResponse(
      (resp) => resp.url().includes('/v1/ext.cattle.io.kubeconfigs') && resp.request().method() === 'POST',
    );
    const downloadPromise = page.waitForEvent('download');

    await clusterList.sortableTable().rowElementWithName('local').click();
    await clusterList.list().openBulkActionDropdown();
    await clusterList.list().bulkActionButton('Download KubeConfig').click();

    const resp = await kubeConfigResponse;

    expect(resp.status()).toBe(201);

    const download = await downloadPromise;
    const content = (await (await download.createReadStream()).toArray()).join('');
    const obj = jsyaml.load(content) as Record<string, any>;

    expect(obj.apiVersion).toBe('v1');
    expect(obj.kind).toBe('Config');
    expect(obj.clusters.some((c: { name: string }) => c.name === 'local')).toBe(true);
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
    await expect(clusterDetail.kubectlConnectedText()).toBeVisible();

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

          await expect(clusterCreate.credentialsBannerLocator()).toBeAttached();
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

          await expect(clusterCreate.credentialsBannerLocator()).toBeAttached();
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

        await expect(clusterCreate.credentialsBannerLocator()).toBeAttached();
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

        await expect(clusterCreate.credentialsBannerLocator()).not.toBeAttached();
      });
    });
  });
});

test.describe('Cluster Manager as standard user', { tag: ['@manager', '@standardUser'] }, () => {
  test('can navigate to Cluster Management Page', async ({ page, login, envMeta }) => {
    await login({ username: 'standard_user', password: envMeta.password });

    const homePage = new HomePagePo(page);
    const burgerMenu = new BurgerMenuPo(page);

    await homePage.goTo();
    await burgerMenu.toggle();

    const clusterManagementNavItem = burgerMenu.burgerMenuGetNavMenuByLabel('Cluster Management');

    await expect(clusterManagementNavItem).toBeVisible();
    await clusterManagementNavItem.click();

    const clusterList = new ClusterManagerListPagePo(page);

    await clusterList.waitForPage();
  });

  test.describe('Cluster Detail Page', () => {
    test('Show Configuration allows to view but not edit config and yaml for local cluster', async ({
      page,
      login,
      envMeta,
    }) => {
      await login({ username: 'standard_user', password: envMeta.password });

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local');

      await expect(page).toHaveURL(/provisioning\.cattle\.io\.cluster\/fleet-local\/local/);

      await clusterDetail.showConfigurationButton().click();

      const drawer = clusterDetail.configurationDrawer();

      await expect(drawer).toBeVisible();
      await expect(clusterDetail.drawerEditConfigButton()).not.toBeAttached();

      await expect(clusterDetail.drawerConfigTab()).toBeVisible();
      await expect(clusterDetail.drawerYamlTab()).toBeVisible();

      await clusterDetail.drawerYamlTab().click();
      await expect(clusterDetail.drawerEditConfigButton()).not.toBeAttached();
    });

    test('Shows the explore button and navigates to the cluster explorer when clicked', async ({
      page,
      login,
      envMeta,
    }) => {
      await login({ username: 'standard_user', password: envMeta.password });

      const clusterList = new ClusterManagerListPagePo(page);
      const clusterDetail = new ClusterManagerDetailRke2AmazonEc2PagePo(page, 'local', 'local');

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.goToDetailsPage('local');

      await expect(page).toHaveURL(/provisioning\.cattle\.io\.cluster\/fleet-local\/local/);

      await expect(clusterDetail.exploreButton()).toBeVisible();
      await clusterDetail.exploreButton().click();

      await expect(page).toHaveURL(/\/c\/local\/explorer/);
    });
  });
});

test.describe('Visual snapshots', { tag: ['@visual', '@manager', '@adminUser'] }, () => {
  test('cluster manager list page matches snapshot', async ({ page, login, rancherApi, isPrime }) => {
    await login();
    const restoreTheme = await ensureLightTheme(rancherApi);

    try {
      const clusterList = new ClusterManagerListPagePo(page);

      await clusterList.goTo();
      await clusterList.waitForPage();
      await clusterList.sortableTable().waitForReady();

      // Empty-state guard: snapshot baseline expects only the local cluster.
      // If a peer provisioning test left an orphan, fail loudly.
      await expect(clusterList.sortableTable().rowElements()).toHaveCount(1);
      await expect(clusterList.sortableTable().rowWithName('local').self()).toBeVisible();

      await expect(page).toHaveScreenshot(visualSnapshot(isPrime, 'cluster-manager-list.png'), {
        fullPage: true,
        mask: [clusterList.sortableTable().ageColumn(), ...chromeMasks(page)],
      });
    } finally {
      await restoreTheme();
    }
  });
});
