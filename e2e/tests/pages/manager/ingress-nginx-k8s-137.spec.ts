import type { Page } from '@playwright/test';
import { test, expect } from '@/support/fixtures';
import type { RancherApi } from '@/support/fixtures/rancher-api';
import { installFakeClusterRoutes } from '@/e2e/blueprints/nav/fake-cluster';
import { generateProvClusterObj } from '@/e2e/blueprints/nav/fake-cluster-objects';
import ClusterManagerCreateRke2CustomPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/create/cluster-create-rke2-custom.po';
import ClusterManagerEditGenericPagePo from '@/e2e/po/edit/provisioning.cattle.io.cluster/edit/cluster-edit-generic.po';
import type BasicsRke2 from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/basics-tab-rke2.po';
import IngressRke2Po from '@/e2e/po/edit/provisioning.cattle.io.cluster/tabs/ingress-rke2.po';

/**
 * Standalone Ingress-NGINX is not available for RKE2 clusters on Kubernetes v1.37.0 or later,
 * on any Rancher edition:
 *  - Create: the Ingress-NGINX card is hidden from v1.37, and shown (selectable) below it.
 *  - Edit: moving a standalone Ingress-NGINX cluster to v1.37 or later raises an error and blocks
 *    Save until Traefik or Dual Mode is picked; a Dual Mode cluster only gets a warning.
 *
 * Nothing is submitted and nothing is provisioned: the create-form tests only inspect the form,
 * and the edit tests serve a mocked node-driver cluster, so there is no cluster to clean up and
 * the spec is idempotent.
 */

const LEGACY_NGINX_TEXT = 'Choose this only if your workloads are not yet ready for Traefik.';

const FAKE_PROV_CLUSTER_ID = 'ingress-nginx-fake-cluster';
const FAKE_MGMT_CLUSTER_ID = 'ingress-nginx-fake-mgmt';

const NGINX_AVAILABLE_MINOR = '1.36';
const NGINX_UNAVAILABLE_MINOR = '1.37';

/** Open the RKE2 custom cluster create form on the Basics tab */
async function openCreateForm(page: Page): Promise<ClusterManagerCreateRke2CustomPagePo> {
  const createPage = new ClusterManagerCreateRke2CustomPagePo(page);

  await createPage.goToCustomClusterCreation('_');
  await expect(createPage.basicsTab().kubernetesVersions().self()).toBeVisible();

  return createPage;
}

/** Pick the newest RKE2 patch of a Kubernetes minor from the version dropdown */
async function selectRke2Minor(basics: BasicsRke2, minor: string): Promise<void> {
  const versions = basics.kubernetesVersions();

  await versions.dropdown().click();
  await versions
    .getOptions()
    .filter({ hasText: `v${minor}.` })
    .filter({ hasText: '+rke2' })
    .first()
    .click();
  await expect(versions.selectedOption()).toContainText(`v${minor}.`, { useInnerText: true });
}

/** Newest available RKE2 release of a Kubernetes minor, or undefined when the backend has none */
async function latestRke2Release(rancherApi: RancherApi, minor: string): Promise<string | undefined> {
  const releases = await rancherApi.getRancherResource('v1-rke2-release', 'releases');
  const ids: string[] = (releases.body.data || []).map((r: { id: string }) => r.id);

  return ids.filter((id) => id.startsWith(`v${minor}.`)).pop();
}

/** Open the edit form of a mocked node-driver cluster that runs the given ingress controller on v1.36 */
async function openFakeClusterEdit(
  page: Page,
  kubernetesVersion: string,
  ingressController: string | string[],
): Promise<ClusterManagerEditGenericPagePo> {
  await installFakeClusterRoutes(page, {
    fakeProvClusterId: FAKE_PROV_CLUSTER_ID,
    fakeMgmtClusterId: FAKE_MGMT_CLUSTER_ID,
    addEditClusterCapabilities: true,
  });

  const fakeCluster = generateProvClusterObj(FAKE_PROV_CLUSTER_ID, FAKE_MGMT_CLUSTER_ID);

  const rkeConfig = fakeCluster.spec.rkeConfig as unknown as {
    machineGlobalConfig: Record<string, unknown>;
    chartValues: Record<string, unknown>;
  };

  fakeCluster.spec.kubernetesVersion = kubernetesVersion;
  rkeConfig.machineGlobalConfig['ingress-controller'] = ingressController;

  if (Array.isArray(ingressController)) {
    // Dual Mode needs the two controllers on different host ports to pass form validation
    rkeConfig.chartValues['rke2-traefik'] = { ports: { web: { hostPort: 8000 }, websecure: { hostPort: 8443 } } };
    rkeConfig.chartValues['rke2-ingress-nginx'] = { controller: { hostPort: { ports: { http: 80, https: 443 } } } };
  }

  await page.route(`**/v1/provisioning.cattle.io.clusters/fleet-default/${FAKE_PROV_CLUSTER_ID}?*`, (route) =>
    route.fulfill({ status: 200, json: fakeCluster }),
  );

  const editPage = new ClusterManagerEditGenericPagePo(page, '_', FAKE_PROV_CLUSTER_ID);

  await editPage.goTo('mode=edit', 'basic');
  await editPage.waitForPage('mode=edit', 'basic');
  await expect(editPage.basicsTab().kubernetesVersions().self()).toBeVisible();

  return editPage;
}

test.describe('Ingress NGINX on Kubernetes 1.37 or later', { tag: ['@manager', '@adminUser'] }, () => {
  test.beforeEach(async ({ login }) => {
    await login();
  });

  test('Ingress-NGINX is hidden and Traefik stays available from Kubernetes v1.37', async ({ page }) => {
    const createPage = await openCreateForm(page);

    await selectRke2Minor(createPage.basicsTab(), NGINX_UNAVAILABLE_MINOR);

    const ingress = new IngressRke2Po(page);

    await expect(ingress.traefikCard()).toBeVisible();
    await expect(ingress.nginxCard()).toHaveCount(0);
    await expect(ingress.transitioningBanner()).toHaveCount(0);

    await ingress.clickCard(ingress.traefikCard());
    await expect(ingress.traefikCard()).toHaveClass(/selected/);
  });

  test('Ingress-NGINX stays selectable below Kubernetes v1.37', async ({ page }) => {
    const createPage = await openCreateForm(page);

    await selectRke2Minor(createPage.basicsTab(), NGINX_AVAILABLE_MINOR);

    const ingress = new IngressRke2Po(page);
    const nginx = ingress.nginxCard();

    await expect(nginx).toBeVisible();
    await expect(nginx).not.toHaveClass(/disabled/);
    await expect(ingress.cardContent(nginx)).toContainText(LEGACY_NGINX_TEXT);
    await expect(ingress.traefikCard()).toBeVisible();
    await expect(ingress.transitioningBanner()).toBeVisible();

    await ingress.clickCard(nginx);
    await expect(nginx).toHaveClass(/selected/);
  });

  test('switching the Kubernetes version across v1.37 shows and hides the Ingress-NGINX card live', async ({
    page,
  }) => {
    const createPage = await openCreateForm(page);
    const basics = createPage.basicsTab();
    const ingress = new IngressRke2Po(page);

    await selectRke2Minor(basics, NGINX_AVAILABLE_MINOR);
    await expect(ingress.nginxCard()).toBeVisible();

    await selectRke2Minor(basics, NGINX_UNAVAILABLE_MINOR);
    await expect(ingress.nginxCard()).toHaveCount(0);
    await expect(ingress.traefikCard()).toBeVisible();

    await selectRke2Minor(basics, NGINX_AVAILABLE_MINOR);
    await expect(ingress.nginxCard()).toBeVisible();
    await expect(ingress.transitioningBanner()).toBeVisible();

    await selectRke2Minor(basics, NGINX_UNAVAILABLE_MINOR);
    await expect(ingress.nginxCard()).toHaveCount(0);
  });

  test('the Install Ingress controller toggle still works at Kubernetes v1.37', async ({ page }) => {
    const createPage = await openCreateForm(page);

    await selectRke2Minor(createPage.basicsTab(), NGINX_UNAVAILABLE_MINOR);

    const ingress = new IngressRke2Po(page);

    await expect(ingress.enableCheckbox().checkboxCustom()).toHaveAttribute('aria-checked', 'true');
    await expect(ingress.traefikCard()).toBeVisible();

    await ingress.enableCheckbox().set();
    await expect(ingress.enableCheckbox().checkboxCustom()).toHaveAttribute('aria-checked', 'false');
    await expect(ingress.disabledBanner()).toBeVisible();
    await expect(ingress.traefikCard()).toHaveCount(0);

    await ingress.enableCheckbox().set();
    await expect(ingress.enableCheckbox().checkboxCustom()).toHaveAttribute('aria-checked', 'true');
    await expect(ingress.disabledBanner()).toHaveCount(0);
    await expect(ingress.traefikCard()).toBeVisible();
    await expect(ingress.nginxCard()).toHaveCount(0);
  });

  test('upgrading an Ingress-NGINX cluster to Kubernetes v1.37 is blocked until Traefik is chosen', async ({
    page,
    rancherApi,
  }) => {
    const nginxVersion = await latestRke2Release(rancherApi, NGINX_AVAILABLE_MINOR);

    test.skip(!nginxVersion, `No RKE2 v${NGINX_AVAILABLE_MINOR} release available`);

    const editPage = await openFakeClusterEdit(page, nginxVersion as string, 'ingress-nginx');
    const ingress = new IngressRke2Po(page);
    const save = editPage.resourceDetail().createEditView().saveButtonPo().self();

    // Below v1.37 there is nothing to flag
    await expect(ingress.nginxCard()).toHaveClass(/selected/);
    await expect(save).toBeEnabled();
    await expect(ingress.nginxUpgradeBlockedBanner()).toHaveCount(0);
    await expect(ingress.nginxUpgradeWarningBanner()).toHaveCount(0);

    await selectRke2Minor(editPage.basicsTab(), NGINX_UNAVAILABLE_MINOR);

    await expect(ingress.nginxUpgradeBlockedBanner()).toBeVisible();
    await expect(ingress.nginxUpgradeWarningBanner()).toHaveCount(0);
    await expect(ingress.nginxCard()).toHaveClass(/disabled/);
    await expect(save).toBeDisabled();

    // Picking Traefik turns the error into a warning and unblocks Save
    await ingress.clickCard(ingress.traefikCard());

    await expect(ingress.traefikCard()).toHaveClass(/selected/);
    await expect(ingress.nginxUpgradeBlockedBanner()).toHaveCount(0);
    await expect(ingress.nginxUpgradeWarningBanner()).toBeVisible();
    await expect(save).toBeEnabled();
  });

  test('upgrading a Dual Mode cluster to Kubernetes v1.37 only warns that standalone Ingress-NGINX cannot return', async ({
    page,
    rancherApi,
  }) => {
    const nginxVersion = await latestRke2Release(rancherApi, NGINX_AVAILABLE_MINOR);

    test.skip(!nginxVersion, `No RKE2 v${NGINX_AVAILABLE_MINOR} release available`);

    const editPage = await openFakeClusterEdit(page, nginxVersion as string, ['ingress-nginx', 'traefik']);
    const ingress = new IngressRke2Po(page);
    const save = editPage.resourceDetail().createEditView().saveButtonPo().self();

    await expect(ingress.dualCard()).toHaveClass(/selected/);
    await expect(save).toBeEnabled();
    await expect(ingress.nginxUpgradeWarningBanner()).toHaveCount(0);

    await selectRke2Minor(editPage.basicsTab(), NGINX_UNAVAILABLE_MINOR);

    await expect(ingress.nginxUpgradeWarningBanner()).toBeVisible();
    await expect(ingress.nginxUpgradeBlockedBanner()).toHaveCount(0);
    await expect(ingress.nginxCard()).toHaveClass(/disabled/);
    await expect(ingress.dualCard()).not.toHaveClass(/disabled/);
    await expect(save).toBeEnabled();
  });
});
